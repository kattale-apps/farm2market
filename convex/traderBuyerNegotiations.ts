/**
 * Trader-Buyer Negotiation System
 * 
 * - Buyers make offers on trader inventory
 * - Traders can accept, reject, or counter-offer
 * - Only accepted offers can proceed to purchase
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { generateUTID, getUgandaTime } from "./utils";
import { checkPilotMode } from "./pilotMode";
import { checkRateLimit } from "./rateLimits";
import {
  invalidRoleError,
  invalidAmountError,
  throwAppError,
} from "./errors";

/**
 * Make offer on trader inventory (buyer only)
 * 
 * Buyer makes an offer on available trader inventory.
 */
export const makeBuyerOffer = mutation({
  args: {
    buyerId: v.id("users"),
    inventoryId: v.id("traderInventory"),
    offerPricePerKilo: v.number(),
    kilos: v.number(),
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);

    // Verify user is a buyer
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") {
      throwAppError(invalidRoleError("buyer"));
    }

    // Rate limit check
    await checkRateLimit(ctx, args.buyerId, user.role, "make_buyer_offer", {
      inventoryId: args.inventoryId,
      offerPricePerKilo: args.offerPricePerKilo,
      kilos: args.kilos,
    });

    // Validate inventory exists and is available
    const inventory = await ctx.db.get(args.inventoryId);
    if (!inventory) {
      throw new Error("Inventory not found");
    }

    // Inventory must be in_storage (available for purchase)
    if (inventory.status !== "in_storage") {
      throw new Error("Inventory is not available for purchase");
    }

    // Validate kilos
    if (args.kilos <= 0 || args.kilos > inventory.totalKilos) {
      throw new Error("Invalid kilos requested");
    }

    // Validate price
    if (args.offerPricePerKilo <= 0) {
      throwAppError(invalidAmountError());
    }

    // Check if there's already an active negotiation for this inventory and buyer
    const existingNegotiation = await ctx.db
      .query("traderBuyerNegotiations")
      .withIndex("by_buyer_status", (q) => 
        q.eq("buyerId", args.buyerId).eq("status", "pending")
      )
      .filter((q) => q.eq(q.field("inventoryId"), args.inventoryId))
      .first();

    if (existingNegotiation) {
      throw new Error("You already have a pending offer on this inventory");
    }

    // Trader doesn't set an initial price - buyer makes the first offer
    // Trader will see buyer's offer and can accept/reject/counter
    // For now, set traderPricePerKilo to 0 (not set) - trader will counter if needed
    const traderPricePerKilo = 0; // Trader hasn't set a price yet, waiting for buyer offer

    // Generate negotiation UTID
    const negotiationUtid = generateUTID(user.role);

    // Create negotiation - buyer makes first offer
    const negotiationId = await ctx.db.insert("traderBuyerNegotiations", {
      inventoryId: args.inventoryId,
      traderId: inventory.traderId,
      buyerId: args.buyerId,
      status: "pending",
      traderPricePerKilo: traderPricePerKilo, // 0 means trader hasn't set price yet
      buyerOfferPricePerKilo: args.offerPricePerKilo,
      currentPricePerKilo: args.offerPricePerKilo, // Start with buyer's offer
      kilos: args.kilos,
      createdAt: getUgandaTime(),
      lastUpdatedAt: getUgandaTime(),
      expiresAt: getUgandaTime() + (24 * 60 * 60 * 1000), // 24 hours expiration
      negotiationUtid: negotiationUtid,
    });

    return {
      negotiationId,
      negotiationUtid,
      message: "Offer made successfully. Waiting for trader's response.",
    };
  },
});

/**
 * Accept buyer offer (trader only)
 * 
 * Trader accepts the buyer's offer. After acceptance, buyer can proceed to purchase.
 */
export const acceptBuyerOffer = mutation({
  args: {
    traderId: v.id("users"),
    negotiationId: v.id("traderBuyerNegotiations"),
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);

    // Verify user is a trader
    const user = await ctx.db.get(args.traderId);
    if (!user || !["trader", "transporter"].includes(user.role)) {
      throwAppError(invalidRoleError("trader"));
    }

    // Get negotiation
    const negotiation = await ctx.db.get(args.negotiationId);
    if (!negotiation) {
      throw new Error("Negotiation not found");
    }

    // Verify trader owns this negotiation
    if (negotiation.traderId !== args.traderId) {
      throw new Error("You can only accept offers on your own inventory");
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
      message: "Offer accepted. Buyer can now proceed to purchase.",
    };
  },
});

/**
 * Reject buyer offer (trader only)
 */
export const rejectBuyerOffer = mutation({
  args: {
    traderId: v.id("users"),
    negotiationId: v.id("traderBuyerNegotiations"),
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);

    // Verify user is a trader
    const user = await ctx.db.get(args.traderId);
    if (!user || !["trader", "transporter"].includes(user.role)) {
      throwAppError(invalidRoleError("trader"));
    }

    // Get negotiation
    const negotiation = await ctx.db.get(args.negotiationId);
    if (!negotiation) {
      throw new Error("Negotiation not found");
    }

    // Verify trader owns this negotiation
    if (negotiation.traderId !== args.traderId) {
      throw new Error("You can only reject offers on your own inventory");
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

    return {
      negotiationId: args.negotiationId,
      message: "Offer rejected.",
    };
  },
});

/**
 * Counter-offer (trader only)
 * 
 * Trader makes a counter-offer with a new price.
 */
export const counterBuyerOffer = mutation({
  args: {
    traderId: v.id("users"),
    negotiationId: v.id("traderBuyerNegotiations"),
    counterPricePerKilo: v.number(), // Trader's counter-offer price
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);

    // Verify user is a trader
    const user = await ctx.db.get(args.traderId);
    if (!user || !["trader", "transporter"].includes(user.role)) {
      throwAppError(invalidRoleError("trader"));
    }

    // Get negotiation
    const negotiation = await ctx.db.get(args.negotiationId);
    if (!negotiation) {
      throw new Error("Negotiation not found");
    }

    // Verify trader owns this negotiation
    if (negotiation.traderId !== args.traderId) {
      throw new Error("You can only counter-offer on your own inventory");
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
      message: "Counter-offer made. Waiting for buyer's response.",
    };
  },
});

/**
 * Accept counter-offer (buyer only)
 * 
 * Buyer accepts trader's counter-offer. After acceptance, buyer can proceed to purchase.
 */
export const acceptTraderCounterOffer = mutation({
  args: {
    buyerId: v.id("users"),
    negotiationId: v.id("traderBuyerNegotiations"),
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);

    // Verify user is a buyer
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") {
      throwAppError(invalidRoleError("buyer"));
    }

    // Get negotiation
    const negotiation = await ctx.db.get(args.negotiationId);
    if (!negotiation) {
      throw new Error("Negotiation not found");
    }

    // Verify buyer owns this negotiation
    if (negotiation.buyerId !== args.buyerId) {
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
      message: "Counter-offer accepted. You can now proceed to purchase.",
    };
  },
});

/**
 * Get buy-offers for a trader
 * 
 * Returns all pending and countered offers from buyers on trader's inventory.
 */
export const getTraderBuyOffers = query({
  args: {
    traderId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a trader
    const user = await ctx.db.get(args.traderId);
    if (!user || !["trader", "transporter"].includes(user.role)) {
      throw new Error("User is not a trader");
    }

    // Get all negotiations for this trader with pending, countered, or accepted status
    // (accepted means buyer can purchase, but trader might want to see it)
    const allNegotiations = await ctx.db
      .query("traderBuyerNegotiations")
      .withIndex("by_trader", (q) => q.eq("traderId", args.traderId))
      .filter((q) => 
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "countered"),
          q.eq(q.field("status"), "accepted")
        )
      )
      .collect();

    // Enrich with inventory and buyer information
    const enriched = await Promise.all(
      allNegotiations.map(async (neg) => {
        const inventory = await ctx.db.get(neg.inventoryId);
        const buyer = await ctx.db.get(neg.buyerId);

        return {
          negotiationId: neg._id,
          negotiationUtid: neg.negotiationUtid,
          inventoryId: neg.inventoryId,
          produceType: inventory?.produceType || null,
          totalKilos: inventory?.totalKilos || 0,
          buyerAlias: buyer?.alias || null,
          buyerOfferPricePerKilo: neg.buyerOfferPricePerKilo,
          currentPricePerKilo: neg.currentPricePerKilo,
          traderPricePerKilo: neg.traderPricePerKilo,
          kilos: neg.kilos,
          status: neg.status,
          createdAt: neg.createdAt,
          lastUpdatedAt: neg.lastUpdatedAt,
        };
      })
    );

    // Sort by most recent first
    enriched.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);

    return {
      negotiations: enriched,
      total: enriched.length,
    };
  },
});
