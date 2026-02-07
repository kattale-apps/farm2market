/**
 * Negotiations System
 * 
 * - Traders make offers on listing units
 * - Farmers can accept, reject, or counter-offer
 * - Only accepted offers can proceed to pay-to-lock
 * - Delivery time starts from 6 hours after payment (not negotiation)
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { generateUTID, getUgandaTime } from "./utils";
import { LISTING_UNIT_SIZE_KG } from "./constants";
import { checkPilotMode } from "./pilotMode";
import { checkRateLimit } from "./rateLimits";
import {
  invalidRoleError,
  invalidAmountError,
  unitNotAvailableError,
  listingNotFoundError,
  unitNotFoundError,
  throwAppError,
} from "./errors";
import { Id } from "./_generated/dataModel";

/**
 * Make an offer on one or more units (trader only)
 * 
 * Creates negotiations where trader offers a price per kilo.
 * Each unit gets its own UTID and incoming_purchase ledger entries.
 * Farmer can then accept, reject, or counter-offer each negotiation.
 */
export const makeOffer = mutation({
  args: {
    traderId: v.id("users"),
    unitIds: v.array(v.id("listingUnits")), // Array of unit IDs - trader can select multiple units
    offerPricePerKilo: v.number(), // Trader's offer price (same for all units)
  },
  handler: async (ctx, args) => {
    // ============================================================
    // PILOT MODE CHECK (MUST BE FIRST - BEFORE ANY OPERATIONS)
    // ============================================================
    await checkPilotMode(ctx);

    // Verify user is a trader
    const user = await ctx.db.get(args.traderId);
    if (!user || user.role !== "trader") {
      throwAppError(invalidRoleError("trader"));
    }

    // Validate inputs
    if (args.unitIds.length === 0) {
      throw new Error("Please select at least one unit");
    }
    if (args.offerPricePerKilo <= 0) {
      throwAppError(invalidAmountError());
    }

    // Rate limit check (based on number of units)
    await checkRateLimit(ctx, args.traderId, user.role, "make_offer", {
      unitCount: args.unitIds.length,
    });

    // Validate all units and get listing info
    const units = [];
    const skippedUnits: { unitId: Id<"listingUnits">; unitNumber: number }[] = [];
    const listings = new Map<Id<"listings">, any>();
    
    for (const unitId of args.unitIds) {
      const unit = await ctx.db.get(unitId);
      if (!unit) {
        throwAppError(unitNotFoundError());
      }
      if (unit.status !== "available") {
        throwAppError(unitNotAvailableError());
      }

      // Check if unit already has an active negotiation
      if (unit.activeNegotiationId) {
        const existingNeg = await ctx.db.get(unit.activeNegotiationId);
        if (existingNeg && (existingNeg.status === "pending" || existingNeg.status === "countered")) {
          skippedUnits.push({ unitId: unit._id, unitNumber: unit.unitNumber });
          continue;
        }
      }

      // Get listing
      if (!listings.has(unit.listingId)) {
        const listing = await ctx.db.get(unit.listingId);
        if (!listing) {
          throwAppError(listingNotFoundError());
        }
        if (!listing.farmerId) {
          throw new Error("Listing has no farmer ID");
        }
        listings.set(unit.listingId, listing);
      }

      units.push(unit);
    }

    if (units.length === 0) {
      throw new Error("All selected units already have active negotiations. Please wait for the farmer's response.");
    }

    // All units must be from the same listing
    if (listings.size > 1) {
      throw new Error("All selected units must be from the same listing");
    }

    const listing = Array.from(listings.values())[0];
    const unitSize = listing.unitSize || LISTING_UNIT_SIZE_KG;
    const unitPrice = args.offerPricePerKilo * unitSize;

    // Create negotiations and ledger entries for each unit
    const negotiations = [];
    const utids = [];

    for (const unit of units) {
      // Generate unique UTID for each unit
      const unitUtid = generateUTID(user.role);
      utids.push(unitUtid);

      // Create negotiation for this unit
      const negotiationId = await ctx.db.insert("negotiations", {
        unitId: unit._id,
        listingId: listing._id,
        traderId: args.traderId,
        farmerId: listing.farmerId,
        status: "pending",
        farmerPricePerKilo: listing.pricePerKilo,
        traderOfferPricePerKilo: args.offerPricePerKilo,
        currentPricePerKilo: args.offerPricePerKilo, // Start with trader's offer
        createdAt: getUgandaTime(),
        lastUpdatedAt: getUgandaTime(),
        expiresAt: getUgandaTime() + (24 * 60 * 60 * 1000), // 24 hours expiration
        negotiationUtid: unitUtid, // Each unit gets its own UTID
      });

      // Link negotiation to unit
      await ctx.db.patch(unit._id, {
        activeNegotiationId: negotiationId,
      });

      negotiations.push({
        negotiationId,
        unitId: unit._id,
        unitNumber: unit.unitNumber,
        utid: unitUtid,
      });

      // Create incoming_purchase ledger entry for TRADER
      const traderEntries = await ctx.db
        .query("walletLedger")
        .withIndex("by_user", (q) => q.eq("userId", args.traderId))
        .order("desc")
        .first();
      const traderBalanceAfter = traderEntries?.balanceAfter || 0;

      await ctx.db.insert("walletLedger", {
        userId: args.traderId,
        utid: unitUtid,
        type: "incoming_purchase",
        amount: unitPrice,
        balanceAfter: traderBalanceAfter, // Balance doesn't change for incoming purchases
        timestamp: getUgandaTime(),
        metadata: {
          unitId: unit._id,
          listingId: listing._id,
          produceType: listing.produceType,
          unitSize: unitSize,
          offerPricePerKilo: args.offerPricePerKilo,
          status: "pending_negotiation",
        },
      });

      // Create incoming_purchase ledger entry for FARMER
      const farmerEntries = await ctx.db
        .query("walletLedger")
        .withIndex("by_user", (q) => q.eq("userId", listing.farmerId))
        .order("desc")
        .first();
      const farmerBalanceAfter = farmerEntries?.balanceAfter || 0;

      await ctx.db.insert("walletLedger", {
        userId: listing.farmerId,
        utid: unitUtid,
        type: "incoming_purchase",
        amount: unitPrice,
        balanceAfter: farmerBalanceAfter, // Balance doesn't change for incoming purchases
        timestamp: getUgandaTime(),
        metadata: {
          unitId: unit._id,
          listingId: listing._id,
          produceType: listing.produceType,
          unitSize: unitSize,
          offerPricePerKilo: args.offerPricePerKilo,
          status: "pending_negotiation",
        },
      });
    }

    // Notify farmer about new offer (always send)
    const farmer = await ctx.db.get(listing.farmerId);
    if (farmer) {
      await ctx.db.insert("notifications", {
        userId: listing.farmerId,
        type: "utid_specific",
        title: "New Offer Received",
        message: `Trader made an offer of ${new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(args.offerPricePerKilo)}/kg on your ${listing.produceType} listing. UTID: ${utids[0]}`,
        utid: utids[0],
        read: false,
        createdAt: getUgandaTime(),
      });
    }

    return {
      negotiations: negotiations.map(n => ({
        negotiationId: n.negotiationId,
        unitId: n.unitId,
        unitNumber: n.unitNumber,
        utid: n.utid,
      })),
      totalUnits: units.length,
      totalPrice: unitPrice * units.length,
      status: "pending",
      message: `Offer made on ${units.length} unit(s). Waiting for farmer's response.`,
      skippedUnits,
    };
  },
});

/**
 * Accept an offer (farmer only)
 * 
 * Farmer accepts the trader's offer. After acceptance, trader can proceed to pay-to-lock.
 */
export const acceptOffer = mutation({
  args: {
    farmerId: v.id("users"),
    negotiationId: v.id("negotiations"),
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);

    // Verify user is a farmer
    const user = await ctx.db.get(args.farmerId);
    if (!user || user.role !== "farmer") {
      throwAppError(invalidRoleError("farmer"));
    }

    // Get negotiation
    const negotiation = await ctx.db.get(args.negotiationId);
    if (!negotiation) {
      throw new Error("Negotiation not found");
    }

    // Verify farmer owns this negotiation
    if (negotiation.farmerId !== args.farmerId) {
      throw new Error("You can only accept offers on your own listings");
    }

    // Verify negotiation is in a state that can be accepted
    if (negotiation.status !== "pending" && negotiation.status !== "countered") {
      throw new Error(`Cannot accept offer in status: ${negotiation.status}`);
    }

    // Generate UTID for acceptance
    const acceptedUtid = generateUTID(user.role);

    // Update negotiation to accepted
    await ctx.db.patch(args.negotiationId, {
      status: "accepted",
      acceptedUtid,
      lastUpdatedAt: getUgandaTime(),
    });

    // Notify trader about acceptance (always send)
    const trader = await ctx.db.get(negotiation.traderId);
    if (trader) {
      await ctx.db.insert("notifications", {
        userId: negotiation.traderId,
        type: "utid_specific",
        title: "Offer Accepted",
        message: `Your offer of ${new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(negotiation.currentPricePerKilo)}/kg has been accepted. You can now proceed to pay-to-lock. UTID: ${acceptedUtid}`,
        utid: acceptedUtid,
        read: false,
        createdAt: getUgandaTime(),
      });
    }

    return {
      negotiationId: args.negotiationId,
      acceptedUtid,
      finalPricePerKilo: negotiation.currentPricePerKilo,
      message: "Offer accepted. Trader can now proceed to pay-to-lock.",
    };
  },
});

/**
 * Reject an offer (farmer only)
 */
export const rejectOffer = mutation({
  args: {
    farmerId: v.id("users"),
    negotiationId: v.id("negotiations"),
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);

    // Verify user is a farmer
    const user = await ctx.db.get(args.farmerId);
    if (!user || user.role !== "farmer") {
      throwAppError(invalidRoleError("farmer"));
    }

    // Get negotiation
    const negotiation = await ctx.db.get(args.negotiationId);
    if (!negotiation) {
      throw new Error("Negotiation not found");
    }

    // Verify farmer owns this negotiation
    if (negotiation.farmerId !== args.farmerId) {
      throw new Error("You can only reject offers on your own listings");
    }

    // Verify negotiation can be rejected
    if (negotiation.status !== "pending" && negotiation.status !== "countered") {
      throw new Error(`Cannot reject offer in status: ${negotiation.status}`);
    }

    // Update negotiation to rejected
    await ctx.db.patch(args.negotiationId, {
      status: "rejected",
      lastUpdatedAt: getUgandaTime(),
    });

    // Clear active negotiation from unit
    await ctx.db.patch(negotiation.unitId, {
      activeNegotiationId: undefined,
    });

    return {
      negotiationId: args.negotiationId,
      message: "Offer rejected.",
    };
  },
});

/**
 * Counter-offer (farmer only)
 * 
 * Farmer makes a counter-offer with a new price.
 */
export const counterOffer = mutation({
  args: {
    farmerId: v.id("users"),
    negotiationId: v.id("negotiations"),
    counterPricePerKilo: v.number(), // Farmer's counter-offer price
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);

    // Verify user is a farmer
    const user = await ctx.db.get(args.farmerId);
    if (!user || user.role !== "farmer") {
      throwAppError(invalidRoleError("farmer"));
    }

    // Get negotiation
    const negotiation = await ctx.db.get(args.negotiationId);
    if (!negotiation) {
      throw new Error("Negotiation not found");
    }

    // Verify farmer owns this negotiation
    if (negotiation.farmerId !== args.farmerId) {
      throw new Error("You can only counter-offer on your own listings");
    }

    // Verify negotiation can be countered
    if (negotiation.status !== "pending" && negotiation.status !== "countered") {
      throw new Error(`Cannot counter-offer in status: ${negotiation.status}`);
    }

    // Verify counter price is positive
    if (args.counterPricePerKilo <= 0) {
      throwAppError(invalidAmountError());
    }

    // Update negotiation with counter-offer
    await ctx.db.patch(args.negotiationId, {
      status: "countered",
      currentPricePerKilo: args.counterPricePerKilo,
      lastUpdatedAt: getUgandaTime(),
    });

    // Notify trader about counter-offer (always send)
    const trader = await ctx.db.get(negotiation.traderId);
    if (trader) {
      const listing = await ctx.db.get(negotiation.listingId);
      await ctx.db.insert("notifications", {
        userId: negotiation.traderId,
        type: "utid_specific",
        title: "Counter-Offer Received",
        message: `Farmer made a counter-offer of ${new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(args.counterPricePerKilo)}/kg on your negotiation. UTID: ${negotiation.negotiationUtid}`,
        utid: negotiation.negotiationUtid,
        read: false,
        createdAt: getUgandaTime(),
      });
    }

    return {
      negotiationId: args.negotiationId,
      counterPricePerKilo: args.counterPricePerKilo,
      message: "Counter-offer made. Waiting for trader's response.",
    };
  },
});

/**
 * Accept counter-offer (trader only)
 * 
 * Trader accepts farmer's counter-offer. After acceptance, trader can proceed to pay-to-lock.
 */
export const acceptCounterOffer = mutation({
  args: {
    traderId: v.id("users"),
    negotiationId: v.id("negotiations"),
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);

    // Verify user is a trader
    const user = await ctx.db.get(args.traderId);
    if (!user || user.role !== "trader") {
      throwAppError(invalidRoleError("trader"));
    }

    // Get negotiation
    const negotiation = await ctx.db.get(args.negotiationId);
    if (!negotiation) {
      throw new Error("Negotiation not found");
    }

    // Verify trader owns this negotiation
    if (negotiation.traderId !== args.traderId) {
      throw new Error("You can only accept counter-offers on your own negotiations");
    }

    // Verify negotiation is in countered status
    if (negotiation.status !== "countered") {
      throw new Error(`Cannot accept counter-offer in status: ${negotiation.status}`);
    }

    // Generate UTID for acceptance
    const acceptedUtid = generateUTID(user.role);

    // Update negotiation to accepted
    await ctx.db.patch(args.negotiationId, {
      status: "accepted",
      acceptedUtid,
      lastUpdatedAt: getUgandaTime(),
    });

    // Notify farmer about counter-offer acceptance (always send)
    const farmer = await ctx.db.get(negotiation.farmerId);
    if (farmer) {
      await ctx.db.insert("notifications", {
        userId: negotiation.farmerId,
        type: "utid_specific",
        title: "Counter-Offer Accepted",
        message: `Trader accepted your counter-offer of ${new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(negotiation.currentPricePerKilo)}/kg. UTID: ${acceptedUtid}`,
        utid: acceptedUtid,
        read: false,
        createdAt: getUgandaTime(),
      });
    }

    return {
      negotiationId: args.negotiationId,
      acceptedUtid,
      finalPricePerKilo: negotiation.currentPricePerKilo,
      message: "Counter-offer accepted. You can now proceed to pay-to-lock.",
    };
  },
});

/**
 * Counter-offer by trader (trader only)
 *
 * Trader counters farmer's counter-offer with a new price.
 */
export const traderCounterOffer = mutation({
  args: {
    traderId: v.id("users"),
    negotiationId: v.id("negotiations"),
    counterPricePerKilo: v.number(), // Trader's counter price
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);

    const user = await ctx.db.get(args.traderId);
    if (!user || user.role !== "trader") {
      throwAppError(invalidRoleError("trader"));
    }

    const negotiation = await ctx.db.get(args.negotiationId);
    if (!negotiation) {
      throw new Error("Negotiation not found");
    }

    if (negotiation.traderId !== args.traderId) {
      throw new Error("You can only counter-offer on your own negotiations");
    }

    if (negotiation.status !== "countered") {
      throw new Error(`Cannot counter-offer in status: ${negotiation.status}`);
    }

    if (args.counterPricePerKilo <= 0) {
      throwAppError(invalidAmountError());
    }

    await ctx.db.patch(args.negotiationId, {
      status: "countered",
      traderOfferPricePerKilo: args.counterPricePerKilo,
      currentPricePerKilo: args.counterPricePerKilo,
      lastUpdatedAt: getUgandaTime(),
    });

    const farmer = await ctx.db.get(negotiation.farmerId);
    if (farmer) {
      await ctx.db.insert("notifications", {
        userId: negotiation.farmerId,
        type: "utid_specific",
        title: "Trader Counter-Offer",
        message: `Trader countered with ${new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(args.counterPricePerKilo)}/kg. UTID: ${negotiation.negotiationUtid}`,
        utid: negotiation.negotiationUtid,
        read: false,
        createdAt: getUgandaTime(),
      });
    }

    return {
      negotiationId: args.negotiationId,
      counterPricePerKilo: args.counterPricePerKilo,
      message: "Counter-offer sent to farmer.",
    };
  },
});

/**
 * Cancel negotiation (trader only)
 *
 * Allowed before pay-to-lock, including accepted negotiations
 * if the unit has not been locked.
 */
export const cancelNegotiation = mutation({
  args: {
    traderId: v.id("users"),
    negotiationId: v.id("negotiations"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);

    const user = await ctx.db.get(args.traderId);
    if (!user || user.role !== "trader") {
      throwAppError(invalidRoleError("trader"));
    }

    const negotiation = await ctx.db.get(args.negotiationId);
    if (!negotiation) {
      throw new Error("Negotiation not found");
    }

    if (negotiation.traderId !== args.traderId) {
      throw new Error("You can only cancel your own negotiations");
    }

    if (negotiation.status === "rejected" || negotiation.status === "cancelled") {
      throw new Error(`Negotiation already ${negotiation.status}`);
    }

    const unit = await ctx.db.get(negotiation.unitId);
    if (unit && unit.status === "locked") {
      throw new Error("Cannot cancel after pay-to-lock");
    }

    await ctx.db.patch(args.negotiationId, {
      status: "cancelled",
      lastUpdatedAt: getUgandaTime(),
    });

    if (unit) {
      const unitPatch: Partial<typeof unit> = {
        activeNegotiationId: undefined,
      };

      if (unit.status !== "available" && unit.status !== "delivered" && unit.status !== "cancelled") {
        unitPatch.status = "available";
      }

      await ctx.db.patch(negotiation.unitId, unitPatch);
    }

    const farmer = await ctx.db.get(negotiation.farmerId);
    if (farmer) {
      await ctx.db.insert("notifications", {
        userId: negotiation.farmerId,
        type: "utid_specific",
        title: "Negotiation Cancelled",
        message: `Trader cancelled the negotiation. UTID: ${negotiation.negotiationUtid}`,
        utid: negotiation.negotiationUtid,
        read: false,
        createdAt: getUgandaTime(),
      });
    }

    return {
      negotiationId: args.negotiationId,
      status: "cancelled",
      message: "Negotiation cancelled.",
    };
  },
});

/**
 * Get active negotiations for a trader
 */
export const getTraderNegotiations = query({
  args: {
    traderId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a trader
    const user = await ctx.db.get(args.traderId);
    if (!user || user.role !== "trader") {
      throw new Error("User is not a trader");
    }

    // Get all negotiations for this trader
    const negotiations = await ctx.db
      .query("negotiations")
      .withIndex("by_trader_status", (q) => q.eq("traderId", args.traderId))
      .collect();

    // Include all negotiation statuses for UI separation (active vs concluded)
    const activeNegotiations = negotiations.filter(
      (n) =>
        n.status === "pending" ||
        n.status === "countered" ||
        n.status === "accepted" ||
        n.status === "rejected" ||
        n.status === "cancelled"
    );

    // Enrich with listing and unit information
    const enriched = await Promise.all(
      activeNegotiations.map(async (neg) => {
        const listing = await ctx.db.get(neg.listingId);
        const unit = await ctx.db.get(neg.unitId);
        const farmer = await ctx.db.get(neg.farmerId);

        return {
          negotiationId: neg._id,
          negotiationUtid: neg.negotiationUtid,
          unitId: neg.unitId,
          unitNumber: unit?.unitNumber || 0,
          unitStatus: unit?.status,
          deliveryStatus: unit?.deliveryStatus,
          deliveryDeadline: unit?.deliveryDeadline,
          listingId: neg.listingId,
          listingUtid: listing?.utid,
          produceType: listing?.produceType,
          status: neg.status,
          farmerPricePerKilo: neg.farmerPricePerKilo,
          traderOfferPricePerKilo: neg.traderOfferPricePerKilo,
          currentPricePerKilo: neg.currentPricePerKilo,
          farmerAlias: farmer?.alias || null,
          createdAt: neg.createdAt,
          lastUpdatedAt: neg.lastUpdatedAt,
          expiresAt: neg.expiresAt,
          acceptedUtid: neg.acceptedUtid,
        };
      })
    );

    // Sort by most recent first
    enriched.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);

    return {
      totalNegotiations: enriched.length,
      negotiations: enriched,
    };
  },
});

/**
 * Get active negotiations for a farmer
 */
export const getFarmerNegotiations = query({
  args: {
    farmerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a farmer
    const user = await ctx.db.get(args.farmerId);
    if (!user || user.role !== "farmer") {
      throw new Error("User is not a farmer");
    }

    // Get all negotiations for this farmer
    const negotiations = await ctx.db
      .query("negotiations")
      .withIndex("by_farmer_status", (q) => q.eq("farmerId", args.farmerId))
      .collect();

    // Include all negotiation statuses for UI separation (active vs concluded)
    const activeNegotiations = negotiations.filter(
      (n) =>
        n.status === "pending" ||
        n.status === "countered" ||
        n.status === "accepted" ||
        n.status === "rejected" ||
        n.status === "cancelled"
    );

    // Enrich with listing and unit information
    const enriched = await Promise.all(
      activeNegotiations.map(async (neg) => {
        const listing = await ctx.db.get(neg.listingId);
        const unit = await ctx.db.get(neg.unitId);
        const trader = await ctx.db.get(neg.traderId);

        return {
          negotiationId: neg._id,
          negotiationUtid: neg.negotiationUtid,
          unitId: neg.unitId,
          unitNumber: unit?.unitNumber || 0,
          unitStatus: unit?.status,
          deliveryStatus: unit?.deliveryStatus,
          deliveryDeadline: unit?.deliveryDeadline,
          listingId: neg.listingId,
          listingUtid: listing?.utid,
          produceType: listing?.produceType,
          status: neg.status,
          farmerPricePerKilo: neg.farmerPricePerKilo,
          traderOfferPricePerKilo: neg.traderOfferPricePerKilo,
          currentPricePerKilo: neg.currentPricePerKilo,
          traderAlias: trader?.alias || null,
          createdAt: neg.createdAt,
          lastUpdatedAt: neg.lastUpdatedAt,
          expiresAt: neg.expiresAt,
          acceptedUtid: neg.acceptedUtid,
        };
      })
    );

    // Sort by most recent first
    enriched.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);

    return {
      totalNegotiations: enriched.length,
      negotiations: enriched,
    };
  },
});

/**
 * Get accepted negotiations ready for pay-to-lock (trader only)
 */
export const getAcceptedNegotiations = query({
  args: {
    traderId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a trader
    const user = await ctx.db.get(args.traderId);
    if (!user || user.role !== "trader") {
      throw new Error("User is not a trader");
    }

    // Get all accepted negotiations for this trader
    const negotiations = await ctx.db
      .query("negotiations")
      .withIndex("by_trader_status", (q) => q.eq("traderId", args.traderId).eq("status", "accepted"))
      .collect();

    // Enrich with listing and unit information
    const enriched = await Promise.all(
      negotiations.map(async (neg) => {
        const listing = await ctx.db.get(neg.listingId);
        const unit = await ctx.db.get(neg.unitId);
        const farmer = await ctx.db.get(neg.farmerId);

        // Check if unit is still available (not locked by someone else)
        const isUnitAvailable = unit?.status === "available";

        return {
          negotiationId: neg._id,
          negotiationUtid: neg.negotiationUtid,
          acceptedUtid: neg.acceptedUtid,
          unitId: neg.unitId,
          unitNumber: unit?.unitNumber || 0,
          listingId: neg.listingId,
          listingUtid: listing?.utid,
          produceType: listing?.produceType,
          unitSize: listing?.unitSize || 10,
          finalPricePerKilo: neg.currentPricePerKilo,
          totalPrice: neg.currentPricePerKilo * (listing?.unitSize || 10),
          farmerAlias: farmer?.alias || null,
          isUnitAvailable,
          createdAt: neg.createdAt,
          acceptedAt: neg.lastUpdatedAt,
        };
      })
    );

    // Filter to only available units
    const available = enriched.filter((n) => n.isUnitAvailable);

    // Sort by most recent first
    available.sort((a, b) => b.acceptedAt - a.acceptedAt);

    return {
      totalAccepted: available.length,
      negotiations: available,
    };
  },
});
