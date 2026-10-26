/**
 * Goods QR codes: the scan page (/g/<code>), scan counting and the owner's
 * views. Codes are issued in goodsCodesCore.ts when a listing, processing
 * batch or export lot is created.
 *
 * The scan page follows MarketSpace's viewer levels: anyone sees what the
 * good is, the seller's category and district, how much of it traces to farms
 * and the live post; verified buyers also see the seller's alias and the
 * farms' districts; the owner also sees the scan counts.
 */

import { v } from "convex/values";
import { internalMutation, mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import { exportLotGoodLabel } from "./exportMarketsShared";
import { roleLabel } from "./roleLabels";
import { sessionUser, viewerOf } from "./marketspace";
import { FarmOrigin, originsOfBatch, originsOfListing, traceSummary } from "./traceChain";
import { goodKeyOf, issueGoodsCode } from "./goodsCodesCore";
import { batchGoodLabel, formLabel } from "./processorShared";

type Ctx = QueryCtx | MutationCtx;

const SCAN_REPEAT_MS = 60 * 60 * 1000; // One visitor counts once an hour
const TRACE_SHARE_KG = 100; // Origins are worked out on 100 kg, so the kilos read as percent

const TRACE_LEVEL: Record<string, string> = {
  platform_traced: "Traced to farms on the app",
  partly_declared: "Partly traced, partly declared by the seller",
  declared_evidenced: "Declared by the seller, with evidence checked",
  declared: "Declared by the seller",
};

async function codeByText(ctx: Ctx, text: string) {
  return await ctx.db
    .query("goodsCodes")
    .withIndex("by_code", (q) => q.eq("code", text.trim().toUpperCase()))
    .first();
}

function currentTargetId(code: Doc<"goodsCodes">): string {
  return String(code.listingId ?? code.batchId ?? code.exportLotId ?? "");
}

async function districtName(ctx: Ctx, user: Doc<"users"> | null): Promise<string | null> {
  if (!user) return null;
  const district = user.districtId ? await ctx.db.get(user.districtId) : null;
  return district?.name ?? user.districtText ?? null;
}

async function photoUrl(ctx: Ctx, storageId: Id<"_storage"> | undefined) {
  return storageId ? await ctx.storage.getUrl(storageId) : null;
}

/** How much of the good traces to farms, and (for verified buyers) where the farms are. */
async function traceDigest(ctx: Ctx, origins: FarmOrigin[], withDistricts: boolean) {
  const totals = traceSummary(origins);
  const total = totals.appFarmsKg + totals.declaredFarmsKg + totals.untracedKg;
  const farms = new Set<string>();
  const districts = new Set<string>();
  for (const o of origins.slice(0, 200)) {
    if (o.kind === "platform_farmer") {
      farms.add(String(o.farmerId));
      if (withDistricts) {
        const name = await districtName(ctx, await ctx.db.get(o.farmerId));
        if (name) districts.add(name);
      }
    } else if (o.kind === "declared_farm") {
      farms.add(String(o.intakeId));
      if (withDistricts) {
        const intake = await ctx.db.get(o.intakeId);
        if (intake?.district) districts.add(intake.district);
      }
    }
  }
  const percent = (kg: number) => (total > 0 ? Math.round((kg / total) * 100) : 0);
  return {
    farms: farms.size,
    tracedPercent: percent(totals.appFarmsKg + totals.declaredFarmsKg),
    appFarmsPercent: percent(totals.appFarmsKg),
    farmDistricts: withDistricts ? [...districts].slice(0, 12) : null,
  };
}

/** A listing's MarketSpace post, when it is live now. */
async function livePostOf(ctx: Ctx, listingId: Id<"listings">, now: number): Promise<string | null> {
  const card = await ctx.db
    .query("marketCards")
    .withIndex("by_listing", (q) => q.eq("listingId", listingId))
    .first();
  return card && card.status === "active" && card.expiresAt > now ? `/marketspace/p/${card._id}` : null;
}

/** The scan page: what a goods QR points to now, for this viewer. */
export const resolve = query({
  args: { code: v.string(), now: v.number(), today: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const code = await codeByText(ctx, args.code);
    if (!code) return null;
    const viewer = await viewerOf(ctx, args.sessionToken, args.today);
    const isOwner = !!viewer.user && viewer.user._id === code.ownerId;
    const full = isOwner || viewer.tier === "verified";
    const owner = await ctx.db.get(code.ownerId);

    let ref = "";
    let state = "";
    let photo: string | null = null;
    let livePath: string | null = null;
    let liveLabel = "";
    let trace: Awaited<ReturnType<typeof traceDigest>> | null = null;
    let traceLevel: string | null = null;
    let traceStages: string | null = null;

    if (code.targetKind === "listing" && code.listingId) {
      const listing = await ctx.db.get(code.listingId);
      if (listing) {
        ref = listing.utid;
        photo = await photoUrl(ctx, listing.photos?.[0]?.storageId);
        livePath = await livePostOf(ctx, listing._id, args.now);
        liveLabel = "Open the post on MarketSpace";
        state = livePath
          ? "On MarketSpace now"
          : listing.status === "fully_locked" || listing.status === "delivered"
            ? "Sold out"
            : listing.status === "cancelled"
              ? "Ended"
              : "Not on MarketSpace now";
        trace = await traceDigest(ctx, await originsOfListing(ctx, listing._id, TRACE_SHARE_KG), full);
      }
    } else if (code.targetKind === "batch" && code.batchId) {
      const batch = await ctx.db.get(code.batchId);
      if (batch) {
        ref = batch.batchCode;
        photo = await photoUrl(ctx, batch.photos[0]?.storageId);
        state = batch.status === "completed" ? `Processed: ${formLabel(batch.outputForm)}` : "Being processed";
        traceLevel = TRACE_LEVEL[batch.traceLevel] ?? null;
        trace = await traceDigest(ctx, await originsOfBatch(ctx, batch._id, TRACE_SHARE_KG, []), full);
        // Lots made from the batch, when one is on MarketSpace
        const lots = await ctx.db
          .query("listings")
          .withIndex("by_processingBatch", (q) => q.eq("processingBatchId", batch._id))
          .order("desc")
          .take(10);
        for (const lot of lots) {
          livePath = await livePostOf(ctx, lot._id, args.now);
          if (livePath) break;
        }
        liveLabel = "Buy lots of it on MarketSpace";
      }
    } else if (code.targetKind === "exportLot" && code.exportLotId) {
      const lot = await ctx.db.get(code.exportLotId);
      if (lot) {
        ref = lot.lotCode;
        photo = await photoUrl(ctx, lot.photoStorageIds[0]);
        state = lot.status === "listed" ? "On Global Bulk Markets now" : lot.status === "sold_out" ? "Sold out" : "Not on sale now";
        traceLevel = TRACE_LEVEL[lot.traceLevel] ?? null;
        traceStages = `${lot.traceStagesApproved} of ${lot.traceStagesTotal} trace stages checked${lot.eudrReady ? " · EUDR ready" : ""}`;
        if (lot.status === "listed") {
          livePath = `/buyer/export-markets/${lot._id}`;
          liveLabel = "Open the lot on Global Bulk Markets";
        }
      }
    }

    return {
      code: code.code,
      goodLabel: code.goodLabel,
      kind: code.targetKind,
      ref,
      state,
      photoUrl: photo,
      livePath,
      liveLabel,
      trace,
      traceLevel,
      traceStages,
      sellerCategory: owner ? roleLabel(owner.role) || "Member" : "Member",
      sellerAlias: full && owner ? `${roleLabel(owner.role)} ${owner.alias ?? ""}`.trim() : null,
      district: await districtName(ctx, owner),
      since: code.createdAt,
      tier: viewer.tier,
      isOwner,
      ownerStats: isOwner ? { scanCount: code.scanCount, uses: code.uses, lastScannedAt: code.lastScannedAt ?? null } : null,
    };
  },
});

/** Counts a scan. A visitor counts once an hour; the owner's own scans do not count. */
export const recordScan = mutation({
  args: { code: v.string(), visitorKey: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const code = await codeByText(ctx, args.code);
    const visitorKey = args.visitorKey.trim().slice(0, 64);
    if (!code || visitorKey.length < 8) return { counted: false };
    const user = await sessionUser(ctx, args.sessionToken);
    if (user && user._id === code.ownerId) return { counted: false };
    const now = getUgandaTime();
    const recent = await ctx.db
      .query("goodsCodeScans")
      .withIndex("by_code_visitor_and_at", (q) => q.eq("codeId", code._id).eq("visitorKey", visitorKey).gt("at", now - SCAN_REPEAT_MS))
      .first();
    if (recent) return { counted: false };
    await ctx.db.insert("goodsCodeScans", { codeId: code._id, targetId: currentTargetId(code), visitorKey, viewerRole: user?.role, at: now });
    await ctx.db.patch(code._id, { scanCount: code.scanCount + 1, lastScannedAt: now });
    return { counted: true };
  },
});

/** Whether the code is still on something being sold (moving it would point its labels at the new listing). */
async function stillSelling(ctx: Ctx, code: Doc<"goodsCodes">): Promise<boolean> {
  if (code.listingId) {
    const l = await ctx.db.get(code.listingId);
    return !!l && (l.status === "active" || l.status === "partially_locked");
  }
  if (code.batchId) return (await ctx.db.get(code.batchId))?.status === "in_progress";
  if (code.exportLotId) {
    const lot = await ctx.db.get(code.exportLotId);
    return !!lot && (lot.status === "draft" || lot.status === "listed");
  }
  return false;
}

/** The seller's QR codes for a good, newest use first, to reuse on a new listing or batch. */
export const myCodesFor = query({
  args: { userId: v.id("users"), goodLabel: v.string() },
  handler: async (ctx, args) => {
    const goodKey = goodKeyOf(args.goodLabel);
    if (!goodKey) return [];
    const codes = await ctx.db
      .query("goodsCodes")
      .withIndex("by_owner_and_goodKey", (q) => q.eq("ownerId", args.userId).eq("goodKey", goodKey))
      .take(20);
    const rows = [];
    for (const c of codes.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5)) {
      rows.push({ codeId: c._id, code: c.code, uses: c.uses, scanCount: c.scanCount, updatedAt: c.updatedAt, stillSelling: await stillSelling(ctx, c) });
    }
    return rows;
  },
});

const MAX_COUNTED = 500; // Per-listing scans above this show as "500+"

/** The owner's view of one code: its scans, and every listing or batch it has been on (the ledger). */
export const ownerView = query({
  // Dashboards pass the userId; MarketSpace screens pass their session token
  args: { codeId: v.id("goodsCodes"), userId: v.optional(v.id("users")), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const ownerId = args.sessionToken ? (await sessionUser(ctx, args.sessionToken))?._id : args.userId;
    const code = await ctx.db.get(args.codeId);
    if (!code || !ownerId || code.ownerId !== ownerId) return null;
    const current = currentTargetId(code);
    const items: { targetId: string; label: string; createdAt: number; current: boolean; scans: number }[] = [];
    const add = (targetId: string, label: string, createdAt: number) =>
      items.push({ targetId, label, createdAt, current: targetId === current, scans: 0 });
    const listings = await ctx.db.query("listings").withIndex("by_goodsCode", (q) => q.eq("goodsCodeId", code._id)).order("desc").take(20);
    for (const l of listings) add(l._id, `${l.productName ?? l.produceType} · ${l.utid}`, l.createdAt);
    const batches = await ctx.db.query("processingBatches").withIndex("by_goodsCode", (q) => q.eq("goodsCodeId", code._id)).order("desc").take(20);
    for (const b of batches) add(b._id, `${batchGoodLabel(b.crop, b.outputForm)} · batch ${b.batchCode}`, b.createdAt);
    const lots = await ctx.db.query("exportLots").withIndex("by_goodsCode", (q) => q.eq("goodsCodeId", code._id)).order("desc").take(20);
    for (const l of lots) add(l._id, `${exportLotGoodLabel(l)} · lot ${l.lotCode}`, l.createdAt);
    for (const item of items) {
      item.scans = (
        await ctx.db
          .query("goodsCodeScans")
          .withIndex("by_target", (q) => q.eq("targetId", item.targetId))
          .take(MAX_COUNTED + 1)
      ).length;
    }
    items.sort((a, b) => b.createdAt - a.createdAt);
    // The photo of what the code is on now, for the printed label
    let photoStorageId: Id<"_storage"> | undefined;
    if (code.listingId) photoStorageId = (await ctx.db.get(code.listingId))?.photos?.[0]?.storageId;
    else if (code.batchId) photoStorageId = (await ctx.db.get(code.batchId))?.photos[0]?.storageId;
    else if (code.exportLotId) photoStorageId = (await ctx.db.get(code.exportLotId))?.photoStorageIds[0];
    return {
      codeId: code._id,
      code: code.code,
      goodLabel: code.goodLabel,
      scanCount: code.scanCount,
      uses: code.uses,
      lastScannedAt: code.lastScannedAt ?? null,
      createdAt: code.createdAt,
      photoUrl: await photoUrl(ctx, photoStorageId),
      maxCounted: MAX_COUNTED,
      items: items.slice(0, 20),
    };
  },
});

/**
 * One-off: gives every listing, processing batch and export lot made before
 * goods QRs its own code, 100 at a time, one table after another.
 * Run: npx convex run goodsCodes:backfillGoodsCodes '{"table":"listings","cursor":null}'
 */
export const backfillGoodsCodes = internalMutation({
  args: {
    table: v.union(v.literal("listings"), v.literal("processingBatches"), v.literal("exportLots")),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    let issued = 0;
    let isDone: boolean;
    let continueCursor: string;
    if (args.table === "listings") {
      const page = await ctx.db.query("listings").paginate({ numItems: 100, cursor: args.cursor });
      for (const l of page.page) {
        const ownerId = l.farmerId ?? l.traderId;
        if (l.goodsCodeId || !ownerId) continue;
        const goodsCodeId = await issueGoodsCode(ctx, { ownerId, goodLabel: l.productName ?? l.produceType, target: { kind: "listing", id: l._id } });
        await ctx.db.patch(l._id, { goodsCodeId });
        issued++;
      }
      ({ isDone, continueCursor } = page);
    } else if (args.table === "processingBatches") {
      const page = await ctx.db.query("processingBatches").paginate({ numItems: 100, cursor: args.cursor });
      for (const b of page.page) {
        if (b.goodsCodeId) continue;
        const goodsCodeId = await issueGoodsCode(ctx, { ownerId: b.processorId, goodLabel: batchGoodLabel(b.crop, b.outputForm), target: { kind: "batch", id: b._id } });
        await ctx.db.patch(b._id, { goodsCodeId });
        issued++;
      }
      ({ isDone, continueCursor } = page);
    } else {
      const page = await ctx.db.query("exportLots").paginate({ numItems: 100, cursor: args.cursor });
      for (const l of page.page) {
        if (l.goodsCodeId) continue;
        const goodsCodeId = await issueGoodsCode(ctx, { ownerId: l.exporterId, goodLabel: exportLotGoodLabel(l), target: { kind: "exportLot", id: l._id } });
        await ctx.db.patch(l._id, { goodsCodeId });
        issued++;
      }
      ({ isDone, continueCursor } = page);
    }
    const next = !isDone ? args.table : args.table === "listings" ? "processingBatches" : args.table === "processingBatches" ? "exportLots" : null;
    if (next) {
      await ctx.scheduler.runAfter(0, internal.goodsCodes.backfillGoodsCodes, { table: next, cursor: isDone ? null : continueCursor });
    }
    return { table: args.table, issued, next };
  },
});
