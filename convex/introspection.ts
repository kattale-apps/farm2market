// convex/introspection.ts
import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Admin-only: get communities visible to the admin
 *
 * Rules:
 * - Super admin: sees all communities
 * - Community admin: sees only assigned communities
 * - All others: sees none
 */
export const getCommunitiesForAdmin = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.adminId);

    if (!user || user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const isSuperAdmin =
      user.adminLevel === "super" || user.adminLevel === undefined;

    // Super admin sees all communities
    if (isSuperAdmin) {
      return await ctx.db.query("communities").collect();
    }

    // Community admin sees only assigned communities
    if (
      user.adminCategory === "community" &&
      Array.isArray(user.assignedCommunityIds) &&
      user.assignedCommunityIds.length > 0
    ) {
      const communities = await Promise.all(
        user.assignedCommunityIds.map(
          (communityId: Id<"communities">) =>
            ctx.db.get(communityId)
        )
      );

      return communities.filter(
        (community): community is NonNullable<typeof community> =>
          community !== null
      );
    }

    // All other admins see nothing
    return [];
  },
});
/**
 * Super-admin only: get all users
 */
export const getAllUsers = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.adminId);

    if (!admin || admin.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const isSuperAdmin =
      admin.adminLevel === "super" || admin.adminLevel === undefined;

    if (!isSuperAdmin) {
      throw new Error("Forbidden");
    }

    const users = await ctx.db.query("users").collect();

    return users.map((u) => ({
      userId: u._id,
      alias: u.alias,
      email: u.email,
      phoneNumber: u.phoneNumber,
      role: u.role,
      adminLevel: u.adminLevel,
      adminCategory: u.adminCategory,
      assignedCommunityIds: u.assignedCommunityIds ?? [],
    }));
  },
});
