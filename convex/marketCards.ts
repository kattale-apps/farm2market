/**
 * MarketSpace cards: keep one small marketCards row per live post.
 *
 * Discover reads only marketCards, so a page of cards is one indexed read
 * of exactly what a card shows. The sources stay where they are: a vended
 * lot listing (listings + listingUnits) or a classified ad (marketspaceAds).
 * Any mutation that changes a source calls syncListingCard / syncAdCard, so
 * the card never drifts from it.
 *
 * Farmers' lots follow the commercial farmer rule (marketspaceShared
 * produceVisible): a farmer's lot for sale always has a card, "active" while
 * it is on MarketSpace and "farm_gate" otherwise, so verified processors and
 * exporters can find every farmer lot. Cards carry the farmer's commercial
 * profile status, so Discover decides who sees them without extra reads.
 *
 * Helpers only (no registered functions), so marketspace.ts and
 * lotOrders.ts can both call them without importing each other.
 */

import { MutationCtx, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import { packageLabel, packagesText } from "./lotOrdersShared";
import { produceVisible } from "./marketspaceShared";

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

/** A farmer's commercial profile as cards carry it: pending or verified; none (or not accepted) is undefined. */
export async function commercialStatusOf(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<"pending" | "verified" | undefined> {
  const profile = await ctx.db
    .query("commercialProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  return profile && profile.status !== "rejected" ? profile.status : undefined;
}

/** After a farmer's commercial profile changes: every card of their lots for sale picks it up. */
export async function resyncFarmerCards(ctx: MutationCtx, farmerId: Id<"users">) {
  const listings = await ctx.db
    .query("listings")
    .withIndex("by_farmer", (q) => q.eq("farmerId", farmerId))
    .order("desc")
    .take(200);
  for (const l of listings) {
    if (l.status === "active" || l.status === "partially_locked") await syncListingCard(ctx, l._id);
  }
}

/**
 * Whether this buyer may buy or make an offer on a farmer's lot (the
 * commercial farmer rule): vendors and business buyers only on lots that
 * commercial farmers put on MarketSpace; verified processors and exporters
 * on every farmer lot. Other sellers' lots are not affected. Returns the
 * reason it is closed to them, or null.
 */
export async function farmerLotProblem(ctx: QueryCtx | MutationCtx, listingId: Id<"listings">, buyer: Doc<"users">): Promise<string | null> {
  const card = await ctx.db
    .query("marketCards")
    .withIndex("by_listing", (q) => q.eq("listingId", listingId))
    .first();
  if (!card || card.view !== "produce") return null;
  const open = produceVisible(card, { tier: "verified", role: buyer.role, isMine: card.sellerId === buyer._id });
  return open ? null : "This farmer sells to vendors and business buyers through their posted buying prices, not as lots.";
}

/**
 * The card of a lot listing: live while the listing is vended, not
 * withdrawn and has lots left; closed otherwise. Expiry is by time
 * (expiresAt), so a card that runs out simply stops showing. A farmer's lot
 * for sale that is not on MarketSpace (or whose time ran out) is a
 * farm-gate card instead.
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
  const seller = listing?.farmerId ? await ctx.db.get(listing.farmerId) : null;
  const isFarmer = seller?.role === "farmer";
  const forSale =
    !!listing?.farmerId &&
    !listing.withdrawnAt &&
    (listing.status === "active" || listing.status === "partially_locked") &&
    lotsAvailable > 0;
  // Farmers' lots for sale always have a card (farm-gate when not on MarketSpace); other sellers' only once vended
  const live = forSale && (isFarmer || listing?.vendExpiresAt !== undefined);

  if (!live || !listing?.farmerId) {
    if (existing && existing.status !== "closed") await ctx.db.patch(existing._id, { status: "closed", updatedAt: now });
    return;
  }
  const farmGate = isFarmer && !(listing.vendExpiresAt !== undefined && listing.vendExpiresAt > now);
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
    view: isFarmer ? ("produce" as const) : ("lots" as const),
    kind: "offer" as const,
    isBulk: !!listing.isBulk && !farmGate, // Local Bulk is a MarketSpace choice
    bulkRange: listing.isBulk && !farmGate ? listing.bulkRange : undefined,
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
    sellerCommercial: isFarmer ? await commercialStatusOf(ctx, listing.farmerId) : undefined,
    status: farmGate ? ("farm_gate" as const) : ("active" as const),
    expiresAt: listing.vendExpiresAt ?? listing.createdAt, // Farm-gate cards do not expire
    createdAt: farmGate ? listing.createdAt : listing.vendedAt ?? now,
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
