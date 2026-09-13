/**
 * UGX -> foreign currency exchange rates for the buyer wallet's "view in
 * another currency" feature.
 *
 * Rates are fetched from open.er-api.com — a free, no-API-key exchange
 * rate service (part of exchangerate-api.com's open access tier) — and
 * cached in the `exchangeRates` table so the app never calls the external
 * API on a normal page load. A cron job (see convex/crons.ts) refreshes
 * the cache periodically; the client also triggers a refresh itself if
 * the cache is missing or stale, so the very first user after a deploy
 * doesn't wait for the next cron tick.
 */

import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getUgandaTime } from "./utils";

const RATE_STALE_AFTER_MS = 12 * 60 * 60 * 1000; // 12 hours

export const getLatestRates = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("exchangeRates")
      .withIndex("by_base", (q: any) => q.eq("baseCurrency", "UGX"))
      .first();
    if (!row) return null;
    return { ...row, isStale: getUgandaTime() - row.fetchedAt > RATE_STALE_AFTER_MS };
  },
});

export const upsertRates = internalMutation({
  args: {
    rates: v.object({ USD: v.number(), GBP: v.number(), EUR: v.number() }),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("exchangeRates")
      .withIndex("by_base", (q: any) => q.eq("baseCurrency", "UGX"))
      .first();
    const now = getUgandaTime();
    if (existing) {
      await ctx.db.patch(existing._id, { rates: args.rates, fetchedAt: now, source: args.source });
    } else {
      await ctx.db.insert("exchangeRates", {
        baseCurrency: "UGX",
        rates: args.rates,
        fetchedAt: now,
        source: args.source,
      });
    }
  },
});

/**
 * Fetches fresh UGX exchange rates and caches them. Public (not
 * internalAction) so the client can trigger an on-demand refresh when the
 * cache is empty or stale; also scheduled periodically via crons.ts.
 */
export const fetchLatestRates = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/UGX");
      if (!res.ok) {
        throw new Error(`Exchange rate API returned HTTP ${res.status}`);
      }
      const data: any = await res.json();
      if (data.result !== "success" || !data.rates) {
        throw new Error("Exchange rate API returned an unexpected response");
      }
      const rates = {
        USD: data.rates.USD,
        GBP: data.rates.GBP,
        EUR: data.rates.EUR,
      };
      if (![rates.USD, rates.GBP, rates.EUR].every((r) => typeof r === "number" && r > 0)) {
        throw new Error("Exchange rate API response is missing one of USD/GBP/EUR");
      }
      await ctx.runMutation(internal.exchangeRates.upsertRates, { rates, source: "open.er-api.com" });
      return { success: true };
    } catch (err) {
      console.error("Failed to fetch exchange rates:", err);
      return { success: false, error: (err as Error).message };
    }
  },
});
