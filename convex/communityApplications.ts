import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyAdminRole } from "./auth";
import { Id } from "./_generated/dataModel";

const COMMUNITY_NAME = "AGROFRESH UG";
const KNOWN_AGROFRESH_ID = "ms7d11zfqswjbcvqer43pdzf6x80aate";

const normalizeCommunityName = (value?: string) =>
  (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function getAgroFreshCommunityId(ctx: any): Promise<Id<"communities">> {
  // Prioritize the known ID if it exists and matches the name
  try {
    const known = await ctx.db.get(KNOWN_AGROFRESH_ID as Id<"communities">);
    if (known && normalizeCommunityName(known.name) === normalizeCommunityName(COMMUNITY_NAME)) {
      return known._id;
    }
  } catch (e) {
    // Ignore invalid ID errors
  }

  const communities = await ctx.db.query("communities").collect();
  const target = normalizeCommunityName(COMMUNITY_NAME);
  const exactMatch = communities.find(
    (c: any) => normalizeCommunityName(c.name) === target
  );
  if (!exactMatch) {
    throw new Error("AGROFRESH UG community not found.");
  }
  return exactMatch._id;
}

export const getPaginatedApplications = query({
  args: {
    adminId: v.id("users"),
    status: v.optional(v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("REJECTED"),
      v.literal("REVOKED")
    )),
    page: v.number(),
    pageSize: v.number(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    district: v.optional(v.string()),
    subCounty: v.optional(v.string()),
    enterprise: v.optional(v.string()),
  },
  handler: async (ctx, { adminId, status, page, pageSize, startDate, endDate, district, subCounty, enterprise }) => {
    const safePageSize = Math.min(Math.max(pageSize, 1), 20);
    const safePage = Math.max(page, 1);

    try {
      const adminCheck = await verifyAdminRole({ userId: adminId, db: ctx.db });
      if (!adminCheck.authorized) {
        throw new Error("Not authorized");
      }

      const communityId = await getAgroFreshCommunityId(ctx);

      const adminUser = await ctx.db.get(adminId);
      if (!adminUser) {
        throw new Error("Admin not found");
      }

      const isSuperAdmin = adminUser.adminLevel === "super" || adminUser.adminLevel === undefined;

      if (!isSuperAdmin && adminUser.adminCategory === "community") {
        const assigned = (adminUser as any).assignedCommunityIds || [];
        const community = await ctx.db.get(communityId);
        const isDirectAdmin = community?.communityAdminId === adminId;
        const isAssigned = assigned.some((id: string) => id === communityId);
        if (!isAssigned && !isDirectAdmin) {
          throw new Error(`Not authorized. Admin not assigned to community ${communityId}`);
        }
      } else if (!isSuperAdmin && adminUser.adminCategory !== "community") {
        throw new Error("Forbidden");
      }

      const all = await ctx.db
        .query("communityApplications")
        .withIndex("by_community", (q: any) => q.eq("communityId", communityId))
        .collect();

      let filtered = status ? all.filter((a: any) => a.status === status) : all;
      if (startDate || endDate) {
        filtered = filtered.filter((a: any) => {
          const created = a.createdAt || a.updatedAt || 0;
          if (startDate && created < startDate) return false;
          if (endDate && created > endDate) return false;
          return true;
        });
      }

      const sorted = [...filtered].sort((a: any, b: any) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));

      const latestByFarmer = new Map<Id<"users">, any>();
      for (const app of sorted) {
        if (!latestByFarmer.has(app.farmerId)) {
          latestByFarmer.set(app.farmerId, app);
        }
      }

      const deduped = Array.from(latestByFarmer.values());

      const farmerIds = Array.from(new Set(deduped.map((a: any) => a.farmerId)));
      const formIds = Array.from(new Set(deduped.map((a: any) => a.formId)));

      const farmers = await Promise.all(farmerIds.map((id) => ctx.db.get(id)));
      const forms = await Promise.all(formIds.map((id) => ctx.db.get(id)));

      const farmerById = new Map(farmers.filter(Boolean).map((f: any) => [f._id, f]));
      const formById = new Map(forms.filter(Boolean).map((f: any) => [f._id, f]));

      const items = deduped.map((app: any) => {
        const farmer = farmerById.get(app.farmerId);
        const form = formById.get(app.formId);
        return {
          id: app._id,
          status: app.status,
          createdAt: app.createdAt,
          updatedAt: app.updatedAt,
          farmerId: app.farmerId,
          formId: app.formId,
          farmer: farmer
            ? {
                id: farmer._id,
                alias: farmer.alias,
                email: farmer.email,
                phoneNumber: farmer.phoneNumber,
                districtText: farmer.districtText,
                subCountyText: farmer.subCountyText,
                county: farmer.county,
                village: farmer.village,
              }
            : null,
          form,
        };
      });

      const normalize = (value?: string) => (value || "").trim().toLowerCase();
      let finalItems = items;
      if (district) {
        const d = normalize(district);
        finalItems = finalItems.filter((item: any) => normalize(item.form?.section1?.districtSubCounty).includes(d));
      }
      if (subCounty) {
        const s = normalize(subCounty);
        finalItems = finalItems.filter((item: any) => normalize(item.form?.section1?.districtSubCounty).includes(s));
      }
      if (enterprise) {
        finalItems = finalItems.filter((item: any) =>
          (item.form?.section1?.mainEnterprises || []).includes(enterprise)
        );
      }

      const totalCount = finalItems.length;
      const start = (safePage - 1) * safePageSize;
      const sliced = finalItems.slice(start, start + safePageSize);
      return { items: sliced, totalCount, page: safePage, pageSize: safePageSize };
    } catch (error: any) {
      return {
        items: [],
        totalCount: 0,
        page: safePage,
        pageSize: safePageSize,
        error: error?.message || "Unable to load AgroFresh applications.",
      } as any;
    }
  },
});

export const getCommunityMemberExportData = query({
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
  handler: async (ctx, { adminId, communityId, status }) => {
    const adminCheck = await verifyAdminRole({ userId: adminId, db: ctx.db });
    if (!adminCheck.authorized) {
      throw new Error("Not authorized");
    }

    const adminUser = await ctx.db.get(adminId);
    if (!adminUser) {
      throw new Error("Admin not found");
    }

    const isSuperAdmin = adminUser.adminLevel === "super" || adminUser.adminLevel === undefined;
    if (!isSuperAdmin && adminUser.adminCategory === "community") {
      const community = await ctx.db.get(communityId);
      const assigned = (adminUser as any).assignedCommunityIds || [];
      const normalizeAssignedId = (value: any) => {
        if (!value) return "";
        if (typeof value === "string") return value;
        if (typeof value === "object") {
          return String((value as any)._id ?? (value as any).id ?? value);
        }
        return String(value);
      };
      const assignedSet = new Set(assigned.map(normalizeAssignedId).filter(Boolean));
      const isDirectAdmin = community?.communityAdminId === adminId;
      const isAssigned = assignedSet.has(String(communityId));
      if (!isAssigned && !isDirectAdmin) {
        throw new Error("Forbidden");
      }
    } else if (!isSuperAdmin && adminUser.adminCategory !== "community") {
      throw new Error("Forbidden");
    }

    const members: any[] = await ctx.db
      .query("communityMembers")
      .withIndex("by_community", (q: any) => q.eq("communityId", communityId))
      .collect();

    let filtered: any[] = status ? members.filter((m: any) => m.status === status) : members;
    if (members.length === 0) {
      const memberships = await ctx.db
        .query("communityMemberships")
        .withIndex("by_community", (q: any) => q.eq("communityId", communityId))
        .collect();

      if (memberships.length > 0) {
        const derivedMembers: any[] = memberships.map((m: any) => ({
          status: "APPROVED",
          joinedAt: m.joinedAt,
          updatedAt: m.joinedAt,
          applicationId: undefined,
          farmerId: m.userId,
        }));

        filtered = status
          ? derivedMembers.filter((m: any) => m.status === status)
          : derivedMembers;
      } else {
        const apps = await ctx.db
          .query("communityApplications")
          .withIndex("by_community", (q: any) => q.eq("communityId", communityId))
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

        const derivedMembers: any[] = Array.from(latestByFarmer.values()).map((app: any) => ({
          status: app.status,
          joinedAt: app.status === "APPROVED" ? (app.decidedAt || app.updatedAt || app.createdAt) : undefined,
          updatedAt: app.updatedAt || app.createdAt,
          applicationId: app._id,
          farmerId: app.farmerId,
        }));

        filtered = status
          ? derivedMembers.filter((m: any) => m.status === status)
          : derivedMembers;
      }
    }

    const applications: any[] = await Promise.all(
      filtered.map((m: any) => (m.applicationId ? ctx.db.get(m.applicationId) : null))
    );

    const formIds = Array.from(
      new Set(applications.map((a: any) => (a as any)?.formId).filter(Boolean))
    ) as Id<"agroFreshUGFarmValidations">[];

    const farmerIds = Array.from(
      new Set(filtered.map((m: any) => m.farmerId))
    ) as Id<"users">[];

    const forms = await Promise.all(formIds.map((id) => ctx.db.get(id)));
    const farmers = await Promise.all(farmerIds.map((id) => ctx.db.get(id)));

    const formById = new Map(forms.filter(Boolean).map((f: any) => [f._id, f]));
    const farmerById = new Map(farmers.filter(Boolean).map((f: any) => [f._id, f]));

    return filtered.map((m: any) => {
      const app = applications.find((a: any) => a?._id === m.applicationId) || null;
      const formId = (app as any)?.formId;
      const form = formId ? formById.get(formId) : null;
      const farmer = farmerById.get(m.farmerId) || null;
      return {
        status: m.status,
        joinedAt: m.joinedAt,
        updatedAt: m.updatedAt,
        application: app,
        form,
        farmer,
      };
    });
  },
});

export const getApplicationsByCommunityIds = query({
  args: {
    adminId: v.id("users"),
    communityIds: v.array(v.id("communities")),
    status: v.optional(v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("REJECTED"),
      v.literal("REVOKED")
    )),
  },
  handler: async (ctx, { adminId, communityIds, status }) => {
    try {
      const adminCheck = await verifyAdminRole({ userId: adminId, db: ctx.db });
      if (!adminCheck.authorized) {
        throw new Error("Not authorized");
      }

      const adminUser = await ctx.db.get(adminId);
      if (!adminUser) {
        throw new Error("Admin not found");
      }

      let allowedCommunityIds = communityIds;
      const isSuperAdmin = adminUser.adminLevel === "super" || adminUser.adminLevel === undefined;

      if (!isSuperAdmin && adminUser.adminCategory === "community") {
        const assigned = (adminUser as any).assignedCommunityIds || [];
        const normalizeAssignedId = (value: any) => {
          if (!value) return "";
          if (typeof value === "string") return value;
          if (typeof value === "object") {
            return String((value as any)._id ?? (value as any).id ?? value);
          }
          return String(value);
        };
        const assignedSet = new Set(assigned.map(normalizeAssignedId).filter(Boolean));
        const communityRecords = await Promise.all(
          communityIds.map((id) => ctx.db.get(id))
        );
        const directAssigned = new Set(
          communityRecords
            .filter(Boolean)
            .filter((c: any) => c.communityAdminId === adminId)
            .map((c: any) => String(c._id))
        );
        allowedCommunityIds = communityIds.filter((id) => {
          const normalizedId = String(id);
          return assignedSet.has(normalizedId) || directAssigned.has(normalizedId);
        });
        if (allowedCommunityIds.length === 0) {
          throw new Error("No assigned communities found for this admin.");
        }
      } else if (!isSuperAdmin && adminUser.adminCategory !== "community") {
        throw new Error("Forbidden");
      }

      const results = await Promise.all(
        allowedCommunityIds.map(async (communityId) => {
          const all = await ctx.db
            .query("communityApplications")
            .withIndex("by_community", (q: any) => q.eq("communityId", communityId))
            .collect();

          const filtered = status ? all.filter((a: any) => a.status === status) : all;
          const sorted = [...filtered].sort((a: any, b: any) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));

          const latestByFarmer = new Map<Id<"users">, any>();
          for (const app of sorted) {
            if (!latestByFarmer.has(app.farmerId)) {
              latestByFarmer.set(app.farmerId, app);
            }
          }

          const deduped = Array.from(latestByFarmer.values());
          const farmerIds = Array.from(new Set(deduped.map((a: any) => a.farmerId)));
          const formIds = Array.from(new Set(deduped.map((a: any) => a.formId)));

          const farmers = await Promise.all(farmerIds.map((id) => ctx.db.get(id)));
          const forms = await Promise.all(formIds.map((id) => ctx.db.get(id)));

          const farmerById = new Map(farmers.filter(Boolean).map((f: any) => [f._id, f]));
          const formById = new Map(forms.filter(Boolean).map((f: any) => [f._id, f]));

          const applications = deduped.map((app: any) => {
            const farmer = farmerById.get(app.farmerId);
            const form = formById.get(app.formId);
            return {
              id: app._id,
              status: app.status,
              createdAt: app.createdAt,
              updatedAt: app.updatedAt,
              farmerId: app.farmerId,
              formId: app.formId,
              farmer: farmer
                ? {
                    id: farmer._id,
                    alias: farmer.alias,
                    email: farmer.email,
                    phoneNumber: farmer.phoneNumber,
                    districtText: farmer.districtText,
                    subCountyText: farmer.subCountyText,
                    county: farmer.county,
                    village: farmer.village,
                  }
                : null,
              form,
            };
          });

          return { communityId, applications };
        })
      );

      return results;
    } catch (error: any) {
      return communityIds.map((communityId) => ({
        communityId,
        applications: [],
        error: error?.message || "Unable to load applications.",
      })) as any;
    }
  },
});

export const getCommunityMembersByCommunityIds = query({
  args: {
    adminId: v.id("users"),
    communityIds: v.array(v.id("communities")),
    status: v.optional(v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("REJECTED"),
      v.literal("REVOKED")
    )),
  },
  handler: async (ctx, { adminId, communityIds, status }) => {
    try {
      const adminCheck = await verifyAdminRole({ userId: adminId, db: ctx.db });
      if (!adminCheck.authorized) {
        throw new Error("Not authorized");
      }

      const adminUser = await ctx.db.get(adminId);
      if (!adminUser) {
        throw new Error("Admin not found");
      }

      let allowedCommunityIds = communityIds;
      const isSuperAdmin = adminUser.adminLevel === "super" || adminUser.adminLevel === undefined;

      if (!isSuperAdmin && adminUser.adminCategory === "community") {
        const assigned = (adminUser as any).assignedCommunityIds || [];
        const normalizeAssignedId = (value: any) => {
          if (!value) return "";
          if (typeof value === "string") return value;
          if (typeof value === "object") {
            return String((value as any)._id ?? (value as any).id ?? value);
          }
          return String(value);
        };
        const assignedSet = new Set(assigned.map(normalizeAssignedId).filter(Boolean));
        const communityRecords = await Promise.all(
          communityIds.map((id) => ctx.db.get(id))
        );
        const directAssigned = new Set(
          communityRecords
            .filter(Boolean)
            .filter((c: any) => c.communityAdminId === adminId)
            .map((c: any) => String(c._id))
        );
        allowedCommunityIds = communityIds.filter((id) => {
          const normalizedId = String(id);
          return assignedSet.has(normalizedId) || directAssigned.has(normalizedId);
        });
        if (allowedCommunityIds.length === 0) {
          throw new Error("No assigned communities found for this admin.");
        }
      } else if (!isSuperAdmin && adminUser.adminCategory !== "community") {
        throw new Error("Forbidden");
      }

      const results = await Promise.all(
        allowedCommunityIds.map(async (communityId) => {
          const all = await ctx.db
            .query("communityMembers")
            .withIndex("by_community", (q: any) => q.eq("communityId", communityId))
            .collect();

          let filtered = status ? all.filter((m: any) => m.status === status) : all;
          if (all.length === 0) {
            const memberships = await ctx.db
              .query("communityMemberships")
              .withIndex("by_community", (q: any) => q.eq("communityId", communityId))
              .collect();

            if (memberships.length > 0) {
              const derivedMembers: any[] = memberships.map((m: any) => ({
                status: "APPROVED",
                joinedAt: m.joinedAt,
                updatedAt: m.joinedAt,
                applicationId: undefined,
                farmerId: m.userId,
              }));

              filtered = status
                ? derivedMembers.filter((m: any) => m.status === status)
                : derivedMembers;
            }
          }

          const farmerIds = Array.from(new Set(filtered.map((m: any) => m.farmerId)));
          const applicationIds = Array.from(
            new Set(filtered.map((m: any) => m.applicationId).filter(Boolean))
          ) as Id<"communityApplications">[];

          const farmers = await Promise.all(farmerIds.map((id) => ctx.db.get(id)));
          const applications = await Promise.all(applicationIds.map((id) => ctx.db.get(id)));
          const formIds = Array.from(
            new Set(applications.map((a: any) => a?.formId).filter(Boolean))
          ) as Id<"agroFreshUGFarmValidations">[];
          const forms = await Promise.all(formIds.map((id) => ctx.db.get(id)));

          const farmerById = new Map(farmers.filter(Boolean).map((f: any) => [f._id, f]));
          const appById = new Map(applications.filter(Boolean).map((a: any) => [a._id, a]));
          const formById = new Map(forms.filter(Boolean).map((f: any) => [f._id, f]));

          const members = filtered.map((m: any) => {
            const farmer = farmerById.get(m.farmerId);
            const app = m.applicationId ? appById.get(m.applicationId) : null;
            const form = app?.formId ? formById.get(app.formId) : null;
            return {
              id: m._id,
              status: m.status,
              updatedAt: m.updatedAt,
              joinedAt: m.joinedAt,
              applicationId: m.applicationId,
              farmerId: m.farmerId,
              farmer: farmer
                ? {
                    id: farmer._id,
                    alias: farmer.alias,
                    email: farmer.email,
                    phoneNumber: farmer.phoneNumber,
                    districtText: farmer.districtText,
                    subCountyText: farmer.subCountyText,
                    county: farmer.county,
                    village: farmer.village,
                  }
                : null,
              form,
            };
          });

          return { communityId, members };
        })
      );

      return results;
    } catch (error: any) {
      return communityIds.map((communityId) => ({
        communityId,
        members: [],
        error: error?.message || "Unable to load members.",
      })) as any;
    }
  },
});

export const getMyApplicationStatus = query({
  args: { farmerId: v.id("users"), formId: v.id("agroFreshUGFarmValidations") },
  handler: async (ctx, { farmerId, formId }) => {
    const app = await ctx.db
      .query("communityApplications")
      .withIndex("by_form", (q: any) => q.eq("formId", formId))
      .first();
    if (!app || app.farmerId !== farmerId) {
      return null;
    }
    return { status: app.status };
  },
});

export const getApplicationDetails = query({
  args: { adminId: v.id("users"), applicationId: v.id("communityApplications") },
  handler: async (ctx, { adminId, applicationId }) => {
    try {
      const adminCheck = await verifyAdminRole({ userId: adminId, db: ctx.db });
      if (!adminCheck.authorized) {
        throw new Error("Not authorized");
      }

      const adminUser = await ctx.db.get(adminId);
      if (!adminUser) {
        throw new Error("Admin not found");
      }

      const app = await ctx.db.get(applicationId);
      if (!app) {
        throw new Error("Application not found");
      }

      const isSuperAdmin = adminUser.adminLevel === "super" || adminUser.adminLevel === undefined;
      if (!isSuperAdmin && adminUser.adminCategory === "community") {
        const community = await ctx.db.get(app.communityId);
        const assigned = (adminUser as any).assignedCommunityIds || [];
        const isDirectAdmin = community?.communityAdminId === adminId;
        const isAssigned = assigned.some((id: string) => id === app.communityId);
        if (!isAssigned && !isDirectAdmin) {
          throw new Error("Forbidden");
        }
      } else if (!isSuperAdmin && adminUser.adminCategory !== "community") {
        throw new Error("Forbidden");
      }

      const form = await ctx.db.get(app.formId);
      const farmer = await ctx.db.get(app.farmerId);
      const actions = await ctx.db
        .query("adminActionLogs")
        .withIndex("by_application", (q: any) => q.eq("applicationId", applicationId))
        .collect();

      return {
        application: app,
        form,
        farmer,
        actions: actions.sort((a: any, b: any) => b.createdAt - a.createdAt),
      };
    } catch (error: any) {
      return { error: error?.message || "Unable to load application details." } as any;
    }
  },
});

async function upsertCommunityMember(ctx: any, args: { communityId: Id<"communities">; farmerId: Id<"users">; status: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED"; applicationId: Id<"communityApplications">; }) {
  const existing = await ctx.db
    .query("communityMembers")
    .withIndex("by_community_farmer", (q: any) => q.eq("communityId", args.communityId).eq("farmerId", args.farmerId))
    .first();

  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, {
      status: args.status,
      applicationId: args.applicationId,
      updatedAt: now,
      joinedAt: args.status === "APPROVED" ? (existing.joinedAt || now) : existing.joinedAt,
    });
  } else {
    await ctx.db.insert("communityMembers", {
      communityId: args.communityId,
      farmerId: args.farmerId,
      status: args.status,
      applicationId: args.applicationId,
      joinedAt: args.status === "APPROVED" ? now : undefined,
      updatedAt: now,
    });
  }

  await syncCommunityMembership(ctx, {
    communityId: args.communityId,
    userId: args.farmerId,
    status: args.status,
  });
}

async function syncCommunityMembership(ctx: any, args: { communityId: Id<"communities">; userId: Id<"users">; status: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED"; }) {
  const existing = await ctx.db
    .query("communityMemberships")
    .withIndex("by_community_user", (q: any) => q.eq("communityId", args.communityId).eq("userId", args.userId))
    .first();

  if (args.status === "APPROVED") {
    if (!existing) {
      await ctx.db.insert("communityMemberships", {
        communityId: args.communityId,
        userId: args.userId,
        joinedAt: Date.now(),
      });
    }
    return;
  }

  if (existing) {
    await ctx.db.delete(existing._id);
  }
}

async function logAdminAction(ctx: any, args: { adminId: Id<"users">; communityId: Id<"communities">; applicationId: Id<"communityApplications">; action: "APPROVED" | "REJECTED" | "REVOKED"; note?: string; }) {
  await ctx.db.insert("adminActionLogs", {
    adminId: args.adminId,
    communityId: args.communityId,
    applicationId: args.applicationId,
    action: args.action,
    note: args.note,
    createdAt: Date.now(),
  });
}

export const approveApplication = mutation({
  args: { adminId: v.id("users"), applicationId: v.id("communityApplications"), note: v.optional(v.string()) },
  handler: async (ctx, { adminId, applicationId, note }) => {
    const adminCheck = await verifyAdminRole({ userId: adminId, db: ctx.db });
    if (!adminCheck.authorized) {
      throw new Error("Not authorized");
    }

    const app = await ctx.db.get(applicationId);
    if (!app) {
      throw new Error("Application not found");
    }

    const now = Date.now();
    await ctx.db.patch(applicationId, {
      status: "APPROVED",
      decidedAt: now,
      decidedBy: adminId,
      updatedAt: now,
    });

    await upsertCommunityMember(ctx, {
      communityId: app.communityId,
      farmerId: app.farmerId,
      status: "APPROVED",
      applicationId: app._id,
    });

    await logAdminAction(ctx, {
      adminId,
      communityId: app.communityId,
      applicationId: app._id,
      action: "APPROVED",
      note,
    });

    return { success: true };
  },
});

export const rejectApplication = mutation({
  args: { adminId: v.id("users"), applicationId: v.id("communityApplications"), note: v.optional(v.string()) },
  handler: async (ctx, { adminId, applicationId, note }) => {
    const adminCheck = await verifyAdminRole({ userId: adminId, db: ctx.db });
    if (!adminCheck.authorized) {
      throw new Error("Not authorized");
    }

    const app = await ctx.db.get(applicationId);
    if (!app) {
      throw new Error("Application not found");
    }

    const now = Date.now();
    await ctx.db.patch(applicationId, {
      status: "REJECTED",
      decidedAt: now,
      decidedBy: adminId,
      updatedAt: now,
    });

    await upsertCommunityMember(ctx, {
      communityId: app.communityId,
      farmerId: app.farmerId,
      status: "REJECTED",
      applicationId: app._id,
    });

    await logAdminAction(ctx, {
      adminId,
      communityId: app.communityId,
      applicationId: app._id,
      action: "REJECTED",
      note,
    });

    return { success: true };
  },
});

export const revokeMembership = mutation({
  args: { adminId: v.id("users"), applicationId: v.id("communityApplications"), note: v.optional(v.string()) },
  handler: async (ctx, { adminId, applicationId, note }) => {
    const adminCheck = await verifyAdminRole({ userId: adminId, db: ctx.db });
    if (!adminCheck.authorized) {
      throw new Error("Not authorized");
    }

    const app = await ctx.db.get(applicationId);
    if (!app) {
      throw new Error("Application not found");
    }

    const now = Date.now();
    await ctx.db.patch(applicationId, {
      status: "REVOKED",
      decidedAt: now,
      decidedBy: adminId,
      updatedAt: now,
    });

    await upsertCommunityMember(ctx, {
      communityId: app.communityId,
      farmerId: app.farmerId,
      status: "REVOKED",
      applicationId: app._id,
    });

    await logAdminAction(ctx, {
      adminId,
      communityId: app.communityId,
      applicationId: app._id,
      action: "REVOKED",
      note,
    });

    return { success: true };
  },
});

export const deleteCommunityMember = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.id("communities"),
    farmerId: v.id("users"),
    applicationId: v.optional(v.id("communityApplications")),
  },
  handler: async (ctx, { adminId, communityId, farmerId, applicationId }) => {
    const adminCheck = await verifyAdminRole({ userId: adminId, db: ctx.db });
    if (!adminCheck.authorized) {
      throw new Error("Not authorized");
    }

    const adminUser = await ctx.db.get(adminId);
    if (!adminUser) {
      throw new Error("Admin not found");
    }

    const isSuperAdmin = adminUser.adminLevel === "super" || adminUser.adminLevel === undefined;
    if (!isSuperAdmin && adminUser.adminCategory === "community") {
      const community = await ctx.db.get(communityId);
      const assigned = (adminUser as any).assignedCommunityIds || [];
      const isDirectAdmin = community?.communityAdminId === adminId;
      const isAssigned = assigned.some((id: string) => id === communityId);
      if (!isAssigned && !isDirectAdmin) {
        throw new Error("Forbidden");
      }
    } else if (!isSuperAdmin && adminUser.adminCategory !== "community") {
      throw new Error("Forbidden");
    }

    const member = await ctx.db
      .query("communityMembers")
      .withIndex("by_community_farmer", (q: any) =>
        q.eq("communityId", communityId).eq("farmerId", farmerId)
      )
      .first();

    if (member) {
      await ctx.db.delete(member._id);
    }

    const membership = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community_user", (q: any) =>
        q.eq("communityId", communityId).eq("userId", farmerId)
      )
      .first();

    if (membership) {
      await ctx.db.delete(membership._id);
    }

    const appId = applicationId
      ? applicationId
      : (await ctx.db
          .query("communityApplications")
          .withIndex("by_community_farmer", (q: any) =>
            q.eq("communityId", communityId).eq("farmerId", farmerId)
          )
          .first())?._id;

    if (appId) {
      await ctx.db.patch(appId, {
        status: "REVOKED",
        decidedAt: Date.now(),
        decidedBy: adminId,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const backfillCommunityMembers = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.id("communities"),
  },
  handler: async (ctx, { adminId, communityId }) => {
    const adminCheck = await verifyAdminRole({ userId: adminId, db: ctx.db });
    if (!adminCheck.authorized) {
      throw new Error("Not authorized");
    }

    const adminUser = await ctx.db.get(adminId);
    if (!adminUser) {
      throw new Error("Admin not found");
    }

    const isSuperAdmin = adminUser.adminLevel === "super" || adminUser.adminLevel === undefined;
    if (!isSuperAdmin && adminUser.adminCategory === "community") {
      const community = await ctx.db.get(communityId);
      const assigned = (adminUser as any).assignedCommunityIds || [];
      const isDirectAdmin = community?.communityAdminId === adminId;
      const isAssigned = assigned.some((id: string) => id === communityId);
      if (!isAssigned && !isDirectAdmin) {
        throw new Error("Forbidden");
      }
    } else if (!isSuperAdmin && adminUser.adminCategory !== "community") {
      throw new Error("Forbidden");
    }

    const applications = await ctx.db
      .query("communityApplications")
      .withIndex("by_community", (q: any) => q.eq("communityId", communityId))
      .collect();

    let updated = 0;
    for (const app of applications) {
      await upsertCommunityMember(ctx, {
        communityId: app.communityId,
        farmerId: app.farmerId,
        status: app.status,
        applicationId: app._id,
      });
      updated += 1;
    }

    return { success: true, total: applications.length, updated };
  },
});

export const getExportData = query({
  args: {
    adminId: v.id("users"),
    status: v.optional(v.union(
      v.literal("PENDING"),
      v.literal("APPROVED"),
      v.literal("REJECTED"),
      v.literal("REVOKED")
    )),
  },
  handler: async (ctx, { adminId, status }) => {
    try {
      const adminCheck = await verifyAdminRole({ userId: adminId, db: ctx.db });
      if (!adminCheck.authorized) {
        throw new Error("Not authorized");
      }

      const communityId = await getAgroFreshCommunityId(ctx);

      const adminUser = await ctx.db.get(adminId);
      if (!adminUser) {
        throw new Error("Admin not found");
      }

      const isSuperAdmin = adminUser.adminLevel === "super" || adminUser.adminLevel === undefined;
      if (!isSuperAdmin && adminUser.adminCategory === "community") {
        const community = await ctx.db.get(communityId);
        const assigned = (adminUser as any).assignedCommunityIds || [];
        const isDirectAdmin = community?.communityAdminId === adminId;
        const isAssigned = assigned.some((id: string) => id === communityId);
        if (!isAssigned && !isDirectAdmin) {
          throw new Error("Forbidden");
        }
      } else if (!isSuperAdmin && adminUser.adminCategory !== "community") {
        throw new Error("Forbidden");
      }
      const all = await ctx.db
        .query("communityApplications")
        .withIndex("by_community", (q: any) => q.eq("communityId", communityId))
        .collect();

      const filtered = status ? all.filter((a: any) => a.status === status) : all;

      const latestByFarmer = new Map<Id<"users">, any>();
      const sorted = [...filtered].sort((a: any, b: any) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
      for (const app of sorted) {
        if (!latestByFarmer.has(app.farmerId)) {
          latestByFarmer.set(app.farmerId, app);
        }
      }

      const deduped = Array.from(latestByFarmer.values());
      const farmerIds = Array.from(new Set(deduped.map((a: any) => a.farmerId)));
      const formIds = Array.from(new Set(deduped.map((a: any) => a.formId)));

      const farmers = await Promise.all(farmerIds.map((id) => ctx.db.get(id)));
      const forms = await Promise.all(formIds.map((id) => ctx.db.get(id)));

      const farmerById = new Map(farmers.filter(Boolean).map((f: any) => [f._id, f]));
      const formById = new Map(forms.filter(Boolean).map((f: any) => [f._id, f]));

      return deduped.map((app: any) => {
        const farmer = farmerById.get(app.farmerId);
        const form = formById.get(app.formId);
        return {
          applicationId: app._id,
          status: app.status,
          createdAt: app.createdAt,
          updatedAt: app.updatedAt,
          farmer,
          form,
        };
      });
    } catch {
      return [];
    }
  },
});

/**
 * Sync admin to AgroFresh community
 * Helper to ensure the admin is correctly assigned to the resolved community ID
 */
export const syncAgroFreshAdmin = mutation({
  args: { adminId: v.id("users") },
  handler: async (ctx, { adminId }) => {
    const adminCheck = await verifyAdminRole({ userId: adminId, db: ctx.db });
    if (!adminCheck.authorized) {
      throw new Error("Not authorized");
    }

    const admin = await ctx.db.get(adminId);
    if (!admin) throw new Error("Admin not found");

    const communityId = await getAgroFreshCommunityId(ctx);
    const community = await ctx.db.get(communityId);
    const isDirectAdmin = community?.communityAdminId === adminId;
    if (!isDirectAdmin) {
      throw new Error("Forbidden");
    }

    const assigned = (admin as any).assignedCommunityIds || [];

    if (!assigned.some((id: string) => id === communityId)) {
      await ctx.db.patch(adminId, {
        assignedCommunityIds: [...assigned, communityId],
      });
      return { success: true, message: "Admin synchronized", communityId };
    }
    return { success: true, message: "Already synchronized", communityId };
  },
});
