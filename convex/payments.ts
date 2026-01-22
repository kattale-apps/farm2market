/**
 * Pay-to-Lock System (CRITICAL)
 * 
 * - Unit locking and wallet debit must be atomic
 * - First successful payment wins
 * - Race conditions must be impossible
 * - Partial state changes are forbidden
 * - Spend cap enforcement happens BEFORE payment
 */

import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { generateUTID, calculateTraderExposureInternal, getUgandaTime, getTraderCommissionPercentage } from "./utils";
import { calculateDeliverySLA } from "./utils";
import { MAX_TRADER_EXPOSURE_UGX, LISTING_UNIT_SIZE_KG } from "./constants";
import { checkPilotMode } from "./pilotMode";
import { checkRateLimit } from "./rateLimits";
import { ensureTraderCapital } from "./wallet";
import {
  spendCapExceededError,
  insufficientCapitalError,
  unitNotAvailableError,
  listingNotFoundError,
  unitNotFoundError,
  invalidRoleError,
  throwAppError,
} from "./errors";

/**
 * Internal helper function to lock a unit (shared logic)
 */
import { Id } from "./_generated/dataModel";

async function lockUnitInternal(
  ctx: any,
  traderId: Id<"users">,
  unitId: Id<"listingUnits">
) {
  // Verify user is a trader
  const user = await ctx.db.get(traderId);
  if (!user || user.role !== "trader") {
    throw new Error("User is not a trader");
  }

  // Ensure trader has 1,000,000 UGX capital for demo purchases
  // This ensures traders can always make purchases in pilot mode
  await ensureTraderCapital(ctx, traderId);

  // Rate limit check
  await checkRateLimit(ctx, traderId, user.role, "lock_unit", {
    unitId: unitId,
  });

  // Get unit and verify it's available
  const unit = await ctx.db.get(unitId);
  if (!unit) {
    throw new Error("Unit not found");
  }
  if (unit.status !== "available") {
    throw new Error("Unit is not available");
  }

  // Check if unit has an accepted negotiation for this trader
  if (!unit.activeNegotiationId) {
    throw new Error("No active negotiation found. Please make an offer first.");
  }

  const negotiation = await ctx.db.get(unit.activeNegotiationId);
  if (!negotiation) {
    throw new Error("Negotiation not found");
  }

  // Verify negotiation is accepted and belongs to this trader
  if (negotiation.status !== "accepted") {
    throw new Error(`Cannot lock unit. Negotiation status is: ${negotiation.status}. Please wait for farmer to accept your offer.`);
  }

  if (negotiation.traderId !== traderId) {
    throw new Error("This negotiation belongs to another trader. You cannot lock this unit.");
  }

  // Get listing to calculate price
  const listing = await ctx.db.get(unit.listingId);
  if (!listing) {
    throw new Error("Listing not found");
  }

  // Use negotiated price from accepted negotiation
  const unitSize = listing.unitSize || LISTING_UNIT_SIZE_KG;
  const unitPrice = negotiation.currentPricePerKilo * unitSize;

  // Calculate trader commission (if enabled)
  const commissionPercentage = await getTraderCommissionPercentage({ db: ctx.db });
  const commission = commissionPercentage > 0 ? (unitPrice * commissionPercentage) / 100 : 0;
  const totalAmount = unitPrice + commission; // Total amount to deduct (purchase + commission)

  // Spend cap enforcement (commission counts toward exposure)
  const exposure = await calculateTraderExposureInternal(ctx, traderId);
  const newExposure = exposure.totalExposure + totalAmount; // Include commission in exposure

  if (newExposure > MAX_TRADER_EXPOSURE_UGX) {
    throwAppError(spendCapExceededError());
  }

  // Get current wallet balance
  const walletEntries = await ctx.db
    .query("walletLedger")
    .withIndex("by_user", (q: any) => q.eq("userId", traderId))
    .order("desc")
    .first();

  const currentBalance = walletEntries?.balanceAfter || 0;
  const availableCapital = currentBalance - exposure.lockedCapital;

  // Verify wallet has sufficient funds (purchase + commission)
  if (availableCapital < totalAmount) {
    throwAppError(insufficientCapitalError());
  }

  // Generate UTID
  const utid = generateUTID(user.role);

  // ATOMIC OPERATION: Lock capital, deduct commission, and lock unit together
  let balanceAfter = currentBalance - unitPrice; // First deduct purchase price
  
  // Deduct purchase price
  await ctx.db.insert("walletLedger", {
    userId: traderId,
    utid,
    type: "capital_lock",
    amount: unitPrice,
    balanceAfter,
    timestamp: getUgandaTime(),
    metadata: {
      unitId: unitId,
      listingId: listing._id,
      produceType: listing.produceType,
      commissionPercentage,
      commission,
    },
  });

  // Deduct commission if applicable (atomic with purchase)
  if (commission > 0) {
    balanceAfter = balanceAfter - commission;
    await ctx.db.insert("walletLedger", {
      userId: traderId,
      utid: `${utid}-COMM`, // Commission UTID (linked to main UTID)
      type: "trader_commission_deduction",
      amount: commission,
      balanceAfter,
      timestamp: getUgandaTime(),
      metadata: {
        mainUtid: utid,
        unitId: unitId,
        listingId: listing._id,
        commissionPercentage,
        purchaseAmount: unitPrice,
      },
    });
  }

  // Lock the unit
  const paymentTime = getUgandaTime();
  const deliveryDeadline = calculateDeliverySLA(paymentTime);
  
  await ctx.db.patch(unitId, {
    status: "locked",
    lockedBy: traderId,
    lockedAt: paymentTime,
    lockUtid: utid,
    deliveryDeadline: deliveryDeadline,
    deliveryStatus: "pending",
    activeNegotiationId: undefined, // Clear negotiation after locking
  });

  // Update listing status if needed
  const allUnits = await ctx.db
    .query("listingUnits")
    .withIndex("by_listing", (q: any) => q.eq("listingId", listing._id))
    .collect();

  const availableCount = allUnits.filter((u: any) => u.status === "available").length;
  const lockedCount = allUnits.filter((u: any) => u.status === "locked").length;

  if (availableCount === 0 && lockedCount > 0) {
    await ctx.db.patch(listing._id, {
      status: "fully_locked",
      deliverySLA: calculateDeliverySLA(Date.now()),
    });
  } else if (lockedCount > 0) {
    await ctx.db.patch(listing._id, {
      status: "partially_locked",
      deliverySLA: calculateDeliverySLA(Date.now()),
    });
  }

  return {
    utid,
    unitId: unitId,
    listingId: listing._id,
    unitPrice,
    commission,
    commissionPercentage,
    totalAmount,
    balanceAfter,
    newExposure,
  };
}

/**
 * Lock a unit by payment (trader only)
 * 
 * ATOMIC OPERATION:
 * 1. Verify spend cap (enforcement BEFORE payment)
 * 2. Check unit is available
 * 3. Lock capital in wallet
 * 4. Lock unit
 * 5. Update listing status if needed
 * 
 * If any step fails, entire operation rolls back
 */
export const lockUnit = mutation({
  args: {
    traderId: v.id("users"),
    unitId: v.id("listingUnits"),
  },
  handler: async (ctx, args) => {
    // ============================================================
    // PILOT MODE CHECK (MUST BE FIRST - BEFORE ANY OPERATIONS)
    // ============================================================
    // This mutation moves money (locks capital and unit), so it must be blocked
    // during pilot mode. The check happens FIRST to fail fast.
    await checkPilotMode(ctx);

    return await lockUnitInternal(ctx, args.traderId, args.unitId);
  },
});

/**
 * Lock a unit by listing ID (finds first available unit)
 * Convenience mutation for UI - finds first available unit and locks it
 */
export const lockUnitByListing = mutation({
  args: {
    traderId: v.id("users"),
    listingId: v.id("listings"),
  },
  handler: async (ctx, args) => {
    // ============================================================
    // PILOT MODE CHECK (MUST BE FIRST - BEFORE ANY OPERATIONS)
    // ============================================================
    // This mutation moves money (locks capital and unit), so it must be blocked
    // during pilot mode. The check happens FIRST to fail fast.
    await checkPilotMode(ctx);

    // Get listing
    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }

    // Find first available unit
    const units = await ctx.db
      .query("listingUnits")
      .withIndex("by_listing", (q: any) => q.eq("listingId", args.listingId))
      .collect();

    const availableUnit = units.find((u: any) => u.status === "available");
    if (!availableUnit) {
      throw new Error("No available units in this listing");
    }

    // Use the shared lock logic
    return await lockUnitInternal(ctx, args.traderId, availableUnit._id);
  },
});
