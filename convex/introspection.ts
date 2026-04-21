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

async function resolveLogoUrl(
  ctx: { storage: { getUrl: (id: any) => Promise<string | null> } },
  logoPath: string | undefined,
): Promise<string | undefined> {
  if (!logoPath) return undefined;
  // Already a usable URL or static path
  if (
    logoPath.startsWith("/") ||
    logoPath.startsWith("http") ||
    logoPath.startsWith("data:")
  ) {
    return logoPath;
  }
  // Convex storage ID — resolve to a signed URL
  const url = await ctx.storage.getUrl(logoPath as any);
  return url ?? undefined;
}

async function enrichWithStats(ctx: any, communities: any[]) {
  return await Promise.all(
    communities.map(async (c) => {
      const memberships = await ctx.db
        .query("communityMemberships")
        .withIndex("by_community", (q: any) => q.eq("communityId", c._id))
        .collect();
      const resolvedLogo = await resolveLogoUrl(ctx, c.logoPath || c.qrLogoUrl);
      return {
        ...c,
        logoPath: resolvedLogo,
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
    status: v.optional(
      v.union(
        v.literal("PENDING"),
        v.literal("APPROVED"),
        v.literal("REJECTED"),
        v.literal("REVOKED")
      )
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.adminId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized");

    const isSuperAdmin = user.adminLevel === "super" || user.adminLevel === undefined;
    
    // Check permissions
    if (!isSuperAdmin) {
      if (user.adminCategory !== "community") throw new Error("Forbidden");
      const community = await ctx.db.get(args.communityId);
      const assignedIds = user.assignedCommunityIds || [];
      const isDirectAdmin = community?.communityAdminId === args.adminId;
      const isAssigned = assignedIds.includes(args.communityId);
      if (!isAssigned && !isDirectAdmin) throw new Error("Forbidden");
    }

    const memberRecords = await ctx.db
      .query("communityMembers")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .collect();

    let derivedRecords: any[] = memberRecords;
    if (memberRecords.length === 0) {
      const memberships = await ctx.db
        .query("communityMemberships")
        .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
        .collect();

      if (memberships.length > 0) {
        derivedRecords = memberships.map((m: any) => ({
          farmerId: m.userId,
          status: "APPROVED",
          applicationId: undefined,
          joinedAt: m.joinedAt,
          updatedAt: m.joinedAt,
        }));
      } else {
        const apps = await ctx.db
          .query("communityApplications")
          .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
          .collect();

        const sorted = [...apps].sort(
          (a: any, b: any) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
        );
        const latestByFarmer = new Map<Id<"users">, any>();
        for (const app of sorted) {
          if (!latestByFarmer.has(app.farmerId)) {
            latestByFarmer.set(app.farmerId, app);
          }
        }

        derivedRecords = Array.from(latestByFarmer.values()).map((app: any) => ({
          farmerId: app.farmerId,
          status: app.status,
          applicationId: app._id,
          joinedAt: app.status === "APPROVED" ? (app.decidedAt || app.updatedAt || app.createdAt) : undefined,
          updatedAt: app.updatedAt || app.createdAt,
        }));
      }
    }

    const filtered = args.status
      ? derivedRecords.filter((m: any) => m.status === args.status)
      : derivedRecords;

    return await Promise.all(
      filtered.map(async (m: any) => {
        const memberUser = await ctx.db.get(m.farmerId);
        return {
          ...memberUser,
          status: m.status,
          applicationId: m.applicationId,
          joinedAt: m.joinedAt,
          updatedAt: m.updatedAt,
        };
      })
    );
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
    const communities = await ctx.db.query("communities").collect();
    const communityMemberships = await ctx.db.query("communityMemberships").collect();
    const communityMembers = await ctx.db.query("communityMembers").collect();

    const communityNameById = new Map(
      communities.map((c: any) => [c._id, c.name])
    );

    const memberCommunities = new Map<string, Set<string>>();

    for (const membership of communityMemberships) {
      const key = String(membership.userId);
      if (!memberCommunities.has(key)) {
        memberCommunities.set(key, new Set());
      }
      memberCommunities.get(key)!.add(String(membership.communityId));
    }

    for (const member of communityMembers) {
      if (member.status !== "APPROVED") continue;
      const key = String(member.farmerId);
      if (!memberCommunities.has(key)) {
        memberCommunities.set(key, new Set());
      }
      memberCommunities.get(key)!.add(String(member.communityId));
    }

    return users.map((u) => {
      const communityIds = Array.from(memberCommunities.get(String(u._id)) ?? []);
      const communityNames = communityIds
        .map((id) => communityNameById.get(id))
        .filter(Boolean);

      return {
        userId: u._id,
        alias: u.alias,
        email: u.email,
        phoneNumber: u.phoneNumber,
        role: u.role,
        sex: (u as any).sex,
        adminLevel: u.adminLevel,
        adminCategory: u.adminCategory,
        allowedStorageLocationIds: u.allowedStorageLocationIds ?? [],
        assignedCommunityIds: u.assignedCommunityIds ?? [],
        serviceLevel: u.serviceLevel,
        exportLimit: u.exportLimit,
        region: u.region,
        districtId: u.districtId,
        subcountyId: u.subcountyId,
        parishId: u.parishId,
        districtText: (u as any).districtText,
        subCountyText: (u as any).subCountyText,
        village: (u as any).village,
        county: (u as any).county,
        waterSource: (u as any).waterSource,
        onboardingCompleted: u.onboardingCompleted,
        isVerifiedTrader: (u as any).isVerifiedTrader,
        verificationStatus: (u as any).verificationStatus,
        verifiedBy: (u as any).verifiedBy,
        verifiedAt: (u as any).verifiedAt,
        createdAt: u.createdAt,
        lastActiveAt: u.lastActiveAt,
        communityIds,
        communityNames,
      };
    });
  },
});
