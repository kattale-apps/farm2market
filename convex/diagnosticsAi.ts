/**
 * Diagnostics - paid AI photo check (phase C, community opt-in).
 *
 * A community admin can switch this on for their community; a super admin
 * sets how many checks a month it may use (the platform pays the API bill and
 * the community is charged; farmers never are). When a farmer's check has a
 * photo, Claude compares it with the approved library entries for that crop
 * and returns match percentages, whether the plant looks healthy and whether
 * the photo is usable. The model can only pick library entries (the output
 * schema enumerates their ids), so every treatment shown still comes from the
 * library and names no brand.
 *
 * Needs the ANTHROPIC_API_KEY environment variable on the Convex deployment.
 * DIAGNOSTICS_AI_MODEL optionally overrides the model.
 */

import Anthropic from "@anthropic-ai/sdk";
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import { isDiagnosticsEnabled } from "./communityModules";
import { requireLibraryAccess } from "./diagnostics";
import {
  aiHealthLevel,
  cleanAiMatches,
  DEFAULT_AI_MONTHLY_CAP,
  ugandaMonthKey,
} from "./diagnosticsRules";

const DEFAULT_MODEL = "claude-opus-5";
const MAX_CANDIDATES = 80;

/** US$ per million tokens, for the cost estimate shown to admins. */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

function aiModel(): string {
  return (process.env.DIAGNOSTICS_AI_MODEL || DEFAULT_MODEL).trim();
}

function keyConfigured(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || "").trim();
}

function estimateUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES[model] ?? PRICES[DEFAULT_MODEL];
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

async function loadSettings(ctx: QueryCtx, communityId: Id<"communities">) {
  return await ctx.db
    .query("diagnosticAiSettings")
    .withIndex("by_community", (q) => q.eq("communityId", communityId))
    .first();
}

async function loadUsage(ctx: QueryCtx, communityId: Id<"communities">, month: string) {
  return await ctx.db
    .query("diagnosticAiUsage")
    .withIndex("by_community_month", (q) => q.eq("communityId", communityId).eq("month", month))
    .first();
}

/** True when a farmer in this community can get an AI photo check right now. */
export async function isAiAvailable(ctx: QueryCtx, communityId: Id<"communities">): Promise<boolean> {
  if (!keyConfigured()) return false;
  const settings = await loadSettings(ctx, communityId);
  if (!settings?.enabled) return false;
  const usage = await loadUsage(ctx, communityId, ugandaMonthKey(getUgandaTime()));
  return (usage?.checks ?? 0) < settings.monthlyCap;
}

// ─── Admin controls ─────────────────────────────────────────────────────────

export const getAiSettings = query({
  args: { adminId: v.id("users"), communityId: v.id("communities") },
  handler: async (ctx, args) => {
    const access = await requireLibraryAccess(ctx, args.adminId, args.communityId);
    const settings = await loadSettings(ctx, args.communityId);
    const month = ugandaMonthKey(getUgandaTime());
    const usage = await loadUsage(ctx, args.communityId, month);
    const model = aiModel();
    return {
      enabled: settings?.enabled ?? false,
      monthlyCap: settings?.monthlyCap ?? DEFAULT_AI_MONTHLY_CAP,
      keyConfigured: keyConfigured(),
      model,
      month,
      checksThisMonth: usage?.checks ?? 0,
      estimatedUsdThisMonth: estimateUsd(model, usage?.inputTokens ?? 0, usage?.outputTokens ?? 0),
      canEditCap: access.isSuperAdmin,
    };
  },
});

async function upsertSettings(
  ctx: any,
  communityId: Id<"communities">,
  adminId: Id<"users">,
  patch: { enabled?: boolean; monthlyCap?: number }
) {
  const existing = await ctx.db
    .query("diagnosticAiSettings")
    .withIndex("by_community", (q: any) => q.eq("communityId", communityId))
    .first();
  const now = getUgandaTime();
  if (existing) {
    await ctx.db.patch(existing._id, { ...patch, updatedBy: adminId, updatedAt: now });
  } else {
    await ctx.db.insert("diagnosticAiSettings", {
      communityId,
      enabled: patch.enabled ?? false,
      monthlyCap: patch.monthlyCap ?? DEFAULT_AI_MONTHLY_CAP,
      updatedBy: adminId,
      updatedAt: now,
    });
  }
}

/** The community's own choice: a community admin (or super admin) switches it on or off. */
export const setAiEnabled = mutation({
  args: { adminId: v.id("users"), communityId: v.id("communities"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    await requireLibraryAccess(ctx, args.adminId, args.communityId);
    await upsertSettings(ctx, args.communityId, args.adminId, { enabled: args.enabled });
    await ctx.db.insert("diagnosticAuditLog", {
      action: args.enabled ? "ai_enabled" : "ai_disabled",
      actorId: args.adminId,
      actorCommunityId: args.communityId,
      note: (await ctx.db.get(args.communityId))?.name,
      at: getUgandaTime(),
    });
    return { success: true };
  },
});

/** Super admin only: how many AI checks the community may use per month. */
export const setAiMonthlyCap = mutation({
  args: { adminId: v.id("users"), communityId: v.id("communities"), monthlyCap: v.number() },
  handler: async (ctx, args) => {
    const access = await requireLibraryAccess(ctx, args.adminId, args.communityId);
    if (!access.isSuperAdmin) throw new Error("Only a super admin can change the monthly limit");
    const monthlyCap = Math.max(0, Math.min(100000, Math.round(args.monthlyCap)));
    await upsertSettings(ctx, args.communityId, args.adminId, { monthlyCap });
    await ctx.db.insert("diagnosticAuditLog", {
      action: "ai_cap_changed",
      actorId: args.adminId,
      actorCommunityId: args.communityId,
      note: `${monthlyCap} checks a month`,
      at: getUgandaTime(),
    });
    return { success: true };
  },
});

// ─── Farmer side ────────────────────────────────────────────────────────────

/**
 * Ask for an AI check of a saved crop check that has a photo. Counts against
 * the month's limit as soon as it is queued, so a burst of requests cannot
 * overshoot the cap.
 */
export const requestAiCheck = mutation({
  args: { userId: v.id("users"), reportId: v.id("diagnosticReports") },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report || String(report.farmerId) !== String(args.userId)) throw new Error("Check not found");
    if (!report.photoStorageId) return { queued: false, reason: "no_photo" as const };
    if (report.aiStatus) return { queued: report.aiStatus !== "failed", reason: "already" as const };

    const community = await ctx.db.get(report.communityId);
    if (!community || !isDiagnosticsEnabled(community as any)) return { queued: false, reason: "not_available" as const };
    if (!(await isAiAvailable(ctx, report.communityId))) return { queued: false, reason: "not_available" as const };

    const month = ugandaMonthKey(getUgandaTime());
    const usage = await loadUsage(ctx, report.communityId, month);
    if (usage) {
      await ctx.db.patch(usage._id, { checks: usage.checks + 1 });
    } else {
      await ctx.db.insert("diagnosticAiUsage", {
        communityId: report.communityId,
        month,
        checks: 1,
        inputTokens: 0,
        outputTokens: 0,
      });
    }
    await ctx.db.patch(args.reportId, { aiStatus: "queued" });
    await ctx.scheduler.runAfter(0, internal.diagnosticsAi.runAiCheck, { reportId: args.reportId });
    return { queued: true, reason: "queued" as const };
  },
});

export const getReportAi = query({
  args: { userId: v.id("users"), reportId: v.id("diagnosticReports") },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report || String(report.farmerId) !== String(args.userId)) return null;
    return {
      aiStatus: report.aiStatus ?? null,
      aiHealthLevel: report.aiHealthLevel ?? null,
      aiPhotoUsable: report.aiPhotoUsable ?? null,
      aiResults: (report.aiResults ?? []).map((r) => ({ id: String(r.conditionId), percent: r.percent })),
    };
  },
});

// ─── The model call ─────────────────────────────────────────────────────────

export const loadForAi = internalQuery({
  args: { reportId: v.id("diagnosticReports") },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report?.photoStorageId) return null;
    const photoUrl = await ctx.storage.getUrl(report.photoStorageId);
    const conditions = await ctx.db
      .query("diagnosticConditions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(500);
    const candidates = conditions
      .filter((c) => c.hosts.includes(report.host))
      .slice(0, MAX_CANDIDATES)
      .map((c) => ({
        id: String(c._id),
        name: c.name,
        kind: c.kind,
        symptoms: c.symptoms.slice(0, 400),
      }));
    return { photoUrl, host: report.host, communityId: report.communityId, candidates };
  },
});

export const saveAiResult = internalMutation({
  args: {
    reportId: v.id("diagnosticReports"),
    status: v.union(v.literal("done"), v.literal("failed")),
    results: v.array(v.object({ id: v.string(), percent: v.number() })),
    healthLevel: v.optional(v.union(v.literal("healthy"), v.literal("possible"), v.literal("likely"), v.literal("unsure"))),
    photoUsable: v.optional(v.boolean()),
    note: v.optional(v.string()),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return;
    const now = getUgandaTime();
    await ctx.db.patch(args.reportId, {
      aiStatus: args.status,
      aiResults: args.results.map((r) => ({ conditionId: r.id as Id<"diagnosticConditions">, percent: r.percent })),
      aiHealthLevel: args.healthLevel,
      aiPhotoUsable: args.photoUsable,
      aiNote: args.note?.slice(0, 300),
      aiModel: args.model,
      aiInputTokens: args.inputTokens,
      aiOutputTokens: args.outputTokens,
      aiCheckedAt: now,
    });
    if (args.inputTokens || args.outputTokens) {
      const month = ugandaMonthKey(now);
      const usage = await ctx.db
        .query("diagnosticAiUsage")
        .withIndex("by_community_month", (q) => q.eq("communityId", report.communityId).eq("month", month))
        .first();
      if (usage) {
        await ctx.db.patch(usage._id, {
          inputTokens: usage.inputTokens + args.inputTokens,
          outputTokens: usage.outputTokens + args.outputTokens,
        });
      }
    }
  },
});

type AiInput = {
  photoUrl: string | null;
  host: string;
  communityId: Id<"communities">;
  candidates: { id: string; name: string; kind: string; symptoms: string }[];
};

const SYSTEM_PROMPT = `You help smallholder farmers in Uganda check their crops. You will get one photo taken by a farmer and a list of known pests, diseases and nutrient deficiencies for that crop, each with an id.

Compare the photo only with that list. For each entry that could explain what the photo shows, give its id and how well the photo matches it, from 1 to 100. Leave out entries that do not fit. Return at most 3 matches, strongest first. Use high numbers only when the visible signs clearly fit.

Set photoUsable to false when the plant or the affected part cannot be seen clearly (too dark, blurred, too far away, or not a plant). Set looksHealthy to true only when the visible plant shows no sign of a problem.

The note is for the farmer's community admin: one short sentence about what you see or what is wrong with the photo. Do not recommend any product, brand or treatment in the note.`;

export const runAiCheck = internalAction({
  args: { reportId: v.id("diagnosticReports") },
  handler: async (ctx, args): Promise<void> => {
    const model = aiModel();
    const fail = (note: string, inputTokens = 0, outputTokens = 0): Promise<null> =>
      ctx.runMutation(internal.diagnosticsAi.saveAiResult, {
        reportId: args.reportId,
        status: "failed",
        results: [],
        note,
        model,
        inputTokens,
        outputTokens,
      });

    const data: AiInput | null = await ctx.runQuery(internal.diagnosticsAi.loadForAi, { reportId: args.reportId });
    if (!data?.photoUrl) return void (await fail("Photo not found"));
    if (data.candidates.length === 0) return void (await fail("No approved library entries for this crop yet"));
    if (!keyConfigured()) return void (await fail("AI photo check is not configured"));

    const ids = data.candidates.map((c) => c.id);
    const schema = {
      type: "object",
      properties: {
        photoUsable: { type: "boolean" },
        looksHealthy: { type: "boolean" },
        matches: {
          type: "array",
          items: {
            type: "object",
            properties: { id: { type: "string", enum: ids }, percent: { type: "integer" } },
            required: ["id", "percent"],
            additionalProperties: false,
          },
        },
        note: { type: "string" },
      },
      required: ["photoUsable", "looksHealthy", "matches", "note"],
      additionalProperties: false,
    };
    const candidateText = data.candidates
      .map((c) => `id: ${c.id}\nname: ${c.name} (${c.kind})\nsigns: ${c.symptoms}`)
      .join("\n\n");

    // Refusal fallbacks and the effort setting apply to the Opus/Fable family only.
    const isFrontier = model.startsWith("claude-opus-5") || model.startsWith("claude-fable");
    const isHaiku = model.startsWith("claude-haiku");

    const client = new Anthropic();
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await client.beta.messages.create({
        model,
        max_tokens: 4000,
        ...(isFrontier ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        output_config: {
          ...(isHaiku ? {} : { effort: "low" as const }),
          format: { type: "json_schema", schema },
        },
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "url", url: data.photoUrl } },
              { type: "text", text: `Crop: ${data.host}\n\nKnown problems for this crop:\n\n${candidateText}` },
            ],
          },
        ],
      });
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) return void await fail("AI service busy; try again later");
      if (error instanceof Anthropic.AuthenticationError) return void await fail("AI key rejected; check ANTHROPIC_API_KEY");
      if (error instanceof Anthropic.BadRequestError) return void await fail(`AI request rejected: ${error.message.slice(0, 200)}`);
      if (error instanceof Anthropic.APIError) return void await fail(`AI service error ${error.status ?? ""}`.trim());
      return void await fail("Could not reach the AI service");
    }

    const inputTokens = response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0);
    const outputTokens = response.usage.output_tokens;
    if (response.stop_reason === "refusal") return void await fail("The AI declined to check this photo", inputTokens, outputTokens);

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    let parsed: { photoUsable: boolean; looksHealthy: boolean; matches: { id: string; percent: number }[]; note: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      return void await fail("AI answer could not be read", inputTokens, outputTokens);
    }

    const matches = cleanAiMatches(Array.isArray(parsed.matches) ? parsed.matches : [], ids);
    const photoUsable = parsed.photoUsable !== false;
    await ctx.runMutation(internal.diagnosticsAi.saveAiResult, {
      reportId: args.reportId,
      status: "done",
      results: matches,
      healthLevel: aiHealthLevel({ photoUsable, looksHealthy: parsed.looksHealthy === true, matches }),
      photoUsable,
      note: typeof parsed.note === "string" ? parsed.note : undefined,
      model: response.model || model,
      inputTokens,
      outputTokens,
    });
  },
});
