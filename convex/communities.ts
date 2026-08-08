import { v } from "convex/values";
import { mutation, query, DatabaseReader } from "./_generated/server";
import { generateUTID, getUgandaTime } from "./utils";
import { verifyAdminRole } from "./auth";
import { Id } from "./_generated/dataModel";

const BIOFARM_COMMUNITY_ID = "ms72de3njrrc9k43cf9h3yq70181ncp0";

export type CommunityRole = "farmer" | "trader" | "buyer" | "vendor" | "transporter" | "store";

export function getCommunityDefaultRole(communityType?: string | null): CommunityRole {
  if (communityType === "trader" || communityType === "buyer" || communityType === "vendor" || communityType === "transporter" || communityType === "store") {
    return communityType;
  }
  return "farmer";
}

function isVendorOnlyCommunity(communityType?: string | null): boolean {
  return communityType === "vendor";
}

async function ensureCommunityMembership(
  ctx: any,
  communityId: Id<"communities">,
  userId: Id<"users">
) {
  const existing = await ctx.db
    .query("communityMemberships")
    .withIndex("by_community_user", (q: any) =>
      q.eq("communityId", communityId).eq("userId", userId)
    )
    .first();

  if (!existing) {
    await ctx.db.insert("communityMemberships", {
      communityId,
      userId,
      joinedAt: getUgandaTime(),
    });
    return true;
  }

  return false;
}

async function backfillMandatoryRoleMembershipForCommunity(
  ctx: any,
  communityId: Id<"communities">,
  role: CommunityRole
) {
  const users = await ctx.db
    .query("users")
    .withIndex("by_role", (q: any) => q.eq("role", role))
    .collect();

  let created = 0;
  for (const user of users) {
    const inserted = await ensureCommunityMembership(ctx, communityId, user._id);
    if (inserted) {
      created += 1;
    }
  }

  return { created, scanned: users.length };
}

export async function ensureMandatoryRoleCommunityMembershipsForUser(
  ctx: any,
  userId: Id<"users">,
  role: CommunityRole
) {
  const communities = await ctx.db.query("communities").collect();
  for (const community of communities) {
    if (!(community as any).autoJoinRoleMembers) continue;
    if (getCommunityDefaultRole((community as any).communityType) !== role) continue;
    await ensureCommunityMembership(ctx, community._id, userId);
  }
}

async function ensureBioFarmMembershipForFarmer(ctx: any, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "farmer") return;

  const existing = await ctx.db
    .query("communityMemberships")
    .withIndex("by_community_user", (q: any) =>
      q.eq("communityId", BIOFARM_COMMUNITY_ID as Id<"communities">).eq("userId", userId)
    )
    .first();

  if (!existing) {
    await ctx.db.insert("communityMemberships", {
      communityId: BIOFARM_COMMUNITY_ID as Id<"communities">,
      userId,
      joinedAt: getUgandaTime(),
    });
  }
}

/**
 * Grower Communities
 * 
 * - SuperAdmin creates communities
 * - Can be global or geo-locked
 * - Farmers can join communities
 * - Listings can be tagged to communities
 */

/**
 * Resolve a community logoPath to a displayable URL.
 * logoPath may be:
 *  - A Convex storage ID (needs ctx.storage.getUrl)
 *  - A static path like "/agrofreshlogo.png"
 *  - A full http(s) URL
 *  - A base64 data: URI
 *  - undefined/empty
 */
async function resolveLogoUrl(
  ctx: { storage: { getUrl: (id: any) => Promise<string | null> } },
  logoPath: string | undefined,
): Promise<string | undefined> {
  if (!logoPath) return undefined;
  // Already a usable URL/path — return as-is
  if (
    logoPath.startsWith("/") ||
    logoPath.startsWith("http") ||
    logoPath.startsWith("data:")
  ) {
    return logoPath;
  }
  // Assume it's a Convex storage ID — try to resolve
  try {
    const url = await ctx.storage.getUrl(logoPath as any);
    return url ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reusable helper: check if a user is a member of a given community.
 * Can be imported in other convex modules for authorisation checks.
 */
export async function isUserCommunityMember(
  db: DatabaseReader,
  userId: Id<"users">,
  communityId: Id<"communities">,
): Promise<boolean> {
  // Check communityMemberships table (QR / direct join)
  const directMembership = await db
    .query("communityMemberships")
    .withIndex("by_community_user", (q) =>
      q.eq("communityId", communityId).eq("userId", userId)
    )
    .first();
  if (directMembership) return true;

  // Check communityMembers table (application / approval flow)
  const approvedMember = await db
    .query("communityMembers")
    .withIndex("by_community_farmer", (q) =>
      q.eq("communityId", communityId).eq("farmerId", userId)
    )
    .first();
  if (approvedMember && approvedMember.status === "APPROVED") return true;

  // Check if user is an admin assigned to this community
  const user = await db.get(userId);
  if (user && user.role === "admin") {
    const community = await db.get(communityId);
    if (community && (community as any).communityAdminId === userId) return true;
    const assigned: string[] = (user as any).assignedCommunityIds || [];
    if (assigned.includes(String(communityId))) return true;
  }

  return false;
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
  const random = Math.random().toString(36).substring(2, 8);
  return `${role}_${random}`;
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



/**
 * Get basic community info (name + logo URL) for header display
 */
export const getCommunityInfo = query({
  args: { communityId: v.id("communities") },
  handler: async (ctx, args) => {
    const community = await ctx.db.get(args.communityId);
    if (!community) return null;
    const logoUrl = await resolveLogoUrl(ctx, community.logoPath);
    return {
      name: community.name,
      logoUrl,
      showFertilizerPlanner: (community as any).showFertilizerPlanner,
    };
  },
});

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
      if (!isAdmin && isVendorOnlyCommunity((c as any).communityType) && userRecord?.role !== "vendor") {
        return false;
      }

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

    let userById = new Map<Id<"users">, any>();
    let allUsers: any[] = [];
    if (canViewMemberDetails) {
      // Fetch all non-admin users for member detail resolution
      const allDbUsers = await ctx.db.query("users").collect();
      allUsers = allDbUsers.filter((u) => u.role !== "admin");
      userById = new Map(allUsers.map((u) => [u._id, u]));
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

        let memberDetails: Array<{ userId: Id<"users">; alias: string; email?: string; phoneNumber?: string; role?: string }> | undefined;
        let nonMemberDetails: Array<{ userId: Id<"users">; alias: string; email?: string; phoneNumber?: string; role?: string }> | undefined;
        // Role breakdown: count members per signup role
        let roleBreakdown: Record<string, number> | undefined;
        if (canViewMemberDetails) {
          const memberIds = new Set(memberships.map((membership) => membership.userId));
          const breakdown: Record<string, number> = {};
          memberDetails = memberships.map((membership) => {
            const member = userById.get(membership.userId);
            const role = member?.role || "unknown";
            breakdown[role] = (breakdown[role] || 0) + 1;
            return {
              userId: membership.userId,
              alias: member?.alias || "Unknown",
              email: member?.email,
              phoneNumber: member?.phoneNumber,
              role,
            };
          });
          roleBreakdown = breakdown;
          nonMemberDetails = allUsers
            .filter((u) => !memberIds.has(u._id))
            .map((u) => ({
              userId: u._id,
              alias: u.alias || "Unknown",
              email: u.email,
              phoneNumber: u.phoneNumber,
              role: u.role,
            }));
        }

        const resolvedLogo = await resolveLogoUrl(ctx, (c as any).logoPath || (c as any).qrLogoUrl);
        return {
          id: c._id,
          name: c.name,
          description: c.description,
          logoPath: resolvedLogo,
          communityAdminId: (c as any).communityAdminId,
          communityType: (c as any).communityType,
          autoJoinRoleMembers: !!(c as any).autoJoinRoleMembers,
          isGlobal: c.isGlobal,
          geoLocked: c.geoLocked,
          showMemberCount: (c as any).showMemberCount,
          showFertilizerPlanner: (c as any).showFertilizerPlanner,
          crmEnabled: (c as any).crmEnabled,
          isMember,
          memberCount: memberships.length,
          roleBreakdown,
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
 * Returns community details needed for QR join functionality.
 * Fallback: if no qrSlug match, try to resolve the slug as a community _id.
 */
export const getCommunityByQrSlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Try qrSlug match first
    let community = await ctx.db
      .query("communities")
      .filter((q) => q.eq(q.field("qrSlug"), args.slug))
      .first();

    // 2. Fallback: try to resolve slug as a community _id
    if (!community) {
      try {
        const byId = await ctx.db.get(args.slug as Id<"communities">);
        if (byId) {
          community = byId;
        }
      } catch {
        // Invalid ID format — ignore
      }
    }

    if (!community) {
      return null;
    }

    const resolvedLogo = await resolveLogoUrl(ctx, (community as any).logoPath || (community as any).qrLogoUrl);
    return {
      _id: community._id,
      name: community.name,
      description: community.description,
      logoPath: resolvedLogo,
      qrLogoUrl: resolvedLogo,
      qrEnabled: (community as any).qrEnabled ?? false,
    };
  },
});

/**
 * Get QR join data for any community.
 * Returns the join slug (qrSlug or _id fallback) so frontends can
 * build QR codes and share links for every community.
 */
export const getCommunityQrData = query({
  args: {
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    const community = await ctx.db.get(args.communityId);
    if (!community) return null;

    // Prefer qrSlug; fall back to raw _id
    const slug = community.qrSlug || String(community._id);

    const resolvedLogo = await resolveLogoUrl(ctx, (community as any).logoPath || (community as any).qrLogoUrl);
    return {
      _id: community._id,
      name: community.name,
      slug,
      logoPath: resolvedLogo,
      joinPath: `/join/community/${slug}`,
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
    const mapped = await Promise.all(
      results.slice(0, 10).map(async (c) => ({
        _id: c._id,
        name: c.name,
        description: c.description,
        logoPath: await resolveLogoUrl(ctx, (c as any).logoPath),
        isGlobal: c.isGlobal,
      }))
    );
    return mapped;
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
      .slice(0, 10);

    const mapped = await Promise.all(
      results.map(async (c) => ({
        _id: c._id,
        name: c.name,
        description: c.description,
        logoPath: await resolveLogoUrl(ctx, (c as any).logoPath || c.qrLogoUrl),
        qrSlug: c.qrSlug,
        qrLogoUrl: await resolveLogoUrl(ctx, c.qrLogoUrl),
      }))
    );

    return mapped;
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
        const communityMemberships = await ctx.db
          .query("communityMemberships")
          .withIndex("by_community", (q) => q.eq("communityId", m.communityId))
          .collect();
        const resolvedLogo = await resolveLogoUrl(ctx, (community as any).logoPath || (community as any).qrLogoUrl);
        return {
          _id: community._id,
          name: community.name,
          description: community.description,
          logoPath: resolvedLogo,
          isGlobal: community.isGlobal,
          showMemberCount: (community as any).showMemberCount,
          memberCount: communityMemberships.length,
          joinedAt: m.joinedAt,
        };
      })
    );

    return communities.filter((c) => c !== null);
  },
});

/**
 * Toggle whether member counts are visible to non-admin users for a community.
 * Super admins can toggle any community. Junior community admins can toggle only assigned communities.
 */
export const toggleCommunityMemberCountVisibility = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.id("communities"),
    showMemberCount: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.adminId);
    if (!admin || admin.role !== "admin") {
      throw new Error("Not authorized");
    }

    const community = await ctx.db.get(args.communityId);
    if (!community) {
      throw new Error("Community not found");
    }

    const superAdmin = isSuperAdmin(admin);
    if (!superAdmin) {
      if (!isCommunityAdmin(admin)) {
        throw new Error("Only community admins can update this setting");
      }

      const assigned = (admin as any).assignedCommunityIds || [];
      const normalizeAssignedId = (value: any) => {
        if (!value) return "";
        if (typeof value === "string") return value;
        if (typeof value === "object") {
          return String((value as any)._id ?? (value as any).id ?? value);
        }
        return String(value);
      };
      const assignedSet = new Set(assigned.map(normalizeAssignedId).filter(Boolean));
      const isAssigned = assignedSet.has(String(args.communityId)) || community.communityAdminId === args.adminId;

      if (!isAssigned) {
        throw new Error("Not assigned to this community");
      }
    }

    await ctx.db.patch(args.communityId, {
      showMemberCount: args.showMemberCount,
    });

    return {
      success: true,
      communityId: args.communityId,
      showMemberCount: args.showMemberCount,
    };
  },
});

/**
 * Toggle whether the Bio Farm fertilizer planner is visible to farmers.
 * Super admins can toggle any community. Junior community admins can toggle only assigned communities.
 */
export const toggleCommunityFertilizerPlannerVisibility = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.id("communities"),
    showFertilizerPlanner: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.adminId);
    if (!admin || admin.role !== "admin") {
      throw new Error("Not authorized");
    }

    const community = await ctx.db.get(args.communityId);
    if (!community) {
      throw new Error("Community not found");
    }

    const superAdmin = isSuperAdmin(admin);
    if (!superAdmin) {
      if (!isCommunityAdmin(admin)) {
        throw new Error("Only community admins can update this setting");
      }

      const assigned = (admin as any).assignedCommunityIds || [];
      const normalizeAssignedId = (value: any) => {
        if (!value) return "";
        if (typeof value === "string") return value;
        if (typeof value === "object") {
          return String((value as any)._id ?? (value as any).id ?? value);
        }
        return String(value);
      };
      const assignedSet = new Set(assigned.map(normalizeAssignedId).filter(Boolean));
      const isAssigned = assignedSet.has(String(args.communityId)) || community.communityAdminId === args.adminId;

      if (!isAssigned) {
        throw new Error("Not assigned to this community");
      }
    }

    await ctx.db.patch(args.communityId, {
      showFertilizerPlanner: args.showFertilizerPlanner,
    });

    return {
      success: true,
      communityId: args.communityId,
      showFertilizerPlanner: args.showFertilizerPlanner,
    };
  },
});

/**
 * Toggle whether Community CRM is enabled for a community.
 * Super admins can toggle any community. Junior community admins can toggle only assigned communities.
 */
export const toggleCommunityCrmEnabled = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.id("communities"),
    crmEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.adminId);
    if (!admin || admin.role !== "admin") {
      throw new Error("Not authorized");
    }

    const community = await ctx.db.get(args.communityId);
    if (!community) {
      throw new Error("Community not found");
    }

    const superAdmin = isSuperAdmin(admin);
    if (!superAdmin) {
      if (!isCommunityAdmin(admin)) {
        throw new Error("Only community admins can update this setting");
      }

      const assigned = (admin as any).assignedCommunityIds || [];
      const normalizeAssignedId = (value: any) => {
        if (!value) return "";
        if (typeof value === "string") return value;
        if (typeof value === "object") {
          return String((value as any)._id ?? (value as any).id ?? value);
        }
        return String(value);
      };
      const assignedSet = new Set(assigned.map(normalizeAssignedId).filter(Boolean));
      const isAssigned = assignedSet.has(String(args.communityId)) || community.communityAdminId === args.adminId;

      if (!isAssigned) {
        throw new Error("Not assigned to this community");
      }
    }

    await ctx.db.patch(args.communityId, {
      crmEnabled: args.crmEnabled,
    });

    return {
      success: true,
      communityId: args.communityId,
      crmEnabled: args.crmEnabled,
    };
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
    // 1. Find community by slug (with _id fallback)
    let community = await ctx.db
      .query("communities")
      .filter((q) => q.eq(q.field("qrSlug"), args.slug))
      .first();

    // Fallback: try to resolve slug as a community _id
    if (!community) {
      try {
        const byId = await ctx.db.get(args.slug as Id<"communities">);
        if (byId) {
          community = byId;
        }
      } catch {
        // Invalid ID format — ignore
      }
    }

    if (!community) {
      throw new Error("Community not found");
    }

    // QR join is now allowed for ALL communities (qrEnabled gate removed)

    let userId: Id<"users"> | undefined;
  let wasNewUser = false;

    if (args.userId) {
      // Existing user joining
      userId = args.userId;
      const user = await ctx.db.get(userId);
      if (!user) {
        throw new Error("User not found");
      }
      if (isVendorOnlyCommunity((community as any).communityType) && user.role !== "vendor") {
        throw new Error("Only vendors can join this community");
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

        const defaultRole = getCommunityDefaultRole((community as any).communityType);

        // Generate alias
        const alias = generateAlias(defaultRole);

        // Hash password (using simple hash for now - in production should use bcrypt)
        const passwordHash = simpleHash(args.password.trim());

        userId = await ctx.db.insert("users", {
          email: normalizedEmail,
          phoneNumber: normalizedPhone,
          role: defaultRole,
          alias,
          state: "active",
          createdAt: getUgandaTime(),
          lastActiveAt: getUgandaTime(),
          passwordHash,
          onboardedViaCommunityId: community._id,
        });
        wasNewUser = true;
      }
    }

    // 3-4. Update user with community scope fields
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("Failed to get user after creation");
    }

    if (user.role === "farmer") {
      await ensureBioFarmMembershipForFarmer(ctx, userId);
    }
    if (wasNewUser) {
      await ensureMandatoryRoleCommunityMembershipsForUser(ctx, userId, user.role as CommunityRole);
    }

// Update onboardedViaCommunityId if not already set (analytics only — no accountScope restriction)
      if (!user.onboardedViaCommunityId) {
        await ctx.db.patch(userId, {
          onboardedViaCommunityId: community._id,
        });
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
    communityType: v.union(v.literal("farmer"), v.literal("trader"), v.literal("buyer"), v.literal("vendor"), v.literal("transporter"), v.literal("store")),
    autoJoinRoleMembers: v.optional(v.boolean()),
    // assignAdminId is fully optional - community admins can be assigned later
    assignAdminId: v.optional(v.id("users")),
    // QR & monetisation fields (optional)
    qrSlug: v.optional(v.string()),
    qrLogoUrl: v.optional(v.string()),
    juniorAdminFreeMonthlyImageQuota: v.optional(v.number()),
    juniorAdminImagePrice: v.optional(v.number()),
    memberImageMessagePrice: v.optional(v.number()),
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

    // If slug provided, validate uniqueness
    if (args.qrSlug) {
      const existingSlug = await ctx.db
        .query("communities")
        .filter((q) => q.eq(q.field("qrSlug"), args.qrSlug))
        .first();
      if (existingSlug) {
        throw new Error("Community slug already exists. Please choose a different one.");
      }
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
      autoJoinRoleMembers: args.autoJoinRoleMembers ?? false,
      // QR fields (only set if slug provided)
      ...(args.qrSlug ? {
        qrEnabled: true,
        qrSlug: args.qrSlug.trim(),
        qrLogoUrl: args.qrLogoUrl?.trim(),
        searchPriorityScore: 100,
      } : {}),
    });

    // If assigning to a community admin, add to their assignedCommunityIds
    if (args.assignAdminId) {
      const targetAdmin = await ctx.db.get(args.assignAdminId);
      const currentAssigned = (targetAdmin as any)?.assignedCommunityIds || [];
      await ctx.db.patch(args.assignAdminId, {
        assignedCommunityIds: [...currentAssigned, communityId],
      });
    }

    if (args.autoJoinRoleMembers) {
      await backfillMandatoryRoleMembershipForCommunity(
        ctx,
        communityId,
        getCommunityDefaultRole(args.communityType)
      );
    }

    // Create monetisation settings if provided
    if (args.juniorAdminFreeMonthlyImageQuota !== undefined || args.juniorAdminImagePrice !== undefined || args.memberImageMessagePrice !== undefined) {
      await ctx.db.insert("communityMonetisationSettings", {
        communityId: communityId,
        juniorAdminFreeMonthlyImageQuota: args.juniorAdminFreeMonthlyImageQuota ?? 2,
        juniorAdminImagePrice: args.juniorAdminImagePrice ?? 5000,
        memberImageMessagePrice: args.memberImageMessagePrice ?? 1000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        updatedBy: args.adminId,
      });
    }

    // Log admin action
    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      action: "create_community",
      details: `Created community: ${args.name} (UTID: ${utid})${args.qrSlug ? ` (QR slug: ${args.qrSlug})` : ""}`,
      timestamp: getUgandaTime(),
    });

    return { communityId, utid, qrSlug: args.qrSlug };
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
    autoJoinRoleMembers: v.optional(v.boolean()),
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
    if (args.autoJoinRoleMembers !== undefined) {
      updates.autoJoinRoleMembers = args.autoJoinRoleMembers;
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

    const enableAutoJoin = args.autoJoinRoleMembers === true && !(community as any).autoJoinRoleMembers;

    await ctx.db.patch(args.communityId, updates);

    if (enableAutoJoin) {
      await backfillMandatoryRoleMembershipForCommunity(
        ctx,
        args.communityId,
        getCommunityDefaultRole((community as any).communityType)
      );
    }

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
 * Join a community (any role: farmer, trader, buyer, vendor, transporter, store)
 */
export const joinCommunity = mutation({
  args: {
    farmerId: v.id("users"), // kept as "farmerId" for backward-compat; accepts any role
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.farmerId);
    if (!user) {
      throw new Error("User not found");
    }

    // Any non-admin role may join communities
    const allowedRoles = ["farmer", "trader", "buyer", "vendor", "transporter", "store"];
    if (!allowedRoles.includes(user.role)) {
      throw new Error("Only non-admin users can join communities");
    }

    // Verify community exists
    const community = await ctx.db.get(args.communityId);
    if (!community) {
      throw new Error("Community not found");
    }

    if (isVendorOnlyCommunity((community as any).communityType) && user.role !== "vendor") {
      throw new Error("Only vendors can join this community");
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

    // Check geo-locking (uses location fields if user has them)
    if (community.geoLocked && !community.isGlobal) {
      const hasAccess =
        (user.districtId && community.districtIds?.includes(user.districtId)) ||
        (user.subcountyId && community.subcountyIds?.includes(user.subcountyId)) ||
        (user.parishId && community.parishIds?.includes(user.parishId));

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
 * Backfill existing farmer accounts into Bio Farm community membership (idempotent)
 */
export const backfillBioFarmMembershipForFarmers = mutation({
  args: {
    adminId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    let adminId = args.adminId;

    if (!adminId) {
      const authUser = await ctx.auth.getUserIdentity();
      if (!authUser) {
        throw new Error("Not authenticated");
      }

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

    const admin = await ctx.db.get(adminId);
    if (!admin || admin.role !== "admin") {
      throw new Error("Only admins can run backfill");
    }

    const farmers = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "farmer"))
      .collect();

    let created = 0;
    let skipped = 0;

    for (const farmer of farmers) {
      const exists = await ctx.db
        .query("communityMemberships")
        .withIndex("by_community_user", (q) =>
          q.eq("communityId", BIOFARM_COMMUNITY_ID as Id<"communities">).eq("userId", farmer._id)
        )
        .first();

      if (exists) {
        skipped += 1;
        continue;
      }

      await ctx.db.insert("communityMemberships", {
        communityId: BIOFARM_COMMUNITY_ID as Id<"communities">,
        userId: farmer._id,
        joinedAt: getUgandaTime(),
      });
      created += 1;
    }

    return {
      success: true,
      farmersEvaluated: farmers.length,
      created,
      skipped,
    };
  },
});

/**
 * Leave a community (any role: farmer, trader, buyer, vendor, transporter, store)
 */
export const leaveCommunity = mutation({
  args: {
    farmerId: v.id("users"), // kept as "farmerId" for backward-compat; accepts any role
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.farmerId);
    if (!user) {
      throw new Error("User not found");
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
 * Tag a listing to a community (farmer/vendor/store, for their own listings)
 */
export const tagListingToCommunity = mutation({
  args: {
    farmerId: v.id("users"),
    listingId: v.id("listings"),
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    // Verify user has a listing-capable role
    const farmer = await ctx.db.get(args.farmerId);
    if (!farmer || !["farmer", "vendor", "store"].includes(farmer.role)) {
      throw new Error("Only farmers, vendors, and stores can tag listings to communities");
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

// Standard tier: use exportLimit from user record, fallback to 5
      const now = getUgandaTime();
      const currentMonth = new Date(now).toISOString().slice(0, 7); // "YYYY-MM"

      const exportsThisMonth = await ctx.db
        .query("exportLogs")
        .withIndex("by_user_month", (q) => q.eq("userId", args.userId).eq("month", currentMonth))
        .collect();

      const usedCount = exportsThisMonth.length;
      const limit = (user as any).exportLimit ?? 5;
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
          logo: await resolveLogoUrl(ctx, c.logoPath || c.qrLogoUrl),
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

    const adminCommunitiesMapped = await Promise.all(
      adminCommunities.map(async (c) => ({
        communityId: c._id,
        name: c.name,
        slug: c.qrSlug || c.name.toLowerCase().replace(/\s+/g, "-"),
        logo: await resolveLogoUrl(ctx, c.qrLogoUrl || c.logoPath),
      }))
    );

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
          logo: await resolveLogoUrl(ctx, community.qrLogoUrl || community.logoPath),
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

/**
 * Set a community-specific role label on a membership record.
 * This is separate from the signup role — it lets a community admin
 * assign a community-level role (e.g., "Lead Farmer", "Zone Manager").
 */
export const setCommunityRole = mutation({
  args: {
    communityId: v.id("communities"),
    userId: v.id("users"),
    communityRole: v.string(),
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify caller is admin
    const admin = await ctx.db.get(args.adminId);
    if (!admin || admin.role !== "admin") {
      throw new Error("Only admins can set community roles");
    }

    const membership = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community_user", (q) =>
        q.eq("communityId", args.communityId).eq("userId", args.userId)
      )
      .first();

    if (!membership) {
      throw new Error("User is not a member of this community");
    }

    await ctx.db.patch(membership._id, {
      communityRole: args.communityRole,
    });

    return { success: true };
  },
});
