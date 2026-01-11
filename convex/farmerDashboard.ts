/**
 * Farmer Dashboard Queries (Read-Only)
 * 
 * Read-only queries for farmers to view their dashboard.
 * All data is farmer-specific - no cross-user data exposure.
 * All calculations done server-side.
 * Anonymity preserved - only trader aliases shown.
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getUgandaTime, generateUTID } from "./utils";

/**
 * Get farmer's listings
 * 
 * Returns all listings created by this farmer,
 * with current status and unit counts.
 */
export const getFarmerListings = query({
  args: {
    farmerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a farmer
    const user = await ctx.db.get(args.farmerId);
    if (!user || user.role !== "farmer") {
      throw new Error("User is not a farmer");
    }

    // Get all listings for this farmer only
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_farmer", (q) => q.eq("farmerId", args.farmerId))
      .collect();

    // Enrich with unit status information and additional details
    const enrichedListings = await Promise.all(
      listings.map(async (listing) => {
        const units = await ctx.db
          .query("listingUnits")
          .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
          .collect();

        const availableCount = units.filter((u) => u.status === "available").length;
        const lockedCount = units.filter((u) => u.status === "locked").length;
        const deliveredCount = units.filter((u) => u.status === "delivered").length;
        const cancelledCount = units.filter((u) => u.status === "cancelled").length;

        // Get storage location details if available
        const storageLocation = listing.storageLocationId
          ? await ctx.db.get(listing.storageLocationId)
          : null;

        return {
          listingId: listing._id,
          utid: listing.utid,
          produceType: listing.produceType,
          totalKilos: listing.totalKilos,
          pricePerKilo: listing.pricePerKilo,
          unitSize: listing.unitSize,
          totalUnits: listing.totalUnits,
          status: listing.status,
          createdAt: listing.createdAt,
          deliverySLA: listing.deliverySLA,
          qualityRating: listing.qualityRating || null,
          qualityComment: listing.qualityComment || null,
          storageLocation: storageLocation ? {
            locationId: storageLocation._id,
            districtName: storageLocation.districtName,
            code: storageLocation.code,
          } : null,
          // Unit breakdown
          units: {
            available: availableCount,
            locked: lockedCount,
            delivered: deliveredCount,
            cancelled: cancelledCount,
            total: units.length,
          },
        };
      })
    );

    // Sort by most recent first
    enrichedListings.sort((a, b) => b.createdAt - a.createdAt);

    return {
      totalListings: enrichedListings.length,
      listings: enrichedListings,
    };
  },
});

/**
 * Get active negotiations (locked units awaiting delivery)
 * 
 * Returns all units from farmer's listings that are locked,
 * showing trader aliases, payment confirmations, and delivery deadlines.
 */
export const getActiveNegotiations = query({
  args: {
    farmerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a farmer
    const user = await ctx.db.get(args.farmerId);
    if (!user || user.role !== "farmer") {
      throw new Error("User is not a farmer");
    }

    const now = getUgandaTime();

    // Get all listings for this farmer
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_farmer", (q) => q.eq("farmerId", args.farmerId))
      .collect();

    const listingIds = listings.map((l) => l._id);

    // Get all locked units from these listings
    const allLockedUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_status", (q) => q.eq("status", "locked"))
      .collect();

    // Filter to only units from this farmer's listings
    const farmerLockedUnits = allLockedUnits.filter((unit) =>
      listingIds.includes(unit.listingId)
    );

    // Enrich with listing and trader information
    const negotiations = await Promise.all(
      farmerLockedUnits.map(async (unit) => {
        const listing = await ctx.db.get(unit.listingId);
        const trader = unit.lockedBy ? await ctx.db.get(unit.lockedBy) : null;

        // Server-side time calculation for delivery deadline
        const isPastDeadline = unit.deliveryDeadline
          ? now > unit.deliveryDeadline
          : false;

        const hoursRemaining = unit.deliveryDeadline
          ? Math.max(0, (unit.deliveryDeadline - now) / (1000 * 60 * 60))
          : null;

        const hoursOverdue = unit.deliveryDeadline && isPastDeadline
          ? (now - unit.deliveryDeadline) / (1000 * 60 * 60)
          : 0;

        return {
          unitId: unit._id,
          unitNumber: unit.unitNumber,
          listingId: unit.listingId,
          listingUtid: listing?.utid,
          produceType: listing?.produceType,
          pricePerKilo: listing?.pricePerKilo,
          unitPrice: listing ? listing.pricePerKilo * 10 : 0, // 10kg per unit
          // Pay-to-lock confirmation
          lockUtid: unit.lockUtid, // UTID of the payment that locked this unit
          lockedAt: unit.lockedAt,
          // Trader information (anonymity preserved)
          traderAlias: trader?.alias || null, // Only alias, no real identity
          // Delivery deadline (server-calculated)
          deliveryDeadline: unit.deliveryDeadline,
          isPastDeadline,
          hoursRemaining: hoursRemaining !== null ? Math.round(hoursRemaining * 100) / 100 : null,
          hoursOverdue: Math.round(hoursOverdue * 100) / 100,
          // Delivery status
          deliveryStatus: unit.deliveryStatus || "pending",
        };
      })
    );

    // Sort by deadline (earliest first, then overdue first)
    negotiations.sort((a, b) => {
      if (!a.deliveryDeadline) return 1;
      if (!b.deliveryDeadline) return -1;
      if (a.isPastDeadline !== b.isPastDeadline) {
        return a.isPastDeadline ? -1 : 1; // Overdue first
      }
      return a.deliveryDeadline - b.deliveryDeadline;
    });

    return {
      totalNegotiations: negotiations.length,
      negotiations: negotiations,
      currentTime: now,
    };
  },
});

/**
 * Get pay-to-lock confirmations
 * 
 * Returns all units that have been locked (paid for),
 * showing payment confirmation details and UTIDs.
 */
export const getPayToLockConfirmations = query({
  args: {
    farmerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a farmer
    const user = await ctx.db.get(args.farmerId);
    if (!user || user.role !== "farmer") {
      throw new Error("User is not a farmer");
    }

    // Get all listings for this farmer
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_farmer", (q) => q.eq("farmerId", args.farmerId))
      .collect();

    const listingIds = listings.map((l) => l._id);

    // Get all locked units from these listings
    const allLockedUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_status", (q) => q.eq("status", "locked"))
      .collect();

    // Filter to only units from this farmer's listings
    const farmerLockedUnits = allLockedUnits.filter((unit) =>
      listingIds.includes(unit.listingId)
    );

    // Enrich with payment confirmation details
    const confirmations = await Promise.all(
      farmerLockedUnits.map(async (unit) => {
        const listing = await ctx.db.get(unit.listingId);
        const trader = unit.lockedBy ? await ctx.db.get(unit.lockedBy) : null;

        // Get wallet ledger entry for this lock (payment confirmation)
        // Extract utid first to ensure proper type narrowing in callback
        const utid = unit.lockUtid;
        let walletEntry = null;
        if (utid) {
          const entry = await ctx.db
            .query("walletLedger")
            .withIndex("by_utid", (q: any) => q.eq("utid", utid))
            .first();
          walletEntry = entry;
        }

        return {
          unitId: unit._id,
          unitNumber: unit.unitNumber,
          listingId: unit.listingId,
          listingUtid: listing?.utid,
          produceType: listing?.produceType,
          // Pay-to-lock confirmation
          lockUtid: unit.lockUtid, // UTID of the payment
          lockedAt: unit.lockedAt,
          // Payment confirmation
          paymentConfirmed: !!walletEntry,
          paymentAmount: walletEntry?.amount || null,
          paymentTimestamp: walletEntry?.timestamp || null,
          // Trader information (anonymity preserved)
          traderAlias: trader?.alias || null, // Only alias, no real identity
        };
      })
    );

    // Sort by most recent first
    confirmations.sort((a, b) => {
      if (!a.lockedAt) return 1;
      if (!b.lockedAt) return -1;
      return b.lockedAt - a.lockedAt;
    });

    return {
      totalConfirmations: confirmations.length,
      confirmations: confirmations,
    };
  },
});

/**
 * Get delivery deadlines with countdown
 * 
 * Returns all locked units with delivery deadlines,
 * showing server-calculated countdown timers.
 */
export const getDeliveryDeadlines = query({
  args: {
    farmerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a farmer
    const user = await ctx.db.get(args.farmerId);
    if (!user || user.role !== "farmer") {
      throw new Error("User is not a farmer");
    }

    const now = getUgandaTime();

    // Get all listings for this farmer
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_farmer", (q) => q.eq("farmerId", args.farmerId))
      .collect();

    const listingIds = listings.map((l) => l._id);

    // Get all locked units from these listings
    const allLockedUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_status", (q) => q.eq("status", "locked"))
      .collect();

    // Filter to only units from this farmer's listings
    const farmerLockedUnits = allLockedUnits.filter((unit) =>
      listingIds.includes(unit.listingId) && unit.deliveryDeadline
    );

    // Enrich with deadline countdown (server-calculated)
    const deadlines = await Promise.all(
      farmerLockedUnits.map(async (unit) => {
        const listing = await ctx.db.get(unit.listingId);
        const trader = unit.lockedBy ? await ctx.db.get(unit.lockedBy) : null;

        // Server-side time calculation
        const isPastDeadline = now > unit.deliveryDeadline!;
        const hoursRemaining = Math.max(0, (unit.deliveryDeadline! - now) / (1000 * 60 * 60));
        const hoursOverdue = isPastDeadline
          ? (now - unit.deliveryDeadline!) / (1000 * 60 * 60)
          : 0;
        const minutesRemaining = Math.max(0, (unit.deliveryDeadline! - now) / (1000 * 60));
        const minutesOverdue = isPastDeadline
          ? (now - unit.deliveryDeadline!) / (1000 * 60)
          : 0;

        return {
          unitId: unit._id,
          unitNumber: unit.unitNumber,
          listingId: unit.listingId,
          listingUtid: listing?.utid,
          produceType: listing?.produceType,
          lockUtid: unit.lockUtid,
          lockedAt: unit.lockedAt,
          // Delivery deadline
          deliveryDeadline: unit.deliveryDeadline,
          // Server-calculated countdown
          isPastDeadline,
          hoursRemaining: Math.round(hoursRemaining * 100) / 100,
          hoursOverdue: Math.round(hoursOverdue * 100) / 100,
          minutesRemaining: Math.round(minutesRemaining),
          minutesOverdue: Math.round(minutesOverdue),
          // Trader information (anonymity preserved)
          traderAlias: trader?.alias || null, // Only alias, no real identity
        };
      })
    );

    // Sort by deadline (earliest first, then overdue first)
    deadlines.sort((a, b) => {
      if (a.isPastDeadline !== b.isPastDeadline) {
        return a.isPastDeadline ? -1 : 1; // Overdue first
      }
      return a.deliveryDeadline! - b.deliveryDeadline!;
    });

    // Group by status
    const pending = deadlines.filter((d) => !d.isPastDeadline);
    const overdue = deadlines.filter((d) => d.isPastDeadline);

    return {
      totalDeadlines: deadlines.length,
      pending: {
        count: pending.length,
        deadlines: pending,
      },
      overdue: {
        count: overdue.length,
        deadlines: overdue,
      },
      currentTime: now,
    };
  },
});

/**
 * Get delivery status summary
 * 
 * Returns all locked units grouped by delivery status:
 * - pending: Awaiting delivery
 * - delivered: Successfully delivered (verified)
 * - late: Past deadline, not yet delivered
 * - cancelled: Delivery cancelled/reversed
 */
export const getDeliveryStatus = query({
  args: {
    farmerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a farmer
    const user = await ctx.db.get(args.farmerId);
    if (!user || user.role !== "farmer") {
      throw new Error("User is not a farmer");
    }

    const now = getUgandaTime();

    // Get all listings for this farmer
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_farmer", (q) => q.eq("farmerId", args.farmerId))
      .collect();

    const listingIds = listings.map((l) => l._id);

    // Get all locked units from these listings
    const allLockedUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_status", (q) => q.eq("status", "locked"))
      .collect();

    // Filter to only units from this farmer's listings
    const farmerLockedUnits = allLockedUnits.filter((unit) =>
      listingIds.includes(unit.listingId)
    );

    // Group by delivery status
    const byStatus = new Map<string, any[]>();

    for (const unit of farmerLockedUnits) {
      const deliveryStatus = unit.deliveryStatus || "pending";
      if (!byStatus.has(deliveryStatus)) {
        byStatus.set(deliveryStatus, []);
      }

      const listing = await ctx.db.get(unit.listingId);
      const trader = unit.lockedBy ? await ctx.db.get(unit.lockedBy) : null;

      // Server-side time calculation
      const isPastDeadline = unit.deliveryDeadline
        ? now > unit.deliveryDeadline
        : false;

      const hoursOverdue = unit.deliveryDeadline && isPastDeadline
        ? (now - unit.deliveryDeadline) / (1000 * 60 * 60)
        : 0;

      byStatus.get(deliveryStatus)!.push({
        unitId: unit._id,
        unitNumber: unit.unitNumber,
        listingId: unit.listingId,
        listingUtid: listing?.utid,
        produceType: listing?.produceType,
        lockUtid: unit.lockUtid,
        lockedAt: unit.lockedAt,
        deliveryDeadline: unit.deliveryDeadline,
        deliveryStatus: unit.deliveryStatus,
        isPastDeadline,
        hoursOverdue: Math.round(hoursOverdue * 100) / 100,
        // Trader information (anonymity preserved)
        traderAlias: trader?.alias || null, // Only alias, no real identity
      });
    }

    // Convert to array format
    const statusGroups = Array.from(byStatus.entries()).map(([status, units]) => ({
      deliveryStatus: status,
      count: units.length,
      units: units.sort((a, b) => {
        // Sort by deadline (earliest first)
        if (!a.deliveryDeadline) return 1;
        if (!b.deliveryDeadline) return -1;
        return a.deliveryDeadline - b.deliveryDeadline;
      }),
    }));

    // Calculate totals
    const totals = {
      pending: statusGroups.find((g) => g.deliveryStatus === "pending")?.count || 0,
      delivered: statusGroups.find((g) => g.deliveryStatus === "delivered")?.count || 0,
      late: statusGroups.find((g) => g.deliveryStatus === "late")?.count || 0,
      cancelled: statusGroups.find((g) => g.deliveryStatus === "cancelled")?.count || 0,
      total: farmerLockedUnits.length,
    };

    return {
      totals,
      byStatus: statusGroups,
      currentTime: now,
    };
  },
});

/**
 * Get expired UTIDs (past delivery deadline, not delivered, not archived)
 * 
 * Returns all UTIDs where the delivery deadline has passed,
 * delivery status is still pending or late, and not yet archived.
 */
export const getExpiredUTIDs = query({
  args: {
    farmerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a farmer
    const user = await ctx.db.get(args.farmerId);
    if (!user || user.role !== "farmer") {
      throw new Error("User is not a farmer");
    }

    const now = getUgandaTime();

    // Get all listings for this farmer
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_farmer", (q) => q.eq("farmerId", args.farmerId))
      .collect();

    const listingIds = listings.map((l) => l._id);

    // Get all locked units from these listings
    const allLockedUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_status", (q) => q.eq("status", "locked"))
      .collect();

    // Filter to only units from this farmer's listings that are expired
    // Expired means: deadline has passed by more than 1 hour
    const expiredUnits = allLockedUnits.filter((unit) => {
      if (!listingIds.includes(unit.listingId)) return false;
      if (!unit.deliveryDeadline) return false;
      const expirationTime = unit.deliveryDeadline + (60 * 60 * 1000); // Deadline + 1 hour
      if (now < expirationTime) return false; // Not expired yet (need 1 hour past deadline)
      if (unit.deliveryStatus === "delivered") return false; // Already delivered
      if (unit.archived) return false; // Already archived
      return true;
    });

    // Enrich with listing and trader information
    const expiredUTIDs = await Promise.all(
      expiredUnits.map(async (unit) => {
        const listing = await ctx.db.get(unit.listingId);
        const trader = unit.lockedBy ? await ctx.db.get(unit.lockedBy) : null;

        // Calculate how long expired
        const hoursExpired = (now - unit.deliveryDeadline!) / (1000 * 60 * 60);
        const daysExpired = hoursExpired / 24;

        return {
          unitId: unit._id,
          unitNumber: unit.unitNumber,
          listingId: unit.listingId,
          listingUtid: listing?.utid,
          produceType: listing?.produceType,
          kilos: listing?.unitSize || 10,
          desiredPricePerKilo: listing?.pricePerKilo || 0,
          lockUtid: unit.lockUtid,
          lockedAt: unit.lockedAt,
          deliveryDeadline: unit.deliveryDeadline,
          deliveryStatus: unit.deliveryStatus || "pending",
          hoursExpired: Math.round(hoursExpired * 100) / 100,
          daysExpired: Math.round(daysExpired * 100) / 100,
          traderAlias: trader?.alias || null,
          archived: unit.archived || false,
        };
      })
    );

    // Sort by most expired first
    expiredUTIDs.sort((a, b) => b.hoursExpired - a.hoursExpired);

    return {
      totalExpired: expiredUTIDs.length,
      expiredUTIDs,
      currentTime: now,
    };
  },
});

/**
 * Archive expired UTID (farmer only)
 * 
 * Marks a UTID as archived so it no longer appears in expired UTIDs list.
 */
export const archiveUTID = mutation({
  args: {
    farmerId: v.id("users"),
    unitId: v.id("listingUnits"),
  },
  handler: async (ctx, args) => {
    // Verify user is a farmer
    const user = await ctx.db.get(args.farmerId);
    if (!user || user.role !== "farmer") {
      throw new Error("User is not a farmer");
    }

    // Get the unit
    const unit = await ctx.db.get(args.unitId);
    if (!unit) {
      throw new Error("Unit not found");
    }

    // Verify this unit belongs to a listing owned by this farmer
    const listing = await ctx.db.get(unit.listingId);
    if (!listing || listing.farmerId !== args.farmerId) {
      throw new Error("You can only archive UTIDs from your own listings");
    }

    // Verify unit has a lockUtid
    if (!unit.lockUtid) {
      throw new Error("Unit has no UTID to archive");
    }

    // Archive the unit
    await ctx.db.patch(args.unitId, {
      archived: true,
      archivedAt: Date.now(),
    });

    return {
      success: true,
      unitId: args.unitId,
      lockUtid: unit.lockUtid,
      archivedAt: Date.now(),
    };
  },
});

/**
 * Get successful transactions ledger
 * 
 * Returns all successfully delivered and sold transactions with:
 * - UTID details
 * - Price action (negotiation history)
 * - Desired price (original listing price)
 * - Final price sold (price at which sold to buyer, if available)
 * - Total earned (kilos × final price)
 * - Kilos
 */
export const getSuccessfulTransactionsLedger = query({
  args: {
    farmerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a farmer
    const user = await ctx.db.get(args.farmerId);
    if (!user || user.role !== "farmer") {
      throw new Error("User is not a farmer");
    }

    // Get all listings for this farmer
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_farmer", (q) => q.eq("farmerId", args.farmerId))
      .collect();

    const listingIds = listings.map((l) => l._id);
    const listingsMap = new Map(listings.map((l) => [l._id, l]));

    // Get all delivered units from these listings
    const allDeliveredUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_status", (q) => q.eq("status", "delivered"))
      .collect();

    // Filter to only units from this farmer's listings
    const farmerDeliveredUnits = allDeliveredUnits.filter((unit) =>
      listingIds.includes(unit.listingId) && unit.deliveryStatus === "delivered"
    );

    // Build successful transactions
    const transactions = await Promise.all(
      farmerDeliveredUnits.map(async (unit) => {
        const listing = listingsMap.get(unit.listingId);
        if (!listing) return null;

        // Get negotiation history if available
        let negotiationHistory = null;
        if (unit.activeNegotiationId) {
          const negotiation = await ctx.db.get(unit.activeNegotiationId);
          if (negotiation) {
            negotiationHistory = {
              farmerPricePerKilo: negotiation.farmerPricePerKilo,
              traderOfferPricePerKilo: negotiation.traderOfferPricePerKilo,
              currentPricePerKilo: negotiation.currentPricePerKilo,
              negotiationUtid: negotiation.negotiationUtid,
              acceptedUtid: negotiation.acceptedUtid,
            };
          }
        }

        // Get trader information
        const trader = unit.lockedBy ? await ctx.db.get(unit.lockedBy) : null;

        // Check if this unit is part of trader inventory that was sold
        let finalSalePrice = null;
        let soldToBuyer = false;
        let buyerPurchaseUtid = null;
        
        // Find trader inventory that contains this unit
        const allInventory = await ctx.db
          .query("traderInventory")
          .withIndex("by_trader", (q) => q.eq("traderId", unit.lockedBy!))
          .collect();

        for (const inventory of allInventory) {
          if (inventory.listingUnitIds.includes(unit._id)) {
            // Check if this inventory was sold to a buyer
            if (inventory.status === "sold") {
              soldToBuyer = true;
              // Find buyer purchase for this inventory
              const buyerPurchases = await ctx.db
                .query("buyerPurchases")
                .withIndex("by_status", (q) => q.eq("status", "picked_up"))
                .collect();
              
              const purchase = buyerPurchases.find(
                (p) => p.inventoryId === inventory._id
              );

              if (purchase) {
                buyerPurchaseUtid = purchase.utid;
                // Calculate final price per kilo from inventory
                // Note: We use the listing price as the final price since buyer prices aren't stored
                // In a real system, this would be stored when inventory is sold
                finalSalePrice = listing.pricePerKilo;
              }
            }
            break;
          }
        }

        // Use negotiated price if available, otherwise use listing price
        const finalPricePerKilo = negotiationHistory?.currentPricePerKilo || listing.pricePerKilo;
        const kilos = listing.unitSize || 10;
        const totalEarned = finalPricePerKilo * kilos;

        return {
          unitId: unit._id,
          unitNumber: unit.unitNumber,
          listingId: unit.listingId,
          listingUtid: listing.utid,
          lockUtid: unit.lockUtid,
          produceType: listing.produceType,
          kilos,
          // Price information
          desiredPricePerKilo: listing.pricePerKilo,
          negotiatedPricePerKilo: negotiationHistory?.currentPricePerKilo || listing.pricePerKilo,
          finalPricePerKilo: finalSalePrice || finalPricePerKilo,
          totalEarned,
          // Price action (negotiation history)
          priceAction: negotiationHistory ? {
            originalPrice: negotiationHistory.farmerPricePerKilo,
            traderOffer: negotiationHistory.traderOfferPricePerKilo,
            finalNegotiated: negotiationHistory.currentPricePerKilo,
            negotiationUtid: negotiationHistory.negotiationUtid,
            acceptedUtid: negotiationHistory.acceptedUtid,
          } : null,
          // Sale information
          soldToBuyer,
          buyerPurchaseUtid,
          // Timestamps
          lockedAt: unit.lockedAt,
          deliveryDeadline: unit.deliveryDeadline,
          // Trader information (anonymity preserved)
          traderAlias: trader?.alias || null,
        };
      })
    );

    // Filter out nulls and sort by most recent first
    const validTransactions = transactions.filter((t) => t !== null) as NonNullable<typeof transactions[0]>[];
    validTransactions.sort((a, b) => {
      const timeA = a.lockedAt || 0;
      const timeB = b.lockedAt || 0;
      return timeB - timeA;
    });

    // Calculate totals
    const totalKilos = validTransactions.reduce((sum, t) => sum + t.kilos, 0);
    const totalEarned = validTransactions.reduce((sum, t) => sum + t.totalEarned, 0);

    return {
      totalTransactions: validTransactions.length,
      totalKilos,
      totalEarned,
      transactions: validTransactions,
    };
  },
});

/**
 * Cancel overdue UTID (farmer only)
 * 
 * Allows farmers to cancel and delete overdue UTIDs from their account.
 * This will:
 * - Unlock the unit (make it available again)
 * - Return locked capital to the trader
 * - Mark the unit as cancelled
 * - Remove it from the farmer's delivery deadlines view
 * 
 * Only works for overdue deliveries (past deadline).
 */
export const cancelOverdueUTID = mutation({
  args: {
    farmerId: v.id("users"),
    unitId: v.id("listingUnits"),
  },
  handler: async (ctx, args) => {
    // Verify user is a farmer
    const user = await ctx.db.get(args.farmerId);
    if (!user || user.role !== "farmer") {
      throw new Error("User is not a farmer");
    }

    // Get the unit
    const unit = await ctx.db.get(args.unitId);
    if (!unit) {
      throw new Error("Unit not found");
    }

    // Verify the unit belongs to this farmer's listing
    const listing = await ctx.db.get(unit.listingId);
    if (!listing || listing.farmerId !== args.farmerId) {
      throw new Error("Unit does not belong to this farmer");
    }

    // Verify unit is locked
    if (unit.status !== "locked") {
      throw new Error("Unit is not locked");
    }

    // Verify unit has a delivery deadline
    if (!unit.deliveryDeadline) {
      throw new Error("Unit has no delivery deadline");
    }

    // Verify unit is overdue (past deadline)
    const now = getUgandaTime();
    if (now <= unit.deliveryDeadline) {
      throw new Error("Unit is not overdue. Only overdue deliveries can be cancelled.");
    }

    // Verify unit has lock information
    if (!unit.lockUtid || !unit.lockedBy) {
      throw new Error("Unit has no lock information");
    }

    // Get the actual price from the wallet ledger entry
    const walletEntry = await ctx.db
      .query("walletLedger")
      .withIndex("by_utid", (q: any) => q.eq("utid", unit.lockUtid))
      .first();

    if (!walletEntry || walletEntry.type !== "capital_lock") {
      throw new Error("Wallet entry not found for this UTID");
    }

    const unitPrice = walletEntry.amount; // This is the actual amount that was locked
    const traderId = unit.lockedBy;

    // Generate UTID for cancellation
    const cancellationUtid = generateUTID("farmer");

    // ATOMIC OPERATION: Unlock unit and return capital to trader
    // Step 1: Unlock the unit and mark as cancelled
    await ctx.db.patch(unit._id, {
      status: "available",
      lockedBy: undefined,
      lockedAt: undefined,
      lockUtid: undefined,
      deliveryDeadline: undefined,
      deliveryStatus: "cancelled",
      activeNegotiationId: undefined,
    });

    // Step 2: Return capital to trader (unlock capital)
    const walletEntries = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", traderId))
      .order("desc")
      .collect();

    const currentBalance = walletEntries[0]?.balanceAfter || 0;
    const balanceAfter = currentBalance + unitPrice;

    await ctx.db.insert("walletLedger", {
      userId: traderId,
      type: "capital_unlock",
      amount: unitPrice,
      balanceAfter: balanceAfter,
      utid: cancellationUtid,
      timestamp: getUgandaTime(),
      metadata: {
        originalLockUtid: unit.lockUtid,
        unitId: unit._id,
        cancelledBy: "farmer",
        farmerId: args.farmerId,
        description: `Capital unlocked - Farmer cancelled overdue delivery (UTID: ${unit.lockUtid})`,
      },
    });

    // Step 3: Update listing status if needed
    const allUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
      .collect();

    const availableCount = allUnits.filter((u) => u.status === "available").length;
    const lockedCount = allUnits.filter((u) => u.status === "locked").length;

    if (lockedCount === 0 && availableCount > 0) {
      // All units are available, listing is fully available
      await ctx.db.patch(listing._id, {
        status: "active",
      });
    } else if (lockedCount > 0 && availableCount > 0) {
      // Some units locked, some available
      await ctx.db.patch(listing._id, {
        status: "partially_locked",
      });
    }

    return {
      success: true,
      cancellationUtid,
      unitId: unit._id,
      lockUtid: unit.lockUtid,
      capitalReturned: unitPrice,
      message: "Overdue UTID cancelled successfully. Capital has been returned to trader.",
    };
  },
});

/**
 * Get all units ledger (comprehensive view)
 * 
 * Returns all units from all listings, grouped by listing,
 * showing status (open/locked/delivered) and earnings for each unit.
 * This allows farmers to track how their listings are performing.
 */
export const getAllUnitsLedger = query({
  args: {
    farmerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a farmer
    const user = await ctx.db.get(args.farmerId);
    if (!user || user.role !== "farmer") {
      throw new Error("User is not a farmer");
    }

    // Get all listings for this farmer
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_farmer", (q) => q.eq("farmerId", args.farmerId))
      .collect();

    const listingIds = listings.map((l) => l._id);
    const listingsMap = new Map(listings.map((l) => [l._id, l]));

    // Get all units from these listings
    const allUnits = await ctx.db
      .query("listingUnits")
      .collect();

    const farmerUnits = allUnits.filter((unit) =>
      listingIds.includes(unit.listingId)
    );

    // Group units by listing and enrich with status and earnings
    const listingsWithUnits = await Promise.all(
      listings.map(async (listing) => {
        const listingUnits = farmerUnits.filter((u) => u.listingId === listing._id);
        
        // Sort units by unit number
        listingUnits.sort((a, b) => a.unitNumber - b.unitNumber);

        // Process each unit
        const unitsData = await Promise.all(
          listingUnits.map(async (unit) => {
            // Determine status
            let status: "open" | "locked" | "delivered" | "cancelled" = "open";
            if (unit.status === "delivered") {
              status = "delivered";
            } else if (unit.status === "locked") {
              status = "locked";
            } else if (unit.status === "cancelled") {
              status = "cancelled";
            } else {
              status = "open";
            }

            // Calculate earnings (only for delivered units)
            let earnings = 0;
            let pricePerKilo = listing.pricePerKilo;
            let lockUtid = unit.lockUtid || null;

            if (status === "delivered") {
              // Get negotiation history if available
              let negotiationHistory = null;
              if (unit.activeNegotiationId) {
                const negotiation = await ctx.db.get(unit.activeNegotiationId);
                if (negotiation) {
                  negotiationHistory = {
                    currentPricePerKilo: negotiation.currentPricePerKilo,
                  };
                }
              }

              // Use negotiated price if available, otherwise use listing price
              pricePerKilo = negotiationHistory?.currentPricePerKilo || listing.pricePerKilo;
              const kilos = listing.unitSize || 10;
              earnings = pricePerKilo * kilos;
            } else if (status === "locked") {
              // For locked units, get the negotiated price if available
              if (unit.activeNegotiationId) {
                const negotiation = await ctx.db.get(unit.activeNegotiationId);
                if (negotiation) {
                  pricePerKilo = negotiation.currentPricePerKilo;
                }
              }
            }

            return {
              unitId: unit._id,
              unitNumber: unit.unitNumber,
              status,
              lockUtid,
              pricePerKilo,
              earnings,
              lockedAt: unit.lockedAt || null,
              deliveryDeadline: unit.deliveryDeadline || null,
            };
          })
        );

        // Calculate totals for this listing
        const openCount = unitsData.filter((u) => u.status === "open").length;
        const lockedCount = unitsData.filter((u) => u.status === "locked").length;
        const deliveredCount = unitsData.filter((u) => u.status === "delivered").length;
        const cancelledCount = unitsData.filter((u) => u.status === "cancelled").length;
        const totalEarnings = unitsData.reduce((sum, u) => sum + u.earnings, 0);

        return {
          listingId: listing._id,
          listingUtid: listing.utid,
          produceType: listing.produceType,
          totalKilos: listing.totalKilos,
          totalUnits: listing.totalUnits,
          unitSize: listing.unitSize || 10,
          pricePerKilo: listing.pricePerKilo,
          createdAt: listing.createdAt,
          units: unitsData,
          totals: {
            open: openCount,
            locked: lockedCount,
            delivered: deliveredCount,
            cancelled: cancelledCount,
            totalEarnings,
          },
        };
      })
    );

    // Calculate grand totals
    const grandTotals = listingsWithUnits.reduce(
      (acc, listing) => ({
        open: acc.open + listing.totals.open,
        locked: acc.locked + listing.totals.locked,
        delivered: acc.delivered + listing.totals.delivered,
        cancelled: acc.cancelled + listing.totals.cancelled,
        totalEarnings: acc.totalEarnings + listing.totals.totalEarnings,
      }),
      { open: 0, locked: 0, delivered: 0, cancelled: 0, totalEarnings: 0 }
    );

    return {
      listings: listingsWithUnits,
      grandTotals,
    };
  },
});

/**
 * Cancel/Close listing (farmer only)
 * 
 * Allows farmers to cancel listings that have no locked units.
 * This is for cases where the farmer changes their mind before
 * any units are purchased.
 * 
 * Requirements:
 * - Listing must belong to the farmer
 * - No units can be locked (to protect trader interests)
 * - Only available/open units can be cancelled
 */
export const cancelListing = mutation({
  args: {
    farmerId: v.id("users"),
    listingId: v.id("listings"),
  },
  handler: async (ctx, args) => {
    // Verify user is a farmer
    const user = await ctx.db.get(args.farmerId);
    if (!user || user.role !== "farmer") {
      throw new Error("User is not a farmer");
    }

    // Get the listing
    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }

    // Verify the listing belongs to this farmer
    if (listing.farmerId !== args.farmerId) {
      throw new Error("Listing does not belong to this farmer");
    }

    // Verify listing is not already cancelled
    if (listing.status === "cancelled") {
      throw new Error("Listing is already cancelled");
    }

    // Get all units for this listing
    const allUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .collect();

    // Check if any units are locked
    const lockedUnits = allUnits.filter((u) => u.status === "locked");
    if (lockedUnits.length > 0) {
      throw new Error(
        `Cannot cancel listing: ${lockedUnits.length} unit(s) are locked. Only listings with no locked units can be cancelled.`
      );
    }

    // Check if any units are delivered
    const deliveredUnits = allUnits.filter((u) => u.status === "delivered");
    if (deliveredUnits.length > 0) {
      throw new Error(
        `Cannot cancel listing: ${deliveredUnits.length} unit(s) have been delivered. Only listings with no delivered units can be cancelled.`
      );
    }

    // Generate UTID for cancellation
    const cancellationUtid = generateUTID("farmer");

    // Cancel all available units
    const availableUnits = allUnits.filter((u) => u.status === "available");
    for (const unit of availableUnits) {
      await ctx.db.patch(unit._id, {
        status: "cancelled",
      });
    }

    // Mark listing as cancelled
    await ctx.db.patch(args.listingId, {
      status: "cancelled",
    });

    return {
      success: true,
      cancellationUtid,
      listingId: listing._id,
      listingUtid: listing.utid,
      unitsCancelled: availableUnits.length,
      message: `Listing cancelled successfully. ${availableUnits.length} unit(s) have been cancelled.`,
    };
  },
});
