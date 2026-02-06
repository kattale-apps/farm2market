import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// --- Audit Log ---
export const logAdminAction = mutation({
  args: {
    adminId: v.id("users"),
    action: v.string(),
    targetUserId: v.optional(v.id("users")),
    targetCommunityId: v.optional(v.id("communities")),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      action: args.action,
      targetUserId: args.targetUserId,
      targetCommunityId: args.targetCommunityId,
      details: args.details,
      timestamp: Date.now(),
    });
    return { success: true };
  },
});

// --- Create Admin ---
export const createAdmin = mutation({
  args: {
    adminId: v.id("users"), // superadmin performing the action
    email: v.string(),
    alias: v.string(),
    adminLevel: v.union(v.literal("super"), v.literal("junior")),
    adminCategory: v.union(v.literal("store"), v.literal("message"), v.literal("community"), v.literal("finance")),
    assignedCommunityIds: v.optional(v.array(v.id("communities"))),
    exportLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Only superadmin can create
    const admin = await ctx.db.get(args.adminId);
    if (!admin || admin.adminLevel !== "super") throw new Error("Only superadmin can create admins");
    const userId = await ctx.db.insert("users", {
      email: args.email,
      alias: args.alias,
      role: "admin",
      adminLevel: args.adminLevel,
      adminCategory: args.adminCategory,
      assignedCommunityIds: args.assignedCommunityIds || [],
      exportLimit: args.exportLimit || 5,
      state: "active",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      action: "create_admin",
      targetUserId: userId,
      details: `Created admin ${args.email} (${args.alias})`,
      timestamp: Date.now(),
    });
    return { userId };
  },
});

// --- Update Admin Role/Assignment/Export Limit ---
export const updateAdmin = mutation({
  args: {
    adminId: v.id("users"),
    userId: v.id("users"),
    adminLevel: v.optional(v.union(v.literal("super"), v.literal("junior"))),
    adminCategory: v.optional(v.union(v.literal("store"), v.literal("message"), v.literal("community"), v.literal("finance"))),
    assignedCommunityIds: v.optional(v.array(v.id("communities"))),
    exportLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Only superadmin can update
    const admin = await ctx.db.get(args.adminId);
    if (!admin || admin.adminLevel !== "super") throw new Error("Only superadmin can update admins");
    // Prevent superadmin from demoting themselves
    if (args.userId === args.adminId && args.adminLevel !== "super") throw new Error("Superadmin cannot demote themselves");
    const patch: any = {};
    if (args.adminLevel !== undefined) patch.adminLevel = args.adminLevel;
    if (args.adminCategory !== undefined) patch.adminCategory = args.adminCategory;
    if (args.assignedCommunityIds !== undefined) patch.assignedCommunityIds = args.assignedCommunityIds;
    if (args.exportLimit !== undefined) patch.exportLimit = args.exportLimit;
    await ctx.db.patch(args.userId, patch);
    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      action: "update_admin",
      targetUserId: args.userId,
      details: `Updated admin ${args.userId}`,
      timestamp: Date.now(),
    });
    return { success: true };
  },
});

// --- Get Audit Log ---
export const getAdminAuditLog = query({
  args: {},
  handler: async (ctx, args) => {
    return await ctx.db.query("adminActions").order("desc").take(100);
  },
});
