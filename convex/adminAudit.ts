/**
 * SuperAdmin Oversight Panel
 * 
 * Allows SuperAdmin to:
 * - Select a StoreAdmin
 * - See all their UTIDs
 * - Download delivery PDFs
 * No personal identities exposed
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { verifyAdminRole } from "./auth";
import { Id } from "./_generated/dataModel";

/**
 * Check if admin is SuperAdmin
 */
function isSuperAdmin(user: { adminLevel?: "super" | "junior" }): boolean {
  return user.adminLevel === "super" || user.adminLevel === undefined;
}

/**
 * Get all StoreAdmins (junior admins)
 */
export const getStoreAdmins = query({
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

    // Only SuperAdmin can view StoreAdmins
    if (!isSuperAdmin(adminUser)) {
      throw new Error("Only SuperAdmin can view StoreAdmins");
    }

    // Get all junior admins
    const allUsers = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();

    const storeAdmins = allUsers.filter(
      (u) => u.adminLevel === "junior" && u.adminCategory === "store"
    );

    return storeAdmins.map((admin) => ({ id: admin._id, alias: admin.alias, email: admin.email || "" }));
  },
});

/**
 * Get all UTIDs for a specific StoreAdmin
 */
export const getStoreAdminUTIDs = query({
  args: {
    adminId: v.id("users"), // SuperAdmin requesting
    storeAdminId: v.id("users"), // StoreAdmin to audit
  },
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

    // Only SuperAdmin can audit StoreAdmins
    if (!isSuperAdmin(adminUser)) {
      throw new Error("Only SuperAdmin can audit StoreAdmins");
    }

    // Verify storeAdminId is a junior admin
    const storeAdmin = await ctx.db.get(args.storeAdminId);
    if (!storeAdmin || storeAdmin.role !== "admin" || storeAdmin.adminLevel !== "junior") {
      throw new Error("Invalid StoreAdmin");
    }

    // Get all admin actions by this StoreAdmin
    const adminActions = await ctx.db
      .query("adminActions")
      .withIndex("by_admin", (q) => q.eq("adminId", args.storeAdminId))
      .order("desc")
      .collect();

    // Get delivery verifications (actions with delivery proof)
    const deliveryActions = adminActions.filter(
      (a) => a.actionType === "verify_delivery_with_proof"
    );

    // Get UTIDs and associated data
    const utids = deliveryActions.map((action) => ({
      utid: action.utid,
      targetUtid: action.targetUtid,
      reason: action.reason,
      timestamp: action.timestamp,
      metadata: action.metadata,
    }));

    return {
      storeAdminAlias: storeAdmin.alias,
      storeAdminEmail: storeAdmin.email || "",
      totalActions: adminActions.length,
      deliveryVerifications: deliveryActions.length,
      utids,
    };
  },
});

/**
 * Exporter inventory held at processor facilities (all, or one facility)
 */
export const getStoreAdminInventory = query({
  args: {
    adminId: v.id("users"),
    storeAdminId: v.id("users"),
    processorId: v.optional(v.id("users")),
  },
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

    // Only SuperAdmin can audit StoreAdmins
    if (!isSuperAdmin(adminUser)) {
      throw new Error("Only SuperAdmin can audit StoreAdmins");
    }

    // Verify storeAdminId is a junior admin
    const storeAdmin = await ctx.db.get(args.storeAdminId);
    if (!storeAdmin || storeAdmin.role !== "admin" || storeAdmin.adminLevel !== "junior") {
      throw new Error("Invalid StoreAdmin");
    }

    const allInventory = await ctx.db.query("traderInventory").withIndex("by_status", (q) => q.eq("status", "in_storage")).take(5000);
    const locationInventory = args.processorId ? allInventory.filter((inv) => inv.deliveryProcessorId === args.processorId) : allInventory;

    // Calculate totals
    const totalKilos = locationInventory.reduce((sum, inv: any) => sum + inv.totalKilos, 0);
    const totalValue = locationInventory.reduce((sum, inv: any) => sum + (inv.totalKilos * inv.unitPrice), 0);

    // Group by produce type
    const byProduce = locationInventory.reduce((acc: any, inv: any) => {
      if (!acc[inv.produceType]) {
        acc[inv.produceType] = { kilos: 0, blocks: 0 };
      }
      acc[inv.produceType].kilos += inv.totalKilos;
      acc[inv.produceType].blocks += 1;
      return acc;
    }, {});

    return {
      totalKilos,
      totalValue,
      totalBlocks: locationInventory.length,
      byProduce,
    };
  },
});

/**
 * Get delivery PDF for a UTID
 */
export const getDeliveryPDF = query({
  args: {
    adminId: v.id("users"),
    lockUtid: v.string(),
  },
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

    // Only SuperAdmin can download PDFs
    if (!isSuperAdmin(adminUser)) {
      throw new Error("Only SuperAdmin can download delivery PDFs");
    }

    // Find units with this lockUtid
    const allUnits = await ctx.db.query("listingUnits").collect();
    const units = allUnits.filter((u) => u.lockUtid === args.lockUtid);

    if (units.length === 0) {
      throw new Error("No units found with this UTID");
    }

    // Get PDF ID from first unit (all should have same PDF)
    const pdfId = units[0].deliveryPdfId;
    const deliveryComment = units[0].deliveryComment;
    const deliveryPhotos = units[0].deliveryPhotos;

    return {
      lockUtid: args.lockUtid,
      pdfId,
      deliveryComment,
      deliveryPhotos,
      unitCount: units.length,
    };
  },
});
