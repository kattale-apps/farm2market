/**
 * Buyer Dashboard Queries
 * 
 * Read-only queries for buyers to view:
 * - Available inventory in 100kg blocks
 * - Purchase window status
 * - Their orders and pickup deadlines
 * 
 * CRITICAL RULES:
 * - Buyers see fixed prices for trader listings only
 * - No trader identities exposed (only aliases)
 * - All queries are read-only (no mutations)
 * - Server-side filtering by buyerId
 * 
 * How this discourages side trading:
 * - Fixed price listings remove negotiation paths
 * - Purchase windows create controlled access (admin-controlled)
 * - All transactions tracked with UTIDs (audit trail)
 * - Platform is the only way to purchase (no alternative paths)
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { BUYER_BLOCK_SIZE_KG, BUYER_PICKUP_SLA_MS } from "./constants";
import { getStorageFeeRate, getBuyerServiceFeePercentage } from "./utils";

/**
 * Get available inventory for buyers
 * 
 * Shows only inventory with status "in_storage" (available for purchase).
 * Buyers see:
 * - Produce type
 * - Total kilos available
 * - Block size (target: 100kg)
 * - Trader alias (anonymity preserved)
 * - Inventory UTID
 * 
 * Buyers DO NOT see:
 * - Trader real identity
 * - Trader real identity
 * - Other buyers' purchases
 * - Storage fees
 */
export const getAvailableInventory = query({
  args: {
    buyerId: v.id("users"), // Buyer must provide their ID (for role verification)
  },
  handler: async (ctx, args) => {
    // Verify user is a buyer
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    // Get all 100kg blocks with status "in_storage" (available for purchase)
    // Buyers only see 100kg blocks, not partial inventory
    const availableInventory = await ctx.db
      .query("traderInventory")
      .withIndex("by_status", (q) => q.eq("status", "in_storage"))
      .filter((q) => q.eq(q.field("is100kgBlock"), true))
      .collect();

    // Enrich with trader aliases and storage location (anonymity preserved)
    const enriched = await Promise.all(
      availableInventory.map(async (inventory) => {
        const trader = await ctx.db.get(inventory.traderId);
        const storageLocation = await ctx.db.get(inventory.storageLocationId);

        return {
          inventoryId: inventory._id,
          produceType: inventory.produceType,
          totalKilos: inventory.totalKilos, // Should be 100kg for blocks
          blockSize: inventory.blockSize, // Target: 100kg blocks
          qualityRating: inventory.qualityRating || null, // Quality rating
          storageLocation: storageLocation ? {
            districtName: storageLocation.districtName,
            code: storageLocation.code,
          } : null,
          traderAlias: trader?.alias || null, // Only alias, no real identity
          traderIsVerified: !!trader?.isVerifiedTrader && trader?.verificationStatus === "verified",
          inventoryUtid: inventory.utid, // UTID of the transaction that created this inventory
          acquiredAt: inventory.acquiredAt, // When block was created
          storageStartTime: inventory.storageStartTime, // When storage fees started
          // NO PRICES - buyers never see prices
        };
      })
    );

    // Sort by most recent first (newest inventory first)
    enriched.sort((a, b) => b.acquiredAt - a.acquiredAt);

    // Group by produce type for easier browsing
    const byProduceType = new Map<string, typeof enriched>();
    for (const inv of enriched) {
      if (!byProduceType.has(inv.produceType)) {
        byProduceType.set(inv.produceType, []);
      }
      byProduceType.get(inv.produceType)!.push(inv);
    }

    // Get current storage fee rate for display (kilo-shaving rate)
    const storageFeeRate = await getStorageFeeRate({ db: ctx.db });
    // Get current service fee percentage for display
    const serviceFeePercentage = await getBuyerServiceFeePercentage({ db: ctx.db });

    return {
      totalAvailable: enriched.length,
      totalKilos: enriched.reduce((sum, inv) => sum + inv.totalKilos, 0),
      byProduceType: Object.fromEntries(byProduceType),
      inventory: enriched,
      storageFeeRate: storageFeeRate, // Current kilo-shaving rate (visible to buyers before purchase)
      serviceFeePercentage: serviceFeePercentage, // Current service fee percentage
    };
  },
});

/**
 * Get available trader listings for buyers (fixed price)
 */
export const getAvailableTraderListingsForBuyers = query({
  args: {
    buyerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    const listings = await ctx.db
      .query("listings")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const traderListings = listings.filter((listing) => listing.traderId);

    const enriched = await Promise.all(
      traderListings.map(async (listing) => {
        const trader = listing.traderId ? await ctx.db.get(listing.traderId) : null;
        const storageLocation = listing.storageLocationId
          ? await ctx.db.get(listing.storageLocationId)
          : null;

        const availableUnits = listing.availableUnits ?? listing.totalUnits;
        const unitSize = listing.unitSize || 1;
        const pricePerUnit = listing.pricePerUnit ?? listing.pricePerKilo * unitSize;

        return {
          listingId: listing._id,
          listingUtid: listing.utid,
          produceType: listing.produceType,
          productName: listing.productName || null,
          totalUnits: listing.totalUnits,
          availableUnits,
          unitSize,
          totalKilos: listing.totalKilos,
          pricePerUnit,
          pricePerKilo: listing.pricePerKilo,
          pricingUnit: listing.pricingUnit || "per_package",
          packagingTypeEnum: listing.packagingTypeEnum || null,
          packagingTypeCustom: listing.packagingTypeCustom || null,
          departureLocation: listing.departureLocation || null,
          destinationLocation: listing.destinationLocation || null,
          etaType: listing.etaType || null,
          etaValue: listing.etaValue || null,
          etaLastUpdatedAt: listing.etaLastUpdatedAt || null,
          deliveryStatus: listing.deliveryStatus || null,
          progressStage: listing.progressStage || null,
          traderAlias: trader?.alias || null,
          traderIsVerified: !!trader?.isVerifiedTrader && trader?.verificationStatus === "verified",
          storageLocation: storageLocation
            ? { districtName: storageLocation.districtName, code: storageLocation.code }
            : null,
          createdAt: listing.createdAt,
        };
      })
    );

    enriched.sort((a, b) => b.createdAt - a.createdAt);

    return { listings: enriched };
  },
});

/**
 * Get current storage fee rate (kilo-shaving rate)
 * Returns the current storage fee rate for display in buyer dashboard
 */
export const getBuyerStorageFeeRate = query({
  args: {
    buyerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a buyer
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    const rate = await getStorageFeeRate({ db: ctx.db });
    return { rateKgPerDay: rate };
  },
});

/**
 * Get current buyer service fee percentage
 * Returns the current service fee percentage for display in buyer dashboard
 */
export const getBuyerServiceFeePercentageQuery = query({
  args: {
    buyerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a buyer
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    const fee = await getBuyerServiceFeePercentage({ db: ctx.db });
    return { serviceFeePercentage: fee };
  },
});

/**
 * Get purchase window status
 * 
 * Buyers can check if purchase window is open.
 * This is critical - buyers can only purchase during open windows.
 * 
 * Returns:
 * - isOpen: Whether purchase window is currently open
 * - openedAt: When window was opened (if open)
 * - openedBy: Admin alias who opened it (if open)
 * - utid: Admin action UTID (if open)
 */
export const getPurchaseWindowStatus = query({
  args: {
    buyerId: v.id("users"), // Buyer must provide their ID (for role verification)
  },
  handler: async (ctx, args) => {
    // Verify user is a buyer
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    // Get current purchase window (if open)
    const purchaseWindow = await ctx.db
      .query("purchaseWindows")
      .withIndex("by_status", (q) => q.eq("isOpen", true))
      .first();

    if (!purchaseWindow) {
      return {
        isOpen: false,
        openedAt: null,
        openedBy: null,
        openedByAlias: null,
        utid: null,
        closedAt: null,
        reason: null,
      };
    }

    // Get admin alias (anonymity preserved, though admin identity may be known)
    const admin = await ctx.db.get(purchaseWindow.openedBy);

    return {
      isOpen: purchaseWindow.isOpen,
      openedAt: purchaseWindow.openedAt,
      openedBy: purchaseWindow.openedBy,
      openedByAlias: admin?.alias || null, // Only alias
      utid: purchaseWindow.utid, // Admin action UTID
      closedAt: purchaseWindow.closedAt || null,
      reason: purchaseWindow.reason || null,
    };
  },
});

/**
 * Get buyer's orders and pickup deadlines
 * 
 * Shows all purchases made by this buyer:
 * - Purchase UTID
 * - Produce type and kilos
 * - Trader alias (anonymity preserved)
 * - Purchase timestamp
 * - Pickup deadline (48 hours after purchase)
 * - Server-calculated countdown (hours remaining or overdue)
 * - Status (pending_pickup, picked_up, expired)
 * 
 * Buyers DO NOT see:
 * - Prices (never shown)
 * - Other buyers' purchases
 * - Trader real identity
 */
export const getBuyerOrders = query({
  args: {
    buyerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a buyer
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    // Get all purchases for this buyer
    const purchases = await ctx.db
      .query("buyerPurchases")
      .withIndex("by_buyer", (q) => q.eq("buyerId", args.buyerId))
      .collect();

    // Enrich with inventory and trader information
    const now = Date.now(); // Server time
    const enriched = await Promise.all(
      purchases.map(async (purchase) => {
        const inventory = await ctx.db.get(purchase.inventoryId);
        const trader = inventory ? await ctx.db.get(inventory.traderId) : null;
        const listingUnitId = inventory?.listingUnitIds?.[0];
        const listingUnit = listingUnitId ? await ctx.db.get(listingUnitId) : null;
        const listing = listingUnit ? await ctx.db.get(listingUnit.listingId) : null;
        const latestEtaChange = listing
          ? await ctx.db
              .query("etaHistory")
              .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
              .order("desc")
              .first()
          : null;

        const etaBaseTime = listing?.etaLastUpdatedAt || listing?.createdAt || purchase.purchasedAt;
        const etaTimestamp = listing?.etaType && listing?.etaValue != null
          ? listing.etaType === "duration"
            ? etaBaseTime + listing.etaValue * 60 * 60 * 1000
            : listing.etaValue
          : null;
        const etaIsPast = etaTimestamp != null ? now > etaTimestamp : false;
        const etaHoursRemaining = etaTimestamp != null
          ? Math.max(0, (etaTimestamp - now) / (1000 * 60 * 60))
          : null;
        const etaHoursOverdue = etaTimestamp != null && now > etaTimestamp
          ? (now - etaTimestamp) / (1000 * 60 * 60)
          : null;

        // Calculate pickup deadline status (server-side)
        const isPastDeadline = now > purchase.pickupSLA;
        const hoursRemaining = Math.max(0, (purchase.pickupSLA - now) / (1000 * 60 * 60));
        const hoursOverdue = isPastDeadline
          ? (now - purchase.pickupSLA) / (1000 * 60 * 60)
          : 0;

        return {
          purchaseId: purchase._id,
          orderType: "inventory",
          purchaseUtid: purchase.utid, // Purchase transaction UTID
          inventoryId: purchase.inventoryId,
          inventoryUtid: inventory?.utid || null, // Inventory creation UTID
          produceType: inventory?.produceType || null,
          kilos: purchase.kilos,
          traderAlias: trader?.alias || null, // Only alias, no real identity
          traderIsVerified: !!trader?.isVerifiedTrader && trader?.verificationStatus === "verified",
          purchasedAt: purchase.purchasedAt,
          pickupSLA: purchase.pickupSLA, // Deadline timestamp (48 hours after purchase)
          status: purchase.status,
          etaType: listing?.etaType ?? null,
          etaValue: listing?.etaValue ?? null,
          etaLastUpdatedAt: listing?.etaLastUpdatedAt ?? null,
          etaTimestamp,
          etaIsPast,
          etaHoursRemaining: etaHoursRemaining != null ? Math.round(etaHoursRemaining * 100) / 100 : null,
          etaHoursOverdue: etaHoursOverdue != null ? Math.round(etaHoursOverdue * 100) / 100 : null,
          latestEtaChange: latestEtaChange
            ? {
                oldEtaValue: latestEtaChange.oldEtaValue ?? null,
                newEtaValue: latestEtaChange.newEtaValue,
                etaType: latestEtaChange.etaType,
                reason: latestEtaChange.reason,
                createdAt: latestEtaChange.createdAt,
              }
            : null,
          deliveryStatus: listing?.deliveryStatus ?? null,
          progressStage: listing?.progressStage ?? null,
          departureLocation: listing?.departureLocation ?? null,
          destinationLocation: listing?.destinationLocation ?? null,
          packagingTypeEnum: listing?.packagingTypeEnum ?? null,
          packagingTypeCustom: listing?.packagingTypeCustom ?? null,
          productName: listing?.productName ?? null,
          // Server-calculated countdown (no client-side time logic)
          isPastDeadline,
          hoursRemaining: Math.round(hoursRemaining * 100) / 100, // Rounded to 2 decimals
          hoursOverdue: Math.round(hoursOverdue * 100) / 100, // Rounded to 2 decimals
        };
      })
    );

    // Sort by pickup deadline (earliest first, then overdue first)
    enriched.sort((a, b) => {
      if (a.isPastDeadline !== b.isPastDeadline) {
        return a.isPastDeadline ? -1 : 1; // Overdue first
      }
      return a.pickupSLA - b.pickupSLA; // Earliest deadline first
    });

    // Group by status
    const byStatus = new Map<string, typeof enriched>();
    for (const purchase of enriched) {
      const status = purchase.status;
      if (!byStatus.has(status)) {
        byStatus.set(status, []);
      }
      byStatus.get(status)!.push(purchase);
    }

    // Calculate totals
    const totals = {
      total: enriched.length,
      pending_pickup: enriched.filter((p) => p.status === "pending_pickup").length,
      picked_up: enriched.filter((p) => p.status === "picked_up").length,
      expired: enriched.filter((p) => p.status === "expired").length,
      overdue: enriched.filter((p) => p.isPastDeadline && p.status === "pending_pickup").length,
      totalKilos: enriched.reduce((sum, p) => sum + p.kilos, 0),
    };

    return {
      totals,
      byStatus: Object.fromEntries(byStatus),
      orders: enriched,
    };
  },
});

/**
 * Get buyer orders for trader listings
 */
export const getBuyerListingOrders = query({
  args: {
    buyerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    const purchases = await ctx.db
      .query("buyerListingPurchases")
      .withIndex("by_buyer", (q: any) => q.eq("buyerId", args.buyerId))
      .order("desc")
      .collect();

    const now = Date.now();

    const enriched = await Promise.all(
      purchases.map(async (purchase) => {
        const listing = await ctx.db.get(purchase.listingId);
        const trader = listing?.traderId ? await ctx.db.get(listing.traderId) : null;

        const etaTimestamp = purchase.etaDeadline ?? null;
        const etaIsPast = etaTimestamp != null ? now > etaTimestamp : false;
        const etaHoursRemaining = etaTimestamp != null
          ? Math.max(0, (etaTimestamp - now) / (1000 * 60 * 60))
          : null;
        const etaHoursOverdue = etaTimestamp != null && now > etaTimestamp
          ? (now - etaTimestamp) / (1000 * 60 * 60)
          : null;

        return {
          purchaseId: purchase._id,
          orderType: "trader_listing",
          purchaseUtid: purchase.utid,
          listingId: purchase.listingId,
          listingUtid: purchase.listingUtid,
          productName: listing?.productName || null,
          produceType: listing?.produceType || null,
          unitCount: purchase.unitCount,
          totalKilos: purchase.totalKilos,
          pricePerUnit: purchase.pricePerUnit,
          pricePerKilo: purchase.pricePerKilo,
          totalCost: purchase.totalCost,
          traderAlias: trader?.alias || null,
          traderIsVerified: !!trader?.isVerifiedTrader && trader?.verificationStatus === "verified",
          purchasedAt: purchase.purchasedAt,
          etaType: purchase.etaType ?? null,
          etaValue: purchase.etaValue ?? null,
          etaDeadline: purchase.etaDeadline ?? null,
          etaIsPast,
          etaHoursRemaining: etaHoursRemaining != null ? Math.round(etaHoursRemaining * 100) / 100 : null,
          etaHoursOverdue: etaHoursOverdue != null ? Math.round(etaHoursOverdue * 100) / 100 : null,
          traderConfirmedAt: purchase.traderConfirmedAt ?? null,
          buyerConfirmedAt: purchase.buyerConfirmedAt ?? null,
          superadminConfirmedAt: purchase.superadminConfirmedAt ?? null,
          buyerRewardUtid: purchase.buyerRewardUtid ?? null,
          sentifyUtid: purchase.sentifyUtid ?? null,
          status: purchase.status,
        };
      })
    );

    return {
      total: enriched.length,
      orders: enriched,
    };
  },
});

/**
 * Get buyer's active orders (pending pickup only)
 * 
 * Convenience query for buyers to see only orders that need pickup.
 * Shows same information as getBuyerOrders but filtered to pending_pickup status.
 */
export const getBuyerActiveOrders = query({
  args: {
    buyerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a buyer
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    // Get all pending pickup purchases for this buyer
    const purchases = await ctx.db
      .query("buyerPurchases")
      .withIndex("by_buyer", (q) => q.eq("buyerId", args.buyerId))
      .collect();

    // Filter to pending_pickup only
    const pendingPurchases = purchases.filter((p) => p.status === "pending_pickup");

    // Enrich with inventory and trader information
    const now = Date.now(); // Server time
    const enriched = await Promise.all(
      pendingPurchases.map(async (purchase) => {
        const inventory = await ctx.db.get(purchase.inventoryId);
        const trader = inventory ? await ctx.db.get(inventory.traderId) : null;
        const listingUnitId = inventory?.listingUnitIds?.[0];
        const listingUnit = listingUnitId ? await ctx.db.get(listingUnitId) : null;
        const listing = listingUnit ? await ctx.db.get(listingUnit.listingId) : null;
        const latestEtaChange = listing
          ? await ctx.db
              .query("etaHistory")
              .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
              .order("desc")
              .first()
          : null;

        const etaBaseTime = listing?.etaLastUpdatedAt || listing?.createdAt || purchase.purchasedAt;
        const etaTimestamp = listing?.etaType && listing?.etaValue != null
          ? listing.etaType === "duration"
            ? etaBaseTime + listing.etaValue * 60 * 60 * 1000
            : listing.etaValue
          : null;
        const etaIsPast = etaTimestamp != null ? now > etaTimestamp : false;
        const etaHoursRemaining = etaTimestamp != null
          ? Math.max(0, (etaTimestamp - now) / (1000 * 60 * 60))
          : null;
        const etaHoursOverdue = etaTimestamp != null && now > etaTimestamp
          ? (now - etaTimestamp) / (1000 * 60 * 60)
          : null;

        // Calculate pickup deadline status (server-side)
        const isPastDeadline = now > purchase.pickupSLA;
        const hoursRemaining = Math.max(0, (purchase.pickupSLA - now) / (1000 * 60 * 60));
        const hoursOverdue = isPastDeadline
          ? (now - purchase.pickupSLA) / (1000 * 60 * 60)
          : 0;

        return {
          purchaseId: purchase._id,
          purchaseUtid: purchase.utid,
          inventoryId: purchase.inventoryId,
          inventoryUtid: inventory?.utid || null,
          produceType: inventory?.produceType || null,
          kilos: purchase.kilos,
          traderAlias: trader?.alias || null, // Only alias, no real identity
          traderIsVerified: !!trader?.isVerifiedTrader && trader?.verificationStatus === "verified",
          purchasedAt: purchase.purchasedAt,
          pickupSLA: purchase.pickupSLA,
          status: purchase.status,
          etaType: listing?.etaType ?? null,
          etaValue: listing?.etaValue ?? null,
          etaLastUpdatedAt: listing?.etaLastUpdatedAt ?? null,
          etaTimestamp,
          etaIsPast,
          etaHoursRemaining: etaHoursRemaining != null ? Math.round(etaHoursRemaining * 100) / 100 : null,
          etaHoursOverdue: etaHoursOverdue != null ? Math.round(etaHoursOverdue * 100) / 100 : null,
          latestEtaChange: latestEtaChange
            ? {
                oldEtaValue: latestEtaChange.oldEtaValue ?? null,
                newEtaValue: latestEtaChange.newEtaValue,
                etaType: latestEtaChange.etaType,
                reason: latestEtaChange.reason,
                createdAt: latestEtaChange.createdAt,
              }
            : null,
          deliveryStatus: listing?.deliveryStatus ?? null,
          progressStage: listing?.progressStage ?? null,
          departureLocation: listing?.departureLocation ?? null,
          destinationLocation: listing?.destinationLocation ?? null,
          packagingTypeEnum: listing?.packagingTypeEnum ?? null,
          packagingTypeCustom: listing?.packagingTypeCustom ?? null,
          productName: listing?.productName ?? null,
          // Server-calculated countdown
          isPastDeadline,
          hoursRemaining: Math.round(hoursRemaining * 100) / 100,
          hoursOverdue: Math.round(hoursOverdue * 100) / 100,
          // NO PRICES - buyers never see prices
        };
      })
    );

    // Sort by pickup deadline (earliest first, then overdue first)
    enriched.sort((a, b) => {
      if (a.isPastDeadline !== b.isPastDeadline) {
        return a.isPastDeadline ? -1 : 1; // Overdue first
      }
      return a.pickupSLA - b.pickupSLA; // Earliest deadline first
    });

    return {
      total: enriched.length,
      overdue: enriched.filter((p) => p.isPastDeadline).length,
      orders: enriched,
    };
  },
});

/**
 * Get buyer's wallet balance
 * 
 * Shows buyer's current wallet balance from ledger entries.
 * Buyers use the same walletLedger system as traders.
 */
export const getBuyerWalletBalance = query({
  args: {
    buyerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a buyer
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    // Get all ledger entries for this buyer
    const entries = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q) => q.eq("userId", args.buyerId))
      .order("desc")
      .collect();

    // Calculate balance
    let balance = 0;
    for (const entry of entries) {
      if (entry.type === "capital_deposit") {
        balance += entry.amount;
      } else if (entry.type === "capital_lock") {
        balance -= entry.amount;
      } else if (entry.type === "capital_unlock") {
        balance += entry.amount;
      }
    }

    // Get the latest entry for current balance
    const latestEntry = entries[0];
    const currentBalance = latestEntry?.balanceAfter || balance;

    return {
      balance: currentBalance,
      totalDeposits: entries.filter((e) => e.type === "capital_deposit").reduce((sum, e) => sum + e.amount, 0),
      totalEntries: entries.length,
    };
  },
});

/**
 * Get buyer transaction ledger
 * 
 * Shows all purchases with:
 * - Total quantity of produce acquired
 * - Unit price per kilo
 * - Total cost (including service fee)
 * - UTID
 * - Timestamp
 */
export const getBuyerTransactionLedger = query({
  args: {
    buyerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a buyer
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    // Get all purchases for this buyer
    const purchases = await ctx.db
      .query("buyerPurchases")
      .withIndex("by_buyer", (q) => q.eq("buyerId", args.buyerId))
      .order("desc")
      .collect();

    const listingPurchases = await ctx.db
      .query("buyerListingPurchases")
      .withIndex("by_buyer", (q: any) => q.eq("buyerId", args.buyerId))
      .order("desc")
      .collect();

    // Enrich purchases with price information from wallet ledger
    const inventoryTransactions = await Promise.all(
      purchases.map(async (purchase) => {
        // Get wallet ledger entry for this purchase (by UTID)
        const ledgerEntry = await ctx.db
          .query("walletLedger")
          .withIndex("by_utid", (q) => q.eq("utid", purchase.utid))
          .first();

        // Get inventory info
        const inventory = await ctx.db.get(purchase.inventoryId);
        const trader = inventory ? await ctx.db.get(inventory.traderId) : null;

        // Extract price information from ledger metadata
        const metadata = ledgerEntry?.metadata as any;
        const basePricePerKilo = metadata?.basePricePerKilo || 0;
        const serviceFeePercentage = metadata?.serviceFeePercentage || 0;
        const serviceFee = metadata?.serviceFee || 0;
        const totalCost = ledgerEntry?.amount || 0;

        return {
          purchaseId: purchase._id,
          utid: purchase.utid,
          orderType: "inventory",
          produceType: inventory?.produceType || null,
          quantityKilos: purchase.kilos,
          unitPricePerKilo: basePricePerKilo,
          serviceFeePercentage: serviceFeePercentage,
          serviceFee: serviceFee,
          totalCost: totalCost,
          timestamp: purchase.purchasedAt,
          status: purchase.status,
          traderAlias: trader?.alias || null,
          traderIsVerified: !!trader?.isVerifiedTrader && trader?.verificationStatus === "verified",
        };
      })
    );

    const listingTransactions = await Promise.all(
      listingPurchases.map(async (purchase: any) => {
        const ledgerEntry = await ctx.db
          .query("walletLedger")
          .withIndex("by_utid", (q) => q.eq("utid", purchase.utid))
          .first();

        const listingId = purchase.listingId as Id<"listings">;
        const listing = await ctx.db.get(listingId);
        const trader = listing?.traderId ? await ctx.db.get(listing.traderId as Id<"users">) : null;

        const metadata = ledgerEntry?.metadata as any;
        const basePricePerKilo = metadata?.basePricePerKilo || purchase.pricePerKilo || 0;
        const serviceFeePercentage = metadata?.serviceFeePercentage || purchase.serviceFeePercentage || 0;
        const serviceFee = metadata?.serviceFee || purchase.serviceFee || 0;
        const totalCost = ledgerEntry?.amount || purchase.totalCost || 0;

        return {
          purchaseId: purchase._id,
          utid: purchase.utid,
          orderType: "trader_listing",
          produceType: listing?.produceType || null,
          quantityKilos: purchase.totalKilos,
          unitPricePerKilo: basePricePerKilo,
          serviceFeePercentage: serviceFeePercentage,
          serviceFee: serviceFee,
          totalCost: totalCost,
          timestamp: purchase.purchasedAt,
          status: purchase.status,
          traderAlias: trader?.alias || null,
          traderIsVerified: !!trader?.isVerifiedTrader && trader?.verificationStatus === "verified",
        };
      })
    );

    const transactions = [...inventoryTransactions, ...listingTransactions].sort(
      (a, b) => b.timestamp - a.timestamp
    );

    // Calculate totals
    const totals = {
      totalTransactions: transactions.length,
      totalQuantityKilos: transactions.reduce((sum, t) => sum + t.quantityKilos, 0),
      totalCost: transactions.reduce((sum, t) => sum + t.totalCost, 0),
      totalServiceFees: transactions.reduce((sum, t) => sum + t.serviceFee, 0),
    };

    return {
      transactions,
      totals,
    };
  },
});

/**
 * Get buyer wallet report
 * 
 * Shows money in and money out with timestamps:
 * - Deposits (money in)
 * - Purchases (money out)
 * - All transactions timestamped
 */
export const getBuyerWalletReport = query({
  args: {
    buyerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a buyer
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    // Get all ledger entries for this buyer
    const entries = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q) => q.eq("userId", args.buyerId))
      .order("desc")
      .collect();

    // Categorize entries
    const moneyIn: Array<{
      utid: string;
      amount: number;
      timestamp: number;
      type: string;
      description: string;
      balanceAfter: number;
    }> = [];

    const moneyOut: Array<{
      utid: string;
      amount: number;
      timestamp: number;
      type: string;
      description: string;
      balanceAfter: number;
      metadata?: any;
    }> = [];

    for (const entry of entries) {
      const description = entry.metadata?.source === "pesapal_payment" 
        ? "Deposit via Pesapal" 
        : entry.metadata?.source === "demo_seed"
        ? "Demo seed deposit"
        : entry.metadata?.type === "buyer_purchase"
        ? `Purchase: ${entry.metadata.produceType || "Unknown"} (${entry.metadata.kilos || 0} kg)`
        : entry.metadata?.type === "buyer_listing_purchase"
        ? `Listing purchase: ${entry.metadata.listingUtid || "Listing"} (${entry.metadata.unitCount || 0} unit(s))`
        : entry.type === "capital_deposit"
        ? "Deposit"
        : entry.type === "capital_lock"
        ? "Purchase"
        : entry.type === "capital_unlock"
        ? "Refund"
        : "Transaction";

      if (entry.type === "capital_deposit" || entry.type === "capital_unlock") {
        moneyIn.push({
          utid: entry.utid,
          amount: entry.amount,
          timestamp: entry.timestamp,
          type: entry.type,
          description,
          balanceAfter: entry.balanceAfter,
        });
      } else if (entry.type === "capital_lock") {
        moneyOut.push({
          utid: entry.utid,
          amount: entry.amount,
          timestamp: entry.timestamp,
          type: entry.type,
          description,
          balanceAfter: entry.balanceAfter,
          metadata: entry.metadata,
        });
      }
    }

    // Calculate totals
    const totalMoneyIn = moneyIn.reduce((sum, e) => sum + e.amount, 0);
    const totalMoneyOut = moneyOut.reduce((sum, e) => sum + e.amount, 0);
    const netBalance = totalMoneyIn - totalMoneyOut;

    // Get current balance
    const latestEntry = entries[0];
    const currentBalance = latestEntry?.balanceAfter || 0;

    return {
      moneyIn,
      moneyOut,
      totals: {
        totalMoneyIn,
        totalMoneyOut,
        netBalance,
        currentBalance,
      },
      allTransactions: entries.map((e) => ({
        utid: e.utid,
        type: e.type,
        amount: e.amount,
        timestamp: e.timestamp,
        balanceAfter: e.balanceAfter,
        metadata: e.metadata,
      })),
    };
  },
});

/**
 * Get active vendor and store listings for buyers
 */
export const getVendorStoreListings = query({
  args: { buyerId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    // Get all active listings
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    // Filter to vendor/store listings (they use farmerId, not traderId)
    const vendorStoreListings = [];
    for (const listing of listings) {
      if (!listing.farmerId || listing.traderId) continue;
      const seller = await ctx.db.get(listing.farmerId);
      if (!seller || !["vendor", "store"].includes(seller.role)) continue;

      let marketInfo: { marketName?: string; stallNumber?: string; marketType?: string } = {};
      let storeInfo: { buildingName?: string; streetAddress?: string; storeNumber?: string; storeType?: string } = {};

      if (seller.role === "vendor") {
        const vp = await ctx.db
          .query("vendorProfiles")
          .withIndex("by_userId", (q: any) => q.eq("userId", listing.farmerId))
          .first();
        if (vp) {
          marketInfo = { marketName: vp.marketName, stallNumber: vp.stallNumber, marketType: vp.marketType };
        }
      } else {
        const sp = await ctx.db
          .query("storeProfiles")
          .withIndex("by_userId", (q: any) => q.eq("userId", listing.farmerId))
          .first();
        if (sp) {
          storeInfo = { buildingName: sp.buildingName, streetAddress: sp.streetAddress, storeNumber: sp.storeNumber, storeType: sp.storeType };
        }
      }

      // Count available units
      const units = await ctx.db
        .query("listingUnits")
        .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
        .collect();
      const availableUnits = listing.availableUnits ?? units.filter((u) => u.status === "available").length;

      vendorStoreListings.push({
        listingId: listing._id,
        utid: listing.utid,
        produceType: listing.produceType,
        productName: listing.productName,
        totalKilos: listing.totalKilos,
        pricePerKilo: listing.pricePerKilo,
        pricePerUnit: listing.pricePerUnit,
        pricingUnit: listing.pricingUnit,
        packagingTypeEnum: listing.packagingTypeEnum,
        totalUnits: listing.totalUnits,
        availableUnits,
        listingMode: listing.listingMode || "unit",
        sellerAlias: seller.alias,
        sellerRole: seller.role as "vendor" | "store",
        collectionLocationText: listing.collectionLocationText || null,
        marketName: marketInfo.marketName,
        stallNumber: marketInfo.stallNumber,
        buildingName: storeInfo.buildingName,
        streetAddress: storeInfo.streetAddress,
        storeNumber: storeInfo.storeNumber,
        createdAt: listing.createdAt,
      });
    }

    return { listings: vendorStoreListings.sort((a, b) => b.createdAt - a.createdAt) };
  },
});