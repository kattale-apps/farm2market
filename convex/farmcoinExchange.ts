/**
 * FarmCoin exchange and wallet cash-outs.
 *
 * - Any non-admin user who holds FarmCoin can put coins up for sale. The coins
 *   leave their balance straight away and wait in a queue, so they cannot be
 *   spent twice. Unsold coins can be taken back.
 * - Any non-admin user can buy FarmCoin from their wallet. A purchase fills
 *   from the oldest offer first, across sellers, at the rate set by the super
 *   admin or the Finance admin. The platform fee comes out of each seller's
 *   proceeds, and sellers are paid into their wallet and notified.
 * - Wallet money can be cashed out to a mobile money number. The user
 *   confirms with their password. The amount is held at once; Finance pays by
 *   hand and marks it paid, or rejects it and the hold is returned.
 * - Pilot mode does not block any of this (the user's decision).
 *
 * Signed-in calls take the session token, not a user id, so the server
 * decides who the caller is.
 */

import { v } from "convex/values";
import { internalQuery, mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { generateUTID, getUgandaTime } from "./utils";
import { simpleHash } from "./auth";
import { normalizeUgandaPhone, walletForRole } from "./marketspaceShared";
import { currentRunning, postWallet } from "./walletSplit";
import { direction, realOf, type DemoRule } from "./walletSplitShared";
import {
  ACCOUNT_LABELS,
  CASHOUT_NOTICE,
  DEFAULT_EXCHANGE_SETTINGS,
  FARMCOIN_ACCOUNTS,
  planFills,
  sentifyCash,
  priceFill,
  validateExchangeSettings,
  type ExchangeSettings,
  type FarmcoinAccount,
} from "./farmcoinExchangeShared";

type Ctx = QueryCtx | MutationCtx;

/** How many queued offers one purchase may draw from. */
const MAX_OFFERS_PER_PURCHASE = 200;

const accountValidator = v.union(v.literal("farmer"), v.literal("trader"), v.literal("sentify"), v.literal("buyer_reward"));

// ------------------------------------------------------------------
// Access helpers
// ------------------------------------------------------------------

async function sessionUser(ctx: Ctx, token: string | undefined): Promise<Doc<"users"> | null> {
  if (!token || token.length < 10) return null;
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();
  if (!session || session.invalidated || session.expiresAt < Date.now()) return null;
  const user = await ctx.db.get(session.userId);
  if (!user || user.state !== "active") return null;
  return user;
}

/** A signed-in user who can hold a wallet: everyone except admins. */
async function requireHolder(ctx: Ctx, token: string): Promise<Doc<"users">> {
  const user = await sessionUser(ctx, token);
  if (!user) throw new Error("Please log in again to continue.");
  if (user.role === "admin") throw new Error("Admin accounts do not have a wallet.");
  return user;
}

function canManage(user: Doc<"users">): boolean {
  if (user.role !== "admin") return false;
  const isSuper = user.adminLevel === "super" || user.adminLevel === undefined;
  const isFinance = user.adminLevel === "junior" && user.adminCategory === "finance";
  return isSuper || isFinance;
}

async function requireManager(ctx: Ctx, token: string): Promise<Doc<"users">> {
  const user = await sessionUser(ctx, token);
  if (!user) throw new Error("Please log in again to continue.");
  if (!canManage(user)) throw new Error("Only the super admin or the Finance admin can manage the FarmCoin exchange.");
  return user;
}

// ------------------------------------------------------------------
// Settings and totals
// ------------------------------------------------------------------

async function getSettings(ctx: Ctx): Promise<ExchangeSettings> {
  const row = await ctx.db.query("farmcoinExchangeSettings").first();
  if (!row) return DEFAULT_EXCHANGE_SETTINGS;
  return {
    rateUGX: row.rateUGX,
    feePercent: row.feePercent,
    minSellCoins: row.minSellCoins,
    minBuyCoins: row.minBuyCoins,
    minCashoutUGX: row.minCashoutUGX,
  };
}

type Totals = Omit<Doc<"farmcoinExchangeTotals">, "_id" | "_creationTime">;
const ZERO_TOTALS: Totals = { queuedCoins: 0, coinsSold: 0, grossUGX: 0, feesUGX: 0, pendingCashoutUGX: 0, paidCashoutUGX: 0 };

async function getTotals(ctx: Ctx): Promise<Totals> {
  const row = await ctx.db.query("farmcoinExchangeTotals").first();
  if (!row) return ZERO_TOTALS;
  const { _id, _creationTime, ...totals } = row;
  return totals;
}

async function bumpTotals(ctx: MutationCtx, change: Partial<Totals>) {
  const row = await ctx.db.query("farmcoinExchangeTotals").first();
  const base = row ?? ZERO_TOTALS;
  const next: Totals = { ...ZERO_TOTALS };
  for (const key of Object.keys(ZERO_TOTALS) as (keyof Totals)[]) {
    next[key] = (base[key] ?? 0) + (change[key] ?? 0);
  }
  if (row) await ctx.db.patch(row._id, next);
  else await ctx.db.insert("farmcoinExchangeTotals", next);
}

// ------------------------------------------------------------------
// Balances
// ------------------------------------------------------------------

async function farmcoinBalance(ctx: Ctx, userId: Id<"users">, account: FarmcoinAccount): Promise<number> {
  const latest =
    account === "trader"
      ? await ctx.db
          .query("farmcoinLedger")
          .withIndex("by_trader", (q) => q.eq("traderId", userId))
          .order("desc")
          .filter((q) => q.eq(q.field("accountType"), "trader"))
          .first()
      : await ctx.db
          .query("farmcoinLedger")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .filter((q) => q.eq(q.field("accountType"), account))
          .first();
  return latest?.balanceAfter ?? 0;
}

/** Writes one FarmCoin movement on a user's account, keyed the way that account is keyed elsewhere. */
async function moveFarmcoin(
  ctx: MutationCtx,
  userId: Id<"users">,
  account: FarmcoinAccount,
  delta: number,
  source: "exchange_sell_escrow" | "exchange_sell_cancel" | "exchange_purchase",
  utid: string,
  reason: string,
  relatedUtid?: string
) {
  const balance = await farmcoinBalance(ctx, userId, account);
  const balanceAfter = balance + delta;
  if (balanceAfter < 0) throw new Error("Not enough FarmCoin.");
  await ctx.db.insert("farmcoinLedger", {
    accountType: account,
    ...(account === "trader" ? { traderId: userId } : account === "sentify" ? { traderId: userId, userId } : { userId }),
    delta,
    balanceAfter,
    source,
    utid,
    relatedUtid,
    reason,
    createdAt: getUgandaTime(),
  });
  return balanceAfter;
}

/** Real money (cashable) and demo money (sandbox) in a user's wallet. */
async function loadWallet(ctx: Ctx, userId: Id<"users">) {
  const running = await currentRunning(ctx, userId);
  return {
    availableUGX: realOf(running), // Real money: cashable, and what FarmCoin is bought with.
    demoUGX: running.demo, // Demo money: can be traded with, never cashed out.
    totalUGX: running.balance,
  };
}

type WalletEntryType = "farmcoin_sale_credit" | "farmcoin_purchase_debit" | "cashout_hold" | "cashout_release";

/** FarmCoin purchases and cash-outs use real money only; proceeds and returned cash-outs are real. */
const ENTRY_RULES: Record<WalletEntryType, DemoRule> = {
  farmcoin_sale_credit: { kind: "none" },
  farmcoin_purchase_debit: { kind: "real_only" },
  cashout_hold: { kind: "real_only" },
  cashout_release: { kind: "none" },
};

async function writeWallet(
  ctx: MutationCtx,
  userId: Id<"users">,
  type: WalletEntryType,
  amount: number,
  utid: string,
  metadata: Record<string, unknown>
) {
  await postWallet(ctx, { userId, utid, type, amount, rule: ENTRY_RULES[type], metadata });
}

async function notify(ctx: MutationCtx, userId: Id<"users">, title: string, message: string, utid: string, category = "wallet") {
  await ctx.db.insert("notifications", {
    userId,
    type: "system",
    category,
    title,
    message,
    utid,
    read: false,
    createdAt: getUgandaTime(),
  });
}

async function notifyManagers(ctx: MutationCtx, title: string, message: string, utid: string) {
  const admins = await ctx.db
    .query("users")
    .withIndex("by_role", (q) => q.eq("role", "admin"))
    .take(500);
  for (const admin of admins) {
    if (canManage(admin) && admin.state === "active") {
      await notify(ctx, admin._id, title, message, utid, "wallet_cashout");
    }
  }
}

function ugx(amount: number): string {
  return `UGX ${Math.round(amount).toLocaleString("en-US")}`;
}

const WALLET_ENTRY_LABELS: Record<string, string> = {
  wallet_topup: "Top-up",
  farmcoin_sale_credit: "FarmCoin sold",
  farmcoin_purchase_debit: "FarmCoin bought",
  cashout_hold: "Cash-out requested",
  cashout_release: "Cash-out returned",
  capital_deposit: "Deposit",
  capital_lock: "Paid into a purchase",
  capital_unlock: "Returned from a purchase",
  profit_credit: "Payment received",
  profit_withdrawal: "Profit withdrawn",
  trader_commission_deduction: "Commission",
  export_fee_payment: "Export fee",
};

// ------------------------------------------------------------------
// User: the Wallet page
// ------------------------------------------------------------------

export const getMyWallet = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await sessionUser(ctx, args.sessionToken);
    if (!user) return { status: "signed_out" as const };
    if (user.role === "admin") return { status: "admin" as const, canManage: canManage(user) };

    const wallet = await loadWallet(ctx, user._id);
    const moves: { type: string; amount: number }[] = [];
    for await (const e of ctx.db.query("walletLedger").withIndex("by_user", (q) => q.eq("userId", user._id))) {
      moves.push({ type: e.type, amount: e.amount });
    }
    const sentifyUGX = sentifyCash(moves, wallet.availableUGX);
    const settings = await getSettings(ctx);
    const totals = await getTotals(ctx);
    const primary = walletForRole(user.role)?.accountType ?? "farmer";

    const balances = [];
    for (const account of FARMCOIN_ACCOUNTS) {
      const balance = await farmcoinBalance(ctx, user._id, account);
      if (balance > 0 || account === primary) {
        balances.push({ account, label: ACCOUNT_LABELS[account], balance, primary: account === primary });
      }
    }

    const offers = await ctx.db
      .query("farmcoinSellOffers")
      .withIndex("by_sellerId_and_createdAt", (q) => q.eq("sellerId", user._id))
      .order("desc")
      .take(20);
    const cashouts = await ctx.db
      .query("walletCashouts")
      .withIndex("by_userId_and_requestedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(20);
    const activity = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .filter((q) => q.neq(q.field("type"), "incoming_purchase"))
      .take(30);

    return {
      status: "ok" as const,
      role: user.role,
      phoneNumber: user.phoneNumber ?? null,
      wallet: { ...wallet, sentifyUGX, otherRealUGX: wallet.availableUGX - sentifyUGX },
      demoWallet: user.demoWallet === true || wallet.demoUGX > 0,
      balances,
      settings,
      queuedCoins: totals.queuedCoins,
      cashoutNotice: CASHOUT_NOTICE,
      offers: offers.map((o) => ({
        _id: o._id,
        account: o.accountType,
        coinsOffered: o.coinsOffered,
        coinsRemaining: o.coinsRemaining,
        status: o.status,
        createdAt: o.createdAt,
      })),
      cashouts: cashouts.map((c) => ({
        _id: c._id,
        amountUGX: c.amountUGX,
        phone: c.phone,
        network: c.network,
        status: c.status,
        providerReference: c.providerReference ?? null,
        rejectReason: c.rejectReason ?? null,
        requestedAt: c.requestedAt,
        handledAt: c.handledAt ?? null,
      })),
      activity: activity.map((e) => ({
        _id: e._id,
        type: e.type,
        label: WALLET_ENTRY_LABELS[e.type] ?? e.type,
        amount: e.amount,
        demoAmount: e.demoAmount ?? 0,
        inflow: direction(e.type) > 0,
        timestamp: e.timestamp,
        note: typeof e.metadata?.note === "string" ? e.metadata.note : null,
      })),
    };
  },
});

export const sellFarmcoin = mutation({
  args: {
    sessionToken: v.string(),
    account: accountValidator,
    coins: v.number(),
    expectedRateUGX: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireHolder(ctx, args.sessionToken);
    const settings = await getSettings(ctx);
    if (settings.rateUGX <= 0) throw new Error("The FarmCoin exchange is closed right now.");
    if (settings.rateUGX !== args.expectedRateUGX) {
      throw new Error(`The rate has changed to ${ugx(settings.rateUGX)} per FarmCoin. Please check and try again.`);
    }
    if (!Number.isInteger(args.coins) || args.coins < settings.minSellCoins) {
      throw new Error(`Sell a whole number of FarmCoin, at least ${settings.minSellCoins}.`);
    }
    const balance = await farmcoinBalance(ctx, user._id, args.account);
    if (balance < args.coins) {
      throw new Error(`You have ${balance} ${ACCOUNT_LABELS[args.account]}, which is not enough.`);
    }

    const now = getUgandaTime();
    const utid = generateUTID(user.role);
    await moveFarmcoin(ctx, user._id, args.account, -args.coins, "exchange_sell_escrow", utid, `Put ${args.coins} FarmCoin up for sale`);
    const offerId = await ctx.db.insert("farmcoinSellOffers", {
      sellerId: user._id,
      accountType: args.account,
      coinsOffered: args.coins,
      coinsRemaining: args.coins,
      status: "open",
      utid,
      createdAt: now,
      updatedAt: now,
    });
    await bumpTotals(ctx, { queuedCoins: args.coins });
    return { offerId, utid };
  },
});

export const cancelSellOffer = mutation({
  args: { sessionToken: v.string(), offerId: v.id("farmcoinSellOffers") },
  handler: async (ctx, args) => {
    const user = await requireHolder(ctx, args.sessionToken);
    const offer = await ctx.db.get(args.offerId);
    if (!offer || offer.sellerId !== user._id) throw new Error("Offer not found.");
    if (offer.status !== "open") throw new Error("This offer is no longer open.");
    const returned = offer.coinsRemaining;
    const utid = generateUTID(user.role);
    if (returned > 0) {
      await moveFarmcoin(ctx, user._id, offer.accountType, returned, "exchange_sell_cancel", utid, `Took back ${returned} unsold FarmCoin`, offer.utid);
    }
    await ctx.db.patch(offer._id, { status: "cancelled", coinsRemaining: 0, updatedAt: getUgandaTime() });
    await bumpTotals(ctx, { queuedCoins: -returned });
    return { returned };
  },
});

export const buyFarmcoin = mutation({
  args: {
    sessionToken: v.string(),
    coins: v.number(),
    expectedRateUGX: v.number(),
  },
  handler: async (ctx, args) => {
    const buyer = await requireHolder(ctx, args.sessionToken);
    const settings = await getSettings(ctx);
    if (settings.rateUGX <= 0) throw new Error("The FarmCoin exchange is closed right now.");
    if (settings.rateUGX !== args.expectedRateUGX) {
      throw new Error(`The rate has changed to ${ugx(settings.rateUGX)} per FarmCoin. Please check and try again.`);
    }
    if (!Number.isInteger(args.coins) || args.coins < settings.minBuyCoins) {
      throw new Error(`Buy a whole number of FarmCoin, at least ${settings.minBuyCoins}.`);
    }

    const queue = await ctx.db
      .query("farmcoinSellOffers")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "open"))
      .take(MAX_OFFERS_PER_PURCHASE);
    const offersById = new Map(queue.map((o) => [o._id as string, o]));
    const fills = planFills(
      queue.map((o) => ({ id: o._id, sellerId: o.sellerId, coinsRemaining: o.coinsRemaining })),
      buyer._id,
      args.coins
    );
    if (fills.length === 0) throw new Error("No FarmCoin is for sale right now. Please try again later.");

    const priced = fills.map((f) => ({ ...f, ...priceFill(f.coins, settings.rateUGX, settings.feePercent) }));
    const coinsBought = priced.reduce((s, f) => s + f.coins, 0);
    const totalUGX = priced.reduce((s, f) => s + f.grossUGX, 0);
    const feesUGX = priced.reduce((s, f) => s + f.feeUGX, 0);

    const wallet = await loadWallet(ctx, buyer._id);
    if (wallet.availableUGX < totalUGX) {
      throw new Error(`${coinsBought} FarmCoin costs ${ugx(totalUGX)}, but your wallet has ${ugx(wallet.availableUGX)} of real money. Top up first.`);
    }

    const now = getUgandaTime();
    const purchaseUtid = generateUTID(buyer.role);
    const buyerAccount = walletForRole(buyer.role)?.accountType ?? "farmer";

    await writeWallet(ctx, buyer._id, "farmcoin_purchase_debit", totalUGX, purchaseUtid, {
      note: `${coinsBought} FarmCoin at ${ugx(settings.rateUGX)}`,
      coins: coinsBought,
      rateUGX: settings.rateUGX,
    });
    await moveFarmcoin(ctx, buyer._id, buyerAccount, coinsBought, "exchange_purchase", purchaseUtid, `Bought ${coinsBought} FarmCoin`);

    const perSeller = new Map<Id<"users">, { coins: number; netUGX: number }>();
    for (const fill of priced) {
      const offer = offersById.get(fill.offerId)!;
      const remaining = offer.coinsRemaining - fill.coins;
      await ctx.db.patch(offer._id, { coinsRemaining: remaining, status: remaining === 0 ? "filled" : "open", updatedAt: now });
      await ctx.db.insert("farmcoinTrades", {
        purchaseUtid,
        buyerId: buyer._id,
        sellerId: offer.sellerId,
        offerId: offer._id,
        coins: fill.coins,
        rateUGX: settings.rateUGX,
        feePercent: settings.feePercent,
        grossUGX: fill.grossUGX,
        feeUGX: fill.feeUGX,
        netUGX: fill.netUGX,
        createdAt: now,
      });
      await writeWallet(ctx, offer.sellerId, "farmcoin_sale_credit", fill.netUGX, purchaseUtid, {
        note: `${fill.coins} FarmCoin sold at ${ugx(settings.rateUGX)}, fee ${ugx(fill.feeUGX)}`,
        coins: fill.coins,
        grossUGX: fill.grossUGX,
        feeUGX: fill.feeUGX,
        offerId: offer._id,
      });
      const sum = perSeller.get(offer.sellerId) ?? { coins: 0, netUGX: 0 };
      perSeller.set(offer.sellerId, { coins: sum.coins + fill.coins, netUGX: sum.netUGX + fill.netUGX });
    }

    for (const [sellerId, sold] of perSeller) {
      await notify(
        ctx,
        sellerId,
        "Your FarmCoin sold",
        `${sold.coins} FarmCoin sold. ${ugx(sold.netUGX)} has been added to your wallet.`,
        purchaseUtid
      );
    }

    await bumpTotals(ctx, { queuedCoins: -coinsBought, coinsSold: coinsBought, grossUGX: totalUGX, feesUGX });

    return { coinsBought, coinsRequested: args.coins, totalUGX, utid: purchaseUtid };
  },
});

export const requestCashout = mutation({
  args: {
    sessionToken: v.string(),
    amountUGX: v.number(),
    phone: v.string(),
    network: v.union(v.literal("mtn"), v.literal("airtel")),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireHolder(ctx, args.sessionToken);
    if (!user.passwordHash || user.passwordHash !== simpleHash(args.password.trim())) {
      throw new Error("That password is not correct.");
    }
    const settings = await getSettings(ctx);
    if (!Number.isInteger(args.amountUGX) || args.amountUGX < settings.minCashoutUGX) {
      throw new Error(`Cash out a whole number of shillings, at least ${ugx(settings.minCashoutUGX)}.`);
    }
    const phone = normalizeUgandaPhone(args.phone);
    if (!phone || !phone.startsWith("+2567")) throw new Error("Enter a Ugandan mobile money number, for example 0772 123456.");

    const wallet = await loadWallet(ctx, user._id);
    if (wallet.availableUGX < args.amountUGX) {
      throw new Error(`Your wallet has ${ugx(wallet.availableUGX)} of real money available to cash out.`);
    }

    const utid = generateUTID(user.role);
    const cashoutId = await ctx.db.insert("walletCashouts", {
      userId: user._id,
      amountUGX: args.amountUGX,
      phone,
      network: args.network,
      status: "pending",
      provider: "manual",
      utid,
      requestedAt: getUgandaTime(),
    });
    await writeWallet(ctx, user._id, "cashout_hold", args.amountUGX, utid, {
      note: `To ${args.network === "mtn" ? "MTN" : "Airtel"} ${phone}`,
      cashoutId,
    });
    await bumpTotals(ctx, { pendingCashoutUGX: args.amountUGX });
    await notifyManagers(
      ctx,
      "Cash-out request",
      `${user.alias} asked to cash out ${ugx(args.amountUGX)} to ${args.network === "mtn" ? "MTN" : "Airtel"} ${phone}.`,
      utid
    );
    return { cashoutId, utid };
  },
});

// ------------------------------------------------------------------
// Admin: super admin and Finance admin
// ------------------------------------------------------------------

export const getExchangeAdmin = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await sessionUser(ctx, args.sessionToken);
    if (!user || !canManage(user)) return null;

    const settings = await getSettings(ctx);
    const totals = await getTotals(ctx);
    const history = await ctx.db.query("farmcoinExchangeSettingsHistory").withIndex("by_createdAt").order("desc").take(15);
    const pending = await ctx.db
      .query("walletCashouts")
      .withIndex("by_status_and_requestedAt", (q) => q.eq("status", "pending"))
      .take(100);
    const paid = await ctx.db
      .query("walletCashouts")
      .withIndex("by_status_and_requestedAt", (q) => q.eq("status", "paid"))
      .order("desc")
      .take(15);
    const rejected = await ctx.db
      .query("walletCashouts")
      .withIndex("by_status_and_requestedAt", (q) => q.eq("status", "rejected"))
      .order("desc")
      .take(10);
    const trades = await ctx.db.query("farmcoinTrades").withIndex("by_createdAt").order("desc").take(20);

    const aliases = new Map<string, string>();
    const alias = async (id: Id<"users"> | undefined) => {
      if (!id) return null;
      if (!aliases.has(id)) aliases.set(id, (await ctx.db.get(id))?.alias ?? "Unknown");
      return aliases.get(id)!;
    };
    const cashoutRow = async (c: Doc<"walletCashouts">) => ({
      _id: c._id,
      alias: await alias(c.userId),
      amountUGX: c.amountUGX,
      phone: c.phone,
      network: c.network,
      status: c.status,
      providerReference: c.providerReference ?? null,
      rejectReason: c.rejectReason ?? null,
      requestedAt: c.requestedAt,
      handledAt: c.handledAt ?? null,
      handledBy: await alias(c.handledBy),
    });

    return {
      settings,
      totals,
      history: await Promise.all(history.map(async (h) => ({ ...h, changedByAlias: await alias(h.changedBy) }))),
      pending: await Promise.all(pending.map(cashoutRow)),
      handled: (await Promise.all([...paid, ...rejected].map(cashoutRow))).sort((a, b) => (b.handledAt ?? 0) - (a.handledAt ?? 0)),
      trades: await Promise.all(
        trades.map(async (t) => ({
          _id: t._id,
          buyer: await alias(t.buyerId),
          seller: await alias(t.sellerId),
          coins: t.coins,
          rateUGX: t.rateUGX,
          grossUGX: t.grossUGX,
          feeUGX: t.feeUGX,
          createdAt: t.createdAt,
        }))
      ),
    };
  },
});

export const saveExchangeSettings = mutation({
  args: {
    sessionToken: v.string(),
    rateUGX: v.number(),
    feePercent: v.number(),
    minSellCoins: v.number(),
    minBuyCoins: v.number(),
    minCashoutUGX: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireManager(ctx, args.sessionToken);
    const { sessionToken, reason, ...settings } = args;
    const problem = validateExchangeSettings(settings);
    if (problem) throw new Error(problem);
    if (reason.trim().length < 3) throw new Error("Give a reason for the change.");

    const now = getUgandaTime();
    const row = await ctx.db.query("farmcoinExchangeSettings").first();
    if (row) await ctx.db.patch(row._id, { ...settings, updatedBy: admin._id, updatedAt: now });
    else await ctx.db.insert("farmcoinExchangeSettings", { ...settings, updatedBy: admin._id, updatedAt: now });
    await ctx.db.insert("farmcoinExchangeSettingsHistory", { ...settings, changedBy: admin._id, reason: reason.trim(), createdAt: now });
    return settings;
  },
});

export const markCashoutPaid = mutation({
  args: { sessionToken: v.string(), cashoutId: v.id("walletCashouts"), reference: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireManager(ctx, args.sessionToken);
    const cashout = await ctx.db.get(args.cashoutId);
    if (!cashout) throw new Error("Cash-out not found.");
    if (cashout.status !== "pending") throw new Error("This cash-out has already been handled.");
    const reference = args.reference.trim();
    if (reference.length < 4) throw new Error("Enter the mobile money transaction ID.");

    await ctx.db.patch(cashout._id, {
      status: "paid",
      providerReference: reference,
      handledBy: admin._id,
      handledAt: getUgandaTime(),
    });
    await bumpTotals(ctx, { pendingCashoutUGX: -cashout.amountUGX, paidCashoutUGX: cashout.amountUGX });
    await notify(
      ctx,
      cashout.userId,
      "Cash-out paid",
      `${ugx(cashout.amountUGX)} was sent to ${cashout.phone}. Transaction ID: ${reference}.`,
      cashout.utid
    );
  },
});

export const rejectCashout = mutation({
  args: { sessionToken: v.string(), cashoutId: v.id("walletCashouts"), reason: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireManager(ctx, args.sessionToken);
    const cashout = await ctx.db.get(args.cashoutId);
    if (!cashout) throw new Error("Cash-out not found.");
    if (cashout.status !== "pending") throw new Error("This cash-out has already been handled.");
    const reason = args.reason.trim();
    if (reason.length < 3) throw new Error("Give the user a reason.");

    await ctx.db.patch(cashout._id, {
      status: "rejected",
      rejectReason: reason,
      handledBy: admin._id,
      handledAt: getUgandaTime(),
    });
    await writeWallet(ctx, cashout.userId, "cashout_release", cashout.amountUGX, cashout.utid, {
      note: `Cash-out not paid: ${reason}`,
      cashoutId: cashout._id,
    });
    await bumpTotals(ctx, { pendingCashoutUGX: -cashout.amountUGX });
    await notify(
      ctx,
      cashout.userId,
      "Cash-out not paid",
      `Your cash-out of ${ugx(cashout.amountUGX)} was not paid: ${reason}. The money is back in your wallet.`,
      cashout.utid
    );
  },
});

// ------------------------------------------------------------------
// Top-ups (called by the Pesapal action)
// ------------------------------------------------------------------

export const topUpUser = internalQuery({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await sessionUser(ctx, args.sessionToken);
    if (!user || user.role === "admin") return null;
    return {
      userId: user._id,
      role: user.role,
      email: user.email,
      phoneNumber: user.phoneNumber,
      alias: user.alias,
    };
  },
});
