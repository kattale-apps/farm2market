/**
 * One-off clean-up: remove the test trade data that was built on platform
 * storage locations, so the retired storage fields and table can then be
 * dropped from the schema. The owner confirmed this data is test data and a
 * full backup was taken first (2026-09-27).
 *
 * Deletes, in batches: listings and their units, negotiations, exporter
 * inventory, storage locations, and the rows that only point at them
 * (buyer listing purchases, ETA history, community listing tags, exporter-
 * buyer negotiations, buyer purchases). Clears the retired storage fields on
 * users and produce options. Wallet and FarmCoin history is not touched.
 *
 * Run repeatedly until `done` is true:
 *   npx convex run storageRetirement:run '{"dryRun":true}'
 *   npx convex run storageRetirement:run '{"dryRun":false}'
 * Remove this file in the follow-up that drops the retired fields.
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const BATCH = 400;
const TABLES = [
  "listingUnits",
  "negotiations",
  "buyerListingPurchases",
  "etaHistory",
  "communityListingTags",
  "traderBuyerNegotiations",
  "buyerPurchases",
  "traderInventory",
  "listings",
  "storageLocations",
] as const;

export const run = internalMutation({
  args: { dryRun: v.boolean() },
  handler: async (ctx, args) => {
    const counts: Record<string, number> = {};
    let done = true;
    for (const table of TABLES) {
      const rows = await ctx.db.query(table).take(args.dryRun ? 10000 : BATCH);
      counts[table] = rows.length;
      if (args.dryRun) continue;
      for (const r of rows) await ctx.db.delete(r._id);
      if (rows.length === BATCH) done = false;
    }
    // Retired storage fields on remaining rows.
    const users = (await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "admin")).take(2000)).filter(
      (u) => u.allowedStorageLocationIds !== undefined
    );
    counts.usersWithStorageLocations = users.length;
    const options = (await ctx.db.query("produceOptions").take(2000)).filter((o) => o.allowedStorageLocationIds !== undefined);
    counts.produceOptionsWithStorageLocations = options.length;
    if (!args.dryRun) {
      for (const u of users) await ctx.db.patch(u._id, { allowedStorageLocationIds: undefined });
      for (const o of options) await ctx.db.patch(o._id, { allowedStorageLocationIds: undefined });
    }
    return { dryRun: args.dryRun, done: args.dryRun ? null : done, counts };
  },
});
