/**
 * Lot orders: walkthrough helpers for a dev deployment.
 *
 * Seeds two clearly marked test accounts (isTestUser, fixed test emails): a
 * farmer with onboarding done and a verified business buyer holding demo
 * money (never cashable). The walkthrough then drives the real public
 * functions (listings.createListing, lotOrders.commit, markStepDone, ...).
 * The "clock" helpers stand in for 48 hours or 3 days passing, on test
 * orders only. Cleanup removes everything the test accounts created.
 *
 * MarketSpace: two more test accounts (a signed-in but unverified member,
 * and a verified exporter) and test sessions, so Discover, card pages and
 * questions can be driven as each kind of viewer through the real
 * session-token functions.
 *
 * Internal functions only: callable from the Convex CLI or dashboard, never
 * from the app. Every helper refuses to touch anything that is not tied to
 * a test account.
 */

import { v } from "convex/values";
import { internalMutation, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { generateUTID, getUgandaTime } from "./utils";
import { assertTestMode } from "./testUtils";
import { postWallet } from "./walletSplit";

const FARMER_EMAIL = "lotcheck.farmer@pilot.farm2market"; // Pilot domain: no FarmCoin gate
const BUYER_EMAIL = "lotcheck.buyer@local";
const ADMIN_EMAIL = "lotcheck.admin@local"; // No password: cannot log in; decides test disputes, then removed
const MEMBER_EMAIL = "lotcheck.member@local"; // Signed in, not verified: sees lite produce cards
const EXPORTER_EMAIL = "lotcheck.exporter@local"; // Verified exporter: lists stock as lots, sells in bulk
const TEST_EMAILS = [FARMER_EMAIL, BUYER_EMAIL, ADMIN_EMAIL, MEMBER_EMAIL, EXPORTER_EMAIL];

async function testUser(ctx: MutationCtx, email: string, role: "farmer" | "buyer" | "admin" | "trader", alias: string, verified = role === "buyer") {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
  if (existing) {
    if (!existing.isTestUser) throw new Error(`${email} exists and is not a test account`);
    return existing._id;
  }
  const now = getUgandaTime();
  return await ctx.db.insert("users", {
    email,
    role,
    alias,
    state: "active",
    createdAt: now,
    lastActiveAt: now,
    isTestUser: true,
    onboardingCompleted: true,
    ...(verified ? { verificationStatus: "verified" as const, verifiedAt: now } : {}),
    ...(role === "admin" ? { adminLevel: "super" as const } : {}),
  });
}

/** Creates (or finds) the test farmer and the verified test buyer, and gives the buyer demo money. */
export const seed = internalMutation({
  args: { mode: v.string(), buyerDemoUGX: v.number() },
  handler: async (ctx, args) => {
    assertTestMode(args.mode);
    const farmerId = await testUser(ctx, FARMER_EMAIL, "farmer", "LOTCHECK-F");
    const buyerId = await testUser(ctx, BUYER_EMAIL, "buyer", "LOTCHECK-B");
    const adminId = await testUser(ctx, ADMIN_EMAIL, "admin", "LOTCHECK-A");
    const last = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q) => q.eq("userId", buyerId))
      .order("desc")
      .first();
    const balance = last?.balanceAfter ?? 0;
    if (args.buyerDemoUGX > balance) {
      await postWallet(ctx, {
        userId: buyerId,
        utid: generateUTID("admin"),
        type: "capital_deposit",
        amount: args.buyerDemoUGX - balance,
        rule: { kind: "all" }, // Demo money: can be traded with, never cashed out
        metadata: { source: "admin_demo_deposit", reason: "Lot order walkthrough (test account)" },
      });
    }
    return { farmerId, buyerId, adminId };
  },
});

async function assertTestOrder(ctx: MutationCtx, orderId: Id<"lotOrders">) {
  const order = await ctx.db.get(orderId);
  if (!order) throw new Error("Order not found");
  const buyer = await ctx.db.get(order.buyerId);
  const seller = await ctx.db.get(order.sellerId);
  if (!buyer?.isTestUser || !seller?.isTestUser) throw new Error("Only test orders can be moved in time");
  return order;
}

/** Stands in for the 48-hour payment window running out (test orders only). */
export const expirePaymentWindow = internalMutation({
  args: { mode: v.string(), orderId: v.id("lotOrders") },
  handler: async (ctx, args) => {
    assertTestMode(args.mode);
    const order = await assertTestOrder(ctx, args.orderId);
    if (order.status !== "payment_due") throw new Error("This order has no payment due");
    await ctx.db.patch(order._id, { paymentDueBy: getUgandaTime() - 1 });
  },
});

/** Stands in for 3 days passing since handover (test orders only). */
export const ageHandover = internalMutation({
  args: { mode: v.string(), orderId: v.id("lotOrders") },
  handler: async (ctx, args) => {
    assertTestMode(args.mode);
    const order = await assertTestOrder(ctx, args.orderId);
    if (order.status !== "awaiting_collection_confirm") throw new Error("This order is not handed over");
    const past = getUgandaTime() - 3 * 24 * 60 * 60 * 1000 - 1;
    await ctx.db.patch(order._id, { handedOverAt: past });
  },
});

/**
 * MarketSpace walkthrough: the extra test accounts and a one-day session for
 * each, so session-token functions (discover, cardDetail, vendListing,
 * enquiries.*) can be called as a farmer, a verified buyer, an unverified
 * member and a verified exporter. Visitors are calls without a token.
 */
export const marketspaceSessions = internalMutation({
  args: { mode: v.string() },
  handler: async (ctx, args) => {
    assertTestMode(args.mode);
    const users = {
      farmer: await testUser(ctx, FARMER_EMAIL, "farmer", "LOTCHECK-F"),
      buyer: await testUser(ctx, BUYER_EMAIL, "buyer", "LOTCHECK-B"),
      member: await testUser(ctx, MEMBER_EMAIL, "buyer", "LOTCHECK-M", false),
      exporter: await testUser(ctx, EXPORTER_EMAIL, "trader", "LOTCHECK-E", true),
    };
    const tokens: Record<string, string> = {};
    for (const [who, userId] of Object.entries(users)) {
      const token = `lotcheck-${crypto.randomUUID()}`;
      await ctx.db.insert("sessions", {
        userId,
        token,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        invalidated: false,
      });
      tokens[who] = token;
    }
    return { users, tokens };
  },
});

/** Gives the test exporter a stock row to list as lots: bought in the app (in_app) or declared (off_app). */
export const seedExporterStock = internalMutation({
  args: { mode: v.string(), produceType: v.string(), kilos: v.number(), source: v.union(v.literal("in_app"), v.literal("off_app")) },
  handler: async (ctx, args) => {
    assertTestMode(args.mode);
    const exporterId = await testUser(ctx, EXPORTER_EMAIL, "trader", "LOTCHECK-E", true);
    const now = getUgandaTime();
    return await ctx.db.insert("traderInventory", {
      traderId: exporterId,
      listingUnitIds: [],
      totalKilos: args.kilos,
      blockSize: args.kilos,
      produceType: args.produceType,
      unitPrice: 1000,
      acquiredAt: now,
      storageStartTime: now,
      status: "in_storage",
      utid: generateUTID("trader"),
      is100kgBlock: false,
      source: args.source,
    });
  },
});

/** Stands in for a card's MarketSpace time running out (test sellers only). */
export const expireCard = internalMutation({
  args: { mode: v.string(), cardId: v.id("marketCards") },
  handler: async (ctx, args) => {
    assertTestMode(args.mode);
    const card = await ctx.db.get(args.cardId);
    if (!card) throw new Error("Card not found");
    if (!(await ctx.db.get(card.sellerId))?.isTestUser) throw new Error("Only test cards can be moved in time");
    const past = getUgandaTime() - 1;
    await ctx.db.patch(card._id, { expiresAt: past });
    if (card.listingId) await ctx.db.patch(card.listingId, { vendExpiresAt: past });
  },
});

/** Removes the test accounts and everything they created. */
export const cleanup = internalMutation({
  args: { mode: v.string() },
  handler: async (ctx, args) => {
    assertTestMode(args.mode);
    const removed: Record<string, number> = {};
    const count = (table: string) => (removed[table] = (removed[table] ?? 0) + 1);
    for (const email of TEST_EMAILS) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (!user) continue;
      if (!user.isTestUser) throw new Error(`${email} is not a test account`);

      for (const order of [
        ...(await ctx.db.query("lotOrders").withIndex("by_seller", (q) => q.eq("sellerId", user._id)).collect()),
        ...(await ctx.db.query("lotOrders").withIndex("by_buyer", (q) => q.eq("buyerId", user._id)).collect()),
      ]) {
        if (!(await ctx.db.get(order._id))) continue;
        for (const m of order.milestones) {
          for (const p of m.photos ?? []) await ctx.storage.delete(p.storageId).catch(() => undefined);
        }
        // Notifications about the order, including the ones sent to real admins
        for (const n of await ctx.db.query("notifications").withIndex("by_utid", (q) => q.eq("utid", order.utid)).collect()) {
          await ctx.db.delete(n._id);
          count("notifications");
        }
        await ctx.db.delete(order._id);
        count("lotOrders");
      }
      for (const action of await ctx.db.query("adminActions").withIndex("by_admin", (q) => q.eq("adminId", user._id)).collect()) {
        await ctx.db.delete(action._id);
        count("adminActions");
      }
      for (const listing of await ctx.db.query("listings").withIndex("by_farmer", (q) => q.eq("farmerId", user._id)).collect()) {
        for (const unit of await ctx.db.query("listingUnits").withIndex("by_listing", (q) => q.eq("listingId", listing._id)).collect()) {
          await ctx.db.delete(unit._id);
          count("listingUnits");
        }
        for (const p of listing.photos ?? []) await ctx.storage.delete(p.storageId).catch(() => undefined);
        await ctx.db.delete(listing._id);
        count("listings");
      }
      // MarketSpace: their cards (with questions and responses), their asks on other cards, ads, sessions, messages
      for (const card of await ctx.db.query("marketCards").withIndex("by_seller", (q) => q.eq("sellerId", user._id)).collect()) {
        for (const e of await ctx.db.query("enquiries").withIndex("by_card_and_question", (q) => q.eq("cardId", card._id)).collect()) {
          await ctx.db.delete(e._id);
          count("enquiries");
        }
        for (const a of await ctx.db.query("enquiryAsks").withIndex("by_card", (q) => q.eq("cardId", card._id)).collect()) {
          await ctx.db.delete(a._id);
          count("enquiryAsks");
        }
        for (const r of await ctx.db.query("wantedResponses").withIndex("by_card_and_updatedAt", (q) => q.eq("cardId", card._id)).collect()) {
          await ctx.db.delete(r._id);
          count("wantedResponses");
        }
        await ctx.db.delete(card._id);
        count("marketCards");
      }
      for (const a of await ctx.db.query("enquiryAsks").withIndex("by_asker_and_card", (q) => q.eq("askerId", user._id)).collect()) {
        const enquiry = await ctx.db.get(a.enquiryId);
        if (enquiry && !enquiry.answer && enquiry.askCount <= 1) await ctx.db.delete(enquiry._id);
        else if (enquiry) await ctx.db.patch(enquiry._id, { askCount: Math.max(0, enquiry.askCount - 1) });
        await ctx.db.delete(a._id);
        count("enquiryAsks");
      }
      for (const ad of await ctx.db.query("marketspaceAds").withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", user._id)).collect()) {
        for (const id of ad.photoIds) await ctx.storage.delete(id).catch(() => undefined);
        await ctx.db.delete(ad._id);
        count("marketspaceAds");
      }
      for (const m of await ctx.db.query("messages").withIndex("by_from_user", (q) => q.eq("fromUserId", user._id)).collect()) {
        await ctx.db.delete(m._id);
        count("messages");
      }
      for (const row of await ctx.db.query("sessions").withIndex("by_user", (q) => q.eq("userId", user._id)).collect()) {
        await ctx.db.delete(row._id);
        count("sessions");
      }
      for (const row of await ctx.db.query("traderInventory").withIndex("by_trader", (q) => q.eq("traderId", user._id)).collect()) {
        await ctx.db.delete(row._id);
        count("traderInventory");
      }
      for (const row of await ctx.db.query("walletLedger").withIndex("by_user", (q) => q.eq("userId", user._id)).collect()) {
        await ctx.db.delete(row._id);
        count("walletLedger");
      }
      for (const row of await ctx.db.query("notifications").withIndex("by_user", (q) => q.eq("userId", user._id)).collect()) {
        await ctx.db.delete(row._id);
        count("notifications");
      }
      await ctx.db.delete(user._id);
      count("users");
    }
    return removed;
  },
});
