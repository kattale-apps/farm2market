/**
 * Buyer Purchase System
 * 
 * - Buyers can only purchase during admin-opened windows
 * - Buyers never see prices
 * - Inventory is locked atomically on purchase
 * - Pickup SLA: 48 hours after purchase
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { generateUTID, getUgandaTime, calculateInventoryPricePerKilo, getBuyerServiceFeePercentage } from "./utils";
import { calculatePickupSLA } from "./utils";
import { checkPilotMode } from "./pilotMode";
import { checkRateLimit } from "./rateLimits";
import {
  purchaseWindowClosedError,
  invalidRoleError,
  invalidKilosError,
  inventoryNotFoundError,
  inventoryNotAvailableError,
  throwAppError,
} from "./errors";
import { Id } from "./_generated/dataModel";

/**
 * Create buyer purchase (buyer only)
 * 
 * ATOMIC OPERATION:
 * 1. Validate purchase window is open (FIRST VALIDATION)
 * 2. Verify buyer role
 * 3. Validate inventory exists and is available
 * 4. Validate kilos requested
 * 5. Lock inventory atomically (status → "sold")
 * 6. Create buyer purchase entry
 * 7. Generate UTID (only on success)
 * 
 * If any step fails, entire operation rolls back.
 */
export const createBuyerPurchase = mutation({
  args: {
    buyerId: v.id("users"),
    inventoryId: v.id("traderInventory"),
    kilos: v.number(),
  },
  handler: async (ctx, args) => {
    // ============================================================
    // PILOT MODE CHECK (MUST BE FIRST - BEFORE ANY OPERATIONS)
    // ============================================================
    // This mutation moves inventory (locks inventory on purchase),
    // so it must be blocked during pilot mode. The check happens FIRST
    // to fail fast and prevent any partial state changes.
    await checkPilotMode(ctx);

    // ============================================================
    // FIRST VALIDATION: PURCHASE WINDOW MUST BE OPEN
    // ============================================================
    // This is the critical first check - buyers cannot purchase
    // outside of admin-opened windows. This check happens BEFORE
    // any other validation to fail fast.
    const purchaseWindow = await ctx.db
      .query("purchaseWindows")
      .withIndex("by_status", (q) => q.eq("isOpen", true))
      .first();

    if (!purchaseWindow) {
      throwAppError(purchaseWindowClosedError());
    }

    // ============================================================
    // VERIFY BUYER ROLE
    // ============================================================
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") {
      throwAppError(invalidRoleError("buyer"));
    }

    // ============================================================
    // RATE LIMIT CHECK (BEFORE OPERATIONS)
    // ============================================================
    // Check if buyer has exceeded purchase rate limit.
    // This prevents spam and manipulation attempts.
    await checkRateLimit(ctx, args.buyerId, user.role, "create_purchase", {
      inventoryId: args.inventoryId,
      kilos: args.kilos,
    });

    if (args.kilos <= 0) {
      throwAppError(invalidKilosError());
    }

    // ============================================================
    // VALIDATE INVENTORY
    // ============================================================
    const inventory = await ctx.db.get(args.inventoryId);
    if (!inventory) {
      throwAppError(inventoryNotFoundError());
    }

    // Inventory must be in_storage (available for purchase)
    if (inventory.status !== "in_storage") {
      throwAppError(inventoryNotAvailableError());
    }

    // Validate kilos requested
    if (args.kilos > inventory.totalKilos) {
      throw new Error(
        `Requested kilos (${args.kilos}) exceeds available inventory (${inventory.totalKilos} kg).`
      );
    }

    // ============================================================
    // ATOMIC OPERATION: LOCK INVENTORY AND CREATE PURCHASE
    // ============================================================
    // All operations happen in one mutation - Convex guarantees atomicity.
    // If any step fails, entire operation rolls back.

    const purchaseTime = getUgandaTime();
    const pickupDeadline = calculatePickupSLA(purchaseTime);

    // Step 1: Lock inventory (status → "sold")
    // This prevents other buyers from purchasing the same inventory
    await ctx.db.patch(args.inventoryId, {
      status: "sold",
    });

    // Step 2: Calculate purchase price
    // Calculate base price per kilo from inventory
    const basePricePerKilo = await calculateInventoryPricePerKilo(ctx, args.inventoryId);
    
    // Get service fee percentage
    const serviceFeePercentage = await getBuyerServiceFeePercentage({ db: ctx.db });
    
    // Calculate total cost
    const baseCost = basePricePerKilo * args.kilos;
    const serviceFee = (baseCost * serviceFeePercentage) / 100;
    const totalCost = baseCost + serviceFee;

    // Step 3: Generate UTID (only after all validations pass)
    // UTID is generated here, not earlier, to ensure it's only created
    // on successful purchase. If any validation fails, no UTID is created.
    const purchaseUtid = generateUTID(user.role);

    // Step 4: Check buyer wallet balance
    const currentEntries = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q) => q.eq("userId", args.buyerId))
      .order("desc")
      .first();

    const currentBalance = currentEntries?.balanceAfter || 0;

    if (currentBalance < totalCost) {
      throw new Error(
        `Insufficient wallet balance. Required: ${totalCost.toFixed(2)} UGX, Available: ${currentBalance.toFixed(2)} UGX`
      );
    }

    // Step 5: Create wallet ledger entry for purchase
    const balanceAfter = currentBalance - totalCost;
    await ctx.db.insert("walletLedger", {
      userId: args.buyerId,
      utid: purchaseUtid,
      type: "capital_lock", // Using capital_lock for buyer purchases
      amount: totalCost,
      balanceAfter,
      timestamp: purchaseTime,
      metadata: {
        type: "buyer_purchase",
        inventoryId: args.inventoryId,
        kilos: args.kilos,
        basePricePerKilo,
        serviceFeePercentage,
        serviceFee,
        totalCost,
      },
    });

    // Step 6: Create buyer purchase entry
    await ctx.db.insert("buyerPurchases", {
      buyerId: args.buyerId,
      inventoryId: args.inventoryId,
      kilos: args.kilos,
      utid: purchaseUtid,
      purchasedAt: purchaseTime,
      pickupSLA: pickupDeadline, // 48 hours after purchase
      status: "pending_pickup",
    });

    // Get trader information (for response, buyer never sees prices)
    const trader = await ctx.db.get(inventory.traderId);

    return {
      purchaseUtid,
      purchaseId: args.inventoryId, // Using inventoryId as purchase identifier
      buyerId: args.buyerId,
      inventoryId: args.inventoryId,
      kilos: args.kilos,
      produceType: inventory.produceType,
      traderAlias: trader?.alias || null,
      purchasedAt: purchaseTime,
      pickupDeadline: pickupDeadline,
      status: "pending_pickup",
    };
  },
});

/**
 * Create buyer purchase for trader listings (buyer only)
 * Fixed price, no negotiation. Locks buyer funds in escrow.
 */
export const createBuyerListingPurchase = mutation({
  args: {
    buyerId: v.id("users"),
    listingId: v.id("listings"),
    unitCount: v.number(),
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);

    const purchaseWindow = await ctx.db
      .query("purchaseWindows")
      .withIndex("by_status", (q) => q.eq("isOpen", true))
      .first();

    if (!purchaseWindow) {
      throwAppError(purchaseWindowClosedError());
    }

    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") {
      throwAppError(invalidRoleError("buyer"));
    }

    await checkRateLimit(ctx, args.buyerId, user.role, "create_purchase", {
      listingId: args.listingId,
      unitCount: args.unitCount,
    });

    if (args.unitCount <= 0) {
      throw new Error("Unit count must be positive");
    }

    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }

    if (!listing.traderId) {
      throw new Error("Only trader listings can be purchased in this flow");
    }

    if (listing.status !== "active" && listing.status !== "partially_locked") {
      throw new Error("Listing is not available for purchase");
    }

    const availableUnits = listing.availableUnits ?? listing.totalUnits;
    if (args.unitCount > availableUnits) {
      throw new Error(`Requested units (${args.unitCount}) exceed available units (${availableUnits}).`);
    }

    const unitSize = listing.unitSize || 1;
    const basePricePerUnit =
      listing.pricePerUnit ?? listing.pricePerKilo * unitSize;
    const basePricePerKilo = basePricePerUnit / unitSize;
    const totalKilos = args.unitCount * unitSize;

    const serviceFeePercentage = await getBuyerServiceFeePercentage({ db: ctx.db });
    const baseCost = basePricePerUnit * args.unitCount;
    const serviceFee = (baseCost * serviceFeePercentage) / 100;
    const totalCost = baseCost + serviceFee;

    const currentEntry = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q) => q.eq("userId", args.buyerId))
      .order("desc")
      .first();

    const currentBalance = currentEntry?.balanceAfter || 0;
    if (currentBalance < totalCost) {
      throw new Error(
        `Insufficient wallet balance. Required: ${totalCost.toFixed(2)} UGX, Available: ${currentBalance.toFixed(2)} UGX`
      );
    }

    const purchaseTime = getUgandaTime();
    const purchaseUtid = generateUTID(user.role);

    const balanceAfter = currentBalance - totalCost;
    await ctx.db.insert("walletLedger", {
      userId: args.buyerId,
      utid: purchaseUtid,
      type: "capital_lock",
      amount: totalCost,
      balanceAfter,
      timestamp: purchaseTime,
      metadata: {
        type: "buyer_listing_purchase",
        listingId: args.listingId,
        listingUtid: listing.utid,
        unitCount: args.unitCount,
        unitSize,
        basePricePerUnit,
        basePricePerKilo,
        serviceFeePercentage,
        serviceFee,
        totalCost,
      },
    });

    const remainingUnits = availableUnits - args.unitCount;
    await ctx.db.patch(args.listingId, {
      availableUnits: remainingUnits,
      status: remainingUnits === 0 ? "fully_locked" : "partially_locked",
    });

    const etaBase = listing.etaLastUpdatedAt || listing.createdAt;
    const etaDeadline =
      listing.etaType && listing.etaValue != null
        ? listing.etaType === "duration"
          ? etaBase + listing.etaValue * 60 * 60 * 1000
          : listing.etaValue
        : undefined;

    const purchaseId = await ctx.db.insert("buyerListingPurchases", {
      buyerId: args.buyerId,
      listingId: args.listingId,
      listingUtid: listing.utid,
      traderId: listing.traderId,
      unitCount: args.unitCount,
      unitSize,
      totalKilos,
      pricePerUnit: basePricePerUnit,
      pricePerKilo: basePricePerKilo,
      serviceFeePercentage,
      serviceFee,
      totalCost,
      utid: purchaseUtid,
      purchasedAt: purchaseTime,
      etaType: listing.etaType,
      etaValue: listing.etaValue,
      etaBaseTime: etaBase,
      etaDeadline,
      status: "pending_delivery",
    });

    return {
      purchaseId,
      purchaseUtid,
      listingId: args.listingId,
      listingUtid: listing.utid,
      traderId: listing.traderId,
      unitCount: args.unitCount,
      totalKilos,
      totalCost,
      etaType: listing.etaType,
      etaValue: listing.etaValue,
      etaDeadline,
      status: "pending_delivery",
    };
  },
});

/**
 * Buyer purchases vendor/store listing (separate from trader flow)
 */
export const createBuyerVendorStorePurchase = mutation({
  args: {
    buyerId: v.id("users"),
    listingId: v.id("listings"),
    unitCount: v.number(),
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);

    const purchaseWindow = await ctx.db
      .query("purchaseWindows")
      .withIndex("by_status", (q) => q.eq("isOpen", true))
      .first();
    if (!purchaseWindow) {
      throwAppError(purchaseWindowClosedError());
    }

    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") {
      throwAppError(invalidRoleError("buyer"));
    }

    await checkRateLimit(ctx, args.buyerId, user.role, "create_purchase", {
      listingId: args.listingId,
      unitCount: args.unitCount,
    });

    if (args.unitCount <= 0) {
      throw new Error("Unit count must be positive");
    }

    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }

    if (!listing.farmerId) {
      throw new Error("Invalid listing");
    }

    // Verify the seller is a vendor or store
    const seller = await ctx.db.get(listing.farmerId);
    if (!seller || !["vendor", "store"].includes(seller.role)) {
      throw new Error("This listing is not from a vendor or store");
    }

    if (listing.status !== "active" && listing.status !== "partially_locked") {
      throw new Error("Listing is not available for purchase");
    }

    const availableUnits = listing.availableUnits ?? listing.totalUnits;
    if (args.unitCount > availableUnits) {
      throw new Error(`Requested units (${args.unitCount}) exceed available units (${availableUnits}).`);
    }

    const unitSize = listing.unitSize || 1;
    const basePricePerUnit = listing.pricePerUnit ?? listing.pricePerKilo * unitSize;
    const basePricePerKilo = basePricePerUnit / (unitSize || 1);
    const totalKilos = listing.listingMode === "packaging" ? 0 : args.unitCount * unitSize;

    const serviceFeePercentage = await getBuyerServiceFeePercentage({ db: ctx.db });
    const baseCost = basePricePerUnit * args.unitCount;
    const serviceFee = (baseCost * serviceFeePercentage) / 100;
    const totalCost = baseCost + serviceFee;

    const currentEntry = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q) => q.eq("userId", args.buyerId))
      .order("desc")
      .first();

    const currentBalance = currentEntry?.balanceAfter || 0;
    if (currentBalance < totalCost) {
      throw new Error(
        `Insufficient wallet balance. Required: ${totalCost.toFixed(2)} UGX, Available: ${currentBalance.toFixed(2)} UGX`
      );
    }

    const purchaseTime = getUgandaTime();
    const purchaseUtid = generateUTID(user.role);
    const balanceAfter = currentBalance - totalCost;

    await ctx.db.insert("walletLedger", {
      userId: args.buyerId,
      utid: purchaseUtid,
      type: "capital_lock",
      amount: totalCost,
      balanceAfter,
      timestamp: purchaseTime,
      metadata: {
        type: "buyer_listing_purchase",
        listingId: args.listingId,
        listingUtid: listing.utid,
        unitCount: args.unitCount,
        unitSize,
        basePricePerUnit,
        basePricePerKilo,
        serviceFeePercentage,
        serviceFee,
        totalCost,
      },
    });

    const remainingUnits = availableUnits - args.unitCount;
    await ctx.db.patch(args.listingId, {
      availableUnits: remainingUnits,
      status: remainingUnits === 0 ? "fully_locked" : "partially_locked",
    });

    // Use farmerId (vendor/store userId) as traderId field since the schema requires it
    const purchaseId = await ctx.db.insert("buyerListingPurchases", {
      buyerId: args.buyerId,
      listingId: args.listingId,
      listingUtid: listing.utid,
      traderId: listing.farmerId,
      unitCount: args.unitCount,
      unitSize,
      totalKilos,
      pricePerUnit: basePricePerUnit,
      pricePerKilo: basePricePerKilo,
      serviceFeePercentage,
      serviceFee,
      totalCost,
      utid: purchaseUtid,
      purchasedAt: purchaseTime,
      status: "pending_delivery",
    });

    return {
      purchaseId,
      purchaseUtid,
      listingId: args.listingId,
      listingUtid: listing.utid,
      unitCount: args.unitCount,
      totalCost,
      status: "pending_delivery",
    };
  },
});

/**
 * Trader confirms delivery for a listing batch
 */
export const traderConfirmListingDelivery = mutation({
  args: {
    traderId: v.id("users"),
    listingUtid: v.string(),
  },
  handler: async (ctx, args) => {
    const trader = await ctx.db.get(args.traderId);
    if (!trader || !["trader", "transporter"].includes(trader.role)) {
      throw new Error("User is not a trader");
    }

    const listing = await ctx.db
      .query("listings")
      .withIndex("by_utid", (q: any) => q.eq("utid", args.listingUtid))
      .first();

    if (!listing || listing.traderId !== args.traderId) {
      throw new Error("Listing not found or not owned by trader");
    }

    const purchases = await ctx.db
      .query("buyerListingPurchases")
      .withIndex("by_listing_utid", (q: any) => q.eq("listingUtid", args.listingUtid))
      .collect();

    if (purchases.length === 0) {
      throw new Error("No buyer purchases found for this listing");
    }

    const now = getUgandaTime();
    const deadline = purchases.find((p) => p.etaDeadline)?.etaDeadline;
    if (deadline && now > deadline) {
      throw new Error("ETA expired. Delivery confirmation is no longer allowed.");
    }

    const confirmationUtid = generateUTID(trader.role);

    for (const purchase of purchases) {
      if (!purchase.traderConfirmedAt) {
        await ctx.db.patch(purchase._id, {
          traderConfirmedAt: now,
          traderConfirmationUtid: confirmationUtid,
        });
      }
    }

    return { success: true, listingUtid: args.listingUtid, utid: confirmationUtid };
  },
});

/**
 * Buyer confirms delivery for their purchase
 */
export const buyerConfirmListingDelivery = mutation({
  args: {
    buyerId: v.id("users"),
    purchaseId: v.id("buyerListingPurchases"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; utid: string; rewardUtid: string }> => {
    const buyer = await ctx.db.get(args.buyerId);
    if (!buyer || buyer.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase || purchase.buyerId !== args.buyerId) {
      throw new Error("Purchase not found");
    }

    if (!purchase.traderConfirmedAt) {
      throw new Error("Trader must confirm delivery first");
    }

    if (purchase.buyerConfirmedAt) {
      throw new Error("Delivery already confirmed by buyer");
    }

    const now = getUgandaTime();
    const confirmationUtid = generateUTID(buyer.role);

    const reward: { utid: string } = await ctx.runMutation((internal as any).farmcoin.creditBuyerReward, {
      buyerId: args.buyerId,
      batchUtid: purchase.listingUtid,
      tokenAmount: 1,
      reason: "Buyer delivery confirmation reward",
    });

    await ctx.db.patch(args.purchaseId, {
      buyerConfirmedAt: now,
      buyerConfirmationUtid: confirmationUtid,
      buyerRewardUtid: reward.utid,
    });

    return { success: true, utid: confirmationUtid, rewardUtid: reward.utid };
  },
});

/**
 * Superadmin confirms delivery and releases escrow
 */
export const superadminConfirmListingDelivery = mutation({
  args: {
    adminId: v.id("users"),
    batchUtids: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.adminId);
    if (!admin || admin.role !== "admin") {
      throw new Error("User is not an admin");
    }

    const isSuperAdmin = admin.adminLevel === "super" || admin.adminLevel === undefined;
    if (!isSuperAdmin) {
      throw new Error("Only Superadmin can confirm deliveries");
    }

    const now = getUgandaTime();
    const results: Array<{ batchUtid: string; sentifyUtid?: string }> = [];

    for (const batchUtid of args.batchUtids) {
      const purchases = await ctx.db
        .query("buyerListingPurchases")
        .withIndex("by_listing_utid", (q: any) => q.eq("listingUtid", batchUtid))
        .collect();

      if (purchases.length === 0) {
        continue;
      }

      if (purchases.every((p) => p.superadminConfirmedAt)) {
        continue;
      }

      if (purchases.some((p) => !p.traderConfirmedAt)) {
        throw new Error(`Trader confirmation missing for batch ${batchUtid}`);
      }

      const deadline = purchases.find((p) => p.etaDeadline)?.etaDeadline;
      if (deadline && now > deadline) {
        throw new Error(`ETA expired for batch ${batchUtid}`);
      }

      const totalCost = purchases.reduce((sum, p) => sum + p.totalCost, 0);
      const listingId = purchases[0].listingId as Id<"listings">;
      const traderId = purchases[0].traderId as Id<"users">;

      const superadminUtid = generateUTID("admin");

      const tokenRate = await ctx.db.query("systemSettings").first();
      const cashoutRate = tokenRate?.farmcoinPostingCost ?? 1;
      const tokenAmount = Number((totalCost / cashoutRate).toFixed(2));

      const sentify = await ctx.runMutation((internal as any).farmcoin.creditSentifyReceipt, {
        traderId,
        listingId,
        batchUtid,
        tokenAmount,
        reason: "Sentify receipt for delivered batch",
      });

      const walletEntries = await ctx.db
        .query("walletLedger")
        .withIndex("by_user", (q: any) => q.eq("userId", traderId))
        .order("desc")
        .first();

      const currentBalance = walletEntries?.balanceAfter || 0;
      const balanceAfter = currentBalance + totalCost;

      await ctx.db.insert("walletLedger", {
        userId: traderId,
        utid: superadminUtid,
        type: "profit_credit",
        amount: totalCost,
        balanceAfter,
        timestamp: now,
        metadata: {
          batchUtid,
          listingId,
          source: "buyer_purchase_release",
        },
      });

      for (const purchase of purchases) {
        if (!purchase.buyerConfirmedAt) {
          const reward = await ctx.runMutation((internal as any).farmcoin.creditBuyerReward, {
            buyerId: purchase.buyerId,
            batchUtid,
            tokenAmount: 1,
            reason: "Buyer delivery confirmation reward (superadmin override)",
          });

          await ctx.db.patch(purchase._id, {
            buyerConfirmedAt: now,
            buyerConfirmationUtid: superadminUtid,
            buyerRewardUtid: reward.utid,
            buyerOverrideBySuperadmin: true,
          });
        }

        await ctx.db.patch(purchase._id, {
          superadminConfirmedAt: now,
          superadminConfirmationUtid: superadminUtid,
          sentifyUtid: sentify.utid,
          status: "delivered",
          escrowReleasedAt: now,
        });
      }

      results.push({ batchUtid, sentifyUtid: sentify.utid });
    }

    return { success: true, results };
  },
});

/**
 * Admin view of sentify delivery batches
 */
export const getSentifyDeliveryBatches = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.adminId);
    if (!admin || admin.role !== "admin") {
      throw new Error("User is not an admin");
    }

    const isSuperAdmin = admin.adminLevel === "super" || admin.adminLevel === undefined;
    const isFinanceAdmin = admin.adminLevel === "junior" && admin.adminCategory === "finance";

    if (!isSuperAdmin && !isFinanceAdmin) {
      throw new Error("Not authorized");
    }

    const purchases = await ctx.db.query("buyerListingPurchases").collect();
    const batchMap = new Map<string, any>();

    for (const purchase of purchases) {
      if (!batchMap.has(purchase.listingUtid)) {
        const listing = await ctx.db.get(purchase.listingId);
        const trader = listing?.traderId ? await ctx.db.get(listing.traderId) : null;
        batchMap.set(purchase.listingUtid, {
          batchUtid: purchase.listingUtid,
          listingId: purchase.listingId,
          productName: listing?.productName || listing?.produceType || "Listing",
          produceType: listing?.produceType || "",
          traderAlias: trader?.alias || null,
          totalCost: 0,
          purchaseCount: 0,
          buyerConfirmedCount: 0,
          traderConfirmedAt: purchase.traderConfirmedAt || null,
          superadminConfirmedAt: purchase.superadminConfirmedAt || null,
          sentifyUtid: purchase.sentifyUtid || null,
          etaDeadline: purchase.etaDeadline || null,
        });
      }

      const entry = batchMap.get(purchase.listingUtid);
      entry.totalCost += purchase.totalCost;
      entry.purchaseCount += 1;
      if (purchase.buyerConfirmedAt) {
        entry.buyerConfirmedCount += 1;
      }
      if (purchase.traderConfirmedAt && !entry.traderConfirmedAt) {
        entry.traderConfirmedAt = purchase.traderConfirmedAt;
      }
      if (purchase.superadminConfirmedAt && !entry.superadminConfirmedAt) {
        entry.superadminConfirmedAt = purchase.superadminConfirmedAt;
      }
      if (purchase.sentifyUtid && !entry.sentifyUtid) {
        entry.sentifyUtid = purchase.sentifyUtid;
      }
    }

    return Array.from(batchMap.values());
  },
});

/**
 * Trader view of listing delivery batches
 */
export const getTraderDeliveryBatches = query({
  args: { traderId: v.id("users") },
  handler: async (ctx, args) => {
    const trader = await ctx.db.get(args.traderId);
    if (!trader || !["trader", "transporter"].includes(trader.role)) {
      throw new Error("User is not a trader");
    }

    const purchases = await ctx.db
      .query("buyerListingPurchases")
      .filter((q) => q.eq(q.field("traderId"), args.traderId))
      .collect();

    const batchMap = new Map<string, any>();

    for (const purchase of purchases) {
      if (!batchMap.has(purchase.listingUtid)) {
        const listing = await ctx.db.get(purchase.listingId);
        batchMap.set(purchase.listingUtid, {
          batchUtid: purchase.listingUtid,
          listingId: purchase.listingId,
          productName: listing?.productName || listing?.produceType || "Listing",
          produceType: listing?.produceType || "",
          totalCost: 0,
          purchaseCount: 0,
          traderConfirmedAt: purchase.traderConfirmedAt || null,
          etaDeadline: purchase.etaDeadline || null,
        });
      }

      const entry = batchMap.get(purchase.listingUtid);
      entry.totalCost += purchase.totalCost;
      entry.purchaseCount += 1;
      if (purchase.traderConfirmedAt && !entry.traderConfirmedAt) {
        entry.traderConfirmedAt = purchase.traderConfirmedAt;
      }
    }

    return Array.from(batchMap.values());
  },
});
