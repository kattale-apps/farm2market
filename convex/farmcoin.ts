/**
 * FarmCoin Token Ledger
 *
 * - Central ledger + per-trader ledger
 * - Per-transaction entries with source + UTID
 * - Pricing changes are versioned
 */

import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { generateUTID, getUgandaTime } from "./utils";
import { verifyAdminRole } from "./auth";

const DEFAULT_POSTING_COST = 1;
const DEFAULT_ETA_CHANGE_COST = 1;

function isSuperAdmin(user: { adminLevel?: "super" | "junior" }) {
  return user.adminLevel === "super" || user.adminLevel === undefined;
}

function isFinanceAdmin(user: { adminLevel?: "super" | "junior"; adminCategory?: string }) {
  return user.adminLevel === "junior" && user.adminCategory === "finance";
}

async function getLatestFarmcoinBalance(
  ctx: any,
  accountType: "central" | "trader" | "sentify" | "buyer_reward",
  traderId?: Id<"users">,
  userId?: Id<"users">
): Promise<number> {
  let query = ctx.db
    .query("farmcoinLedger")
    .withIndex("by_account", (q: any) => q.eq("accountType", accountType))
    .order("desc");

  if (accountType === "trader" && traderId) {
    query = query.filter((q: any) => q.eq(q.field("traderId"), traderId));
  }

  if ((accountType === "sentify" || accountType === "buyer_reward") && userId) {
    query = query.filter((q: any) => q.eq(q.field("userId"), userId));
  }

  const latest = await query.first();

  return latest?.balanceAfter ?? 0;
}

async function getFarmcoinCashoutRate(ctx: any): Promise<number> {
  const settings = await ctx.db.query("systemSettings").first();
  return settings?.farmcoinPostingCost ?? DEFAULT_POSTING_COST;
}

export const getFarmcoinSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("systemSettings").first();
    return {
      farmcoinPostingCost: settings?.farmcoinPostingCost ?? DEFAULT_POSTING_COST,
      farmcoinEtaChangeCost: settings?.farmcoinEtaChangeCost ?? DEFAULT_ETA_CHANGE_COST,
    };
  },
});

export const getFarmcoinPricingHistory = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    const adminCheck = await verifyAdminRole({ userId: args.adminId, db: ctx.db });
    if (!adminCheck.authorized || !adminCheck.user) {
      throw new Error("Not authorized");
    }

    const adminUser = adminCheck.user;
    if (!isSuperAdmin(adminUser) && !isFinanceAdmin(adminUser)) {
      throw new Error("Not authorized");
    }

    const history = await ctx.db
      .query("farmcoinPricingHistory")
      .withIndex("by_created", (q: any) => q)
      .order("desc")
      .collect();

    return history;
  },
});

export const updateFarmcoinPricing = mutation({
  args: {
    adminId: v.id("users"),
    farmcoinPostingCost: v.optional(v.number()),
    farmcoinEtaChangeCost: v.optional(v.number()),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const adminCheck = await verifyAdminRole({ userId: args.adminId, db: ctx.db });
    if (!adminCheck.authorized || !adminCheck.user) {
      throw new Error("Not authorized");
    }

    const adminUser = adminCheck.user;
    if (!isSuperAdmin(adminUser)) {
      throw new Error("Only Superadmin can update FarmCoin pricing");
    }

    const settings = await ctx.db.query("systemSettings").first();
    const now = getUgandaTime();

    if (args.farmcoinPostingCost !== undefined) {
      const oldValue = settings?.farmcoinPostingCost ?? DEFAULT_POSTING_COST;
      const newValue = args.farmcoinPostingCost;
      const utid = generateUTID("admin");

      if (settings) {
        await ctx.db.patch(settings._id, { farmcoinPostingCost: newValue });
      } else {
        await ctx.db.insert("systemSettings", {
          pilotMode: false,
          setBy: args.adminId,
          setAt: now,
          reason: "FarmCoin pricing initialization",
          utid: generateUTID("admin"),
          farmcoinPostingCost: newValue,
          farmcoinEtaChangeCost: DEFAULT_ETA_CHANGE_COST,
        });
      }

      await ctx.db.insert("farmcoinPricingHistory", {
        changedByAdminId: args.adminId,
        oldValue,
        newValue,
        reason: args.reason,
        utid,
        createdAt: now,
      });
    }

    if (args.farmcoinEtaChangeCost !== undefined) {
      const oldValue = settings?.farmcoinEtaChangeCost ?? DEFAULT_ETA_CHANGE_COST;
      const newValue = args.farmcoinEtaChangeCost;
      const utid = generateUTID("admin");

      if (settings) {
        await ctx.db.patch(settings._id, { farmcoinEtaChangeCost: newValue });
      } else {
        await ctx.db.insert("systemSettings", {
          pilotMode: false,
          setBy: args.adminId,
          setAt: now,
          reason: "FarmCoin pricing initialization",
          utid: generateUTID("admin"),
          farmcoinPostingCost: DEFAULT_POSTING_COST,
          farmcoinEtaChangeCost: newValue,
        });
      }

      await ctx.db.insert("farmcoinPricingHistory", {
        changedByAdminId: args.adminId,
        oldValue,
        newValue,
        reason: args.reason,
        utid,
        createdAt: now,
      });
    }

    return { success: true };
  },
});

export const getFarmcoinLedger = query({
  args: {
    adminId: v.id("users"),
    traderId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const adminCheck = await verifyAdminRole({ userId: args.adminId, db: ctx.db });
    if (!adminCheck.authorized || !adminCheck.user) {
      throw new Error("Not authorized");
    }

    const adminUser = adminCheck.user;
    const canViewFull = isSuperAdmin(adminUser);
    const canViewAggregate = isFinanceAdmin(adminUser) || canViewFull;

    if (!canViewAggregate) {
      throw new Error("Not authorized");
    }

    const entries = await ctx.db
      .query("farmcoinLedger")
      .order("desc")
      .collect();

    if (canViewFull && args.traderId) {
      return entries.filter((e: any) => e.traderId === args.traderId);
    }

    if (canViewFull) {
      return entries;
    }

    // Finance admin: aggregate only (no trader identities)
    return entries.map((entry: any) => ({
      accountType: entry.accountType,
      delta: entry.delta,
      balanceAfter: entry.balanceAfter,
      source: entry.source,
      listingId: entry.listingId,
      reason: entry.reason,
      utid: entry.utid,
      batchUtid: entry.batchUtid,
      createdAt: entry.createdAt,
    }));
  },
});

export const getSuperadminFarmcoinActivity = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const adminCheck = await verifyAdminRole({ userId: args.adminId, db: ctx.db });
    if (!adminCheck.authorized || !adminCheck.user) {
      throw new Error("Not authorized");
    }

    const adminUser = adminCheck.user;
    if (!isSuperAdmin(adminUser)) {
      throw new Error("Only Superadmin can view this activity");
    }

    const grantEntries = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_source", (q: any) => q.eq("source", "grant"))
      .order("desc")
      .collect();

    const myGrants = grantEntries.filter(
      (entry: any) => entry.adminId === args.adminId && entry.accountType === "trader"
    );

    const traderIds = Array.from(
      new Set(myGrants.map((entry: any) => entry.traderId).filter(Boolean))
    ) as Id<"users">[];

    const traders = await Promise.all(traderIds.map((id) => ctx.db.get(id)));
    const traderMap = new Map(
      traders.filter(Boolean).map((trader: any) => [trader._id, trader])
    );

    const grants = myGrants.map((entry: any) => {
      const trader = traderMap.get(entry.traderId);
      return {
        ...entry,
        traderAlias: trader?.alias,
        traderEmail: trader?.email,
      };
    });

    const centralEntries = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_account", (q: any) => q.eq("accountType", "central"))
      .order("desc")
      .collect();

    const centralBalance = centralEntries[0]?.balanceAfter ?? 0;
    const returns = centralEntries
      .filter((entry: any) => entry.delta > 0 && entry.source !== "grant")
      .slice(0, 50);

    return { grants, centralBalance, returns };
  },
});

export const getFarmcoinTraderBalances = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const adminCheck = await verifyAdminRole({ userId: args.adminId, db: ctx.db });
    if (!adminCheck.authorized || !adminCheck.user) {
      throw new Error("Not authorized");
    }

    const adminUser = adminCheck.user;
    if (!isSuperAdmin(adminUser) && !isFinanceAdmin(adminUser)) {
      throw new Error("Not authorized");
    }

    const traders = await ctx.db
      .query("users")
      .withIndex("by_role", (q: any) => q.eq("role", "trader"))
      .collect();

    const tradersWithBalances = await Promise.all(
      traders.map(async (trader: any) => {
        const latestEntry = await ctx.db
          .query("farmcoinLedger")
          .withIndex("by_trader", (q: any) => q.eq("traderId", trader._id))
          .order("desc")
          .first();

        return {
          _id: trader._id,
          alias: trader.alias,
          email: trader.email,
          role: trader.role,
          farmcoinBalance: latestEntry?.balanceAfter ?? 0,
        };
      })
    );

    return { traders: tradersWithBalances };
  },
});

export const getTraderFarmcoinSummary = query({
  args: { traderId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.traderId);
    if (!user || !["trader", "transporter"].includes(user.role)) {
      throw new Error("User is not a trader or transporter");
    }

    const entries = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_trader", (q: any) => q.eq("traderId", args.traderId))
      .order("desc")
      .collect();

    const balance = entries[0]?.balanceAfter ?? 0;
    const recent = entries.slice(0, 10);

    return { balance, recent };
  },
});

export const getSentifyWalletSummary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !["trader", "transporter"].includes(user.role)) {
      throw new Error("User is not a trader or transporter");
    }

    const entries = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .filter((q: any) => q.eq(q.field("accountType"), "sentify"))
      .order("desc")
      .collect();

    const balance = entries[0]?.balanceAfter ?? 0;
    const recent = entries.slice(0, 10);
    const cashoutRate = await getFarmcoinCashoutRate(ctx);

    return { balance, recent, cashoutRate };
  },
});

export const getBuyerRewardSummary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    const entries = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .filter((q: any) => q.eq(q.field("accountType"), "buyer_reward"))
      .order("desc")
      .collect();

    const balance = entries[0]?.balanceAfter ?? 0;
    const recent = entries.slice(0, 10);
    const cashoutRate = await getFarmcoinCashoutRate(ctx);

    return { balance, recent, cashoutRate };
  },
});

export const getSentifyReceipts = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !["trader", "transporter"].includes(user.role)) {
      throw new Error("User is not a trader or transporter");
    }

    const entries = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .filter((q: any) => q.eq(q.field("accountType"), "sentify"))
      .order("desc")
      .collect();

    const cashouts = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .filter((q: any) => q.eq(q.field("source"), "sentify_cashout"))
      .collect();

    const cashedOut = new Set(cashouts.map((entry: any) => entry.relatedUtid).filter(Boolean));

    return entries
      .filter((entry: any) => entry.delta > 0 && !cashedOut.has(entry.utid))
      .map((entry: any) => ({
        utid: entry.utid,
        batchUtid: entry.batchUtid,
        delta: entry.delta,
        createdAt: entry.createdAt,
        listingId: entry.listingId,
      }));
  },
});

export const getBuyerRewardReceipts = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    const entries = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .filter((q: any) => q.eq(q.field("accountType"), "buyer_reward"))
      .order("desc")
      .collect();

    const cashouts = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .filter((q: any) => q.eq(q.field("source"), "buyer_reward_cashout"))
      .collect();

    const cashedOut = new Set(cashouts.map((entry: any) => entry.relatedUtid).filter(Boolean));

    return entries
      .filter((entry: any) => entry.delta > 0 && !cashedOut.has(entry.utid))
      .map((entry: any) => ({
        utid: entry.utid,
        batchUtid: entry.batchUtid,
        delta: entry.delta,
        createdAt: entry.createdAt,
      }));
  },
});

export const cashOutSentifyReceipt = mutation({
  args: {
    traderId: v.id("users"),
    receiptUtid: v.string(),
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.traderId);
    if (!user || !["trader", "transporter"].includes(user.role)) {
      throw new Error("User is not a trader or transporter");
    }

    const receipt = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_utid", (q: any) => q.eq("utid", args.receiptUtid))
      .first();

    if (!receipt || receipt.accountType !== "sentify" || receipt.delta <= 0) {
      throw new Error("Sentify receipt not found");
    }

    const priorCashout = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", args.traderId))
      .filter((q: any) => q.eq(q.field("source"), "sentify_cashout"))
      .filter((q: any) => q.eq(q.field("relatedUtid"), args.receiptUtid))
      .first();

    if (priorCashout) {
      throw new Error("Receipt already cashed out");
    }

    const currentBalance = await getLatestFarmcoinBalance(ctx, "sentify", undefined, args.traderId);
    if (currentBalance < receipt.delta) {
      throw new Error("Insufficient Sentify balance");
    }

    const cashoutUtid = generateUTID(user.role);
    const balanceAfter = currentBalance - receipt.delta;
    const cashoutRate = await getFarmcoinCashoutRate(ctx);
    const payoutAmount = receipt.delta * cashoutRate;

    await ctx.db.insert("farmcoinLedger", {
      accountType: "sentify",
      traderId: args.traderId,
      userId: args.traderId,
      delta: -receipt.delta,
      balanceAfter,
      source: "sentify_cashout",
      utid: cashoutUtid,
      listingId: receipt.listingId,
      batchUtid: receipt.batchUtid,
      relatedUtid: receipt.utid,
      reason: "Sentify cash-out",
      createdAt: getUgandaTime(),
    });

    await ctx.db.insert("adminActions", {
      adminId: args.traderId,
      actionType: "sentify_cashout_request",
      utid: cashoutUtid,
      reason: "Sentify cash-out request",
      metadata: {
        role: "trader",
        phoneNumber: args.phoneNumber,
        receiptUtid: receipt.utid,
        batchUtid: receipt.batchUtid,
        tokenAmount: receipt.delta,
        payoutAmount,
      },
      timestamp: getUgandaTime(),
    });

    const superAdmins = await ctx.db
      .query("users")
      .withIndex("by_role", (q: any) => q.eq("role", "admin"))
      .collect();

    const targetAdmins = superAdmins.filter((admin: any) => admin.adminLevel === "super" || admin.adminLevel === undefined);

    await Promise.all(
      targetAdmins.map((admin: any) =>
        ctx.db.insert("notifications", {
          userId: admin._id,
          type: "system",
          category: "pending_sentify_request",
          priority: "high",
          reminderFlag: true,
          title: "Pending Sentify Request",
          message: `Sentify cash-out request from ${user.alias} for ${receipt.delta} token(s) (UGX ${payoutAmount.toFixed(2)}).`,
          utid: cashoutUtid,
          metadata: {
            role: "trader",
            phoneNumber: args.phoneNumber,
            receiptUtid: receipt.utid,
            batchUtid: receipt.batchUtid,
            tokenAmount: receipt.delta,
            payoutAmount,
            futureEmail: true,
          },
          read: false,
          createdAt: getUgandaTime(),
        })
      )
    );

    return { success: true, utid: cashoutUtid, payoutAmount, balanceAfter };
  },
});

export const cashOutBuyerRewardReceipt = mutation({
  args: {
    buyerId: v.id("users"),
    receiptUtid: v.string(),
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    const receipt = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_utid", (q: any) => q.eq("utid", args.receiptUtid))
      .first();

    if (!receipt || receipt.accountType !== "buyer_reward" || receipt.delta <= 0) {
      throw new Error("Buyer reward receipt not found");
    }

    const priorCashout = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", args.buyerId))
      .filter((q: any) => q.eq(q.field("source"), "buyer_reward_cashout"))
      .filter((q: any) => q.eq(q.field("relatedUtid"), args.receiptUtid))
      .first();

    if (priorCashout) {
      throw new Error("Receipt already cashed out");
    }

    const currentBalance = await getLatestFarmcoinBalance(ctx, "buyer_reward", undefined, args.buyerId);
    if (currentBalance < receipt.delta) {
      throw new Error("Insufficient buyer reward balance");
    }

    const cashoutUtid = generateUTID(user.role);
    const balanceAfter = currentBalance - receipt.delta;
    const cashoutRate = await getFarmcoinCashoutRate(ctx);
    const payoutAmount = receipt.delta * cashoutRate;

    await ctx.db.insert("farmcoinLedger", {
      accountType: "buyer_reward",
      userId: args.buyerId,
      delta: -receipt.delta,
      balanceAfter,
      source: "buyer_reward_cashout",
      utid: cashoutUtid,
      batchUtid: receipt.batchUtid,
      relatedUtid: receipt.utid,
      reason: "Buyer reward cash-out",
      createdAt: getUgandaTime(),
    });

    await ctx.db.insert("adminActions", {
      adminId: args.buyerId,
      actionType: "buyer_reward_cashout_request",
      utid: cashoutUtid,
      reason: "Buyer reward cash-out request",
      metadata: {
        role: "buyer",
        phoneNumber: args.phoneNumber,
        receiptUtid: receipt.utid,
        tokenAmount: receipt.delta,
        payoutAmount,
      },
      timestamp: getUgandaTime(),
    });

    const superAdmins = await ctx.db
      .query("users")
      .withIndex("by_role", (q: any) => q.eq("role", "admin"))
      .collect();

    const targetAdmins = superAdmins.filter((admin: any) => admin.adminLevel === "super" || admin.adminLevel === undefined);

    await Promise.all(
      targetAdmins.map((admin: any) =>
        ctx.db.insert("notifications", {
          userId: admin._id,
          type: "system",
          category: "pending_sentify_request",
          priority: "high",
          reminderFlag: true,
          title: "Pending Sentify Request",
          message: `Buyer reward cash-out request from ${user.alias} for ${receipt.delta} token(s) (UGX ${payoutAmount.toFixed(2)}).`,
          utid: cashoutUtid,
          metadata: {
            role: "buyer",
            phoneNumber: args.phoneNumber,
            receiptUtid: receipt.utid,
            tokenAmount: receipt.delta,
            payoutAmount,
            futureEmail: true,
          },
          read: false,
          createdAt: getUgandaTime(),
        })
      )
    );

    return { success: true, utid: cashoutUtid, payoutAmount, balanceAfter };
  },
});

export const creditSentifyReceipt = internalMutation({
  args: {
    traderId: v.id("users"),
    listingId: v.optional(v.id("listings")),
    batchUtid: v.string(),
    tokenAmount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.tokenAmount <= 0) {
      throw new Error("Token amount must be positive");
    }

    const currentBalance = await getLatestFarmcoinBalance(
      ctx,
      "sentify",
      undefined,
      args.traderId
    );
    const balanceAfter = currentBalance + args.tokenAmount;

    const utid = generateUTID("admin");

    await ctx.db.insert("farmcoinLedger", {
      accountType: "sentify",
      traderId: args.traderId,
      userId: args.traderId,
      delta: args.tokenAmount,
      balanceAfter,
      source: "sentify_receipt",
      utid,
      listingId: args.listingId,
      batchUtid: args.batchUtid,
      reason: args.reason,
      createdAt: getUgandaTime(),
    });

    return { utid, balanceAfter };
  },
});

export const creditBuyerReward = internalMutation({
  args: {
    buyerId: v.id("users"),
    batchUtid: v.optional(v.string()),
    tokenAmount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.tokenAmount <= 0) {
      throw new Error("Token amount must be positive");
    }

    const currentBalance = await getLatestFarmcoinBalance(
      ctx,
      "buyer_reward",
      undefined,
      args.buyerId
    );
    const balanceAfter = currentBalance + args.tokenAmount;

    const utid = generateUTID("admin");

    await ctx.db.insert("farmcoinLedger", {
      accountType: "buyer_reward",
      userId: args.buyerId,
      delta: args.tokenAmount,
      balanceAfter,
      source: "buyer_confirmation_reward",
      utid,
      batchUtid: args.batchUtid,
      reason: args.reason,
      createdAt: getUgandaTime(),
    });

    return { utid, balanceAfter };
  },
});

export const grantFarmcoinTokens = mutation({
  args: {
    adminId: v.id("users"),
    traderId: v.id("users"),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const adminCheck = await verifyAdminRole({ userId: args.adminId, db: ctx.db });
    if (!adminCheck.authorized || !adminCheck.user) {
      throw new Error("Not authorized");
    }

    const adminUser = adminCheck.user;
    if (!isSuperAdmin(adminUser)) {
      throw new Error("Only Superadmin can grant FarmCoin tokens");
    }

    const trader = await ctx.db.get(args.traderId);
    if (!trader || !["trader", "transporter"].includes(trader.role)) {
      throw new Error("User is not a trader");
    }

    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    const now = getUgandaTime();
    const utid = generateUTID("admin");

    const centralBalance = await getLatestFarmcoinBalance(ctx, "central");
    const centralAfter = centralBalance - args.amount;

    const traderBalance = await getLatestFarmcoinBalance(ctx, "trader", args.traderId);
    const traderAfter = traderBalance + args.amount;

    await ctx.db.insert("farmcoinLedger", {
      accountType: "central",
      delta: -args.amount,
      balanceAfter: centralAfter,
      source: "grant",
      utid,
      adminId: args.adminId,
      reason: args.reason,
      createdAt: now,
    });

    await ctx.db.insert("farmcoinLedger", {
      accountType: "trader",
      traderId: args.traderId,
      delta: args.amount,
      balanceAfter: traderAfter,
      source: "grant",
      utid,
      adminId: args.adminId,
      reason: args.reason,
      createdAt: now,
    });

    return { utid, traderBalance: traderAfter, centralBalance: centralAfter };
  },
});

export const adjustCentralFarmcoin = mutation({
  args: {
    adminId: v.id("users"),
    delta: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const adminCheck = await verifyAdminRole({ userId: args.adminId, db: ctx.db });
    if (!adminCheck.authorized || !adminCheck.user) {
      throw new Error("Not authorized");
    }

    const adminUser = adminCheck.user;
    if (!isSuperAdmin(adminUser)) {
      throw new Error("Only Superadmin can adjust central FarmCoin ledger");
    }

    const now = getUgandaTime();
    const utid = generateUTID("admin");
    const centralBalance = await getLatestFarmcoinBalance(ctx, "central");
    const centralAfter = centralBalance + args.delta;

    await ctx.db.insert("farmcoinLedger", {
      accountType: "central",
      delta: args.delta,
      balanceAfter: centralAfter,
      source: "admin_adjustment",
      utid,
      adminId: args.adminId,
      reason: args.reason,
      createdAt: now,
    });

    return { utid, centralBalance: centralAfter };
  },
});

export const spendFarmcoinTokens = internalMutation({
  args: {
    traderId: v.id("users"),
    amount: v.number(),
    source: v.union(
      v.literal("posting_cost"),
      v.literal("eta_change"),
      v.literal("admin_adjustment"),
      v.literal("transfer"),
      v.literal("future_reward")
    ),
    listingId: v.optional(v.id("listings")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const trader = await ctx.db.get(args.traderId);
    if (!trader || !["trader", "transporter"].includes(trader.role)) {
      throw new Error("User is not a trader");
    }

    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    const now = getUgandaTime();
    const utid = generateUTID("system");

    const traderBalance = await getLatestFarmcoinBalance(ctx, "trader", args.traderId);
    if (traderBalance < args.amount) {
      throw new Error("Insufficient FarmCoin balance");
    }

    const traderAfter = traderBalance - args.amount;
    const centralBalance = await getLatestFarmcoinBalance(ctx, "central");
    const centralAfter = centralBalance + args.amount;

    await ctx.db.insert("farmcoinLedger", {
      accountType: "trader",
      traderId: args.traderId,
      delta: -args.amount,
      balanceAfter: traderAfter,
      source: args.source,
      utid,
      listingId: args.listingId,
      reason: args.reason,
      createdAt: now,
    });

    await ctx.db.insert("farmcoinLedger", {
      accountType: "central",
      delta: args.amount,
      balanceAfter: centralAfter,
      source: args.source,
      utid,
      listingId: args.listingId,
      reason: args.reason,
      createdAt: now,
    });

    return { utid, traderBalance: traderAfter, centralBalance: centralAfter };
  },
});

export const requestFarmcoinTokens = mutation({
  args: {
    traderId: v.id("users"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const trader = await ctx.db.get(args.traderId);
    if (!trader || !["trader", "transporter"].includes(trader.role)) {
      throw new Error("User is not a trader");
    }

    const admins = await ctx.db.query("users").collect();
    const superadmins = admins.filter(
      (u: any) => u.role === "admin" && (u.adminLevel === "super" || u.adminLevel === undefined)
    );

    const utid = generateUTID("trader");
    const now = getUgandaTime();

    for (const admin of superadmins) {
      await ctx.db.insert("notifications", {
        userId: admin._id,
        type: "system",
        title: "FarmCoin Token Request",
        message: `${trader.alias} requested FarmCoin tokens. Reason: ${args.reason}`,
        utid,
        read: false,
        createdAt: now,
      });
    }

    return { success: true, utid };
  },
});

export const getUnverifiedTraders = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    const adminCheck = await verifyAdminRole({ userId: args.adminId, db: ctx.db });
    if (!adminCheck.authorized || !adminCheck.user) {
      throw new Error("Not authorized");
    }

    if (!isSuperAdmin(adminCheck.user)) {
      throw new Error("Only Superadmin can view verification queue");
    }

    const traders = await ctx.db
      .query("users")
      .withIndex("by_role", (q: any) => q.eq("role", "trader"))
      .collect();

    return traders.filter((t: any) => t.verificationStatus !== "verified");
  },
});

export const getTraderVerificationList = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    const adminCheck = await verifyAdminRole({ userId: args.adminId, db: ctx.db });
    if (!adminCheck.authorized || !adminCheck.user) {
      throw new Error("Not authorized");
    }

    if (!isSuperAdmin(adminCheck.user)) {
      throw new Error("Only Superadmin can view traders");
    }

    const traders = await ctx.db
      .query("users")
      .withIndex("by_role", (q: any) => q.eq("role", "trader"))
      .collect();

    return traders.map((t: any) => ({
      _id: t._id,
      alias: t.alias,
      email: t.email,
      isVerifiedTrader: t.isVerifiedTrader ?? false,
      verificationStatus: t.verificationStatus ?? "pending",
    }));
  },
});

export const verifyTrader = mutation({
  args: {
    adminId: v.id("users"),
    traderId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const adminCheck = await verifyAdminRole({ userId: args.adminId, db: ctx.db });
    if (!adminCheck.authorized || !adminCheck.user) {
      throw new Error("Not authorized");
    }

    if (!isSuperAdmin(adminCheck.user)) {
      throw new Error("Only Superadmin can verify traders");
    }

    const trader = await ctx.db.get(args.traderId);
    if (!trader || !["trader", "transporter"].includes(trader.role)) {
      throw new Error("User is not a trader");
    }

    await ctx.db.patch(args.traderId, {
      isVerifiedTrader: true,
      verificationStatus: "verified",
      verifiedBy: args.adminId,
      verifiedAt: getUgandaTime(),
    });

    return { success: true };
  },
});

export const rejectTrader = mutation({
  args: {
    adminId: v.id("users"),
    traderId: v.id("users"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const adminCheck = await verifyAdminRole({ userId: args.adminId, db: ctx.db });
    if (!adminCheck.authorized || !adminCheck.user) {
      throw new Error("Not authorized");
    }

    if (!isSuperAdmin(adminCheck.user)) {
      throw new Error("Only Superadmin can reject traders");
    }

    const trader = await ctx.db.get(args.traderId);
    if (!trader || !["trader", "transporter"].includes(trader.role)) {
      throw new Error("User is not a trader");
    }

    await ctx.db.patch(args.traderId, {
      isVerifiedTrader: false,
      verificationStatus: "rejected",
      verifiedBy: args.adminId,
      verifiedAt: getUgandaTime(),
    });

    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      actionType: "reject_trader",
      targetUserId: args.traderId,
      reason: args.reason,
      utid: generateUTID("admin"),
      timestamp: getUgandaTime(),
    });

    return { success: true };
  },
});

export const setTraderVerificationStatus = mutation({
  args: {
    adminId: v.id("users"),
    traderId: v.id("users"),
    status: v.union(v.literal("verified"), v.literal("pending")),
  },
  handler: async (ctx, args) => {
    const adminCheck = await verifyAdminRole({ userId: args.adminId, db: ctx.db });
    if (!adminCheck.authorized || !adminCheck.user) {
      throw new Error("Not authorized");
    }

    if (!isSuperAdmin(adminCheck.user)) {
      throw new Error("Only Superadmin can change trader verification status");
    }

    const trader = await ctx.db.get(args.traderId);
    if (!trader || !["trader", "transporter"].includes(trader.role)) {
      throw new Error("User is not a trader");
    }

    const now = getUgandaTime();

    if (args.status === "verified") {
      await ctx.db.patch(args.traderId, {
        isVerifiedTrader: true,
        verificationStatus: "verified",
        verifiedBy: args.adminId,
        verifiedAt: now,
      });
    } else {
      await ctx.db.patch(args.traderId, {
        isVerifiedTrader: false,
        verificationStatus: "pending",
        verifiedBy: undefined,
        verifiedAt: undefined,
      });
    }

    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      actionType: args.status === "verified" ? "verify_trader" : "mark_trader_unverified",
      targetUserId: args.traderId,
      reason: "Superadmin verification status update",
      utid: generateUTID("admin"),
      timestamp: now,
    });

    return { success: true };
  },
});

// ─── Farmer Form Field Rewards ───────────────────────────────────────

// ─── Farm 2 Market Access Gate ────────────────────────────────────────

const FARM2MARKET_REQUIRED_FARMCOINS = 500;
const PILOT_EMAIL_DOMAIN = "@pilot.farm2market";

/**
 * Evaluate whether a farmer is allowed to access Farm 2 Market.
 * Criteria:
 *   - Farmer has >= 500 FarmCoins, OR
 *   - Farmer's email ends with @pilot.farm2market (pilot users are always allowed)
 */
export const getFarm2MarketAccess = query({
  args: { farmerId: v.id("users") },
  handler: async (ctx, args) => {
    // Fetch user to check pilot-email exemption
    const user = await ctx.db.get(args.farmerId);
    const email: string = (user as any)?.email ?? "";
    const isPilotExempt = email.toLowerCase().endsWith(PILOT_EMAIL_DOMAIN);

    // Fetch current farmer FarmCoin balance
    const latestEntry = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_account", (q: any) => q.eq("accountType", "farmer"))
      .filter((q: any) => q.eq(q.field("userId"), args.farmerId))
      .order("desc")
      .first();
    const balance: number = latestEntry?.balanceAfter ?? 0;

    const meetsThreshold = balance >= FARM2MARKET_REQUIRED_FARMCOINS;
    const allowed = isPilotExempt || meetsThreshold;

    return {
      allowed,
      isPilotExempt,
      balance,
      requiredBalance: FARM2MARKET_REQUIRED_FARMCOINS,
      reason: allowed
        ? null
        : `You need ${FARM2MARKET_REQUIRED_FARMCOINS - balance} more FarmCoin${FARM2MARKET_REQUIRED_FARMCOINS - balance === 1 ? "" : "s"} to unlock Farm 2 Market.`,
    };
  },
});

// ─── Farmer Farmcoin Balance ───────────────────────────────────────────

/**
 * Get farmer FarmCoin balance (for the counter badge)
 */
export const getFarmerFarmcoinBalance = query({
  args: { farmerId: v.id("users") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_account", (q: any) => q.eq("accountType", "farmer"))
      .filter((q: any) => q.eq(q.field("userId"), args.farmerId))
      .order("desc")
      .first();

    return entries?.balanceAfter ?? 0;
  },
});

/**
 * Get farmer farmcoin ledger entries (for finance dashboard)
 */
export const getFarmerFormRewards = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_account", (q: any) => q.eq("accountType", "farmer"))
      .order("desc")
      .take(200);

    // Resolve user names
    const results = [];
    for (const entry of entries) {
      let farmerName = "Unknown";
      if (entry.userId) {
        const user = await ctx.db.get(entry.userId);
        farmerName = (user as any)?.alias || (user as any)?.email || "Unknown";
      }
      results.push({ ...entry, farmerName });
    }
    return results;
  },
});

/**
 * Mint FarmCoins for a farmer upon form submission
 * - 1 coin per completed field
 * - Only on final submission (not on draft save)
 */
export const mintFarmerFormCoin = mutation({
  args: {
    farmerId: v.id("users"),
    formResponseId: v.id("formResponses"),
    communityId: v.id("communities"),
    fieldCount: v.number(),
    fieldLabels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    if (args.fieldCount <= 0) {
      throw new Error("fieldCount must be positive");
    }

    // Prevent duplicate rewards for same response
    const existing = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_account", (q: any) => q.eq("accountType", "farmer"))
      .filter((q: any) =>
        q.and(
          q.eq(q.field("userId"), args.farmerId),
          q.eq(q.field("formResponseId"), args.formResponseId)
        )
      )
      .first();

    if (existing) {
      return { success: false, reason: "Already rewarded for this submission", balance: existing.balanceAfter };
    }

    // Get current farmer balance
    const latestEntry = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_account", (q: any) => q.eq("accountType", "farmer"))
      .filter((q: any) => q.eq(q.field("userId"), args.farmerId))
      .order("desc")
      .first();

    const currentBalance = latestEntry?.balanceAfter ?? 0;
    const newBalance = currentBalance + args.fieldCount;

    const now = getUgandaTime();
    const utid = generateUTID("fcr");

    await ctx.db.insert("farmcoinLedger", {
      accountType: "farmer",
      userId: args.farmerId,
      delta: args.fieldCount,
      balanceAfter: newBalance,
      source: "form_field_reward",
      utid,
      formResponseId: args.formResponseId,
      communityId: args.communityId,
      fieldCount: args.fieldCount,
      reason: `Form submission reward: ${args.fieldCount} field${args.fieldCount > 1 ? "s" : ""} completed`,
      createdAt: now,
    });

    return { success: true, coinsEarned: args.fieldCount, balance: newBalance };
  },
});

/**
 * Mint FarmCoins for a farmer upon Farm Toolbox tracker entry submission
 * - 1 coin per completed (non-empty) field
 * - Duplicate-safe via trackerEntryId check
 * - Mirrors mintFarmerFormCoin but uses trackerEntryId for dedup
 */
export const mintTrackerEntryCoin = mutation({
  args: {
    farmerId: v.id("users"),
    trackerEntryId: v.id("farmTrackerEntries"),
    fieldCount: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.fieldCount <= 0) {
      return { success: false, reason: "No fields to reward" };
    }

    // Prevent duplicate rewards for same entry
    const existing = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_account", (q: any) => q.eq("accountType", "farmer"))
      .filter((q: any) =>
        q.and(
          q.eq(q.field("userId"), args.farmerId),
          q.eq(q.field("trackerEntryId"), args.trackerEntryId)
        )
      )
      .first();

    if (existing) {
      return { success: false, reason: "Already rewarded for this entry", balance: existing.balanceAfter };
    }

    // Get current farmer balance
    const latestEntry = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_account", (q: any) => q.eq("accountType", "farmer"))
      .filter((q: any) => q.eq(q.field("userId"), args.farmerId))
      .order("desc")
      .first();

    const currentBalance = latestEntry?.balanceAfter ?? 0;
    const newBalance = currentBalance + args.fieldCount;

    const now = getUgandaTime();
    const utid = generateUTID("ftr");

    await ctx.db.insert("farmcoinLedger", {
      accountType: "farmer",
      userId: args.farmerId,
      delta: args.fieldCount,
      balanceAfter: newBalance,
      source: "tracker_entry_reward",
      utid,
      trackerEntryId: args.trackerEntryId,
      fieldCount: args.fieldCount,
      reason: `Tracker entry reward: ${args.fieldCount} field${args.fieldCount > 1 ? "s" : ""} submitted`,
      createdAt: now,
    });

    return { success: true, coinsEarned: args.fieldCount, balance: newBalance };
  },
});