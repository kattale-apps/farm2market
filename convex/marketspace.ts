/**
 * MarketSpace: a public, national classified-ads board.
 *
 * - A separate feature from Farm2Market listings. Nothing here reads or
 *   writes the listings, negotiations or purchase tables.
 * - Anyone can browse without logging in. Any logged-in user of any role can
 *   post an ad to offer something or to say they want something.
 * - Each account gets a number of free ads over its lifetime; later ads are
 *   paid in FarmCoin. Owners can pay to extend an ad or revive an expired
 *   one. Every period, cost and limit is a setting the super admin manages
 *   (marketspaceSettings); code holds only fallback defaults.
 * - Groups and categories are created by the super admin. Admins can remove
 *   ads; anyone can report one.
 *
 * Signed-in calls take the session token, not a user id, so the server
 * decides who the caller is.
 */

import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { generateUTID, getUgandaTime } from "./utils";
import {
  DAY_MS,
  STARTER_GROUPS,
  daysText,
  extendedExpiry,
  nextAdTerms,
  normalizeUgandaPhone,
  validateAd,
  validateSettings,
  walletForRole,
  withDefaults,
  type MarketspaceSettings,
} from "./marketspaceShared";

type Ctx = QueryCtx | MutationCtx;

// ------------------------------------------------------------------
// Access helpers
// ------------------------------------------------------------------

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

async function requireUser(ctx: Ctx, token: string): Promise<Doc<"users">> {
  const user = await sessionUser(ctx, token);
  if (!user) throw new Error("Please log in again to continue.");
  return user;
}

function isSuperAdmin(user: Doc<"users">): boolean {
  return user.role === "admin" && (user.adminLevel === "super" || user.adminLevel === undefined);
}

function canModerate(user: Doc<"users">): boolean {
  return isSuperAdmin(user) || (user.role === "admin" && user.adminCategory === "community");
}

async function requireSuperAdmin(ctx: Ctx, token: string): Promise<Doc<"users">> {
  const user = await requireUser(ctx, token);
  if (!isSuperAdmin(user)) throw new Error("Only the super admin can manage MarketSpace categories.");
  return user;
}

async function requireModerator(ctx: Ctx, token: string): Promise<Doc<"users">> {
  const user = await requireUser(ctx, token);
  if (!canModerate(user)) throw new Error("Only admins can moderate MarketSpace.");
  return user;
}

async function requireOwnAd(ctx: Ctx, token: string, adId: Id<"marketspaceAds">) {
  const user = await requireUser(ctx, token);
  const ad = await ctx.db.get(adId);
  if (!ad || ad.ownerId !== user._id) throw new Error("Ad not found.");
  return { user, ad };
}

async function notifyOwner(ctx: MutationCtx, userId: Id<"users">, title: string, message: string, utid?: string) {
  await ctx.db.insert("notifications", {
    userId,
    type: "system",
    category: "marketspace",
    title,
    message,
    utid,
    read: false,
    createdAt: getUgandaTime(),
  });
}

async function getSettings(ctx: Ctx): Promise<MarketspaceSettings> {
  return withDefaults(await ctx.db.query("marketspaceSettings").first());
}

async function posterRecord(ctx: Ctx, userId: Id<"users">) {
  return await ctx.db
    .query("marketspacePosters")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
}

/**
 * Free ads this account has used. Accounts that posted before the count was
 * kept start from the free ads they still have.
 */
async function freeAdsUsed(ctx: Ctx, userId: Id<"users">): Promise<number> {
  const record = await posterRecord(ctx, userId);
  if (record) return record.freeAdsUsed;
  const existing = await ctx.db
    .query("marketspaceAds")
    .withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", userId))
    .take(1000);
  return existing.filter((a) => !a.paid).length;
}

// ------------------------------------------------------------------
// FarmCoin wallet
// ------------------------------------------------------------------

async function walletBalance(ctx: Ctx, user: Doc<"users">): Promise<number | null> {
  const wallet = walletForRole(user.role);
  if (!wallet) return null;
  const latest =
    wallet.key === "traderId"
      ? await ctx.db
          .query("farmcoinLedger")
          .withIndex("by_trader", (q) => q.eq("traderId", user._id))
          .order("desc")
          .filter((q) => q.eq(q.field("accountType"), wallet.accountType))
          .first()
      : await ctx.db
          .query("farmcoinLedger")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .order("desc")
          .filter((q) => q.eq(q.field("accountType"), wallet.accountType))
          .first();
  return latest?.balanceAfter ?? 0;
}

/** Moves `amount` FarmCoin from the user's wallet to the central pool. */
async function chargeFarmcoin(
  ctx: MutationCtx,
  user: Doc<"users">,
  amount: number,
  ad: { title: string; utid: string },
  source: "marketspace_ad_extension" | "marketspace_paid_ad",
  reason: string
) {
  const wallet = walletForRole(user.role);
  if (!wallet) throw new Error("Your account has no FarmCoin wallet.");
  const balance = (await walletBalance(ctx, user)) ?? 0;
  if (balance < amount) {
    const what = source === "marketspace_paid_ad" ? "This ad costs" : "Extending costs";
    throw new Error(`Not enough FarmCoin. ${what} ${amount}; you have ${balance}. Buy FarmCoin in My Wallet.`);
  }
  const now = getUgandaTime();
  const utid = generateUTID("mks");
  await ctx.db.insert("farmcoinLedger", {
    accountType: wallet.accountType,
    ...(wallet.key === "traderId" ? { traderId: user._id } : { userId: user._id }),
    delta: -amount,
    balanceAfter: balance - amount,
    source,
    utid,
    relatedUtid: ad.utid,
    reason,
    createdAt: now,
  });
  const central = await ctx.db
    .query("farmcoinLedger")
    .withIndex("by_account", (q) => q.eq("accountType", "central"))
    .order("desc")
    .first();
  await ctx.db.insert("farmcoinLedger", {
    accountType: "central",
    delta: amount,
    balanceAfter: (central?.balanceAfter ?? 0) + amount,
    source,
    utid,
    relatedUtid: ad.utid,
    reason,
    createdAt: now,
  });
}

// ------------------------------------------------------------------
// Shaping ads for the client
// ------------------------------------------------------------------

type Taxonomy = {
  groups: Map<Id<"marketspaceGroups">, Doc<"marketspaceGroups">>;
  categories: Map<Id<"marketspaceCategories">, Doc<"marketspaceCategories">>;
};

async function loadTaxonomy(ctx: Ctx): Promise<Taxonomy> {
  const groups = await ctx.db.query("marketspaceGroups").take(100);
  const categories = await ctx.db.query("marketspaceCategories").take(500);
  return {
    groups: new Map(groups.map((g) => [g._id, g])),
    categories: new Map(categories.map((c) => [c._id, c])),
  };
}

function isVisible(ad: Doc<"marketspaceAds">, tax: Taxonomy): boolean {
  return !!tax.groups.get(ad.groupId)?.active && !!tax.categories.get(ad.categoryId)?.active;
}

async function toCard(ctx: Ctx, ad: Doc<"marketspaceAds">, tax: Taxonomy, allPhotos: boolean) {
  const group = tax.groups.get(ad.groupId);
  const category = tax.categories.get(ad.categoryId);
  const ids = allPhotos ? ad.photoIds : ad.photoIds.slice(0, 1);
  const photoUrls: string[] = [];
  for (const id of ids) {
    const url = await ctx.storage.getUrl(id);
    if (url) photoUrls.push(url);
  }
  const owner = await ctx.db.get(ad.ownerId);
  return {
    _id: ad._id,
    utid: ad.utid,
    kind: ad.kind,
    title: ad.title,
    description: ad.description,
    priceUGX: ad.priceUGX ?? null,
    priceUnit: ad.priceUnit ?? null,
    negotiable: ad.negotiable,
    quantity: ad.quantity ?? null,
    neededBy: ad.neededBy ?? null,
    district: ad.district,
    locationDetail: ad.locationDetail ?? null,
    contactPhone: ad.contactPhone,
    photoUrls,
    photoCount: ad.photoIds.length,
    groupId: ad.groupId,
    groupName: group?.name ?? "",
    groupIcon: group?.icon ?? "",
    groupColor: group?.color ?? "#2e7d32",
    categoryId: ad.categoryId,
    categoryName: category?.name ?? "",
    categoryIcon: category?.icon ?? "",
    posterRole: owner?.role ?? null,
    status: ad.status,
    expiresAt: ad.expiresAt,
    createdAt: ad.createdAt,
  };
}

const boardFilters = {
  now: v.number(), // Client's Uganda time (getUgandaTime), so the query does not read the clock
  groupId: v.optional(v.id("marketspaceGroups")),
  categoryId: v.optional(v.id("marketspaceCategories")),
  kind: v.optional(v.union(v.literal("offer"), v.literal("wanted"))),
  district: v.optional(v.string()),
};

// ------------------------------------------------------------------
// Public board (no login)
// ------------------------------------------------------------------

/** Visible groups and categories, in display order. */
export const getBoardConfig = query({
  args: {},
  handler: async (ctx) => {
    const tax = await loadTaxonomy(ctx);
    const groups = [...tax.groups.values()].filter((g) => g.active).sort((a, b) => a.sortOrder - b.sortOrder);
    const categories = [...tax.categories.values()].filter((c) => c.active && tax.groups.get(c.groupId)?.active);
    return {
      groups: groups.map((g) => ({
        _id: g._id,
        name: g.name,
        icon: g.icon,
        color: g.color,
        categories: categories
          .filter((c) => c.groupId === g._id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((c) => ({ _id: c._id, name: c.name, icon: c.icon })),
      })),
      settings: await getSettings(ctx),
    };
  },
});

/** Live ads, newest first, for the swipe deck and the grid. */
export const listAds = query({
  args: { paginationOpts: paginationOptsValidator, ...boardFilters },
  handler: async (ctx, args) => {
    const tax = await loadTaxonomy(ctx);
    const base = args.categoryId
      ? ctx.db
          .query("marketspaceAds")
          .withIndex("by_status_and_categoryId_and_createdAt", (q) => q.eq("status", "active").eq("categoryId", args.categoryId!))
      : args.groupId
        ? ctx.db
            .query("marketspaceAds")
            .withIndex("by_status_and_groupId_and_createdAt", (q) => q.eq("status", "active").eq("groupId", args.groupId!))
        : ctx.db.query("marketspaceAds").withIndex("by_status_and_createdAt", (q) => q.eq("status", "active"));
    const district = args.district?.trim();
    const result = await base
      .order("desc")
      .filter((q) => {
        const conditions = [q.gt(q.field("expiresAt"), args.now)];
        if (args.kind) conditions.push(q.eq(q.field("kind"), args.kind));
        if (district) conditions.push(q.eq(q.field("district"), district));
        return q.and(...conditions);
      })
      .paginate(args.paginationOpts);
    const page = [];
    for (const ad of result.page) {
      if (isVisible(ad, tax)) page.push(await toCard(ctx, ad, tax, false));
    }
    return { ...result, page };
  },
});

/** Title search across live ads (best 40 matches). */
export const searchAds = query({
  args: { text: v.string(), ...boardFilters },
  handler: async (ctx, args) => {
    const text = args.text.trim();
    if (!text) return [];
    const tax = await loadTaxonomy(ctx);
    const hits = await ctx.db
      .query("marketspaceAds")
      .withSearchIndex("search_title", (q) => {
        let s = q.search("title", text).eq("status", "active");
        if (args.categoryId) s = s.eq("categoryId", args.categoryId);
        else if (args.groupId) s = s.eq("groupId", args.groupId);
        return s;
      })
      .take(40);
    const district = args.district?.trim();
    const cards = [];
    for (const ad of hits) {
      if (ad.expiresAt <= args.now || !isVisible(ad, tax)) continue;
      if (args.kind && ad.kind !== args.kind) continue;
      if (district && ad.district !== district) continue;
      cards.push(await toCard(ctx, ad, tax, false));
    }
    return cards;
  },
});

/** One live ad with all its photos, or null when it is not on the board. */
export const getAd = query({
  args: { adId: v.string(), now: v.number() }, // A string, so a mistyped shared link shows "not found"
  handler: async (ctx, args) => {
    const adId = ctx.db.normalizeId("marketspaceAds", args.adId);
    const ad = adId ? await ctx.db.get(adId) : null;
    if (!ad || ad.status !== "active" || ad.expiresAt <= args.now) return null;
    const tax = await loadTaxonomy(ctx);
    if (!isVisible(ad, tax)) return null;
    return await toCard(ctx, ad, tax, true);
  },
});

/** Anyone, logged in or not, can report an ad for admins to review. */
export const reportAd = mutation({
  args: {
    adId: v.id("marketspaceAds"),
    reason: v.union(
      v.literal("scam"),
      v.literal("wrong_category"),
      v.literal("offensive"),
      v.literal("already_sold"),
      v.literal("other")
    ),
    details: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ad = await ctx.db.get(args.adId);
    if (!ad || ad.status !== "active") throw new Error("This ad is no longer on the board.");
    const reporter = await sessionUser(ctx, args.sessionToken);
    const details = args.details?.trim().slice(0, 500) || undefined;
    await ctx.db.insert("marketspaceReports", {
      adId: ad._id,
      reason: args.reason,
      details,
      reporterId: reporter?._id,
      status: "open",
      createdAt: getUgandaTime(),
    });
    await ctx.db.patch(ad._id, { reportCount: ad.reportCount + 1 });
    return { success: true };
  },
});

// ------------------------------------------------------------------
// Signed-in users: post and manage ads
// ------------------------------------------------------------------

/** Who is viewing, what they may do, and their FarmCoin balance. */
export const getMyContext = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await sessionUser(ctx, args.sessionToken);
    if (!user) return null;
    const settings = await getSettings(ctx);
    return {
      userId: user._id,
      role: user.role,
      alias: user.alias,
      phoneNumber: user.phoneNumber ?? null,
      isSuperAdmin: isSuperAdmin(user),
      canModerate: canModerate(user),
      farmcoinBalance: await walletBalance(ctx, user),
      settings,
      nextAd: nextAdTerms(settings, await freeAdsUsed(ctx, user._id)),
    };
  },
});

export const myAds = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await sessionUser(ctx, args.sessionToken);
    if (!user) return [];
    const tax = await loadTaxonomy(ctx);
    const ads = await ctx.db
      .query("marketspaceAds")
      .withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(100);
    const cards = [];
    for (const ad of ads) {
      const card = await toCard(ctx, ad, tax, true);
      cards.push({
        ...card,
        photoIds: ad.photoIds,
        hidden: !isVisible(ad, tax),
        removedReason: ad.removedReason ?? null,
      });
    }
    return cards;
  },
});

export const generatePhotoUploadUrl = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx, args.sessionToken);
    return await ctx.storage.generateUploadUrl();
  },
});

const adFields = {
  kind: v.union(v.literal("offer"), v.literal("wanted")),
  categoryId: v.id("marketspaceCategories"),
  title: v.string(),
  description: v.string(),
  photoIds: v.array(v.id("_storage")),
  priceUGX: v.optional(v.number()),
  priceUnit: v.optional(v.string()),
  negotiable: v.boolean(),
  quantity: v.optional(v.string()),
  neededBy: v.optional(v.string()),
  district: v.string(),
  locationDetail: v.optional(v.string()),
  contactPhone: v.string(),
};

type AdArgs = {
  kind: "offer" | "wanted";
  categoryId: Id<"marketspaceCategories">;
  title: string;
  description: string;
  photoIds: Id<"_storage">[];
  priceUGX?: number;
  priceUnit?: string;
  negotiable: boolean;
  quantity?: string;
  neededBy?: string;
  district: string;
  locationDetail?: string;
  contactPhone: string;
};

/** Validates an ad and returns the fields to store. */
async function cleanAd(ctx: MutationCtx, args: AdArgs, settings: MarketspaceSettings) {
  const problem = validateAd({ ...args, photoCount: args.photoIds.length }, settings.maxPhotosPerAd);
  if (problem) throw new Error(problem);
  const category = await ctx.db.get(args.categoryId);
  const group = category ? await ctx.db.get(category.groupId) : null;
  if (!category || !group || !category.active || !group.active) throw new Error("Choose a category that is open for ads.");
  for (const id of args.photoIds) {
    if (!(await ctx.db.system.get(id))) throw new Error("A photo did not finish uploading. Please add it again.");
  }
  const optional = (s?: string) => (s && s.trim() ? s.trim() : undefined);
  return {
    kind: args.kind,
    groupId: group._id,
    categoryId: category._id,
    title: args.title.trim(),
    description: args.description.trim(),
    photoIds: args.photoIds,
    priceUGX: args.priceUGX,
    priceUnit: optional(args.priceUnit)?.slice(0, 30),
    negotiable: args.negotiable,
    quantity: optional(args.quantity)?.slice(0, 60),
    neededBy: args.kind === "wanted" ? optional(args.neededBy) : undefined,
    district: args.district.trim(),
    locationDetail: optional(args.locationDetail)?.slice(0, 120),
    contactPhone: normalizeUgandaPhone(args.contactPhone)!,
  };
}

export const createAd = mutation({
  args: {
    sessionToken: v.string(),
    ...adFields,
    // The cost the form showed the poster; if the price changed meanwhile, the post is stopped.
    expectedCostFarmcoin: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken);
    const settings = await getSettings(ctx);
    const now = getUgandaTime();
    const recent = await ctx.db
      .query("marketspaceAds")
      .withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", user._id).gt("createdAt", now - DAY_MS))
      .take(settings.maxAdsPerDay);
    if (recent.length >= settings.maxAdsPerDay) {
      throw new Error(`You can post up to ${settings.maxAdsPerDay} ad${settings.maxAdsPerDay === 1 ? "" : "s"} a day. Please try again tomorrow.`);
    }
    const { sessionToken: _token, expectedCostFarmcoin, ...fields } = args;
    const clean = await cleanAd(ctx, fields, settings);
    const used = await freeAdsUsed(ctx, user._id);
    const terms = nextAdTerms(settings, used);
    if (terms.cost !== expectedCostFarmcoin) {
      throw new Error(
        terms.cost === 0
          ? "This ad is now free to post. Please check and post again."
          : `Posting this ad now costs ${terms.cost} FarmCoin. Please check and post again.`
      );
    }
    const utid = generateUTID("mks");
    if (terms.cost > 0) {
      await chargeFarmcoin(ctx, user, terms.cost, { title: clean.title, utid }, "marketspace_paid_ad", `MarketSpace paid ad (${daysText(terms.days)}): ${clean.title}`);
    }
    const adId = await ctx.db.insert("marketspaceAds", {
      ...clean,
      ownerId: user._id,
      utid,
      status: "active",
      expiresAt: now + terms.days * DAY_MS,
      paid: !terms.free,
      postingCostFarmcoin: terms.cost,
      reportCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    const record = await posterRecord(ctx, user._id);
    const counts = {
      freeAdsUsed: used + (terms.free ? 1 : 0),
      paidAdsPosted: (record?.paidAdsPosted ?? 0) + (terms.free ? 0 : 1),
      updatedAt: now,
    };
    if (record) await ctx.db.patch(record._id, counts);
    else await ctx.db.insert("marketspacePosters", { userId: user._id, ...counts });
    return { adId, utid, days: terms.days, cost: terms.cost, paid: !terms.free };
  },
});

export const updateAd = mutation({
  args: { sessionToken: v.string(), adId: v.id("marketspaceAds"), ...adFields },
  handler: async (ctx, args) => {
    const { ad } = await requireOwnAd(ctx, args.sessionToken, args.adId);
    if (ad.status === "removed") throw new Error("An admin removed this ad, so it can't be edited.");
    const { sessionToken: _token, adId: _adId, ...fields } = args;
    const clean = await cleanAd(ctx, fields, await getSettings(ctx));
    // Photos taken out of the ad are deleted from storage.
    for (const id of ad.photoIds) {
      if (!clean.photoIds.includes(id)) await ctx.storage.delete(id);
    }
    await ctx.db.patch(ad._id, { ...clean, updatedAt: getUgandaTime() });
    return { success: true };
  },
});

export const markSold = mutation({
  args: { sessionToken: v.string(), adId: v.id("marketspaceAds") },
  handler: async (ctx, args) => {
    const { ad } = await requireOwnAd(ctx, args.sessionToken, args.adId);
    if (ad.status === "removed") throw new Error("An admin removed this ad.");
    await ctx.db.patch(ad._id, { status: "sold", updatedAt: getUgandaTime() });
    return { success: true };
  },
});

export const deleteAd = mutation({
  args: { sessionToken: v.string(), adId: v.id("marketspaceAds") },
  handler: async (ctx, args) => {
    const { ad } = await requireOwnAd(ctx, args.sessionToken, args.adId);
    for (const id of ad.photoIds) await ctx.storage.delete(id);
    const reports = await ctx.db.query("marketspaceReports").withIndex("by_adId", (q) => q.eq("adId", ad._id)).take(500);
    for (const r of reports) await ctx.db.delete(r._id);
    await ctx.db.delete(ad._id);
    return { success: true };
  },
});

/**
 * Keep an ad up for another extension period, or bring an expired one back.
 * The period and FarmCoin cost are super admin settings (free when the cost is 0).
 */
export const extendAd = mutation({
  args: { sessionToken: v.string(), adId: v.id("marketspaceAds") },
  handler: async (ctx, args) => {
    const { user, ad } = await requireOwnAd(ctx, args.sessionToken, args.adId);
    if (ad.status !== "active" && ad.status !== "expired") {
      throw new Error(ad.status === "sold" ? "This ad is marked sold." : "An admin removed this ad.");
    }
    const settings = await getSettings(ctx);
    const cost = settings.extensionCostFarmcoin;
    if (cost > 0) {
      await chargeFarmcoin(ctx, user, cost, ad, "marketspace_ad_extension", `MarketSpace ad extended ${daysText(settings.extensionDays)}: ${ad.title}`);
    }
    const now = getUgandaTime();
    const expiresAt = extendedExpiry(ad.expiresAt, now, settings.extensionDays);
    await ctx.db.patch(ad._id, { status: "active", expiresAt, updatedAt: now });
    return { expiresAt, cost, days: settings.extensionDays };
  },
});

// ------------------------------------------------------------------
// Super admin: groups and categories
// ------------------------------------------------------------------

export const adminTaxonomy = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await sessionUser(ctx, args.sessionToken);
    if (!user || !isSuperAdmin(user)) return null;
    const tax = await loadTaxonomy(ctx);
    const groups = [...tax.groups.values()].sort((a, b) => a.sortOrder - b.sortOrder);
    const result = [];
    for (const g of groups) {
      const cats = [...tax.categories.values()].filter((c) => c.groupId === g._id).sort((a, b) => a.sortOrder - b.sortOrder);
      const categories = [];
      for (const c of cats) {
        const used = await ctx.db.query("marketspaceAds").withIndex("by_categoryId", (q) => q.eq("categoryId", c._id)).first();
        categories.push({ _id: c._id, name: c.name, icon: c.icon, sortOrder: c.sortOrder, active: c.active, inUse: !!used });
      }
      result.push({ _id: g._id, name: g.name, icon: g.icon, color: g.color, sortOrder: g.sortOrder, active: g.active, categories });
    }
    return result;
  },
});

function cleanName(name: string, what: string): string {
  const n = name.trim();
  if (n.length < 2 || n.length > 40) throw new Error(`${what} name must be 2 to 40 characters.`);
  return n;
}

function cleanIcon(icon: string): string {
  const i = icon.trim();
  if (!i || i.length > 16) throw new Error("Choose an icon (an emoji).");
  return i;
}

export const saveGroup = mutation({
  args: {
    sessionToken: v.string(),
    groupId: v.optional(v.id("marketspaceGroups")),
    name: v.string(),
    icon: v.string(),
    color: v.string(),
    sortOrder: v.number(),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireSuperAdmin(ctx, args.sessionToken);
    if (!/^#[0-9a-fA-F]{6}$/.test(args.color)) throw new Error("Colour must be a hex value like #2e7d32.");
    const now = getUgandaTime();
    const fields = { name: cleanName(args.name, "Group"), icon: cleanIcon(args.icon), color: args.color, sortOrder: args.sortOrder, active: args.active, updatedAt: now };
    if (args.groupId) {
      if (!(await ctx.db.get(args.groupId))) throw new Error("Group not found.");
      await ctx.db.patch(args.groupId, fields);
      return args.groupId;
    }
    return await ctx.db.insert("marketspaceGroups", { ...fields, createdBy: admin._id, createdAt: now });
  },
});

export const deleteGroup = mutation({
  args: { sessionToken: v.string(), groupId: v.id("marketspaceGroups") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx, args.sessionToken);
    const hasCategory = await ctx.db.query("marketspaceCategories").withIndex("by_groupId", (q) => q.eq("groupId", args.groupId)).first();
    if (hasCategory) throw new Error("Delete or move this group's categories first, or hide the group instead.");
    const hasAd = await ctx.db.query("marketspaceAds").withIndex("by_groupId", (q) => q.eq("groupId", args.groupId)).first();
    if (hasAd) throw new Error("Ads use this group. Hide it instead.");
    await ctx.db.delete(args.groupId);
    return { success: true };
  },
});

export const saveCategory = mutation({
  args: {
    sessionToken: v.string(),
    categoryId: v.optional(v.id("marketspaceCategories")),
    groupId: v.id("marketspaceGroups"),
    name: v.string(),
    icon: v.string(),
    sortOrder: v.number(),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireSuperAdmin(ctx, args.sessionToken);
    if (!(await ctx.db.get(args.groupId))) throw new Error("Group not found.");
    const now = getUgandaTime();
    const fields = { groupId: args.groupId, name: cleanName(args.name, "Category"), icon: cleanIcon(args.icon), sortOrder: args.sortOrder, active: args.active, updatedAt: now };
    if (args.categoryId) {
      const existing = await ctx.db.get(args.categoryId);
      if (!existing) throw new Error("Category not found.");
      if (existing.groupId !== args.groupId) {
        const used = await ctx.db.query("marketspaceAds").withIndex("by_categoryId", (q) => q.eq("categoryId", existing._id)).first();
        if (used) throw new Error("Ads use this category, so it can't move to another group.");
      }
      await ctx.db.patch(args.categoryId, fields);
      return args.categoryId;
    }
    return await ctx.db.insert("marketspaceCategories", { ...fields, createdBy: admin._id, createdAt: now });
  },
});

export const deleteCategory = mutation({
  args: { sessionToken: v.string(), categoryId: v.id("marketspaceCategories") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx, args.sessionToken);
    const used = await ctx.db.query("marketspaceAds").withIndex("by_categoryId", (q) => q.eq("categoryId", args.categoryId)).first();
    if (used) throw new Error("Ads use this category. Hide it instead.");
    await ctx.db.delete(args.categoryId);
    return { success: true };
  },
});

async function seedStarters(ctx: MutationCtx, adminId?: Id<"users">) {
  if (await ctx.db.query("marketspaceGroups").first()) return { seeded: false };
  const now = getUgandaTime();
  let g = 0;
  for (const group of STARTER_GROUPS) {
    const groupId = await ctx.db.insert("marketspaceGroups", {
      name: group.name,
      icon: group.icon,
      color: group.color,
      sortOrder: ++g,
      active: true,
      createdBy: adminId,
      createdAt: now,
      updatedAt: now,
    });
    let c = 0;
    for (const cat of group.categories) {
      await ctx.db.insert("marketspaceCategories", {
        groupId,
        name: cat.name,
        icon: cat.icon,
        sortOrder: ++c,
        active: true,
        createdBy: adminId,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return { seeded: true };
}

/** Super admin button: add the starter groups when there are none yet. */
export const addStarterCategories = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireSuperAdmin(ctx, args.sessionToken);
    return await seedStarters(ctx, admin._id);
  },
});

/** Deploy-time seed (npx convex run marketspace:seedStarterCategories). */
export const seedStarterCategories = internalMutation({
  args: {},
  handler: async (ctx) => await seedStarters(ctx),
});

// ------------------------------------------------------------------
// Super admin: periods, free ads, prices and limits
// ------------------------------------------------------------------

const settingsFields = {
  freeAdDays: v.number(),
  paidAdDays: v.number(),
  extensionDays: v.number(),
  freeAdsPerAccount: v.number(),
  paidAdCostFarmcoin: v.number(),
  extensionCostFarmcoin: v.number(),
  maxPhotosPerAd: v.number(),
  maxAdsPerDay: v.number(),
};

/** The settings in effect, and which ones are still on their default. */
export const adminSettings = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const user = await sessionUser(ctx, args.sessionToken);
    if (!user || !isSuperAdmin(user)) return null;
    const row = await ctx.db.query("marketspaceSettings").first();
    const saved: Record<string, boolean> = {};
    for (const key of Object.keys(settingsFields)) saved[key] = typeof (row as Record<string, unknown> | null)?.[key] === "number";
    return { settings: withDefaults(row), saved, updatedAt: row?.updatedAt ?? null };
  },
});

export const saveSettings = mutation({
  args: { sessionToken: v.string(), reason: v.string(), ...settingsFields },
  handler: async (ctx, args) => {
    const admin = await requireSuperAdmin(ctx, args.sessionToken);
    const { sessionToken: _token, reason, ...settings } = args;
    const problem = validateSettings(settings);
    if (problem) throw new Error(problem);
    const now = getUgandaTime();
    const row = await ctx.db.query("marketspaceSettings").first();
    const previous = withDefaults(row);
    if (row) await ctx.db.patch(row._id, { ...settings, updatedBy: admin._id, updatedAt: now });
    else await ctx.db.insert("marketspaceSettings", { ...settings, updatedBy: admin._id, updatedAt: now });
    await ctx.db.insert("adminActions", {
      adminId: admin._id,
      actionType: "update_marketspace_settings",
      utid: generateUTID("admin"),
      reason: reason.trim() || "MarketSpace settings update",
      metadata: { previous, settings },
      timestamp: now,
    });
    return { success: true };
  },
});

// ------------------------------------------------------------------
// Admins: moderation
// ------------------------------------------------------------------

/** Reported ads first, then the newest ads on the board. */
export const moderationQueue = query({
  args: { sessionToken: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const user = await sessionUser(ctx, args.sessionToken);
    if (!user || !canModerate(user)) return null;
    const tax = await loadTaxonomy(ctx);
    const open = await ctx.db
      .query("marketspaceReports")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "open"))
      .order("desc")
      .take(200);
    const byAd = new Map<Id<"marketspaceAds">, typeof open>();
    for (const r of open) byAd.set(r.adId, [...(byAd.get(r.adId) ?? []), r]);
    const reported = [];
    for (const [adId, reports] of byAd) {
      const ad = await ctx.db.get(adId);
      if (!ad) continue;
      reported.push({
        ad: { ...(await toCard(ctx, ad, tax, true)), removedReason: ad.removedReason ?? null },
        reports: reports.map((r) => ({ _id: r._id, reason: r.reason, details: r.details ?? null, byGuest: !r.reporterId, createdAt: r.createdAt })),
      });
    }
    const recentAds = await ctx.db
      .query("marketspaceAds")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "active"))
      .order("desc")
      .take(50);
    const recent = [];
    for (const ad of recentAds) {
      if (ad.expiresAt > args.now && !byAd.has(ad._id)) recent.push(await toCard(ctx, ad, tax, false));
    }
    return { reported, recent };
  },
});

async function resolveReports(ctx: MutationCtx, adId: Id<"marketspaceAds">, status: "dismissed" | "actioned", by: Id<"users">) {
  const reports = await ctx.db.query("marketspaceReports").withIndex("by_adId", (q) => q.eq("adId", adId)).take(500);
  const now = getUgandaTime();
  for (const r of reports) {
    if (r.status === "open") await ctx.db.patch(r._id, { status, resolvedBy: by, resolvedAt: now });
  }
}

export const removeAd = mutation({
  args: { sessionToken: v.string(), adId: v.id("marketspaceAds"), reason: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireModerator(ctx, args.sessionToken);
    const reason = args.reason.trim();
    if (reason.length < 3) throw new Error("Give a reason for removing the ad.");
    const ad = await ctx.db.get(args.adId);
    if (!ad) throw new Error("Ad not found.");
    const now = getUgandaTime();
    await ctx.db.patch(ad._id, { status: "removed", removedBy: admin._id, removedReason: reason, removedAt: now, updatedAt: now });
    await resolveReports(ctx, ad._id, "actioned", admin._id);
    await ctx.db.insert("adminActions", {
      adminId: admin._id,
      actionType: "marketspace_remove_ad",
      targetUserId: ad.ownerId,
      targetUtid: ad.utid,
      reason,
      utid: generateUTID("admin"),
      timestamp: now,
    });
    await notifyOwner(ctx, ad.ownerId, "MarketSpace ad removed", `An admin removed your ad "${ad.title}". Reason: ${reason}`, ad.utid);
    return { success: true };
  },
});

export const dismissReports = mutation({
  args: { sessionToken: v.string(), adId: v.id("marketspaceAds") },
  handler: async (ctx, args) => {
    const admin = await requireModerator(ctx, args.sessionToken);
    await resolveReports(ctx, args.adId, "dismissed", admin._id);
    return { success: true };
  },
});

// ------------------------------------------------------------------
// Scheduled: mark ads past their expiry as expired
// ------------------------------------------------------------------

export const expireAds = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = getUgandaTime();
    const due = await ctx.db
      .query("marketspaceAds")
      .withIndex("by_status_and_expiresAt", (q) => q.eq("status", "active").lte("expiresAt", now))
      .take(200);
    for (const ad of due) {
      await ctx.db.patch(ad._id, { status: "expired", updatedAt: now });
      await notifyOwner(
        ctx,
        ad.ownerId,
        "MarketSpace ad expired",
        `Your ad "${ad.title}" has reached its end date and is hidden from the board. Open MarketSpace → My ads to bring it back.`,
        ad.utid
      );
    }
    if (due.length === 200) await ctx.scheduler.runAfter(0, internal.marketspace.expireAds, {});
    return { expired: due.length };
  },
});
