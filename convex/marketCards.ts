/**
 * MarketSpace cards: keep one small marketCards row per live post.
 *
 * Discover reads only marketCards, so a page of cards is one indexed read
 * of exactly what a card shows. The sources stay where they are: a vended
 * lot listing (listings + listingUnits) or a classified ad (marketspaceAds).
 * Any mutation that changes a source calls syncListingCard / syncAdCard, so
 * the card never drifts from it.
 *
 * Helpers only (no registered functions), so marketspace.ts and
 * lotOrders.ts can both call them without importing each other.
 */

import { MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import { packageLabel, packagesText } from "./lotOrdersShared";

/** A deleted post takes its questions, answers and wanted-ad responses with it (a post has a few dozen at most). */
async function deleteCardQuestions(ctx: MutationCtx, cardId: Id<"marketCards">) {
  const enquiries = await ctx.db.query("enquiries").withIndex("by_card_and_question", (q) => q.eq("cardId", cardId)).take(500);
  const asks = await ctx.db.query("enquiryAsks").withIndex("by_card", (q) => q.eq("cardId", cardId)).take(2000);
  const responses = await ctx.db.query("wantedResponses").withIndex("by_card_and_updatedAt", (q) => q.eq("cardId", cardId)).take(500);
  for (const row of [...enquiries, ...asks, ...responses]) await ctx.db.delete(row._id);
}

async function districtOf(ctx: MutationCtx, user: Doc<"users"> | null): Promise<string> {
  if (!user?.districtId) return "";
  return (await ctx.db.get(user.districtId))?.name ?? "";
}

/**
 * The card of a lot listing: live while the listing is vended, not
 * withdrawn and has lots left; closed otherwise. Expiry is by time
 * (expiresAt), so a card that runs out simply stops showing.
 */
export async function syncListingCard(ctx: MutationCtx, listingId: Id<"listings">) {
  const now = getUgandaTime();
  const listing = await ctx.db.get(listingId);
  const existing = await ctx.db
    .query("marketCards")
    .withIndex("by_listing", (q) => q.eq("listingId", listingId))
    .first();

  const units = listing
    ? await ctx.db
        .query("listingUnits")
        .withIndex("by_listing", (q) => q.eq("listingId", listingId))
        .collect()
    : [];
  const lotsAvailable = units.filter((u) => u.status === "available").length;
  const live =
    !!listing?.farmerId &&
    listing.vendExpiresAt !== undefined &&
    !listing.withdrawnAt &&
    (listing.status === "active" || listing.status === "partially_locked") &&
    lotsAvailable > 0;

  if (!live || !listing?.farmerId || listing.vendExpiresAt === undefined) {
    if (existing && existing.status !== "closed") await ctx.db.patch(existing._id, { status: "closed", updatedAt: now });
    return;
  }

  const seller = await ctx.db.get(listing.farmerId);
  const packaged = listing.listingMode === "packaging";
  const lotKg = listing.unitSize || 10;
  // Packaged items: priced per item, counted as items or batches
  const label = packageLabel(listing);
  const perBatch = listing.packagesPerBatch ?? 1;
  const packagedFields = packaged
    ? {
        packaged: true,
        priceUGX: listing.pricePerUnit,
        priceUnit: `per ${label}`,
        quantityText: perBatch > 1 ? `${lotsAvailable} batch${lotsAvailable === 1 ? "" : "es"} of ${packagesText(perBatch, label)}` : packagesText(lotsAvailable, label),
        lotKg: undefined,
        qtyKg: undefined,
        pricePerKilo: undefined,
      }
    : { packaged: undefined };
  const fields = {
    sourceKind: "listing" as const,
    listingId,
    view: seller?.role === "farmer" ? ("produce" as const) : ("lots" as const),
    kind: "offer" as const,
    isBulk: !!listing.isBulk,
    bulkRange: listing.isBulk ? listing.bulkRange : undefined,
    title: listing.produceType,
    sellerId: listing.farmerId,
    sellerRole: seller?.role ?? "farmer",
    district: await districtOf(ctx, seller),
    stockSource: listing.stockSource ?? (seller?.role === "farmer" ? ("own_farm" as const) : undefined),
    lotKg,
    bagKg: listing.bagKg,
    bagsPerLot: listing.bagsPerLot,
    lotsAvailable,
    qtyKg: lotsAvailable * lotKg,
    pricePerKilo: listing.pricePerKilo,
    ...packagedFields,
    commitPercent: listing.commitPercent ?? 100,
    qualityRating: listing.qualityRating,
    thumbStorageId: listing.photos?.[0]?.storageId,
    status: "active" as const,
    expiresAt: listing.vendExpiresAt,
    createdAt: listing.vendedAt ?? now,
    updatedAt: now,
  };
  if (existing) await ctx.db.patch(existing._id, fields);
  else await ctx.db.insert("marketCards", fields);
}

/** The card of a classified ad: live while the ad is active. Deleted ads lose their card. */
export async function syncAdCard(ctx: MutationCtx, adId: Id<"marketspaceAds">) {
  const now = getUgandaTime();
  const ad = await ctx.db.get(adId);
  const existing = await ctx.db
    .query("marketCards")
    .withIndex("by_ad", (q) => q.eq("adId", adId))
    .first();
  if (!ad) {
    if (existing) {
      await deleteCardQuestions(ctx, existing._id);
      await ctx.db.delete(existing._id);
    }
    return;
  }
  const owner = await ctx.db.get(ad.ownerId);
  const fields = {
    sourceKind: "ad" as const,
    adId,
    view: "classifieds" as const,
    kind: ad.kind,
    isBulk: false,
    title: ad.title,
    groupId: ad.groupId,
    categoryId: ad.categoryId,
    sellerId: ad.ownerId,
    sellerRole: owner?.role ?? "",
    district: ad.district,
    quantityText: ad.quantity,
    priceUGX: ad.priceUGX,
    priceUnit: ad.priceUnit,
    thumbStorageId: ad.photoIds[0],
    status: ad.status === "active" ? ("active" as const) : ("closed" as const),
    expiresAt: ad.expiresAt,
    createdAt: ad.createdAt,
    updatedAt: now,
  };
  if (existing) await ctx.db.patch(existing._id, fields);
  else await ctx.db.insert("marketCards", fields);
}
