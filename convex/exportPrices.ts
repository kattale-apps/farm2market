/**
 * Coffee reference prices for the Export Markets ticker.
 *
 * Free sources only. The ICO publishes its daily indicator prices as a PDF,
 * which cannot be read reliably here, but its homepage states the monthly
 * average ICO Composite Indicator Price (I-CIP) in plain text. A cron reads
 * that once a day. Super admins can also enter daily Arabica and Robusta
 * reference prices (for example from the regulator's daily indicative
 * prices), each shown with its date and source.
 */

import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getUgandaTime } from "./utils";
import { requireSuperAdmin } from "./exportMarkets";

const ICO_URL = "https://ico.org/";
const MANUAL_KEYS: Record<string, string> = {
  arabica: "Arabica reference price",
  robusta: "Robusta reference price",
};

export const getReferencePrices = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("coffeeReferencePrices").take(20);
    const order = ["ico_composite_monthly", "arabica", "robusta"];
    return rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  },
});

export const setReferencePrice = mutation({
  args: {
    adminId: v.id("users"),
    key: v.union(v.literal("arabica"), v.literal("robusta")),
    value: v.number(),
    unit: v.union(v.literal("US cents/lb"), v.literal("USD/kg")),
    asOf: v.string(),
    source: v.string(),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx, args.adminId);
    if (!(args.value > 0 && args.value < 100000)) throw new Error("Enter a valid price");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.asOf)) throw new Error("Give the date the price applies to");
    if (!args.source.trim()) throw new Error("Give the source");
    const row = {
      key: args.key,
      label: MANUAL_KEYS[args.key],
      value: args.value,
      unit: args.unit,
      asOf: args.asOf,
      source: args.source.trim().slice(0, 120),
      sourceUrl: args.sourceUrl?.trim() || undefined,
      enteredBy: args.adminId,
      updatedAt: getUgandaTime(),
    };
    const existing = await ctx.db.query("coffeeReferencePrices").withIndex("by_key", (q) => q.eq("key", args.key)).first();
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert("coffeeReferencePrices", row);
    return { success: true };
  },
});

export const upsertIcoComposite = internalMutation({
  args: { value: v.number(), asOf: v.string() },
  handler: async (ctx, args) => {
    const row = {
      key: "ico_composite_monthly",
      label: "ICO Composite Indicator (monthly average)",
      value: args.value,
      unit: "US cents/lb",
      asOf: args.asOf,
      source: "International Coffee Organization",
      sourceUrl: ICO_URL,
      updatedAt: getUgandaTime(),
    };
    const existing = await ctx.db.query("coffeeReferencePrices").withIndex("by_key", (q) => q.eq("key", row.key)).first();
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert("coffeeReferencePrices", row);
  },
});

async function fetchIcoComposite(): Promise<{ value: number; asOf: string } | null> {
  const res = await fetch(ICO_URL, { headers: { "User-Agent": "farm2market price ticker" } });
  if (!res.ok) return null;
  const text = (await res.text()).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const m = text.match(/\(I-CIP\)\s*averaged\s*([\d.,]+)\s*US cents\/lb\s*in\s*([A-Z][a-z]+ \d{4})/);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? { value, asOf: m[2] } : null;
}

export const refreshIcoComposite = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      const r = await fetchIcoComposite();
      if (r) await ctx.runMutation(internal.exportPrices.upsertIcoComposite, r);
      else console.warn("ICO composite price not found on the ICO homepage; keeping the last value");
    } catch (e) {
      console.warn("ICO price fetch failed; keeping the last value", e);
    }
    return null;
  },
});

/** Lets a super admin refresh the ICO figure on demand from the admin page. */
export const refreshIcoCompositeNow = action({
  args: { adminId: v.id("users") },
  handler: async (ctx, args): Promise<{ found: boolean }> => {
    const ok: boolean = await ctx.runQuery(internal.exportPrices.isSuperAdminQuery, { adminId: args.adminId });
    if (!ok) throw new Error("Only super admins can do this");
    const r = await fetchIcoComposite();
    if (r) await ctx.runMutation(internal.exportPrices.upsertIcoComposite, r);
    return { found: !!r };
  },
});

export const isSuperAdminQuery = internalQuery({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    try {
      await requireSuperAdmin(ctx, args.adminId);
      return true;
    } catch {
      return false;
    }
  },
});
