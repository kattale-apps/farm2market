import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getUgandaTime } from "./utils";
import { verifyAdminRole } from "./auth";

const STAGE_SEEDLING = "Seedling / Nursery";
const STAGE_VEGETATIVE = "Vegetative";
const STAGE_FLOWERING = "Flowering";
const STAGE_ESTABLISHED_PERENNIAL = "Established perennial";

const DEFAULT_IMPROVEMENT_FACTOR = 1.25;

const DEFAULT_CROP_CONFIGS = [
  { crop: "Coffee", doseMl: 60, startDay: 14, intervalDays: 12, seasonLengthDays: 365 },
  { crop: "Wheat / Barley", doseMl: 60, startDay: 14, intervalDays: 12, seasonLengthDays: 120 },
  { crop: "Leafy vegetables", doseMl: 22, startDay: 7, intervalDays: 10, seasonLengthDays: 60 },
  { crop: "Flowers", doseMl: 65, startDay: 7, intervalDays: 10, seasonLengthDays: 90 },
  { crop: "Tomatoes", doseMl: 65, startDay: 14, intervalDays: 10, seasonLengthDays: 120 },
  { crop: "Maize", doseMl: 55, startDay: 14, intervalDays: 12, seasonLengthDays: 70 },
  { crop: "Beans", doseMl: 55, startDay: 14, intervalDays: 12, seasonLengthDays: 90 },
  { crop: "Groundnuts", doseMl: 55, startDay: 14, intervalDays: 12, seasonLengthDays: 120 },
  { crop: "Peas", doseMl: 55, startDay: 14, intervalDays: 10, seasonLengthDays: 90 },
  { crop: "Tea", doseMl: 55, startDay: 14, intervalDays: 18, seasonLengthDays: 365 },
  { crop: "Orchard trees", doseMl: 65, startDay: 30, intervalDays: 105, seasonLengthDays: 365 },
  { crop: "Rice", doseMl: 55, startDay: 14, intervalDays: 18, seasonLengthDays: 120 },
  { crop: "Passion fruit", doseMl: 45, startDay: 14, intervalDays: 18, seasonLengthDays: 180 },
  { crop: "Pineapple", doseMl: 70, startDay: 21, intervalDays: 18, seasonLengthDays: 540 },
  { crop: "Bananas", doseMl: 80, startDay: 21, intervalDays: 105, seasonLengthDays: 365 },
].map((item) => ({
  ...item,
  stageOverrides: [
    { stage: STAGE_SEEDLING, startDayAdjust: 7, intervalAdjust: 0 },
    { stage: STAGE_VEGETATIVE, startDayAdjust: 0, intervalAdjust: 0 },
    { stage: STAGE_FLOWERING, startDayAdjust: 0, intervalAdjust: -2 },
    { stage: STAGE_ESTABLISHED_PERENNIAL, startDayAdjust: 0, intervalAdjust: 0 },
  ],
}));

const DEFAULT_BASELINE_YIELDS = [
  { crop: "Maize", tonsPerAcre: 1.5 },
  { crop: "Beans", tonsPerAcre: 0.8 },
  { crop: "Groundnuts", tonsPerAcre: 0.7 },
  { crop: "Rice", tonsPerAcre: 2 },
  { crop: "Tomatoes", tonsPerAcre: 10 },
  { crop: "Pineapple", tonsPerAcre: 18 },
  { crop: "Bananas", tonsPerAcre: 12 },
  { crop: "Coffee", tonsPerAcre: 0.6 },
];

function toIsoDateOnly(input: string | Date): string {
  const date = typeof input === "string" ? new Date(`${input}T00:00:00Z`) : input;
  return date.toISOString().slice(0, 10);
}

function addDays(isoDateOnly: string, days: number): string {
  const date = new Date(`${isoDateOnly}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDateOnly(date);
}

function daysBetween(a: string, b: string): number {
  const start = new Date(`${a}T00:00:00Z`).getTime();
  const end = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

function getDefaultConfig() {
  return {
    cropConfigs: DEFAULT_CROP_CONFIGS,
    baselineYields: DEFAULT_BASELINE_YIELDS,
    improvementFactor: DEFAULT_IMPROVEMENT_FACTOR,
    bottleSizeMl: 500,
    knapsacksPerAcre: 10,
    waterPerKnapsackL: 20,
    requiredPhotoCategories: [
      "best leaf",
      "worst leaf",
      "whole plant",
      "flowers",
      "fruits",
      "field overview",
    ],
    guaranteeThresholds: {
      doseTolerancePct: 5,
      scheduleDaysLateTolerance: 1,
    },
  };
}

function getDoseForCrop(crop: string, cropConfigs: any[]): number {
  return cropConfigs.find((c) => c.crop === crop)?.doseMl ?? 55;
}

function getScheduleForCrop(crop: string, cropStage: string, cropConfigs: any[]) {
  const config = cropConfigs.find((c) => c.crop === crop);
  let startDay = config?.startDay ?? 14;
  let intervalDays = config?.intervalDays ?? 12;
  const seasonLengthDays = config?.seasonLengthDays ?? 120;

  const stageOverride = (config?.stageOverrides || []).find((o: any) => o.stage === cropStage);
  if (stageOverride) {
    startDay += stageOverride.startDayAdjust || 0;
    intervalDays += stageOverride.intervalAdjust || 0;
  }

  if (cropStage === STAGE_ESTABLISHED_PERENNIAL) {
    intervalDays = 105;
  }

  intervalDays = Math.max(1, intervalDays);
  startDay = Math.max(0, startDay);

  return {
    startDay,
    intervalDays,
    seasonLengthDays,
  };
}

function computeBottles(fertilizerMl: number, bottleSizeMl: number): number {
  return Math.ceil(fertilizerMl / bottleSizeMl);
}

function generateSprayDates(
  plantingDate: string,
  startDay: number,
  intervalDays: number,
  seasonLengthDays: number,
): string[] {
  if (seasonLengthDays < startDay) return [];
  const repeatCount = Math.floor((seasonLengthDays - startDay) / intervalDays);
  const sprays = repeatCount + 1;
  const startDate = addDays(toIsoDateOnly(plantingDate), startDay);
  return Array.from({ length: sprays }).map((_, index) => addDays(startDate, index * intervalDays));
}

async function getCommunityConfig(ctx: any, communityId: Id<"communities">) {
  const existing = await ctx.db
    .query("fertilizerConfig")
    .withIndex("by_community", (q: any) => q.eq("communityId", communityId))
    .first();

  return existing || getDefaultConfig();
}

function canManageCommunity(admin: any, community: any): boolean {
  const isSuper = admin.adminLevel === "super" || admin.adminLevel === undefined;
  if (isSuper) return true;
  if (admin.adminCategory !== "community") return false;
  if (community?.communityAdminId === admin._id) return true;
  const assigned: string[] = admin.assignedCommunityIds || [];
  return assigned.includes(String(community?._id));
}

function normalize(s: string) {
  return (s || "").toLowerCase().trim();
}

const FIELD_LABEL_ALIASES = {
  fertilizerUsedMl: [
    "fertilizer used ml",
    "fertilizer used (ml)",
    "fertilizer ml used",
    "fertiliser used ml",
    "fertiliser used (ml)",
    "fertilizer amount ml",
    "fertilizer quantity ml",
  ],
  acresSprayed: [
    "acres sprayed",
    "acre sprayed",
    "sprayed acres",
    "area sprayed",
  ],
  knapsacksSprayed: [
    "knapsacks sprayed",
    "knapsack sprayed",
    "tanks sprayed",
    "knapsacks",
  ],
};

const PHOTO_CATEGORY_ALIASES: Record<string, string[]> = {
  "best leaf": ["best leaf", "best_leaf"],
  "worst leaf": ["worst leaf", "worst_leaf"],
  "whole plant": ["whole plant", "whole_plant", "full plant"],
  flowers: ["flowers", "flower"],
  fruits: ["fruits", "fruit"],
  "field overview": ["field overview", "field_overview", "overview", "field view"],
};

function labelMatches(label: string, aliases: string[]) {
  const source = normalize(label);
  return aliases.some((alias) => source.includes(normalize(alias)));
}

function extractNumericFieldValue(
  values: any[],
  fields: any[],
  aliases: string[],
): number | null {
  for (let i = 0; i < values.length; i += 1) {
    const label = normalize((fields[i] as any)?.label || "");
    if (!labelMatches(label, aliases)) continue;
    const parsed = parseMaybeNumber(values[i]?.value || "");
    if (parsed !== null) return parsed;
  }
  return null;
}

function isPhotoCategorySatisfied(requiredLabel: string, seenLabels: string[]) {
  const requiredNorm = normalize(requiredLabel);
  const aliases = PHOTO_CATEGORY_ALIASES[requiredNorm] || [requiredNorm];
  return seenLabels.some((seenLabel) => labelMatches(seenLabel, aliases));
}

function parseMaybeNumber(input: string): number | null {
  const n = parseFloat(String(input || "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function isNonEmpty(v: string | undefined) {
  return !!(v && v.trim().length > 0);
}

export const getFertilizerConfig = query({
  args: { communityId: v.id("communities") },
  handler: async (ctx, args) => {
    const cfg = await getCommunityConfig(ctx, args.communityId);
    return cfg;
  },
});

export const getFarmerPlans = query({
  args: {
    farmerId: v.id("users"),
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    const plans = await ctx.db
      .query("fertilizerPlans")
      .withIndex("by_farmer_community", (q: any) => q.eq("farmerId", args.farmerId).eq("communityId", args.communityId))
      .collect();

    const enriched = await Promise.all(
      plans.map(async (plan) => {
        const projection = await ctx.db
          .query("yieldProjections")
          .withIndex("by_plan", (q: any) => q.eq("planId", plan._id))
          .first();
        const guarantee = await ctx.db
          .query("yieldGuaranteeStatus")
          .withIndex("by_plan", (q: any) => q.eq("planId", plan._id))
          .first();

        return {
          ...plan,
          projection,
          guarantee,
        };
      })
    );

    return enriched.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getPlanWithDetails = query({
  args: {
    planId: v.id("fertilizerPlans"),
    farmerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.farmerId !== args.farmerId) {
      throw new Error("Plan not found");
    }

    const responses = await ctx.db
      .query("formResponses")
      .withIndex("by_member", (q: any) => q.eq("memberId", args.farmerId))
      .collect();

    const submitted = responses.filter(
      (r: any) => r.planId === args.planId && r.status !== "DRAFT"
    );

    const byPlannedDate = new Map<string, any[]>();
    for (const row of submitted) {
      const key = row.plannedSprayDate || "unlinked";
      const arr = byPlannedDate.get(key) || [];
      arr.push(row);
      byPlannedDate.set(key, arr);
    }

    const today = toIsoDateOnly(new Date());
    const complianceByDate = plan.sprayDates.map((date) => {
      const entries = byPlannedDate.get(date) || [];
      if (entries.length > 0) {
        return { date, status: "done" as const, count: entries.length };
      }
      if (date < today) {
        return { date, status: "missed" as const, count: 0 };
      }
      return { date, status: "upcoming" as const, count: 0 };
    });

    const projection = await ctx.db
      .query("yieldProjections")
      .withIndex("by_plan", (q: any) => q.eq("planId", args.planId))
      .first();

    const guarantee = await ctx.db
      .query("yieldGuaranteeStatus")
      .withIndex("by_plan", (q: any) => q.eq("planId", args.planId))
      .first();

    return {
      plan,
      complianceByDate,
      projection,
      guarantee,
    };
  },
});

export const getFertilizerInsightsData = query({
  args: {
    farmerId: v.id("users"),
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    const plans = await ctx.db
      .query("fertilizerPlans")
      .withIndex("by_farmer_community", (q: any) => q.eq("farmerId", args.farmerId).eq("communityId", args.communityId))
      .collect();

    const responses = await ctx.db
      .query("formResponses")
      .withIndex("by_member", (q: any) => q.eq("memberId", args.farmerId))
      .collect();

    const linkedResponses = responses.filter(
      (r: any) => r.communityId === args.communityId && r.status !== "DRAFT" && !!r.planId
    );

    const planById = new Map(plans.map((p) => [String(p._id), p]));

    const compliance = plans.map((p) => {
      const done = linkedResponses.filter((r: any) => r.planId === p._id).length;
      const planned = p.sprayDates.length;
      return {
        planId: p._id,
        farmName: p.farmName,
        label: p.farmName || p.crop,
        crop: p.crop,
        planned,
        done,
      };
    });

    const fertilizerByMonthMap = new Map<string, number>();
    const fertilizerByMonthByFarmMap = new Map<string, Map<string, number>>();
    for (const response of linkedResponses) {
      const values = await ctx.db
        .query("formResponseValues")
        .withIndex("by_response", (q: any) => q.eq("responseId", response._id))
        .collect();
      const fields = await Promise.all(values.map((vItem) => ctx.db.get(vItem.fieldId)));
      let ml = 0;
      values.forEach((valueRow, idx) => {
        const label = normalize((fields[idx] as any)?.label || "");
        if (labelMatches(label, FIELD_LABEL_ALIASES.fertilizerUsedMl)) {
          const maybe = parseMaybeNumber(valueRow.value);
          if (maybe !== null) ml += maybe;
        }
      });

      const keyDate = toIsoDateOnly(new Date(response.createdAt));
      const monthKey = keyDate.slice(0, 7);
      fertilizerByMonthMap.set(monthKey, (fertilizerByMonthMap.get(monthKey) || 0) + ml);

      const relatedPlan = planById.get(String(response.planId));
      const farmKey = String(relatedPlan?.farmName || "Unassigned Farm");
      const farmMonthMap = fertilizerByMonthByFarmMap.get(farmKey) || new Map<string, number>();
      farmMonthMap.set(monthKey, (farmMonthMap.get(monthKey) || 0) + ml);
      fertilizerByMonthByFarmMap.set(farmKey, farmMonthMap);
    }

    const fertilizerByMonth = Array.from(fertilizerByMonthMap.entries())
      .map(([month, totalMl]) => ({ month, totalMl }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const fertilizerByMonthByFarm = Object.fromEntries(
      Array.from(fertilizerByMonthByFarmMap.entries()).map(([farmName, monthMap]) => {
        const rows = Array.from(monthMap.entries())
          .map(([month, totalMl]) => ({ month, totalMl }))
          .sort((a, b) => a.month.localeCompare(b.month));
        return [farmName, rows];
      })
    );

    const projections = await Promise.all(
      plans.map(async (plan) => {
        const row = await ctx.db
          .query("yieldProjections")
          .withIndex("by_plan", (q: any) => q.eq("planId", plan._id))
          .first();
        return {
          planId: plan._id,
          farmName: plan.farmName,
          label: plan.farmName || plan.crop,
          crop: plan.crop,
          baselineYieldTons: row?.baselineYieldTons || 0,
          projectedYieldTons: row?.projectedYieldTons || 0,
        };
      })
    );

    return {
      compliance,
      fertilizerByMonth,
      fertilizerByMonthByFarm,
      projections,
    };
  },
});

export const getAdminFertilizerInsights = query({
  args: {
    adminId: v.id("users"),
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    const adminCheck = await verifyAdminRole({ userId: args.adminId, db: ctx.db });
    if (!adminCheck.authorized) {
      throw new Error("Not authorized");
    }

    const community = await ctx.db.get(args.communityId);
    if (!community || !canManageCommunity(adminCheck.user, community)) {
      throw new Error("Not authorized for this community");
    }

    const plans = await ctx.db
      .query("fertilizerPlans")
      .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
      .collect();

    const active = plans.filter((p) => p.status === "active").length;
    const crops = new Map<string, number>();
    plans.forEach((p) => crops.set(p.crop, (crops.get(p.crop) || 0) + 1));

    return {
      totalPlans: plans.length,
      activePlans: active,
      byCrop: Array.from(crops.entries()).map(([crop, count]) => ({ crop, count })),
    };
  },
});

export const createFertilizerPlan = mutation({
  args: {
    farmerId: v.id("users"),
    communityId: v.id("communities"),
    input: v.object({
      farmName: v.string(),
      crop: v.string(),
      plantingDate: v.string(),
      acres: v.number(),
      cropStage: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const now = getUgandaTime();
    const cfg = await getCommunityConfig(ctx, args.communityId);

    const knapsacks = args.input.acres * cfg.knapsacksPerAcre;
    const doseMl = getDoseForCrop(args.input.crop, cfg.cropConfigs);
    const fertilizerMl = doseMl * knapsacks;
    const bottlesPerSpray = computeBottles(fertilizerMl, cfg.bottleSizeMl);
    const waterRequiredL = knapsacks * cfg.waterPerKnapsackL;

    const schedule = getScheduleForCrop(args.input.crop, args.input.cropStage, cfg.cropConfigs);
    const sprayDates = generateSprayDates(
      args.input.plantingDate,
      schedule.startDay,
      schedule.intervalDays,
      schedule.seasonLengthDays,
    );

    const totalBottles = bottlesPerSpray * sprayDates.length;

    const planId = await ctx.db.insert("fertilizerPlans", {
      communityId: args.communityId,
      farmerId: args.farmerId,
      farmName: args.input.farmName,
      crop: args.input.crop,
      cropStage: args.input.cropStage,
      plantingDate: toIsoDateOnly(args.input.plantingDate),
      acres: args.input.acres,
      knapsacks,
      doseMl,
      intervalDays: schedule.intervalDays,
      startDay: schedule.startDay,
      seasonLengthDays: schedule.seasonLengthDays,
      bottlesPerSpray,
      waterRequiredL,
      sprayDates,
      totalBottles,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const baseline = cfg.baselineYields.find((y: any) => y.crop === args.input.crop);
    if (baseline) {
      const baselineYieldTons = baseline.tonsPerAcre * args.input.acres;
      const projectedYieldTons = baselineYieldTons * cfg.improvementFactor;
      await ctx.db.insert("yieldProjections", {
        communityId: args.communityId,
        farmerId: args.farmerId,
        planId,
        crop: args.input.crop,
        acres: args.input.acres,
        baselineYieldTons,
        projectedYieldTons,
        improvementFactor: cfg.improvementFactor,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const sprayDate of sprayDates) {
      await ctx.db.insert("sprayReminders", {
        communityId: args.communityId,
        farmerId: args.farmerId,
        planId,
        scheduledDate: sprayDate,
        reminderType: "day_before",
        sent: false,
        createdAt: now,
      });
      await ctx.db.insert("sprayReminders", {
        communityId: args.communityId,
        farmerId: args.farmerId,
        planId,
        scheduledDate: sprayDate,
        reminderType: "morning_of",
        sent: false,
        createdAt: now,
      });
      await ctx.db.insert("sprayReminders", {
        communityId: args.communityId,
        farmerId: args.farmerId,
        planId,
        scheduledDate: sprayDate,
        reminderType: "missed",
        sent: false,
        createdAt: now,
      });
    }

    await ctx.db.insert("yieldGuaranteeStatus", {
      communityId: args.communityId,
      farmerId: args.farmerId,
      planId,
      eligible: false,
      doseCompliant: false,
      scheduleCompliant: false,
      photosComplete: false,
      recordsComplete: false,
      lastCheckedAt: now,
    });

    return { planId };
  },
});

export const upsertFertilizerConfig = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.id("communities"),
    config: v.object({
      cropConfigs: v.array(v.object({
        crop: v.string(),
        doseMl: v.number(),
        startDay: v.number(),
        intervalDays: v.number(),
        seasonLengthDays: v.number(),
        stageOverrides: v.optional(v.array(v.object({
          stage: v.string(),
          startDayAdjust: v.optional(v.number()),
          intervalAdjust: v.optional(v.number()),
        }))),
      })),
      baselineYields: v.array(v.object({ crop: v.string(), tonsPerAcre: v.number() })),
      improvementFactor: v.number(),
      bottleSizeMl: v.number(),
      knapsacksPerAcre: v.number(),
      waterPerKnapsackL: v.number(),
      requiredPhotoCategories: v.array(v.string()),
      guaranteeThresholds: v.object({ doseTolerancePct: v.number(), scheduleDaysLateTolerance: v.number() }),
    }),
  },
  handler: async (ctx, args) => {
    const adminCheck = await verifyAdminRole({ userId: args.adminId, db: ctx.db });
    if (!adminCheck.authorized) {
      throw new Error("Not authorized");
    }

    const community = await ctx.db.get(args.communityId);
    if (!community || !canManageCommunity(adminCheck.user, community)) {
      throw new Error("Not authorized for this community");
    }

    const existing = await ctx.db
      .query("fertilizerConfig")
      .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
      .first();

    const payload = {
      communityId: args.communityId,
      cropConfigs: args.config.cropConfigs,
      baselineYields: args.config.baselineYields,
      improvementFactor: args.config.improvementFactor,
      bottleSizeMl: args.config.bottleSizeMl,
      knapsacksPerAcre: args.config.knapsacksPerAcre,
      waterPerKnapsackL: args.config.waterPerKnapsackL,
      requiredPhotoCategories: args.config.requiredPhotoCategories,
      guaranteeThresholds: args.config.guaranteeThresholds,
      updatedAt: getUgandaTime(),
      updatedBy: args.adminId,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { configId: existing._id };
    }

    const configId = await ctx.db.insert("fertilizerConfig", payload);
    return { configId };
  },
});

export const updatePlanStatus = mutation({
  args: {
    planId: v.id("fertilizerPlans"),
    farmerId: v.id("users"),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("abandoned")),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.farmerId !== args.farmerId) {
      throw new Error("Plan not found");
    }

    await ctx.db.patch(args.planId, {
      status: args.status,
      updatedAt: getUgandaTime(),
    });

    return { success: true };
  },
});

export const checkAndUpdateYieldGuarantee = mutation({
  args: {
    planId: v.id("fertilizerPlans"),
    farmerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.farmerId !== args.farmerId) {
      throw new Error("Plan not found");
    }

    const cfg = await getCommunityConfig(ctx, plan.communityId);

    const responses = await ctx.db
      .query("formResponses")
      .withIndex("by_member", (q: any) => q.eq("memberId", args.farmerId))
      .collect();

    const submitted = responses.filter(
      (r: any) => r.planId === args.planId && r.status !== "DRAFT"
    );

    let doseCompliant = submitted.length > 0;
    const foundPhotoLabels = new Set<string>();

    for (const response of submitted) {
      const values = await ctx.db
        .query("formResponseValues")
        .withIndex("by_response", (q: any) => q.eq("responseId", response._id))
        .collect();
      const fields = await Promise.all(values.map((valueRow) => ctx.db.get(valueRow.fieldId)));

      const fertilizerUsedMl = extractNumericFieldValue(
        values,
        fields,
        FIELD_LABEL_ALIASES.fertilizerUsedMl,
      );
      const acresSprayed = extractNumericFieldValue(
        values,
        fields,
        FIELD_LABEL_ALIASES.acresSprayed,
      );
      const knapsacksSprayed = extractNumericFieldValue(
        values,
        fields,
        FIELD_LABEL_ALIASES.knapsacksSprayed,
      );

      values.forEach((valueRow, idx) => {
        const label = normalize((fields[idx] as any)?.label || "");
        if ((fields[idx] as any)?.fieldType === "camera" && isNonEmpty(valueRow.value)) {
          foundPhotoLabels.add(label);
        }
      });

      if (fertilizerUsedMl === null) {
        doseCompliant = false;
      } else {
        const expectedKnapsacks =
          knapsacksSprayed !== null
            ? knapsacksSprayed
            : acresSprayed !== null
              ? acresSprayed * cfg.knapsacksPerAcre
              : plan.knapsacks;
        const expectedDoseForRecord = plan.doseMl * expectedKnapsacks;
        const tolerance = expectedDoseForRecord * ((cfg.guaranteeThresholds?.doseTolerancePct || 0) / 100);
        const minAllowed = expectedDoseForRecord - tolerance;
        const maxAllowed = expectedDoseForRecord + tolerance;
        if (fertilizerUsedMl < minAllowed || fertilizerUsedMl > maxAllowed) {
          doseCompliant = false;
        }
      }
    }

    const scheduleTolerance = cfg.guaranteeThresholds?.scheduleDaysLateTolerance || 0;
    const scheduleCompliant = plan.sprayDates.every((plannedDate) => {
      const matches = submitted.filter((row: any) => row.plannedSprayDate);
      return matches.some((row: any) => {
        const d = daysBetween(plannedDate, row.plannedSprayDate);
        return Math.abs(d) <= scheduleTolerance;
      });
    });

    const recordsComplete = submitted.length >= plan.sprayDates.length;

    const photosComplete = (cfg.requiredPhotoCategories || []).every((requiredLabel: string) =>
      isPhotoCategorySatisfied(requiredLabel, Array.from(foundPhotoLabels))
    );

    const eligible = doseCompliant && scheduleCompliant && photosComplete && recordsComplete;

    const existing = await ctx.db
      .query("yieldGuaranteeStatus")
      .withIndex("by_plan", (q: any) => q.eq("planId", args.planId))
      .first();

    const payload = {
      communityId: plan.communityId,
      farmerId: args.farmerId,
      planId: args.planId,
      eligible,
      doseCompliant,
      scheduleCompliant,
      photosComplete,
      recordsComplete,
      lastCheckedAt: getUgandaTime(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { eligible };
    }

    await ctx.db.insert("yieldGuaranteeStatus", payload);
    return { eligible };
  },
});

export const getPendingRemindersInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("sprayReminders")
      .withIndex("by_pending", (q: any) => q.eq("sent", false))
      .collect();
  },
});

export const markReminderSentInternal = internalMutation({
  args: {
    reminderId: v.id("sprayReminders"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reminderId, {
      sent: true,
      sentAt: getUgandaTime(),
    });
  },
});

export const hasSubmittedForPlannedDateInternal = internalQuery({
  args: {
    planId: v.id("fertilizerPlans"),
    farmerId: v.id("users"),
    plannedDate: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("formResponses")
      .withIndex("by_member", (q: any) => q.eq("memberId", args.farmerId))
      .collect();

    return rows.some(
      (r: any) => r.planId === args.planId && r.status !== "DRAFT" && r.plannedSprayDate === args.plannedDate
    );
  },
});

export const getCommunityAdminRecipientsInternal = internalQuery({
  args: {
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    const recipients: Id<"users">[] = [];
    const community = await ctx.db.get(args.communityId);
    if (community?.communityAdminId) {
      recipients.push(community.communityAdminId);
    }

    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q: any) => q.eq("role", "admin"))
      .collect();

    for (const admin of admins as any[]) {
      const assigned: Id<"communities">[] = admin.assignedCommunityIds || [];
      if (admin.adminCategory === "community" && assigned.some((id) => id === args.communityId)) {
        recipients.push(admin._id);
      }
    }

    return Array.from(new Set(recipients.map((id) => String(id)))).map((id) => id as Id<"users">);
  },
});

export const sendSprayReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const today = toIsoDateOnly(new Date());
    const tomorrow = addDays(today, 1);
    const pending = await ctx.runQuery((internal as any).fertilizerPlanner.getPendingRemindersInternal, {});

    let sentCount = 0;
    for (const reminder of pending as any[]) {
      let shouldSend = false;

      if (reminder.reminderType === "day_before") {
        shouldSend = reminder.scheduledDate === tomorrow;
      }

      if (reminder.reminderType === "morning_of") {
        shouldSend = reminder.scheduledDate === today;
      }

      if (reminder.reminderType === "missed") {
        if (reminder.scheduledDate < today) {
          const hasSubmitted = await ctx.runQuery(
            (internal as any).fertilizerPlanner.hasSubmittedForPlannedDateInternal,
            {
              planId: reminder.planId,
              farmerId: reminder.farmerId,
              plannedDate: reminder.scheduledDate,
            }
          );
          shouldSend = !hasSubmitted;
        }
      }

      if (!shouldSend) continue;

      const title =
        reminder.reminderType === "day_before"
          ? "Spray day reminder for tomorrow"
          : reminder.reminderType === "morning_of"
            ? "Spray day reminder for today"
            : "Missed spray alert";

      const body =
        reminder.reminderType === "day_before"
          ? `You have a planned Bio Farm spray on ${reminder.scheduledDate}.`
          : reminder.reminderType === "morning_of"
            ? `Bio Farm spray is due today (${reminder.scheduledDate}).`
            : `A planned Bio Farm spray (${reminder.scheduledDate}) appears to be missed.`;

      await ctx.runAction(internal.pushNotifications.sendPushNotification, {
        userId: reminder.farmerId,
        title,
        body,
        data: { type: "biofarm_spray", planId: reminder.planId, date: reminder.scheduledDate },
      });

      if (reminder.reminderType === "missed") {
        const admins = await ctx.runQuery(
          (internal as any).fertilizerPlanner.getCommunityAdminRecipientsInternal,
          { communityId: reminder.communityId }
        );
        for (const adminId of admins as Id<"users">[]) {
          await ctx.runAction(internal.pushNotifications.sendPushNotification, {
            userId: adminId,
            title: "Community missed spray alert",
            body: `A Bio Farm member missed spray date ${reminder.scheduledDate}.`,
            data: { type: "biofarm_missed_spray", planId: reminder.planId, date: reminder.scheduledDate },
          });
        }
      }

      await ctx.runMutation((internal as any).fertilizerPlanner.markReminderSentInternal, {
        reminderId: reminder._id,
      });
      sentCount += 1;
    }

    return { sentCount };
  },
});
