/**
 * Trace chains: where in-app produce came from, back to the farms.
 *
 * Every in-app listing must trace to farms. A lot is sold by a farmer (their
 * own farm), or made from stock its seller bought in the app (an earlier lot
 * order, an older 100 kg block of farmer units, or a farmer paid at a posted
 * price), or made from a processor's batch (its intakes name the farms).
 * These helpers walk those links and share the kilos out across the farms in
 * proportion. Anything off the app ends the chain as "not traced".
 *
 * Helpers only, reading tables directly (no imports of other modules), so
 * exportLots.ts and traceRecords.ts can both use them without import cycles.
 */

import { MutationCtx, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

/** A step in the chain, from the produce in hand back towards the farm. */
export type TraceVia = { kind: "lot" | "stock" | "batch" | "receipt"; label: string; ref: string };

export type FarmOrigin =
  | { kind: "platform_farmer"; farmerId: Id<"users">; kilos: number; via: TraceVia[]; batchId?: Id<"processingBatches"> }
  | { kind: "declared_farm"; intakeId: Id<"processorIntakes">; kilos: number; via: TraceVia[]; batchId: Id<"processingBatches"> }
  | { kind: "untraced"; kilos: number; via: TraceVia[]; reason: string };

const MAX_DEPTH = 6;

const roleName: Record<string, string> = { farmer: "Farmer", store: "Processor", vendor: "Vendor", trader: "Exporter", buyer: "Buyer", transporter: "Transporter" };

async function who(ctx: Ctx, userId: Id<"users">): Promise<string> {
  const user = await ctx.db.get(userId);
  return user ? `${roleName[user.role] ?? "Member"} ${user.alias ?? ""}`.trim() : "Member (account removed)";
}

/** Split kilos across weighted parts, keeping the total. */
function share(kilos: number, parts: { weight: number }[]): number[] {
  const total = parts.reduce((a, p) => a + p.weight, 0) || 1;
  return parts.map((p) => Math.round(((kilos * p.weight) / total) * 10) / 10);
}

/** The farms behind a processed batch, through its intakes. */
export async function originsOfBatch(ctx: Ctx, batchId: Id<"processingBatches">, kilos: number, via: TraceVia[]): Promise<FarmOrigin[]> {
  const batch = await ctx.db.get(batchId);
  if (!batch) return [{ kind: "untraced", kilos, via, reason: "batch not found" }];
  const step: TraceVia = { kind: "batch", label: `${await who(ctx, batch.processorId)} · batch ${batch.batchCode}`, ref: batch.batchCode };
  const inputs = await ctx.db.query("processingBatchInputs").withIndex("by_batchId", (q) => q.eq("batchId", batchId)).take(200);
  if (inputs.length === 0) return [{ kind: "untraced", kilos, via: [...via, step], reason: "batch has no intake" }];
  const kg = share(kilos, inputs.map((i) => ({ weight: i.kilos })));
  const out: FarmOrigin[] = [];
  for (const [n, input] of inputs.entries()) {
    const intake = await ctx.db.get(input.intakeId);
    if (!intake) continue;
    if (intake.sourceKind === "platform_farmer" && intake.farmerId) {
      out.push({ kind: "platform_farmer", farmerId: intake.farmerId, kilos: kg[n], via: [...via, step], batchId });
    } else {
      out.push({ kind: "declared_farm", intakeId: intake._id, kilos: kg[n], via: [...via, step], batchId });
    }
  }
  return out;
}

/** The farms behind a lot listing. */
export async function originsOfListing(ctx: Ctx, listingId: Id<"listings">, kilos: number, via: TraceVia[] = [], depth = 0): Promise<FarmOrigin[]> {
  const listing = await ctx.db.get(listingId);
  if (!listing) return [{ kind: "untraced", kilos, via, reason: "listing not found" }];
  const seller = listing.farmerId ? await ctx.db.get(listing.farmerId) : null;
  const step: TraceVia = { kind: "lot", label: `${seller ? `${roleName[seller.role] ?? "Member"} ${seller.alias ?? ""}`.trim() : "Seller"} · ${listing.produceType}`, ref: listing.utid };
  const chain = [...via, step];
  if (depth > MAX_DEPTH) return [{ kind: "untraced", kilos, via: chain, reason: "chain too long" }];
  if (listing.processingBatchId) return await originsOfBatch(ctx, listing.processingBatchId, kilos, chain);
  if (listing.inventoryId) return await originsOfStock(ctx, listing.inventoryId, kilos, chain, depth + 1);
  if (seller?.role === "farmer") return [{ kind: "platform_farmer", farmerId: seller._id, kilos, via: chain }];
  return [{ kind: "untraced", kilos, via: chain, reason: "off-app stock" }];
}

/** The farms behind a stock row (exporters, processors and vendors). */
export async function originsOfStock(ctx: Ctx, inventoryId: Id<"traderInventory">, kilos: number, via: TraceVia[] = [], depth = 0): Promise<FarmOrigin[]> {
  const inv: Doc<"traderInventory"> | null = await ctx.db.get(inventoryId);
  if (!inv) return [{ kind: "untraced", kilos, via, reason: "stock not found" }];
  const step: TraceVia = { kind: "stock", label: `${await who(ctx, inv.traderId)} · stock ${inv.produceType}`, ref: inv.utid };
  const chain = [...via, step];
  if (depth > MAX_DEPTH) return [{ kind: "untraced", kilos, via: chain, reason: "chain too long" }];
  if (inv.receiptId) {
    const receipt = await ctx.db.get(inv.receiptId);
    const receiptStep: TraceVia = { kind: "receipt", label: `Paid ${receipt?.farmerName ?? "farmer"} · receipt ${receipt?.receiptNumber ?? ""}`.trim(), ref: receipt?.receiptNumber ?? "" };
    return receipt?.farmerId
      ? [{ kind: "platform_farmer", farmerId: receipt.farmerId, kilos, via: [...chain, receiptStep] }]
      : [{ kind: "untraced", kilos, via: [...chain, receiptStep], reason: "farmer not on the app" }];
  }
  if (inv.lotOrderId) {
    const order = await ctx.db.get(inv.lotOrderId);
    if (order) return await originsOfListing(ctx, order.listingId, kilos, chain, depth + 1);
  }
  if (inv.listingUnitIds.length > 0) {
    // Older 100 kg blocks pooled units from several listings
    const byListing = new Map<Id<"listings">, number>();
    for (const unitId of inv.listingUnitIds.slice(0, 300)) {
      const unit = await ctx.db.get(unitId);
      if (unit) byListing.set(unit.listingId, (byListing.get(unit.listingId) ?? 0) + 1);
    }
    const parts = [...byListing.entries()].map(([listingId, units]) => ({ listingId, weight: units }));
    const kg = share(kilos, parts);
    const out: FarmOrigin[] = [];
    for (const [n, part] of parts.entries()) out.push(...(await originsOfListing(ctx, part.listingId, kg[n], chain, depth + 1)));
    return out;
  }
  return [{ kind: "untraced", kilos, via: chain, reason: "off-app stock" }];
}

/** Totals for a set of origins: how many kilos trace to a farm on the app, to a declared farm, or not at all. */
export function traceSummary(origins: FarmOrigin[]) {
  const sum = (k: FarmOrigin["kind"]) => Math.round(origins.filter((o) => o.kind === k).reduce((a, o) => a + o.kilos, 0) * 10) / 10;
  return { appFarmsKg: sum("platform_farmer"), declaredFarmsKg: sum("declared_farm"), untracedKg: sum("untraced") };
}
