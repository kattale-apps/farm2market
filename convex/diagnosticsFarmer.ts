/**
 * Diagnostics - farmer crop check (phase 1, free option).
 *
 * A member of a community with Diagnostics picks their crop, taps the
 * symptoms they see and can add a photo. Matching runs on the phone against
 * the approved library (see rankMatches in ./diagnosticsRules), so the result
 * appears even with no network. The check is saved here when the phone is
 * online; the server repeats the ranking so stored results are trustworthy.
 *
 * Treatments come only from approved library entries and never name a brand
 * (brands wait for a verified pesticide supplier in the community).
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import { isDiagnosticsEnabled } from "./communityModules";
import {
  DAILY_REPORT_LIMIT,
  healthLevel,
  isValidHost,
  isValidSymptom,
  isUnderReview,
  MAX_DIAGNOSTIC_IMAGE_BYTES,
  rankMatches,
} from "./diagnosticsRules";

const LIBRARY_READ_LIMIT = 500;
const PHOTOS_PER_CONDITION = 2;

/** Null when the user cannot use the check in this community. */
async function farmerAccess(ctx: QueryCtx, userId: Id<"users">, communityId: Id<"communities">) {
  const [user, community] = await Promise.all([ctx.db.get(userId), ctx.db.get(communityId)]);
  if (!user || !community || !isDiagnosticsEnabled(community as any)) return null;
  const membership = await ctx.db
    .query("communityMemberships")
    .withIndex("by_community_user", (q) => q.eq("communityId", communityId).eq("userId", userId))
    .first();
  if (!membership) return null;
  return { user, community };
}

async function activeConditions(ctx: QueryCtx): Promise<Doc<"diagnosticConditions">[]> {
  return await ctx.db
    .query("diagnosticConditions")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .take(LIBRARY_READ_LIMIT);
}

/**
 * Everything the check needs, in one response so the phone can cache it once
 * and keep working offline. Only approved entries, photos and treatments are
 * included, and at most two small thumbnails per entry.
 */
export const getCheckLibrary = query({
  args: { userId: v.id("users"), communityId: v.id("communities") },
  handler: async (ctx, args) => {
    const access = await farmerAccess(ctx, args.userId, args.communityId);
    if (!access) return { enabled: false as const };

    const conditions = await activeConditions(ctx);
    const activeIds = new Set(conditions.map((c) => String(c._id)));

    const [treatments, images] = await Promise.all([
      ctx.db
        .query("diagnosticTreatments")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .take(LIBRARY_READ_LIMIT * 3),
      ctx.db
        .query("diagnosticImages")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .take(LIBRARY_READ_LIMIT * 3),
    ]);

    const treatmentsBy = new Map<string, { kind: string; text: string; sourceName: string; sourceUrl?: string }[]>();
    for (const t of treatments) {
      const key = String(t.conditionId);
      if (!activeIds.has(key)) continue;
      const list = treatmentsBy.get(key) ?? [];
      list.push({ kind: t.kind, text: t.text, sourceName: t.sourceName, sourceUrl: t.sourceUrl });
      treatmentsBy.set(key, list);
    }

    const photosBy = new Map<string, { thumbUrl: string; sourceName: string; licence: string }[]>();
    for (const img of images) {
      const key = String(img.conditionId);
      if (!activeIds.has(key)) continue;
      const list = photosBy.get(key) ?? [];
      if (list.length >= PHOTOS_PER_CONDITION) continue;
      const thumbUrl = await ctx.storage.getUrl(img.thumbStorageId ?? img.storageId);
      if (thumbUrl) list.push({ thumbUrl, sourceName: img.sourceName, licence: img.licence });
      photosBy.set(key, list);
    }

    return {
      enabled: true as const,
      communityName: access.community.name,
      conditions: conditions
        .filter((c) => (c.symptomTags?.length ?? 0) > 0)
        .map((c) => ({
          id: String(c._id),
          name: c.name,
          scientificName: c.scientificName,
          kind: c.kind,
          hosts: c.hosts,
          symptomTags: c.symptomTags ?? [],
          symptoms: c.symptoms,
          sourceName: c.sourceName,
          sourceUrl: c.sourceUrl,
          underReview: isUnderReview(c.openFlagCount),
          treatments: treatmentsBy.get(String(c._id)) ?? [],
          photos: photosBy.get(String(c._id)) ?? [],
        })),
    };
  },
});

function ugandaDayStart(): number {
  const d = new Date(getUgandaTime());
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

export const saveReport = mutation({
  args: {
    userId: v.id("users"),
    communityId: v.id("communities"),
    clientId: v.string(),
    host: v.string(),
    symptomTags: v.array(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
    checkedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await farmerAccess(ctx, args.userId, args.communityId);
    if (!access) throw new Error("Crop check is not available in this community");
    if (!isValidHost(args.host)) throw new Error("Unknown crop");
    const symptomTags = Array.from(new Set(args.symptomTags));
    if (!symptomTags.every(isValidSymptom)) throw new Error("Unknown symptom");
    const clientId = args.clientId.trim().slice(0, 64);
    if (!clientId) throw new Error("Missing check id");

    // An offline retry of a check that already saved returns the saved one.
    const existing = await ctx.db
      .query("diagnosticReports")
      .withIndex("by_farmer_client", (q) => q.eq("farmerId", args.userId).eq("clientId", clientId))
      .first();
    if (existing) return { reportId: existing._id, duplicate: true };

    const today = await ctx.db
      .query("diagnosticReports")
      .withIndex("by_farmer_saved", (q) => q.eq("farmerId", args.userId).gte("savedAt", ugandaDayStart()))
      .take(DAILY_REPORT_LIMIT);
    if (today.length >= DAILY_REPORT_LIMIT) {
      throw new Error(`You can save ${DAILY_REPORT_LIMIT} crop checks a day. Try again tomorrow.`);
    }

    if (args.photoStorageId) {
      const file = await ctx.db.system.get(args.photoStorageId);
      if (!file || !(file.contentType ?? "").startsWith("image/") || file.size > MAX_DIAGNOSTIC_IMAGE_BYTES) {
        throw new Error("Photo could not be used");
      }
    }

    const candidates = (await activeConditions(ctx))
      .filter((c) => c.hosts.includes(args.host))
      .map((c) => ({ id: String(c._id), symptomTags: c.symptomTags }));
    const ranked = rankMatches(candidates, symptomTags);
    const now = getUgandaTime();

    const reportId = await ctx.db.insert("diagnosticReports", {
      farmerId: args.userId,
      communityId: args.communityId,
      clientId,
      host: args.host,
      symptomTags,
      photoStorageId: args.photoStorageId,
      results: ranked.map((r) => ({ conditionId: r.id as Id<"diagnosticConditions">, percent: r.percent })),
      healthLevel: healthLevel(symptomTags, ranked),
      method: "symptoms",
      checkedAt: Math.min(args.checkedAt ?? now, now),
      savedAt: now,
    });
    return { reportId, duplicate: false };
  },
});

export const listMyReports = query({
  args: { userId: v.id("users"), communityId: v.id("communities") },
  handler: async (ctx, args) => {
    const access = await farmerAccess(ctx, args.userId, args.communityId);
    if (!access) return [];
    const reports = await ctx.db
      .query("diagnosticReports")
      .withIndex("by_farmer_saved", (q) => q.eq("farmerId", args.userId))
      .order("desc")
      .take(20);
    const names = new Map<string, string>();
    for (const r of reports) {
      for (const res of r.results) {
        const key = String(res.conditionId);
        if (!names.has(key)) names.set(key, (await ctx.db.get(res.conditionId))?.name ?? "Unknown");
      }
    }
    return reports
      .filter((r) => String(r.communityId) === String(args.communityId))
      .map((r) => ({
        _id: r._id,
        host: r.host,
        healthLevel: r.healthLevel,
        checkedAt: r.checkedAt,
        feedback: r.feedback,
        topMatch: r.results[0] ? { name: names.get(String(r.results[0].conditionId)), percent: r.results[0].percent } : null,
      }));
  },
});

/** The farmer's thumbs up / down on a result: how we will measure accuracy. */
export const setReportFeedback = mutation({
  args: {
    userId: v.id("users"),
    reportId: v.id("diagnosticReports"),
    feedback: v.union(v.literal("right"), v.literal("wrong"), v.literal("unsure")),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report || String(report.farmerId) !== String(args.userId)) throw new Error("Check not found");
    await ctx.db.patch(args.reportId, { feedback: args.feedback });
    return { success: true };
  },
});
