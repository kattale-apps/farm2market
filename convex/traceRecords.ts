/**
 * Trace records for Records and Reports: every lot a member bought or sold,
 * and every stock row they hold, with the chain of hands back to the farms
 * (traceChain.ts). In-app produce must always trace to farms; anything that
 * does not is shown as "not traced" so it can be fixed or declared.
 */

import { v } from "convex/values";
import { query, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { originsOfListing, originsOfStock, traceSummary, type FarmOrigin } from "./traceChain";

type Farm = { label: string; district: string | null; hasGps: boolean; kilos: number; onApp: boolean };

async function farmsOf(ctx: QueryCtx, origins: FarmOrigin[]): Promise<Farm[]> {
  const farms = new Map<string, Farm>();
  const add = (key: string, farm: Omit<Farm, "kilos">, kilos: number) => {
    const existing = farms.get(key);
    if (existing) existing.kilos = Math.round((existing.kilos + kilos) * 10) / 10;
    else farms.set(key, { ...farm, kilos: Math.round(kilos * 10) / 10 });
  };
  for (const o of origins) {
    if (o.kind === "platform_farmer") {
      const farmer = await ctx.db.get(o.farmerId);
      add(`f:${o.farmerId}`, { label: `Farmer ${farmer?.alias ?? ""}`.trim(), district: farmer?.districtText ?? null, hasGps: farmer?.gpsLat !== undefined && farmer?.gpsLng !== undefined, onApp: true }, o.kilos);
    } else if (o.kind === "declared_farm") {
      const intake = await ctx.db.get(o.intakeId);
      add(`i:${o.intakeId}`, { label: `Declared farm: ${intake?.farmerName ?? "farmer"}`, district: intake?.district ?? null, hasGps: intake?.lat !== undefined && intake?.lng !== undefined, onApp: false }, o.kilos);
    } else {
      add(`u:${o.reason}`, { label: `Not traced (${o.reason})`, district: null, hasGps: false, onApp: false }, o.kilos);
    }
  }
  return [...farms.values()].sort((a, b) => b.kilos - a.kilos);
}

/** The chain of hands, from the produce in hand back to the farms (one path, the longest). */
function chainOf(origins: FarmOrigin[]): string[] {
  const longest = origins.reduce<FarmOrigin["via"]>((best, o) => (o.via.length > best.length ? o.via : best), []);
  return longest.map((s) => (s.ref ? `${s.label} (${s.ref})` : s.label));
}

async function record(ctx: QueryCtx, kind: "bought" | "sold" | "stock", ref: string, produce: string, kilos: number, at: number, status: string, origins: FarmOrigin[]) {
  return { kind, ref, produce, kilos, at, status, chain: chainOf(origins), farms: await farmsOf(ctx, origins), ...traceSummary(origins) };
}

export const myTraceRecords = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    const records = [];
    const bought = await ctx.db.query("lotOrders").withIndex("by_buyer", (q) => q.eq("buyerId", user._id)).order("desc").take(40);
    for (const o of bought) records.push(await record(ctx, "bought", o.utid, o.produceType, o.lotKg, o.createdAt, o.status, await originsOfListing(ctx, o.listingId, o.lotKg)));
    const sold = await ctx.db.query("lotOrders").withIndex("by_seller", (q) => q.eq("sellerId", user._id)).order("desc").take(40);
    for (const o of sold) records.push(await record(ctx, "sold", o.utid, o.produceType, o.lotKg, o.createdAt, o.status, await originsOfListing(ctx, o.listingId, o.lotKg)));
    const stock = await ctx.db.query("traderInventory").withIndex("by_trader", (q) => q.eq("traderId", user._id)).order("desc").take(40);
    for (const inv of stock) {
      if (inv.status !== "in_storage") continue;
      records.push(await record(ctx, "stock", inv.utid, inv.produceType, inv.totalKilos, inv.acquiredAt, "in store", await originsOfStock(ctx, inv._id as Id<"traderInventory">, inv.totalKilos)));
    }
    return records.sort((a, b) => b.at - a.at).slice(0, 80);
  },
});
