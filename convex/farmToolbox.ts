/**
 * Farm Toolbox — Tracker Templates, Entries, Tracked Units
 *
 * Phase 0: Schema in place. All handlers are stubs — TODO markers indicate
 * where Phase 2 implementation will be dropped in.
 *
 * FarmCoin rewards: 1 coin per completed field on entry submission.
 * Call mintTrackerEntryCoin (convex/farmcoin.ts) after successful insert.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getUgandaTime, generateUTID } from "./utils";

const BIOFARM_COMMUNITY_ID = "ms72de3njrrc9k43cf9h3yq70181ncp0";
const BIOFARM_TEMPLATE_NAME = "Bio Farm Coffee Tag";
const LEGACY_BIOFARM_TEMPLATE_NAME = "Bio Farm Coffee Tree Tag Form";
const LEGACY_DEFAULT_BIOFARM_TEMPLATE_NAME = "Default Bio Farm Coffee Tree Tag Form";
const DEFAULT_TREE_TAG_PHOTO_FIELD = "Tree Tag Pic";
const DEFAULT_COFFEE_PHOTO_FIELD = "Coffee Tree Pic";
const LEGACY_COFFEE_PHOTO_FIELD = "Coffee Pic";
const DEFAULT_OBSERVATION_DATE_FIELD = "Date";
const LEGACY_OBSERVATION_DATE_FIELD = "Observation Date";
const DEFAULT_TAG_NAME_FIELD = "Tag Name/ Number";
const DEFAULT_GPS_FIELD = "GPS";

function isBioFarmTemplateName(templateName: string) {
  return (
    templateName === BIOFARM_TEMPLATE_NAME ||
    templateName === LEGACY_BIOFARM_TEMPLATE_NAME ||
    templateName === LEGACY_DEFAULT_BIOFARM_TEMPLATE_NAME
  );
}

function isDefaultBioFarmCoffeeTagTemplate(template: any) {
  const templateName = String(template?.templateName || "");
  return (
    template?.ownerType === "system" &&
    !template?.isDeleted &&
    isBioFarmTemplateName(templateName)
  );
}

function formatIsoDateFromTimestamp(ts: number) {
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDefaultBioFarmTemplateFields() {
  return [
    {
      name: DEFAULT_TREE_TAG_PHOTO_FIELD,
      fieldType: "photo" as const,
      required: true,
      emoji: "🏷",
      order: 0,
    },
    {
      name: DEFAULT_COFFEE_PHOTO_FIELD,
      fieldType: "photo" as const,
      required: true,
      emoji: "☕",
      order: 1,
    },
    {
      name: DEFAULT_TAG_NAME_FIELD,
      fieldType: "text" as const,
      required: true,
      emoji: "🏷",
      order: 2,
    },
    {
      name: DEFAULT_OBSERVATION_DATE_FIELD,
      fieldType: "date" as const,
      required: true,
      emoji: "📅",
      order: 3,
    },
    {
      name: DEFAULT_GPS_FIELD,
      fieldType: "gps" as const,
      required: true,
      emoji: "📍",
      order: 4,
    },
  ];
}

async function assertBioFarmAdminCommunityAccess(
  ctx: any,
  adminId: Id<"users">,
  communityId: Id<"communities">
) {
  if (String(communityId) !== BIOFARM_COMMUNITY_ID) {
    throw new Error("Active Farms is available only for Bio Farm community");
  }

  const adminUser = await ctx.db.get(adminId);
  if (!adminUser || adminUser.role !== "admin") {
    throw new Error("Not authorized");
  }

  const community = await ctx.db.get(communityId);
  if (!community) {
    throw new Error("Community not found");
  }

  const isSuperAdmin =
    adminUser.adminLevel === "super" || adminUser.adminLevel === undefined;

  if (isSuperAdmin) {
    return { adminUser, community };
  }

  if (adminUser.adminCategory !== "community") {
    throw new Error("Forbidden");
  }

  const assigned = (adminUser as any).assignedCommunityIds || [];
  const assignedSet = new Set(assigned.map((id: any) => String(id)));
  const isDirectAdmin = String((community as any).communityAdminId || "") === String(adminId);

  if (!assignedSet.has(String(communityId)) && !isDirectAdmin) {
    throw new Error("Not authorized for this community");
  }

  return { adminUser, community };
}

async function assertBioFarmMemberEligibility(
  ctx: any,
  communityId: Id<"communities">,
  memberId: Id<"users">
) {
  const membership = await ctx.db
    .query("communityMembers")
    .withIndex("by_community_farmer", (q: any) =>
      q.eq("communityId", communityId).eq("farmerId", memberId)
    )
    .first();

  if (membership && membership.status === "APPROVED") {
    return true;
  }

  const legacyMembership = await ctx.db
    .query("communityMemberships")
    .withIndex("by_community_user", (q: any) =>
      q.eq("communityId", communityId).eq("userId", memberId)
    )
    .first();

  if (!legacyMembership) {
    throw new Error("Member is not approved in Bio Farm community");
  }

  return true;
}

async function enrichTrackerEntriesForAdmin(ctx: any, entries: any[]) {
  if (!entries.length) return [];

  const enriched = await Promise.all(
    entries.map(async (entry: any) => {
      const photoUrls = entry.photoStorageIds
        ? await Promise.all(entry.photoStorageIds.map((sid: any) => ctx.storage.getUrl(sid)))
        : [];

      const templateDetails = await ctx.db.get(entry.templateId);
      const unitDetails = entry.trackedUnitId
        ? await ctx.db.get(entry.trackedUnitId as Id<"farmTrackedUnits">)
        : null;

      return {
        ...entry,
        photoUrls: photoUrls.filter(Boolean),
        templateDetails,
        unitDetails,
      };
    })
  );

  return enriched.sort(
    (a: any, b: any) =>
      (b.submittedAt || b.createdAt || 0) - (a.submittedAt || a.createdAt || 0)
  );
}

async function filterEntriesToBioFarmTemplate(ctx: any, entries: any[]) {
  const checks = await Promise.all(
    entries.map(async (entry: any) => {
      const template = await ctx.db.get(entry.templateId);
      return {
        entry,
        include: isDefaultBioFarmCoffeeTagTemplate(template),
      };
    })
  );

  return checks.filter((item: any) => item.include).map((item: any) => item.entry);
}

// ─── TRACKER TEMPLATES ──────────────────────────────────────────────────────

/** List templates visible to a farmer (system + their community + personal) */
export const listTemplates = query({
  args: {
    farmerId: v.id("users"),
    communityId: v.optional(v.id("communities")),
    category: v.optional(v.union(v.literal("crop"), v.literal("livestock"), v.literal("general"))),
  },
  handler: async (ctx, args) => {
    const results: any[] = [];

    // System templates (everyone sees)
    const systemTemplates = await ctx.db
      .query("farmTrackerTemplates")
      .withIndex("by_owner_type", (q: any) => q.eq("ownerType", "system"))
      .collect();
    results.push(...systemTemplates.filter((t) => t.isActive && !t.isDeleted));

    // Community templates
    if (args.communityId) {
      const communityTemplates = await ctx.db
        .query("farmTrackerTemplates")
        .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
        .collect();
      results.push(...communityTemplates.filter((t) => t.isActive && !t.isDeleted));
    }

    // Personal templates
    const personalTemplates = await ctx.db
      .query("farmTrackerTemplates")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", args.farmerId))
      .collect();
    results.push(...personalTemplates.filter((t) => t.ownerType === "personal" && !t.isDeleted));

    // Deduplicate + optional category filter
    const seen = new Set<string>();
    return results.filter((t) => {
      if (seen.has(t._id)) return false;
      seen.add(t._id);
      if (args.category && t.category !== args.category) return false;
      return true;
    });
  },
});

/** Ensure the mandatory Bio Farm default template exists (idempotent). */
export const ensureDefaultBioFarmCoffeeTreeTagTemplate = mutation({
  args: {
    requestingUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existingSystemTemplates = await ctx.db
      .query("farmTrackerTemplates")
      .withIndex("by_owner_type", (q: any) => q.eq("ownerType", "system"))
      .collect();

    const existingDefault = existingSystemTemplates.find((tpl: any) =>
      isDefaultBioFarmCoffeeTagTemplate(tpl)
    );
    if (existingDefault) {
      await ctx.db.patch(existingDefault._id, {
        templateName: BIOFARM_TEMPLATE_NAME,
        emoji: "🍃",
        fields: buildDefaultBioFarmTemplateFields(),
        updatedAt: getUgandaTime(),
      });
      return { templateId: existingDefault._id, created: false };
    }

    const now = getUgandaTime();
    const templateId = await ctx.db.insert("farmTrackerTemplates", {
      ownerId: args.requestingUserId,
      ownerType: "system",
      category: "crop",
      templateName: BIOFARM_TEMPLATE_NAME,
      emoji: "🍃",
      description:
        "Mandatory Bio Farm live-capture form for coffee tree tagging (camera + GPS + date)",
      fields: buildDefaultBioFarmTemplateFields(),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return { templateId, created: true };
  },
});

/** Create a system template (SuperAdmin) or community template (CommunityAdmin) or personal template (Farmer) */
export const createTemplate = mutation({
  args: {
    ownerId: v.id("users"),
    ownerType: v.union(v.literal("system"), v.literal("community"), v.literal("personal")),
    communityId: v.optional(v.id("communities")),
    category: v.union(v.literal("crop"), v.literal("livestock"), v.literal("general")),
    templateName: v.string(),
    emoji: v.string(),
    description: v.optional(v.string()),
    fields: v.array(v.object({
      name: v.string(),
      fieldType: v.union(
        v.literal("text"),
        v.literal("number"),
        v.literal("date"),
        v.literal("select"),
        v.literal("yesno"),
        v.literal("photo"),
        v.literal("rating"),
        v.literal("gps")
      ),
      options: v.optional(v.array(v.string())),
      unit: v.optional(v.string()),
      required: v.boolean(),
      emoji: v.optional(v.string()),
      order: v.number(),
    })),
  },
  handler: async (ctx, args): Promise<Id<"farmTrackerTemplates">> => {
    const now = getUgandaTime();

    const templateName = args.templateName.trim();
    if (!templateName) {
      throw new Error("Template name is required");
    }

    if (args.fields.length === 0) {
      throw new Error("Add at least one field");
    }

    const cleanedFields = args.fields.map((field, idx) => {
      const cleanedName = field.name.trim();
      if (!cleanedName) {
        throw new Error(`Field #${idx + 1} is missing a name`);
      }

      const cleanedOptions = (field.options || []).map((opt) => opt.trim()).filter(Boolean);
      if (field.fieldType === "select" && cleanedOptions.length === 0) {
        throw new Error(`Select field \"${cleanedName}\" requires at least one option`);
      }

      return {
        ...field,
        name: cleanedName,
        options: field.fieldType === "select" ? cleanedOptions : undefined,
        order: idx,
      };
    });

    const loweredNames = cleanedFields.map((field) => field.name.toLowerCase());
    if (new Set(loweredNames).size !== loweredNames.length) {
      throw new Error("Field names must be unique");
    }

    return await ctx.db.insert("farmTrackerTemplates", {
      ownerId: args.ownerId,
      ownerType: args.ownerType,
      communityId: args.communityId,
      category: args.category,
      templateName,
      emoji: args.emoji,
      description: args.description?.trim() || undefined,
      fields: cleanedFields,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Soft-delete a personal template (farmer deletes their own) */
export const deleteTemplate = mutation({
  args: {
    templateId: v.id("farmTrackerTemplates"),
    requestingUserId: v.id("users"),
  },
  handler: async (ctx, args): Promise<void> => {
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");
    if (isDefaultBioFarmCoffeeTagTemplate(template)) {
      throw new Error("Bio Farm Coffee Tag cannot be deleted");
    }
    if (template.ownerId !== args.requestingUserId || template.ownerType !== "personal") {
      throw new Error("Not authorised — can only delete your own personal templates");
    }
    const now = getUgandaTime();
    // Check for linked entries
    const linkedEntry = await ctx.db
      .query("farmTrackerEntries")
      .withIndex("by_template", (q: any) => q.eq("templateId", args.templateId))
      .first();
    if (linkedEntry) {
      // Soft-delete
      await ctx.db.patch(args.templateId, { isDeleted: true, deletedAt: now, updatedAt: now });
    } else {
      // Hard-delete
      await ctx.db.delete(args.templateId);
    }
  },
});

// ─── TRACKER ENTRIES ─────────────────────────────────────────────────────────

/** List entries by farmer (most recent first) */
export const listEntries = query({
  args: {
    farmerId: v.id("users"),
    templateId: v.optional(v.id("farmTrackerTemplates")),
    trackedUnitId: v.optional(v.id("farmTrackedUnits")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("farmTrackerEntries");
    if (args.templateId) {
      const rows = await ctx.db
        .query("farmTrackerEntries")
        .withIndex("by_farmer_template", (iq: any) => iq.eq("farmerId", args.farmerId).eq("templateId", args.templateId))
        .order("desc")
        .take(args.limit ?? 50);
      // Resolve photo URLs
      return await Promise.all(rows.map(async (entry: any) => ({
        ...entry,
        photoUrls: entry.photoStorageIds
          ? await Promise.all(entry.photoStorageIds.map((sid: any) => ctx.storage.getUrl(sid)))
          : [],
      })));
    }
    const rows = await ctx.db
      .query("farmTrackerEntries")
      .withIndex("by_farmer", (iq: any) => iq.eq("farmerId", args.farmerId))
      .order("desc")
      .take(args.limit ?? 50);
    return await Promise.all(rows.map(async (entry: any) => ({
      ...entry,
      photoUrls: entry.photoStorageIds
        ? await Promise.all(entry.photoStorageIds.map((sid: any) => ctx.storage.getUrl(sid)))
        : [],
    })));
  },
});

/**
 * Active Farmsee list for Bio Farm community (approved members with Farm Toolbox entries)
 */
export const getBioFarmActiveFarmseeMembersByCommunityIds = query({
  args: {
    adminId: v.id("users"),
    communityIds: v.array(v.id("communities")),
  },
  handler: async (ctx, args) => {
    const results = await Promise.all(
      args.communityIds.map(async (communityId) => {
        try {
          if (String(communityId) !== BIOFARM_COMMUNITY_ID) {
            return { communityId, members: [] };
          }

          await assertBioFarmAdminCommunityAccess(ctx, args.adminId, communityId);

          const memberships = await ctx.db
            .query("communityMembers")
            .withIndex("by_community", (q: any) => q.eq("communityId", communityId))
            .collect();
          let approvedMemberIds = memberships
            .filter((m: any) => m.status === "APPROVED")
            .map((m: any) => String(m.farmerId));

          if (approvedMemberIds.length === 0) {
            const legacyMemberships = await ctx.db
              .query("communityMemberships")
              .withIndex("by_community", (q: any) => q.eq("communityId", communityId))
              .collect();
            approvedMemberIds = legacyMemberships.map((m: any) => String(m.userId));
          }

          const members = await Promise.all(
            approvedMemberIds.map(async (memberId) => {
              const entries = await ctx.db
                .query("farmTrackerEntries")
                .withIndex("by_farmer", (q: any) => q.eq("farmerId", memberId as Id<"users">))
                .order("desc")
                .collect();

              const bioFarmEntries = await filterEntriesToBioFarmTemplate(ctx, entries);

              if (!bioFarmEntries.length) return null;

              const member = await ctx.db.get(memberId as Id<"users">);
              const latestEntry = bioFarmEntries[0];
              const latestPhotoStorageIds = (latestEntry?.photoStorageIds || []).slice(0, 2);
              const latestPhotoUrls = latestPhotoStorageIds.length
                ? (await Promise.all(
                    latestPhotoStorageIds.map((sid: any) => ctx.storage.getUrl(sid))
                  )).filter(Boolean)
                : [];
              const latestSubmissionAt = Math.max(
                ...bioFarmEntries.map((r: any) => r.submittedAt || r.createdAt || 0)
              );

              return {
                memberId: memberId as Id<"users">,
                alias: (member as any)?.alias || "Unknown",
                phoneNumber: (member as any)?.phoneNumber || "-",
                email: (member as any)?.email || "-",
                role: (member as any)?.role || "farmer",
                submissionCount: bioFarmEntries.length,
                latestSubmissionAt,
                latestPhotoUrls,
              };
            })
          );

          return {
            communityId,
            members: members.filter(Boolean).sort((a: any, b: any) => b.latestSubmissionAt - a.latestSubmissionAt),
          };
        } catch (error: any) {
          return {
            communityId,
            members: [],
            error: error?.message || "Unable to load Active Farms members",
          };
        }
      })
    );

    return results;
  },
});

/**
 * Admin read-only drill-down for a Bio Farm member's Farm Toolbox entries
 */
export const getBioFarmMemberEntriesForAdmin = query({
  args: {
    adminId: v.id("users"),
    communityId: v.id("communities"),
    memberId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await assertBioFarmAdminCommunityAccess(ctx, args.adminId, args.communityId);
    await assertBioFarmMemberEligibility(ctx, args.communityId, args.memberId);

    const entries = await ctx.db
      .query("farmTrackerEntries")
      .withIndex("by_farmer", (q: any) => q.eq("farmerId", args.memberId))
      .order("desc")
      .collect();

    const scopedBioFarmEntries = await filterEntriesToBioFarmTemplate(ctx, entries);
    return await enrichTrackerEntriesForAdmin(ctx, scopedBioFarmEntries);
  },
});

/**
 * Secure export payload for Bio Farm member toolbox entries (single or batch)
 */
export const getBioFarmMemberEntriesForExport = query({
  args: {
    adminId: v.id("users"),
    communityId: v.id("communities"),
    memberId: v.id("users"),
    submissionIds: v.optional(v.array(v.id("farmTrackerEntries"))),
  },
  handler: async (ctx, args) => {
    await assertBioFarmAdminCommunityAccess(ctx, args.adminId, args.communityId);
    await assertBioFarmMemberEligibility(ctx, args.communityId, args.memberId);

    let entries: any[] = [];
    if (args.submissionIds && args.submissionIds.length > 0) {
      const fetched = await Promise.all(args.submissionIds.map((id) => ctx.db.get(id)));
      entries = fetched.filter(Boolean) as any[];
    } else {
      entries = await ctx.db
        .query("farmTrackerEntries")
        .withIndex("by_farmer", (q: any) => q.eq("farmerId", args.memberId))
        .order("desc")
        .collect();
    }

    const scoped = entries.filter((entry: any) => String(entry.farmerId) === String(args.memberId));
    const scopedBioFarmEntries = await filterEntriesToBioFarmTemplate(ctx, scoped);
    return await enrichTrackerEntriesForAdmin(ctx, scopedBioFarmEntries);
  },
});

/** Submit a tracker entry. Awards FarmCoin (1 coin/field). Supports offline queue. */
export const submitEntry = mutation({
  args: {
    farmerId: v.id("users"),
    templateId: v.id("farmTrackerTemplates"),
    trackedUnitId: v.optional(v.id("farmTrackedUnits")),
    fieldValues: v.array(v.object({
      fieldName: v.string(),
      value: v.string(),
    })),
    photoStorageIds: v.optional(v.array(v.id("_storage"))),
    gpsLat: v.optional(v.number()),
    gpsLng: v.optional(v.number()),
    gpsAccuracy: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"farmTrackerEntries">> => {
    const now = getUgandaTime();
    const template = await ctx.db.get(args.templateId);
    if (!template || template.isDeleted || !template.isActive) {
      throw new Error("Template is not available");
    }

    const isDefaultBioFarmTemplate = isDefaultBioFarmCoffeeTagTemplate(template);
    const finalFieldValues = [...args.fieldValues];

    if (isDefaultBioFarmTemplate) {
      if (!args.photoStorageIds || args.photoStorageIds.length < 2) {
        throw new Error("Tree Tag Pic and Coffee Tree Pic are required");
      }
      if (args.gpsLat === undefined || args.gpsLng === undefined) {
        throw new Error("Live GPS capture is required before submitting this form");
      }

      const dateFieldIndex = finalFieldValues.findIndex((fv) =>
        fv.fieldName === DEFAULT_OBSERVATION_DATE_FIELD ||
        fv.fieldName === LEGACY_OBSERVATION_DATE_FIELD
      );
      const gpsFieldIndex = finalFieldValues.findIndex(
        (fv) => fv.fieldName === DEFAULT_GPS_FIELD
      );

      const observationDate =
        dateFieldIndex >= 0 && finalFieldValues[dateFieldIndex].value.trim()
          ? finalFieldValues[dateFieldIndex].value.trim()
          : formatIsoDateFromTimestamp(now);

      if (dateFieldIndex >= 0) {
        finalFieldValues[dateFieldIndex] = {
          ...finalFieldValues[dateFieldIndex],
          fieldName: DEFAULT_OBSERVATION_DATE_FIELD,
          value: observationDate,
        };
      } else {
        finalFieldValues.push({
          fieldName: DEFAULT_OBSERVATION_DATE_FIELD,
          value: observationDate,
        });
      }

      const gpsValue = `${Number(args.gpsLat).toFixed(6)}, ${Number(args.gpsLng).toFixed(6)}`;
      if (gpsFieldIndex >= 0) {
        finalFieldValues[gpsFieldIndex] = {
          ...finalFieldValues[gpsFieldIndex],
          value: gpsValue,
        };
      } else {
        finalFieldValues.push({ fieldName: DEFAULT_GPS_FIELD, value: gpsValue });
      }

      const normalizedFieldMap = new Map(
        finalFieldValues.map((fv) => [String(fv.fieldName || ""), String(fv.value || "").trim()])
      );
      if (!normalizedFieldMap.get(DEFAULT_COFFEE_PHOTO_FIELD)) {
        const legacyCoffeeValue = normalizedFieldMap.get(LEGACY_COFFEE_PHOTO_FIELD);
        if (legacyCoffeeValue) {
          normalizedFieldMap.set(DEFAULT_COFFEE_PHOTO_FIELD, legacyCoffeeValue);
        }
      }

      const missingRequired = (template.fields || [])
        .filter((field: any) => field.required && field.fieldType !== "photo")
        .filter((field: any) => {
          const value = normalizedFieldMap.get(field.name) || "";
          return !String(value).trim();
        });
      if (missingRequired.length > 0) {
        throw new Error(
          `Missing required fields: ${missingRequired.map((f: any) => f.name).join(", ")}`
        );
      }
    }

    // Count filled (non-empty) fields for FarmCoin reward
    const fieldCount = finalFieldValues.filter((fv) => fv.value && fv.value.trim() !== "").length;
    const entryId = await ctx.db.insert("farmTrackerEntries", {
      farmerId: args.farmerId,
      templateId: args.templateId,
      trackedUnitId: args.trackedUnitId,
      fieldValues: finalFieldValues,
      photoStorageIds: args.photoStorageIds,
      gpsLat: args.gpsLat,
      gpsLng: args.gpsLng,
      gpsAccuracy: args.gpsAccuracy,
      fieldCount,
      farmcoinRewarded: false,
      syncStatus: "synced",
      notes: args.notes,
      submittedAt: now,
      createdAt: now,
    });
    // Award FarmCoin (1 coin per filled field) — inline to avoid cross-mutation call
    if (fieldCount > 0) {
      // Dedup check
      const existing = await ctx.db
        .query("farmcoinLedger")
        .withIndex("by_account", (q: any) => q.eq("accountType", "farmer"))
        .filter((q: any) =>
          q.and(
            q.eq(q.field("userId"), args.farmerId),
            q.eq(q.field("trackerEntryId"), entryId)
          )
        )
        .first();
      if (!existing) {
        const latest = await ctx.db
          .query("farmcoinLedger")
          .withIndex("by_account", (q: any) => q.eq("accountType", "farmer"))
          .filter((q: any) => q.eq(q.field("userId"), args.farmerId))
          .order("desc")
          .first();
        const currentBalance = latest?.balanceAfter ?? 0;
        await ctx.db.insert("farmcoinLedger", {
          accountType: "farmer",
          userId: args.farmerId,
          delta: fieldCount,
          balanceAfter: currentBalance + fieldCount,
          source: "tracker_entry_reward",
          utid: generateUTID("ftr"),
          trackerEntryId: entryId,
          fieldCount,
          reason: `Tracker entry reward: ${fieldCount} field${fieldCount > 1 ? "s" : ""} submitted`,
          createdAt: now,
        });
        await ctx.db.patch(entryId, { farmcoinRewarded: true });
      }
    }
    return entryId;
  },
});

/** Delete a tracker entry (farmer deletes own) */
export const deleteEntry = mutation({
  args: {
    entryId: v.id("farmTrackerEntries"),
    requestingUserId: v.id("users"),
  },
  handler: async (ctx, args): Promise<void> => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) throw new Error("Entry not found");
    if (entry.farmerId !== args.requestingUserId) throw new Error("Not authorised");
    await ctx.db.delete(args.entryId);
  },
});

/** Get a single entry by ID with resolved photo URLs and enriched template/unit details */
export const getEntryById = query({
  args: {
    entryId: v.id("farmTrackerEntries"),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) return null;

    // Resolve photo URLs
    const photoUrls = entry.photoStorageIds
      ? await Promise.all(entry.photoStorageIds.map((sid: any) => ctx.storage.getUrl(sid)))
      : [];

    // Get template details
    const template = await ctx.db.get(entry.templateId);

    // Get tracked unit details if referenced
    const trackedUnit = entry.trackedUnitId ? await ctx.db.get(entry.trackedUnitId) : null;

    return {
      ...entry,
      photoUrls,
      templateDetails: template,
      unitDetails: trackedUnit,
    };
  },
});

/** Get multiple entries by IDs with resolved photo URLs and enriched details (for batch export) */
export const getEntriesByIds = query({
  args: {
    entryIds: v.array(v.id("farmTrackerEntries")),
  },
  handler: async (ctx, args) => {
    const entries = await Promise.all(args.entryIds.map((id) => ctx.db.get(id)));
    const valid = entries.filter((e) => e !== null);

    return await Promise.all(
      valid.map(async (entry: any) => {
        // Resolve photo URLs
        const photoUrls = entry.photoStorageIds
          ? await Promise.all(entry.photoStorageIds.map((sid: any) => ctx.storage.getUrl(sid)))
          : [];

        // Get template details
        const template = await ctx.db.get(entry.templateId);

        // Get tracked unit details if referenced
        const trackedUnit = entry.trackedUnitId ? await ctx.db.get(entry.trackedUnitId) : null;

        return {
          ...entry,
          photoUrls,
          templateDetails: template,
          unitDetails: trackedUnit,
        };
      })
    );
  },
});

// ─── TRACKED UNITS ───────────────────────────────────────────────────────────

/** List farmer's tracked units (optional category filter) */
export const listTrackedUnits = query({
  args: {
    farmerId: v.id("users"),
    category: v.optional(v.union(v.literal("crop"), v.literal("livestock"))),
  },
  handler: async (ctx, args) => {
    if (args.category) {
      return await ctx.db
        .query("farmTrackedUnits")
        .withIndex("by_farmer_category", (q: any) => q.eq("farmerId", args.farmerId).eq("category", args.category))
        .order("desc")
        .collect();
    }
    return await ctx.db
      .query("farmTrackedUnits")
      .withIndex("by_farmer", (q: any) => q.eq("farmerId", args.farmerId))
      .order("desc")
      .collect();
  },
});

/** Create a tracked unit (individual or group) */
export const createTrackedUnit = mutation({
  args: {
    farmerId: v.id("users"),
    category: v.union(v.literal("crop"), v.literal("livestock")),
    unitType: v.string(),
    name: v.optional(v.string()),
    number: v.optional(v.number()),
    groupLabel: v.optional(v.string()),
    count: v.optional(v.number()),
    emoji: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"farmTrackedUnits">> => {
    const now = getUgandaTime();
    return await ctx.db.insert("farmTrackedUnits", {
      farmerId: args.farmerId,
      category: args.category,
      unitType: args.unitType,
      name: args.name,
      number: args.number,
      groupLabel: args.groupLabel,
      count: args.count,
      emoji: args.emoji,
      status: "active",
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update tracked unit status (active/sold/deceased/harvested) */
export const updateTrackedUnitStatus = mutation({
  args: {
    unitId: v.id("farmTrackedUnits"),
    requestingUserId: v.id("users"),
    status: v.union(
      v.literal("active"),
      v.literal("sold"),
      v.literal("deceased"),
      v.literal("harvested")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const unit = await ctx.db.get(args.unitId);
    if (!unit) throw new Error("Unit not found");
    if (unit.farmerId !== args.requestingUserId) throw new Error("Not authorised");
    await ctx.db.patch(args.unitId, { status: args.status, notes: args.notes, updatedAt: getUgandaTime() });
  },
});

/** Delete a tracked unit (only if no entries reference it) */
export const deleteTrackedUnit = mutation({
  args: {
    unitId: v.id("farmTrackedUnits"),
    requestingUserId: v.id("users"),
  },
  handler: async (ctx, args): Promise<void> => {
    const unit = await ctx.db.get(args.unitId);
    if (!unit) throw new Error("Unit not found");
    if (unit.farmerId !== args.requestingUserId) throw new Error("Not authorised");
    // Check for linked entries
    const linked = await ctx.db
      .query("farmTrackerEntries")
      .withIndex("by_tracked_unit", (q: any) => q.eq("trackedUnitId", args.unitId))
      .first();
    if (linked) throw new Error("Cannot delete unit with existing tracker entries");
    await ctx.db.delete(args.unitId);
  },
});

// ─── INSIGHTS (PHASE 4) ───────────────────────────────────────────────────────

/** Aggregate entry data for dashboards — entry counts, unit survival, top template */
export const getToolboxInsights = query({
  args: {
    farmerId: v.id("users"),
    templateId: v.optional(v.id("farmTrackerTemplates")),
    seasonPlanId: v.optional(v.id("farmSeasonPlans")),
  },
  handler: async (ctx, args): Promise<{
    totalEntriesThisMonth: number;
    totalEntriesAllTime: number;
    topTemplateName: string | null;
    topTemplateEmoji: string | null;
    unitSurvival: Array<{ unitId: string; name: string; unitType: string; emoji: string | null; status: string; entryCount: number }>;
    recentEntries: Array<{ _id: string; templateName: string; templateEmoji: string | null; submittedAt: number; fieldCount: number }>;
    entriesByDay: Array<{ date: string; count: number }>;
  }> => {
    const now = Date.now();
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // All entries for this farmer
    const allEntries = await ctx.db
      .query("farmTrackerEntries")
      .withIndex("by_farmer", (q: any) => q.eq("farmerId", args.farmerId))
      .order("desc")
      .collect();

    const thisMonthEntries = allEntries.filter((e) => e.submittedAt >= startOfMonth);
    const last30DaysEntries = allEntries.filter((e) => e.submittedAt >= thirtyDaysAgo);

    // Top template by usage
    const templateCounts: Record<string, number> = {};
    for (const entry of allEntries) {
      templateCounts[entry.templateId] = (templateCounts[entry.templateId] ?? 0) + 1;
    }
    const topTemplateId = Object.entries(templateCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    let topTemplateName: string | null = null;
    let topTemplateEmoji: string | null = null;
    if (topTemplateId) {
      const tpl = await ctx.db.get(topTemplateId as any);
      topTemplateName = tpl?.name ?? null;
      topTemplateEmoji = tpl?.emoji ?? null;
    }

    // Unit survival: get all units + count entries per unit
    const units = await ctx.db
      .query("farmTrackedUnits")
      .withIndex("by_farmer", (q: any) => q.eq("farmerId", args.farmerId))
      .collect();
    const unitEntryCounts: Record<string, number> = {};
    for (const entry of allEntries) {
      if (entry.trackedUnitId) {
        unitEntryCounts[entry.trackedUnitId] = (unitEntryCounts[entry.trackedUnitId] ?? 0) + 1;
      }
    }
    const unitSurvival = units.map((u) => ({
      unitId: u._id as string,
      name: u.name ?? u.groupLabel ?? u.unitType,
      unitType: u.unitType,
      emoji: u.emoji ?? null,
      status: u.status,
      entryCount: unitEntryCounts[u._id] ?? 0,
    }));

    // Recent entries (last 10) with template name
    const recentRaw = allEntries.slice(0, 10);
    const recentEntries = await Promise.all(
      recentRaw.map(async (e) => {
        const tpl = await ctx.db.get(e.templateId);
        return {
          _id: e._id as string,
          templateName: tpl?.name ?? "Unknown",
          templateEmoji: tpl?.emoji ?? null,
          submittedAt: e.submittedAt,
          fieldCount: e.fieldCount ?? e.fieldValues.length,
        };
      })
    );

    // Entries by day for the last 30 days (for inline bar chart)
    const dayMap: Record<string, number> = {};
    for (const entry of last30DaysEntries) {
      const d = new Date(entry.submittedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      dayMap[key] = (dayMap[key] ?? 0) + 1;
    }
    const entriesByDay = Object.entries(dayMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    return {
      totalEntriesThisMonth: thisMonthEntries.length,
      totalEntriesAllTime: allEntries.length,
      topTemplateName,
      topTemplateEmoji,
      unitSurvival,
      recentEntries,
      entriesByDay,
    };
  },
});

// ─── PHASE 5 PLACEHOLDERS ────────────────────────────────────────────────────

/** 5a: Input/Supply Tracker — list farm inputs/supplies */
export const listSupplyEntries = query({
  args: { farmerId: v.id("users"), category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("farmSupplyEntries")
      .withIndex("by_farmer", (q: any) => q.eq("farmerId", args.farmerId))
      .order("desc")
      .collect();
    if (args.category) return entries.filter((e) => e.category === args.category);
    return entries;
  },
});

/** 5a: Add a supply entry */
export const addSupplyEntry = mutation({
  args: {
    farmerId: v.id("users"),
    item: v.string(),
    category: v.union(
      v.literal("seed"), v.literal("fertiliser"), v.literal("chemical"),
      v.literal("pesticide"), v.literal("vet_input"), v.literal("animal_feed"),
      v.literal("equipment"), v.literal("labour"), v.literal("other")
    ),
    quantity: v.number(),
    unit: v.string(),
    unitCost: v.number(),
    totalCost: v.number(),
    purchasedAt: v.number(),
    supplier: v.optional(v.string()),
    notes: v.optional(v.string()),
    linkedSeasonPlanId: v.optional(v.id("farmSeasonPlans")),
    linkedUnitId: v.optional(v.id("farmTrackedUnits")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("farmSupplyEntries", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

/** 5a: Delete a supply entry */
export const deleteSupplyEntry = mutation({
  args: { entryId: v.id("farmSupplyEntries"), farmerId: v.id("users") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.farmerId !== args.farmerId) throw new Error("Not found");
    await ctx.db.delete(args.entryId);
  },
});

/** 5b: Farm Financial Ledger — list income/expense entries */
export const listFinancialEntries = query({
  args: { farmerId: v.id("users"), type: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("farmFinancialEntries")
      .withIndex("by_farmer", (q: any) => q.eq("farmerId", args.farmerId))
      .order("desc")
      .collect();
    if (args.type) return entries.filter((e) => e.type === args.type);
    return entries;
  },
});

/** 5b: Add a financial ledger entry */
export const addFinancialEntry = mutation({
  args: {
    farmerId: v.id("users"),
    type: v.union(v.literal("income"), v.literal("expense")),
    category: v.union(
      v.literal("crop_sale"), v.literal("livestock_sale"), v.literal("input_cost"),
      v.literal("labour"), v.literal("transport"), v.literal("equipment"), v.literal("other")
    ),
    amount: v.number(),
    description: v.string(),
    entryDate: v.number(),
    linkedSeasonPlanId: v.optional(v.id("farmSeasonPlans")),
    linkedUnitId: v.optional(v.id("farmTrackedUnits")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("farmFinancialEntries", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

/** 5b: Delete a financial ledger entry */
export const deleteFinancialEntry = mutation({
  args: { entryId: v.id("farmFinancialEntries"), farmerId: v.id("users") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.farmerId !== args.farmerId) throw new Error("Not found");
    await ctx.db.delete(args.entryId);
  },
});
