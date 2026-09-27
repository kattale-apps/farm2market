/**
 * Admin Red-Flag Queries
 * 
 * High-risk signal detection for admin monitoring.
 * These queries identify critical situations requiring immediate attention:
 * 
 * 1. Deliveries past SLA but not yet resolved
 *    - Units locked, deadline passed, but admin hasn't verified
 *    - Risk: Capital locked, farmer accountability unclear
 * 
 * 2. Traders near spend cap (>80% exposure)
 *    - Traders approaching UGX 1,000,000 exposure limit
 *    - Risk: System capacity constraints, trader unable to trade
 * 
 * 3. Buyers approaching pickup SLA expiry
 *    - Buyers with pending pickups approaching 48-hour deadline
 *    - Risk: Inventory stuck, buyer accountability unclear
 * 
 * All queries are:
 * - Admin-only (server-side role verification)
 * - Read-only (no mutations)
 * - Designed for quick scanning (sorted by risk, clear indicators)
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { calculateTraderExposureInternal } from "./utils";
import { MAX_TRADER_EXPOSURE_UGX, BUYER_PICKUP_SLA_MS } from "./constants";

/**
 * Verify user is admin
 */
async function verifyAdmin(ctx: any, adminId: string) {
  const user = await ctx.db.get(adminId);
  if (!user || user.role !== "admin") {
    throw new Error("User is not an admin");
  }
  return user;
}

/**
 * Get deliveries past SLA but not yet resolved
 * 
 * Returns units that:
 * - Are locked (payment received)
 * - Have deliveryStatus = "pending" (not yet verified by admin)
 * - Have deliveryDeadline < now (deadline has passed)
 * 
 * These are HIGH RISK because:
 * - Capital is locked but delivery status is unclear
 * - Farmer accountability is not yet determined
 * - System cannot proceed without admin verification
 * - Risk of capital being locked indefinitely
 */
export const getDeliveriesPastSLA = query({
  args: {
    adminId: v.id("users"),
    limit: v.optional(v.number()), // Limit results for quick scanning
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    const now = Date.now();
    const limit = args.limit || 50; // Default limit for quick scanning

    // Get all locked units with pending delivery status
    const allLockedUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_delivery_status", (q) => q.eq("deliveryStatus", "pending"))
      .collect();

    // Filter to units past deadline
    const pastDeadline = allLockedUnits.filter((unit) => {
      if (!unit.deliveryDeadline) return false;
      if (unit.status !== "locked") return false;
      return now > unit.deliveryDeadline;
    });

    // Enrich with listing and user information
    const enriched = await Promise.all(
      pastDeadline.map(async (unit) => {
        const listing = await ctx.db.get(unit.listingId);
        const farmer = listing && listing.farmerId ? await ctx.db.get(listing.farmerId) : null;
        const trader = unit.lockedBy ? await ctx.db.get(unit.lockedBy) : null;

        // Calculate hours overdue (server-side)
        const hoursOverdue = unit.deliveryDeadline
          ? (now - unit.deliveryDeadline) / (1000 * 60 * 60)
          : 0;

        // Calculate unit price (for risk assessment)
        const unitPrice = listing ? listing.pricePerKilo * 10 : 0; // 10kg per unit

        return {
          unitId: unit._id,
          lockUtid: unit.lockUtid || null,
          listingId: unit.listingId,
          listingUtid: listing?.utid || null,
          produceType: listing?.produceType || null,
          unitNumber: unit.unitNumber,
          farmerAlias: farmer?.alias || null,
          traderAlias: trader?.alias || null,
          lockedAt: unit.lockedAt || 0,
          deliveryDeadline: unit.deliveryDeadline || 0,
          hoursOverdue: Math.round(hoursOverdue * 100) / 100,
          unitPrice: Math.round(unitPrice * 100) / 100,
          status: unit.status,
          deliveryStatus: unit.deliveryStatus,
        };
      })
    );

    // Sort by most overdue first (highest risk first)
    enriched.sort((a, b) => b.hoursOverdue - a.hoursOverdue);

    // Limit results for quick scanning
    const limited = enriched.slice(0, limit);

    // Calculate totals
    const totals = {
      total: enriched.length,
      totalLockedCapital: enriched.reduce((sum, u) => sum + u.unitPrice, 0),
      averageHoursOverdue: enriched.length > 0
        ? Math.round((enriched.reduce((sum, u) => sum + u.hoursOverdue, 0) / enriched.length) * 100) / 100
        : 0,
      maxHoursOverdue: enriched.length > 0 ? Math.max(...enriched.map((u) => u.hoursOverdue)) : 0,
    };

    return {
      totals,
      deliveries: limited,
      hasMore: enriched.length > limit,
    };
  },
});

/**
 * Get traders near spend cap (>80% exposure)
 * 
 * Returns traders where:
 * - totalExposure / MAX_TRADER_EXPOSURE_UGX > 0.8 (80% threshold)
 * 
 * These are HIGH RISK because:
 * - Traders approaching system capacity limit
 * - Risk of trader being unable to make new purchases
 * - System may need to block further purchases
 * - Indicates potential system capacity constraints
 */
export const getTradersNearSpendCap = query({
  args: {
    adminId: v.id("users"),
    threshold: v.optional(v.number()), // Exposure threshold (default 0.8 = 80%)
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    const threshold = args.threshold || 0.8; // Default 80%
    const limit = args.limit || 50;

    // Get all traders
    const allUsers = await ctx.db.query("users").collect();
    const traders = allUsers.filter((u) => u.role === "trader");

    // Calculate exposure for each trader
    const traderExposures = await Promise.all(
      traders.map(async (trader) => {
        const exposure = await calculateTraderExposureInternal(ctx, trader._id);
        const exposurePercent = (exposure.totalExposure / MAX_TRADER_EXPOSURE_UGX) * 100;

        return {
          traderId: trader._id,
          traderAlias: trader.alias,
          exposure: {
            lockedCapital: exposure.lockedCapital,
            lockedOrdersValue: exposure.lockedOrdersValue,
            inventoryValue: exposure.inventoryValue,
            totalExposure: exposure.totalExposure,
            spendCap: exposure.spendCap,
            remainingCapacity: exposure.remainingCapacity,
            exposurePercent: Math.round(exposurePercent * 100) / 100,
          },
        };
      })
    );

    // Filter to traders above threshold
    const nearCap = traderExposures.filter((t) => t.exposure.exposurePercent >= threshold * 100);

    // Sort by highest exposure first (highest risk first)
    nearCap.sort((a, b) => b.exposure.exposurePercent - a.exposure.exposurePercent);

    // Limit results for quick scanning
    const limited = nearCap.slice(0, limit);

    // Calculate totals
    const totals = {
      total: nearCap.length,
      averageExposurePercent: nearCap.length > 0
        ? Math.round((nearCap.reduce((sum, t) => sum + t.exposure.exposurePercent, 0) / nearCap.length) * 100) / 100
        : 0,
      maxExposurePercent: nearCap.length > 0 ? Math.max(...nearCap.map((t) => t.exposure.exposurePercent)) : 0,
      totalLockedCapital: nearCap.reduce((sum, t) => sum + t.exposure.lockedCapital, 0),
      totalInventoryValue: nearCap.reduce((sum, t) => sum + t.exposure.inventoryValue, 0),
    };

    return {
      totals,
      traders: limited,
      hasMore: nearCap.length > limit,
      threshold: threshold * 100, // Return as percentage
    };
  },
});

/**
 * Get buyers approaching pickup SLA expiry
 * 
 * Returns purchases where:
 * - status = "pending_pickup"
 * - pickupSLA is approaching (within 12 hours) or already past
 * 
 * These are HIGH RISK because:
 * - Inventory is stuck (sold but not picked up)
 * - Buyer accountability is unclear
 * - System cannot proceed without pickup or expiry
 * - Risk of inventory being unavailable indefinitely
 */
export const getBuyersApproachingPickupSLA = query({
  args: {
    adminId: v.id("users"),
    warningHours: v.optional(v.number()), // Hours before deadline to flag (default 12)
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    const warningHours = args.warningHours || 12; // Default 12 hours
    const limit = args.limit || 50;

    const now = Date.now();
    const warningThreshold = warningHours * 60 * 60 * 1000; // Convert to milliseconds

    // Get all pending pickup purchases
    const allPurchases = await ctx.db
      .query("buyerPurchases")
      .withIndex("by_status", (q) => q.eq("status", "pending_pickup"))
      .collect();

    // Filter to purchases approaching or past deadline
    const approaching = allPurchases.filter((purchase) => {
      const timeUntilDeadline = purchase.pickupSLA - now;
      // Flag if past deadline OR within warning threshold
      return timeUntilDeadline <= warningThreshold;
    });

    // Enrich with buyer, inventory, and trader information
    const enriched = await Promise.all(
      approaching.map(async (purchase) => {
        const buyer = await ctx.db.get(purchase.buyerId);
        const inventory = await ctx.db.get(purchase.inventoryId);
        const trader = inventory ? await ctx.db.get(inventory.traderId) : null;

        // Calculate time until/past deadline (server-side)
        const timeUntilDeadline = purchase.pickupSLA - now;
        const hoursRemaining = timeUntilDeadline > 0 ? timeUntilDeadline / (1000 * 60 * 60) : 0;
        const hoursOverdue = timeUntilDeadline <= 0 ? Math.abs(timeUntilDeadline) / (1000 * 60 * 60) : 0;
        const isPastDeadline = timeUntilDeadline <= 0;

        return {
          purchaseId: purchase._id,
          purchaseUtid: purchase.utid,
          buyerId: purchase.buyerId,
          buyerAlias: buyer?.alias || null,
          inventoryId: purchase.inventoryId,
          inventoryUtid: inventory?.utid || null,
          produceType: inventory?.produceType || null,
          kilos: purchase.kilos,
          traderAlias: trader?.alias || null,
          purchasedAt: purchase.purchasedAt,
          pickupSLA: purchase.pickupSLA,
          status: purchase.status,
          // Server-calculated time indicators
          isPastDeadline,
          hoursRemaining: Math.round(hoursRemaining * 100) / 100,
          hoursOverdue: Math.round(hoursOverdue * 100) / 100,
        };
      })
    );

    // Sort by most urgent first (overdue first, then closest to deadline)
    enriched.sort((a, b) => {
      if (a.isPastDeadline !== b.isPastDeadline) {
        return a.isPastDeadline ? -1 : 1; // Overdue first
      }
      // Then by closest to deadline (smallest hoursRemaining or largest hoursOverdue)
      if (a.isPastDeadline) {
        return b.hoursOverdue - a.hoursOverdue; // Most overdue first
      }
      return a.hoursRemaining - b.hoursRemaining; // Closest to deadline first
    });

    // Limit results for quick scanning
    const limited = enriched.slice(0, limit);

    // Calculate totals
    const totals = {
      total: enriched.length,
      overdue: enriched.filter((p) => p.isPastDeadline).length,
      approaching: enriched.filter((p) => !p.isPastDeadline).length,
      totalKilos: enriched.reduce((sum, p) => sum + p.kilos, 0),
      averageHoursRemaining: enriched.filter((p) => !p.isPastDeadline).length > 0
        ? Math.round(
            (enriched
              .filter((p) => !p.isPastDeadline)
              .reduce((sum, p) => sum + p.hoursRemaining, 0) /
              enriched.filter((p) => !p.isPastDeadline).length) *
              100
          ) / 100
        : 0,
      averageHoursOverdue: enriched.filter((p) => p.isPastDeadline).length > 0
        ? Math.round(
            (enriched
              .filter((p) => p.isPastDeadline)
              .reduce((sum, p) => sum + p.hoursOverdue, 0) /
              enriched.filter((p) => p.isPastDeadline).length) *
              100
          ) / 100
        : 0,
      maxHoursOverdue: enriched.filter((p) => p.isPastDeadline).length > 0
        ? Math.max(...enriched.filter((p) => p.isPastDeadline).map((p) => p.hoursOverdue))
        : 0,
    };

    return {
      totals,
      purchases: limited,
      hasMore: enriched.length > limit,
      warningHours,
    };
  },
});

/**
 * Get all red flags summary
 * 
 * Convenience query that returns counts for all red flag categories.
 * Designed for quick dashboard overview.
 */
export const getRedFlagsSummary = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    // Get counts for each category (using existing queries with limit 0 to get totals only)
    const deliveriesPastSLA = await ctx.db
      .query("listingUnits")
      .withIndex("by_delivery_status", (q) => q.eq("deliveryStatus", "pending"))
      .collect();

    const now = Date.now();
    const deliveriesCount = deliveriesPastSLA.filter((unit) => {
      if (!unit.deliveryDeadline) return false;
      if (unit.status !== "locked") return false;
      return now > unit.deliveryDeadline;
    }).length;

    // Get traders near cap
    const allUsers = await ctx.db.query("users").collect();
    const traders = allUsers.filter((u) => u.role === "trader");
    let tradersNearCapCount = 0;
    for (const trader of traders) {
      const exposure = await calculateTraderExposureInternal(ctx, trader._id);
      const exposurePercent = (exposure.totalExposure / MAX_TRADER_EXPOSURE_UGX) * 100;
      if (exposurePercent >= 80) {
        tradersNearCapCount++;
      }
    }

    // Get buyers approaching pickup SLA
    const allPurchases = await ctx.db
      .query("buyerPurchases")
      .withIndex("by_status", (q) => q.eq("status", "pending_pickup"))
      .collect();

    const warningHours = 12;
    const warningThreshold = warningHours * 60 * 60 * 1000;
    const buyersApproachingCount = allPurchases.filter((purchase) => {
      const timeUntilDeadline = purchase.pickupSLA - now;
      return timeUntilDeadline <= warningThreshold;
    }).length;

    return {
      deliveriesPastSLA: deliveriesCount,
      tradersNearSpendCap: tradersNearCapCount,
      buyersApproachingPickupSLA: buyersApproachingCount,
      total: deliveriesCount + tradersNearCapCount + buyersApproachingCount,
      timestamp: now,
    };
  },
});
