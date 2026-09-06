/**
 * Farm Cost Templates — Crop and Livestock Cost Calculator
 *
 * Phase 0: Schema in place. All handlers are stubs.
 * Phase 1 will fill these in (SuperAdmin + Community Admin entry).
 *
 * Access rules:
 * - SuperAdmin: create/edit/archive system-wide templates (ownerType = "system")
 * - Community Admin (adminCategory = "community"): community templates
 * - Farmers: personal templates + read access to system/community templates
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";

const stageItemSchema = v.object({
  item: v.string(),
  unitCost: v.number(),
  quantity: v.number(),
  unit: v.optional(v.string()),
});

const cropStageSchema = v.object({
  stageName: v.string(),
  emoji: v.optional(v.string()),
  weekFromStart: v.number(),
  isHarvestStage: v.optional(v.boolean()),
  costItems: v.array(stageItemSchema),
});

const livestockStageSchema = v.object({
  stageName: v.string(),
  emoji: v.optional(v.string()),
  weekFromStart: v.number(),
  isSaleStage: v.optional(v.boolean()),
  costItems: v.array(stageItemSchema),
});

// ─── CROP COST TEMPLATES ──────────────────────────────────────────────────────

/** List crop cost templates visible to a user */
export const listCropCostTemplates = query({
  args: {
    requestingUserId: v.id("users"),
    communityId: v.optional(v.id("communities")),
    ownerType: v.optional(v.union(v.literal("system"), v.literal("community"), v.literal("personal"))),
  },
  handler: async (ctx, args) => {
    const results: any[] = [];

    // Always include active, non-deleted system templates
    const systemTemplates = await ctx.db
      .query("cropCostTemplates")
      .withIndex("by_owner_type", (q: any) => q.eq("ownerType", "system"))
      .collect();
    results.push(...systemTemplates.filter((t) => t.isActive && !t.isDeleted));

    // Community templates for the given communityId
    if (args.communityId) {
      const communityTemplates = await ctx.db
        .query("cropCostTemplates")
        .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
        .collect();
      results.push(...communityTemplates.filter((t) => t.isActive && !t.isDeleted));
    }

    // Personal templates owned by this user
    const personalTemplates = await ctx.db
      .query("cropCostTemplates")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", args.requestingUserId))
      .collect();
    results.push(...personalTemplates.filter((t) => t.ownerType === "personal" && !t.isDeleted));

    // Deduplicate by _id
    const seen = new Set<string>();
    return results.filter((t) => {
      if (seen.has(t._id)) return false;
      seen.add(t._id);
      return true;
    });
  },
});

/** Create a crop cost template */
export const createCropCostTemplate = mutation({
  args: {
    ownerId: v.id("users"),
    ownerType: v.union(v.literal("system"), v.literal("community"), v.literal("personal")),
    communityId: v.optional(v.id("communities")),
    cropType: v.string(),
    emoji: v.optional(v.string()),
    acreSize: v.number(),
    currency: v.optional(v.string()),
    stages: v.array(cropStageSchema),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"cropCostTemplates">> => {
    const now = getUgandaTime();
    return await ctx.db.insert("cropCostTemplates", {
      ownerId: args.ownerId,
      ownerType: args.ownerType,
      communityId: args.communityId,
      cropType: args.cropType,
      emoji: args.emoji,
      acreSize: args.acreSize,
      currency: args.currency ?? "UGX",
      stages: args.stages,
      notes: args.notes,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update a crop cost template */
export const updateCropCostTemplate = mutation({
  args: {
    templateId: v.id("cropCostTemplates"),
    requestingUserId: v.id("users"),
    cropType: v.optional(v.string()),
    emoji: v.optional(v.string()),
    acreSize: v.optional(v.number()),
    stages: v.optional(v.array(cropStageSchema)),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");
    if (template.ownerId !== args.requestingUserId) throw new Error("Not authorised");
    const patch: Record<string, any> = { updatedAt: getUgandaTime() };
    if (args.cropType !== undefined) patch.cropType = args.cropType;
    if (args.emoji !== undefined) patch.emoji = args.emoji;
    if (args.acreSize !== undefined) patch.acreSize = args.acreSize;
    if (args.stages !== undefined) patch.stages = args.stages;
    if (args.notes !== undefined) patch.notes = args.notes;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    await ctx.db.patch(args.templateId, patch);
  },
});

/** Archive (soft-delete) a crop cost template */
export const archiveCropCostTemplate = mutation({
  args: {
    templateId: v.id("cropCostTemplates"),
    requestingUserId: v.id("users"),
  },
  handler: async (ctx, args): Promise<void> => {
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");
    if (template.ownerId !== args.requestingUserId) throw new Error("Not authorised");
    await ctx.db.patch(args.templateId, { isDeleted: true, isActive: false, updatedAt: getUgandaTime() });
  },
});

/** Calculate total cost for N acres using a crop template */
export const calculateCropCost = query({
  args: {
    templateId: v.id("cropCostTemplates"),
    acres: v.number(),
  },
  handler: async (ctx, args): Promise<{
    totalCost: number;
    currency: string;
    byStage: Array<{ stageName: string; emoji?: string; stageCost: number; weekFromStart: number; isHarvestStage?: boolean }>;
  }> => {
    const template = await ctx.db.get(args.templateId);
    if (!template) return { totalCost: 0, currency: "UGX", byStage: [] };
    const scale = args.acres / template.acreSize;
    let totalCost = 0;
    const byStage = template.stages.map((stage: any) => {
      const stageCost = stage.costItems.reduce((sum: number, item: any) => sum + item.unitCost * item.quantity * scale, 0);
      totalCost += stageCost;
      return { stageName: stage.stageName, emoji: stage.emoji, stageCost: Math.round(stageCost), weekFromStart: stage.weekFromStart, isHarvestStage: stage.isHarvestStage };
    });
    return { totalCost: Math.round(totalCost), currency: template.currency ?? "UGX", byStage };
  },
});

// ─── LIVESTOCK COST TEMPLATES ─────────────────────────────────────────────────

/** List livestock cost templates visible to a user */
export const listLivestockCostTemplates = query({
  args: {
    requestingUserId: v.id("users"),
    communityId: v.optional(v.id("communities")),
    ownerType: v.optional(v.union(v.literal("system"), v.literal("community"), v.literal("personal"))),
  },
  handler: async (ctx, args) => {
    const results: any[] = [];
    const systemTemplates = await ctx.db
      .query("livestockCostTemplates")
      .withIndex("by_owner_type", (q: any) => q.eq("ownerType", "system"))
      .collect();
    results.push(...systemTemplates.filter((t) => t.isActive && !t.isDeleted));
    if (args.communityId) {
      const communityTemplates = await ctx.db
        .query("livestockCostTemplates")
        .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
        .collect();
      results.push(...communityTemplates.filter((t) => t.isActive && !t.isDeleted));
    }
    const personalTemplates = await ctx.db
      .query("livestockCostTemplates")
      .withIndex("by_owner", (q: any) => q.eq("ownerId", args.requestingUserId))
      .collect();
    results.push(...personalTemplates.filter((t) => t.ownerType === "personal" && !t.isDeleted));
    const seen = new Set<string>();
    return results.filter((t) => { if (seen.has(t._id)) return false; seen.add(t._id); return true; });
  },
});

/** Create a livestock cost template */
export const createLivestockCostTemplate = mutation({
  args: {
    ownerId: v.id("users"),
    ownerType: v.union(v.literal("system"), v.literal("community"), v.literal("personal")),
    communityId: v.optional(v.id("communities")),
    livestockType: v.string(),
    emoji: v.optional(v.string()),
    acreSize: v.optional(v.number()),
    currency: v.optional(v.string()),
    stages: v.array(livestockStageSchema),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"livestockCostTemplates">> => {
    const now = getUgandaTime();
    return await ctx.db.insert("livestockCostTemplates", {
      ownerId: args.ownerId,
      ownerType: args.ownerType,
      communityId: args.communityId,
      livestockType: args.livestockType,
      emoji: args.emoji,
      acreSize: args.acreSize,
      currency: args.currency ?? "UGX",
      stages: args.stages,
      notes: args.notes,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update a livestock cost template */
export const updateLivestockCostTemplate = mutation({
  args: {
    templateId: v.id("livestockCostTemplates"),
    requestingUserId: v.id("users"),
    livestockType: v.optional(v.string()),
    emoji: v.optional(v.string()),
    stages: v.optional(v.array(livestockStageSchema)),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");
    if (template.ownerId !== args.requestingUserId) throw new Error("Not authorised");
    const patch: Record<string, any> = { updatedAt: getUgandaTime() };
    if (args.livestockType !== undefined) patch.livestockType = args.livestockType;
    if (args.emoji !== undefined) patch.emoji = args.emoji;
    if (args.stages !== undefined) patch.stages = args.stages;
    if (args.notes !== undefined) patch.notes = args.notes;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    await ctx.db.patch(args.templateId, patch);
  },
});

/** Archive a livestock cost template */
export const archiveLivestockCostTemplate = mutation({
  args: {
    templateId: v.id("livestockCostTemplates"),
    requestingUserId: v.id("users"),
  },
  handler: async (ctx, args): Promise<void> => {
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");
    if (template.ownerId !== args.requestingUserId) throw new Error("Not authorised");
    await ctx.db.patch(args.templateId, { isDeleted: true, isActive: false, updatedAt: getUgandaTime() });
  },
});

/** Calculate total cost for N heads using a livestock template */
export const calculateLivestockCost = query({
  args: {
    templateId: v.id("livestockCostTemplates"),
    headCount: v.number(),
  },
  handler: async (ctx, args): Promise<{
    totalCost: number;
    currency: string;
    byStage: Array<{ stageName: string; emoji?: string; stageCost: number; weekFromStart: number; isSaleStage?: boolean }>;
  }> => {
    const template = await ctx.db.get(args.templateId);
    if (!template) return { totalCost: 0, currency: "UGX", byStage: [] };
    const scale = template.acreSize ? args.headCount / template.acreSize : args.headCount;
    let totalCost = 0;
    const byStage = template.stages.map((stage: any) => {
      const stageCost = stage.costItems.reduce((sum: number, item: any) => sum + item.unitCost * item.quantity * scale, 0);
      totalCost += stageCost;
      return { stageName: stage.stageName, emoji: stage.emoji, stageCost: Math.round(stageCost), weekFromStart: stage.weekFromStart, isSaleStage: stage.isSaleStage };
    });
    return { totalCost: Math.round(totalCost), currency: template.currency ?? "UGX", byStage };
  },
});

// ─── PHASE 5d: FARMER BENCHMARKS ─────────────────────────────────────────────

/** 5d: Farmer Benchmarks — aggregate cost data across active crop templates */
export const getFarmerBenchmarks = query({
  args: {
    adminId: v.id("users"),
    cropType: v.optional(v.string()),
    regionDistrictId: v.optional(v.id("districts")),
  },
  handler: async (ctx, args): Promise<Array<{
    cropType: string;
    avgTotalCost: number;
    minTotalCost: number;
    maxTotalCost: number;
    templateCount: number;
    currency: string;
  }>> => {
    const allTemplates = await ctx.db
      .query("cropCostTemplates")
      .withIndex("by_owner_type", (q: any) => q.eq("ownerType", "community"))
      .collect();

    const activeTemplates = allTemplates.filter(
      (t) => t.isActive && !t.isDeleted && (!args.cropType || t.cropType === args.cropType)
    );

    // Group by cropType
    const groups: Record<string, { totalCosts: number[]; currency: string }> = {};
    for (const tpl of activeTemplates) {
      const cropKey = tpl.cropType;
      if (!groups[cropKey]) groups[cropKey] = { totalCosts: [], currency: tpl.currency ?? "UGX" };

      // Sum all stage cost items
      let templateTotal = 0;
      for (const stage of tpl.stages ?? []) {
        for (const item of stage.costItems ?? []) {
          templateTotal += (item.unitCost ?? 0) * (item.quantity ?? 0);
        }
      }
      groups[cropKey].totalCosts.push(templateTotal);
    }

    return Object.entries(groups).map(([cropType, { totalCosts, currency }]) => {
      const avg = totalCosts.reduce((a, b) => a + b, 0) / totalCosts.length;
      return {
        cropType,
        avgTotalCost: Math.round(avg),
        minTotalCost: Math.min(...totalCosts),
        maxTotalCost: Math.max(...totalCosts),
        templateCount: totalCosts.length,
        currency,
      };
    }).sort((a, b) => a.cropType.localeCompare(b.cropType));
  },
});
