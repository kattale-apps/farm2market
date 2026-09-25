/**
 * Diagnostics - weekly photo import (phase B).
 *
 * Once a week (or when a super admin presses "Run now") this looks at library
 * entries that have a scientific name but few photos, asks iNaturalist for
 * research-grade observations of that species, and adds up to two openly
 * licensed photos per entry to the review queue. Every photo carries the
 * photographer's credit, its licence and a link to the observation, and
 * nothing reaches farmers until an admin approves it.
 *
 * Only licences that allow reuse in an app are accepted (CC0, CC BY,
 * CC BY-SA); non-commercial and all-rights-reserved photos are skipped.
 * Batches are small and requests are spaced out, to stay light on Convex and
 * polite to iNaturalist.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import { MAX_DIAGNOSTIC_IMAGE_BYTES } from "./diagnosticsRules";

const TARGET_PHOTOS_PER_ENTRY = 4;
const PHOTOS_PER_ENTRY_PER_RUN = 2;
const DEFAULT_ENTRIES_PER_RUN = 10;
const ALLOWED_LICENCES = ["cc0", "cc-by", "cc-by-sa"];
const USER_AGENT = "farm2market-diagnostics/1.0 (weekly library photo import)";

const LICENCE_LABEL: Record<string, string> = {
  cc0: "CC0 (public domain)",
  "cc-by": "CC BY 4.0",
  "cc-by-sa": "CC BY-SA 4.0",
};

// Mirrors isSuperAdmin() in convex/communities.ts.
function isSuperAdminUser(user: Doc<"users"> | null): boolean {
  const u = user as any;
  return !!u && u.role === "admin" && (u.adminLevel === "super" || (u.adminLevel === undefined && !u.adminCategory));
}

async function requireSuperAdmin(ctx: { db: any }, adminId: Id<"users">) {
  const admin = await ctx.db.get(adminId);
  if (!isSuperAdminUser(admin)) throw new Error("Only a super admin can manage the photo import");
  return admin as Doc<"users">;
}

// ─── Super admin controls ───────────────────────────────────────────────────

export const getImportSettings = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx, args.adminId);
    const settings = await ctx.db.query("diagnosticImportSettings").first();
    return settings
      ? {
          enabled: settings.enabled,
          entriesPerRun: settings.entriesPerRun,
          lastRunAt: settings.lastRunAt,
          lastRunSummary: settings.lastRunSummary,
        }
      : { enabled: false, entriesPerRun: DEFAULT_ENTRIES_PER_RUN, lastRunAt: undefined, lastRunSummary: undefined };
  },
});

export const setImportEnabled = mutation({
  args: { adminId: v.id("users"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx, args.adminId);
    const now = getUgandaTime();
    const settings = await ctx.db.query("diagnosticImportSettings").first();
    if (settings) {
      await ctx.db.patch(settings._id, { enabled: args.enabled, actorId: args.adminId, updatedAt: now });
    } else {
      await ctx.db.insert("diagnosticImportSettings", {
        enabled: args.enabled,
        actorId: args.adminId,
        entriesPerRun: DEFAULT_ENTRIES_PER_RUN,
        updatedAt: now,
      });
    }
    await ctx.db.insert("diagnosticAuditLog", {
      action: args.enabled ? "import_enabled" : "import_disabled",
      actorId: args.adminId,
      note: "Weekly iNaturalist photo import",
      at: now,
    });
    return { success: true };
  },
});

export const runImportNow = mutation({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx, args.adminId);
    await ctx.scheduler.runAfter(0, internal.diagnosticsImport.runImport, { actorId: args.adminId });
    return { success: true };
  },
});

// ─── The import ─────────────────────────────────────────────────────────────

/** Called by the weekly cron; does nothing unless a super admin switched the import on. */
export const runScheduledImport = internalAction({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.runQuery(internal.diagnosticsImport.readSettings, {});
    if (!settings?.enabled) return;
    await ctx.runAction(internal.diagnosticsImport.runImport, { actorId: settings.actorId });
  },
});

export const readSettings = internalQuery({
  args: {},
  handler: async (ctx) => await ctx.db.query("diagnosticImportSettings").first(),
});

/**
 * Entries that have a scientific name and fewer than the target number of
 * photos, least recently imported first.
 */
export const pickEntries = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const conditions = [
      ...(await ctx.db
        .query("diagnosticConditions")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .take(300)),
      ...(await ctx.db
        .query("diagnosticConditions")
        .withIndex("by_status", (q) => q.eq("status", "pending_review"))
        .take(300)),
    ].filter((c) => (c.scientificName ?? "").trim().length > 0);

    const picked: { conditionId: Id<"diagnosticConditions">; scientificName: string; needed: number }[] = [];
    for (const c of conditions.sort((a, b) => (a.lastImportAt ?? 0) - (b.lastImportAt ?? 0))) {
      if (picked.length >= args.limit) break;
      const photos = await ctx.db
        .query("diagnosticImages")
        .withIndex("by_condition", (q) => q.eq("conditionId", c._id))
        .take(TARGET_PHOTOS_PER_ENTRY + 10);
      const usable = photos.filter((p) => p.status === "active" || p.status === "pending_review").length;
      if (usable >= TARGET_PHOTOS_PER_ENTRY) continue;
      picked.push({
        conditionId: c._id,
        scientificName: c.scientificName!.trim(),
        needed: Math.min(PHOTOS_PER_ENTRY_PER_RUN, TARGET_PHOTOS_PER_ENTRY - usable),
      });
    }
    return picked;
  },
});

export const knownRefs = internalQuery({
  args: { refs: v.array(v.string()) },
  handler: async (ctx, args) => {
    const known: string[] = [];
    for (const ref of args.refs) {
      const hit = await ctx.db
        .query("diagnosticImages")
        .withIndex("by_external_ref", (q) => q.eq("externalRef", ref))
        .first();
      if (hit) known.push(ref);
    }
    return known;
  },
});

export const saveImportedPhoto = internalMutation({
  args: {
    actorId: v.id("users"),
    conditionId: v.id("diagnosticConditions"),
    storageId: v.id("_storage"),
    thumbStorageId: v.id("_storage"),
    externalRef: v.string(),
    caption: v.string(),
    sourceName: v.string(),
    sourceUrl: v.string(),
    licence: v.string(),
  },
  handler: async (ctx, args) => {
    const condition = await ctx.db.get(args.conditionId);
    const duplicate = await ctx.db
      .query("diagnosticImages")
      .withIndex("by_external_ref", (q) => q.eq("externalRef", args.externalRef))
      .first();
    if (!condition || condition.status === "removed" || condition.status === "rejected" || duplicate) {
      await ctx.storage.delete(args.storageId);
      await ctx.storage.delete(args.thumbStorageId);
      return null;
    }
    const now = getUgandaTime();
    const imageId = await ctx.db.insert("diagnosticImages", {
      conditionId: args.conditionId,
      storageId: args.storageId,
      thumbStorageId: args.thumbStorageId,
      caption: args.caption,
      sourceName: args.sourceName,
      sourceUrl: args.sourceUrl,
      licence: args.licence,
      externalRef: args.externalRef,
      status: "pending_review",
      addedBy: args.actorId,
      addedAt: now,
      openFlagCount: 0,
    });
    await ctx.db.insert("diagnosticAuditLog", {
      action: "imported",
      itemType: "image",
      itemId: String(imageId),
      conditionId: args.conditionId,
      actorId: args.actorId,
      note: args.sourceName,
      at: now,
    });
    return imageId;
  },
});

export const finishRun = internalMutation({
  args: { conditionIds: v.array(v.id("diagnosticConditions")), summary: v.string() },
  handler: async (ctx, args) => {
    const now = getUgandaTime();
    for (const id of args.conditionIds) {
      if (await ctx.db.get(id)) await ctx.db.patch(id, { lastImportAt: now });
    }
    const settings = await ctx.db.query("diagnosticImportSettings").first();
    if (settings) await ctx.db.patch(settings._id, { lastRunAt: now, lastRunSummary: args.summary });
  },
});

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchImage(url: string): Promise<Blob | null> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  const blob = await res.blob();
  if (!blob.type.startsWith("image/") || blob.size > MAX_DIAGNOSTIC_IMAGE_BYTES) return null;
  return blob;
}

export const runImport = internalAction({
  args: { actorId: v.id("users") },
  handler: async (ctx, args) => {
    const settings = await ctx.runQuery(internal.diagnosticsImport.readSettings, {});
    const entries = await ctx.runQuery(internal.diagnosticsImport.pickEntries, {
      limit: settings?.entriesPerRun ?? DEFAULT_ENTRIES_PER_RUN,
    });

    let added = 0;
    let failed = 0;
    for (const entry of entries) {
      try {
        const params = new URLSearchParams({
          taxon_name: entry.scientificName,
          quality_grade: "research",
          photo_license: ALLOWED_LICENCES.join(","),
          per_page: "10",
          order_by: "votes",
        });
        const res = await fetch(`https://api.inaturalist.org/v1/observations?${params}`, {
          headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        });
        if (!res.ok) {
          failed++;
          continue;
        }
        const body = (await res.json()) as { results?: any[] };

        const candidates: { ref: string; photo: any; obs: any }[] = [];
        for (const obs of body.results ?? []) {
          for (const photo of obs.photos ?? []) {
            if (!ALLOWED_LICENCES.includes(String(photo.license_code ?? "").toLowerCase())) continue;
            if (typeof photo.url !== "string" || !photo.url.includes("square")) continue;
            candidates.push({ ref: `inat:photo:${photo.id}`, photo, obs });
            break; // one photo per observation, so the entry gets different plants
          }
        }
        const known = new Set(
          await ctx.runQuery(internal.diagnosticsImport.knownRefs, { refs: candidates.map((c) => c.ref) })
        );

        let addedForEntry = 0;
        for (const c of candidates) {
          if (addedForEntry >= entry.needed) break;
          if (known.has(c.ref)) continue;
          const full = await fetchImage(c.photo.url.replace("square", "medium"));
          const thumb = await fetchImage(c.photo.url.replace("square", "small"));
          if (!full || !thumb) continue;
          const storageId = await ctx.storage.store(full);
          const thumbStorageId = await ctx.storage.store(thumb);
          const saved = await ctx.runMutation(internal.diagnosticsImport.saveImportedPhoto, {
            actorId: args.actorId,
            conditionId: entry.conditionId,
            storageId,
            thumbStorageId,
            externalRef: c.ref,
            caption: `${c.obs.taxon?.name ?? entry.scientificName} - iNaturalist observation`,
            sourceName: `iNaturalist - ${String(c.photo.attribution ?? "photographer not given").slice(0, 150)}`,
            sourceUrl: String(c.obs.uri ?? `https://www.inaturalist.org/observations/${c.obs.id}`),
            licence: LICENCE_LABEL[String(c.photo.license_code).toLowerCase()] ?? String(c.photo.license_code),
          });
          if (saved) {
            added++;
            addedForEntry++;
          }
        }
      } catch {
        failed++;
      }
      await pause(1100); // iNaturalist asks for about one request per second
    }

    await ctx.runMutation(internal.diagnosticsImport.finishRun, {
      conditionIds: entries.map((e) => e.conditionId),
      summary:
        entries.length === 0
          ? "Nothing to import: no entries with a scientific name need photos"
          : `${added} photo${added === 1 ? "" : "s"} added for review from ${entries.length} entr${entries.length === 1 ? "y" : "ies"}${failed ? `, ${failed} failed` : ""}`,
    });
  },
});
