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
const TEST_EMAILS = [FARMER_EMAIL, BUYER_EMAIL, ADMIN_EMAIL];

async function testUser(ctx: MutationCtx, email: string, role: "farmer" | "buyer" | "admin", alias: string) {
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
    ...(role === "buyer" ? { verificationStatus: "verified" as const, verifiedAt: now } : {}),
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
