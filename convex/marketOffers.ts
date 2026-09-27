/**
 * Sell & services: buying offers, delivery bookings and cash receipts.
 *
 * - Processors post weekly buying prices per crop and form (coffee first);
 *   vendors post buying offers for foodstuffs that need no processing. An
 *   offer is valid for a week from the day it is posted.
 * - Farmers see offers in their district (free, not behind the FarmCoin gate)
 *   and book a delivery at most 5 days ahead, never past the offer's week.
 * - Buyers pay farmers in cash; the buyer side issues a receipt the farmer
 *   keeps in the app as a transaction record.
 *
 * Auth follows the project convention: the caller's user id is an argument
 * and is checked against the users table.
 */

import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import { EXPORT_CROPS, addDaysToIsoDate, centsPerLbToUsdPerKg, isIsoDate, ugxPerUsd } from "./exportMarketsShared";
import { INTAKE_FORM_KEYS } from "./processorShared";
import { MAX_BOOKING_DAYS_AHEAD, OFFER_VALID_DAYS, VENDOR_CROPS, districtKey, latestBookingDate } from "./marketOffersShared";
import { notify, todayUganda } from "./exportMarkets";
import { uniqueCode } from "./exportLots";
import { getProcessorProfile, isActiveProcessor } from "./processors";

type Ctx = QueryCtx | MutationCtx;
type BuyerKind = "processor" | "vendor";

/** Who a buyer is, as farmers see them: name, district and (for processors) the badge. */
async function buyerInfo(ctx: Ctx, user: Doc<"users">): Promise<{ kind: BuyerKind; name: string; district: string | null; verified: boolean }> {
  if (user.role === "store") {
    const p = await getProcessorProfile(ctx, user._id);
    return {
      kind: "processor",
      name: p?.facilityName ?? `Processor ${user.alias}`,
      district: p?.district ?? null,
      verified: p?.platformVerified === true && p.status === "approved",
    };
  }
  const vp = await ctx.db.query("vendorProfiles").withIndex("by_userId", (q) => q.eq("userId", user._id)).first();
  const district = user.districtText ?? (vp?.districtId ? (await ctx.db.get(vp.districtId))?.name ?? null : null);
  return { kind: "vendor", name: vp?.marketName ? `${vp.marketName}${vp.stallNumber ? `, stall ${vp.stallNumber}` : ""}` : `Vendor ${user.alias}`, district, verified: false };
}

async function farmerDistrict(ctx: Ctx, farmer: Doc<"users">): Promise<string | null> {
  if (farmer.districtText) return farmer.districtText;
  if (farmer.districtId) return (await ctx.db.get(farmer.districtId))?.name ?? null;
  return null;
}

async function requireBuyer(ctx: Ctx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user || (user.role !== "store" && user.role !== "vendor")) throw new Error("Only processors and vendors post buying offers");
  return user;
}

function isLive(o: Doc<"buyingOffers">, today: string) {
  return o.active && o.validFrom <= today && o.validUntil >= today;
}

// ------------------------------------------------------------------
// Offers (processors and vendors)
// ------------------------------------------------------------------

export const listMyOffers = query({
  args: { userId: v.id("users"), today: v.string() },
  handler: async (ctx, args) => {
    const user = await requireBuyer(ctx, args.userId);
    const today = isIsoDate(args.today) ? args.today : todayUganda();
    const offers = await ctx.db.query("buyingOffers").withIndex("by_ownerId", (q) => q.eq("ownerId", user._id)).order("desc").take(200);
    const info = await buyerInfo(ctx, user);
    return {
      kind: info.kind,
      district: info.district,
      canPost: info.kind === "vendor" ? !!info.district : await isActiveProcessor(ctx, user._id, today),
      crops:
        info.kind === "processor"
          ? EXPORT_CROPS.filter((c) => c.active).map((c) => ({ key: c.key, label: c.label, units: ["kg"] }))
          : VENDOR_CROPS,
      live: offers.filter((o) => isLive(o, today)),
      history: offers.filter((o) => !isLive(o, today)).slice(0, 30),
    };
  },
});

/** Post this week's price for a crop (and form); it replaces the previous one for the same crop, form and unit. */
export const postOffer = mutation({
  args: {
    userId: v.id("users"),
    crop: v.string(),
    form: v.optional(v.string()),
    unit: v.string(),
    priceUgx: v.number(),
    minQuantity: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireBuyer(ctx, args.userId);
    const today = todayUganda();
    const info = await buyerInfo(ctx, user);
    if (!info.district) throw new Error("Add your district to your profile first, so farmers near you can find you");
    if (info.kind === "processor") {
      if (!(await isActiveProcessor(ctx, user._id, today))) throw new Error("Only a verified, live processor can post prices");
      if (!EXPORT_CROPS.some((c) => c.key === args.crop && c.active)) throw new Error("This crop is not open yet");
      if (!args.form || !INTAKE_FORM_KEYS.includes(args.form)) throw new Error("Choose the form you buy it in (e.g. kiboko)");
      if (args.unit !== "kg") throw new Error("Processor prices are per kg");
    } else {
      const crop = VENDOR_CROPS.find((c) => c.key === args.crop);
      if (!crop) throw new Error("Choose a crop");
      if (!crop.units.includes(args.unit)) throw new Error(`Choose a unit for ${crop.label}`);
    }
    if (!(args.priceUgx > 0 && args.priceUgx < 100_000_000)) throw new Error("Price looks wrong");
    if (args.minQuantity !== undefined && !(args.minQuantity > 0)) throw new Error("Minimum quantity looks wrong");

    const mine = await ctx.db.query("buyingOffers").withIndex("by_ownerId", (q) => q.eq("ownerId", user._id)).take(500);
    for (const o of mine) {
      if (o.active && o.crop === args.crop && (o.form ?? "") === (args.form ?? "") && o.unit === args.unit) {
        await ctx.db.patch(o._id, { active: false });
      }
    }
    const offerId = await ctx.db.insert("buyingOffers", {
      ownerId: user._id,
      ownerKind: info.kind,
      crop: args.crop,
      form: info.kind === "processor" ? args.form : undefined,
      unit: args.unit,
      priceUgx: Math.round(args.priceUgx),
      minQuantity: args.minQuantity,
      district: info.district,
      districtKey: districtKey(info.district),
      validFrom: today,
      validUntil: addDaysToIsoDate(today, OFFER_VALID_DAYS - 1),
      active: true,
      notes: args.notes?.trim().slice(0, 300) || undefined,
      createdAt: getUgandaTime(),
    });
    return { offerId };
  },
});

export const withdrawOffer = mutation({
  args: { userId: v.id("users"), offerId: v.id("buyingOffers") },
  handler: async (ctx, args) => {
    const offer = await ctx.db.get(args.offerId);
    if (!offer || offer.ownerId !== args.userId) throw new Error("Offer not found");
    await ctx.db.patch(offer._id, { active: false });
    return { success: true };
  },
});

// ------------------------------------------------------------------
// Farmers: offers near me, bookings, receipts
// ------------------------------------------------------------------

/** Live offers in a district (the farmer's own by default), with the price range per crop, form and unit. */
export const listOffersNearMe = query({
  args: { userId: v.id("users"), today: v.string(), district: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const farmer = await ctx.db.get(args.userId);
    if (!farmer) return null;
    const today = isIsoDate(args.today) ? args.today : todayUganda();
    const home = await farmerDistrict(ctx, farmer);
    const district = args.district?.trim() || home || "";
    const offers = district
      ? await ctx.db.query("buyingOffers").withIndex("by_districtKey_and_active", (q) => q.eq("districtKey", districtKey(district)).eq("active", true)).take(500)
      : [];
    const rows = [];
    const owners = new Map<string, Awaited<ReturnType<typeof buyerInfo>> | null>();
    for (const o of offers) {
      if (!isLive(o, today)) continue;
      const key = String(o.ownerId);
      if (!owners.has(key)) {
        const owner = await ctx.db.get(o.ownerId);
        owners.set(key, owner && owner.state === "active" ? await buyerInfo(ctx, owner) : null);
      }
      const info = owners.get(key);
      // Only verified, live processors are shown to farmers.
      if (!info || (info.kind === "processor" && !(await isActiveProcessor(ctx, o.ownerId, today)))) continue;
      rows.push({ ...o, buyer: info, latestBookingDate: latestBookingDate(today, o.validUntil) });
    }
    rows.sort((a, b) => b.priceUgx - a.priceUgx);
    // Districts that have any live offer, for the district picker.
    const allLive = (await ctx.db.query("buyingOffers").withIndex("by_active", (q) => q.eq("active", true)).take(2000)).filter((o) => isLive(o, today));
    const districts = [...new Set(allLive.map((o) => o.district))].sort();
    return { district, homeDistrict: home, districts, offers: rows, maxDaysAhead: MAX_BOOKING_DAYS_AHEAD };
  },
});

/** World coffee reference prices converted to UGX per kg, as a guide on the price board. */
export const getWorldPricesUgx = query({
  args: {},
  handler: async (ctx) => {
    const fx = await ctx.db.query("exchangeRates").withIndex("by_base", (q) => q.eq("baseCurrency", "UGX")).first();
    const rate = ugxPerUsd(fx?.rates.USD);
    if (!rate) return { prices: [], fxAsOf: null };
    const refs = await ctx.db.query("coffeeReferencePrices").take(20);
    return {
      fxAsOf: fx?.fetchedAt ?? null,
      prices: refs.map((p) => {
        const usdKg = p.unit === "US cents/lb" ? centsPerLbToUsdPerKg(p.value) : p.value;
        return { label: p.label, ugxPerKg: Math.round(usdKg * rate), usdPerKg: Math.round(usdKg * 100) / 100, asOf: p.asOf, source: p.source };
      }),
    };
  },
});

export const bookDelivery = mutation({
  args: { userId: v.id("users"), offerId: v.id("buyingOffers"), quantity: v.number(), deliveryDate: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const farmer = await ctx.db.get(args.userId);
    if (!farmer || farmer.role !== "farmer") throw new Error("Only farmer accounts can book deliveries");
    const offer = await ctx.db.get(args.offerId);
    const today = todayUganda();
    if (!offer || !isLive(offer, today)) throw new Error("This price is no longer on offer");
    if (!(args.quantity > 0 && args.quantity < 10_000_000)) throw new Error("Quantity looks wrong");
    if (offer.minQuantity !== undefined && args.quantity < offer.minQuantity) throw new Error(`The minimum is ${offer.minQuantity} ${offer.unit}`);
    const latest = latestBookingDate(today, offer.validUntil);
    if (!isIsoDate(args.deliveryDate) || args.deliveryDate < today || args.deliveryDate > latest) {
      throw new Error(`Choose a delivery date between today and ${latest} (at most ${MAX_BOOKING_DAYS_AHEAD} days ahead, while the price is valid)`);
    }
    const bookingId = await ctx.db.insert("deliveryBookings", {
      farmerId: farmer._id,
      buyerId: offer.ownerId,
      buyerKind: offer.ownerKind,
      offerId: offer._id,
      crop: offer.crop,
      form: offer.form,
      unit: offer.unit,
      quantity: args.quantity,
      priceUgx: offer.priceUgx,
      deliveryDate: args.deliveryDate,
      status: "requested",
      farmerNote: args.note?.trim().slice(0, 500) || undefined,
      createdAt: getUgandaTime(),
    });
    await notify(ctx, offer.ownerId, "New delivery booking", `Farmer ${farmer.alias} wants to deliver ${args.quantity} ${offer.unit} on ${args.deliveryDate} at UGX ${offer.priceUgx.toLocaleString()}/${offer.unit}.`);
    return { bookingId };
  },
});

export const cancelBooking = mutation({
  args: { userId: v.id("users"), bookingId: v.id("deliveryBookings") },
  handler: async (ctx, args) => {
    const b = await ctx.db.get(args.bookingId);
    if (!b || b.farmerId !== args.userId) throw new Error("Booking not found");
    if (b.status !== "requested" && b.status !== "accepted") throw new Error("This booking can no longer be cancelled");
    await ctx.db.patch(b._id, { status: "cancelled", respondedAt: getUgandaTime() });
    await notify(ctx, b.buyerId, "Delivery booking cancelled", `A farmer cancelled the delivery booked for ${b.deliveryDate}.`);
    return { success: true };
  },
});

async function bookingRows(ctx: Ctx, bookings: Doc<"deliveryBookings">[]) {
  const rows = [];
  for (const b of bookings) {
    const buyer = await ctx.db.get(b.buyerId);
    const farmer = await ctx.db.get(b.farmerId);
    rows.push({
      ...b,
      buyer: buyer ? await buyerInfo(ctx, buyer) : null,
      farmerAlias: farmer?.alias ?? "",
      farmerDistrict: farmer ? await farmerDistrict(ctx, farmer) : null,
    });
  }
  return rows;
}

export const listMyBookings = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const bookings = await ctx.db.query("deliveryBookings").withIndex("by_farmerId", (q) => q.eq("farmerId", args.userId)).order("desc").take(100);
    return await bookingRows(ctx, bookings);
  },
});

// ------------------------------------------------------------------
// Buyers: incoming bookings and receipts
// ------------------------------------------------------------------

export const listIncomingBookings = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireBuyer(ctx, args.userId);
    const bookings = await ctx.db.query("deliveryBookings").withIndex("by_buyerId", (q) => q.eq("buyerId", args.userId)).order("desc").take(200);
    return await bookingRows(ctx, bookings);
  },
});

export const respondToBooking = mutation({
  args: { userId: v.id("users"), bookingId: v.id("deliveryBookings"), accept: v.boolean(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const b = await ctx.db.get(args.bookingId);
    if (!b || b.buyerId !== args.userId) throw new Error("Booking not found");
    if (b.status !== "requested") throw new Error("This booking was already answered");
    await ctx.db.patch(b._id, { status: args.accept ? "accepted" : "declined", buyerNote: args.note?.trim().slice(0, 500) || undefined, respondedAt: getUgandaTime() });
    await notify(
      ctx,
      b.farmerId,
      args.accept ? "Delivery booking accepted" : "Delivery booking declined",
      `${args.accept ? "Your delivery is expected" : "Your delivery was declined"} for ${b.deliveryDate} (${b.quantity} ${b.unit}).${args.note ? ` Note: ${args.note}` : ""}`
    );
    return { success: true };
  },
});

async function newReceiptNumber(ctx: MutationCtx) {
  return await uniqueCode(ctx, "RCT", async (c) => !!(await ctx.db.query("purchaseReceipts").withIndex("by_receiptNumber", (q) => q.eq("receiptNumber", c)).first()));
}

/**
 * Issue a cash receipt (the processor intake flow and the vendor purchase flow
 * both call this). Completes the linked booking.
 */
export async function issueReceipt(
  ctx: MutationCtx,
  args: {
    buyer: Doc<"users">;
    farmerId?: Id<"users">;
    farmerName: string;
    crop: string;
    form?: string;
    unit: string;
    quantity: number;
    priceUgx: number;
    paidOn: string;
    bookingId?: Id<"deliveryBookings">;
    intakeId?: Id<"processorIntakes">;
  }
) {
  if (!(args.priceUgx >= 0)) throw new Error("Enter the price paid");
  const info = await buyerInfo(ctx, args.buyer);
  if (args.bookingId) {
    const b = await ctx.db.get(args.bookingId);
    if (!b || b.buyerId !== args.buyer._id) throw new Error("Booking not found");
    if (b.status !== "requested" && b.status !== "accepted") throw new Error("This booking is already closed");
    if (args.farmerId && b.farmerId !== args.farmerId) throw new Error("This booking belongs to another farmer");
  }
  const receiptNumber = await newReceiptNumber(ctx);
  const receiptId = await ctx.db.insert("purchaseReceipts", {
    receiptNumber,
    buyerId: args.buyer._id,
    buyerKind: info.kind,
    buyerName: info.name,
    buyerDistrict: info.district ?? undefined,
    farmerId: args.farmerId,
    farmerName: args.farmerName,
    crop: args.crop,
    form: args.form,
    unit: args.unit,
    quantity: args.quantity,
    priceUgx: Math.round(args.priceUgx),
    totalUgx: Math.round(args.quantity * args.priceUgx),
    paymentMethod: "cash",
    paidOn: args.paidOn,
    bookingId: args.bookingId,
    intakeId: args.intakeId,
    createdAt: getUgandaTime(),
  });
  if (args.bookingId) await ctx.db.patch(args.bookingId, { status: "completed", receiptId, respondedAt: getUgandaTime() });
  if (args.farmerId) {
    await notify(ctx, args.farmerId, "Receipt for your delivery", `${info.name} paid you UGX ${Math.round(args.quantity * args.priceUgx).toLocaleString()} cash for ${args.quantity} ${args.unit}. Receipt ${receiptNumber} is under Sell & services.`);
  }
  return { receiptId, receiptNumber };
}

/** A vendor records buying from a farmer (on the app, or not) and issues the cash receipt. */
export const recordVendorPurchase = mutation({
  args: {
    userId: v.id("users"),
    bookingId: v.optional(v.id("deliveryBookings")),
    farmerName: v.optional(v.string()), // when the farmer is not on the app
    crop: v.string(),
    unit: v.string(),
    quantity: v.number(),
    priceUgx: v.number(),
    paidOn: v.string(),
  },
  handler: async (ctx, args) => {
    const buyer = await ctx.db.get(args.userId);
    if (!buyer || buyer.role !== "vendor") throw new Error("Only vendor accounts can do this");
    if (!isIsoDate(args.paidOn) || args.paidOn > todayUganda()) throw new Error("Choose the date paid (not in the future)");
    if (!(args.quantity > 0)) throw new Error("Quantity must be above 0");
    let farmerId: Id<"users"> | undefined;
    let farmerName = args.farmerName?.trim() ?? "";
    if (args.bookingId) {
      const b = await ctx.db.get(args.bookingId);
      if (!b || b.buyerId !== buyer._id) throw new Error("Booking not found");
      farmerId = b.farmerId;
      farmerName = `Farmer ${(await ctx.db.get(b.farmerId))?.alias ?? ""}`.trim();
    }
    if (!farmerName) throw new Error("Name the farmer you paid");
    return await issueReceipt(ctx, { buyer, farmerId, farmerName, crop: args.crop, unit: args.unit, quantity: args.quantity, priceUgx: args.priceUgx, paidOn: args.paidOn, bookingId: args.bookingId });
  },
});

/** Receipts for the caller: as the farmer paid, or as the processor or vendor who paid. */
export const listMyReceipts = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];
    if (user.role === "store" || user.role === "vendor") {
      return await ctx.db.query("purchaseReceipts").withIndex("by_buyerId", (q) => q.eq("buyerId", user._id)).order("desc").take(300);
    }
    return await ctx.db.query("purchaseReceipts").withIndex("by_farmerId", (q) => q.eq("farmerId", user._id)).order("desc").take(300);
  },
});
