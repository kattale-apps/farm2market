/**
 * Pay-to-Lock (older screens)
 *
 * Locking a farmer's lot is now a lot order (convex/lotOrders.ts): the
 * buyer commits the seller's share of the price into escrow and the rest
 * follows the seller's steps. These mutations keep their names and return
 * shape so screens and cached clients that still call them keep working.
 *
 * - Locking and the wallet debit are one transaction; the first commit wins.
 * - Spend cap and wallet checks happen before any money moves.
 */

import { v } from "convex/values";
import { mutation, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { checkPilotMode } from "./pilotMode";
import { commitLots } from "./lotOrders";

async function lockUnitInternal(ctx: MutationCtx, traderId: Id<"users">, unitId: Id<"listingUnits">) {
  const unit = await ctx.db.get(unitId);
  if (!unit) throw new Error("Unit not found");
  const result = await commitLots(ctx, traderId, [unitId]);
  const order = result.orders[0];
  return {
    utid: order.utid,
    unitId,
    listingId: unit.listingId,
    orderId: order.orderId,
    unitPrice: order.committed, // What was committed now: the seller's % of the lot price
    totalAmount: order.committed + result.commission,
    lotTotal: order.totalAmount,
    commitPercent: result.commitPercent,
    commission: result.commission,
    commissionPercentage: result.commissionPercentage,
    balanceAfter: result.balanceAfter,
  };
}

/**
 * Lock a lot by committing into escrow (exporters and other verified buyers).
 * Kept for older screens; new screens call lotOrders.commit.
 */
export const lockUnit = mutation({
  args: {
    traderId: v.id("users"),
    unitId: v.id("listingUnits"),
  },
  handler: async (ctx, args) => {
    // This mutation moves money, so it is blocked during pilot mode.
    await checkPilotMode(ctx);
    return await lockUnitInternal(ctx, args.traderId, args.unitId);
  },
});

/**
 * Lock the first available lot of a listing.
 * Convenience mutation for UI.
 */
export const lockUnitByListing = mutation({
  args: {
    traderId: v.id("users"),
    listingId: v.id("listings"),
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);
    const units = await ctx.db
      .query("listingUnits")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .collect();
    const availableUnit = units.find((u) => u.status === "available");
    if (!availableUnit) {
      throw new Error("No available units in this listing");
    }
    return await lockUnitInternal(ctx, args.traderId, availableUnit._id);
  },
});
