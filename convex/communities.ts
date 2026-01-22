/**
 * Grower Communities
 * 
 * - SuperAdmin creates communities
 * - Can be global or geo-locked
 * - Farmers can join communities
 * - Listings can be tagged to communities
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
 * Get all communities (for farmers to browse and join)
 */
export const getActiveCommunities = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const communities = await ctx.db.query("communities").collect();

    // Get user's location if provided (for geo-locking check)
    let userDistrictId: Id<"districts"> | undefined;
    let userSubcountyId: Id<"subcounties"> | undefined;
    let userParishId: Id<"parishes"> | undefined;

    if (args.userId) {
      const user = await ctx.db.get(args.userId);
      if (user) {
        userDistrictId = user.districtId;
        userSubcountyId = user.subcountyId;
        userParishId = user.parishId;
      }
    }

    // Filter communities user can see
    const accessibleCommunities = communities.filter((c) => {
      if (c.isGlobal) return true;
      if (!c.geoLocked) return true;

      // Check geo-locking
      if (userDistrictId && c.districtIds?.includes(userDistrictId)) return true;
      if (userSubcountyId && c.subcountyIds?.includes(userSubcountyId)) return true;
      if (userParishId && c.parishIds?.includes(userParishId)) return true;

      return false;
    });

    // Get membership status for each community
    const communitiesWithMembership = await Promise.all(
      accessibleCommunities.map(async (c) => {
        let isMember = false;
        if (args.userId) {
          const membership = await ctx.db
            .query("communityMemberships")
            .withIndex("by_community_user", (q) =>
              q.eq("communityId", c._id).eq("userId", args.userId!)
            )
            .first();
          isMember = !!membership;
        }

        // Get member count
        const memberships = await ctx.db
          .query("communityMemberships")
          .withIndex("by_community", (q) => q.eq("communityId", c._id))
          .collect();

        return {
          id: c._id,
          name: c.name,
          description: c.description,
          isGlobal: c.isGlobal,
          geoLocked: c.geoLocked,
          isMember,
          memberCount: memberships.length,
        };
      })
    );

    return communitiesWithMembership;
  },
});

/**
 * Create a community (SuperAdmin only)
 */
export const createCommunity = mutation({
  args: {
    adminId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    isGlobal: v.boolean(),
    geoLocked: v.boolean(),
    districtIds: v.optional(v.array(v.id("districts"))),
    subcountyIds: v.optional(v.array(v.id("subcounties"))),
    parishIds: v.optional(v.array(v.id("parishes"))),
  },
  handler: async (ctx, args) => {
    // Verify admin role
    const adminCheck = await verifyAdminRole({
      userId: args.adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can create communities");
    }

    const adminUser = await ctx.db.get(args.adminId);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("User is not an admin");
    }

    // Only SuperAdmin can create communities
    if (!isSuperAdmin(adminUser)) {
      throw new Error("Only SuperAdmin can create communities");
    }

    if (!args.name.trim()) {
      throw new Error("Community name cannot be empty");
    }

    // Validate geo-locking
    if (args.geoLocked && args.isGlobal) {
      throw new Error("Community cannot be both global and geo-locked");
    }

    if (args.geoLocked) {
      const hasLocation =
        (args.districtIds && args.districtIds.length > 0) ||
        (args.subcountyIds && args.subcountyIds.length > 0) ||
        (args.parishIds && args.parishIds.length > 0);

      if (!hasLocation) {
        throw new Error("Geo-locked communities must have at least one location");
      }
    }

    // Generate UTID
    const utid = generateUTID(adminUser.role);

    // Create community
    const communityId = await ctx.db.insert("communities", {
      name: args.name.trim(),
      description: args.description?.trim(),
      isGlobal: args.isGlobal,
      geoLocked: args.geoLocked,
      districtIds: args.districtIds,
      subcountyIds: args.subcountyIds,
      parishIds: args.parishIds,
      createdBy: args.adminId,
      createdAt: getUgandaTime(),
      utid,
    });

    // Log admin action
    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      actionType: "create_community",
      utid,
      reason: `Created community: ${args.name}`,
      timestamp: getUgandaTime(),
    });

    return { communityId, utid };
  },
});

/**
 * Join a community (farmer only)
 */
export const joinCommunity = mutation({
  args: {
    farmerId: v.id("users"),
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    // Verify user is a farmer
    const farmer = await ctx.db.get(args.farmerId);
    if (!farmer || farmer.role !== "farmer") {
      throw new Error("Only farmers can join communities");
    }

    // Verify community exists
    const community = await ctx.db.get(args.communityId);
    if (!community) {
      throw new Error("Community not found");
    }

    // Check if already a member
    const existing = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community_user", (q) =>
        q.eq("communityId", args.communityId).eq("userId", args.farmerId)
      )
      .first();

    if (existing) {
      throw new Error("Already a member of this community");
    }

    // Check geo-locking
    if (community.geoLocked && !community.isGlobal) {
      const hasAccess =
        (farmer.districtId && community.districtIds?.includes(farmer.districtId)) ||
        (farmer.subcountyId && community.subcountyIds?.includes(farmer.subcountyId)) ||
        (farmer.parishId && community.parishIds?.includes(farmer.parishId));

      if (!hasAccess) {
        throw new Error("You do not have access to this geo-locked community");
      }
    }

    // Join community
    await ctx.db.insert("communityMemberships", {
      communityId: args.communityId,
      userId: args.farmerId,
      joinedAt: getUgandaTime(),
    });

    return { success: true };
  },
});

/**
 * Leave a community (farmer only)
 */
export const leaveCommunity = mutation({
  args: {
    farmerId: v.id("users"),
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    // Verify user is a farmer
    const farmer = await ctx.db.get(args.farmerId);
    if (!farmer || farmer.role !== "farmer") {
      throw new Error("Only farmers can leave communities");
    }

    // Find membership
    const membership = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community_user", (q) =>
        q.eq("communityId", args.communityId).eq("userId", args.farmerId)
      )
      .first();

    if (!membership) {
      throw new Error("Not a member of this community");
    }

    // Remove membership
    await ctx.db.delete(membership._id);

    return { success: true };
  },
});

/**
 * Tag a listing to a community (farmer only, for their own listings)
 */
export const tagListingToCommunity = mutation({
  args: {
    farmerId: v.id("users"),
    listingId: v.id("listings"),
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    // Verify user is a farmer
    const farmer = await ctx.db.get(args.farmerId);
    if (!farmer || farmer.role !== "farmer") {
      throw new Error("Only farmers can tag listings to communities");
    }

    // Verify listing belongs to farmer
    const listing = await ctx.db.get(args.listingId);
    if (!listing || listing.farmerId !== args.farmerId) {
      throw new Error("Listing not found or does not belong to you");
    }

    // Verify community exists
    const community = await ctx.db.get(args.communityId);
    if (!community) {
      throw new Error("Community not found");
    }

    // Check if already tagged
    const existing = await ctx.db
      .query("communityListingTags")
      .withIndex("by_listing", (q) => q.eq("listingId", args.listingId))
      .collect();

    const alreadyTagged = existing.some((t) => t.communityId === args.communityId);
    if (alreadyTagged) {
      throw new Error("Listing already tagged to this community");
    }

    // Tag listing
    await ctx.db.insert("communityListingTags", {
      listingId: args.listingId,
      communityId: args.communityId,
    });

    return { success: true };
  },
});

/**
 * Send notification to community (SuperAdmin only)
 */
export const notifyCommunity = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.id("communities"),
    title: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify admin role
    const adminCheck = await verifyAdminRole({
      userId: args.adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can send community notifications");
    }

    const adminUser = await ctx.db.get(args.adminId);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("User is not an admin");
    }

    // Only SuperAdmin can send community notifications
    if (!isSuperAdmin(adminUser)) {
      throw new Error("Only SuperAdmin can send community notifications");
    }

    // Get all community members
    const memberships = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .collect();

    // Generate UTID
    const utid = generateUTID(adminUser.role);

    // Send notification to each member
    for (const membership of memberships) {
      await ctx.db.insert("notifications", {
        userId: membership.userId,
        type: "role_based",
        title: args.title,
        message: args.message,
        utid,
        read: false,
        createdAt: getUgandaTime(),
      });
    }

    // Log admin action
    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      actionType: "notify_community",
      utid,
      reason: `Sent notification to community: ${args.communityId}`,
      timestamp: getUgandaTime(),
    });

    return { utid, notifiedCount: memberships.length };
  },
});
