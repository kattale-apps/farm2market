import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const updateUserRoleAndAssignment = mutation({
  args: {
    userId: v.id("users"),
    adminLevel: v.optional(v.string()),
    adminCategory: v.optional(v.string()),
    assignedCommunityIds: v.optional(v.array(v.id("communities"))),
  },
  handler: async (ctx, args) => {
    const patch: any = {};
    if (args.adminLevel !== undefined) patch.adminLevel = args.adminLevel || undefined;
    if (args.adminCategory !== undefined) patch.adminCategory = args.adminCategory || undefined;
    if (args.assignedCommunityIds !== undefined) patch.assignedCommunityIds = args.assignedCommunityIds.filter(Boolean);
    await ctx.db.patch(args.userId, patch);
    return { success: true };
  },
});
