/**
 * Processors - intake and processing.
 *
 * Intake: coffee a processor buys from a farmer. A farmer on the app is linked
 * to their account and asked to confirm; a farmer who is not on the app is
 * recorded as declared, with the farm location (and a boundary for plots over
 * 4 ha, as EUDR asks). Photos come from the camera or the gallery (Rule 9).
 *
 * Processing: intake kilos go into a batch; weight in and weight out give the
 * outturn. The Storage Officer reviews intake and batch evidence. Approved
 * evidence raises declared produce to "declared + evidenced"; it is added on
 * top of the declared level, never replacing it.
 */

import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import { EUDR_POLYGON_THRESHOLD_HA, EXPORT_CROPS, MASS_BALANCE_TOLERANCE, isIsoDate } from "./exportMarketsShared";
import { BATCH_OUTPUT_FORM_KEYS, CAPABILITY_KEYS, INTAKE_FORM_KEYS, outturnPercent, traceLevelFromIntakes } from "./processorShared";
import { assertEvidencePhotos, evidencePhotoValidator, hasManualPhoto } from "./evidencePhotos";
import { audit, notify, todayUganda } from "./exportMarkets";
import { issueReceipt } from "./marketOffers";
import { recomputeLotSummary, uniqueCode } from "./exportLots";
import { getProcessorProfile, processorCommunities, requireProcessorUser, requireStorageOfficer } from "./processors";

type Ctx = QueryCtx | MutationCtx;

async function requireAdmittedProcessor(ctx: Ctx, userId: Id<"users">) {
  const user = await requireProcessorUser(ctx, userId);
  if ((await processorCommunities(ctx, userId)).length === 0) {
    throw new Error("A community admin must accept you as a processor first");
  }
  return user;
}

function validCoords(lat: number | undefined, lng: number | undefined) {
  if ((lat === undefined) !== (lng === undefined)) throw new Error("Give both latitude and longitude");
  if (lat !== undefined && !(Math.abs(lat) <= 90 && Math.abs(lng!) <= 180)) throw new Error("GPS coordinates are out of range");
}

function validPolygon(geojson: string | undefined): string | undefined {
  if (!geojson?.trim()) return undefined;
  let geo: unknown;
  try {
    geo = JSON.parse(geojson);
  } catch {
    throw new Error("The polygon is not valid GeoJSON");
  }
  const g = geo as { type?: string; geometry?: { type?: string } };
  const type = g.type === "Feature" ? g.geometry?.type : g.type;
  if (type !== "Polygon" && type !== "MultiPolygon") throw new Error("The GeoJSON must be a Polygon or MultiPolygon");
  if (geojson.length > 200000) throw new Error("The polygon is too large");
  return geojson.trim();
}

async function photosWithUrls(ctx: Ctx, photos: Doc<"processorIntakes">["photos"]) {
  return await Promise.all(photos.map(async (p) => ({ ...p, url: await ctx.storage.getUrl(p.storageId) })));
}

/** Intakes behind a batch, with the kilos each put in. */
export async function batchIntakes(ctx: Ctx, batchId: Id<"processingBatches">) {
  const inputs = await ctx.db.query("processingBatchInputs").withIndex("by_batchId", (q) => q.eq("batchId", batchId)).take(200);
  const rows: { intake: Doc<"processorIntakes">; kilos: number }[] = [];
  for (const i of inputs) {
    const intake = await ctx.db.get(i.intakeId);
    if (intake) rows.push({ intake, kilos: i.kilos });
  }
  return rows;
}

async function recomputeBatchTraceLevel(ctx: MutationCtx, batchId: Id<"processingBatches">) {
  const rows = await batchIntakes(ctx, batchId);
  await ctx.db.patch(batchId, { traceLevel: traceLevelFromIntakes(rows.map((r) => r.intake)), updatedAt: getUgandaTime() });
}

/** Keep the export trace stages that mirror this batch in step with its evidence. */
export async function syncBatchTraceStages(ctx: MutationCtx, batch: Doc<"processingBatches">) {
  const status =
    batch.evidenceStatus === "approved" ? "approved" : batch.evidenceStatus === "pending" ? "submitted" : batch.evidenceStatus === "rejected" ? "rejected" : "pending";
  const stages = await ctx.db
    .query("exportTraceStages")
    .withIndex("by_processingBatchId", (q) => q.eq("processingBatchId", batch._id))
    .take(100);
  const lots = new Set<Id<"exportLots">>();
  for (const s of stages) {
    if (s.status !== status) await ctx.db.patch(s._id, { status, updatedAt: getUgandaTime() });
    lots.add(s.lotId);
  }
  // Lots built from this batch pick up its new trace level and stage progress.
  for (const lotId of lots) await recomputeLotSummary(ctx, lotId);
  return [...lots];
}

// ------------------------------------------------------------------
// Intake
// ------------------------------------------------------------------

/** Farmers on the app, found by exact phone number or alias. Shows alias and district only. */
export const findFarmerForIntake = query({
  args: { userId: v.id("users"), search: v.string() },
  handler: async (ctx, args) => {
    await requireProcessorUser(ctx, args.userId);
    const term = args.search.trim();
    if (term.length < 3) return [];
    const digits = term.replace(/\D/g, "");
    const found = new Map<string, Doc<"users">>();
    if (digits.length >= 9) {
      const tail = digits.slice(-9);
      for (const phone of [`+256${tail}`, `0${tail}`, `256${tail}`, term]) {
        const u = await ctx.db.query("users").withIndex("by_phone", (q) => q.eq("phoneNumber", phone)).first();
        if (u) found.set(String(u._id), u);
      }
    }
    const byAlias = await ctx.db.query("users").withIndex("by_alias", (q) => q.eq("alias", term)).first();
    if (byAlias) found.set(String(byAlias._id), byAlias);
    return [...found.values()]
      .filter((u) => u.role === "farmer" && u.state === "active")
      .map((u) => ({ userId: u._id, alias: u.alias, district: u.districtText ?? null, hasGps: u.gpsLat !== undefined && u.gpsLng !== undefined }));
  },
});

const intakeFields = {
  crop: v.string(),
  inputForm: v.string(),
  kilos: v.number(),
  pricePerKgUgx: v.optional(v.number()),
  intakeDate: v.string(),
  sourceKind: v.union(v.literal("platform_farmer"), v.literal("declared")),
  farmerId: v.optional(v.id("users")),
  farmerName: v.optional(v.string()),
  farmerPhone: v.optional(v.string()),
  village: v.optional(v.string()),
  district: v.optional(v.string()),
  lat: v.optional(v.number()),
  lng: v.optional(v.number()),
  areaHa: v.optional(v.number()),
  polygonGeoJson: v.optional(v.string()),
  photos: v.array(evidencePhotoValidator),
  notes: v.optional(v.string()),
  // A farmer's delivery booking this intake fulfils, and whether the farmer
  // was paid in cash now (which issues the receipt).
  bookingId: v.optional(v.id("deliveryBookings")),
  paidCash: v.optional(v.boolean()),
};

export const recordIntake = mutation({
  args: { userId: v.id("users"), ...intakeFields },
  handler: async (ctx, args) => {
    const user = await requireAdmittedProcessor(ctx, args.userId);
    if (args.bookingId) {
      const booking = await ctx.db.get(args.bookingId);
      if (!booking || booking.buyerId !== user._id) throw new Error("Booking not found");
      if (args.sourceKind !== "platform_farmer" || args.farmerId !== booking.farmerId) throw new Error("A booked delivery comes from the farmer who booked it");
    }
    if (args.paidCash && args.pricePerKgUgx === undefined) throw new Error("Enter the price paid per kg to issue a receipt");
    if (!EXPORT_CROPS.some((c) => c.key === args.crop && c.active)) throw new Error("This crop is not open yet");
    if (!INTAKE_FORM_KEYS.includes(args.inputForm)) throw new Error("Choose what the farmer delivered");
    if (!(args.kilos > 0 && args.kilos < 10_000_000)) throw new Error("Kilos must be above 0");
    if (args.pricePerKgUgx !== undefined && !(args.pricePerKgUgx >= 0 && args.pricePerKgUgx < 10_000_000)) throw new Error("Price looks wrong");
    if (!isIsoDate(args.intakeDate) || args.intakeDate > todayUganda()) throw new Error("Choose the intake date (not in the future)");
    assertEvidencePhotos(args.photos, 6, 0);
    validCoords(args.lat, args.lng);

    const intakeCode = await uniqueCode(ctx, "INT", async (c) => !!(await ctx.db.query("processorIntakes").withIndex("by_intakeCode", (q) => q.eq("intakeCode", c)).first()));
    const base = {
      processorId: user._id,
      intakeCode,
      crop: args.crop,
      inputForm: args.inputForm,
      kilos: Math.round(args.kilos * 10) / 10,
      pricePerKgUgx: args.pricePerKgUgx,
      intakeDate: args.intakeDate,
      photos: args.photos,
      evidenceStatus: args.photos.length > 0 ? ("pending" as const) : ("none" as const),
      allocatedKilos: 0,
      notes: args.notes?.trim().slice(0, 1000) || undefined,
      createdAt: getUgandaTime(),
    };
    let intakeId: Id<"processorIntakes">;
    if (args.sourceKind === "platform_farmer") {
      if (!args.farmerId) throw new Error("Choose the farmer");
      const farmer = await ctx.db.get(args.farmerId);
      if (!farmer || farmer.role !== "farmer") throw new Error("Farmer not found");
      intakeId = await ctx.db.insert("processorIntakes", { ...base, sourceKind: "platform_farmer", farmerId: farmer._id, farmerConfirmation: "pending" });
      const profile = await getProcessorProfile(ctx, user._id);
      await notify(
        ctx,
        farmer._id,
        "Confirm your delivery to a processor",
        `${profile?.facilityName ?? `Processor ${user.alias}`} recorded ${base.kilos} kg of ${args.crop} from you on ${args.intakeDate} (${intakeCode}). Open your dashboard to confirm it.`
      );
    } else {
      if (!args.farmerName?.trim() || !args.district?.trim()) throw new Error("Farmer name and district are required");
      if (args.areaHa !== undefined && !(args.areaHa > 0 && args.areaHa < 100000)) throw new Error("Farm size looks wrong");
      intakeId = await ctx.db.insert("processorIntakes", {
        ...base,
        sourceKind: "declared",
        farmerName: args.farmerName.trim().slice(0, 120),
        farmerPhone: args.farmerPhone?.trim() || undefined,
        village: args.village?.trim() || undefined,
        district: args.district.trim(),
        lat: args.lat,
        lng: args.lng,
        areaHa: args.areaHa,
        polygonGeoJson: validPolygon(args.polygonGeoJson),
      });
    }
    // Cash paid now: the processor side issues the farmer's receipt.
    let receiptNumber: string | null = null;
    if (args.paidCash) {
      const farmer = args.farmerId ? await ctx.db.get(args.farmerId) : null;
      ({ receiptNumber } = await issueReceipt(ctx, {
        buyer: user,
        farmerId: args.sourceKind === "platform_farmer" ? args.farmerId : undefined,
        farmerName: args.sourceKind === "platform_farmer" ? `Farmer ${farmer?.alias ?? ""}`.trim() : args.farmerName!.trim(),
        crop: args.crop,
        form: args.inputForm,
        unit: "kg",
        quantity: base.kilos,
        priceUgx: args.pricePerKgUgx!,
        paidOn: args.intakeDate,
        bookingId: args.bookingId,
        intakeId,
      }));
    } else if (args.bookingId) {
      await ctx.db.patch(args.bookingId, { status: "completed", respondedAt: getUgandaTime() });
    }
    return { intakeId, intakeCode, receiptNumber };
  },
});

/** Add or replace intake photos later (for example after the farmer left). */
export const setIntakePhotos = mutation({
  args: { userId: v.id("users"), intakeId: v.id("processorIntakes"), photos: v.array(evidencePhotoValidator) },
  handler: async (ctx, args) => {
    const intake = await ctx.db.get(args.intakeId);
    if (!intake || intake.processorId !== args.userId) throw new Error("Intake not found");
    if (intake.evidenceStatus === "approved") throw new Error("This intake's evidence is already approved");
    assertEvidencePhotos(args.photos, 6, 1);
    await ctx.db.patch(intake._id, { photos: args.photos, evidenceStatus: "pending", reviewNotes: undefined });
    return { success: true };
  },
});

export const listMyIntakes = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireProcessorUser(ctx, args.userId);
    const intakes = await ctx.db.query("processorIntakes").withIndex("by_processorId", (q) => q.eq("processorId", args.userId)).order("desc").take(300);
    const rows = [];
    for (const i of intakes) {
      const farmer = i.farmerId ? await ctx.db.get(i.farmerId) : null;
      rows.push({
        ...i,
        farmerLabel: i.sourceKind === "platform_farmer" ? `Farmer ${farmer?.alias ?? ""}`.trim() : i.farmerName ?? "Declared farmer",
        remainingKilos: Math.round((i.kilos - i.allocatedKilos) * 10) / 10,
        photoRows: await photosWithUrls(ctx, i.photos),
        eudrIssue:
          i.sourceKind === "declared"
            ? i.lat === undefined
              ? "no farm GPS location"
              : i.areaHa !== undefined && i.areaHa > EUDR_POLYGON_THRESHOLD_HA && !i.polygonGeoJson
                ? `farm over ${EUDR_POLYGON_THRESHOLD_HA} ha without a boundary`
                : null
            : farmer && (farmer.gpsLat === undefined || farmer.gpsLng === undefined)
              ? "farmer has no farm GPS location on the app"
              : null,
      });
    }
    return rows;
  },
});

// ------------------------------------------------------------------
// Farmer confirmation
// ------------------------------------------------------------------

export const listMyProcessorDeliveries = query({
  args: { farmerId: v.id("users") },
  handler: async (ctx, args) => {
    const farmer = await ctx.db.get(args.farmerId);
    if (!farmer || farmer.role !== "farmer") return [];
    const intakes = await ctx.db.query("processorIntakes").withIndex("by_farmerId", (q) => q.eq("farmerId", args.farmerId)).order("desc").take(50);
    const rows = [];
    for (const i of intakes) {
      const profile = await getProcessorProfile(ctx, i.processorId);
      rows.push({
        _id: i._id,
        intakeCode: i.intakeCode,
        crop: i.crop,
        inputForm: i.inputForm,
        kilos: i.kilos,
        pricePerKgUgx: i.pricePerKgUgx ?? null,
        intakeDate: i.intakeDate,
        facilityName: profile?.facilityName ?? "Processor",
        district: profile?.district ?? null,
        farmerConfirmation: i.farmerConfirmation ?? null,
      });
    }
    return rows;
  },
});

export const respondToIntake = mutation({
  args: { farmerId: v.id("users"), intakeId: v.id("processorIntakes"), decision: v.union(v.literal("confirmed"), v.literal("disputed")) },
  handler: async (ctx, args) => {
    const intake = await ctx.db.get(args.intakeId);
    if (!intake || intake.farmerId !== args.farmerId) throw new Error("Delivery not found");
    if (intake.farmerConfirmation !== "pending") throw new Error("You already answered this");
    await ctx.db.patch(intake._id, { farmerConfirmation: args.decision });
    await notify(
      ctx,
      intake.processorId,
      args.decision === "confirmed" ? "Farmer confirmed a delivery" : "Farmer disputed a delivery",
      `Intake ${intake.intakeCode} (${intake.kilos} kg) was ${args.decision} by the farmer.`
    );
    return { success: true };
  },
});

// ------------------------------------------------------------------
// Processing batches
// ------------------------------------------------------------------

export const createBatch = mutation({
  args: {
    userId: v.id("users"),
    crop: v.string(),
    outputForm: v.string(),
    coffeeType: v.optional(v.string()),
    processingMethod: v.optional(v.string()),
    steps: v.array(v.string()),
    inputs: v.array(v.object({ intakeId: v.id("processorIntakes"), kilos: v.number() })),
    startedDate: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmittedProcessor(ctx, args.userId);
    if (!EXPORT_CROPS.some((c) => c.key === args.crop && c.active)) throw new Error("This crop is not open yet");
    if (!BATCH_OUTPUT_FORM_KEYS.includes(args.outputForm)) throw new Error("Choose what the batch produces");
    const steps = [...new Set(args.steps)].filter((s) => CAPABILITY_KEYS.includes(s));
    if (steps.length === 0) throw new Error("Choose at least one processing step");
    if (args.inputs.length === 0 || args.inputs.length > 200) throw new Error("Add between 1 and 200 intakes");
    if (!isIsoDate(args.startedDate) || args.startedDate > todayUganda()) throw new Error("Choose the start date (not in the future)");
    let weightIn = 0;
    const seen = new Set<string>();
    const checked: { intake: Doc<"processorIntakes">; kilos: number }[] = [];
    for (const input of args.inputs) {
      if (seen.has(String(input.intakeId))) throw new Error("Each intake can appear once in a batch");
      seen.add(String(input.intakeId));
      const intake = await ctx.db.get(input.intakeId);
      if (!intake || intake.processorId !== user._id) throw new Error("Intake not found");
      if (intake.crop !== args.crop) throw new Error(`Intake ${intake.intakeCode} is a different crop`);
      if (intake.farmerConfirmation === "disputed") throw new Error(`Intake ${intake.intakeCode} was disputed by the farmer`);
      const left = intake.kilos - intake.allocatedKilos;
      if (!(input.kilos > 0) || input.kilos > left + 1e-6) throw new Error(`Only ${Math.round(left * 10) / 10} kg of ${intake.intakeCode} is left`);
      weightIn += input.kilos;
      checked.push({ intake, kilos: input.kilos });
    }
    const batchCode = await uniqueCode(ctx, "PRB", async (c) => !!(await ctx.db.query("processingBatches").withIndex("by_batchCode", (q) => q.eq("batchCode", c)).first()));
    const now = getUgandaTime();
    const batchId = await ctx.db.insert("processingBatches", {
      processorId: user._id,
      batchCode,
      crop: args.crop,
      outputForm: args.outputForm,
      coffeeType: args.coffeeType?.trim() || undefined,
      processingMethod: args.processingMethod?.trim() || undefined,
      steps,
      weightInKg: Math.round(weightIn * 10) / 10,
      startedDate: args.startedDate,
      status: "in_progress",
      photos: [],
      evidenceStatus: "none",
      traceLevel: traceLevelFromIntakes(checked.map((c) => c.intake)),
      soldKg: 0,
      notes: args.notes?.trim().slice(0, 1000) || undefined,
      createdAt: now,
      updatedAt: now,
    });
    for (const c of checked) {
      await ctx.db.insert("processingBatchInputs", { batchId, intakeId: c.intake._id, kilos: c.kilos });
      await ctx.db.patch(c.intake._id, { allocatedKilos: Math.round((c.intake.allocatedKilos + c.kilos) * 10) / 10 });
    }
    return { batchId, batchCode };
  },
});

/** Record the output: weight out (the outturn follows), grade and proof photos. */
export const completeBatch = mutation({
  args: {
    userId: v.id("users"),
    batchId: v.id("processingBatches"),
    weightOutKg: v.number(),
    completedDate: v.string(),
    grade: v.optional(v.string()),
    moisturePercent: v.optional(v.number()),
    photos: v.array(evidencePhotoValidator),
  },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.processorId !== args.userId) throw new Error("Batch not found");
    if (batch.evidenceStatus === "approved") throw new Error("This batch is already verified");
    if (!(args.weightOutKg > 0)) throw new Error("Weight out must be above 0");
    if (args.weightOutKg > batch.weightInKg * (1 + MASS_BALANCE_TOLERANCE)) {
      throw new Error(`Weight out (${args.weightOutKg} kg) cannot be more than weight in (${batch.weightInKg} kg)`);
    }
    if (args.weightOutKg < batch.soldKg) throw new Error(`${batch.soldKg} kg of this batch is already sold`);
    if (!isIsoDate(args.completedDate) || args.completedDate < batch.startedDate || args.completedDate > todayUganda()) {
      throw new Error("The completion date must be between the start date and today");
    }
    if (args.moisturePercent !== undefined && !(args.moisturePercent >= 0 && args.moisturePercent <= 30)) throw new Error("Moisture looks wrong");
    assertEvidencePhotos(args.photos, 6, 1);
    const updated = {
      weightOutKg: Math.round(args.weightOutKg * 10) / 10,
      completedDate: args.completedDate,
      grade: args.grade?.trim() || batch.grade,
      moisturePercent: args.moisturePercent,
      photos: args.photos,
      status: "completed" as const,
      evidenceStatus: "pending" as const,
      reviewNotes: undefined,
      updatedAt: getUgandaTime(),
    };
    await ctx.db.patch(batch._id, updated);
    await syncBatchTraceStages(ctx, { ...batch, ...updated });
    return { success: true, outturnPercent: outturnPercent(batch.weightInKg, updated.weightOutKg) };
  },
});

export const listMyBatches = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireProcessorUser(ctx, args.userId);
    const batches = await ctx.db.query("processingBatches").withIndex("by_processorId", (q) => q.eq("processorId", args.userId)).order("desc").take(200);
    const rows = [];
    for (const b of batches) {
      const inputs = await batchIntakes(ctx, b._id);
      rows.push({
        ...b,
        outturnPercent: outturnPercent(b.weightInKg, b.weightOutKg),
        inputs: inputs.map((i) => ({ intakeCode: i.intake.intakeCode, kilos: i.kilos, sourceKind: i.intake.sourceKind })),
        photoRows: await photosWithUrls(ctx, b.photos),
      });
    }
    return rows;
  },
});

// ------------------------------------------------------------------
// Storage Officer: evidence review
// ------------------------------------------------------------------

export const listOperationsEvidenceForReview = query({
  args: { adminId: v.id("users"), processorId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    await requireStorageOfficer(ctx, args.adminId);
    const intakes = (await ctx.db.query("processorIntakes").withIndex("by_evidenceStatus", (q) => q.eq("evidenceStatus", "pending")).take(200)).filter(
      (i) => !args.processorId || i.processorId === args.processorId
    );
    const batches = (await ctx.db.query("processingBatches").withIndex("by_evidenceStatus", (q) => q.eq("evidenceStatus", "pending")).take(200)).filter(
      (b) => !args.processorId || b.processorId === args.processorId
    );
    const facility = new Map<string, string>();
    const facilityOf = async (id: Id<"users">) => {
      if (!facility.has(String(id))) {
        const p = await getProcessorProfile(ctx, id);
        facility.set(String(id), p ? `${p.facilityName}, ${p.district}` : "Processor");
      }
      return facility.get(String(id))!;
    };
    const intakeRows = [];
    for (const i of intakes) {
      const farmer = i.farmerId ? await ctx.db.get(i.farmerId) : null;
      intakeRows.push({
        intake: i,
        facility: await facilityOf(i.processorId),
        farmerLabel: i.sourceKind === "platform_farmer" ? `Farmer ${farmer?.alias ?? ""} (on the app)` : `${i.farmerName ?? "Declared farmer"} (not on the app)`,
        photos: await photosWithUrls(ctx, i.photos),
        manualPhotos: hasManualPhoto(i.photos),
      });
    }
    const batchRows = [];
    for (const b of batches) {
      batchRows.push({
        batch: b,
        facility: await facilityOf(b.processorId),
        outturnPercent: outturnPercent(b.weightInKg, b.weightOutKg),
        photos: await photosWithUrls(ctx, b.photos),
        manualPhotos: hasManualPhoto(b.photos),
        massBalanceWarning:
          b.weightOutKg !== undefined && b.weightOutKg > b.weightInKg * (1 + MASS_BALANCE_TOLERANCE)
            ? `Weight out (${b.weightOutKg} kg) is more than weight in (${b.weightInKg} kg).`
            : null,
      });
    }
    return { intakes: intakeRows, batches: batchRows };
  },
});

export const reviewIntakeEvidence = mutation({
  args: { adminId: v.id("users"), intakeId: v.id("processorIntakes"), decision: v.union(v.literal("approve"), v.literal("reject")), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireStorageOfficer(ctx, args.adminId);
    const intake = await ctx.db.get(args.intakeId);
    if (!intake || intake.evidenceStatus !== "pending") throw new Error("Nothing to review");
    const notes = args.notes?.trim() || undefined;
    if (args.decision === "reject" && !notes) throw new Error("Give a reason");
    await ctx.db.patch(intake._id, {
      evidenceStatus: args.decision === "approve" ? "approved" : "rejected",
      reviewedBy: admin._id,
      reviewedAt: getUgandaTime(),
      reviewNotes: notes,
    });
    // Batches using this intake may move between "declared" and "declared + evidenced".
    const inputs = await ctx.db.query("processingBatchInputs").withIndex("by_intakeId", (q) => q.eq("intakeId", intake._id)).take(100);
    const lots = new Set<string>();
    for (const i of inputs) {
      await recomputeBatchTraceLevel(ctx, i.batchId);
      const b = await ctx.db.get(i.batchId);
      if (b) for (const lotId of await syncBatchTraceStages(ctx, b)) lots.add(String(lotId));
    }
    await notify(
      ctx,
      intake.processorId,
      args.decision === "approve" ? "Intake evidence approved" : "Intake evidence rejected",
      args.decision === "approve" ? `Intake ${intake.intakeCode} was approved.` : `Intake ${intake.intakeCode} was rejected: ${notes}`
    );
    await audit(ctx, `intake_${args.decision}`, admin._id, { targetUserId: intake.processorId, targetId: String(intake._id), note: notes });
    return { success: true, lotIds: [...lots] as Id<"exportLots">[] };
  },
});

export const reviewBatchEvidence = mutation({
  args: { adminId: v.id("users"), batchId: v.id("processingBatches"), decision: v.union(v.literal("approve"), v.literal("reject")), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireStorageOfficer(ctx, args.adminId);
    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.evidenceStatus !== "pending") throw new Error("Nothing to review");
    const notes = args.notes?.trim() || undefined;
    if (args.decision === "reject" && !notes) throw new Error("Give a reason");
    const updated = { evidenceStatus: args.decision === "approve" ? ("approved" as const) : ("rejected" as const), reviewedBy: admin._id, reviewedAt: getUgandaTime(), reviewNotes: notes };
    await ctx.db.patch(batch._id, updated);
    await syncBatchTraceStages(ctx, { ...batch, ...updated });
    await notify(
      ctx,
      batch.processorId,
      args.decision === "approve" ? "Processing batch verified" : "Processing batch rejected",
      args.decision === "approve" ? `Batch ${batch.batchCode} was verified.` : `Batch ${batch.batchCode} was rejected: ${notes}`
    );
    await audit(ctx, `batch_${args.decision}`, admin._id, { targetUserId: batch.processorId, targetId: String(batch._id), note: notes });
    return { success: true };
  },
});
