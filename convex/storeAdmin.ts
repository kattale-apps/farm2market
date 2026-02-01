/**
 * StoreAdmin Functions
 * 
 * - StoreAdmins (junior admins) can verify deliveries for their assigned locations
 * - Must provide comment; photos are optional (weighing, checking, in-storage)
 * - PDF generation for delivery proof
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { generateUTID, getUgandaTime } from "./utils";
import { verifyAdminRole } from "./auth";
import { Id } from "./_generated/dataModel";

/**
 * Check if admin is SuperAdmin
 */
function isSuperAdmin(user: { adminLevel?: "super" | "junior" }): boolean {
  return user.adminLevel === "super" || user.adminLevel === undefined;
}

/**
 * Check if admin can access a specific storage location
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
  
  return false;
}

/**
 * Get UTIDs available for StoreAdmin verification
 * Only shows UTIDs from assigned storage locations
 */
export const getStoreAdminUTIDs = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    // Verify admin role
    const adminCheck = await verifyAdminRole({
      userId: args.adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can access this");
    }

    const adminUser = await ctx.db.get(args.adminId);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("User is not an admin");
    }

    // Get all locked units with farmer_confirmed status
    const allUnits = await ctx.db.query("listingUnits").collect();
    const confirmedUnits = allUnits.filter(
      (u) => u.status === "locked" && u.deliveryStatus === "farmer_confirmed"
    );

    // Filter by StoreAdmin's assigned locations
    const accessibleUnits: any[] = [];
    for (const unit of confirmedUnits) {
      const listing = await ctx.db.get(unit.listingId);
      if (!listing || !listing.storageLocationId) continue;

      // SuperAdmin can see all, StoreAdmin only assigned locations
      if (isSuperAdmin(adminUser) || canAdminAccessLocation(adminUser, listing.storageLocationId)) {
        accessibleUnits.push({
          unitId: unit._id,
          lockUtid: unit.lockUtid,
          listingId: listing._id,
          produceType: listing.produceType,
          storageLocationId: listing.storageLocationId,
          lockedAt: unit.lockedAt,
        });
      }
    }

    // Group by UTID
    const utidMap = new Map<string, any>();
    for (const unit of accessibleUnits) {
      if (!unit.lockUtid) continue;
      
      if (!utidMap.has(unit.lockUtid)) {
        utidMap.set(unit.lockUtid, {
          utid: unit.lockUtid,
          units: [],
          produceType: unit.produceType,
          storageLocationId: unit.storageLocationId,
        });
      }
      utidMap.get(unit.lockUtid)!.units.push(unit);
    }

    return Array.from(utidMap.values());
  },
});

/**
 * Verify delivery with comment and photos (StoreAdmin only)
 * Creates PDF and links to UTID
 */
export const verifyDeliveryWithProof = mutation({
  args: {
    adminId: v.id("users"),
    lockUtid: v.string(),
    comment: v.string(),
    photoIds: v.optional(v.array(v.string())), // Optional photo storage IDs
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify admin role
    const adminCheck = await verifyAdminRole({
      userId: args.adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can verify deliveries");
    }

    const adminUser = await ctx.db.get(args.adminId);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("User is not an admin");
    }

    // Validate inputs
    if (!args.comment.trim()) {
      throw new Error("Comment is required");
    }

    if (!args.reason.trim()) {
      throw new Error("Reason is required");
    }

    // Find all units locked with this UTID
    const allUnits = await ctx.db.query("listingUnits").collect();
    const lockedUnits = allUnits.filter(
      (u) => u.status === "locked" && u.lockUtid === args.lockUtid
    );

    if (lockedUnits.length === 0) {
      throw new Error(`No locked units found with UTID: ${args.lockUtid}`);
    }

    // Verify StoreAdmin has access to all locations in this UTID
    if (!isSuperAdmin(adminUser)) {
      for (const unit of lockedUnits) {
        const listing = await ctx.db.get(unit.listingId);
        if (!listing || !listing.storageLocationId) {
          throw new Error("Listing missing storage location");
        }

        if (!canAdminAccessLocation(adminUser, listing.storageLocationId)) {
          const location = await ctx.db.get(listing.storageLocationId);
          const locationName = location ? location.districtName : listing.storageLocationId;
          throw new Error(
            `You do not have permission to verify deliveries for location: ${locationName}`
          );
        }
      }
    }

    // Generate UTID for verification action
    const verificationUtid = generateUTID(adminUser.role);

    // Update units with delivery verification info
    const photoIds = args.photoIds ?? [];

    for (const unit of lockedUnits) {
      await ctx.db.patch(unit._id, {
        deliveryStatus: "delivered",
        deliveryComment: args.comment.trim(),
        deliveryPhotos: photoIds,
        // PDF will be generated separately and linked via deliveryPdfId
      });
    }

    // Log admin action
    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      actionType: "verify_delivery_with_proof",
      utid: verificationUtid,
      reason: args.reason.trim(),
      metadata: {
        comment: args.comment.trim(),
        photoCount: photoIds.length,
      },
      timestamp: getUgandaTime(),
    });

    return { utid: verificationUtid, lockUtid: args.lockUtid };
  },
});

/**
 * Link PDF to delivery verification
 * PDF is generated separately (client-side or via scheduled function)
 */
export const linkDeliveryPDF = mutation({
  args: {
    adminId: v.id("users"),
    lockUtid: v.string(),
    pdfId: v.string(), // PDF storage ID or URL
  },
  handler: async (ctx, args) => {
    // Verify admin role
    const adminCheck = await verifyAdminRole({
      userId: args.adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can link PDFs");
    }

    const adminUser = await ctx.db.get(args.adminId);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("User is not an admin");
    }

    // Find all units locked with this UTID
    const allUnits = await ctx.db.query("listingUnits").collect();
    const lockedUnits = allUnits.filter(
      (u) => u.status === "locked" && u.lockUtid === args.lockUtid
    );

    if (lockedUnits.length === 0) {
      throw new Error(`No locked units found with UTID: ${args.lockUtid}`);
    }

    // Update units with PDF ID
    for (const unit of lockedUnits) {
      await ctx.db.patch(unit._id, {
        deliveryPdfId: args.pdfId,
      });
    }

    return { success: true };
  },
});
