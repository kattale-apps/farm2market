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
 * Make an offer on a unit (trader only)
 * 
 * Creates a negotiation where trader offers a price per kilo.
 * Farmer can then accept, reject, or counter-offer.
 */
export const makeOffer = mutation({
  args: {
    traderId: v.id("users"),
    unitId: v.id("listingUnits"),
    offerPricePerKilo: v.number(), // Trader's offer price
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

    // Rate limit check
    await checkRateLimit(ctx, args.traderId, user.role, "make_offer", {
      unitId: args.unitId,
    });

    // Get unit and verify it's available
    const unit = await ctx.db.get(args.unitId);
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
        throw new Error("This unit already has an active negotiation. Please wait for the farmer's response.");
      }
    }

    // Get listing to get farmer and original price
    const listing = await ctx.db.get(unit.listingId);
    if (!listing) {
      throwAppError(listingNotFoundError());
    }

    // Verify offer price is positive
    if (args.offerPricePerKilo <= 0) {
      throwAppError(invalidAmountError());
    }

    // Generate UTID for negotiation
    const negotiationUtid = generateUTID(user.role);

    // Create negotiation
    if (!listing.farmerId) {
      throw new Error("Listing has no farmer ID");
    }
    
    const negotiationId = await ctx.db.insert("negotiations", {
      unitId: args.unitId,
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
      negotiationUtid,
    });

    // Link negotiation to unit
    await ctx.db.patch(args.unitId, {
      activeNegotiationId: negotiationId,
    });

    return {
      negotiationId,
      negotiationUtid,
      status: "pending",
      message: "Offer made. Waiting for farmer's response.",
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

    return {
      negotiationId: args.negotiationId,
      acceptedUtid,
      finalPricePerKilo: negotiation.currentPricePerKilo,
      message: "Counter-offer accepted. You can now proceed to pay-to-lock.",
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

    // Filter to active negotiations (pending, countered, accepted)
    const activeNegotiations = negotiations.filter(
      (n) => n.status === "pending" || n.status === "countered" || n.status === "accepted"
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

    // Filter to active negotiations (pending, countered, accepted)
    const activeNegotiations = negotiations.filter(
      (n) => n.status === "pending" || n.status === "countered" || n.status === "accepted"
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
