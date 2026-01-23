/**
 * Admin Authority
 * 
 * - Admin decisions are final in v1.x
 * - No automated dispute resolution
 * - Admin actions must be logged with UTID, reason, timestamp
 * - Admin controls purchase windows
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { generateUTID, getStorageFeeRate, getBuyerServiceFeePercentage, getTraderCommissionPercentage, getUgandaTime } from "./utils";
import { MAX_TRADER_EXPOSURE_UGX, DEFAULT_STORAGE_FEE_RATE_KG_PER_DAY, DEFAULT_BUYER_SERVICE_FEE_PERCENTAGE } from "./constants";
import { Id } from "./_generated/dataModel";

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
 * Check if admin user is a super admin
 * - Super admin if adminLevel === "super" or adminLevel === undefined (backward compatibility)
 */
function isSuperAdmin(user: { adminLevel?: "super" | "junior" }): boolean {
  return user.adminLevel === "super" || user.adminLevel === undefined;
}

/**
 * Check if admin can access a specific storage location
 * - Super admins can access all locations
 * - Junior admins can only access locations in their allowedStorageLocationIds
 */
function canAdminAccessLocation(
  adminUser: { adminLevel?: "super" | "junior"; allowedStorageLocationIds?: Id<"storageLocations">[] },
  locationId: Id<"storageLocations">
): boolean {
  // Super admins can access all locations
  if (isSuperAdmin(adminUser)) {
    return true;
  }
  
  // Junior admins can only access assigned locations
  if (adminUser.adminLevel === "junior") {
    return adminUser.allowedStorageLocationIds?.includes(locationId) ?? false;
  }
  
  // Default: deny access (should not happen for valid admin users)
  return false;
}

/**
 * Log an admin action
 */
async function logAdminAction(
  ctx: any,
  adminId: string,
  actionType: string,
  reason: string,
  targetUtid?: string,
  metadata?: any
) {
  const utid = generateUTID("admin");
  await ctx.db.insert("adminActions", {
    adminId,
    actionType,
    utid,
    reason,
    targetUtid,
    metadata,
    timestamp: getUgandaTime(),
  });
  return utid;
}

/**
 * Open purchase window (admin only)
 * Buyers can only purchase during open windows
 */
export const openPurchaseWindow = mutation({
  args: {
    adminId: v.id("users"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const adminUser = await verifyAdmin(ctx, args.adminId);
    
    // Only super admins can open purchase windows
    if (!(await isSuperAdmin(adminUser))) {
      throw new Error("Only super admins can open purchase windows");
    }

    // Close any existing open window
    const existing = await ctx.db
      .query("purchaseWindows")
      .withIndex("by_status", (q: any) => q.eq("isOpen", true))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        isOpen: false,
        closedAt: Date.now(),
      });
    }

    // Open new window
    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "open_purchase_window",
      args.reason
    );

    await ctx.db.insert("purchaseWindows", {
      isOpen: true,
      openedBy: args.adminId,
      openedAt: getUgandaTime(),
      reason: args.reason,
      utid,
    });

    return { utid, openedAt: getUgandaTime() };
  },
});

/**
 * Close purchase window (admin only)
 */
export const closePurchaseWindow = mutation({
  args: {
    adminId: v.id("users"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const adminUser = await verifyAdmin(ctx, args.adminId);
    
    // Only super admins can close purchase windows
    if (!(await isSuperAdmin(adminUser))) {
      throw new Error("Only super admins can close purchase windows");
    }

    const existing = await ctx.db
      .query("purchaseWindows")
      .withIndex("by_status", (q: any) => q.eq("isOpen", true))
      .first();

    if (!existing) {
      throw new Error("No open purchase window to close");
    }

    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "close_purchase_window",
      args.reason
    );

    await ctx.db.patch(existing._id, {
      isOpen: false,
      closedAt: Date.now(),
    });

    return { utid, closedAt: getUgandaTime() };
  },
});

/**
 * Get purchase window status (admin only)
 * Admin can check purchase window status for control purposes
 */
export const getPurchaseWindowStatus = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    // Get current purchase window (if open)
    const purchaseWindow = await ctx.db
      .query("purchaseWindows")
      .withIndex("by_status", (q: any) => q.eq("isOpen", true))
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

    // Get admin alias
    const admin = await ctx.db.get(purchaseWindow.openedBy);

    return {
      isOpen: purchaseWindow.isOpen,
      openedAt: purchaseWindow.openedAt,
      openedBy: purchaseWindow.openedBy,
      openedByAlias: admin?.alias || null,
      utid: purchaseWindow.utid,
      closedAt: purchaseWindow.closedAt || null,
      reason: purchaseWindow.reason || null,
    };
  },
});

/**
 * Verify delivery (admin only)
 * Admin marks delivery as delivered, late, or cancelled
 */
export const verifyDelivery = mutation({
  args: {
    adminId: v.id("users"),
    unitId: v.id("listingUnits"),
    outcome: v.union(v.literal("delivered"), v.literal("late"), v.literal("cancelled")),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    const unit = await ctx.db.get(args.unitId);
    if (!unit) {
      throw new Error("Unit not found");
    }

    if (unit.status !== "locked") {
      throw new Error("Unit is not locked");
    }

    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "verify_delivery",
      args.reason,
      unit.lockUtid || undefined,
      {
        unitId: args.unitId,
        outcome: args.outcome,
        previousStatus: unit.deliveryStatus,
      }
    );

    await ctx.db.patch(args.unitId, {
      deliveryStatus: args.outcome,
    });

    return { utid, unitId: args.unitId, outcome: args.outcome };
  },
});

/**
 * Mark farmer UTID as delivered (admin only)
 * Admin can mark a lockUtid (farmer's delivery UTID) as delivered
 * This updates the deliveryStatus of the associated unit(s)
 */
export const markFarmerUTIDAsDelivered = mutation({
  args: {
    adminId: v.id("users"),
    lockUtid: v.string(), // The lockUtid from the farmer's delivery
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    // Find all units with this lockUtid using the index
    const allUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_lock_utid", (q: any) => q.eq("lockUtid", args.lockUtid))
      .collect();

    const unitsWithUtid = allUnits.filter((unit) => unit.status === "locked");

    if (unitsWithUtid.length === 0) {
      throw new Error(`No locked units found with UTID: ${args.lockUtid}`);
    }

    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "mark_farmer_utid_delivered",
      args.reason,
      args.lockUtid,
      {
        unitsUpdated: unitsWithUtid.length,
        unitIds: unitsWithUtid.map((u) => u._id),
      }
    );

    // Update all units with this lockUtid to delivered status
    for (const unit of unitsWithUtid) {
      await ctx.db.patch(unit._id, {
        deliveryStatus: "delivered",
      });
    }

    return {
      utid,
      lockUtid: args.lockUtid,
      unitsUpdated: unitsWithUtid.length,
      unitIds: unitsWithUtid.map((u) => u._id),
    };
  },
});

/**
 * Admin demo deposit to trader or buyer
 * Adds demo funds to a user's wallet for learning/sandbox
 */
export const depositDemoFunds = mutation({
  args: {
    adminId: v.id("users"),
    targetUserId: v.id("users"),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    const user = await ctx.db.get(args.targetUserId);
    if (!user || (user.role !== "trader" && user.role !== "buyer")) {
      throw new Error("Target user must be a trader or buyer");
    }

    // Get current balance
    const latestEntry = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", args.targetUserId))
      .order("desc")
      .first();

    const currentBalance = latestEntry?.balanceAfter || 0;
    const balanceAfter = currentBalance + args.amount;
    const utid = generateUTID("admin");

    await ctx.db.insert("walletLedger", {
      userId: args.targetUserId,
      utid,
      type: "capital_deposit",
      amount: args.amount,
      balanceAfter,
      timestamp: getUgandaTime(),
      metadata: {
        source: "admin_demo_deposit",
        reason: args.reason,
        adminId: args.adminId,
        role: user.role,
      },
    });

    const actionUtid = await logAdminAction(
      ctx,
      args.adminId,
      "demo_deposit",
      args.reason,
      utid,
      {
        targetUserId: args.targetUserId,
        role: user.role,
        amount: args.amount,
        previousBalance: currentBalance,
        balanceAfter,
      }
    );

    return {
      utid,
      actionUtid,
      targetUserId: args.targetUserId,
      role: user.role,
      amount: args.amount,
      balanceAfter,
      previousBalance: currentBalance,
    };
  },
});

/**
 * Confirm delivery to storage by UTID (admin only)
 * Admin selects a UTID and confirms delivery, creating trader inventory
 */
export const confirmDeliveryToStorageByUTID = mutation({
  args: {
    adminId: v.id("users"),
    lockUtid: v.string(), // The UTID from the lock transaction
    reason: v.string(),
    deliveryPhotos: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const adminUser = await verifyAdmin(ctx, args.adminId);

    // Find all units locked with this UTID
    const allUnits = await ctx.db.query("listingUnits").collect();
    const lockedUnits = allUnits.filter(
      (u) => u.status === "locked" && u.lockUtid === args.lockUtid
    );

    if (lockedUnits.length === 0) {
      throw new Error(`No locked units found with UTID: ${args.lockUtid}`);
    }

    // Verify all units have been confirmed by farmer (deliveryStatus === "farmer_confirmed")
    const notConfirmedUnits = lockedUnits.filter(
      (u) => u.deliveryStatus !== "farmer_confirmed"
    );
    if (notConfirmedUnits.length > 0) {
      const statuses = notConfirmedUnits.map((u) => u.deliveryStatus || "pending").join(", ");
      throw new Error(
        `Cannot confirm delivery: ${notConfirmedUnits.length} unit(s) have not been confirmed by farmer. ` +
        `Current status(es): ${statuses}. Farmers must self-confirm delivery before admin can confirm.`
      );
    }

    // If admin is junior admin, verify they have access to all locations in this UTID
    if (!isSuperAdmin(adminUser)) {
      // Check each unit's listing location
      for (const unit of lockedUnits) {
        const listing = await ctx.db.get(unit.listingId);
        if (!listing || !listing.storageLocationId) {
          continue; // Skip if listing or location missing (will be handled later)
        }
        
        // Check if junior admin can access this location
        if (!canAdminAccessLocation(adminUser, listing.storageLocationId)) {
          const location = await ctx.db.get(listing.storageLocationId);
          const locationName = location ? location.districtName : listing.storageLocationId;
          throw new Error(
            `You do not have permission to confirm deliveries for location: ${locationName}. ` +
            `This delivery is outside your assigned storage locations.`
          );
        }
      }
    }

    // Group units by trader, produce type, and storage location
    // Also preserve quality rating and unit price (actual purchase price after negotiation)
    const unitsByTraderProduceLocation = new Map<string, { 
      traderId: Id<"users">; 
      produceType: string; 
      storageLocationId: Id<"storageLocations">;
      qualityRating?: string;
      unitPrice: number; // Actual purchase price per kilo
      units: typeof lockedUnits; 
      listingId: Id<"listings">;
    }>();

    const errors: string[] = [];

    for (const unit of lockedUnits) {
      if (!unit.lockedBy) continue;

      const listing = await ctx.db.get(unit.listingId);
      if (!listing) continue;

      // Skip if listing doesn't have storageLocationId (old data)
      if (!listing.storageLocationId) {
        errors.push(`Listing ${listing.utid} is missing storageLocationId. Please update the listing.`);
        continue;
      }

      // Get actual purchase price - check if there was a negotiation
      let actualPricePerKilo = listing.pricePerKilo;
      if (unit.activeNegotiationId) {
        const negotiation = await ctx.db.get(unit.activeNegotiationId);
        if (negotiation && negotiation.status === "accepted" && negotiation.currentPricePerKilo) {
          actualPricePerKilo = negotiation.currentPricePerKilo;
        }
      }

      const key = `${unit.lockedBy}_${listing.produceType}_${listing.storageLocationId}`;
      if (!unitsByTraderProduceLocation.has(key)) {
        unitsByTraderProduceLocation.set(key, {
          traderId: unit.lockedBy,
          produceType: listing.produceType,
          storageLocationId: listing.storageLocationId,
          qualityRating: listing.qualityRating,
          unitPrice: actualPricePerKilo,
          units: [],
          listingId: listing._id,
        });
      }
      unitsByTraderProduceLocation.get(key)!.units.push(unit);
    }

    const results = {
      inventoryCreated: [] as any[],
      unitsUpdated: 0,
      errors: [] as string[],
    };

    const deliveryPhotos = args.deliveryPhotos
      ? args.deliveryPhotos.map((photo) => photo.trim()).filter(Boolean)
      : undefined;

    // Create inventory for each trader/produce/location combination
    for (const [key, group] of unitsByTraderProduceLocation.entries()) {
      try {
        // Calculate total kilos
        let totalKilos = 0;
        for (const unit of group.units) {
          const listing = await ctx.db.get(unit.listingId);
          if (listing) {
            totalKilos += listing.unitSize || 10;
          }
        }

        // Generate delivery UTID (this is when payment actually goes through - from pending to paid)
        const deliveryUtid = generateUTID("admin");

        // Create trader inventory - preserve location, quality, and actual negotiated price
        // This UTID represents the delivery confirmation, showing the actual price paid
        const inventoryId = await ctx.db.insert("traderInventory", {
          traderId: group.traderId,
          listingUnitIds: group.units.map((u) => u._id),
          totalKilos,
          blockSize: 100, // Target block size
          produceType: group.produceType,
          storageLocationId: group.storageLocationId,
          qualityRating: group.qualityRating,
          unitPrice: group.unitPrice, // Actual negotiated price per kilo (payment confirmed on delivery)
          acquiredAt: getUgandaTime(), // Timestamp when received at storage (delivery confirmed)
          storageStartTime: getUgandaTime(), // When storage fees start
          status: "in_storage",
          utid: deliveryUtid, // Delivery UTID - shows actual price paid (payment moves from pending to paid)
          is100kgBlock: false, // Will be set to true when 100kg block is created
        });

        // Update units to delivered status
        for (const unit of group.units) {
          const patch: any = { deliveryStatus: "delivered" };
          if (deliveryPhotos && deliveryPhotos.length > 0 && (!unit.deliveryPhotos || unit.deliveryPhotos.length === 0)) {
            patch.deliveryPhotos = deliveryPhotos;
          }
          await ctx.db.patch(unit._id, {
            ...patch,
          });
          results.unitsUpdated++;
        }

        results.inventoryCreated.push({
          inventoryId,
          inventoryUtid: deliveryUtid, // Delivery UTID
          traderId: group.traderId,
          produceType: group.produceType,
          totalKilos,
          unitsCount: group.units.length,
          actualPricePerKilo: group.unitPrice, // Actual price paid (shown in delivery UTID)
        });
      } catch (error: any) {
        results.errors.push(`Failed to create inventory for ${key}: ${error.message}`);
      }
    }

    // After all inventory is created, check and create 100kg blocks for each unique trader
    const uniqueTraders = new Set(results.inventoryCreated.map((r: any) => r.traderId));
    for (const traderId of uniqueTraders) {
      try {
        // Call the internal mutation to check and create 100kg blocks
        await ctx.runMutation(internal.inventoryBlocks.checkAndCreate100kgBlocks, {
          traderId: traderId as Id<"users">,
        });
      } catch (blockError: any) {
        // Log error but don't fail the delivery confirmation
        results.errors.push(`Failed to create 100kg blocks for trader ${traderId}: ${blockError.message}`);
      }
    }

    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "confirm_delivery_to_storage_by_utid",
      args.reason,
      args.lockUtid,
      {
        lockUtid: args.lockUtid,
        inventoryCreated: results.inventoryCreated.length,
        unitsUpdated: results.unitsUpdated,
        photoCount: deliveryPhotos?.length || 0,
      }
    );

    return { utid, ...results };
  },
});

/**
 * Reverse delivery failure (admin only)
 * Atomic operation to reverse failed deliveries
 */
export const reverseDeliveryFailure = mutation({
  args: {
    adminId: v.id("users"),
    unitId: v.id("listingUnits"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    const unit = await ctx.db.get(args.unitId);
    if (!unit) {
      throw new Error("Unit not found");
    }

    if (!unit.lockUtid) {
      throw new Error("Unit has no lock UTID");
    }

    const deliveryStatus = unit.deliveryStatus;
    if (deliveryStatus !== "late" && deliveryStatus !== "cancelled") {
      throw new Error("Unit must be late or cancelled to reverse");
    }

    const listing = await ctx.db.get(unit.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }

    const traderId = unit.lockedBy;
    if (!traderId) {
      throw new Error("Unit has no lockedBy trader");
    }

    // Calculate refund amount (use listing's unitSize)
    const unitSize = listing.unitSize || 10;
    const unitPrice = listing.pricePerKilo * unitSize;

    // Generate UTID for reversal
    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "reverse_delivery_failure",
      args.reason,
      unit.lockUtid,
      {
        unitId: args.unitId,
        unitPrice,
        deliveryStatus,
      }
    );

    // ATOMIC OPERATION: Unlock unit and reverse wallet entry
    // Step 1: Unlock the unit
    await ctx.db.patch(args.unitId, {
      status: "available",
      lockedBy: undefined,
      lockedAt: undefined,
      lockUtid: undefined,
      deliveryDeadline: undefined,
      deliveryStatus: undefined,
    });

    // Step 2: Reverse wallet ledger entry (unlock capital)
    const walletEntries = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", traderId))
      .order("desc")
      .first();

    const currentBalance = walletEntries?.balanceAfter || 0;
    const balanceAfter = currentBalance + unitPrice;

    await ctx.db.insert("walletLedger", {
      userId: traderId,
      utid,
      type: "capital_unlock",
      amount: unitPrice,
      balanceAfter,
      timestamp: getUgandaTime(),
      metadata: {
        unitId: args.unitId,
        listingId: listing._id,
        reversedLockUtid: unit.lockUtid,
        reason: args.reason,
      },
    });

    // Step 3: Update listing status if needed
    const allUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_listing", (q: any) => q.eq("listingId", listing._id))
      .collect();

    const availableCount = allUnits.filter((u: any) => u.status === "available").length;
    const lockedCount = allUnits.filter((u: any) => u.status === "locked").length;

    if (availableCount > 0 && lockedCount === 0) {
      await ctx.db.patch(listing._id, {
        status: "active",
      });
    } else if (lockedCount > 0) {
      await ctx.db.patch(listing._id, {
        status: "partially_locked",
      });
    }

    return {
      utid,
      unitId: args.unitId,
      refundAmount: unitPrice,
      balanceAfter,
    };
  },
});

/**
 * Reset all transactions (admin only)
 * 
 * ⚠️ DANGEROUS OPERATION - Use with extreme caution
 * 
 * This mutation resets the entire system state:
 * - Clears all wallet ledger entries
 * - Unlocks all locked units
 * - Resets all inventory
 * - Resets all buyer purchases
 * - Resets listing statuses to active
 * - Keeps users and system settings
 * 
 * All actions are logged with UTID and reason.
 */
export const resetAllTransactions = mutation({
  args: {
    adminId: v.id("users"),
    reason: v.string(), // Required reason for reset
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "reset_all_transactions",
      args.reason,
      undefined,
      {
        timestamp: getUgandaTime(),
        warning: "All transactions have been reset",
      }
    );

    const results = {
      walletLedgerEntriesDeleted: 0,
      tradersRestored: 0,
      unitsUnlocked: 0,
      inventoryDeleted: 0,
      buyerPurchasesDeleted: 0,
      listingsReset: 0,
      errors: [] as string[],
    };

    try {
      // 1. Delete all wallet ledger entries EXCEPT capital_deposit entries
      // Then restore 1,000,000 UGX capital deposit for each trader
      const walletEntries = await ctx.db.query("walletLedger").collect();
      
      // Get all traders first
      const traders = await ctx.db
        .query("users")
        .withIndex("by_role", (q: any) => q.eq("role", "trader"))
        .collect();
      
      // Delete all wallet entries (we'll restore capital deposits after)
      for (const entry of walletEntries) {
        try {
          await ctx.db.delete(entry._id);
          results.walletLedgerEntriesDeleted++;
        } catch (error: any) {
          results.errors.push(`Failed to delete wallet entry ${entry._id}: ${error.message}`);
        }
      }
      
      // Restore 1,000,000 UGX capital deposit for each trader
      const { MAX_TRADER_EXPOSURE_UGX } = await import("./constants");
      const { generateUTID } = await import("./utils");
      
      let tradersRestored = 0;
      for (const trader of traders) {
        try {
          const utid = generateUTID("admin");
          await ctx.db.insert("walletLedger", {
            userId: trader._id,
            utid,
            type: "capital_deposit",
            amount: MAX_TRADER_EXPOSURE_UGX, // 1,000,000 UGX
            balanceAfter: MAX_TRADER_EXPOSURE_UGX,
            timestamp: getUgandaTime(),
            metadata: {
              source: "admin_reset_restore",
              reason: args.reason,
              restored: true,
            },
          });
          tradersRestored++;
        } catch (error: any) {
          results.errors.push(`Failed to restore capital for trader ${trader.alias}: ${error.message}`);
        }
      }
      
      results.tradersRestored = tradersRestored;

      // 2. Unlock all locked units
      const lockedUnits = await ctx.db
        .query("listingUnits")
        .withIndex("by_status", (q: any) => q.eq("status", "locked"))
        .collect();
      
      for (const unit of lockedUnits) {
        try {
          await ctx.db.patch(unit._id, {
            status: "available",
            lockedBy: undefined,
            lockedAt: undefined,
            lockUtid: undefined,
            deliveryDeadline: undefined,
            deliveryStatus: undefined,
          });
          results.unitsUnlocked++;
        } catch (error: any) {
          results.errors.push(`Failed to unlock unit ${unit._id}: ${error.message}`);
        }
      }

      // 3. Delete all trader inventory
      const inventory = await ctx.db.query("traderInventory").collect();
      for (const inv of inventory) {
        try {
          await ctx.db.delete(inv._id);
          results.inventoryDeleted++;
        } catch (error: any) {
          results.errors.push(`Failed to delete inventory ${inv._id}: ${error.message}`);
        }
      }

      // 4. Delete all buyer purchases
      const purchases = await ctx.db.query("buyerPurchases").collect();
      for (const purchase of purchases) {
        try {
          await ctx.db.delete(purchase._id);
          results.buyerPurchasesDeleted++;
        } catch (error: any) {
          results.errors.push(`Failed to delete purchase ${purchase._id}: ${error.message}`);
        }
      }

      // 5. Reset all listing statuses to active
      const listings = await ctx.db.query("listings").collect();
      for (const listing of listings) {
        try {
          await ctx.db.patch(listing._id, {
            status: "active",
            deliverySLA: 0,
          });
          results.listingsReset++;
        } catch (error: any) {
          results.errors.push(`Failed to reset listing ${listing._id}: ${error.message}`);
        }
      }

      // 6. Reset all delivered/cancelled units to available
      const deliveredUnits = await ctx.db
        .query("listingUnits")
        .withIndex("by_status", (q: any) => q.eq("status", "delivered"))
        .collect();
      
      const cancelledUnits = await ctx.db
        .query("listingUnits")
        .withIndex("by_status", (q: any) => q.eq("status", "cancelled"))
        .collect();

      for (const unit of [...deliveredUnits, ...cancelledUnits]) {
        try {
          await ctx.db.patch(unit._id, {
            status: "available",
            lockedBy: undefined,
            lockedAt: undefined,
            lockUtid: undefined,
            deliveryDeadline: undefined,
            deliveryStatus: undefined,
          });
        } catch (error: any) {
          results.errors.push(`Failed to reset unit ${unit._id}: ${error.message}`);
        }
      }

      return {
        success: true,
        utid,
        results,
        summary: {
          totalWalletEntriesDeleted: results.walletLedgerEntriesDeleted,
          tradersRestored: results.tradersRestored,
          totalUnitsUnlocked: results.unitsUnlocked,
          totalInventoryDeleted: results.inventoryDeleted,
          totalPurchasesDeleted: results.buyerPurchasesDeleted,
          totalListingsReset: results.listingsReset,
          totalErrors: results.errors.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        utid,
        error: error.message,
        results,
      };
    }
  },
});

/**
 * Update kilo-shaving rate (admin only)
 * Changes the storage fee rate (kilos per day per 100kg block)
 */
export const updateKiloShavingRate = mutation({
  args: {
    adminId: v.id("users"),
    rateKgPerDay: v.number(), // New rate in kilos per day per 100kg block
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    if (args.rateKgPerDay < 0) {
      throw new Error("Storage fee rate cannot be negative");
    }

    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "update_kilo_shaving_rate",
      args.reason,
      undefined,
      {
        previousRate: await getStorageFeeRate({ db: ctx.db }),
        newRate: args.rateKgPerDay,
      }
    );

    // Get or create system settings
    let settings = await ctx.db.query("systemSettings").first();
    if (!settings) {
      // Create initial settings record
      await ctx.db.insert("systemSettings", {
        pilotMode: false,
        setBy: args.adminId,
        setAt: getUgandaTime(),
        reason: "Initial system settings",
        utid: generateUTID("admin"),
        storageFeeRateKgPerDay: args.rateKgPerDay,
      });
    } else {
      // Update existing settings
      await ctx.db.patch(settings._id, {
        storageFeeRateKgPerDay: args.rateKgPerDay,
      });
    }

    return { utid, rateKgPerDay: args.rateKgPerDay };
  },
});

/**
 * Get current kilo-shaving rate (admin only)
 */
/**
 * Get all storage locations (admin only)
 */
export const getStorageLocations = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);
    const locations = await ctx.db
      .query("storageLocations")
      .collect();
    return locations.sort((a, b) => a.order - b.order);
  },
});

/**
 * Add storage location (admin only)
 */
export const addStorageLocation = mutation({
  args: {
    adminId: v.id("users"),
    districtName: v.string(),
    code: v.string(),
    order: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    if (!args.districtName.trim()) {
      throw new Error("District name cannot be empty");
    }
    if (!args.code.trim()) {
      throw new Error("Code cannot be empty");
    }

    // Check if code already exists
    const existing = await ctx.db
      .query("storageLocations")
      .withIndex("by_code", (q) => q.eq("code", args.code.trim().toUpperCase()))
      .first();
    if (existing) {
      throw new Error(`Storage location with code "${args.code}" already exists`);
    }

    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "add_storage_location",
      args.reason,
      undefined,
      {
        districtName: args.districtName.trim(),
        code: args.code.trim().toUpperCase(),
        order: args.order,
      }
    );

    const locationId = await ctx.db.insert("storageLocations", {
      districtName: args.districtName.trim(),
      code: args.code.trim().toUpperCase(),
      order: args.order,
      active: true,
      createdAt: getUgandaTime(),
      createdBy: args.adminId,
      utid,
    });

    return { utid, locationId, districtName: args.districtName.trim(), code: args.code.trim().toUpperCase() };
  },
});

/**
 * Update storage location (admin only)
 */
export const updateStorageLocation = mutation({
  args: {
    adminId: v.id("users"),
    locationId: v.id("storageLocations"),
    districtName: v.optional(v.string()),
    code: v.optional(v.string()),
    order: v.optional(v.number()),
    active: v.optional(v.boolean()),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    const location = await ctx.db.get(args.locationId);
    if (!location) {
      throw new Error("Storage location not found");
    }

    const previousState = {
      districtName: location.districtName,
      code: location.code,
      order: location.order,
      active: location.active,
    };

    const updates: any = {};
    if (args.districtName !== undefined) {
      if (!args.districtName.trim()) {
        throw new Error("District name cannot be empty");
      }
      updates.districtName = args.districtName.trim();
    }
    if (args.code !== undefined) {
      if (!args.code.trim()) {
        throw new Error("Code cannot be empty");
      }
      const newCode = args.code.trim().toUpperCase();
      if (newCode !== location.code) {
        // Check if new code already exists
        const existing = await ctx.db
          .query("storageLocations")
          .withIndex("by_code", (q) => q.eq("code", newCode))
          .first();
        if (existing) {
          throw new Error(`Storage location with code "${newCode}" already exists`);
        }
        updates.code = newCode;
      }
    }
    if (args.order !== undefined) {
      updates.order = args.order;
    }
    if (args.active !== undefined) {
      updates.active = args.active;
    }

    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "update_storage_location",
      args.reason,
      undefined,
      {
        locationId: args.locationId,
        previousState,
        newState: updates,
      }
    );

    await ctx.db.patch(args.locationId, updates);

    return { utid, locationId: args.locationId, ...updates };
  },
});

/**
 * Delete storage location (admin only)
 */
export const deleteStorageLocation = mutation({
  args: {
    adminId: v.id("users"),
    locationId: v.id("storageLocations"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    const location = await ctx.db.get(args.locationId);
    if (!location) {
      throw new Error("Storage location not found");
    }

    // Check if location is being used in any active listings
    const activeListings = await ctx.db
      .query("listings")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const usingLocation = activeListings.some((listing) => listing.storageLocationId === args.locationId);
    if (usingLocation) {
      throw new Error("Cannot delete storage location that is being used in active listings");
    }

    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "delete_storage_location",
      args.reason,
      undefined,
      {
        locationId: args.locationId,
        districtName: location.districtName,
        code: location.code,
      }
    );

    await ctx.db.delete(args.locationId);

    return { utid, locationId: args.locationId };
  },
});

/**
 * Get today's system metrics (admin only)
 * Returns metrics for Open, Locked, Delivered, Collectable, and Picked Up listings
 */
export const getTodaySystemMetrics = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    // Get today's date range (start of day to end of day in Uganda time - UTC+3)
    // Since all timestamps are now stored in Uganda time, we calculate in Uganda time
    const now = getUgandaTime();
    const ugandaOffset = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
    const nowInUganda = now; // Already in Uganda time
    const today = new Date(nowInUganda);
    today.setUTCHours(0, 0, 0, 0);
    const startOfDayUganda = today.getTime();
    const endOfDayUganda = startOfDayUganda + 24 * 60 * 60 * 1000 - 1;
    // Use Uganda time directly for comparison (timestamps are stored in Uganda time)
    const startOfDay = startOfDayUganda;
    const endOfDay = endOfDayUganda;

    // Helper function to check if timestamp is today
    const isToday = (timestamp: number) => timestamp >= startOfDay && timestamp <= endOfDay;

    // 1. OPEN LISTINGS - Units with status "available" created today
    const allAvailableUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_status", (q: any) => q.eq("status", "available"))
      .collect();

    const openListings = [];
    let openKilos = 0;
    let openMoney = 0;
    const openUTIDs = new Set<string>();

    for (const unit of allAvailableUnits) {
      const listing = await ctx.db.get(unit.listingId);
      if (listing && isToday(listing.createdAt)) {
        const unitSize = listing.unitSize || 10;
        const unitValue = listing.pricePerKilo * unitSize;
        openListings.push({
          unitId: unit._id,
          listingId: listing._id,
          utid: listing.utid,
          kilos: unitSize,
          money: unitValue,
        });
        openKilos += unitSize;
        openMoney += unitValue;
        openUTIDs.add(listing.utid);
      }
    }

    // 2. LOCKED LISTINGS - Units with status "locked" locked today
    const allLockedUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_status", (q: any) => q.eq("status", "locked"))
      .collect();

    const lockedListings = [];
    let lockedKilos = 0;
    let lockedMoney = 0;
    const lockedUTIDs = new Set<string>();

    for (const unit of allLockedUnits) {
      if (unit.lockedAt && isToday(unit.lockedAt)) {
        const listing = await ctx.db.get(unit.listingId);
        if (listing) {
          const unitSize = listing.unitSize || 10;
          const unitValue = listing.pricePerKilo * unitSize;
          lockedListings.push({
            unitId: unit._id,
            listingId: listing._id,
            utid: unit.lockUtid || listing.utid,
            kilos: unitSize,
            money: unitValue,
          });
          lockedKilos += unitSize;
          lockedMoney += unitValue;
          if (unit.lockUtid) {
            lockedUTIDs.add(unit.lockUtid);
          }
          lockedUTIDs.add(listing.utid);
        }
      }
    }

    // 3. DELIVERED LISTINGS - Units delivered today (checked via inventory creation time)
    // Get all trader inventory created today
    const allInventory = await ctx.db.query("traderInventory").collect();
    const deliveredListings = [];
    let deliveredKilos = 0;
    let deliveredMoney = 0;
    const deliveredUTIDs = new Set<string>();
    const processedUnitIds = new Set<string>();

    // Check inventory created today (acquiredAt or storageStartTime)
    for (const inventory of allInventory) {
      const inventoryCreatedToday = isToday(inventory.acquiredAt) || isToday(inventory.storageStartTime);
      
      if (inventoryCreatedToday) {
        // Process all units in this inventory
        for (const unitId of inventory.listingUnitIds) {
          if (!processedUnitIds.has(unitId)) {
            const unit = await ctx.db.get(unitId);
            if (unit) {
              const listing = await ctx.db.get(unit.listingId);
              if (listing) {
                const unitSize = listing.unitSize || 10;
                const unitValue = listing.pricePerKilo * unitSize;
                deliveredListings.push({
                  unitId: unit._id,
                  listingId: listing._id,
                  utid: unit.lockUtid || inventory.utid || listing.utid,
                  kilos: unitSize,
                  money: unitValue,
                });
                deliveredKilos += unitSize;
                deliveredMoney += unitValue;
                if (unit.lockUtid) {
                  deliveredUTIDs.add(unit.lockUtid);
                }
                deliveredUTIDs.add(inventory.utid);
                deliveredUTIDs.add(listing.utid);
                processedUnitIds.add(unitId);
              }
            }
          }
        }
      }
    }

    // 4. COLLECTABLE LISTINGS - Buyer purchases with status "pending_pickup" purchased today
    const allPendingPurchases = await ctx.db
      .query("buyerPurchases")
      .withIndex("by_status", (q: any) => q.eq("status", "pending_pickup"))
      .collect();

    const collectableListings = [];
    let collectableKilos = 0;
    let collectableMoney = 0;
    const collectableUTIDs = new Set<string>();

    for (const purchase of allPendingPurchases) {
      if (isToday(purchase.purchasedAt)) {
        const inventory = await ctx.db.get(purchase.inventoryId);
        if (inventory && inventory.listingUnitIds.length > 0) {
          // Get price from the first unit's listing
          const firstUnit = await ctx.db.get(inventory.listingUnitIds[0]);
          if (firstUnit) {
            const listing = await ctx.db.get(firstUnit.listingId);
            if (listing) {
              const purchaseValue = listing.pricePerKilo * purchase.kilos;
              collectableListings.push({
                purchaseId: purchase._id,
                inventoryId: purchase.inventoryId,
                utid: purchase.utid,
                kilos: purchase.kilos,
                money: purchaseValue,
              });
              collectableKilos += purchase.kilos;
              collectableMoney += purchaseValue;
              collectableUTIDs.add(purchase.utid);
            }
          }
        }
      }
    }

    // 5. PICKED UP LISTINGS - Buyer purchases with status "picked_up" picked up today
    // Note: We need to track when items were picked up. For now, we'll use a timestamp field if it exists.
    // If not, we'll need to check admin actions or another source.
    // For now, we'll check purchases that were updated today (approximation)
    const allPickedUpPurchases = await ctx.db
      .query("buyerPurchases")
      .withIndex("by_status", (q: any) => q.eq("status", "picked_up"))
      .collect();

    const pickedUpListings = [];
    let pickedUpKilos = 0;
    let pickedUpMoney = 0;
    const pickedUpUTIDs = new Set<string>();

    // Since we don't have a pickedUpAt timestamp, we'll use purchasedAt as approximation
    // In a real system, you'd want to add a pickedUpAt field
    for (const purchase of allPickedUpPurchases) {
      // For now, include all picked_up purchases (you may want to add a pickedUpAt field)
      const inventory = await ctx.db.get(purchase.inventoryId);
      if (inventory && inventory.listingUnitIds.length > 0) {
        const firstUnit = await ctx.db.get(inventory.listingUnitIds[0]);
        if (firstUnit) {
          const listing = await ctx.db.get(firstUnit.listingId);
          if (listing) {
            const purchaseValue = listing.pricePerKilo * purchase.kilos;
            pickedUpListings.push({
              purchaseId: purchase._id,
              inventoryId: purchase.inventoryId,
              utid: purchase.utid,
              kilos: purchase.kilos,
              money: purchaseValue,
            });
            pickedUpKilos += purchase.kilos;
            pickedUpMoney += purchaseValue;
            pickedUpUTIDs.add(purchase.utid);
          }
        }
      }
    }

    return {
      date: {
        startOfDay,
        endOfDay,
        startOfDayUganda,
        endOfDayUganda,
        today: (() => {
          // Format date in Uganda timezone (UTC+3)
          const ugandaDate = new Date(startOfDayUganda);
          const year = ugandaDate.getUTCFullYear();
          const month = String(ugandaDate.getUTCMonth() + 1).padStart(2, "0");
          const day = String(ugandaDate.getUTCDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        })(),
        currentTime: (() => {
          // Get current time in Uganda (UTC+3)
          const now = Date.now();
          const ugandaOffset = 3 * 60 * 60 * 1000;
          return new Date(now + ugandaOffset).toISOString().replace("Z", "+03:00");
        })(),
        timezone: "EAT (UTC+3)",
      },
      open: {
        count: openListings.length,
        uniqueUTIDs: openUTIDs.size,
        totalKilos: openKilos,
        totalMoney: openMoney,
        listings: openListings,
      },
      locked: {
        count: lockedListings.length,
        uniqueUTIDs: lockedUTIDs.size,
        totalKilos: lockedKilos,
        totalMoney: lockedMoney,
        listings: lockedListings,
      },
      delivered: {
        count: deliveredListings.length,
        uniqueUTIDs: deliveredUTIDs.size,
        totalKilos: deliveredKilos,
        totalMoney: deliveredMoney,
        listings: deliveredListings,
      },
      collectable: {
        count: collectableListings.length,
        uniqueUTIDs: collectableUTIDs.size,
        totalKilos: collectableKilos,
        totalMoney: collectableMoney,
        listings: collectableListings,
      },
      pickedUp: {
        count: pickedUpListings.length,
        uniqueUTIDs: pickedUpUTIDs.size,
        totalKilos: pickedUpKilos,
        totalMoney: pickedUpMoney,
        listings: pickedUpListings,
      },
    };
  },
});

export const getKiloShavingRate = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);
    const rate = await getStorageFeeRate({ db: ctx.db });
    return { rateKgPerDay: rate };
  },
});

/**
 * Update buyer service fee percentage (admin only)
 * Changes the service fee percentage added to purchase price for buyers
 */
export const updateBuyerServiceFeePercentage = mutation({
  args: {
    adminId: v.id("users"),
    serviceFeePercentage: v.number(), // New service fee percentage (e.g., 3 for 3%)
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    if (args.serviceFeePercentage < 0 || args.serviceFeePercentage > 100) {
      throw new Error("Service fee percentage must be between 0 and 100");
    }

    const previousFee = await getBuyerServiceFeePercentage({ db: ctx.db });

    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "update_buyer_service_fee_percentage",
      args.reason,
      undefined,
      {
        previousFee,
        newFee: args.serviceFeePercentage,
      }
    );

    // Get or create system settings
    let settings = await ctx.db.query("systemSettings").first();
    if (!settings) {
      // Create initial settings record
      await ctx.db.insert("systemSettings", {
        pilotMode: false,
        setBy: args.adminId,
        setAt: getUgandaTime(),
        reason: "Initial system settings",
        utid: generateUTID("admin"),
        buyerServiceFeePercentage: args.serviceFeePercentage,
      });
    } else {
      // Update existing settings
      await ctx.db.patch(settings._id, {
        buyerServiceFeePercentage: args.serviceFeePercentage,
      });
    }

    return { utid, serviceFeePercentage: args.serviceFeePercentage };
  },
});

/**
 * Get current buyer service fee percentage (admin only)
 */
export const getBuyerServiceFeePercentageQuery = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);
    const fee = await getBuyerServiceFeePercentage({ db: ctx.db });
    return { serviceFeePercentage: fee };
  },
});

/**
 * Update trader commission percentage (SuperAdmin only)
 * Changes the commission percentage deducted from trader sales
 */
export const updateTraderCommissionPercentage = mutation({
  args: {
    adminId: v.id("users"),
    commissionPercentage: v.number(), // New commission percentage (e.g., 2 for 2%)
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const adminUser = await verifyAdmin(ctx, args.adminId);
    
    // Only SuperAdmin can update commission
    if (!isSuperAdmin(adminUser)) {
      throw new Error("Only SuperAdmin can update trader commission percentage");
    }

    if (args.commissionPercentage < 0 || args.commissionPercentage > 100) {
      throw new Error("Commission percentage must be between 0 and 100");
    }

    const previousCommission = await getTraderCommissionPercentage({ db: ctx.db });

    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "update_trader_commission_percentage",
      args.reason,
      undefined,
      {
        previousCommission,
        newCommission: args.commissionPercentage,
      }
    );

    // Get or create system settings
    let settings = await ctx.db.query("systemSettings").first();
    if (!settings) {
      // Create initial settings record
      await ctx.db.insert("systemSettings", {
        pilotMode: false,
        setBy: args.adminId,
        setAt: getUgandaTime(),
        reason: "Initial system settings",
        utid: generateUTID("admin"),
        traderCommissionPercentage: args.commissionPercentage,
      });
    } else {
      // Update existing settings
      await ctx.db.patch(settings._id, {
        traderCommissionPercentage: args.commissionPercentage,
      });
    }

    return { utid, commissionPercentage: args.commissionPercentage };
  },
});

/**
 * Get current trader commission percentage (admin only)
 */
export const getTraderCommissionPercentageQuery = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);
    const commission = await getTraderCommissionPercentage({ db: ctx.db });
    return { commissionPercentage: commission };
  },
});

/**
 * Update trader spend cap (admin only)
 * Sets a custom spend cap for a specific trader
 */
/**
 * Update spend cap for all traders (admin only)
 * Sets the same spend cap for all traders in the system
 */
export const updateAllTradersSpendCap = mutation({
  args: {
    adminId: v.id("users"),
    spendCap: v.optional(v.number()), // New spend cap in UGX. If not provided, resets all to default.
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    if (args.spendCap !== undefined && args.spendCap < 0) {
      throw new Error("Spend cap cannot be negative");
    }

    // Get all traders
    const allUsers = await ctx.db.query("users").collect();
    const traders = allUsers.filter((u) => u.role === "trader");

    const results = {
      updated: [] as string[],
      errors: [] as string[],
    };

    const newSpendCap = args.spendCap; // undefined means reset to default

    for (const trader of traders) {
      try {
        const previousSpendCap = trader.customSpendCap || MAX_TRADER_EXPOSURE_UGX;

        await ctx.db.patch(trader._id, {
          customSpendCap: newSpendCap, // undefined will reset to default
        });

        results.updated.push(trader._id);
      } catch (error: any) {
        results.errors.push(`Failed to update trader ${trader.alias}: ${error.message}`);
      }
    }

    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "update_all_traders_spend_cap",
      args.reason,
      undefined,
      {
        spendCap: newSpendCap,
        tradersUpdated: results.updated.length,
        tradersTotal: traders.length,
      }
    );

    return { utid, ...results };
  },
});

export const updateTraderSpendCap = mutation({
  args: {
    adminId: v.id("users"),
    traderId: v.id("users"),
    spendCap: v.optional(v.number()), // New spend cap in UGX. If not provided, resets to default.
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    const trader = await ctx.db.get(args.traderId);
    if (!trader) {
      throw new Error("Trader not found");
    }

    if (trader.role !== "trader") {
      throw new Error("User is not a trader");
    }

    if (args.spendCap !== undefined && args.spendCap < 0) {
      throw new Error("Spend cap cannot be negative");
    }

    const previousSpendCap = trader.customSpendCap || MAX_TRADER_EXPOSURE_UGX;
    const newSpendCap = args.spendCap ?? null; // null means reset to default

    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "update_trader_spend_cap",
      args.reason,
      undefined,
      {
        traderId: args.traderId,
        traderAlias: trader.alias,
        previousSpendCap,
        newSpendCap: newSpendCap ?? MAX_TRADER_EXPOSURE_UGX,
        resetToDefault: newSpendCap === null,
      }
    );

    // Update trader's custom spend cap
    if (newSpendCap === null) {
      // Reset to default (remove custom cap)
      await ctx.db.patch(args.traderId, {
        customSpendCap: undefined,
      });
    } else {
      // Set custom cap
      await ctx.db.patch(args.traderId, {
        customSpendCap: newSpendCap,
      });
    }

    return {
      utid,
      traderId: args.traderId,
      traderAlias: trader.alias,
      spendCap: newSpendCap ?? MAX_TRADER_EXPOSURE_UGX,
      isCustom: newSpendCap !== null,
    };
  },
});

/**
 * Get trader spend cap (admin only)
 */
export const getTraderSpendCap = query({
  args: {
    adminId: v.id("users"),
    traderId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    const trader = await ctx.db.get(args.traderId);
    if (!trader) {
      throw new Error("Trader not found");
    }

    if (trader.role !== "trader") {
      throw new Error("User is not a trader");
    }

    const spendCap = trader.customSpendCap || MAX_TRADER_EXPOSURE_UGX;

    return {
      traderId: args.traderId,
      traderAlias: trader.alias,
      spendCap,
      isCustom: trader.customSpendCap !== undefined,
    };
  },
});

/**
 * Get all quality options (admin only)
 * Returns all quality options sorted by order
 */
export const getQualityOptions = query({
  args: {
    adminId: v.id("users"),
    activeOnly: v.optional(v.boolean()), // If true, only return active options
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    let options;
    if (args.activeOnly) {
      options = await ctx.db
        .query("qualityOptions")
        .withIndex("by_active", (q: any) => q.eq("active", true))
        .collect();
    } else {
      options = await ctx.db.query("qualityOptions").collect();
    }

    // Sort by order
    options.sort((a, b) => a.order - b.order);

    return options.map((opt) => ({
      optionId: opt._id,
      label: opt.label,
      value: opt.value,
      order: opt.order,
      active: opt.active,
      createdAt: opt.createdAt,
      createdBy: opt.createdBy,
    }));
  },
});

/**
 * Add quality option (admin only)
 */
export const addQualityOption = mutation({
  args: {
    adminId: v.id("users"),
    label: v.string(),
    value: v.string(),
    order: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    if (!args.label.trim()) {
      throw new Error("Label is required");
    }
    if (!args.value.trim()) {
      throw new Error("Value is required");
    }

    // Check if value already exists
    const existing = await ctx.db
      .query("qualityOptions")
      .collect();
    
    const valueExists = existing.some((opt) => opt.value === args.value.trim());
    if (valueExists) {
      throw new Error(`Quality option with value "${args.value}" already exists`);
    }

    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "add_quality_option",
      args.reason,
      undefined,
      {
        label: args.label,
        value: args.value,
        order: args.order,
      }
    );

    const optionId = await ctx.db.insert("qualityOptions", {
      label: args.label.trim(),
      value: args.value.trim(),
      order: args.order,
      active: true,
      createdAt: getUgandaTime(),
      createdBy: args.adminId,
    });

    return { utid, optionId, label: args.label.trim(), value: args.value.trim() };
  },
});

/**
 * Update quality option (admin only)
 */
export const updateQualityOption = mutation({
  args: {
    adminId: v.id("users"),
    optionId: v.id("qualityOptions"),
    label: v.optional(v.string()),
    order: v.optional(v.number()),
    active: v.optional(v.boolean()),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    const option = await ctx.db.get(args.optionId);
    if (!option) {
      throw new Error("Quality option not found");
    }

    const previousState = {
      label: option.label,
      order: option.order,
      active: option.active,
    };

    const updates: any = {};
    if (args.label !== undefined) {
      if (!args.label.trim()) {
        throw new Error("Label cannot be empty");
      }
      updates.label = args.label.trim();
    }
    if (args.order !== undefined) {
      updates.order = args.order;
    }
    if (args.active !== undefined) {
      updates.active = args.active;
    }

    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "update_quality_option",
      args.reason,
      undefined,
      {
        optionId: args.optionId,
        previousState,
        newState: updates,
      }
    );

    await ctx.db.patch(args.optionId, updates);

    return { utid, optionId: args.optionId, updates };
  },
});

/**
 * Delete quality option (admin only)
 * Note: This is a soft delete - sets active to false
 */
export const deleteQualityOption = mutation({
  args: {
    adminId: v.id("users"),
    optionId: v.id("qualityOptions"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    const option = await ctx.db.get(args.optionId);
    if (!option) {
      throw new Error("Quality option not found");
    }

    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "delete_quality_option",
      args.reason,
      undefined,
      {
        optionId: args.optionId,
        label: option.label,
        value: option.value,
      }
    );

    // Hard delete - permanently remove from database
    await ctx.db.delete(args.optionId);

    return { utid, optionId: args.optionId };
  },
});

/**
 * Get all produce options (admin only)
 * Returns all produce options sorted by order
 */
export const getProduceOptions = query({
  args: {
    adminId: v.id("users"),
    activeOnly: v.optional(v.boolean()), // If true, only return active options
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    let options;
    if (args.activeOnly) {
      options = await ctx.db
        .query("produceOptions")
        .withIndex("by_active", (q: any) => q.eq("active", true))
        .collect();
    } else {
      options = await ctx.db.query("produceOptions").collect();
    }

    // Sort by order
    options.sort((a, b) => a.order - b.order);

    return options.map((opt) => ({
      optionId: opt._id,
      label: opt.label,
      value: opt.value,
      icon: opt.icon,
      order: opt.order,
      active: opt.active,
      allowedStorageLocationIds: opt.allowedStorageLocationIds || [],
      createdAt: opt.createdAt,
      createdBy: opt.createdBy,
    }));
  },
});

/**
 * Add produce option (admin only)
 */
export const addProduceOption = mutation({
  args: {
    adminId: v.id("users"),
    label: v.string(),
    value: v.string(),
    icon: v.string(), // Emoji icon
    order: v.float64(),
    allowedStorageLocationIds: v.optional(v.array(v.id("storageLocations"))),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    if (!args.label.trim()) {
      throw new Error("Label is required");
    }
    if (!args.value.trim()) {
      throw new Error("Value is required");
    }
    if (!args.icon.trim()) {
      throw new Error("Icon is required");
    }

    // Check if value already exists
    const existing = await ctx.db
      .query("produceOptions")
      .collect();
    
    const valueExists = existing.some((opt) => opt.value === args.value.trim());
    if (valueExists) {
      throw new Error(`Produce option with value "${args.value}" already exists`);
    }

    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "add_produce_option",
      args.reason,
      undefined,
      {
        label: args.label,
        value: args.value,
        icon: args.icon,
        order: args.order,
      }
    );

    const insertData: any = {
      label: args.label.trim(),
      value: args.value.trim(),
      icon: args.icon.trim(),
      order: args.order,
      active: true,
      createdAt: getUgandaTime(),
      createdBy: args.adminId,
    };
    
    if (args.allowedStorageLocationIds && args.allowedStorageLocationIds.length > 0) {
      insertData.allowedStorageLocationIds = args.allowedStorageLocationIds;
    }
    
    const optionId = await ctx.db.insert("produceOptions", insertData);

    return { utid, optionId, label: args.label.trim(), value: args.value.trim(), icon: args.icon.trim() };
  },
});

/**
 * Update produce option (admin only)
 */
export const updateProduceOption = mutation({
  args: {
    adminId: v.id("users"),
    optionId: v.id("produceOptions"),
    label: v.optional(v.string()),
    icon: v.optional(v.string()),
    order: v.optional(v.number()),
    active: v.optional(v.boolean()),
    allowedStorageLocationIds: v.optional(v.array(v.id("storageLocations"))),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    const option = await ctx.db.get(args.optionId);
    if (!option) {
      throw new Error("Produce option not found");
    }

    const previousState = {
      label: option.label,
      icon: option.icon,
      order: option.order,
      active: option.active,
      allowedStorageLocationIds: option.allowedStorageLocationIds || [],
    };

    const updates: any = {};
    if (args.label !== undefined) {
      if (!args.label.trim()) {
        throw new Error("Label cannot be empty");
      }
      updates.label = args.label.trim();
    }
    if (args.icon !== undefined) {
      if (!args.icon.trim()) {
        throw new Error("Icon cannot be empty");
      }
      updates.icon = args.icon.trim();
    }
    if (args.order !== undefined) {
      updates.order = args.order;
    }
    if (args.active !== undefined) {
      updates.active = args.active;
    }
    if (args.allowedStorageLocationIds !== undefined) {
      updates.allowedStorageLocationIds = args.allowedStorageLocationIds;
    }

    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "update_produce_option",
      args.reason,
      undefined,
      {
        optionId: args.optionId,
        previousState,
        newState: updates,
      }
    );

    await ctx.db.patch(args.optionId, updates);

    return { utid, optionId: args.optionId, updates };
  },
});

/**
 * Delete produce option (admin only)
 * Permanently removes the option from the database
 */
export const deleteProduceOption = mutation({
  args: {
    adminId: v.id("users"),
    optionId: v.id("produceOptions"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    const option = await ctx.db.get(args.optionId);
    if (!option) {
      throw new Error("Produce option not found");
    }

    const utid = await logAdminAction(
      ctx,
      args.adminId,
      "delete_produce_option",
      args.reason,
      undefined,
      {
        optionId: args.optionId,
        label: option.label,
        value: option.value,
      }
    );

    // Hard delete - permanently remove from database
    await ctx.db.delete(args.optionId);

    return { utid, optionId: args.optionId };
  },
});

/**
 * Admin deposits demo funds into trader or buyer account
 * For training/demo purposes - allows users to learn before depositing real money
 */
export const adminDepositDemoFunds = mutation({
  args: {
    adminId: v.id("users"),
    targetUserId: v.id("users"),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    // Verify target user is trader or buyer
    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser) {
      throw new Error("Target user not found");
    }

    if (targetUser.role !== "trader" && targetUser.role !== "buyer") {
      throw new Error("Can only deposit demo funds to traders or buyers");
    }

    if (args.amount <= 0) {
      throw new Error("Amount must be greater than zero");
    }

    // Get current balance
    const entries = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", args.targetUserId))
      .order("desc")
      .collect();

    const currentBalance = entries[0]?.balanceAfter || 0;
    const balanceAfter = currentBalance + args.amount;

    // Generate UTID
    const utid = generateUTID("admin_demo_deposit");

    // Log admin action
    await logAdminAction(
      ctx,
      args.adminId,
      "demo_fund_deposit",
      args.reason,
      utid,
      {
        targetUserId: args.targetUserId,
        targetUserEmail: targetUser.email,
        targetUserRole: targetUser.role,
        amount: args.amount,
        previousBalance: currentBalance,
        newBalance: balanceAfter,
      }
    );

    // Create wallet entry
    await ctx.db.insert("walletLedger", {
      userId: args.targetUserId,
      utid,
      type: "capital_deposit",
      amount: args.amount,
      balanceAfter,
      timestamp: getUgandaTime(),
      metadata: {
        source: "admin_demo_deposit",
        adminId: args.adminId,
        reason: args.reason,
      },
    });

    return {
      utid,
      targetUserId: args.targetUserId,
      targetUserEmail: targetUser.email,
      targetUserRole: targetUser.role,
      amount: args.amount,
      previousBalance: currentBalance,
      newBalance: balanceAfter,
    };
  },
});

/**
 * Get users with demo fund status (admin only)
 * Returns traders and buyers with information about whether they've received demo funds
 */
export const getUsersWithDemoFundStatus = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    // Get all traders and buyers
    const traders = await ctx.db
      .query("users")
      .withIndex("by_role", (q: any) => q.eq("role", "trader"))
      .collect();
    
    const buyers = await ctx.db
      .query("users")
      .withIndex("by_role", (q: any) => q.eq("role", "buyer"))
      .collect();

    // Check demo fund status for each user
    const checkDemoFundStatus = async (userId: Id<"users">) => {
      const entries = await ctx.db
        .query("walletLedger")
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .collect();
      
      const hasDemoFunds = entries.some(
        (entry) => entry.metadata?.source === "admin_demo_deposit" || entry.metadata?.source === "demo_seed"
      );
      
      const latestEntry = entries[0];
      const currentBalance = latestEntry?.balanceAfter || 0;
      const lastDemoDeposit = entries.find(
        (entry) => entry.metadata?.source === "admin_demo_deposit" || entry.metadata?.source === "demo_seed"
      );
      
      return {
        hasDemoFunds,
        currentBalance,
        lastDemoDepositAmount: lastDemoDeposit?.amount || 0,
        lastDemoDepositDate: lastDemoDeposit?.timestamp || null,
      };
    };

    const tradersWithStatus = await Promise.all(
      traders.map(async (trader) => ({
        ...trader,
        demoFundStatus: await checkDemoFundStatus(trader._id),
      }))
    );

    const buyersWithStatus = await Promise.all(
      buyers.map(async (buyer) => ({
        ...buyer,
        demoFundStatus: await checkDemoFundStatus(buyer._id),
      }))
    );

    return {
      traders: tradersWithStatus,
      buyers: buyersWithStatus,
    };
  },
});