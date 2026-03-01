import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";

/**
 * Get all admins for superadmin management
 */
export const getAllAdminsForPricing = query({
  args: {},
  handler: async (ctx) => {
    const admins = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .collect();

    const withQuotas = await Promise.all(
      admins.map(async (admin) => {
        const communities = await ctx.db
          .query("communities")
          .filter((q) => q.eq(q.field("communityAdminId"), admin._id))
          .collect();

        return {
          _id: admin._id,
          alias: (admin as any).alias || "Unknown",
          email: (admin as any).email || "—",
          role: admin.role,
          exportLimit: (admin as any).exportLimit ?? 5, // Default 5
          communityCount: communities.length,
          assignedCommunities: ((admin as any).assignedCommunityIds || []).length,
          serviceLevel: (admin as any).serviceLevel || "Standard",
          createdAt: admin.createdAt,
        };
      })
    );

    return withQuotas.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Update admin's service level (Standard or Premium)
 * Premium gets unlimited exports; Standard is capped by exportLimit
 */
export const updateAdminServiceLevel = mutation({
  args: {
    adminId: v.id("users"),
    serviceLevel: v.union(v.literal("Standard"), v.literal("Premium")),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.adminId);
    if (!admin) {
      throw new Error("Admin not found");
    }

    await ctx.db.patch(args.adminId, {
      serviceLevel: args.serviceLevel,
      updatedAt: getUgandaTime(),
    } as any);

    return { success: true, serviceLevel: args.serviceLevel };
  },
});

/**
 * Update admin's monthly export quota (for Standard tier only)
 */
export const updateAdminExportLimit = mutation({
  args: {
    adminId: v.id("users"),
    exportLimit: v.number(), // Positive integer (e.g., 5, 10, 20)
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.adminId);
    if (!admin) {
      throw new Error("Admin not found");
    }

    if (args.exportLimit <= 0) {
      throw new Error("Export limit must be > 0");
    }

    await ctx.db.patch(args.adminId, {
      exportLimit: args.exportLimit,
      updatedAt: getUgandaTime(),
    } as any);

    return { success: true, exportLimit: args.exportLimit };
  },
});

/**
 * Get pricing configuration (for superadmin to manage)
 */
export const getPricingConfig = query({
  args: {},
  handler: async (ctx) => {
    // Return hardcoded pricing for now
    // In a real system, this could be stored in a pricing table
    return {
      standardTierExportLimit: 5, // Default monthly exports for Standard
      premiumTierExportLimit: null, // Unlimited
      pricePerCell: 100, // UGX per row × column for form export
      formSubmission: 0, // Free
      noticeboardPost: 0, // Free (admin only)
      memberiImageMessage: 500, // UGX per image
    };
  },
});

/**
 * Get export quota and usage for a specific admin
 */
export const getAdminExportQuota = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.adminId);
    if (!admin) {
      throw new Error("Admin not found");
    }

    const serviceLevel = (admin as any).serviceLevel || "Standard";
    const exportLimit = (admin as any).exportLimit ?? 5;

    // Count exports this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const exports = await ctx.db
      .query("usageEvents")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.adminId),
          q.eq(q.field("eventType"), "export_members")
        )
      )
      .collect();

    const thisMonth = exports.filter((e) => e.createdAt >= monthStart);
    const used = thisMonth.length;
    const remaining = serviceLevel === "Premium" ? null : Math.max(0, exportLimit - used);

    return {
      adminId: args.adminId,
      serviceLevel,
      limit: serviceLevel === "Premium" ? "Unlimited" : exportLimit,
      used,
      remaining,
      resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
    };
  },
});
