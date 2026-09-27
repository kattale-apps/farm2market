/**
 * Processors - selling processed produce to exporters.
 *
 * The default market stays exporters selling to buyers. Everything between a
 * processor and an exporter is optional, and none of it needs an open listing:
 *   - direct: the processor offers a batch to one exporter, who accepts;
 *   - exporter_logged: the exporter records a purchase by batch code and the
 *     processor confirms it;
 *   - off_app: the processor logs a sale made outside the app; an exporter on
 *     the app can later claim it with the sale code to link it to a lot;
 *   - market: PROCESSED MARKETS, an opt-in listing that only verified
 *     exporters see; an exporter requests and the processor accepts.
 * A completed sale can be linked to an export lot as a "bought from a
 * processor" source, carrying the trace back to the farms.
 *
 * The processor success fee is 0 until a super admin sets it.
 */

import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import { isIsoDate } from "./exportMarketsShared";
import { outturnPercent, processorSuccessFeeUgx } from "./processorShared";
import { assertEvidencePhotos, evidencePhotoValidator } from "./evidencePhotos";
import { audit, chargeExportFee, exporterReadiness, getFeeSettings, isActiveExporter, notify, todayUganda } from "./exportMarkets";
import { uniqueCode } from "./exportLots";
import { getProcessorProfile, isActiveProcessor, processorCommunities, processorPublic, requireProcessorUser } from "./processors";

type Ctx = QueryCtx | MutationCtx;

/** Kilos of a batch taken by sales that are not declined or cancelled. */
export async function committedKg(ctx: Ctx, batchId: Id<"processingBatches">, exceptSaleId?: Id<"processorSales">) {
  const sales = await ctx.db.query("processorSales").withIndex("by_batchId", (q) => q.eq("batchId", batchId)).take(500);
  return sales.filter((s) => s._id !== exceptSaleId && s.status !== "declined" && s.status !== "cancelled").reduce((a, s) => a + s.kilos, 0);
}

async function availableKg(ctx: Ctx, batch: Doc<"processingBatches">, exceptSaleId?: Id<"processorSales">) {
  if (batch.status !== "completed" || batch.weightOutKg === undefined) return 0;
  return Math.max(0, Math.round((batch.weightOutKg - (await committedKg(ctx, batch._id, exceptSaleId))) * 10) / 10);
}

async function requireExporterAccount(ctx: Ctx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "trader") throw new Error("Only exporter accounts can do this");
  const r = await exporterReadiness(ctx, user, todayUganda());
  if (!r.checks.admittedAsExporter) throw new Error("An exporter community admin must accept you first");
  return user;
}

async function newSaleCode(ctx: MutationCtx) {
  return await uniqueCode(ctx, "PSL", async (c) => !!(await ctx.db.query("processorSales").withIndex("by_saleCode", (q) => q.eq("saleCode", c)).first()));
}

function checkSaleInput(kilos: number, price: number | undefined, saleDate: string) {
  if (!(kilos > 0 && kilos < 10_000_000)) throw new Error("Kilos must be above 0");
  if (price !== undefined && !(price >= 0 && price < 10_000_000)) throw new Error("Price looks wrong");
  if (!isIsoDate(saleDate) || saleDate > todayUganda()) throw new Error("Choose the sale date (not in the future)");
}

/** Complete a sale: mark kilos sold and charge the processor success fee (0 unless set). */
async function completeSale(ctx: MutationCtx, sale: Doc<"processorSales">, charge: boolean) {
  const batch = await ctx.db.get(sale.batchId);
  if (!batch) throw new Error("Batch not found");
  let fee = 0;
  let utid: string | null = null;
  if (charge) {
    const fees = await getFeeSettings(ctx);
    fee = processorSuccessFeeUgx(sale.kilos * (sale.pricePerKgUgx ?? 0), fees.processorSuccessFeePercent);
    if (fee > 0) {
      ({ utid } = await chargeExportFee(ctx, {
        userId: sale.processorId,
        role: "store",
        amountUgx: fee,
        kind: "success",
        note: `Processor sale ${sale.saleCode}`,
        metadata: { payer: "processor", saleId: String(sale._id) },
      }));
    }
  }
  await ctx.db.patch(sale._id, {
    status: "completed",
    respondedAt: getUgandaTime(),
    successFeeUgx: fee > 0 ? fee : undefined,
    successFeeUtid: utid ?? undefined,
  });
  await ctx.db.patch(batch._id, { soldKg: Math.round((batch.soldKg + sale.kilos) * 10) / 10, updatedAt: getUgandaTime() });
}

async function saleRow(ctx: Ctx, s: Doc<"processorSales">) {
  const batch = await ctx.db.get(s.batchId);
  const exporter = s.exporterId ? await ctx.db.get(s.exporterId) : null;
  const allocations = await ctx.db.query("exportLotSources").withIndex("by_processorSaleId", (q) => q.eq("processorSaleId", s._id)).take(50);
  return {
    ...s,
    batchCode: batch?.batchCode ?? "",
    outputForm: batch?.outputForm ?? "",
    grade: batch?.grade ?? null,
    traceLevel: batch?.traceLevel ?? "declared",
    batchVerified: batch?.evidenceStatus === "approved",
    exporterLabel: exporter ? `Exporter ${exporter.alias}` : s.offAppExporterName ?? null,
    processor: await processorPublic(ctx, s.processorId),
    linkedKg: allocations.reduce((a, x) => a + x.kilos, 0),
  };
}

// ------------------------------------------------------------------
// Processor side
// ------------------------------------------------------------------

/** Exporters on the app, found by exact phone number or alias, for a direct sale. */
export const findExporterForSale = query({
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
    const rows = [];
    for (const u of found.values()) {
      if (u.role !== "trader" || u.state !== "active") continue;
      const r = await exporterReadiness(ctx, u, todayUganda());
      if (!r.checks.admittedAsExporter) continue;
      rows.push({ userId: u._id, alias: `Exporter ${u.alias}`, legalName: r.profile?.legalName ?? null, verified: r.isActiveExporter });
    }
    return rows;
  },
});

export const offerDirectSale = mutation({
  args: {
    userId: v.id("users"),
    batchId: v.id("processingBatches"),
    exporterId: v.id("users"),
    kilos: v.number(),
    pricePerKgUgx: v.optional(v.number()),
    saleDate: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireProcessorUser(ctx, args.userId);
    if ((await processorCommunities(ctx, user._id)).length === 0) throw new Error("A community admin must accept you as a processor first");
    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.processorId !== user._id) throw new Error("Batch not found");
    checkSaleInput(args.kilos, args.pricePerKgUgx, args.saleDate);
    if (args.kilos > (await availableKg(ctx, batch))) throw new Error(`Only ${await availableKg(ctx, batch)} kg of this batch is available`);
    const exporter = await requireExporterAccount(ctx, args.exporterId);
    const saleCode = await newSaleCode(ctx);
    const saleId = await ctx.db.insert("processorSales", {
      saleCode,
      processorId: user._id,
      batchId: batch._id,
      kilos: args.kilos,
      pricePerKgUgx: args.pricePerKgUgx,
      saleDate: args.saleDate,
      mode: "direct",
      exporterId: exporter._id,
      status: "offered",
      receiptPhotos: [],
      notes: args.notes?.trim().slice(0, 1000) || undefined,
      createdBy: user._id,
      createdAt: getUgandaTime(),
    });
    const profile = await getProcessorProfile(ctx, user._id);
    await notify(ctx, exporter._id, "Processed coffee offered to you", `${profile?.facilityName ?? `Processor ${user.alias}`} offered ${args.kilos} kg (batch ${batch.batchCode}). Accept it under Export Markets → Lots → Processor purchases.`);
    return { saleId, saleCode };
  },
});

/** A sale made to an exporter outside the app, logged for the trace record. */
export const logOffAppSale = mutation({
  args: {
    userId: v.id("users"),
    batchId: v.id("processingBatches"),
    kilos: v.number(),
    pricePerKgUgx: v.optional(v.number()),
    saleDate: v.string(),
    offAppExporterName: v.string(),
    offAppExporterLicence: v.optional(v.string()),
    receiptPhotos: v.array(evidencePhotoValidator),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireProcessorUser(ctx, args.userId);
    if ((await processorCommunities(ctx, user._id)).length === 0) throw new Error("A community admin must accept you as a processor first");
    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.processorId !== user._id) throw new Error("Batch not found");
    checkSaleInput(args.kilos, args.pricePerKgUgx, args.saleDate);
    if (!args.offAppExporterName.trim()) throw new Error("Name the exporter you sold to");
    assertEvidencePhotos(args.receiptPhotos, 3, 0);
    const available = await availableKg(ctx, batch);
    if (args.kilos > available) throw new Error(`Only ${available} kg of this batch is available`);
    const saleCode = await newSaleCode(ctx);
    const saleId = await ctx.db.insert("processorSales", {
      saleCode,
      processorId: user._id,
      batchId: batch._id,
      kilos: args.kilos,
      pricePerKgUgx: args.pricePerKgUgx,
      saleDate: args.saleDate,
      mode: "off_app",
      offAppExporterName: args.offAppExporterName.trim().slice(0, 160),
      offAppExporterLicence: args.offAppExporterLicence?.trim() || undefined,
      status: "off_app",
      receiptPhotos: args.receiptPhotos,
      notes: args.notes?.trim().slice(0, 1000) || undefined,
      createdBy: user._id,
      createdAt: getUgandaTime(),
    });
    await ctx.db.patch(batch._id, { soldKg: Math.round((batch.soldKg + args.kilos) * 10) / 10, updatedAt: getUgandaTime() });
    return { saleId, saleCode };
  },
});

/** Accept or decline an exporter's request (PROCESSED MARKETS or a logged purchase). */
export const respondToSaleRequest = mutation({
  args: { userId: v.id("users"), saleId: v.id("processorSales"), accept: v.boolean() },
  handler: async (ctx, args) => {
    const sale = await ctx.db.get(args.saleId);
    if (!sale || sale.processorId !== args.userId) throw new Error("Sale not found");
    if (sale.status !== "requested") throw new Error("This request was already answered");
    if (args.accept) {
      const batch = await ctx.db.get(sale.batchId);
      if (!batch) throw new Error("Batch not found");
      if (sale.kilos > (await availableKg(ctx, batch, sale._id))) throw new Error("Not enough of this batch is left");
      await completeSale(ctx, sale, true);
    } else {
      await ctx.db.patch(sale._id, { status: "declined", respondedAt: getUgandaTime() });
    }
    if (sale.exporterId) {
      await notify(ctx, sale.exporterId, args.accept ? "Processor confirmed your purchase" : "Processor declined your request", `Sale ${sale.saleCode}: ${sale.kilos} kg was ${args.accept ? "confirmed" : "declined"}.`);
    }
    return { success: true };
  },
});

export const cancelSale = mutation({
  args: { userId: v.id("users"), saleId: v.id("processorSales") },
  handler: async (ctx, args) => {
    const sale = await ctx.db.get(args.saleId);
    if (!sale || sale.createdBy !== args.userId) throw new Error("Sale not found");
    if (sale.status !== "offered" && sale.status !== "requested") throw new Error("Only a sale still waiting for an answer can be cancelled");
    await ctx.db.patch(sale._id, { status: "cancelled", respondedAt: getUgandaTime() });
    return { success: true };
  },
});

export const setBatchMarketListing = mutation({
  args: { userId: v.id("users"), batchId: v.id("processingBatches"), listed: v.boolean(), askingPricePerKgUgx: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.processorId !== args.userId) throw new Error("Batch not found");
    if (args.listed) {
      if (!(await isActiveProcessor(ctx, args.userId, todayUganda()))) throw new Error("Only a verified, live processor can list in PROCESSED MARKETS");
      if ((await availableKg(ctx, batch)) <= 0) throw new Error("Nothing of this batch is left to sell");
      if (args.askingPricePerKgUgx !== undefined && !(args.askingPricePerKgUgx > 0 && args.askingPricePerKgUgx < 10_000_000)) throw new Error("Price looks wrong");
    }
    await ctx.db.patch(batch._id, { marketListed: args.listed || undefined, askingPricePerKgUgx: args.askingPricePerKgUgx, updatedAt: getUgandaTime() });
    return { success: true };
  },
});

export const listMySales = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireProcessorUser(ctx, args.userId);
    const sales = await ctx.db.query("processorSales").withIndex("by_processorId", (q) => q.eq("processorId", args.userId)).order("desc").take(200);
    const batches = await ctx.db.query("processingBatches").withIndex("by_processorId", (q) => q.eq("processorId", args.userId)).order("desc").take(200);
    const sellable = [];
    for (const b of batches) {
      const available = await availableKg(ctx, b);
      if (available > 0) {
        sellable.push({
          _id: b._id,
          batchCode: b.batchCode,
          outputForm: b.outputForm,
          grade: b.grade ?? null,
          availableKg: available,
          traceLevel: b.traceLevel,
          evidenceStatus: b.evidenceStatus,
          marketListed: b.marketListed === true,
          askingPricePerKgUgx: b.askingPricePerKgUgx ?? null,
        });
      }
    }
    return { sales: await Promise.all(sales.map((s) => saleRow(ctx, s))), sellable };
  },
});

// ------------------------------------------------------------------
// Exporter side
// ------------------------------------------------------------------

export const respondToDirectOffer = mutation({
  args: { userId: v.id("users"), saleId: v.id("processorSales"), accept: v.boolean() },
  handler: async (ctx, args) => {
    const sale = await ctx.db.get(args.saleId);
    if (!sale || sale.exporterId !== args.userId) throw new Error("Offer not found");
    if (sale.status !== "offered") throw new Error("This offer was already answered");
    if (args.accept) {
      try {
        await completeSale(ctx, sale, true);
      } catch {
        // The fee check fails before anything is written, so this notice is
        // the only write; returning (not throwing) keeps it.
        await notify(ctx, sale.processorId, "Top up to complete a sale", `An exporter tried to accept ${sale.saleCode}, but the platform fee could not be paid from your wallet.`);
        return { success: false, error: "The processor cannot pay the platform fee yet; they have been told to top up. Try again later." };
      }
    } else {
      await ctx.db.patch(sale._id, { status: "declined", respondedAt: getUgandaTime() });
    }
    await notify(ctx, sale.processorId, args.accept ? "Exporter accepted your offer" : "Exporter declined your offer", `Sale ${sale.saleCode}: ${sale.kilos} kg was ${args.accept ? "accepted" : "declined"}.`);
    return { success: true, error: null };
  },
});

/** The exporter records a purchase using the batch code the processor gave them. */
export const logPurchaseFromProcessor = mutation({
  args: { userId: v.id("users"), batchCode: v.string(), kilos: v.number(), pricePerKgUgx: v.optional(v.number()), saleDate: v.string(), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const exporter = await requireExporterAccount(ctx, args.userId);
    checkSaleInput(args.kilos, args.pricePerKgUgx, args.saleDate);
    const batch = await ctx.db.query("processingBatches").withIndex("by_batchCode", (q) => q.eq("batchCode", args.batchCode.trim().toUpperCase())).first();
    if (!batch) throw new Error("No batch with that code. Ask the processor for the batch code (it starts with PRB-).");
    const available = await availableKg(ctx, batch);
    if (args.kilos > available) throw new Error(`Only ${available} kg of that batch is available`);
    const saleCode = await newSaleCode(ctx);
    const saleId = await ctx.db.insert("processorSales", {
      saleCode,
      processorId: batch.processorId,
      batchId: batch._id,
      kilos: args.kilos,
      pricePerKgUgx: args.pricePerKgUgx,
      saleDate: args.saleDate,
      mode: "exporter_logged",
      exporterId: exporter._id,
      status: "requested",
      receiptPhotos: [],
      notes: args.notes?.trim().slice(0, 1000) || undefined,
      createdBy: exporter._id,
      createdAt: getUgandaTime(),
    });
    await notify(ctx, batch.processorId, "Confirm a purchase an exporter logged", `Exporter ${exporter.alias} logged buying ${args.kilos} kg of batch ${batch.batchCode}. Confirm it under Sales.`);
    return { saleId, saleCode };
  },
});

/** Link a sale the processor logged as off-app to this exporter, by its sale code. */
export const claimOffAppSale = mutation({
  args: { userId: v.id("users"), saleCode: v.string() },
  handler: async (ctx, args) => {
    const exporter = await requireExporterAccount(ctx, args.userId);
    const sale = await ctx.db.query("processorSales").withIndex("by_saleCode", (q) => q.eq("saleCode", args.saleCode.trim().toUpperCase())).first();
    if (!sale || sale.mode !== "off_app") throw new Error("No off-app sale with that code. Ask the processor for the sale code (it starts with PSL-).");
    if (sale.status !== "off_app") throw new Error("This sale is already linked to an exporter");
    await ctx.db.patch(sale._id, { exporterId: exporter._id, status: "completed", respondedAt: getUgandaTime() });
    await notify(ctx, sale.processorId, "Exporter linked an off-app sale", `Exporter ${exporter.alias} confirmed sale ${sale.saleCode} (${sale.kilos} kg); it now counts on the trace map.`);
    await audit(ctx, "processor_sale_claimed", exporter._id, { targetUserId: sale.processorId, targetId: String(sale._id) });
    return { success: true };
  },
});

export const listMyProcessorPurchases = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "trader") return [];
    const sales = await ctx.db.query("processorSales").withIndex("by_exporterId", (q) => q.eq("exporterId", args.userId)).order("desc").take(200);
    return await Promise.all(sales.map((s) => saleRow(ctx, s)));
  },
});

/** PROCESSED MARKETS: listed batches from live processors, for verified exporters only. */
export const listProcessedMarket = query({
  args: { userId: v.id("users"), today: v.string() },
  handler: async (ctx, args) => {
    const today = isIsoDate(args.today) ? args.today : todayUganda();
    if (!(await isActiveExporter(ctx, args.userId, today))) return { allowed: false as const, listings: [] };
    const batches = await ctx.db.query("processingBatches").withIndex("by_marketListed", (q) => q.eq("marketListed", true)).take(300);
    const live = new Map<string, boolean>();
    const listings = [];
    for (const b of batches) {
      const key = String(b.processorId);
      if (!live.has(key)) live.set(key, await isActiveProcessor(ctx, b.processorId, today));
      if (!live.get(key)) continue;
      const available = await availableKg(ctx, b);
      if (available <= 0) continue;
      listings.push({
        batchId: b._id,
        batchCode: b.batchCode,
        crop: b.crop,
        outputForm: b.outputForm,
        coffeeType: b.coffeeType ?? null,
        grade: b.grade ?? null,
        processingMethod: b.processingMethod ?? null,
        moisturePercent: b.moisturePercent ?? null,
        outturnPercent: outturnPercent(b.weightInKg, b.weightOutKg),
        availableKg: available,
        askingPricePerKgUgx: b.askingPricePerKgUgx ?? null,
        traceLevel: b.traceLevel,
        evidenceVerified: b.evidenceStatus === "approved",
        coverUrl: b.photos[0] ? await ctx.storage.getUrl(b.photos[0].storageId) : null,
        processor: await processorPublic(ctx, b.processorId),
      });
    }
    return { allowed: true as const, listings };
  },
});

export const requestFromProcessedMarket = mutation({
  args: { userId: v.id("users"), batchId: v.id("processingBatches"), kilos: v.number(), pricePerKgUgx: v.optional(v.number()), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const exporter = await requireExporterAccount(ctx, args.userId);
    if (!(await isActiveExporter(ctx, exporter._id, todayUganda()))) throw new Error("Only verified, live exporters can buy in PROCESSED MARKETS");
    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.marketListed !== true) throw new Error("This batch is not listed");
    const saleDate = todayUganda();
    const price = args.pricePerKgUgx ?? batch.askingPricePerKgUgx;
    checkSaleInput(args.kilos, price, saleDate);
    const available = await availableKg(ctx, batch);
    if (args.kilos > available) throw new Error(`Only ${available} kg is available`);
    const saleCode = await newSaleCode(ctx);
    const saleId = await ctx.db.insert("processorSales", {
      saleCode,
      processorId: batch.processorId,
      batchId: batch._id,
      kilos: args.kilos,
      pricePerKgUgx: price,
      saleDate,
      mode: "market",
      exporterId: exporter._id,
      status: "requested",
      receiptPhotos: [],
      notes: args.notes?.trim().slice(0, 1000) || undefined,
      createdBy: exporter._id,
      createdAt: getUgandaTime(),
    });
    await notify(ctx, batch.processorId, "PROCESSED MARKETS request", `Exporter ${exporter.alias} requested ${args.kilos} kg of batch ${batch.batchCode}. Answer it under Sales.`);
    return { saleId, saleCode };
  },
});
