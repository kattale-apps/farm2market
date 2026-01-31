/**
 * Scheduled Functions
 * 
 * Automatic background tasks that run on a schedule.
 * 
 * - Expired UTID cleanup: Automatically expires UTIDs that are overdue by 1 hour
 *   and unlocks trader capital
 */

import { internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { generateUTID, getUgandaTime } from "./utils";

/**
 * Scheduled function to check for expired UTIDs and unlock trader capital
 * 
 * This function runs automatically every 5 minutes via cron job.
 * It automatically:
 * 1. Checks for UTIDs that are overdue by 1 hour
 * 2. Marks UTIDs as expired (cancelled)
 * 3. Unlocks trader capital (returns to available balance)
 * 4. Updates unit status to available
 */
export const checkExpiredUTIDs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = getUgandaTime();
    const expirationThreshold = 60 * 60 * 1000; // 1 hour in milliseconds

    // Get all locked units
    const lockedUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_status", (q) => q.eq("status", "locked"))
      .collect();

    const expiredUnits = lockedUnits.filter((unit) => {
      if (!unit.deliveryDeadline) return false;
      if (unit.deliveryStatus === "delivered") return false; // Already delivered
      if (unit.archived) return false; // Already archived
      
      // Check if deadline has passed by more than 1 hour
      const timeSinceDeadline = now - unit.deliveryDeadline;
      return timeSinceDeadline >= expirationThreshold;
    });

    const results = {
      expired: [] as any[],
      errors: [] as string[],
    };

    // Process each expired unit
    for (const unit of expiredUnits) {
      try {
        if (!unit.lockUtid || !unit.lockedBy) {
          continue; // Skip units without proper lock information
        }

        // Get listing to calculate price
        const listing = await ctx.db.get(unit.listingId);
        if (!listing) {
          results.errors.push(`Listing not found for unit ${unit._id}`);
          continue;
        }

        // Get the actual price from the wallet ledger entry (this is the amount that was locked)
        const walletEntry = await ctx.db
          .query("walletLedger")
          .withIndex("by_utid", (q: any) => q.eq("utid", unit.lockUtid))
          .first();

        if (!walletEntry || walletEntry.type !== "capital_lock") {
          results.errors.push(`Wallet entry not found for UTID ${unit.lockUtid}`);
          continue;
        }

        const unitPrice = walletEntry.amount; // This is the actual amount that was locked

        const traderId = unit.lockedBy;

        // Generate UTID for expiration
        const expirationUtid = generateUTID("system");

        // ATOMIC OPERATION: Unlock unit and reverse wallet entry
        // Step 1: Mark unit as cancelled and archived (instead of available)
        await ctx.db.patch(unit._id, {
          status: "cancelled", // Unit is removed from circulation
          deliveryStatus: "cancelled", // Mark as cancelled due to expiration
          archived: true, // Mark as archived to read-only
          archivedAt: now,
          activeNegotiationId: undefined,
          // We keep lockedBy/lockUtid for audit trail history
        });

        // Step 2: Reverse wallet ledger entry (unlock capital)
        const walletEntries = await ctx.db
          .query("walletLedger")
          .withIndex("by_user", (q: any) => q.eq("userId", traderId))
          .order("desc")
          .collect();

        const currentBalance = walletEntries[0]?.balanceAfter || 0;
        const balanceAfter = currentBalance + unitPrice;

        await ctx.db.insert("walletLedger", {
          userId: traderId,
          utid: expirationUtid,
          type: "capital_unlock",
          amount: unitPrice,
          balanceAfter,
          timestamp: now,
          metadata: {
            unitId: unit._id,
            listingId: listing._id,
            reversedLockUtid: unit.lockUtid,
            reason: "Automatic expiration: UTID expired 1 hour after delivery deadline",
            expirationTime: now,
          },
        });

        // Step 3: Update listing status if needed
        const allUnits = await ctx.db
          .query("listingUnits")
          .withIndex("by_listing", (q: any) => q.eq("listingId", listing._id))
          .collect();

        const availableCount = allUnits.filter((u: any) => u.status === "available").length;
        const lockedCount = allUnits.filter((u: any) => u.status === "locked").length;
        const deliveredCount = allUnits.filter((u: any) => u.status === "delivered").length;

        if (availableCount > 0 && lockedCount === 0) {
          await ctx.db.patch(listing._id, {
            status: "active",
          });
        } else if (lockedCount > 0) {
          await ctx.db.patch(listing._id, {
            status: "partially_locked",
          });
        } else if (availableCount === 0 && lockedCount === 0 && deliveredCount === 0) {
          // If all units are cancelled (and none delivered), cancel the listing
          await ctx.db.patch(listing._id, {
            status: "cancelled",
          });
        }

        results.expired.push({
          unitId: unit._id,
          lockUtid: unit.lockUtid,
          expirationUtid,
          traderId,
          refundAmount: unitPrice,
          balanceAfter,
        });
      } catch (error: any) {
        results.errors.push(`Failed to expire unit ${unit._id}: ${error.message}`);
      }
    }

    return results;
  },
});
