/**
 * Export Markets - Phase 2 (lots and trace map) and the buyer catalogue.
 *
 * Lots are listed by live exporters (see exportMarkets.isActiveExporter). A
 * lot hides from the catalogue the moment its exporter stops being live, for
 * example when a licence expires.
 *
 * Sources say where a lot's coffee came from: platform purchases (the
 * trader's own inventory bought from farmers here), Advanced Markets
 * commitments, or declared off-platform farms. Lots whose coffee is all
 * platform-traced are labelled differently from declared ones.
 *
 * The trace map is a fixed journey (TRACE_STAGES). Each stage takes proof
 * photos with GPS and time, plus weight in and out. Farm stages are verified
 * by an admin of a source farmer's community, the rest by an admin of the
 * exporter community; super admins can verify any stage.
 */

import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import {
  DEFAULT_EXPORT_CROP,
  EXPORT_CROPS,
  PRODUCT_FORM_KEYS,
  EUDR_POLYGON_THRESHOLD_HA,
  HECTARES_PER_ACRE,
  MASS_BALANCE_TOLERANCE,
  TRACE_STAGES,
  isIsoDate,
} from "./exportMarketsShared";
import {
  adminManagesCommunity,
  audit,
  isActiveExporter,
  isSuperAdmin,
  notify,
  requireAdmin,
  todayUganda,
} from "./exportMarkets";

type Ctx = QueryCtx | MutationCtx;

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function uniqueCode(ctx: MutationCtx, prefix: string, exists: (code: string) => Promise<boolean>) {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = `${prefix}-`;
    for (let i = 0; i < 5; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!(await exists(code))) return code;
  }
  throw new Error("Could not generate a unique code, please retry");
}

async function requireExporter(ctx: Ctx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "trader") throw new Error("Only exporters can do this");
  const profile = await ctx.db
    .query("exporterProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  if (!profile) throw new Error("Set up your exporter profile first");
  return { user, profile };
}

async function requireOwnLot(ctx: Ctx, userId: Id<"users">, lotId: Id<"exportLots">) {
  const lot = await ctx.db.get(lotId);
  if (!lot || lot.exporterId !== userId) throw new Error("Lot not found");
  return lot;
}

function validLat(n: number | undefined) {
  return n === undefined || (Number.isFinite(n) && n >= -90 && n <= 90);
}
function validLng(n: number | undefined) {
  return n === undefined || (Number.isFinite(n) && n >= -180 && n <= 180);
}

/** A farm plot as it appears on the traceability report. */
export type FarmPlot = {
  sourceId: Id<"exportLotSources">;
  kind: Doc<"exportLotSources">["kind"];
  label: string;
  district?: string;
  village?: string;
  lat?: number;
  lng?: number;
  areaHa?: number;
  hasPolygon: boolean;
  polygonGeoJson?: string;
  kilos: number;
  farmerId?: Id<"users">;
  eudrIssue?: string;
};

function plotIssue(p: Omit<FarmPlot, "eudrIssue">): string | undefined {
  if (p.lat === undefined || p.lng === undefined) return "no GPS location";
  if (p.areaHa !== undefined && p.areaHa > EUDR_POLYGON_THRESHOLD_HA && !p.hasPolygon) {
    return `plot over ${EUDR_POLYGON_THRESHOLD_HA} ha without a boundary polygon`;
  }
  return undefined;
}

function farmerPlot(source: Doc<"exportLotSources">, farmer: Doc<"users"> | null, kilos: number): FarmPlot {
  const areaHa = farmer?.farmSizeAcres ? farmer.farmSizeAcres * HECTARES_PER_ACRE : undefined;
  const base = {
    sourceId: source._id,
    kind: source.kind,
    label: farmer ? `Farmer ${farmer.alias}` : "Farmer (account removed)",
    district: farmer?.districtText,
    village: farmer?.village,
    lat: farmer?.gpsLat,
    lng: farmer?.gpsLng,
    areaHa: areaHa !== undefined ? Math.round(areaHa * 100) / 100 : undefined,
    hasPolygon: false,
    kilos,
    farmerId: farmer?._id,
  };
  return { ...base, eudrIssue: plotIssue(base) };
}

/** Expand one source into the farm plots it covers. */
export async function plotsForSource(ctx: Ctx, source: Doc<"exportLotSources">): Promise<FarmPlot[]> {
  if (source.kind === "declared") {
    const base = {
      sourceId: source._id,
      kind: source.kind,
      label: source.farmerName ? `Declared farm: ${source.farmerName}` : "Declared farm",
      district: source.district,
      village: source.village,
      lat: source.lat,
      lng: source.lng,
      areaHa: source.areaHa,
      hasPolygon: !!source.polygonGeoJson,
      polygonGeoJson: source.polygonGeoJson,
      kilos: source.kilos,
    };
    return [{ ...base, eudrIssue: plotIssue(base) }];
  }
  if (source.kind === "advance_commitment" && source.commitmentId) {
    const commitment = await ctx.db.get(source.commitmentId);
    const offer = commitment ? await ctx.db.get(commitment.offerId) : null;
    const farmer = offer ? await ctx.db.get(offer.farmerId) : null;
    return [farmerPlot(source, farmer, source.kilos)];
  }
  if (source.kind === "platform_purchase" && source.inventoryId) {
    const inv = await ctx.db.get(source.inventoryId);
    if (!inv) return [];
    // Split the allocated kilos across the farmers who supplied the block.
    const perFarmer = new Map<string, number>();
    for (const unitId of inv.listingUnitIds.slice(0, 300)) {
      const unit = await ctx.db.get(unitId);
      if (!unit) continue;
      const listing = await ctx.db.get(unit.listingId);
      if (!listing?.farmerId) continue;
      const key = String(listing.farmerId);
      perFarmer.set(key, (perFarmer.get(key) ?? 0) + (listing.unitSize || 10));
    }
    const total = [...perFarmer.values()].reduce((a, b) => a + b, 0) || 1;
    const plots: FarmPlot[] = [];
    for (const [farmerId, kg] of perFarmer) {
      const farmer = await ctx.db.get(farmerId as Id<"users">);
      plots.push(farmerPlot(source, farmer, Math.round((source.kilos * kg) / total)));
    }
    return plots;
  }
  return [];
}

/** Recompute the lot's trace level, EUDR readiness and stage progress. */
export async function recomputeLotSummary(ctx: MutationCtx, lotId: Id<"exportLots">) {
  const lot = await ctx.db.get(lotId);
  if (!lot) return;
  const sources = await ctx.db.query("exportLotSources").withIndex("by_lotId", (q) => q.eq("lotId", lotId)).take(200);
  const platform = sources.filter((s) => s.kind !== "declared").length;
  const traceLevel =
    sources.length > 0 && platform === sources.length
      ? ("platform_traced" as const)
      : platform > 0
        ? ("partly_declared" as const)
        : ("declared" as const);
  let eudrReady = sources.length > 0;
  for (const s of sources) {
    if (!eudrReady) break;
    for (const p of await plotsForSource(ctx, s)) {
      if (p.eudrIssue) {
        eudrReady = false;
        break;
      }
    }
  }
  const stages = await ctx.db.query("exportTraceStages").withIndex("by_lotId_and_order", (q) => q.eq("lotId", lotId)).take(50);
  await ctx.db.patch(lotId, {
    traceLevel,
    eudrReady,
    traceStagesApproved: stages.filter((s) => s.status === "approved").length,
    traceStagesTotal: stages.length,
    updatedAt: getUgandaTime(),
  });
}

/** Communities of the farmers behind a lot, for farm-stage review scope. */
async function farmerCommunityIds(ctx: Ctx, lotId: Id<"exportLots">): Promise<Set<string>> {
  const ids = new Set<string>();
  const sources = await ctx.db.query("exportLotSources").withIndex("by_lotId", (q) => q.eq("lotId", lotId)).take(200);
  const farmers = new Set<string>();
  for (const s of sources) {
    for (const p of await plotsForSource(ctx, s)) if (p.farmerId) farmers.add(String(p.farmerId));
  }
  for (const f of farmers) {
    const memberships = await ctx.db
      .query("communityMemberships")
      .withIndex("by_user", (q) => q.eq("userId", f as Id<"users">))
      .take(50);
    for (const m of memberships) ids.add(String(m.communityId));
  }
  return ids;
}

async function canReviewStage(ctx: Ctx, admin: Doc<"users">, lot: Doc<"exportLots">, stage: Doc<"exportTraceStages">) {
  if (isSuperAdmin(admin)) return true;
  if (stage.scope === "exporter") {
    const community = await ctx.db.get(lot.communityId);
    return !!community && adminManagesCommunity(admin, community);
  }
  for (const cid of await farmerCommunityIds(ctx, lot._id)) {
    const community = await ctx.db.get(cid as Id<"communities">);
    if (community && adminManagesCommunity(admin, community)) return true;
  }
  return false;
}

/** Anonymous public record of an exporter: alias, rating and delivery record. */
export async function exporterPublicStats(ctx: Ctx, exporterId: Id<"users">) {
  const user = await ctx.db.get(exporterId);
  const ratings = await ctx.db.query("exportRatings").withIndex("by_exporterId", (q) => q.eq("exporterId", exporterId)).take(500);
  const deals = await ctx.db.query("exportDeals").withIndex("by_exporterId", (q) => q.eq("exporterId", exporterId)).take(500);
  const completed = deals.filter((d) => d.status === "completed");
  const shipped = deals.filter((d) => d.shippedOn && d.contract);
  const onTime = shipped.filter((d) => d.shippedOn! <= d.contract!.shipmentWindowEnd).length;
  const avg = (k: "overall" | "quality" | "documents" | "communication") =>
    ratings.length ? Math.round((ratings.reduce((a, r) => a + r[k], 0) / ratings.length) * 10) / 10 : null;
  return {
    alias: `Exporter ${user?.alias ?? ""}`.trim(),
    ratingAverage: avg("overall"),
    ratingCount: ratings.length,
    qualityAverage: avg("quality"),
    completedDeals: completed.length,
    onTimeShipmentRate: shipped.length ? Math.round((onTime / shipped.length) * 100) : null,
  };
}

async function photoUrls(ctx: Ctx, ids: Id<"_storage">[]) {
  const urls: string[] = [];
  for (const id of ids) {
    const url = await ctx.storage.getUrl(id);
    if (url) urls.push(url);
  }
  return urls;
}

async function materializeStages(ctx: MutationCtx, lotId: Id<"exportLots">) {
  const now = getUgandaTime();
  for (let i = 0; i < TRACE_STAGES.length; i++) {
    const s = TRACE_STAGES[i];
    await ctx.db.insert("exportTraceStages", { lotId, order: i, key: s.key, name: s.name, scope: s.scope, status: "pending", updatedAt: now });
  }
}

// ------------------------------------------------------------------
// Exporter: lots
// ------------------------------------------------------------------

const lotFields = {
  crop: v.optional(v.string()),
  productForm: v.optional(v.string()),
  coffeeType: v.string(),
  grade: v.string(),
  processing: v.string(),
  cropYear: v.string(),
  originDistrict: v.string(),
  originRegion: v.optional(v.string()),
  bags: v.number(),
  bagWeightKg: v.number(),
  minOrderBags: v.number(),
  moisturePercent: v.optional(v.number()),
  defects: v.optional(v.string()),
  screenSize: v.optional(v.string()),
  cupScore: v.optional(v.number()),
  certifications: v.array(v.string()),
  description: v.optional(v.string()),
  warehouseLocation: v.string(),
  incoterms: v.array(v.string()),
  sampleAvailable: v.boolean(),
};

export const generateLotUploadUrl = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireExporter(ctx, args.userId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const listMyLots = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const lots = await ctx.db.query("exportLots").withIndex("by_exporterId", (q) => q.eq("exporterId", args.userId)).order("desc").take(200);
    const result = [];
    for (const lot of lots) {
      const deals = await ctx.db.query("exportDeals").withIndex("by_lotId", (q) => q.eq("lotId", lot._id)).take(100);
      result.push({
        ...lot,
        coverUrl: lot.photoStorageIds[0] ? await ctx.storage.getUrl(lot.photoStorageIds[0]) : null,
        openDeals: deals.filter((d) => d.status === "enquiry" || d.status === "quoted" || d.status === "in_progress").length,
      });
    }
    return result;
  },
});

export const saveLot = mutation({
  args: { userId: v.id("users"), lotId: v.optional(v.id("exportLots")), ...lotFields },
  handler: async (ctx, args) => {
    const { profile } = await requireExporter(ctx, args.userId);
    const required: [string, string][] = [
      [args.coffeeType, "Coffee type"],
      [args.grade, "Grade"],
      [args.processing, "Processing"],
      [args.cropYear, "Crop year"],
      [args.originDistrict, "Origin district"],
      [args.warehouseLocation, "Warehouse location"],
    ];
    for (const [value, label] of required) if (!value.trim()) throw new Error(`${label} is required`);
    if (!Number.isInteger(args.bags) || args.bags <= 0) throw new Error("Bags must be a whole number above 0");
    if (!(args.bagWeightKg > 0 && args.bagWeightKg <= 100)) throw new Error("Bag weight must be between 1 and 100 kg");
    if (!Number.isInteger(args.minOrderBags) || args.minOrderBags < 1 || args.minOrderBags > args.bags) {
      throw new Error("Minimum order must be between 1 bag and the lot size");
    }
    if (args.moisturePercent !== undefined && (args.moisturePercent < 0 || args.moisturePercent > 30)) throw new Error("Moisture looks wrong");
    if (args.cupScore !== undefined && (args.cupScore < 0 || args.cupScore > 100)) throw new Error("Cup score must be 0-100");
    if (args.incoterms.length === 0) throw new Error("Offer at least one Incoterm");
    const crop = args.crop ?? DEFAULT_EXPORT_CROP;
    if (!EXPORT_CROPS.some((c) => c.key === crop)) throw new Error("Choose a crop");
    if (!EXPORT_CROPS.some((c) => c.key === crop && c.active)) throw new Error("This crop is not open for export listings yet");
    const productForm = args.productForm ?? "green";
    if (!(PRODUCT_FORM_KEYS as string[]).includes(productForm)) throw new Error("Choose a product form");
    const allowedForms = profile.productForms?.length ? profile.productForms : ["green"];
    if (!allowedForms.includes(productForm)) {
      throw new Error("Add this product form to your exporter profile first, so the right documents are checked");
    }

    const fields = {
      crop,
      productForm,
      coffeeType: args.coffeeType.trim(),
      grade: args.grade.trim(),
      processing: args.processing.trim(),
      cropYear: args.cropYear.trim(),
      originDistrict: args.originDistrict.trim(),
      originRegion: args.originRegion?.trim() || undefined,
      bagWeightKg: args.bagWeightKg,
      minOrderBags: args.minOrderBags,
      moisturePercent: args.moisturePercent,
      defects: args.defects?.trim() || undefined,
      screenSize: args.screenSize?.trim() || undefined,
      cupScore: args.cupScore,
      certifications: args.certifications.map((c) => c.trim()).filter(Boolean).slice(0, 10),
      description: args.description?.trim().slice(0, 2000) || undefined,
      warehouseLocation: args.warehouseLocation.trim(),
      incoterms: [...new Set(args.incoterms)].slice(0, 10),
      sampleAvailable: args.sampleAvailable,
      updatedAt: getUgandaTime(),
    };

    if (args.lotId) {
      const lot = await requireOwnLot(ctx, args.userId, args.lotId);
      const reserved = lot.bags - lot.availableBags;
      if (args.bags < reserved) throw new Error(`${reserved} bags are already under contract; the lot cannot be smaller`);
      const availableBags = args.bags - reserved;
      await ctx.db.patch(lot._id, {
        ...fields,
        bags: args.bags,
        availableBags,
        status: lot.status === "sold_out" && availableBags > 0 ? "listed" : lot.status,
      });
      return { lotId: lot._id };
    }
    const lotCode = await uniqueCode(ctx, "EXL", async (c) => !!(await ctx.db.query("exportLots").withIndex("by_lotCode", (q) => q.eq("lotCode", c)).first()));
    const lotId = await ctx.db.insert("exportLots", {
      exporterId: args.userId,
      communityId: profile.communityId,
      lotCode,
      ...fields,
      bags: args.bags,
      availableBags: args.bags,
      photoStorageIds: [],
      status: "draft",
      traceLevel: "declared",
      eudrReady: false,
      traceStagesApproved: 0,
      traceStagesTotal: TRACE_STAGES.length,
      createdAt: getUgandaTime(),
    });
    await materializeStages(ctx, lotId);
    return { lotId };
  },
});

export const setLotPhotos = mutation({
  args: { userId: v.id("users"), lotId: v.id("exportLots"), photoStorageIds: v.array(v.id("_storage")) },
  handler: async (ctx, args) => {
    const lot = await requireOwnLot(ctx, args.userId, args.lotId);
    if (args.photoStorageIds.length > 8) throw new Error("A lot can have at most 8 photos");
    for (const old of lot.photoStorageIds) {
      if (!args.photoStorageIds.includes(old)) await ctx.storage.delete(old);
    }
    await ctx.db.patch(lot._id, { photoStorageIds: args.photoStorageIds, updatedAt: getUgandaTime() });
    return { success: true };
  },
});

export const setLotStatus = mutation({
  args: {
    userId: v.id("users"),
    lotId: v.id("exportLots"),
    status: v.union(v.literal("listed"), v.literal("withdrawn"), v.literal("draft")),
  },
  handler: async (ctx, args) => {
    const lot = await requireOwnLot(ctx, args.userId, args.lotId);
    if (args.status === "listed") {
      if (!(await isActiveExporter(ctx, args.userId, todayUganda()))) {
        throw new Error("Only a live exporter can list lots. Check your documents and verification fee.");
      }
      if (lot.availableBags <= 0) throw new Error("This lot has no bags left to sell");
    }
    await ctx.db.patch(lot._id, { status: args.status, updatedAt: getUgandaTime() });
    return { success: true };
  },
});

export const getMyLot = query({
  args: { userId: v.id("users"), lotId: v.id("exportLots") },
  handler: async (ctx, args) => {
    const lot = await requireOwnLot(ctx, args.userId, args.lotId);
    const sources = await ctx.db.query("exportLotSources").withIndex("by_lotId", (q) => q.eq("lotId", lot._id)).take(200);
    const sourceRows = [];
    for (const s of sources) {
      const plots = await plotsForSource(ctx, s);
      sourceRows.push({ source: s, plots });
    }
    const stages = await ctx.db.query("exportTraceStages").withIndex("by_lotId_and_order", (q) => q.eq("lotId", lot._id)).take(50);
    const stageRows = [];
    for (const st of stages) {
      const ev = await ctx.db.query("exportTraceEvidence").withIndex("by_stageId", (q) => q.eq("stageId", st._id)).order("desc").take(5);
      const evidence = [];
      for (const e of ev) {
        evidence.push({ ...e, photoUrls: await photoUrls(ctx, e.photos.map((p) => p.storageId)) });
      }
      stageRows.push({ stage: st, hint: TRACE_STAGES.find((t) => t.key === st.key)?.hint ?? "", evidence });
    }

    // What the exporter can link as platform sources.
    const inventory = await ctx.db.query("traderInventory").withIndex("by_trader", (q) => q.eq("traderId", args.userId)).order("desc").take(100);
    const linkableInventory = [];
    for (const inv of inventory) {
      const allocations = await ctx.db.query("exportLotSources").withIndex("by_inventoryId", (q) => q.eq("inventoryId", inv._id)).take(50);
      const allocated = allocations.reduce((a, s) => a + s.kilos, 0);
      if (inv.totalKilos - allocated > 0) {
        linkableInventory.push({ _id: inv._id, produceType: inv.produceType, totalKilos: inv.totalKilos, remainingKilos: inv.totalKilos - allocated, utid: inv.utid, status: inv.status });
      }
    }
    const commitments = await ctx.db
      .query("advancePurchaseCommitments")
      .withIndex("by_buyer", (q) => q.eq("buyerId", args.userId))
      .order("desc")
      .take(100);
    const linkableCommitments = [];
    for (const c of commitments) {
      if (c.status === "cancelled" || c.status === "expired") continue;
      const offer = await ctx.db.get(c.offerId);
      linkableCommitments.push({ _id: c._id, productName: offer?.productName ?? "", unit: offer?.unit ?? "", quantity: c.quantity, status: c.status, utid: c.utid });
    }

    return {
      lot,
      photoUrls: await photoUrls(ctx, lot.photoStorageIds),
      sources: sourceRows,
      stages: stageRows,
      linkableInventory,
      linkableCommitments,
    };
  },
});

export const addLotSource = mutation({
  args: {
    userId: v.id("users"),
    lotId: v.id("exportLots"),
    kind: v.union(v.literal("platform_purchase"), v.literal("advance_commitment"), v.literal("declared")),
    kilos: v.number(),
    inventoryId: v.optional(v.id("traderInventory")),
    commitmentId: v.optional(v.id("advancePurchaseCommitments")),
    farmerName: v.optional(v.string()),
    village: v.optional(v.string()),
    district: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    areaHa: v.optional(v.number()),
    polygonGeoJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const lot = await requireOwnLot(ctx, args.userId, args.lotId);
    if (!(args.kilos > 0)) throw new Error("Kilos must be above 0");
    const row: Omit<Doc<"exportLotSources">, "_id" | "_creationTime"> = {
      lotId: lot._id,
      kind: args.kind,
      kilos: Math.round(args.kilos),
      createdAt: getUgandaTime(),
    };
    if (args.kind === "platform_purchase") {
      if (!args.inventoryId) throw new Error("Choose an inventory block");
      const inv = await ctx.db.get(args.inventoryId);
      if (!inv || inv.traderId !== args.userId) throw new Error("Inventory block not found");
      const allocations = await ctx.db.query("exportLotSources").withIndex("by_inventoryId", (q) => q.eq("inventoryId", inv._id)).take(50);
      const allocated = allocations.reduce((a, s) => a + s.kilos, 0);
      if (allocated + row.kilos > inv.totalKilos) throw new Error(`Only ${inv.totalKilos - allocated} kg of this block is left to allocate`);
      row.inventoryId = inv._id;
    } else if (args.kind === "advance_commitment") {
      if (!args.commitmentId) throw new Error("Choose a commitment");
      const c = await ctx.db.get(args.commitmentId);
      if (!c || c.buyerId !== args.userId) throw new Error("Commitment not found");
      const existing = await ctx.db.query("exportLotSources").withIndex("by_commitmentId", (q) => q.eq("commitmentId", c._id)).first();
      if (existing) throw new Error("This commitment is already linked to a lot");
      row.commitmentId = c._id;
    } else {
      if (!args.farmerName?.trim() || !args.district?.trim()) throw new Error("Farmer or farm name and district are required");
      if (!validLat(args.lat) || !validLng(args.lng)) throw new Error("GPS coordinates are out of range");
      if ((args.lat === undefined) !== (args.lng === undefined)) throw new Error("Give both latitude and longitude");
      if (args.areaHa !== undefined && !(args.areaHa > 0 && args.areaHa < 100000)) throw new Error("Farm size looks wrong");
      if (args.polygonGeoJson?.trim()) {
        let geo: unknown;
        try {
          geo = JSON.parse(args.polygonGeoJson);
        } catch {
          throw new Error("The polygon is not valid GeoJSON");
        }
        const g = geo as { type?: string; geometry?: { type?: string } };
        const type = g.type === "Feature" ? g.geometry?.type : g.type;
        if (type !== "Polygon" && type !== "MultiPolygon") throw new Error("The GeoJSON must be a Polygon or MultiPolygon");
        if (args.polygonGeoJson.length > 200000) throw new Error("The polygon is too large");
        row.polygonGeoJson = args.polygonGeoJson.trim();
      }
      row.farmerName = args.farmerName.trim().slice(0, 120);
      row.village = args.village?.trim() || undefined;
      row.district = args.district.trim();
      row.lat = args.lat;
      row.lng = args.lng;
      row.areaHa = args.areaHa;
    }
    const sourceId = await ctx.db.insert("exportLotSources", row);
    await recomputeLotSummary(ctx, lot._id);
    return { sourceId };
  },
});

export const removeLotSource = mutation({
  args: { userId: v.id("users"), sourceId: v.id("exportLotSources") },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) throw new Error("Source not found");
    await requireOwnLot(ctx, args.userId, source.lotId);
    await ctx.db.delete(source._id);
    await recomputeLotSummary(ctx, source.lotId);
    return { success: true };
  },
});

// ------------------------------------------------------------------
// Trace map evidence
// ------------------------------------------------------------------

export const submitTraceEvidence = mutation({
  args: {
    userId: v.id("users"),
    lotId: v.id("exportLots"),
    stageKey: v.string(),
    photos: v.array(v.object({
      storageId: v.id("_storage"),
      lat: v.optional(v.number()),
      lng: v.optional(v.number()),
      accuracy: v.optional(v.number()),
      capturedAt: v.string(),
    })),
    weightInKg: v.optional(v.number()),
    weightOutKg: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const lot = await requireOwnLot(ctx, args.userId, args.lotId);
    const stages = await ctx.db.query("exportTraceStages").withIndex("by_lotId_and_order", (q) => q.eq("lotId", lot._id)).take(50);
    const stage = stages.find((s) => s.key === args.stageKey);
    if (!stage) throw new Error("Stage not found");
    if (stage.status === "approved") throw new Error("This stage is already verified");
    if (args.photos.length === 0 || args.photos.length > 6) throw new Error("Add between 1 and 6 photos");
    for (const w of [args.weightInKg, args.weightOutKg]) {
      if (w !== undefined && !(w >= 0 && w < 10_000_000)) throw new Error("Weights look wrong");
    }
    for (const p of args.photos) {
      if (!validLat(p.lat) || !validLng(p.lng)) throw new Error("Photo GPS is out of range");
    }
    // Older evidence still waiting for review is superseded.
    const pending = await ctx.db.query("exportTraceEvidence").withIndex("by_stageId", (q) => q.eq("stageId", stage._id)).take(20);
    for (const e of pending) if (e.status === "pending") await ctx.db.patch(e._id, { status: "rejected", reviewNotes: "Replaced by a newer submission" });

    await ctx.db.insert("exportTraceEvidence", {
      stageId: stage._id,
      lotId: lot._id,
      submittedBy: args.userId,
      photos: args.photos,
      weightInKg: args.weightInKg,
      weightOutKg: args.weightOutKg,
      notes: args.notes?.trim().slice(0, 1000) || undefined,
      status: "pending",
      submittedAt: getUgandaTime(),
    });
    await ctx.db.patch(stage._id, { status: "submitted", updatedAt: getUgandaTime() });
    return { success: true };
  },
});

export const listTraceEvidenceForReview = query({
  args: { adminId: v.id("users"), communityId: v.optional(v.id("communities")) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.adminId);
    const pending = await ctx.db.query("exportTraceEvidence").withIndex("by_status", (q) => q.eq("status", "pending")).take(200);
    const result = [];
    for (const e of pending) {
      const lot = await ctx.db.get(e.lotId);
      const stage = await ctx.db.get(e.stageId);
      if (!lot || !stage) continue;
      if (args.communityId && lot.communityId !== args.communityId) continue;
      if (!(await canReviewStage(ctx, admin, lot, stage))) continue;
      // Previous approved stage, to show the mass balance next to this one.
      const stages = await ctx.db.query("exportTraceStages").withIndex("by_lotId_and_order", (q) => q.eq("lotId", lot._id)).take(50);
      const prev = stages.filter((s) => s.order < stage.order && s.status === "approved").pop();
      let prevOut: number | undefined;
      if (prev) {
        const prevEv = await ctx.db.query("exportTraceEvidence").withIndex("by_stageId", (q) => q.eq("stageId", prev._id)).take(20);
        prevOut = prevEv.find((x) => x.status === "approved")?.weightOutKg;
      }
      const massBalanceWarning =
        prevOut !== undefined && e.weightInKg !== undefined && e.weightInKg > prevOut * (1 + MASS_BALANCE_TOLERANCE)
          ? `Weight in (${e.weightInKg} kg) is more than the previous stage's weight out (${prevOut} kg).`
          : e.weightInKg !== undefined && e.weightOutKg !== undefined && e.weightOutKg > e.weightInKg * (1 + MASS_BALANCE_TOLERANCE)
            ? `Weight out (${e.weightOutKg} kg) is more than weight in (${e.weightInKg} kg).`
            : null;
      const exporter = await ctx.db.get(lot.exporterId);
      result.push({
        evidence: e,
        photos: await Promise.all(
          e.photos.map(async (p) => ({ ...p, url: await ctx.storage.getUrl(p.storageId) }))
        ),
        lotCode: lot.lotCode,
        lotSummary: `${lot.coffeeType} ${lot.grade}, ${lot.bags} bags`,
        exporterAlias: exporter?.alias ?? "",
        stageName: stage.name,
        scope: stage.scope,
        massBalanceWarning,
      });
    }
    return result;
  },
});

export const reviewTraceEvidence = mutation({
  args: {
    adminId: v.id("users"),
    evidenceId: v.id("exportTraceEvidence"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.adminId);
    const e = await ctx.db.get(args.evidenceId);
    if (!e || e.status !== "pending") throw new Error("Nothing to review");
    const lot = await ctx.db.get(e.lotId);
    const stage = await ctx.db.get(e.stageId);
    if (!lot || !stage) throw new Error("Lot not found");
    if (!(await canReviewStage(ctx, admin, lot, stage))) throw new Error("Not authorized to verify this stage");
    const notes = args.notes?.trim() || undefined;
    if (args.decision === "reject" && !notes) throw new Error("Give a reason");
    const now = getUgandaTime();
    await ctx.db.patch(e._id, {
      status: args.decision === "approve" ? "approved" : "rejected",
      reviewedBy: admin._id,
      reviewedAt: now,
      reviewNotes: notes,
    });
    await ctx.db.patch(stage._id, { status: args.decision === "approve" ? "approved" : "rejected", updatedAt: now });
    await recomputeLotSummary(ctx, lot._id);
    await notify(
      ctx,
      lot.exporterId,
      args.decision === "approve" ? "Trace stage verified" : "Trace stage rejected",
      args.decision === "approve"
        ? `${stage.name} on lot ${lot.lotCode} was verified.`
        : `${stage.name} on lot ${lot.lotCode} was rejected: ${notes}`
    );
    await audit(ctx, `trace_${args.decision}`, admin._id, { targetUserId: lot.exporterId, targetId: String(e._id), note: notes });
    return { success: true };
  },
});

// ------------------------------------------------------------------
// Buyer catalogue (anonymous)
// ------------------------------------------------------------------

function publicLot(lot: Doc<"exportLots">) {
  return {
    _id: lot._id,
    lotCode: lot.lotCode,
    crop: lot.crop ?? DEFAULT_EXPORT_CROP,
    productForm: lot.productForm ?? "green",
    coffeeType: lot.coffeeType,
    grade: lot.grade,
    processing: lot.processing,
    cropYear: lot.cropYear,
    originDistrict: lot.originDistrict,
    originRegion: lot.originRegion,
    bags: lot.bags,
    availableBags: lot.availableBags,
    bagWeightKg: lot.bagWeightKg,
    minOrderBags: lot.minOrderBags,
    moisturePercent: lot.moisturePercent,
    defects: lot.defects,
    screenSize: lot.screenSize,
    cupScore: lot.cupScore,
    certifications: lot.certifications,
    description: lot.description,
    incoterms: lot.incoterms,
    sampleAvailable: lot.sampleAvailable,
    traceLevel: lot.traceLevel,
    eudrReady: lot.eudrReady,
    traceStagesApproved: lot.traceStagesApproved,
    traceStagesTotal: lot.traceStagesTotal,
    status: lot.status,
  };
}

export const listCatalogue = query({
  args: { today: v.string(), coffeeType: v.optional(v.string()), crop: v.optional(v.string()), productForm: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const today = isIsoDate(args.today) ? args.today : todayUganda();
    const lots = await ctx.db.query("exportLots").withIndex("by_status", (q) => q.eq("status", "listed")).order("desc").take(300);
    const live = new Map<string, boolean>();
    const stats = new Map<string, Awaited<ReturnType<typeof exporterPublicStats>>>();
    const result = [];
    for (const lot of lots) {
      if (args.coffeeType && lot.coffeeType !== args.coffeeType) continue;
      if (args.crop && (lot.crop ?? DEFAULT_EXPORT_CROP) !== args.crop) continue;
      if (args.productForm && (lot.productForm ?? "green") !== args.productForm) continue;
      if (lot.availableBags <= 0) continue;
      const key = String(lot.exporterId);
      if (!live.has(key)) live.set(key, await isActiveExporter(ctx, lot.exporterId, today));
      if (!live.get(key)) continue;
      if (!stats.has(key)) stats.set(key, await exporterPublicStats(ctx, lot.exporterId));
      result.push({
        ...publicLot(lot),
        coverUrl: lot.photoStorageIds[0] ? await ctx.storage.getUrl(lot.photoStorageIds[0]) : null,
        exporter: stats.get(key)!,
      });
    }
    return result;
  },
});

export const getCatalogueLot = query({
  args: { lotId: v.id("exportLots"), today: v.string() },
  handler: async (ctx, args) => {
    const today = isIsoDate(args.today) ? args.today : todayUganda();
    const lot = await ctx.db.get(args.lotId);
    if (!lot || lot.status !== "listed" || !(await isActiveExporter(ctx, lot.exporterId, today))) return null;
    const stages = await ctx.db.query("exportTraceStages").withIndex("by_lotId_and_order", (q) => q.eq("lotId", lot._id)).take(50);
    const trace = [];
    for (const st of stages) {
      let photos: { url: string | null; capturedAt: string }[] = [];
      if (st.status === "approved") {
        const ev = await ctx.db.query("exportTraceEvidence").withIndex("by_stageId", (q) => q.eq("stageId", st._id)).take(20);
        const approved = ev.find((e) => e.status === "approved");
        if (approved) {
          photos = await Promise.all(approved.photos.slice(0, 3).map(async (p) => ({ url: await ctx.storage.getUrl(p.storageId), capturedAt: p.capturedAt })));
        }
      }
      trace.push({ name: st.name, status: st.status === "approved" ? "verified" : "not verified yet", photos });
    }
    return {
      ...publicLot(lot),
      photoUrls: await photoUrls(ctx, lot.photoStorageIds),
      exporter: await exporterPublicStats(ctx, lot.exporterId),
      trace,
    };
  },
});

// ------------------------------------------------------------------
// Traceability report
// ------------------------------------------------------------------

export const getTraceabilityReport = query({
  args: { userId: v.id("users"), lotId: v.id("exportLots"), dealId: v.optional(v.id("exportDeals")) },
  handler: async (ctx, args) => {
    const viewer = await ctx.db.get(args.userId);
    const lot = await ctx.db.get(args.lotId);
    if (!viewer || !lot) return null;

    let deal: Doc<"exportDeals"> | null = null;
    if (args.dealId) {
      deal = await ctx.db.get(args.dealId);
      if (!deal || deal.lotId !== lot._id) return null;
    }
    // Who may read it: the exporter, admins over this exporter community,
    // and the buyer of a deal on this lot once identities are revealed.
    let allowed = lot.exporterId === viewer._id;
    if (!allowed && viewer.role === "admin") {
      const community = await ctx.db.get(lot.communityId);
      allowed = isSuperAdmin(viewer) || (!!community && adminManagesCommunity(viewer, community));
    }
    if (!allowed && deal && deal.buyerId === viewer._id) allowed = !!deal.disclosedAt;
    // Buyers get the report once the platform fees are paid.
    if (!allowed) return null;

    const exporter = await ctx.db.get(lot.exporterId);
    const profile = await ctx.db.query("exporterProfiles").withIndex("by_userId", (q) => q.eq("userId", lot.exporterId)).first();
    const sources = await ctx.db.query("exportLotSources").withIndex("by_lotId", (q) => q.eq("lotId", lot._id)).take(200);
    const plots: FarmPlot[] = [];
    for (const s of sources) plots.push(...(await plotsForSource(ctx, s)));
    const issues = plots.filter((p) => p.eudrIssue);

    const stages = await ctx.db.query("exportTraceStages").withIndex("by_lotId_and_order", (q) => q.eq("lotId", lot._id)).take(50);
    const stageRows = [];
    let prevOut: number | undefined;
    const massWarnings: string[] = [];
    for (const st of stages) {
      const ev = await ctx.db.query("exportTraceEvidence").withIndex("by_stageId", (q) => q.eq("stageId", st._id)).take(20);
      const approved = ev.find((e) => e.status === "approved") ?? null;
      if (approved?.weightInKg !== undefined && prevOut !== undefined && approved.weightInKg > prevOut * (1 + MASS_BALANCE_TOLERANCE)) {
        massWarnings.push(`${st.name}: weight in ${approved.weightInKg} kg exceeds the previous stage's ${prevOut} kg out.`);
      }
      if (approved?.weightOutKg !== undefined) prevOut = approved.weightOutKg;
      stageRows.push({
        name: st.name,
        scope: st.scope,
        verified: st.status === "approved",
        verifiedAt: approved?.reviewedAt ?? null,
        weightInKg: approved?.weightInKg,
        weightOutKg: approved?.weightOutKg,
        notes: approved?.notes,
        photos: approved
          ? await Promise.all(approved.photos.map(async (p) => ({ url: await ctx.storage.getUrl(p.storageId), lat: p.lat, lng: p.lng, capturedAt: p.capturedAt })))
          : [],
      });
    }

    let shipment = null;
    if (deal && (viewer._id === deal.buyerId || viewer._id === deal.exporterId || viewer.role === "admin")) {
      const docs = await ctx.db.query("exportDealDocuments").withIndex("by_dealId", (q) => q.eq("dealId", deal._id)).take(200);
      const stuffing = docs.filter((d) => d.stepKey === "stuffing" && d.status === "accepted");
      shipment = {
        dealCode: deal.dealCode,
        containerNumber: deal.containerNumber,
        sealNumber: deal.sealNumber,
        vessel: deal.vessel,
        blNumber: deal.blNumber,
        bags: deal.contract?.bags ?? deal.bags,
        incoterm: deal.contract?.incoterm ?? deal.incoterm,
        port: deal.contract?.port,
        stuffingPhotos: await Promise.all(stuffing.map(async (d) => ({ url: await ctx.storage.getUrl(d.storageId), lat: d.lat, lng: d.lng, capturedAt: d.capturedAt }))),
      };
    }

    const totalKg = plots.reduce((a, p) => a + p.kilos, 0);
    return {
      lot: publicLot(lot),
      exporter: {
        alias: exporter?.alias ?? "",
        legalName: profile?.legalName ?? null,
        licenceNumber: profile?.exporterLicenceNumber ?? null,
        address: profile?.physicalAddress ?? null,
      },
      plots: plots.map(({ farmerId: _f, ...p }) => p),
      totalSourcedKg: totalKg,
      eudr: {
        compliant: plots.length > 0 && issues.length === 0,
        reasons:
          plots.length === 0
            ? ["No source farms are recorded for this lot."]
            : issues.map((p) => `${p.label}${p.district ? ` (${p.district})` : ""}: ${p.eudrIssue}`),
      },
      stages: stageRows,
      massBalanceWarnings: massWarnings,
      shipment,
    };
  },
});
