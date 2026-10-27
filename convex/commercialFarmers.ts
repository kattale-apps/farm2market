/**
 * Commercial farmers (rules in convex/commercialFarmersShared.ts).
 *
 * A farmer fills in a commercial profile (a trading name and one commercial
 * document) to put lots on MarketSpace; the super admin checks the document.
 * Who then sees the farmer's lots is produceVisible (marketspaceShared):
 * visitors and unverified members once the profile is verified; verified
 * buyers (exporters, processors, vendors and business buyers) see every
 * farmer lot, at the farm gate too.
 *
 * Vendors send the same profile (their business name and one document) to
 * be verified: when the super admin approves it, the vendor is verified (they
 * can buy lots and sell in bulk) and their posts carry the Verified Vendor badge.
 *
 * Who is acting always comes from the session token. The trading name and
 * the document go only to the seller and the super admin.
 */

import { v } from "convex/values";
import { internalMutation, mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import { evidencePhotoValidator } from "./evidencePhotos";
import { REJECT_REASONS, commercialProfileProblem, documentLabel } from "./commercialFarmersShared";
import { notifyOwner, requireSuperAdmin, requireUser, sessionUser } from "./marketspace";
import { resyncSellerCards, syncListingCard } from "./marketCards";
import { roleLabel } from "./roleLabels";

const documentKind = v.union(v.literal("trading_licence"), v.literal("business_registration"), v.literal("tin"));

/** Who sends a commercial profile: farmers (to put lots on MarketSpace) and vendors (to be verified). */
const PROFILE_ROLES = ["farmer", "vendor"];

async function photoUrlOf(ctx: QueryCtx | MutationCtx, profile: Doc<"commercialProfiles">) {
  const storageId = profile.documents[0]?.photo?.storageId;
  return storageId ? await ctx.storage.getUrl(storageId) : null;
}

// ------------------------------------------------------------------
// The farmer or vendor
// ------------------------------------------------------------------

/** The signed-in farmer's or vendor's commercial profile, to fill in or check. */
export const myProfile = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await sessionUser(ctx, args.sessionToken);
    if (!user || !PROFILE_ROLES.includes(user.role)) return null;
    const profile = await ctx.db
      .query("commercialProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!profile) {
      // A vendor's first profile starts from the business name they gave at onboarding
      const vendor = user.role === "vendor"
        ? await ctx.db.query("vendorProfiles").withIndex("by_userId", (q) => q.eq("userId", user._id)).first()
        : null;
      return { role: user.role, businessName: vendor?.businessName ?? null, profile: null };
    }
    const doc = profile.documents[0];
    return {
      role: user.role,
      businessName: null,
      profile: {
        tradingName: profile.tradingName,
        kind: doc?.kind ?? null,
        number: doc?.number ?? null,
        photoUrl: await photoUrlOf(ctx, profile),
        status: profile.status,
        reviewNote: profile.reviewNote ?? null,
        updatedAt: profile.updatedAt,
      },
    };
  },
});

/**
 * Saves the farmer's or vendor's commercial profile and sends it for
 * checking. A farmer's lots can go on MarketSpace straight away (verified
 * purchasers see them); visitors see them once the super admin has verified
 * the document. Changing a verified profile sends it to be checked again.
 */
export const saveProfile = mutation({
  args: {
    sessionToken: v.string(),
    tradingName: v.string(),
    kind: documentKind,
    number: v.optional(v.string()),
    photo: v.optional(evidencePhotoValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    if (!PROFILE_ROLES.includes(user.role)) throw new Error("Commercial profiles are for farmers and vendors.");
    const existing = await ctx.db
      .query("commercialProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    const keptPhoto = existing?.documents[0]?.kind === args.kind ? existing.documents[0].photo : undefined;
    const photo = args.photo ?? keptPhoto;
    const problem = commercialProfileProblem({ tradingName: args.tradingName, kind: args.kind, number: args.number, hasPhoto: !!photo });
    if (problem) throw new Error(problem);

    const now = getUgandaTime();
    const fields = {
      tradingName: args.tradingName.trim(),
      documents: [{ kind: args.kind, number: args.number?.replace(/\s+/g, " ").trim() || undefined, photo }],
      status: "pending" as const,
      reviewNote: undefined,
      reviewedBy: undefined,
      reviewedAt: undefined,
      updatedAt: now,
    };
    const oldPhoto = existing?.documents[0]?.photo?.storageId;
    if (oldPhoto && oldPhoto !== photo?.storageId) await ctx.storage.delete(oldPhoto);
    if (existing) await ctx.db.patch(existing._id, fields);
    else await ctx.db.insert("commercialProfiles", { userId: user._id, ...fields, createdAt: now });
    await resyncSellerCards(ctx, user._id);
    return { status: "pending" as const };
  },
});

// ------------------------------------------------------------------
// The super admin checks the documents
// ------------------------------------------------------------------

/** Profiles waiting to be checked (oldest first), and the latest decisions. */
export const reviewQueue = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx, args.sessionToken);
    const waiting = await ctx.db
      .query("commercialProfiles")
      .withIndex("by_status_and_updatedAt", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(50);
    const decided = [
      ...(await ctx.db.query("commercialProfiles").withIndex("by_status_and_updatedAt", (q) => q.eq("status", "verified")).order("desc").take(10)),
      ...(await ctx.db.query("commercialProfiles").withIndex("by_status_and_updatedAt", (q) => q.eq("status", "rejected")).order("desc").take(10)),
    ].sort((a, b) => b.updatedAt - a.updatedAt);
    const row = async (p: Doc<"commercialProfiles">) => {
      const seller = await ctx.db.get(p.userId);
      const district = seller?.districtId ? (await ctx.db.get(seller.districtId))?.name : seller?.districtText;
      const doc = p.documents[0];
      return {
        profileId: p._id,
        seller: seller ? `${roleLabel(seller.role)} ${seller.alias ?? ""}`.trim() : "Account removed",
        district: district ?? null,
        tradingName: p.tradingName,
        document: doc ? documentLabel(doc.kind) : null,
        number: doc?.number ?? null,
        photoUrl: await photoUrlOf(ctx, p),
        status: p.status,
        reviewNote: p.reviewNote ?? null,
        updatedAt: p.updatedAt,
      };
    };
    return {
      waiting: await Promise.all(waiting.map(row)),
      decided: await Promise.all(decided.slice(0, 15).map(row)),
      rejectReasons: REJECT_REASONS,
    };
  },
});

/**
 * Verify the document, or say why it is not accepted. The seller is told
 * either way. Verifying a vendor's document verifies the vendor too.
 */
export const review = mutation({
  args: {
    sessionToken: v.string(),
    profileId: v.id("commercialProfiles"),
    decision: v.union(v.literal("verified"), v.literal("rejected")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireSuperAdmin(ctx, args.sessionToken);
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Profile not found.");
    const reason = args.reason?.trim();
    if (args.decision === "rejected" && !(REJECT_REASONS as readonly string[]).includes(reason ?? "")) {
      throw new Error("Choose why it is not accepted.");
    }
    const now = getUgandaTime();
    await ctx.db.patch(profile._id, {
      status: args.decision,
      reviewNote: args.decision === "rejected" ? reason : undefined,
      reviewedBy: admin._id,
      reviewedAt: now,
      updatedAt: now,
    });
    const seller = await ctx.db.get(profile.userId);
    const vendor = seller?.role === "vendor";
    if (vendor && args.decision === "verified") {
      await ctx.db.patch(profile.userId, { verificationStatus: "verified", verifiedBy: admin._id, verifiedAt: now });
    }
    await resyncSellerCards(ctx, profile.userId);
    let message: string;
    if (args.decision === "verified") {
      message = vendor
        ? "Farm2Market checked your document. You are a Verified Vendor: you can buy lots, and your posts on MarketSpace carry the Verified Vendor badge."
        : "Farm2Market checked your document. Your lots on MarketSpace now carry the Commercial Farmer badge and everyone can see them.";
    } else {
      message = vendor
        ? `Farm2Market could not accept your business profile: ${reason}. Fix it in MarketSpace → My Ledger and send it again.`
        : `Farm2Market could not accept your commercial profile: ${reason}. Fix it in MarketSpace → My Ledger and send it again. Until then your lots are hidden from visitors.`;
    }
    const what = vendor ? "Business profile" : "Commercial profile";
    await notifyOwner(ctx, profile.userId, args.decision === "verified" ? `${what} verified` : `${what} not accepted`, message);
    return { status: args.decision };
  },
});

// ------------------------------------------------------------------
// Scheduled and one-off
// ------------------------------------------------------------------

/**
 * A farmer's lot whose MarketSpace time ran out goes back to the farm gate,
 * where verified purchasers still see it (runs every 30
 * minutes, after the card's time has passed).
 */
export const farmGateAfterVendEnds = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = getUgandaTime();
    const due = await ctx.db
      .query("marketCards")
      .withIndex("by_status_view_expiresAt", (q) => q.eq("status", "active").eq("view", "produce").lte("expiresAt", now))
      .take(100);
    for (const card of due) {
      if (card.listingId) await syncListingCard(ctx, card.listingId);
      else await ctx.db.patch(card._id, { status: "closed", updatedAt: now });
    }
    if (due.length === 100) await ctx.scheduler.runAfter(0, internal.commercialFarmers.farmGateAfterVendEnds, {});
    return { moved: due.length };
  },
});

const ADD_PROFILE_TITLE = "Add your commercial profile";

/**
 * One-off when the rule goes live: every farmer's lot for sale gets its card
 * (farm-gate when not on MarketSpace), and farmers with lots on MarketSpace
 * but no commercial profile are told their lots are now hidden from
 * visitors. 100 listings at a time; it schedules itself until done.
 * Run: npx convex run commercialFarmers:applyCommercialFarmerRule '{"cursor":null}'
 */
export const applyCommercialFarmerRule = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const now = getUgandaTime();
    const page = await ctx.db.query("listings").paginate({ numItems: 100, cursor: args.cursor });
    let synced = 0;
    let told = 0;
    for (const listing of page.page) {
      if (!listing.farmerId || (listing.status !== "active" && listing.status !== "partially_locked")) continue;
      const farmer = await ctx.db.get(listing.farmerId);
      if (farmer?.role !== "farmer") continue;
      const wasOnMarketSpace = listing.vendExpiresAt !== undefined && listing.vendExpiresAt > now;
      await syncListingCard(ctx, listing._id);
      synced++;
      if (!wasOnMarketSpace) continue;
      const hasProfile = !!(await ctx.db
        .query("commercialProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", farmer._id))
        .first());
      if (hasProfile) continue;
      // Once per farmer: skip if the reminder is already among their latest notifications
      const recent = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", farmer._id))
        .order("desc")
        .take(30);
      if (recent.some((n) => n.title === ADD_PROFILE_TITLE)) continue;
      await notifyOwner(
        ctx,
        farmer._id,
        ADD_PROFILE_TITLE,
        "Your lots are no longer shown to visitors on MarketSpace. Add your trading name and a commercial document in MarketSpace → My lots to put them back. Verified purchasers can still see and buy your lots at the farm gate."
      );
      told++;
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.commercialFarmers.applyCommercialFarmerRule, { cursor: page.continueCursor });
    return { synced, told, done: page.isDone };
  },
});
