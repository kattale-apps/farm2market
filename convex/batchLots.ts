/**
 * Processed batches sold as lots (MarketSpace). A lot listing made from a
 * batch holds its kilos while any of its lots is for sale, in an order or
 * sold; withdrawn lots give them back. Helpers only, with no imports of
 * other modules, so processorSales.ts and processorOperations.ts can share
 * them without an import cycle.
 */

import { MutationCtx, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/** Kilos of a batch in lot listings: every lot not withdrawn. */
export async function lotListedKg(ctx: QueryCtx | MutationCtx, batchId: Id<"processingBatches">): Promise<number> {
  const listings = await ctx.db.query("listings").withIndex("by_processingBatch", (q) => q.eq("processingBatchId", batchId)).take(100);
  let kg = 0;
  for (const listing of listings) {
    const units = await ctx.db.query("listingUnits").withIndex("by_listing", (q) => q.eq("listingId", listing._id)).take(500);
    kg += units.filter((u) => u.status !== "cancelled").length * (listing.unitSize || 0);
  }
  return kg;
}
