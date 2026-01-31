/**
 * System State Introspection (Admin Only)
 * 
 * Read-only queries for admins to audit system state.
 * These queries help admins:
 * - Track all UTIDs and their current state
 * - Audit wallet transactions
 * - Monitor inventory status
 * - Track delivery and pickup SLAs
 * 
 * All queries are read-only (no mutations).
 * All queries require admin role verification.
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAll } from "./_generated/engine/api";
import { Id } from "./_generated/dataModel";

/**
 * Verify user is admin (shared helper)
 */
async function verifyAdmin(ctx: any, adminId: Id<"users">) {
  const user = await ctx.db.get(adminId);

  if (!user) {
    console.error(`[verifyAdmin] User not found: ${adminId}`);
    throw new Error("User is not an admin");
  }

  if (user.role !== "admin") {
    console.error(`[verifyAdmin] User ${adminId} is not an admin. Role: ${user.role}`);

    console.error(`[verifyAdmin] User object:`, user); // Dump entire object
    throw new Error("User is not an admin");
  }
  return user;
}

/**
 * Get all active UTIDs and their current state
 * 
 * Returns a comprehensive view of all UTIDs across the system,
 * grouped by UTID with their associated entities and status.
 */
export const getAllActiveUTIDs = query({
  args: {
    adminId: v.id("users"),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    console.log("[getAllUsers] Called with args:", args); // Log the arguments
    
    if (!args.adminId) {
      throw new Error("Admin ID is missing in getAllUsers");
    }
    const adminUser = await verifyAdmin(ctx, args.adminId);
    const isAdminSuper = adminUser.adminLevel === "super" || adminUser.adminLevel === undefined;

    const now = Date.now();
    const utidMap = new Map<string, any>();

    // 1. Wallet ledger entries by UTID
    const walletEntries = await ctx.db
      .query("walletLedger")
      .collect();

    for (const entry of walletEntries) {
      if (!utidMap.has(entry.utid)) {
        utidMap.set(entry.utid, {
          utid: entry.utid,
          type: "wallet",
          timestamp: entry.timestamp,
          entities: [],
        });
      }
      const utidData = utidMap.get(entry.utid)!;
      utidData.entities.push({
        table: "walletLedger",
        entryId: entry._id,
        userId: entry.userId,
        type: entry.type,
        amount: entry.amount,
        balanceAfter: entry.balanceAfter,
        timestamp: entry.timestamp,
        metadata: entry.metadata,
      });
    }

    // 2. Listing UTIDs
    const listings = await ctx.db
      .query("listings")
      .collect();

    for (const listing of listings) {
      if (!utidMap.has(listing.utid)) {
        utidMap.set(listing.utid, {
          utid: listing.utid,
          type: "listing",
          timestamp: listing.createdAt,
          entities: [],
        });
      }
      const utidData = utidMap.get(listing.utid)!;
      // Get storage location details (if available)
      const storageLocation = listing.storageLocationId 
        ? await ctx.db.get(listing.storageLocationId)
        : null;
      const totalPrice = listing.totalKilos * listing.pricePerKilo;
      utidData.entities.push({
        table: "listings",
        listingId: listing._id,
        status: listing.status,
        produceType: listing.produceType,
        totalKilos: listing.totalKilos,
        pricePerKilo: listing.pricePerKilo,
        totalPrice: totalPrice, // Total price paid
        qualityRating: listing.qualityRating || null,
        qualityComment: listing.qualityComment || null,
        storageLocation: storageLocation ? {
          districtName: storageLocation.districtName,
          code: storageLocation.code,
        } : null,
        createdAt: listing.createdAt,
        timestamp: listing.createdAt, // Timestamp for UTID
      });
    }

    // 3. Unit lock UTIDs
    const lockedUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_status", (q) => q.eq("status", "locked"))
      .collect();

    for (const unit of lockedUnits) {
      if (unit.lockUtid) {
        if (!utidMap.has(unit.lockUtid)) {
          utidMap.set(unit.lockUtid, {
            utid: unit.lockUtid,
            type: "unit_lock",
            timestamp: unit.lockedAt || 0,
            entities: [],
          });
        }
        const utidData = utidMap.get(unit.lockUtid)!;
        // Get listing to show farmer's offered price
        const listing = await ctx.db.get(unit.listingId);
        // Get storage location details (if available)
        const storageLocation = listing?.storageLocationId 
          ? await ctx.db.get(listing.storageLocationId)
          : null;
        // Get negotiation to show actual negotiated price (if exists)
        let negotiatedPricePerKilo = listing?.pricePerKilo || null;
        if (unit.activeNegotiationId) {
          const negotiation = await ctx.db.get(unit.activeNegotiationId);
          if (negotiation && negotiation.status === "accepted" && negotiation.currentPricePerKilo) {
            negotiatedPricePerKilo = negotiation.currentPricePerKilo;
          }
        }
        utidData.entities.push({
          table: "listingUnits",
          unitId: unit._id,
          unitNumber: unit.unitNumber,
          status: unit.status,
          lockedBy: unit.lockedBy,
          lockedAt: unit.lockedAt,
          deliveryDeadline: unit.deliveryDeadline,
          deliveryStatus: unit.deliveryStatus,
          farmerOfferedPricePerKilo: listing?.pricePerKilo || null, // Farmer's original asking price
          negotiatedPricePerKilo: negotiatedPricePerKilo, // Actual negotiated price (if negotiation happened)
          produceType: listing?.produceType || null,
          quantity: listing?.unitSize || 10, // Unit size in kg
          storageLocation: storageLocation ? {
            districtName: storageLocation.districtName,
            code: storageLocation.code,
          } : null,
        });
      }
    }

    // 4. Trader inventory UTIDs
    const inventory = await ctx.db
      .query("traderInventory")
      .collect();

    for (const inv of inventory) {
      if (!utidMap.has(inv.utid)) {
        utidMap.set(inv.utid, {
          utid: inv.utid,
          type: "inventory",
          timestamp: inv.acquiredAt,
          entities: [],
        });
      }
      const utidData = utidMap.get(inv.utid)!;
      // Get storage location details
      const storageLocation = await ctx.db.get(inv.storageLocationId);
      utidData.entities.push({
        table: "traderInventory",
        inventoryId: inv._id,
        status: inv.status,
        totalKilos: inv.totalKilos,
        produceType: inv.produceType,
        qualityRating: inv.qualityRating || null,
        unitPrice: inv.unitPrice, // Price per kilo (retained from listing)
        storageLocation: storageLocation ? {
          districtName: storageLocation.districtName,
          code: storageLocation.code,
        } : null,
        acquiredAt: inv.acquiredAt, // Timestamp when received at storage
        is100kgBlock: inv.is100kgBlock,
      });
    }

    // 5. Buyer purchase UTIDs
    const purchases = await ctx.db
      .query("buyerPurchases")
      .collect();

    for (const purchase of purchases) {
      if (!utidMap.has(purchase.utid)) {
        utidMap.set(purchase.utid, {
          utid: purchase.utid,
          type: "buyer_purchase",
          timestamp: purchase.purchasedAt,
          entities: [],
        });
      }
      const utidData = utidMap.get(purchase.utid)!;
      utidData.entities.push({
        table: "buyerPurchases",
        purchaseId: purchase._id,
        buyerId: purchase.buyerId,
        inventoryId: purchase.inventoryId,
        kilos: purchase.kilos,
        status: purchase.status,
        purchasedAt: purchase.purchasedAt,
        pickupSLA: purchase.pickupSLA,
      });
    }

    // 6. Admin action UTIDs
    const adminActions = await ctx.db
      .query("adminActions")
      .collect();

    for (const action of adminActions) {
      if (!utidMap.has(action.utid)) {
        utidMap.set(action.utid, {
          utid: action.utid,
          type: "admin_action",
          timestamp: action.timestamp,
          entities: [],
        });
      }
      const utidData = utidMap.get(action.utid)!;
      utidData.entities.push({
        table: "adminActions",
        actionId: action._id,
        actionType: action.actionType,
        adminId: action.adminId,
        reason: action.reason,
        targetUtid: action.targetUtid,
        timestamp: action.timestamp,
      });
    }

    // Convert to array and sort by timestamp
    const allUtids = Array.from(utidMap.values()).sort((a, b) => b.timestamp - a.timestamp);

    // Filter UTIDs based on admin's viewing permissions
    let filteredUtids = allUtids;
    
    if (!isAdminSuper) {
      // Junior admins: only see UTIDs for their assigned locations
      const allowedLocationIds = adminUser.allowedStorageLocationIds || [];
      
      filteredUtids = [];
      
      for (const utidData of allUtids) {
        let canView = false;
        
        // Check entities for storage location references
        for (const entity of utidData.entities || []) {
          let locationId: Id<"storageLocations"> | null = null;
          
          // Try to get location ID from entity
          if (entity.storageLocationId) {
            locationId = entity.storageLocationId;
          } else if (entity.listingId) {
            // Get location from listing
            const listing = await ctx.db.get(entity.listingId);
            if (listing && "storageLocationId" in listing) {
              locationId = listing.storageLocationId || null;
            }
          } else if (entity.inventoryId) {
            // Get location from inventory
            const inventory = await ctx.db.get(entity.inventoryId);
            if (inventory && "storageLocationId" in inventory) {
              locationId = inventory.storageLocationId || null;
            }
          } else if (entity.storageLocation?.code) {
            // Find location by code
            const location = await ctx.db
              .query("storageLocations")
              .withIndex("by_code", (q) => q.eq("code", entity.storageLocation.code))
              .first();
            locationId = location?._id || null;
          }
          
          // Check if admin can view this location
          if (locationId && allowedLocationIds.includes(locationId)) {
            canView = true;
            break;
          }
        }
        
        // If no location found in entities, include it (for UTIDs without location context like wallet entries)
        // But only if admin has at least one location assigned (otherwise they see nothing)
        if (!canView && (!utidData.entities || utidData.entities.length === 0)) {
          if (allowedLocationIds.length > 0) {
            // Skip UTIDs without location context if admin has location restrictions
            canView = false;
          } else {
            // If no locations assigned, show all (shouldn't happen, but handle gracefully)
            canView = true;
          }
        }
        
        if (canView) {
          utidData.canAccess = true; // If they can view it, they can access it
          filteredUtids.push(utidData);
        }
      }
    } else {
      // Super admins: see all UTIDs, all accessible
      for (const utidData of filteredUtids) {
        utidData.canAccess = true;
      }
    }

    const totalUTIDs = filteredUtids.length;
    const limit = Math.min(args.limit ?? 200, 500);
    const offset = Math.max(args.offset ?? 0, 0);
    const utids = filteredUtids.slice(offset, offset + limit);
    const nextOffset = offset + utids.length < totalUTIDs ? offset + utids.length : null;

    return {
      totalUTIDs,
      utids,
      offset,
      limit,
      nextOffset,
      currentTime: now,
    };
  },
});

/**
 * Get delivery-ready UTIDs (farmer-confirmed unit locks)
 *
 * Returns UTIDs grouped by lockUtid, sorted by earliest delivery deadline
 * (or earliest lockedAt if no deadline). Junior admins only see UTIDs
 * for their assigned storage locations. SuperAdmin sees all, including
 * items missing a storage location.
 */
export const getPendingDeliveryUTIDs = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const adminUser = await verifyAdmin(ctx, args.adminId);
    const isAdminSuper = adminUser.adminLevel === "super" || adminUser.adminLevel === undefined;
    const allowedLocationIds = adminUser.allowedStorageLocationIds || [];

    const lockedUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_status", (q) => q.eq("status", "locked"))
      .collect();

    const deliveryUnits = lockedUnits.filter(
      (unit) => unit.lockUtid && unit.deliveryStatus === "farmer_confirmed"
    );

    const batches = new Map<string, any>();

    for (const unit of deliveryUnits) {
      if (!unit.lockUtid) continue;

      const listing = await ctx.db.get(unit.listingId);
      if (!listing) continue;

      const storageLocationId = listing.storageLocationId || null;
      const storageLocation = storageLocationId ? await ctx.db.get(storageLocationId) : null;
      const produceType = listing.produceType || "Produce";
      const quantity = listing.unitSize || 10;

      if (!batches.has(unit.lockUtid)) {
        batches.set(unit.lockUtid, {
          utid: unit.lockUtid,
          items: [],
          totalUnits: 0,
          totalKilos: 0,
          earliestDeliveryDeadline: Number.POSITIVE_INFINITY,
          earliestLockedAt: Number.POSITIVE_INFINITY,
          locations: [],
          hasMissingLocation: false,
          hasDisallowedLocation: false,
        });
      }

      const batch = batches.get(unit.lockUtid);
      batch.items.push({
        unitId: unit._id,
        produceType,
        quantity,
        deliveryStatus: unit.deliveryStatus,
        deliveryDeadline: unit.deliveryDeadline || null,
        lockedAt: unit.lockedAt || null,
        storageLocation: storageLocation
          ? { districtName: storageLocation.districtName, code: storageLocation.code }
          : null,
      });

      batch.totalUnits += 1;
      batch.totalKilos += quantity;

      if (unit.deliveryDeadline) {
        batch.earliestDeliveryDeadline = Math.min(batch.earliestDeliveryDeadline, unit.deliveryDeadline);
      }
      if (unit.lockedAt) {
        batch.earliestLockedAt = Math.min(batch.earliestLockedAt, unit.lockedAt);
      }

      if (!storageLocationId) {
        batch.hasMissingLocation = true;
      } else if (!allowedLocationIds.includes(storageLocationId)) {
        batch.hasDisallowedLocation = true;
      }

      if (storageLocation && !batch.locations.find((loc: any) => loc.code === storageLocation.code)) {
        batch.locations.push({
          districtName: storageLocation.districtName,
          code: storageLocation.code,
        });
      }
    }

    let results = Array.from(batches.values());

    if (!isAdminSuper) {
      results = results.filter(
        (batch) => !batch.hasMissingLocation && !batch.hasDisallowedLocation
      );
    }

    results.sort((a, b) => {
      const aKey = Number.isFinite(a.earliestDeliveryDeadline)
        ? a.earliestDeliveryDeadline
        : a.earliestLockedAt;
      const bKey = Number.isFinite(b.earliestDeliveryDeadline)
        ? b.earliestDeliveryDeadline
        : b.earliestLockedAt;
      return aKey - bKey;
    });

    return {
      utids: results,
      totalUTIDs: results.length,
    };
  },
});

/**
 * Get wallet ledger entries grouped by UTID
 * 
 * Groups all wallet ledger entries by their UTID, showing
 * the complete transaction history for each UTID.
 */
export const getWalletLedgerByUTID = query({
  args: {
    adminId: v.id("users"),
    utid: v.optional(v.string()), // If provided, filter by specific UTID
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    let entries;
    if (args.utid) {
      // Get entries for specific UTID
      const utid = args.utid; // Type narrowing for TypeScript
      entries = await ctx.db
        .query("walletLedger")
        .withIndex("by_utid", (q) => q.eq("utid", utid))
        .collect();
    } else {
      // Get all entries
      entries = await ctx.db
        .query("walletLedger")
        .collect();
    }

    // Group by UTID
    const groupedByUtid = new Map<string, any[]>();
    for (const entry of entries) {
      if (!groupedByUtid.has(entry.utid)) {
        groupedByUtid.set(entry.utid, []);
      }
      groupedByUtid.get(entry.utid)!.push({
        entryId: entry._id,
        userId: entry.userId,
        type: entry.type,
        amount: entry.amount,
        balanceAfter: entry.balanceAfter,
        timestamp: entry.timestamp,
        metadata: entry.metadata,
      });
    }

    // Get user aliases for each entry
    const result = await Promise.all(
      Array.from(groupedByUtid.entries()).map(async ([utid, entries]) => {
        const userAliases = new Map<string, string>();
        for (const entry of entries) {
          if (!userAliases.has(entry.userId)) {
            const user = await ctx.db.get(entry.userId);
            // Type guard: ensure user exists and has alias property
            if (user && "alias" in user) {
              userAliases.set(entry.userId, user.alias);
            } else {
              userAliases.set(entry.userId, "unknown");
            }
          }
        }

        return {
          utid,
          entries: entries.map((e) => ({
            ...e,
            userAlias: userAliases.get(e.userId) || "unknown",
          })),
          totalEntries: entries.length,
          firstTimestamp: Math.min(...entries.map((e) => e.timestamp)),
          lastTimestamp: Math.max(...entries.map((e) => e.timestamp)),
        };
      })
    );

    // Sort by most recent
    result.sort((a, b) => b.lastTimestamp - a.lastTimestamp);

    return {
      totalUTIDs: result.length,
      groupedEntries: result,
    };
  },
});

/**
 * Get inventory units by status
 * 
 * Returns all listing units grouped by their status:
 * - available: Units available for traders to lock
 * - locked: Units locked by traders (awaiting delivery)
 * - delivered: Units delivered to traders
 * - cancelled: Units cancelled
 */
export const getInventoryUnitsByStatus = query({
  args: {
    adminId: v.id("users"),
    status: v.optional(v.union(
      v.literal("available"),
      v.literal("locked"),
      v.literal("delivered"),
      v.literal("cancelled")
    )),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    let units;
    if (args.status) {
      const status = args.status; // Type narrowing for TypeScript
      units = await ctx.db
        .query("listingUnits")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
    } else {
      // Get all units
      units = await ctx.db
        .query("listingUnits")
        .collect();
    }

    // Group by status
    const byStatus = new Map<string, any[]>();
    for (const unit of units) {
      const status = unit.status;
      if (!byStatus.has(status)) {
        byStatus.set(status, []);
      }
      byStatus.get(status)!.push(unit);
    }

    // Enrich with listing and user information
    const enriched = await Promise.all(
      Array.from(byStatus.entries()).map(async ([status, statusUnits]) => {
        const enrichedUnits = await Promise.all(
          statusUnits.map(async (unit) => {
            const listing = await ctx.db.get(unit.listingId);
            // Type guard: ensure listing exists and has farmerId property (it's a listing, not another table type)
            const farmer = listing && "farmerId" in listing ? await ctx.db.get(listing.farmerId as Id<"users">) : null;
            const trader = unit.lockedBy ? await ctx.db.get(unit.lockedBy) : null;

            return {
              unitId: unit._id,
              unitNumber: unit.unitNumber,
              listingId: unit.listingId,
              listingUtid: listing && "utid" in listing ? listing.utid : null,
              produceType: listing && "produceType" in listing ? listing.produceType : null,
              pricePerKilo: listing && "pricePerKilo" in listing ? listing.pricePerKilo : null,
              farmerAlias: farmer && "alias" in farmer ? farmer.alias : null,
              traderAlias: trader && "alias" in trader ? trader.alias : null,
              status: unit.status,
              lockedBy: unit.lockedBy,
              lockedAt: unit.lockedAt,
              lockUtid: unit.lockUtid,
              deliveryDeadline: unit.deliveryDeadline,
              deliveryStatus: unit.deliveryStatus,
            };
          })
        );

        return {
          status,
          count: enrichedUnits.length,
          units: enrichedUnits,
        };
      })
    );

    // Calculate totals
    const totals = {
      available: enriched.find((g) => g.status === "available")?.count || 0,
      locked: enriched.find((g) => g.status === "locked")?.count || 0,
      delivered: enriched.find((g) => g.status === "delivered")?.count || 0,
      cancelled: enriched.find((g) => g.status === "cancelled")?.count || 0,
      total: units.length,
    };

    return {
      totals,
      byStatus: enriched,
    };
  },
});

/**
 * Get delivery SLA status summary
 * 
 * Returns all units with delivery status information,
 * grouped by deliveryStatus (pending, delivered, late, cancelled).
 */
export const getDeliverySLAStatusSummary = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    const now = Date.now();

    // Get all locked units (they have delivery status)
    const lockedUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_status", (q) => q.eq("status", "locked"))
      .collect();

    // Group by delivery status
    const byDeliveryStatus = new Map<string, any[]>();

    for (const unit of lockedUnits) {
      const deliveryStatus = unit.deliveryStatus || "pending";
      if (!byDeliveryStatus.has(deliveryStatus)) {
        byDeliveryStatus.set(deliveryStatus, []);
      }

      const isPastDeadline = unit.deliveryDeadline
        ? now > unit.deliveryDeadline
        : false;

      const hoursRemaining = unit.deliveryDeadline
        ? Math.max(0, (unit.deliveryDeadline - now) / (1000 * 60 * 60))
        : null;

      const hoursOverdue = unit.deliveryDeadline && isPastDeadline
        ? (now - unit.deliveryDeadline) / (1000 * 60 * 60)
        : 0;

      byDeliveryStatus.get(deliveryStatus)!.push({
        unitId: unit._id,
        unitNumber: unit.unitNumber,
        listingId: unit.listingId,
        lockUtid: unit.lockUtid,
        lockedAt: unit.lockedAt,
        deliveryDeadline: unit.deliveryDeadline,
        deliveryStatus: unit.deliveryStatus,
        isPastDeadline,
        hoursRemaining: hoursRemaining !== null ? Math.round(hoursRemaining * 100) / 100 : null,
        hoursOverdue: Math.round(hoursOverdue * 100) / 100,
      });
    }

    // Convert to array format
    const summary = Array.from(byDeliveryStatus.entries()).map(([status, units]) => ({
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
      pending: summary.find((s) => s.deliveryStatus === "pending")?.count || 0,
      delivered: summary.find((s) => s.deliveryStatus === "delivered")?.count || 0,
      late: summary.find((s) => s.deliveryStatus === "late")?.count || 0,
      cancelled: summary.find((s) => s.deliveryStatus === "cancelled")?.count || 0,
      total: lockedUnits.length,
    };

    return {
      totals,
      byDeliveryStatus: summary,
      currentTime: now,
    };
  },
});

/**
 * Get buyer pickup deadlines
 * 
 * Returns all buyer purchases with pickup SLA information,
 * showing which purchases are approaching or past their 48-hour pickup deadline.
 */
export const getBuyerPickupDeadlines = query({
  args: {
    adminId: v.id("users"),
    status: v.optional(v.union(
      v.literal("pending_pickup"),
      v.literal("picked_up"),
      v.literal("expired")
    )),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    const now = Date.now();

    let purchases;
    if (args.status) {
      const status = args.status; // Type narrowing for TypeScript
      purchases = await ctx.db
        .query("buyerPurchases")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
    } else {
      purchases = await ctx.db
        .query("buyerPurchases")
        .collect();
    }

    // Enrich with pickup deadline information
    const enriched = await Promise.all(
      purchases.map(async (purchase) => {
        const buyer = await ctx.db.get(purchase.buyerId);
        const inventory = await ctx.db.get(purchase.inventoryId);
        const trader = inventory ? await ctx.db.get(inventory.traderId) : null;

        const isPastDeadline = now > purchase.pickupSLA;
        const hoursRemaining = Math.max(0, (purchase.pickupSLA - now) / (1000 * 60 * 60));
        const hoursOverdue = isPastDeadline
          ? (now - purchase.pickupSLA) / (1000 * 60 * 60)
          : 0;

        return {
          purchaseId: purchase._id,
          purchaseUtid: purchase.utid,
          buyerId: purchase.buyerId,
          buyerAlias: buyer?.alias || null,
          inventoryId: purchase.inventoryId,
          traderAlias: trader?.alias || null,
          kilos: purchase.kilos,
          produceType: inventory?.produceType || null,
          status: purchase.status,
          purchasedAt: purchase.purchasedAt,
          pickupSLA: purchase.pickupSLA,
          isPastDeadline,
          hoursRemaining: Math.round(hoursRemaining * 100) / 100,
          hoursOverdue: Math.round(hoursOverdue * 100) / 100,
        };
      })
    );

    // Sort by pickup deadline (earliest first, then overdue first)
    enriched.sort((a, b) => {
      if (a.isPastDeadline !== b.isPastDeadline) {
        return a.isPastDeadline ? -1 : 1; // Overdue first
      }
      return a.pickupSLA - b.pickupSLA;
    });

    // Group by status
    const byStatus = new Map<string, any[]>();
    for (const purchase of enriched) {
      const status = purchase.status;
      if (!byStatus.has(status)) {
        byStatus.set(status, []);
      }
      byStatus.get(status)!.push(purchase);
    }

    const totals = {
      pending_pickup: enriched.filter((p) => p.status === "pending_pickup").length,
      picked_up: enriched.filter((p) => p.status === "picked_up").length,
      expired: enriched.filter((p) => p.status === "expired").length,
      total: enriched.length,
      overdue: enriched.filter((p) => p.isPastDeadline && p.status === "pending_pickup").length,
    };

    return {
      totals,
      byStatus: Array.from(byStatus.entries()).map(([status, purchases]) => ({
        status,
        count: purchases.length,
        purchases,
      })),
      currentTime: now,
    };
  },
});

/**
 * Get all users (admin only)
 * 
 * Returns all users in the system with their roles and aliases.
 * Used for admin operations like sending notifications to selected users.
 */
export const getAllUsers = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const adminUser = await verifyAdmin(ctx, args.adminId);
    const isSuperAdmin = adminUser.adminLevel === "super" || adminUser.adminLevel === undefined;

    const users = await ctx.db.query("users").collect();

    return users.map((user) => ({
      userId: user._id,
      email: isSuperAdmin ? user.email : undefined,
      phoneNumber: isSuperAdmin ? user.phoneNumber : undefined,
      role: user.role,
      alias: user.alias,
      state: user.state,
      customSpendCap: user.customSpendCap,
      adminLevel: user.adminLevel,
      adminCategory: user.adminCategory,
      serviceLevel: user.serviceLevel,
      allowedStorageLocationIds: user.allowedStorageLocationIds,
      ...(user.role === "farmer" ? {
        districtId: user.districtId,
        subcountyId: user.subcountyId,
        parishId: user.parishId,
        farmSizeAcres: user.farmSizeAcres,
      } : {}),
    }));

  },
});

/**
 * Get user by ID (admin only)
 */
export const getUserById = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }
    
    return {
      userId: user._id,
      email: user.email,
      role: user.role,
      alias: user.alias,
      state: user.state,
      adminLevel: user.adminLevel,
      allowedStorageLocationIds: user.allowedStorageLocationIds,
    };
  },
});