/**
 * StoreAdmin Functions
 * 
 * - Storage and Transport Officers (junior admins, category "store") and super
 *   admins verify deliveries to any delivery point (a processor facility)
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

/** Storage and Transport Officers and super admins verify deliveries. */
function isDeliveryOfficer(user: { adminLevel?: "super" | "junior"; adminCategory?: string }): boolean {
  return isSuperAdmin(user) || user.adminCategory === "store";
}

/**
 * Get UTIDs available for StoreAdmin verification
 * Every delivery a farmer has confirmed, with its delivery point
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

    if (!isDeliveryOfficer(adminUser)) {
      throw new Error("Only a Storage and Transport Officer or super admin can verify deliveries");
    }
    const accessibleUnits: any[] = [];
    for (const unit of confirmedUnits) {
      const listing = await ctx.db.get(unit.listingId);
      if (!listing) continue;
      const processor = listing.deliveryProcessorId
        ? await ctx.db.query("processorProfiles").withIndex("by_userId", (q) => q.eq("userId", listing.deliveryProcessorId!)).first()
        : null;
      accessibleUnits.push({
        unitId: unit._id,
        lockUtid: unit.lockUtid,
        listingId: listing._id,
        produceType: listing.produceType,
        deliveryPoint: processor ? `${processor.facilityName}, ${processor.district}` : listing.collectionLocationText ?? "Collection at the farm",
        lockedAt: unit.lockedAt,
      });
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
          deliveryPoint: unit.deliveryPoint,
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

    if (!isDeliveryOfficer(adminUser)) {
      throw new Error("Only a Storage and Transport Officer or super admin can verify deliveries");
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
