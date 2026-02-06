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
      const allCommunities = await ctx.db.query("communities").collect();
      return await enrichWithStats(ctx, allCommunities);
    }

    // Community admin sees assigned communities or directly assigned via communityAdminId
    if (user.adminCategory === "community") {
      const assignedIds = Array.isArray(user.assignedCommunityIds)
        ? user.assignedCommunityIds
        : [];
      const directAssigned = await ctx.db
        .query("communities")
        .filter((q: any) => q.eq(q.field("communityAdminId"), args.adminId))
        .collect();
      const assignedCommunities = await Promise.all(
        assignedIds.map((communityId: Id<"communities">) =>
          ctx.db.get(communityId)
        )
      );

      const validCommunities = [
        ...assignedCommunities.filter(
          (community): community is NonNullable<typeof community> =>
            community !== null
        ),
        ...directAssigned,
      ];

      if (validCommunities.length > 0) {
        return await enrichWithStats(ctx, validCommunities);
      }
    }

    // All other admins see nothing
    return [];
  },
});

async function enrichWithStats(ctx: any, communities: any[]) {
  return await Promise.all(
    communities.map(async (c) => {
      const memberships = await ctx.db
        .query("communityMemberships")
        .withIndex("by_community", (q: any) => q.eq("communityId", c._id))
        .collect();
      return {
        ...c,
        memberCount: memberships.length,
      };
    })
  );
}

/**
 * Admin-only: get members of a specific community
 */
export const getCommunityMembers = query({
  args: {
    adminId: v.id("users"),
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.adminId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized");

    const isSuperAdmin = user.adminLevel === "super" || user.adminLevel === undefined;
    
    // Check permissions
    if (!isSuperAdmin) {
      if (user.adminCategory !== "community") throw new Error("Forbidden");
      if (!user.assignedCommunityIds?.includes(args.communityId)) throw new Error("Forbidden");
    }

    const memberships = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .collect();

    return await Promise.all(memberships.map(async (m) => {
      const memberUser = await ctx.db.get(m.userId);
      return {
        ...memberUser,
        joinedAt: m.joinedAt,
      };
    }));
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
