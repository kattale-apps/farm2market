/**
 * Lot orders: buying a lot from a farmer, vendor or processor listing.
 *
 * The journey (rules and maths in convex/lotOrdersShared.ts):
 *   1. A verified buyer commits the seller's share of the price from their
 *      wallet into escrow (capital_lock), at the posted price or an accepted
 *      offer. The lot is locked to them.
 *   2. The seller marks each step done with a photo. Each finished step
 *      charges its share from the buyer's wallet into escrow. When the
 *      wallet is short the buyer is alerted and has 48 hours to pay;
 *      otherwise the order is penalised: half of escrow is a fine (half to
 *      the seller, half to the platform) and the rest goes back to the buyer.
 *   3. The last step is the handover (collection at the farm gate or store).
 *      It needs the whole price in escrow. The buyer confirms collection, or
 *      the order settles 3 days after handover.
 *   4. Settlement pays the seller in one profit_credit. Nothing reaches the
 *      seller's wallet before that; what the finished steps have earned shows
 *      as pending. Exporters, processors and vendors get the lot as stock.
 *   5. Either party can ask an admin to cancel or report a problem; a super
 *      or finance admin decides the split.
 *
 * Money moves only through postWallet (convex/walletSplit.ts) so every entry
 * keeps its demo share. Auth follows the project convention: the caller's
 * user id is an argument and is checked against the users table.
 */

import { v, ConvexError } from "convex/values";
import { internalMutation, mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { generateUTID, getUgandaTime, calculateTraderExposureInternal, getTraderCommissionPercentage } from "./utils";
import { MAX_TRADER_EXPOSURE_UGX } from "./constants";
import { checkPilotMode } from "./pilotMode";
import { ensureTraderCapital } from "./wallet";
import { findLock, postWallet } from "./walletSplit";
import { isActiveProcessor } from "./processors";
import { todayUganda } from "./exportMarkets";
import { roleLabel } from "./roleLabels";
import { assertEvidencePhotos, evidencePhotoValidator } from "./evidencePhotos";
import { spendCapExceededError, throwAppError } from "./errors";
import {
  AUTO_SETTLE_MS,
  PAYMENT_GRACE_MS,
  lotBuyingDecision,
  chargeForStep,
  commitAmount,
  defaultPlan,
  demoShares,
  earnedSoFar,
  nextStepIndex,
  penaltySplit,
} from "./lotOrdersShared";

type Ctx = QueryCtx | MutationCtx;
type Order = Doc<"lotOrders">;

const OPEN_STATUSES: Order["status"][] = ["in_progress", "payment_due", "awaiting_collection_confirm", "disputed"];
const STOCK_HOLDER_ROLES = ["trader", "transporter", "store", "vendor"];

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/** Who can buy lots: verified exporters, processors, vendors and business buyers. */
export async function lotBuyingAccess(
  ctx: Ctx,
  user: Doc<"users"> | null,
  today: string
): Promise<{ ok: boolean; reason?: string }> {
  // A processor whose facility the platform approved is already verified.
  const approvedProcessor = user?.role === "store" && user.verificationStatus !== "verified"
    ? await isActiveProcessor(ctx, user._id, today)
    : false;
  return lotBuyingDecision(user, approvedProcessor);
}

async function walletBalance(ctx: Ctx, userId: Id<"users">): Promise<number> {
  const last = await ctx.db
    .query("walletLedger")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .first();
  return last?.balanceAfter ?? 0;
}

/** ConvexError (not Error) so the shortfall survives production error redaction and the app can offer a top-up. */
function walletShort(required: number, available: number) {
  return new ConvexError({
    code: "INSUFFICIENT_WALLET_BALANCE",
    message:
      `Not enough money in your wallet. Needed: UGX ${Math.round(required).toLocaleString()}, ` +
      `available: UGX ${Math.round(available).toLocaleString()}. Top up your wallet first.`,
    required,
    available,
    shortfall: required - available,
  });
}

async function notify(ctx: MutationCtx, userId: Id<"users">, title: string, message: string, utid: string) {
  await ctx.db.insert("notifications", {
    userId,
    type: "utid_specific",
    title,
    message,
    utid,
    read: false,
    createdAt: getUgandaTime(),
  });
}

/** "Exporter E-123": how each side of an order appears to the other. */
async function partyLabel(ctx: Ctx, userId: Id<"users">): Promise<string> {
  const user = await ctx.db.get(userId);
  return user ? `${roleLabel(user.role)} ${user.alias ?? ""}`.trim() : "";
}

const ugx = (n: number) => `UGX ${Math.round(n).toLocaleString()}`;

/** Sets a listing's status from its lots. Older delivered lots kept status "locked". */
export async function refreshListingStatus(ctx: MutationCtx, listingId: Id<"listings">) {
  const listing = await ctx.db.get(listingId);
  if (!listing) return;
  const units = await ctx.db
    .query("listingUnits")
    .withIndex("by_listing", (q) => q.eq("listingId", listingId))
    .collect();
  const delivered = units.filter((u) => u.status === "delivered" || u.deliveryStatus === "delivered").length;
  const locked = units.filter((u) => u.status === "locked" && u.deliveryStatus !== "delivered").length;
  const available = units.filter((u) => u.status === "available").length;
  const status: Doc<"listings">["status"] =
    available > 0
      ? locked + delivered > 0
        ? "partially_locked"
        : "active"
      : locked > 0
        ? "fully_locked"
        : delivered > 0
          ? "delivered"
          : "cancelled";
  if (listing.status !== status) await ctx.db.patch(listingId, { status });
}

/** Demo money held in an order's escrow, from its locks. */
async function escrowDemo(ctx: Ctx, order: Order): Promise<number> {
  let demo = 0;
  for (const utid of order.lockUtids) {
    demo += (await findLock(ctx, utid))?.demoAmount ?? 0;
  }
  return demo;
}

/** Takes `amount` from the buyer's wallet into the order's escrow. */
async function chargeBuyer(ctx: MutationCtx, order: Order, amount: number, what: string) {
  const utid = generateUTID(order.buyerRole);
  await postWallet(ctx, {
    userId: order.buyerId,
    utid,
    type: "capital_lock",
    amount,
    rule: { kind: "demo_first" },
    metadata: {
      type: "lot_order_payment",
      orderId: order._id,
      orderUtid: order.utid,
      produceType: order.produceType,
      what,
    },
  });
  return utid;
}

async function paymentAdmins(ctx: Ctx): Promise<Id<"users">[]> {
  const admins = await ctx.db
    .query("users")
    .withIndex("by_role", (q) => q.eq("role", "admin"))
    .take(500);
  return admins
    .filter((a) => a.adminLevel === "super" || a.adminLevel === undefined || a.adminCategory === "finance")
    .map((a) => a._id);
}

function assertMoneyAdmin(admin: Doc<"users"> | null) {
  const ok =
    admin?.role === "admin" &&
    (admin.adminLevel === "super" || admin.adminLevel === undefined || admin.adminCategory === "finance");
  if (!ok) throw new Error("Only a super admin or finance admin can settle lot orders");
}

/**
 * A lot bought by an exporter, processor or vendor becomes their stock,
 * traced to the lot it came from (export lots read listingUnitIds).
 */
async function addToStock(ctx: MutationCtx, order: Order, now: number) {
  if (!STOCK_HOLDER_ROLES.includes(order.buyerRole)) return;
  const listing = await ctx.db.get(order.listingId);
  const isExporter = order.buyerRole === "trader" || order.buyerRole === "transporter";
  await ctx.db.insert("traderInventory", {
    traderId: order.buyerId,
    listingUnitIds: [order.unitId],
    totalKilos: order.lotKg,
    blockSize: 100,
    produceType: order.produceType,
    deliveryProcessorId: listing?.deliveryProcessorId,
    qualityRating: listing?.qualityRating,
    unitPrice: order.settledPricePerKilo,
    acquiredAt: now,
    storageStartTime: now,
    status: "in_storage",
    utid: order.utid,
    is100kgBlock: false,
    ownerRole: isExporter ? undefined : order.buyerRole,
    source: "in_app",
    lotOrderId: order._id,
  });
  // Only exporters' stock is pooled into 100kg blocks for buyers.
  if (isExporter) {
    await ctx.runMutation(internal.inventoryBlocks.checkAndCreate100kgBlocks, { traderId: order.buyerId });
  }
}

/** The lot was collected: it is delivered on the unit and in both ledgers. */
async function markDelivered(ctx: MutationCtx, order: Order, now: number) {
  await ctx.db.patch(order.unitId, { status: "delivered", deliveryStatus: "delivered" });
  await addToStock(ctx, order, now);
  await refreshListingStatus(ctx, order.listingId);
}

/** The order ended without a sale: the lot goes back on the market, unless the seller withdrew the listing. */
async function releaseLot(ctx: MutationCtx, order: Order) {
  const listing = await ctx.db.get(order.listingId);
  await ctx.db.patch(order.unitId, {
    status: listing?.withdrawnAt ? "cancelled" : "available",
    lockedBy: undefined,
    lockedAt: undefined,
    lockUtid: undefined,
    deliveryDeadline: undefined,
    deliveryStatus: undefined,
    activeNegotiationId: undefined,
    lotOrderId: undefined,
  });
  await refreshListingStatus(ctx, order.listingId);
}

/** Pays escrow out: `toSeller` as a credit, the rest back to the buyer. Demo shares follow the money. */
async function payOut(
  ctx: MutationCtx,
  order: Order,
  toSeller: number,
  toBuyer: number,
  utid: string,
  reason: string,
  now: number
) {
  const demo = await escrowDemo(ctx, order);
  const [sellerDemo, buyerDemo] = demoShares(demo, order.paidAmount, [toSeller, toBuyer]);
  const metadata = { orderId: order._id, orderUtid: order.utid, produceType: order.produceType, reason };
  if (toSeller > 0) {
    await postWallet(ctx, {
      userId: order.sellerId,
      utid,
      type: "profit_credit",
      amount: toSeller,
      rule: { kind: "exact", demoAmount: sellerDemo },
      timestamp: now,
      metadata: { ...metadata, type: "lot_order_settlement" },
    });
  }
  if (toBuyer > 0) {
    await postWallet(ctx, {
      userId: order.buyerId,
      utid: `${utid}-R`,
      type: "capital_unlock",
      amount: toBuyer,
      rule: { kind: "exact", demoAmount: buyerDemo },
      timestamp: now,
      metadata: { ...metadata, type: "lot_order_refund", reversedLockUtids: order.lockUtids },
    });
  }
}

/** The buyer collected (or 3 days passed): the whole escrow goes to the seller. */
async function settle(ctx: MutationCtx, order: Order, confirmedBy: Id<"users"> | null) {
  const now = getUgandaTime();
  const settleUtid = generateUTID("system");
  await payOut(ctx, order, order.paidAmount, 0, settleUtid, confirmedBy ? "collected" : "auto_settled", now);

  const milestones = order.milestones.map((m) =>
    m.handover && !m.doneAt ? { ...m, doneAt: now, doneBy: confirmedBy ?? undefined } : m
  );
  await ctx.db.patch(order._id, {
    milestones,
    status: "settled",
    toSeller: order.paidAmount,
    toBuyer: 0,
    settleUtid,
    closedAt: now,
    updatedAt: now,
  });
  await markDelivered(ctx, order, now);

  const kg = `${order.lotKg.toLocaleString()} kg ${order.produceType}`;
  await notify(ctx, order.sellerId, "Paid for your lot",
    `${ugx(order.paidAmount)} for ${kg} is now in your wallet${confirmedBy ? "" : " (the buyer did not reply within 3 days)"}.`, order.utid);
  await notify(ctx, order.buyerId, "Lot collected",
    `${kg} is marked collected and the seller has been paid${STOCK_HOLDER_ROLES.includes(order.buyerRole) ? ". It is now in your stock" : ""}.`, order.utid);
}

/** The buyer missed a payment for 48 hours: half of escrow is fined, the rest goes back. */
async function penalise(ctx: MutationCtx, order: Order) {
  const now = getUgandaTime();
  const { fineToSeller, fineToPlatform, toBuyer } = penaltySplit(order.paidAmount);
  const utid = generateUTID("system");
  // The platform's half stays out of both wallets; it is recorded on the order.
  await payOut(ctx, order, fineToSeller, toBuyer, utid, "missed_payment_penalty", now);
  await ctx.db.patch(order._id, {
    status: "penalised",
    toSeller: fineToSeller,
    toBuyer,
    fineToSeller,
    fineToPlatform,
    settleUtid: utid,
    closedAt: now,
    updatedAt: now,
  });
  await releaseLot(ctx, order);

  await notify(ctx, order.buyerId, "Order cancelled: payment missed",
    `You did not pay ${ugx(order.paymentDueAmount ?? 0)} within 48 hours, so your ${order.produceType} order was cancelled. ` +
      `A fine of ${ugx(fineToSeller + fineToPlatform)} was kept and ${ugx(toBuyer)} returned to your wallet.`, order.utid);
  await notify(ctx, order.sellerId, "Order cancelled: buyer missed a payment",
    `The buyer did not pay in time. ${ugx(fineToSeller)} compensation is in your wallet and the lot is back on the market.`, order.utid);
}

// ------------------------------------------------------------------
// Buyer: commit, pay, confirm
// ------------------------------------------------------------------

/**
 * Commits the seller's share of each lot's price into escrow and locks the
 * lots. Shared with payments.lockUnit, which older screens still call.
 */
export async function commitLots(ctx: MutationCtx, buyerId: Id<"users">, unitIds: Id<"listingUnits">[]) {
  const ids = [...new Set(unitIds)];
  if (ids.length < 1 || ids.length > 50) throw new Error("Choose between 1 and 50 lots");
  const buyer = await ctx.db.get(buyerId);
  const access = await lotBuyingAccess(ctx, buyer, todayUganda());
  if (!buyer || !access.ok) throw new Error(access.reason);

  let listing: Doc<"listings"> | null = null;
  const lots: { unit: Doc<"listingUnits">; price: number; negotiationId?: Id<"negotiations"> }[] = [];
  for (const unitId of ids) {
    const unit = await ctx.db.get(unitId);
    if (!unit || unit.status !== "available") throw new Error("A lot you chose is no longer available");
    if (!listing) listing = await ctx.db.get(unit.listingId);
    else if (listing._id !== unit.listingId) throw new Error("Choose lots from one listing at a time");
    if (!listing?.farmerId) throw new Error("Listing not found");
    if (listing.status !== "active" && listing.status !== "partially_locked") throw new Error("This listing is no longer for sale");
    if (listing.listingMode === "packaging") throw new Error("Packaged items are bought from the shop, not as lots");
    if (listing.farmerId === buyerId) throw new Error("You cannot buy your own lots");

    // The price: this buyer's accepted offer, otherwise the posted price.
    let price = listing.pricePerKilo;
    let negotiationId: Id<"negotiations"> | undefined;
    if (unit.activeNegotiationId) {
      const negotiation = await ctx.db.get(unit.activeNegotiationId);
      if (negotiation?.status === "accepted") {
        if (negotiation.traderId !== buyerId) throw new Error(`Lot #${unit.unitNumber} is held for another buyer's accepted offer`);
        price = negotiation.currentPricePerKilo;
        negotiationId = negotiation._id;
      } else if (negotiation && (negotiation.status === "pending" || negotiation.status === "countered")) {
        throw new Error(
          negotiation.traderId === buyerId
            ? `Wait for the seller to answer your offer on lot #${unit.unitNumber}`
            : `Lot #${unit.unitNumber} has an offer waiting for the seller's answer`
        );
      }
    }
    if (!(price > 0)) throw new Error("This lot has no price yet");
    lots.push({ unit, price, negotiationId });
  }
  if (!listing?.farmerId) throw new Error("Listing not found");
  const seller = await ctx.db.get(listing.farmerId);
  if (!seller) throw new Error("Seller not found");

  const commitPercent = listing.commitPercent ?? 100;
  const plan = listing.milestonePlan ?? defaultPlan(seller.role, commitPercent);
  const lotKg = listing.unitSize || 10;
  const priced = lots.map((l) => {
    const totalAmount = Math.round(l.price * lotKg);
    return { ...l, totalAmount, committed: commitAmount(totalAmount, commitPercent) };
  });
  const committedTotal = priced.reduce((sum, l) => sum + l.committed, 0);

  // Exporters keep their commission and spend cap.
  const isExporter = buyer.role === "trader" || buyer.role === "transporter";
  let commission = 0;
  let commissionPercentage = 0;
  if (isExporter) {
    await ensureTraderCapital(ctx, buyerId);
    commissionPercentage = await getTraderCommissionPercentage({ db: ctx.db });
    const value = priced.reduce((sum, l) => sum + l.totalAmount, 0);
    commission = commissionPercentage > 0 ? Math.round((value * commissionPercentage) / 100) : 0;
    const exposure = await calculateTraderExposureInternal(ctx, buyerId);
    if (exposure.totalExposure + committedTotal + commission > (buyer.customSpendCap || MAX_TRADER_EXPOSURE_UGX)) {
      throwAppError(spendCapExceededError());
    }
  }
  const balance = await walletBalance(ctx, buyerId);
  if (balance < committedTotal + commission) throw walletShort(committedTotal + commission, balance);

  const now = getUgandaTime();
  const orders: { orderId: Id<"lotOrders">; utid: string; unitId: Id<"listingUnits">; unitNumber: number; totalAmount: number; committed: number }[] = [];
  for (const lot of priced) {
    const utid = generateUTID(buyer.role);
    await postWallet(ctx, {
      userId: buyerId,
      utid,
      type: "capital_lock",
      amount: lot.committed,
      rule: { kind: "demo_first" },
      timestamp: now,
      metadata: {
        type: "lot_order_commit",
        unitId: lot.unit._id,
        listingId: listing._id,
        produceType: listing.produceType,
        commitPercent,
        totalAmount: lot.totalAmount,
      },
    });
    const orderId = await ctx.db.insert("lotOrders", {
      utid,
      listingId: listing._id,
      unitId: lot.unit._id,
      sellerId: seller._id,
      buyerId,
      sellerRole: seller.role,
      buyerRole: buyer.role,
      produceType: listing.produceType,
      lotKg,
      postedPricePerKilo: listing.pricePerKilo,
      settledPricePerKilo: lot.price,
      totalAmount: lot.totalAmount,
      negotiationId: lot.negotiationId,
      commitPercent,
      paidAmount: lot.committed,
      lockUtids: [utid],
      milestones: plan.map((s) => ({ ...s })),
      status: "in_progress",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(lot.unit._id, {
      status: "locked",
      lockedBy: buyerId,
      lockedAt: now,
      lockUtid: utid,
      deliveryStatus: "pending",
      activeNegotiationId: undefined,
      lotOrderId: orderId,
    });
    orders.push({ orderId, utid, unitId: lot.unit._id, unitNumber: lot.unit.unitNumber, totalAmount: lot.totalAmount, committed: lot.committed });
  }

  if (commission > 0) {
    await postWallet(ctx, {
      userId: buyerId,
      utid: `${orders[0].utid}-COMM`,
      type: "trader_commission_deduction",
      amount: commission,
      rule: { kind: "demo_first" },
      timestamp: now,
      metadata: { mainUtid: orders[0].utid, listingId: listing._id, commissionPercentage },
    });
  }
  await refreshListingStatus(ctx, listing._id);

  await notify(ctx, seller._id, "A buyer committed to your lots",
    `${await partyLabel(ctx, buyerId)} put ${ugx(committedTotal)} (${commitPercent}%) into escrow for ${orders.length} lot(s) of ${listing.produceType}. ` +
      `Start with "${plan[0].name}" in your ledger; each step you finish brings in its share of the price.`, orders[0].utid);

  return {
    orders,
    committedTotal,
    commission,
    commissionPercentage,
    commitPercent,
    balanceAfter: await walletBalance(ctx, buyerId),
  };
}

export const commit = mutation({
  args: {
    buyerId: v.id("users"),
    unitIds: v.array(v.id("listingUnits")),
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);
    return await commitLots(ctx, args.buyerId, args.unitIds);
  },
});

async function loadOrder(ctx: Ctx, orderId: Id<"lotOrders">, userId: Id<"users">, side: "buyer" | "seller" | "either") {
  const order = await ctx.db.get(orderId);
  if (!order) throw new Error("Order not found");
  const isBuyer = order.buyerId === userId;
  const isSeller = order.sellerId === userId;
  if ((side === "buyer" && !isBuyer) || (side === "seller" && !isSeller) || (side === "either" && !isBuyer && !isSeller)) {
    throw new Error("This order is not yours");
  }
  return order;
}

/** The buyer pays the share that fell due when a step was finished. */
export const payDue = mutation({
  args: { buyerId: v.id("users"), orderId: v.id("lotOrders") },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);
    const order = await loadOrder(ctx, args.orderId, args.buyerId, "buyer");
    if (order.status !== "payment_due" || !order.paymentDueAmount) throw new Error("Nothing is due on this order");
    const amount = order.paymentDueAmount;
    const balance = await walletBalance(ctx, args.buyerId);
    if (balance < amount) throw walletShort(amount, balance);
    const utid = await chargeBuyer(ctx, order, amount, "payment_due");
    await ctx.db.patch(order._id, {
      paidAmount: order.paidAmount + amount,
      lockUtids: [...order.lockUtids, utid],
      status: "in_progress",
      paymentDueAmount: undefined,
      paymentDueBy: undefined,
      paymentDueStep: undefined,
      updatedAt: getUgandaTime(),
    });
    await notify(ctx, order.sellerId, "Buyer paid", `The buyer paid ${ugx(amount)} into escrow. You can carry on with the next step.`, order.utid);
    return { paid: amount };
  },
});

/** The buyer puts the rest of the price into escrow early. */
export const payAll = mutation({
  args: { buyerId: v.id("users"), orderId: v.id("lotOrders") },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);
    const order = await loadOrder(ctx, args.orderId, args.buyerId, "buyer");
    if (order.status !== "in_progress" && order.status !== "payment_due") throw new Error("This order cannot take payments now");
    const amount = order.totalAmount - order.paidAmount;
    if (amount <= 0) throw new Error("This order is already paid in full");
    const balance = await walletBalance(ctx, args.buyerId);
    if (balance < amount) throw walletShort(amount, balance);
    const utid = await chargeBuyer(ctx, order, amount, "pay_all");
    await ctx.db.patch(order._id, {
      paidAmount: order.totalAmount,
      lockUtids: [...order.lockUtids, utid],
      status: "in_progress",
      paymentDueAmount: undefined,
      paymentDueBy: undefined,
      paymentDueStep: undefined,
      updatedAt: getUgandaTime(),
    });
    await notify(ctx, order.sellerId, "Paid in full", `The buyer put the whole price (${ugx(order.totalAmount)}) into escrow.`, order.utid);
    return { paid: amount };
  },
});

/** The buyer confirms they collected the lot; escrow settles to the seller. */
export const confirmCollected = mutation({
  args: { buyerId: v.id("users"), orderId: v.id("lotOrders") },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);
    const order = await loadOrder(ctx, args.orderId, args.buyerId, "buyer");
    if (order.status !== "awaiting_collection_confirm") throw new Error("The seller has not handed this lot over yet");
    await settle(ctx, order, args.buyerId);
    return { settled: order.paidAmount };
  },
});

// ------------------------------------------------------------------
// Seller: steps
// ------------------------------------------------------------------

/**
 * The seller finishes their next step, with photo proof. A working step
 * charges its share from the buyer; the handover needs the whole price in
 * escrow first.
 */
export const markStepDone = mutation({
  args: {
    sellerId: v.id("users"),
    orderId: v.id("lotOrders"),
    photos: v.array(evidencePhotoValidator),
  },
  handler: async (ctx, args) => {
    await checkPilotMode(ctx);
    const order = await loadOrder(ctx, args.orderId, args.sellerId, "seller");
    if (order.status === "payment_due") throw new Error("Waiting for the buyer's payment before the next step");
    if (order.status !== "in_progress") throw new Error("This order is not waiting for your steps");
    const index = nextStepIndex(order.milestones);
    if (index < 0) throw new Error("All steps are done");
    assertEvidencePhotos(args.photos, 6);

    const now = getUgandaTime();
    const step = order.milestones[index];
    const milestones = [...order.milestones];
    let paidAmount = order.paidAmount;
    const lockUtids = [...order.lockUtids];
    const balance = await walletBalance(ctx, order.buyerId);
    const kg = `${order.lotKg.toLocaleString()} kg ${order.produceType}`;

    if (step.handover) {
      // The goods change hands only with the whole price in escrow.
      const due = order.totalAmount - paidAmount;
      if (due > 0) {
        if (balance < due) {
          await ctx.db.patch(order._id, {
            status: "payment_due",
            paymentDueAmount: due,
            paymentDueBy: now + PAYMENT_GRACE_MS,
            paymentDueStep: index,
            updatedAt: now,
          });
          await notify(ctx, order.buyerId, "Payment due within 48 hours",
            `The seller is ready to hand over ${kg}. Pay ${ugx(due)} into escrow within 48 hours, or the order is cancelled with a fine.`, order.utid);
          return { status: "payment_due" as const, due };
        }
        lockUtids.push(await chargeBuyer(ctx, order, due, step.name));
        paidAmount += due;
      }
      milestones[index] = { ...step, handedOverAt: now, doneBy: args.sellerId, photos: args.photos };
      await ctx.db.patch(order._id, {
        milestones,
        paidAmount,
        lockUtids,
        status: "awaiting_collection_confirm",
        handedOverAt: now,
        updatedAt: now,
      });
      await notify(ctx, order.buyerId, "Confirm you collected your lot",
        `The seller handed over ${kg}. Confirm collection in your ledger, or report a problem within 3 days; after that the seller is paid automatically.`, order.utid);
      return { status: "awaiting_collection_confirm" as const, due: 0 };
    }

    // A working step: it is done now, and its share of the price falls due.
    milestones[index] = { ...step, doneAt: now, doneBy: args.sellerId, photos: args.photos };
    const charge = chargeForStep(order.totalAmount, order.commitPercent, order.milestones.map((m) => m.payPercent), index);
    if (charge > 0 && balance < charge) {
      await ctx.db.patch(order._id, {
        milestones,
        status: "payment_due",
        paymentDueAmount: charge,
        paymentDueBy: now + PAYMENT_GRACE_MS,
        paymentDueStep: index,
        updatedAt: now,
      });
      await notify(ctx, order.buyerId, "Payment due within 48 hours",
        `"${step.name}" is done for ${kg}. Your wallet is short: top up and pay ${ugx(charge)} within 48 hours, or the order is cancelled with a fine.`, order.utid);
      await notify(ctx, order.sellerId, "Waiting for the buyer's payment",
        `"${step.name}" is recorded. The buyer has 48 hours to pay ${ugx(charge)} before you carry on.`, order.utid);
      return { status: "payment_due" as const, due: charge };
    }
    if (charge > 0) {
      lockUtids.push(await chargeBuyer(ctx, order, charge, step.name));
      paidAmount += charge;
    }
    await ctx.db.patch(order._id, { milestones, paidAmount, lockUtids, updatedAt: now });
    await notify(ctx, order.buyerId, `"${step.name}" done`,
      charge > 0
        ? `"${step.name}" is done for ${kg}. ${ugx(charge)} moved from your wallet into escrow.`
        : `"${step.name}" is done for ${kg}.`, order.utid);
    return { status: "in_progress" as const, due: 0, charged: charge };
  },
});

// ------------------------------------------------------------------
// Problems and admin decisions
// ------------------------------------------------------------------

/** Either side asks an admin to cancel, or reports a problem. The order waits for an admin. */
export const raiseDispute = mutation({
  args: {
    userId: v.id("users"),
    orderId: v.id("lotOrders"),
    kind: v.union(v.literal("cancel"), v.literal("problem")),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await loadOrder(ctx, args.orderId, args.userId, "either");
    if (!["in_progress", "payment_due", "awaiting_collection_confirm"].includes(order.status)) {
      throw new Error("This order cannot be disputed now");
    }
    const reason = args.reason.trim().slice(0, 500);
    if (reason.length < 3) throw new Error("Say briefly what is wrong");
    const now = getUgandaTime();
    await ctx.db.patch(order._id, {
      status: "disputed",
      disputeKind: args.kind,
      disputeReason: reason,
      disputedBy: args.userId,
      disputedAt: now,
      updatedAt: now,
    });
    const other = order.buyerId === args.userId ? order.sellerId : order.buyerId;
    const what = args.kind === "cancel" ? "asked an admin to cancel" : "reported a problem with";
    await notify(ctx, other, "Order sent to an admin", `${await partyLabel(ctx, args.userId)} ${what} your ${order.produceType} order: "${reason}". An admin will decide.`, order.utid);
    for (const adminId of await paymentAdmins(ctx)) {
      await notify(ctx, adminId, "Lot order needs a decision", `Order ${order.utid}: ${reason}`, order.utid);
    }
    return { status: "disputed" as const };
  },
});

/**
 * A super or finance admin closes an order: how much of escrow goes to the
 * seller (the rest back to the buyer), and whether the lot was delivered or
 * goes back on the market. Also the only way to reverse a failed delivery.
 */
export const resolveOrder = mutation({
  args: {
    adminId: v.id("users"),
    orderId: v.id("lotOrders"),
    outcome: v.union(v.literal("delivered"), v.literal("cancelled")),
    toSeller: v.number(),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.adminId);
    assertMoneyAdmin(admin);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (!OPEN_STATUSES.includes(order.status)) throw new Error("This order is already closed");
    const toSeller = Math.round(args.toSeller);
    if (!(toSeller >= 0) || toSeller > order.paidAmount) {
      throw new Error(`The seller's share must be between 0 and ${ugx(order.paidAmount)}`);
    }
    const note = args.note.trim();
    if (!note) throw new Error("Write a short note on the decision");
    const toBuyer = order.paidAmount - toSeller;
    const now = getUgandaTime();
    const utid = generateUTID("admin");

    await payOut(ctx, order, toSeller, toBuyer, utid, `admin_${args.outcome}`, now);
    await ctx.db.patch(order._id, {
      status: args.outcome === "delivered" ? "settled" : "cancelled",
      toSeller,
      toBuyer,
      settleUtid: utid,
      resolvedBy: args.adminId,
      resolutionNote: note,
      paymentDueAmount: undefined,
      paymentDueBy: undefined,
      paymentDueStep: undefined,
      closedAt: now,
      updatedAt: now,
    });
    if (args.outcome === "delivered") await markDelivered(ctx, order, now);
    else await releaseLot(ctx, order);

    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      actionType: "resolve_lot_order",
      utid,
      reason: note,
      metadata: { orderId: order._id, orderUtid: order.utid, outcome: args.outcome, toSeller, toBuyer },
      timestamp: now,
    });
    const decision = `An admin ${args.outcome === "delivered" ? "settled" : "cancelled"} your ${order.produceType} order: ${note}.`;
    await notify(ctx, order.sellerId, "Admin decision on your order", `${decision} ${ugx(toSeller)} paid to you.`, order.utid);
    await notify(ctx, order.buyerId, "Admin decision on your order", `${decision} ${ugx(toBuyer)} returned to you.`, order.utid);
    return { toSeller, toBuyer };
  },
});

/** Hourly: settle lots 3 days after handover, and penalise payments 48 hours overdue. */
export const runScheduled = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = getUgandaTime();
    const toSettle = await ctx.db
      .query("lotOrders")
      .withIndex("by_status_handover", (q) => q.eq("status", "awaiting_collection_confirm").lt("handedOverAt", now - AUTO_SETTLE_MS))
      .take(50);
    for (const order of toSettle) await settle(ctx, order, null);

    const overdue = await ctx.db
      .query("lotOrders")
      .withIndex("by_status_due", (q) => q.eq("status", "payment_due").lt("paymentDueBy", now))
      .take(50);
    for (const order of overdue) await penalise(ctx, order);

    return { settled: toSettle.length, penalised: overdue.length };
  },
});

// ------------------------------------------------------------------
// Reads
// ------------------------------------------------------------------

/** Lots for sale from farmers, vendors and processors, for verified buyers only. */
export const marketLots = query({
  args: { userId: v.id("users"), today: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    const access = await lotBuyingAccess(ctx, user, args.today);
    if (!access.ok) return { eligible: false, reason: access.reason ?? null, lots: [] };

    const [open, partlySold] = await Promise.all([
      ctx.db.query("listings").withIndex("by_status", (q) => q.eq("status", "active")).order("desc").take(200),
      ctx.db.query("listings").withIndex("by_status", (q) => q.eq("status", "partially_locked")).order("desc").take(200),
    ]);
    const labels = new Map<string, { label: string; role: string }>();
    const lots = [];
    for (const listing of [...open, ...partlySold]) {
      if (!listing.farmerId || listing.farmerId === args.userId || listing.listingMode === "packaging") continue;
      const units = await ctx.db
        .query("listingUnits")
        .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
        .collect();
      const available = units.filter((u) => u.status === "available");
      if (available.length === 0) continue;
      if (!labels.has(listing.farmerId)) {
        const seller = await ctx.db.get(listing.farmerId);
        labels.set(listing.farmerId, { label: await partyLabel(ctx, listing.farmerId), role: seller?.role ?? "farmer" });
      }
      const seller = labels.get(listing.farmerId)!;
      const commitPercent = listing.commitPercent ?? 100;
      const firstPhoto = listing.photos?.[0];
      lots.push({
        listingId: listing._id,
        utid: listing.utid,
        produceType: listing.produceType,
        sellerLabel: seller.label,
        sellerRole: seller.role,
        lotKg: listing.unitSize || 10,
        bagKg: listing.bagKg ?? null,
        bagsPerLot: listing.bagsPerLot ?? null,
        lotsAvailable: available.length,
        // Lots nobody is negotiating on, so they can be bought at the posted price.
        freeUnitIds: available.filter((u) => !u.activeNegotiationId).slice(0, 50).map((u) => u._id),
        pricePerKilo: listing.pricePerKilo,
        commitPercent,
        steps: listing.milestonePlan ?? defaultPlan(seller.role, commitPercent),
        qualityRating: listing.qualityRating ?? null,
        stockSource: listing.stockSource ?? (seller.role === "farmer" ? "own_farm" : null),
        photoUrl: firstPhoto ? await ctx.storage.getUrl(firstPhoto.storageId) : null,
        createdAt: listing.createdAt,
      });
    }
    lots.sort((a, b) => b.createdAt - a.createdAt);
    return { eligible: true, reason: null, lots };
  },
});

function orderCard(order: Order, otherLabel: string) {
  const pays = order.milestones.map((m) => m.payPercent);
  const next = nextStepIndex(order.milestones);
  return {
    orderId: order._id,
    utid: order.utid,
    listingId: order.listingId,
    produceType: order.produceType,
    lotKg: order.lotKg,
    otherLabel,
    postedPricePerKilo: order.postedPricePerKilo,
    settledPricePerKilo: order.settledPricePerKilo,
    totalAmount: order.totalAmount,
    commitPercent: order.commitPercent,
    commitAmount: commitAmount(order.totalAmount, order.commitPercent),
    paidAmount: order.paidAmount,
    earnedSoFar: earnedSoFar(order.totalAmount, order.milestones),
    steps: order.milestones.map((m, i) => ({
      name: m.name,
      earnPercent: m.earnPercent,
      payPercent: m.payPercent,
      payAmount: chargeForStep(order.totalAmount, order.commitPercent, pays, i),
      handover: m.handover,
      doneAt: m.doneAt ?? null,
      handedOverAt: m.handedOverAt ?? null,
      photoCount: m.photos?.length ?? 0,
    })),
    nextStep: next,
    status: order.status,
    paymentDueAmount: order.paymentDueAmount ?? null,
    paymentDueBy: order.paymentDueBy ?? null,
    handedOverAt: order.handedOverAt ?? null,
    autoSettleAt: order.handedOverAt ? order.handedOverAt + AUTO_SETTLE_MS : null,
    disputeReason: order.disputeReason ?? null,
    toSeller: order.toSeller ?? null,
    toBuyer: order.toBuyer ?? null,
    fineToSeller: order.fineToSeller ?? null,
    fineToPlatform: order.fineToPlatform ?? null,
    resolutionNote: order.resolutionNote ?? null,
    isOpen: OPEN_STATUSES.includes(order.status),
    createdAt: order.createdAt,
    closedAt: order.closedAt ?? null,
  };
}

/**
 * One ledger for every category: lots sold and lots bought, newest first,
 * with what is in escrow and what the finished steps have earned (pending).
 */
export const myLedger = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    const [sold, bought] = await Promise.all([
      ctx.db.query("lotOrders").withIndex("by_seller", (q) => q.eq("sellerId", args.userId)).order("desc").take(100),
      ctx.db.query("lotOrders").withIndex("by_buyer", (q) => q.eq("buyerId", args.userId)).order("desc").take(100),
    ]);
    const labels = new Map<string, string>();
    const label = async (id: Id<"users">) => {
      if (!labels.has(id)) labels.set(id, await partyLabel(ctx, id));
      return labels.get(id)!;
    };
    const sales = [];
    for (const o of sold) sales.push(orderCard(o, await label(o.buyerId)));
    const purchases = [];
    for (const o of bought) purchases.push(orderCard(o, await label(o.sellerId)));

    const openSales = sales.filter((o) => o.isOpen);
    const openPurchases = purchases.filter((o) => o.isOpen);
    return {
      sales,
      purchases,
      summary: {
        inEscrowAsBuyer: openPurchases.reduce((sum, o) => sum + o.paidAmount, 0),
        inEscrowForMe: openSales.reduce((sum, o) => sum + o.paidAmount, 0),
        earnedPending: openSales.reduce((sum, o) => sum + o.earnedSoFar, 0),
        paymentsDue: openPurchases
          .filter((o) => o.status === "payment_due")
          .map((o) => ({ orderId: o.orderId, produceType: o.produceType, amount: o.paymentDueAmount, by: o.paymentDueBy })),
      },
    };
  },
});

/**
 * Stock an exporter, processor or vendor holds. Stock bought through lot
 * orders is traced back to the lots (and sellers) it came from; stock
 * declared outside the app is marked off-app.
 */
export const myStock = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("traderInventory")
      .withIndex("by_trader", (q) => q.eq("traderId", args.userId))
      .order("desc")
      .take(200);
    const stock = [];
    for (const row of rows) {
      if (row.status !== "in_storage") continue;
      const sellers = new Set<string>();
      for (const unitId of row.listingUnitIds.slice(0, 100)) {
        const unit = await ctx.db.get(unitId);
        const listing = unit ? await ctx.db.get(unit.listingId) : null;
        if (listing?.farmerId) sellers.add(listing.farmerId);
      }
      const listings = await ctx.db
        .query("listings")
        .withIndex("by_inventory", (q) => q.eq("inventoryId", row._id))
        .take(20);
      stock.push({
        inventoryId: row._id,
        utid: row.utid,
        produceType: row.produceType,
        totalKilos: row.totalKilos,
        pricePerKilo: row.unitPrice,
        acquiredAt: row.acquiredAt,
        source: row.source ?? (row.listingUnitIds.length > 0 ? "in_app" : "off_app"),
        sourceLots: row.listingUnitIds.length,
        sellerCount: sellers.size,
        listed: listings.some((l) => l.status === "active" || l.status === "partially_locked"),
        isBuyerBlock: row.is100kgBlock,
      });
    }
    return stock;
  },
});

async function sessionUser(ctx: Ctx, token: string | undefined): Promise<Doc<"users"> | null> {
  if (!token || token.length < 10) return null;
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();
  if (!session || session.invalidated || session.expiresAt < Date.now()) return null;
  const user = await ctx.db.get(session.userId);
  if (!user || user.state !== "active") return null;
  return user;
}

/**
 * For the Wallet page: money in escrow that is not in the wallet yet, what
 * the seller's finished steps have earned (pending), and payments due.
 */
export const myPending = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await sessionUser(ctx, args.sessionToken);
    if (!user) return null;
    const [sold, bought] = await Promise.all([
      ctx.db.query("lotOrders").withIndex("by_seller", (q) => q.eq("sellerId", user._id)).order("desc").take(100),
      ctx.db.query("lotOrders").withIndex("by_buyer", (q) => q.eq("buyerId", user._id)).order("desc").take(100),
    ]);
    const openSold = sold.filter((o) => OPEN_STATUSES.includes(o.status));
    const openBought = bought.filter((o) => OPEN_STATUSES.includes(o.status));
    return {
      inEscrowAsBuyer: openBought.reduce((sum, o) => sum + o.paidAmount, 0),
      inEscrowForMe: openSold.reduce((sum, o) => sum + o.paidAmount, 0),
      earnedPending: openSold.reduce((sum, o) => sum + earnedSoFar(o.totalAmount, o.milestones), 0),
      openSales: openSold.length,
      openPurchases: openBought.length,
      paymentsDue: openBought
        .filter((o) => o.status === "payment_due")
        .map((o) => ({ orderId: o._id, produceType: o.produceType, amount: o.paymentDueAmount ?? 0, by: o.paymentDueBy ?? 0 })),
    };
  },
});

/** Proof photos of an order's steps, for its buyer, its seller or an admin. */
export const orderPhotos = query({
  args: { userId: v.id("users"), orderId: v.id("lotOrders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    const user = await ctx.db.get(args.userId);
    if (!order || !user) return [];
    if (order.buyerId !== args.userId && order.sellerId !== args.userId && user.role !== "admin") return [];
    const steps = [];
    for (const m of order.milestones) {
      const photos = [];
      for (const p of m.photos ?? []) {
        photos.push({ url: await ctx.storage.getUrl(p.storageId), lat: p.lat ?? null, lng: p.lng ?? null, capturedAt: p.capturedAt, manualEntry: !!p.manualEntry });
      }
      steps.push({ name: m.name, photos });
    }
    return steps;
  },
});

/** Orders waiting for an admin, with the seller's share earned so far as a suggestion. */
export const listDisputed = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    assertMoneyAdmin(await ctx.db.get(args.adminId));
    const disputed = await ctx.db
      .query("lotOrders")
      .withIndex("by_status", (q) => q.eq("status", "disputed"))
      .order("desc")
      .take(100);
    const rows = [];
    for (const o of disputed) {
      rows.push({
        ...orderCard(o, await partyLabel(ctx, o.buyerId)),
        sellerLabel: await partyLabel(ctx, o.sellerId),
        buyerLabel: await partyLabel(ctx, o.buyerId),
        disputeKind: o.disputeKind ?? null,
        disputedBy: o.disputedBy ? await partyLabel(ctx, o.disputedBy) : null,
        suggestedToSeller: Math.min(o.paidAmount, earnedSoFar(o.totalAmount, o.milestones)),
      });
    }
    return rows;
  },
});

/** Fines kept by the platform from missed payments, for Finance. */
export const listFines = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    assertMoneyAdmin(await ctx.db.get(args.adminId));
    const penalised = await ctx.db
      .query("lotOrders")
      .withIndex("by_status", (q) => q.eq("status", "penalised"))
      .order("desc")
      .take(500);
    return {
      totalToPlatform: penalised.reduce((sum, o) => sum + (o.fineToPlatform ?? 0), 0),
      rows: penalised.map((o) => ({
        orderId: o._id,
        utid: o.utid,
        produceType: o.produceType,
        fineToPlatform: o.fineToPlatform ?? 0,
        fineToSeller: o.fineToSeller ?? 0,
        toBuyer: o.toBuyer ?? 0,
        closedAt: o.closedAt ?? null,
      })),
    };
  },
});
