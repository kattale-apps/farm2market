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
    // Count filled (non-empty) fields for FarmCoin reward
    const fieldCount = args.fieldValues.filter((fv) => fv.value && fv.value.trim() !== "").length;
    const entryId = await ctx.db.insert("farmTrackerEntries", {
      farmerId: args.farmerId,
      templateId: args.templateId,
      trackedUnitId: args.trackedUnitId,
      fieldValues: args.fieldValues,
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

/** Aggregate entry data for charts (tracker trend, survival rate, cost vs harvest) */
export const getToolboxInsights = query({
  args: {
    farmerId: v.id("users"),
    templateId: v.optional(v.id("farmTrackerTemplates")),
    seasonPlanId: v.optional(v.id("farmSeasonPlans")),
  },
  handler: async (_ctx, _args): Promise<{
    trackerTrend: any[];
    survivalRate: any;
    costVsHarvest: any;
  }> => {
    // TODO Phase 4: aggregate entry history for recharts-compatible datasets
    return { trackerTrend: [], survivalRate: null, costVsHarvest: null };
  },
});

// ─── PHASE 5 PLACEHOLDERS ────────────────────────────────────────────────────

/** 5a: Input/Supply Tracker — list farm inputs/supplies */
export const listSupplyEntries = query({
  args: { farmerId: v.id("users") },
  handler: async (_ctx, _args): Promise<any[]> => {
    // TODO Phase 5a: implement supply tracker table and queries
    return [];
  },
});

/** 5b: Farm Financial Ledger — list farm income/expense entries */
export const listFinancialEntries = query({
  args: { farmerId: v.id("users") },
  handler: async (_ctx, _args): Promise<any[]> => {
    // TODO Phase 5b: implement farmFinancialLedger table and queries
    return [];
  },
});
