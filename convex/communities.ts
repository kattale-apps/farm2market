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

function isCommunityAdmin(user: { adminLevel?: "super" | "junior"; adminCategory?: "store" | "message" | "community" }): boolean {
  return user.adminLevel === "junior" && user.adminCategory === "community";
}

const normalizeName = (name: string) => name.trim().toLowerCase();

const REGION_GROUPS: { key: string; districts: string[] }[] = [
  {
    key: "central_buganda",
    districts: [
      "Kampala", "Wakiso", "Mukono", "Buikwe", "Kayunga",
      "Luweero", "Nakaseke", "Nakasongola", "Mityana", "Kiboga",
      "Mpigi", "Butambala", "Gomba", "Masaka",
      "Lwengo", "Kalungu", "Bukomansimbi", "Sembabule", "Lyantonde",
      "Rakai", "Kyotera", "Mubende", "Kassanda"
    ],
  },
  {
    key: "eastern_busoga",
    districts: [
      "Jinja", "Mayuge", "Iganga", "Bugiri", "Namayingo", "Buyende",
      "Kaliro", "Kamuli", "Luuka", "Namutumba"
    ],
  },
  {
    key: "eastern_teso",
    districts: ["Soroti", "Kaberamaido", "Serere", "Kalaki", "Amuria", "Katakwi", "Kumi", "Bukedea", "Ngora", "Kapelebyong"],
  },
  {
    key: "eastern_elgon",
    districts: ["Mbale", "Manafwa", "Bududa", "Sironko", "Bulambuli", "Bungokho"],
  },
  {
    key: "eastern_other",
    districts: ["Tororo", "Busia", "Butaleja", "Budaka", "Pallisa", "Kibuku", "Butebo"],
  },
  {
    key: "northern_acholi",
    districts: ["Gulu", "Nwoya", "Amuru", "Pader", "Kitgum", "Lamwo", "Agago", "Omoro"],
  },
  {
    key: "northern_lango",
    districts: ["Lira", "Dokolo", "Alebtong", "Oyam", "Apac", "Kole", "Amolatar", "Kwania"],
  },
  {
    key: "northern_westnile",
    districts: ["Arua", "Moyo", "Adjumani", "Yumbe", "Koboko", "Maracha", "Terego", "Zombo", "Nebbi", "Pakwach"],
  },
  {
    key: "northern_karamoja",
    districts: ["Moroto", "Kotido", "Kaabong", "Abim", "Nakapiripirit", "Napak", "Amudat", "Nabilatuk", "Karenga"],
  },
  {
    key: "western_tooro",
    districts: ["Fort Portal", "Kabarole", "Kamwenge", "Kyenjojo", "Kyegegwa", "Bunyangabu"],
  },
  {
    key: "western_bunyoro",
    districts: ["Hoima", "Kikuube", "Masindi", "Kiryandongo", "Buliisa", "Kagadi", "Kakumiro", "Kyankwanzi"],
  },
  {
    key: "western_ankole",
    districts: ["Mbarara", "Isingiro", "Ntungamo", "Bushenyi", "Sheema", "Mitooma", "Rubirizi", "Buhweju", "Rukungiri", "Kanungu"],
  },
  {
    key: "western_kigezi",
    districts: ["Kabale", "Kisoro", "Rukiga"],
  },
];

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
    let isAdmin = false;
    let userRecord: { role?: string; adminLevel?: "super" | "junior"; adminCategory?: "store" | "message" | "community" } | null = null;

    if (args.userId) {
      const user = await ctx.db.get(args.userId);
      if (user) {
        userRecord = user;
        isAdmin = user.role === "admin";
        userDistrictId = user.districtId;
        userSubcountyId = user.subcountyId;
        userParishId = user.parishId;
      }
    }

    // Filter communities user can see
    const accessibleCommunities = communities.filter((c) => {
      if (isAdmin) return true;
      if (c.isGlobal) return true;
      if (!c.geoLocked) return true;

      // Check geo-locking
      if (userDistrictId && c.districtIds?.includes(userDistrictId)) return true;
      if (userSubcountyId && c.subcountyIds?.includes(userSubcountyId)) return true;
      if (userParishId && c.parishIds?.includes(userParishId)) return true;

      return false;
    });

    const isSuperAdminUser = isAdmin && !!userRecord && isSuperAdmin(userRecord);
    const isCommunityAdminUser = isAdmin && !!userRecord && isCommunityAdmin(userRecord);
    const canViewMemberDetails = isSuperAdminUser || isCommunityAdminUser;

    let farmerById = new Map<Id<"users">, any>();
    let allFarmers: any[] = [];
    if (canViewMemberDetails) {
      allFarmers = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "farmer"))
        .collect();
      farmerById = new Map(allFarmers.map((farmer) => [farmer._id, farmer]));
    }

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

        let memberDetails: Array<{ userId: Id<"users">; alias: string; email?: string; phoneNumber?: string }> | undefined;
        let nonMemberDetails: Array<{ userId: Id<"users">; alias: string; email?: string; phoneNumber?: string }> | undefined;
        if (canViewMemberDetails) {
          const memberIds = new Set(memberships.map((membership) => membership.userId));
          memberDetails = memberships.map((membership) => {
            const member = farmerById.get(membership.userId);
            return {
              userId: membership.userId,
              alias: member?.alias || "Unknown",
              email: member?.email,
              phoneNumber: member?.phoneNumber,
            };
          });
          nonMemberDetails = allFarmers
            .filter((farmer) => !memberIds.has(farmer._id))
            .map((farmer) => ({
              userId: farmer._id,
              alias: farmer.alias || "Unknown",
              email: farmer.email,
              phoneNumber: farmer.phoneNumber,
            }));
        }

        return {
          id: c._id,
          name: c.name,
          description: c.description,
          isGlobal: c.isGlobal,
          geoLocked: c.geoLocked,
          isMember,
          memberCount: memberships.length,
          members: memberDetails,
          nonMembers: nonMemberDetails,
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
    regionKey: v.optional(v.string()),
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

    let resolvedDistrictIds = args.districtIds;
    let resolvedSubcountyIds = args.subcountyIds;
    let resolvedParishIds = args.parishIds;

    if (args.geoLocked) {
      const hasExplicitLocation =
        (resolvedDistrictIds && resolvedDistrictIds.length > 0) ||
        (resolvedSubcountyIds && resolvedSubcountyIds.length > 0) ||
        (resolvedParishIds && resolvedParishIds.length > 0);

      if (!hasExplicitLocation && args.regionKey) {
        const regionGroup = REGION_GROUPS.find((group) => group.key === args.regionKey);
        if (!regionGroup) {
          throw new Error("Selected region is not recognized");
        }

        const allDistricts = await ctx.db.query("districts").collect();
        const regionDistrictIds = allDistricts
          .filter((district) =>
            district.active &&
            regionGroup.districts.some((name) => normalizeName(name) === normalizeName(district.name))
          )
          .map((district) => district._id);

        if (regionDistrictIds.length === 0) {
          throw new Error("Selected region has no active districts");
        }

        resolvedDistrictIds = regionDistrictIds;
      }

      const hasLocation =
        (resolvedDistrictIds && resolvedDistrictIds.length > 0) ||
        (resolvedSubcountyIds && resolvedSubcountyIds.length > 0) ||
        (resolvedParishIds && resolvedParishIds.length > 0);

      if (!hasLocation) {
        throw new Error("Geo-locked communities must include a region or at least one location");
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
      districtIds: resolvedDistrictIds,
      subcountyIds: resolvedSubcountyIds,
      parishIds: resolvedParishIds,
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
 * Update a community (SuperAdmin only)
 */
export const updateCommunity = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.id("communities"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isGlobal: v.optional(v.boolean()),
    geoLocked: v.optional(v.boolean()),
    regionKey: v.optional(v.string()),
    districtIds: v.optional(v.array(v.id("districts"))),
    subcountyIds: v.optional(v.array(v.id("subcounties"))),
    parishIds: v.optional(v.array(v.id("parishes"))),
  },
  handler: async (ctx, args) => {
    const adminCheck = await verifyAdminRole({
      userId: args.adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can update communities");
    }

    const adminUser = await ctx.db.get(args.adminId);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("User is not an admin");
    }
    if (!isSuperAdmin(adminUser)) {
      throw new Error("Only SuperAdmin can update communities");
    }

    const community = await ctx.db.get(args.communityId);
    if (!community) {
      throw new Error("Community not found");
    }

    const nextIsGlobal = args.isGlobal ?? community.isGlobal;
    const nextGeoLocked = args.geoLocked ?? community.geoLocked;

    if (nextGeoLocked && nextIsGlobal) {
      throw new Error("Community cannot be both global and geo-locked");
    }

    let resolvedDistrictIds = args.districtIds ?? community.districtIds;
    let resolvedSubcountyIds = args.subcountyIds ?? community.subcountyIds;
    let resolvedParishIds = args.parishIds ?? community.parishIds;

    if (nextGeoLocked) {
      const hasExplicitLocation =
        (resolvedDistrictIds && resolvedDistrictIds.length > 0) ||
        (resolvedSubcountyIds && resolvedSubcountyIds.length > 0) ||
        (resolvedParishIds && resolvedParishIds.length > 0);

      if (!hasExplicitLocation && args.regionKey) {
        const regionGroup = REGION_GROUPS.find((group) => group.key === args.regionKey);
        if (!regionGroup) {
          throw new Error("Selected region is not recognized");
        }

        const allDistricts = await ctx.db.query("districts").collect();
        const regionDistrictIds = allDistricts
          .filter((district) =>
            district.active &&
            regionGroup.districts.some((name) => normalizeName(name) === normalizeName(district.name))
          )
          .map((district) => district._id);

        if (regionDistrictIds.length === 0) {
          throw new Error("Selected region has no active districts");
        }

        resolvedDistrictIds = regionDistrictIds;
      }

      const hasLocation =
        (resolvedDistrictIds && resolvedDistrictIds.length > 0) ||
        (resolvedSubcountyIds && resolvedSubcountyIds.length > 0) ||
        (resolvedParishIds && resolvedParishIds.length > 0);

      if (!hasLocation) {
        throw new Error("Geo-locked communities must include a region or at least one location");
      }
    }

    const updates: any = {};
    if (args.name !== undefined) {
      updates.name = args.name.trim();
    }
    if (args.description !== undefined) {
      updates.description = args.description.trim();
    }
    if (args.isGlobal !== undefined) {
      updates.isGlobal = args.isGlobal;
    }
    if (args.geoLocked !== undefined) {
      updates.geoLocked = args.geoLocked;
    }
    if (resolvedDistrictIds !== undefined) {
      updates.districtIds = resolvedDistrictIds;
    }
    if (resolvedSubcountyIds !== undefined) {
      updates.subcountyIds = resolvedSubcountyIds;
    }
    if (resolvedParishIds !== undefined) {
      updates.parishIds = resolvedParishIds;
    }

    await ctx.db.patch(args.communityId, updates);

    const utid = generateUTID(adminUser.role);
    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      actionType: "update_community",
      utid,
      reason: `Updated community: ${community.name}`,
      timestamp: getUgandaTime(),
    });

    return { communityId: args.communityId, utid };
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
