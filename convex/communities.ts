import { v } from "convex/values";
import { mutation, query, DatabaseReader } from "./_generated/server";
import { generateUTID, getUgandaTime } from "./utils";
import { verifyAdminRole } from "./auth";
import { Id } from "./_generated/dataModel";

/**
 * Grower Communities
 * 
 * - SuperAdmin creates communities
 * - Can be global or geo-locked
 * - Farmers can join communities
 * - Listings can be tagged to communities
 */

/**
 * Reusable helper: check if a user is a member of a given community.
 * Can be imported in other convex modules for authorisation checks.
 */
export async function isUserCommunityMember(
  db: DatabaseReader,
  userId: Id<"users">,
  communityId: Id<"communities">,
): Promise<boolean> {
  const membership = await db
    .query("communityMemberships")
    .withIndex("by_community_user", (q) =>
      q.eq("communityId", communityId).eq("userId", userId)
    )
    .first();
  return !!membership;
}

/**
 * Check if admin is SuperAdmin
 */
function isSuperAdmin(user: { adminLevel?: "super" | "junior"; adminCategory?: string }): boolean {
  return user.adminLevel === "super" || (user.adminLevel === undefined && !user.adminCategory);
}

function isCommunityAdmin(user: { adminLevel?: "super" | "junior"; adminCategory?: string }): boolean {
  return (user.adminLevel === "junior" && user.adminCategory === "community") ||
         (user.adminLevel === undefined && user.adminCategory === "community");
}

/**
 * Generate a unique alias for a user
 */
function generateAlias(role: string): string {
  const prefix = role.substring(0, 3); // "farmer" -> "far", "trader" -> "tra"
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${random}`;
}

/**
 * Simple hash function for passwords (NOT production-grade)
 * ⚠️ PILOT ONLY - Use proper password hashing in production
 */
function simpleHash(password: string): string {
  // Simple hash for pilot - NOT secure, just for testing
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Normalize phone number to a consistent format
 * Removes spaces, dashes, and ensures it starts with country code
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If it doesn't start with country code, assume Uganda (+256)
  // Uganda format: +256 7XX XXX XXX (remove leading 0 from local format)
  if (cleaned.startsWith('0')) {
    cleaned = '256' + cleaned.substring(1);
  } else if (!cleaned.startsWith('256')) {
    cleaned = '256' + cleaned;
  }
  
  return cleaned;
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



export const getCommunities = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // ...
  },
});

/**
 * Delete a community (SuperAdmin only)
 */
export const deleteCommunity = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    // Verify admin is superadmin
    const adminCheck = await verifyAdminRole({
      userId: args.adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can delete communities");
    }

    const adminUser = await ctx.db.get(args.adminId);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("User is not an admin");
    }

    // Only SuperAdmin can delete communities
    if (!isSuperAdmin(adminUser)) {
      throw new Error("Only SuperAdmin can delete communities");
    }

    // Verify community exists
    const community = await ctx.db.get(args.communityId);
    if (!community) {
      throw new Error("Community not found");
    }

    // Delete all community memberships
    const memberships = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .collect();
    for (const membership of memberships) {
      await ctx.db.delete(membership._id);
    }

    // Delete all community applications
    const applications = await ctx.db
      .query("communityApplications")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .collect();
    for (const application of applications) {
      await ctx.db.delete(application._id);
    }

    // Delete all community listing tags
    const tags = await ctx.db
      .query("communityListingTags")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .collect();
    for (const tag of tags) {
      await ctx.db.delete(tag._id);
    }

    // Remove community from all admin's assignedCommunityIds
    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();
    for (const admin of admins) {
      const assigned = (admin as any).assignedCommunityIds || [];
      const updated = assigned.filter((id: any) => String(id) !== String(args.communityId));
      if (updated.length !== assigned.length) {
        await ctx.db.patch(admin._id, {
          assignedCommunityIds: updated,
        });
      }
    }

    // Delete the community itself
    await ctx.db.delete(args.communityId);

    // Log admin action
    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      action: "delete_community",
      details: `Deleted community: ${community.name}`,
      timestamp: getUgandaTime(),
    });

    return { success: true };
  },
});

// ...
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
    let userRecord: { role?: string; adminLevel?: "super" | "junior"; adminCategory?: "store" | "message" | "community" | "finance" } | null = null;

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
      if (!isAdmin) {
        // Non-admins see based on global/geo-locking
        if (c.isGlobal) return true;
        if (!c.geoLocked) return true;
        
        // Check geo-locking
        if (userDistrictId && c.districtIds?.includes(userDistrictId)) return true;
        if (userSubcountyId && c.subcountyIds?.includes(userSubcountyId)) return true;
        if (userParishId && c.parishIds?.includes(userParishId)) return true;
        
        return false;
      }
      
      // Admins see based on their level
      const isSuperAdminCheck = userRecord && isSuperAdmin(userRecord);
      if (isSuperAdminCheck) return true; // SuperAdmins see all
      
      // Junior community admins see only their assigned communities
      const isJuniorCommunityAdminCheck = userRecord && isCommunityAdmin(userRecord);
      if (isJuniorCommunityAdminCheck) {
        const assignedIds = (userRecord as any).assignedCommunityIds || [];
        const normalizeAssignedId = (value: any) => {
          if (!value) return "";
          if (typeof value === "string") return value;
          if (typeof value === "object") {
            return String((value as any)._id ?? (value as any).id ?? value);
          }
          return String(value);
        };
        const assignedSet = new Set(assignedIds.map(normalizeAssignedId).filter(Boolean));
        return assignedSet.has(String(c._id)) || c.communityAdminId === args.userId;
      }
      
      // Other junior admins see all
      return true;
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
          logoPath: (c as any).logoPath,
          communityAdminId: (c as any).communityAdminId,
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
 * Get community by QR slug (public query for QR code join flows)
 * Returns community details needed for QR join functionality
 */
export const getCommunityByQrSlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const community = await ctx.db
      .query("communities")
      .filter((q) => q.eq(q.field("qrSlug"), args.slug))
      .first();

    if (!community) {
      return null;
    }

    return {
      _id: community._id,
      name: community.name,
      qrLogoUrl: (community as any).qrLogoUrl,
      qrEnabled: (community as any).qrEnabled,
    };
  },
});

/**
 * Search communities by name or description
 * Filters by user's access level (geo-locked vs global)
 */
export const searchCommunities = query({
  args: {
    query: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (!args.query.trim()) {
      return [];
    }

    const searchTerm = args.query.trim().toLowerCase();
    const allCommunities = await ctx.db.query("communities").collect();

    // Get user's location if provided
    let userDistrictId: Id<"districts"> | undefined;
    let userSubcountyId: Id<"subcounties"> | undefined;
    let userParishId: Id<"parishes"> | undefined;
    let isAdmin = false;
    let userRecord: { role?: string; adminLevel?: "super" | "junior"; adminCategory?: string } | null = null;

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

    // Filter and search communities
    const results = allCommunities.filter((c) => {
      // Check access
      if (!isAdmin) {
        if (!c.isGlobal && c.geoLocked) {
          const hasAccess =
            (userDistrictId && c.districtIds?.includes(userDistrictId)) ||
            (userSubcountyId && c.subcountyIds?.includes(userSubcountyId)) ||
            (userParishId && c.parishIds?.includes(userParishId));
          if (!hasAccess) return false;
        }
      }

      // Search in name and description
      const name = c.name.toLowerCase();
      const description = (c.description || "").toLowerCase();
      return name.includes(searchTerm) || description.includes(searchTerm);
    });

    // Return limited results with essential info
    return results.slice(0, 10).map((c) => ({
      _id: c._id,
      name: c.name,
      description: c.description,
      logoPath: (c as any).logoPath,
      isGlobal: c.isGlobal,
    }));
  },
});

/**
 * Search QR-enabled communities by name
 * Searches communities with QR feature enabled, ordered by priority and name
 */
export const searchQrCommunities = query({
  args: {
    searchText: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.searchText.trim()) {
      return [];
    }

    const searchTerm = args.searchText.trim().toLowerCase();
    
    // Get all communities with QR enabled
    const communities = await ctx.db
      .query("communities")
      .filter((q) => q.eq(q.field("qrEnabled"), true))
      .collect();

    // Filter by name match and sort
    const results = communities
      .filter((c) => c.name.toLowerCase().includes(searchTerm))
      .sort((a, b) => {
        // Sort by searchPriorityScore descending
        const scoreA = a.searchPriorityScore ?? 0;
        const scoreB = b.searchPriorityScore ?? 0;
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
        // Then by name ascending
        return a.name.localeCompare(b.name);
      })
      .slice(0, 10)
      .map((c) => ({
        _id: c._id,
        name: c.name,
        description: c.description,
        logoPath: (c as any).logoPath,
        qrSlug: c.qrSlug,
        qrLogoUrl: c.qrLogoUrl,
      }));

    return results;
  },
});

/**
 * Get user's joined communities
 */
export const getUserCommunities = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get all community memberships for the user
    const memberships = await ctx.db
      .query("communityMemberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Get community details for each membership
    const communities = await Promise.all(
      memberships.map(async (m) => {
        const community = await ctx.db.get(m.communityId);
        if (!community) return null;
        return {
          _id: community._id,
          name: community.name,
          description: community.description,
          logoPath: (community as any).logoPath,
          isGlobal: community.isGlobal,
          joinedAt: m.joinedAt,
        };
      })
    );

    return communities.filter((c) => c !== null);
  },
});

/**
 * Join community via QR code
 * 
 * Flow:
 * 1. Find community by slug
 * 2. If user does not exist → create with email/phone
 * 3. Save onboardedViaCommunityId
 * 4. Join user to community
 */
export const joinCommunityByQr = mutation({
  args: {
    slug: v.string(),
    email: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    password: v.optional(v.string()), // Required if user is new
    userId: v.optional(v.id("users")), // If existing user is joining
  },
  handler: async (ctx, args) => {
    // 1. Find community by slug
    const community = await ctx.db
      .query("communities")
      .filter((q) => q.eq(q.field("qrSlug"), args.slug))
      .first();

    if (!community) {
      throw new Error("Community not found");
    }

    if (!(community as any).qrEnabled) {
      throw new Error("QR code feature is not enabled for this community");
    }

    let userId: Id<"users"> | undefined;

    if (args.userId) {
      // Existing user joining
      userId = args.userId;
      const user = await ctx.db.get(userId);
      if (!user) {
        throw new Error("User not found");
      }
    } else {
      // Need to create or find user
      if (!args.email && !args.phoneNumber) {
        throw new Error("Either email or phone number is required");
      }

      // Try to find existing user by email or phone
      let user = null;
      if (args.email) {
        const normalizedEmail = args.email.trim().toLowerCase();
        user = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
          .first();
      }

      if (!user && args.phoneNumber) {
        const normalizedPhone = normalizePhoneNumber(args.phoneNumber);
        user = await ctx.db
          .query("users")
          .withIndex("by_phone", (q) => q.eq("phoneNumber", normalizedPhone))
          .first();
      }

      if (user) {
        // User exists, use their ID
        userId = user._id;
      } else {
        // Create new user
        if (!args.password) {
          throw new Error("Password is required to create a new account");
        }

        const normalizedEmail = args.email ? args.email.trim().toLowerCase() : undefined;
        const normalizedPhone = args.phoneNumber ? normalizePhoneNumber(args.phoneNumber) : undefined;

        // Generate alias
        const alias = generateAlias("farmer");

        // Hash password (using simple hash for now - in production should use bcrypt)
        const passwordHash = simpleHash(args.password.trim());

        userId = await ctx.db.insert("users", {
          email: normalizedEmail,
          phoneNumber: normalizedPhone,
          role: "farmer",
          alias,
          state: "active",
          createdAt: getUgandaTime(),
          lastActiveAt: getUgandaTime(),
          passwordHash,
          onboardedViaCommunityId: community._id,
        });
      }
    }

    // 3-4. Update user with community scope fields
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("Failed to get user after creation");
    }

    // Update onboardedViaCommunityId if not already set
    const updates: any = {};
    if (!user.onboardedViaCommunityId) {
      updates.onboardedViaCommunityId = community._id;
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(userId, updates);
    }

    // 5. Join user to community
    // Check if already a member
    const existing = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community_user", (q) =>
        q.eq("communityId", community._id).eq("userId", userId)
      )
      .first();

    if (existing) {
      return {
        success: true,
        userId,
        communityId: community._id,
        message: "Already a member of this community",
        alreadyMember: true,
      };
    }

    // Add to community memberships
    await ctx.db.insert("communityMemberships", {
      communityId: community._id,
      userId,
      joinedAt: getUgandaTime(),
    });

    return {
      success: true,
      userId,
      communityId: community._id,
      message: "Successfully joined community",
      alreadyMember: false,
    };
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
    logoPath: v.optional(v.string()),
    isGlobal: v.boolean(),
    geoLocked: v.boolean(),
    regionKey: v.optional(v.string()),
    districtIds: v.optional(v.array(v.id("districts"))),
    subcountyIds: v.optional(v.array(v.id("subcounties"))),
    parishIds: v.optional(v.array(v.id("parishes"))),
    communityType: v.union(v.literal("farmer"), v.literal("trader"), v.literal("buyer")),
    // assignAdminId is fully optional - community admins can be assigned later
    assignAdminId: v.optional(v.id("users")),
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

    // Validate assigned community admin (if provided)
    let assignedAdminId: Id<"users"> | undefined = undefined;
    if (args.assignAdminId) {
      const targetAdmin = await ctx.db.get(args.assignAdminId);
      if (!targetAdmin) {
        throw new Error("Target admin user not found");
      }
      if (targetAdmin.role !== "admin" || targetAdmin.adminLevel !== "junior" || targetAdmin.adminCategory !== "community") {
        throw new Error("Assigned admin must be a junior community admin");
      }
      // Allow multiple community assignments to the same admin
      assignedAdminId = args.assignAdminId;
    }

    // Create community
    const communityId = await ctx.db.insert("communities", {
      name: args.name.trim(),
      description: args.description?.trim(),
      logoPath: args.logoPath?.trim(),
      communityAdminId: assignedAdminId,
      isGlobal: args.isGlobal,
      geoLocked: args.geoLocked,
      districtIds: resolvedDistrictIds,
      subcountyIds: resolvedSubcountyIds,
      parishIds: resolvedParishIds,
      createdBy: args.adminId,
      createdAt: getUgandaTime(),
      utid,
      communityType: args.communityType || "farmer",
    });

    // If assigning to a community admin, add to their assignedCommunityIds
    if (args.assignAdminId) {
      const targetAdmin = await ctx.db.get(args.assignAdminId);
      const currentAssigned = (targetAdmin as any)?.assignedCommunityIds || [];
      await ctx.db.patch(args.assignAdminId, {
        assignedCommunityIds: [...currentAssigned, communityId],
      });
    }

    // Log admin action
    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      action: "create_community",
      details: `Created community: ${args.name} (UTID: ${utid})`,
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
    logoPath: v.optional(v.string()),
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
    if (args.logoPath !== undefined) {
      updates.logoPath = args.logoPath?.trim();
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
      action: "update_community",
      details: `Updated community: ${community.name} (UTID: ${utid})`,
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
    reason: v.optional(v.string()),
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

    const isMessageAdmin =
      adminUser.adminLevel === "junior" && adminUser.adminCategory === "message";
    if (!isSuperAdmin(adminUser) && !isMessageAdmin) {
      throw new Error("Only SuperAdmin or Messages Admin can send community notifications");
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
      action: "notify_community",
      details: `Sent notification to community: ${args.communityId} (UTID: ${utid})`,
      reason: args.reason,
      timestamp: getUgandaTime(),
    });

    return { utid, notifiedCount: memberships.length };
  },
});

/**
 * Get export quota info for a user
 * - Returns remaining exports for current month
 * - Standard tier: 5 per month, Premium: unlimited
 */
export const getExportQuota = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get user
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get service level (default to Premium if not specified, or Standard if explicitly set)
    const serviceLevel = user.serviceLevel || "Premium";

    // Premium = unlimited
    if (serviceLevel === "Premium") {
      return {
        serviceLevel: "Premium",
        limit: -1, // -1 means unlimited
        used: 0,
        remaining: -1,
      };
    }

    // Standard = 5 per month
    const now = getUgandaTime();
    const currentMonth = new Date(now).toISOString().slice(0, 7); // "YYYY-MM"

    const exportsThisMonth = await ctx.db
      .query("exportLogs")
      .withIndex("by_user_month", (q) => q.eq("userId", args.userId).eq("month", currentMonth))
      .collect();

    const usedCount = exportsThisMonth.length;
    const limit = 5;
    const remaining = Math.max(0, limit - usedCount);

    return {
      serviceLevel: "Standard",
      limit,
      used: usedCount,
      remaining,
      canExport: remaining > 0,
    };
  },
});

/**
 * Check if user can export and log the export
 */
export const logExport = mutation({
  args: {
    userId: v.id("users"),
    exportType: v.string(),
    dataCount: v.number(),
  },
  handler: async (ctx, args) => {
    // Get user
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get service level
    const serviceLevel = user.serviceLevel || "Premium";

    // Premium users can always export
    if (serviceLevel === "Premium") {
      const now = getUgandaTime();
      const currentMonth = new Date(now).toISOString().slice(0, 7);
      
      await ctx.db.insert("exportLogs", {
        userId: args.userId,
        exportType: args.exportType,
        exportedAt: now,
        month: currentMonth,
        dataCount: args.dataCount,
      });
      
      return { success: true, remaining: -1, message: "Export successful" };
    }

    // Standard users: check quota
    const now = getUgandaTime();
    const currentMonth = new Date(now).toISOString().slice(0, 7);

    const exportsThisMonth = await ctx.db
      .query("exportLogs")
      .withIndex("by_user_month", (q) => q.eq("userId", args.userId).eq("month", currentMonth))
      .collect();

    const usedCount = exportsThisMonth.length;
    const limit = 5;

    if (usedCount >= limit) {
      throw new Error(`Export limit reached. You have used all ${limit} exports for this month. Upgrade to Premium for unlimited exports.`);
    }

    // Log the export
    await ctx.db.insert("exportLogs", {
      userId: args.userId,
      exportType: args.exportType,
      exportedAt: now,
      month: currentMonth,
      dataCount: args.dataCount,
    });

    const remaining = limit - usedCount - 1;
    return {
      success: true,
      remaining,
      message: `Export successful. ${remaining} export${remaining !== 1 ? "s" : ""} remaining this month.`,
    };
  },
});

/**
 * Set service level for a user (SuperAdmin only)
 */
export const setUserServiceLevel = mutation({
  args: {
    adminId: v.id("users"),
    userId: v.id("users"),
    serviceLevel: v.union(v.literal("Standard"), v.literal("Premium")),
  },
  handler: async (ctx, args) => {
    // Verify admin is SuperAdmin
    const adminCheck = await verifyAdminRole({
      userId: args.adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can set service levels");
    }

    const adminUser = await ctx.db.get(args.adminId);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("User is not an admin");
    }

    if (!isSuperAdmin(adminUser)) {
      throw new Error("Only SuperAdmin can set service levels");
    }

    // Get target user
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    // Only community admins should have service levels
    if (targetUser.role !== "admin" || targetUser.adminCategory !== "community") {
      throw new Error("Service levels only apply to community admins");
    }

    // Update service level
    await ctx.db.patch(args.userId, {
      serviceLevel: args.serviceLevel,
    });

    // Log admin action
    const utid = generateUTID(adminUser.role);
    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      action: "set_service_level",
      details: `Set service level for user ${targetUser.alias} to ${args.serviceLevel} (UTID: ${utid})`,
      timestamp: getUgandaTime(),
    });

    return { success: true, utid };
  },
});

/**
 * Get communities with billing configuration for SuperAdmin dashboard
 * Returns all communities with their pricing and quota settings (no usage totals)
 * For SuperAdmin community management dashboard
 */
export const getCommunitiesWithUsageForSuperadmin = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is SuperAdmin
    const adminUser = await ctx.db.get(args.adminId);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("Only admins can view community billing info");
    }

    if (!isSuperAdmin(adminUser)) {
      throw new Error("Only SuperAdmin can view community billing info");
    }

    // Get all communities and their monetisation settings
    const communities = await ctx.db.query("communities").collect();

    // Fetch monetisation settings for each community
    const communitiesWithPricing = await Promise.all(
      communities.map(async (c) => {
        const settings = await ctx.db
          .query("communityMonetisationSettings")
          .withIndex("by_community", (q) => q.eq("communityId", c._id))
          .first();

        return {
          _id: c._id,
          name: c.name,
          slug: c.qrSlug || c.name.toLowerCase().replace(/\s+/g, "-"),
          logo: c.logoPath,
          juniorAdminFreeMonthlyImageQuota: settings?.juniorAdminFreeMonthlyImageQuota || 0,
          juniorAdminImagePrice: settings?.juniorAdminImagePrice || 0,
          memberImageMessagePrice: settings?.memberImageMessagePrice || 0,
        };
      })
    );

    return communitiesWithPricing;
  },
});

/**
 * Update community pricing and quota settings (SuperAdmin only)
 */
export const updateCommunityPricing = mutation({
  args: {
    communityId: v.id("communities"),
    juniorAdminFreeMonthlyImageQuota: v.number(),
    juniorAdminImagePrice: v.number(),
    memberImageMessagePrice: v.number(),
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get admin user
    const adminUser = await ctx.db.get(args.adminId);
    if (!adminUser) {
      throw new Error("Admin user not found");
    }

    // Verify admin is superadmin
    const isAdmin = adminUser.role === "admin";
    if (!isAdmin || !isSuperAdmin(adminUser)) {
      throw new Error("Only SuperAdmin can update community pricing");
    }

    // Get community
    const community = await ctx.db.get(args.communityId);
    if (!community) {
      throw new Error("Community not found");
    }

    // Check if monetisation settings exist
    const existing = await ctx.db
      .query("communityMonetisationSettings")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing settings
      await ctx.db.patch(existing._id, {
        juniorAdminFreeMonthlyImageQuota: args.juniorAdminFreeMonthlyImageQuota,
        juniorAdminImagePrice: args.juniorAdminImagePrice,
        memberImageMessagePrice: args.memberImageMessagePrice,
        updatedAt: now,
        updatedBy: args.adminId,
      });
    } else {
      // Create new settings
      await ctx.db.insert("communityMonetisationSettings", {
        communityId: args.communityId,
        juniorAdminFreeMonthlyImageQuota: args.juniorAdminFreeMonthlyImageQuota,
        juniorAdminImagePrice: args.juniorAdminImagePrice,
        memberImageMessagePrice: args.memberImageMessagePrice,
        createdAt: now,
        updatedAt: now,
        updatedBy: args.adminId,
      });
    }

    return {
      _id: args.communityId,
      juniorAdminFreeMonthlyImageQuota: args.juniorAdminFreeMonthlyImageQuota,
      juniorAdminImagePrice: args.juniorAdminImagePrice,
      memberImageMessagePrice: args.memberImageMessagePrice,
    };
  },
});

/**
 * Create a QR Community
 * Simplified version for WhatsApp-style communities with QR code access
 */
export const createQRCommunity = mutation({
  args: {
    adminId: v.optional(v.id("users")), // Optional - will try to get from auth if not provided
    name: v.string(),
    slug: v.string(),
    logoUrl: v.optional(v.string()),
    juniorAdminFreeMonthlyImageQuota: v.number(),
    juniorAdminImagePrice: v.number(),
    memberImageMessagePrice: v.number(),
  },
  handler: async (ctx, args) => {
    let adminId = args.adminId;

    // If no adminId provided, try to get from auth context
    if (!adminId) {
      const authUser = await ctx.auth.getUserIdentity();
      if (!authUser) {
        throw new Error("Not authenticated");
      }

      // Find user in DB
      let user = null;
      if (authUser.email) {
        user = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", authUser.email))
          .first();
      }

      if (!user && authUser.phoneNumber) {
        user = await ctx.db
          .query("users")
          .withIndex("by_phone", (q) => q.eq("phoneNumber", authUser.phoneNumber))
          .first();
      }

      if (!user) {
        throw new Error("User not found");
      }

      adminId = user._id;
    }

    // Verify admin role
    const adminCheck = await verifyAdminRole({
      userId: adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can create communities");
    }

    const adminUser = await ctx.db.get(adminId);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("User is not an admin");
    }

    // Only SuperAdmin can create communities
    if (!isSuperAdmin(adminUser)) {
      throw new Error("Only SuperAdmin can create QR communities");
    }

    // Validate inputs
    if (!args.name.trim()) {
      throw new Error("Community name cannot be empty");
    }

    if (!args.slug.trim()) {
      throw new Error("Community slug cannot be empty");
    }

    // Check if slug is unique
    const existingCommunity = await ctx.db
      .query("communities")
      .filter((q) => q.eq(q.field("qrSlug"), args.slug))
      .first();

    if (existingCommunity) {
      throw new Error("Community slug already exists. Please choose a different one.");
    }

    // Validate pricing
    if (args.juniorAdminFreeMonthlyImageQuota < 0 || args.juniorAdminImagePrice < 0 || args.memberImageMessagePrice < 0) {
      throw new Error("Prices and quotas cannot be negative");
    }

    // Generate UTID
    const utid = generateUTID(adminUser.role);

    // Create QR community
    const communityId = await ctx.db.insert("communities", {
      name: args.name.trim(),
      logoPath: args.logoUrl?.trim(),
      createdBy: adminId,
      createdAt: getUgandaTime(),
      utid,
      isGlobal: true, // QR communities are global by default
      geoLocked: false,
      communityType: "farmer",
      // QR-specific fields
      qrEnabled: true,
      qrSlug: args.slug,
      qrLogoUrl: args.logoUrl?.trim(),
      searchPriorityScore: 100, // High priority for QR communities
    });

    // Create monetisation settings for the new community
    await ctx.db.insert("communityMonetisationSettings", {
      communityId: communityId,
      juniorAdminFreeMonthlyImageQuota: args.juniorAdminFreeMonthlyImageQuota,
      juniorAdminImagePrice: args.juniorAdminImagePrice,
      memberImageMessagePrice: args.memberImageMessagePrice,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      updatedBy: adminId,
    });

    // Log admin action
    await ctx.db.insert("adminActions", {
      adminId: adminId,
      action: "create_qr_community",
      details: `Created QR community: ${args.name} (slug: ${args.slug}, UTID: ${utid})`,
      timestamp: getUgandaTime(),
    });

    return {
      _id: communityId,
      name: args.name,
      slug: args.slug,
      logoUrl: args.logoUrl,
      qrEnabled: true,
    };
  },
});

/**
 * Get navigation context for the current user
 * 
 * Returns all information needed for role-based routing:
 * - Communities user is admin of
 * - Communities user is a member of
 * - Default community to navigate to
 * - Whether user is superadmin
 */
/**
 * Simple query to get the current user's ID for APIs that need it
 * This is much more reliable than getMyNavigationContext
 */
export const getCurrentUserId = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await ctx.auth.getUserIdentity();
    if (!authUser) {
      return { userId: null, isSuperadmin: false, error: "Not authenticated" };
    }

    // Find user in DB by email or phone
    let user = null;
    if (authUser.email) {
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", authUser.email))
        .first();
    }

    if (!user && authUser.phoneNumber) {
      user = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", authUser.phoneNumber))
        .first();
    }

    if (!user) {
      return { userId: null, isSuperadmin: false, error: "User not found" };
    }

    const isSuperadmin = user.adminLevel === "super" || user.adminLevel === undefined;
    return { userId: user._id, isSuperadmin, error: undefined };
  },
});

export const getMyNavigationContext = query({
  args: {},
  handler: async (ctx) => {
    const adminUser = await ctx.auth.getUserIdentity();
    if (!adminUser) {
      // Return empty context instead of throwing - allows graceful handling
      return {
        userId: null,
        isSuperadmin: false,
        adminCommunities: [],
        joinedCommunities: [],
        defaultCommunityId: null,
        error: "Not authenticated",
      };
    }

    // Get user from DB - try email first, fall back to any user lookup
    let user = null;
    
    // Try to find by email if available
    if (adminUser.email) {
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", adminUser.email))
        .first();
    }
    
    // If not found and we have phone, try that
    if (!user && adminUser.phoneNumber) {
      user = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", adminUser.phoneNumber))
        .first();
    }

    if (!user) {
      // Return empty context instead of throwing
      return {
        userId: null,
        isSuperadmin: false,
        adminCommunities: [],
        joinedCommunities: [],
        defaultCommunityId: null,
        error: "User not found",
      };
    }

    const userId = user._id;
    const isSuperadmin = user.adminLevel === "super" || user.adminLevel === undefined;

    // Get communities where user is the admin (via communityAdminId on community)
    const directAdminCommunities = await ctx.db
      .query("communities")
      .filter((q) => q.eq(q.field("communityAdminId"), userId))
      .collect();

    // Also get communities assigned via assignedCommunityIds on the user record
    const assignedIds: Id<"communities">[] = Array.isArray((user as any).assignedCommunityIds)
      ? (user as any).assignedCommunityIds
      : [];
    const assignedCommunities = (
      await Promise.all(assignedIds.map((id) => ctx.db.get(id)))
    ).filter((c): c is NonNullable<typeof c> => c !== null);

    // Merge and deduplicate
    const seenIds = new Set<string>();
    const adminCommunities = [...directAdminCommunities, ...assignedCommunities].filter((c) => {
      if (seenIds.has(String(c._id))) return false;
      seenIds.add(String(c._id));
      return true;
    });

    const adminCommunitiesMapped = adminCommunities.map((c) => ({
      communityId: c._id,
      name: c.name,
      slug: c.qrSlug || c.name.toLowerCase().replace(/\s+/g, "-"),
      logo: c.qrLogoUrl || c.logoPath,
    }));

    // Get communities where user is a member
    const membershipRecords = await ctx.db
      .query("communityMemberships")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    const joinedCommunities = [];
    for (const membership of membershipRecords) {
      const community = await ctx.db.get(membership.communityId);
      if (community) {
        joinedCommunities.push({
          communityId: community._id,
          name: community.name,
          slug: community.qrSlug || community.name.toLowerCase().replace(/\s+/g, "-"),
          logo: community.qrLogoUrl || community.logoPath,
        });
      }
    }

    // Determine default community ID
    let defaultCommunityId: Id<"communities"> | null = null;
    if (adminCommunitiesMapped.length > 0) {
      // Prefer admin communities
      const firstAdminCommunity = adminCommunities.find((c) =>
        adminCommunitiesMapped.some((mc) => mc.communityId === c._id)
      );
      defaultCommunityId = firstAdminCommunity?._id || null;
    } else if (joinedCommunities.length > 0) {
      // Fall back to first joined community
      const firstJoinedMembership = membershipRecords[0];
      defaultCommunityId = firstJoinedMembership?.communityId || null;
    }

    return {
      userId,
      isSuperadmin,
      adminCommunities: adminCommunitiesMapped,
      joinedCommunities,
      defaultCommunityId,
      error: undefined,
    };
  },
});
