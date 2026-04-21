/**
 * Market Prices
 *
 * Public price panel for login page, vendor commodity memory,
 * daily snapshot freeze, and paid Excel download entitlements.
 */

import { v } from "convex/values";
import { mutation, query, action, internalMutation } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { generateUTID, getUgandaTime } from "./utils";

// ── Emoji maps ───────────────────────────────────────────────────────────────

const MARKET_EMOJI_MAP: Record<string, string> = {
  city_market: "🏙️",
  supermarket: "🏬",
  roadside_market: "🛣️",
  town_market: "🏪",
  village_market: "🌾",
};

function getMarketEmoji(marketType?: string | null): string {
  return (marketType && MARKET_EMOJI_MAP[marketType]) || "🏪";
}

const COMMODITY_EMOJI_MAP: Record<string, string> = {
  maize: "🌽",
  rice: "🍚",
  beans: "🫘",
  tomatoes: "🍅",
  onions: "🧅",
  potatoes: "🥔",
  "sweet potatoes": "🍠",
  cassava: "🌿",
  bananas: "🍌",
  matoke: "🍌",
  pineapples: "🍍",
  mangoes: "🥭",
  avocados: "🥑",
  cabbage: "🥬",
  spinach: "🥬",
  eggs: "🥚",
  chicken: "🐔",
  fish: "🐟",
  groundnuts: "🥜",
  soybeans: "🫘",
  coffee: "☕",
  tea: "🍵",
  sugarcane: "🎋",
  milk: "🥛",
  vegetables: "🥦",
};

function getCommodityEmoji(commodity: string): string {
  const lower = commodity.toLowerCase();
  for (const [key, emoji] of Object.entries(COMMODITY_EMOJI_MAP)) {
    if (lower.includes(key)) return emoji;
  }
  return "🌾";
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function getTodayDateKey(): string {
  const now = getUgandaTime();
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function getYesterdayDateKey(): string {
  const now = getUgandaTime() - 24 * 60 * 60 * 1000;
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function getWeekScopeKey(): string {
  const now = getUgandaTime();
  const d = new Date(now);
  const year = d.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const weekNum = Math.ceil((((d.getTime() - jan1.getTime()) / 86400000) + jan1.getUTCDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

export function getMonthScopeKey(): string {
  const now = getUgandaTime();
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function median(sortedPrices: number[]): number {
  if (sortedPrices.length === 0) return 0;
  const mid = Math.floor(sortedPrices.length / 2);
  return sortedPrices.length % 2 === 0
    ? Math.round((sortedPrices[mid - 1] + sortedPrices[mid]) / 2)
    : sortedPrices[mid];
}

function resolveDateKeys(
  productType: "daily" | "weekly" | "monthly",
  scopeDateKey: string,
  todayKey: string
): string[] {
  if (productType === "daily") return [scopeDateKey];

  if (productType === "monthly") {
    const [year, month] = scopeDateKey.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const keys: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dk = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (dk <= todayKey) keys.push(dk);
    }
    return keys;
  }

  // weekly — scopeDateKey format: "YYYY-WNN"
  const [yearStr, weekPart] = scopeDateKey.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekPart, 10);
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Day = jan1.getUTCDay() || 7;
  const weekStart = new Date(jan1.getTime() - (jan1Day - 1) * 86400000 + (week - 1) * 7 * 86400000);
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.getTime() + i * 86400000);
    const dk = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    if (dk <= todayKey) keys.push(dk);
  }
  return keys;
}

// ── Auth helpers ─────────────────────────────────────────────────────────────

function assertSuperAdmin(user: any) {
  if (!user || user.role !== "admin") throw new Error("Admin access required");
  if (user.adminLevel === "junior") throw new Error("SuperAdmin access required");
}

// ── Shared snapshot build logic ──────────────────────────────────────────────

interface PriceEntry {
  price: number;
  updatedAt: number;
  source: "listing" | "submission";
}

interface GroupMeta {
  commodity: string;
  marketName: string;
  marketType?: string;
  unit: string;
}

async function runBuildSnapshot(ctx: any): Promise<void> {
  const dateKey = getTodayDateKey();
  const startOfDayUTC = (() => {
    const now = getUgandaTime();
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  })();

  const priceGroups = new Map<string, PriceEntry[]>();
  const groupMeta = new Map<string, GroupMeta>();

  // ── 1. Active vendor/store listings ─────────────────────────────────────
  const activeListings = await ctx.db
    .query("listings")
    .withIndex("by_status", (q: any) => q.eq("status", "active"))
    .collect();

  for (const listing of activeListings) {
    if (!listing.farmerId || listing.traderId) continue;
    const seller = await ctx.db.get(listing.farmerId);
    if (!seller || !["vendor", "store"].includes(seller.role)) continue;

    const price = listing.pricePerUnit ?? listing.pricePerKilo ?? 0;
    if (price <= 0) continue;

    let marketName = "Unknown Market";
    let marketType: string | undefined;
    let unit = "kg";

    if (seller.role === "vendor") {
      const vp = await ctx.db
        .query("vendorProfiles")
        .withIndex("by_userId", (q: any) => q.eq("userId", listing.farmerId))
        .first();
      marketName = vp?.marketName ?? "Unknown Market";
      marketType = vp?.marketType;
    } else {
      const sp = await ctx.db
        .query("storeProfiles")
        .withIndex("by_userId", (q: any) => q.eq("userId", listing.farmerId))
        .first();
      marketName = sp?.buildingName ?? sp?.streetAddress ?? "Unknown Store";
    }

    if (listing.pricingUnit === "per_package") {
      unit = listing.packagingTypeEnum ?? "unit";
    }

    const key = `${listing.produceType.toLowerCase()}||${marketName.toLowerCase()}`;
    if (!priceGroups.has(key)) priceGroups.set(key, []);
    priceGroups.get(key)!.push({ price, updatedAt: listing.createdAt, source: "listing" });

    if (!groupMeta.has(key)) {
      groupMeta.set(key, { commodity: listing.produceType, marketName, marketType, unit });
    }
  }

  // ── 2. Today's explicit submissions ─────────────────────────────────────
  const submissions = await ctx.db
    .query("marketPriceSubmissions")
    .withIndex("by_submitted_at", (q: any) => q.gte("submittedAt", startOfDayUTC))
    .collect();

  for (const s of submissions) {
    const key = `${s.commodity.toLowerCase()}||${s.marketName.toLowerCase()}`;
    if (!priceGroups.has(key)) priceGroups.set(key, []);
    priceGroups.get(key)!.push({ price: s.priceUGX, updatedAt: s.submittedAt, source: "submission" });

    if (!groupMeta.has(key)) {
      groupMeta.set(key, {
        commodity: s.commodity,
        marketName: s.marketName,
        marketType: s.marketType,
        unit: s.unit,
      });
    }
  }

  // ── 3. Aggregate ─────────────────────────────────────────────────────────
  interface AggRow {
    commodity: string;
    unit: string;
    marketName: string;
    marketType?: string;
    minPriceUGX: number;
    medianPriceUGX: number;
    maxPriceUGX: number;
    latestPriceUGX: number;
    latestUpdatedAt: number;
    source: "listing" | "submission" | "combined";
  }

  const rows: AggRow[] = [];
  for (const [key, entries] of priceGroups.entries()) {
    const meta = groupMeta.get(key);
    if (!meta || entries.length === 0) continue;

    const sortedPrices = entries.map((e) => e.price).sort((a, b) => a - b);
    const latestEntry = entries.reduce((best, e) => (e.updatedAt > best.updatedAt ? e : best), entries[0]);
    const sources = new Set(entries.map((e) => e.source));
    const source: "listing" | "submission" | "combined" =
      sources.size > 1 ? "combined" : entries[0].source;

    rows.push({
      commodity: meta.commodity,
      unit: meta.unit,
      marketName: meta.marketName,
      marketType: meta.marketType,
      minPriceUGX: sortedPrices[0],
      medianPriceUGX: median(sortedPrices),
      maxPriceUGX: sortedPrices[sortedPrices.length - 1],
      latestPriceUGX: latestEntry.price,
      latestUpdatedAt: latestEntry.updatedAt,
      source,
    });
  }

  // ── 4. Upsert snapshot record ────────────────────────────────────────────
  let snapshot = await ctx.db
    .query("dailyPriceSnapshots")
    .withIndex("by_date_key", (q: any) => q.eq("dateKey", dateKey))
    .first();

  if (!snapshot) {
    const snapId = await ctx.db.insert("dailyPriceSnapshots", {
      dateKey,
      status: "building",
      rowCount: rows.length,
    });
    snapshot = await ctx.db.get(snapId);
  } else {
    await ctx.db.patch(snapshot._id, { status: "building", rowCount: rows.length });
    snapshot = await ctx.db.get(snapshot._id);
  }

  if (!snapshot) return;

  // ── 5. Replace rows ──────────────────────────────────────────────────────
  const existingRows = await ctx.db
    .query("dailyPriceSnapshotRows")
    .withIndex("by_snapshot", (q: any) => q.eq("snapshotId", snapshot._id))
    .collect();
  for (const r of existingRows) {
    await ctx.db.delete(r._id);
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    await ctx.db.insert("dailyPriceSnapshotRows", {
      snapshotId: snapshot._id,
      commodity: r.commodity,
      commodityEmoji: getCommodityEmoji(r.commodity),
      unit: r.unit,
      marketName: r.marketName,
      marketEmoji: getMarketEmoji(r.marketType),
      minPriceUGX: r.minPriceUGX,
      medianPriceUGX: r.medianPriceUGX,
      maxPriceUGX: r.maxPriceUGX,
      latestPriceUGX: r.latestPriceUGX,
      latestUpdatedAt: r.latestUpdatedAt,
      rankOrder: i,
      source: r.source,
    });
  }
}

// ── Internal mutations (called by cron and scheduler) ────────────────────────

export const buildDailySnapshot = internalMutation({
  args: {},
  handler: async (ctx) => {
    await runBuildSnapshot(ctx);
  },
});

export const freezeDailySnapshot = internalMutation({
  args: {},
  handler: async (ctx) => {
    await runBuildSnapshot(ctx);

    const dateKey = getTodayDateKey();
    const snapshot = await ctx.db
      .query("dailyPriceSnapshots")
      .withIndex("by_date_key", (q: any) => q.eq("dateKey", dateKey))
      .first();

    if (snapshot) {
      await ctx.db.patch(snapshot._id, {
        status: "published",
        publishedAt: getUgandaTime(),
      });
    }
  },
});

export const createPendingDownloadPurchase = internalMutation({
  args: {
    buyerId: v.id("users"),
    productType: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    scopeDateKey: v.string(),
    amountUGX: v.number(),
    pesapalTrackingId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("downloadPurchases", {
      buyerId: args.buyerId,
      productType: args.productType,
      scopeDateKey: args.scopeDateKey,
      status: "pending",
      paymentMethod: "pesapal",
      pesapalTrackingId: args.pesapalTrackingId,
      amountUGX: args.amountUGX,
      purchasedAt: getUgandaTime(),
    });
  },
});

// Called by Pesapal IPN/callback handler after payment confirmation
export const confirmDownloadPurchasePesapal = internalMutation({
  args: { pesapalTrackingId: v.string() },
  handler: async (ctx, args) => {
    const purchase = await ctx.db
      .query("downloadPurchases")
      .filter((q: any) => q.eq(q.field("pesapalTrackingId"), args.pesapalTrackingId))
      .first();
    if (!purchase || purchase.status !== "pending") return;
    await ctx.db.patch(purchase._id, { status: "completed" });
  },
});

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Public price cards — anonymous, no auth required.
 * Returns the most recently updated commodity prices from the latest published snapshot.
 */
export const getPublicPriceCards = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const cap = Math.min(args.limit ?? 20, 20);

    // Try today's snapshot, fall back to yesterday's
    let snapshot = null;
    for (const dk of [getTodayDateKey(), getYesterdayDateKey()]) {
      snapshot = await ctx.db
        .query("dailyPriceSnapshots")
        .withIndex("by_date_key", (q: any) => q.eq("dateKey", dk))
        .filter((q: any) => q.eq(q.field("status"), "published"))
        .first();
      if (snapshot) break;
    }

    if (!snapshot) return { cards: [], dateKey: null };

    const rows = await ctx.db
      .query("dailyPriceSnapshotRows")
      .withIndex("by_snapshot_updated", (q: any) => q.eq("snapshotId", snapshot._id))
      .order("desc")
      .take(cap);

    return {
      dateKey: snapshot.dateKey,
      cards: rows.map((r: any) => ({
        id: r._id,
        commodity: r.commodity,
        commodityEmoji: r.commodityEmoji ?? getCommodityEmoji(r.commodity),
        unit: r.unit,
        marketName: r.marketName,
        marketEmoji: r.marketEmoji ?? "🏪",
        latestPriceUGX: r.latestPriceUGX,
        latestUpdatedAt: r.latestUpdatedAt,
      })),
    };
  },
});

/**
 * Vendor recent commodities — for autocomplete/suggestion chips in CreateListing.
 */
export const getVendorRecentCommodities = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !["vendor", "store"].includes(user.role)) {
      return { commodities: [] };
    }

    const sixtyDaysAgo = getUgandaTime() - 60 * 24 * 60 * 60 * 1000;
    const seen = new Map<string, { commodity: string; unit: string; latestPriceUGX: number; emoji: string; updatedAt: number }>();

    // From explicit submissions (most authoritative)
    const submissions = await ctx.db
      .query("marketPriceSubmissions")
      .withIndex("by_vendor", (q: any) => q.eq("vendorId", args.userId))
      .order("desc")
      .take(100);

    for (const s of submissions) {
      if (s.submittedAt < sixtyDaysAgo) continue;
      const key = s.commodity.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, {
          commodity: s.commodity,
          unit: s.unit,
          latestPriceUGX: s.priceUGX,
          emoji: s.commodityEmoji ?? getCommodityEmoji(s.commodity),
          updatedAt: s.submittedAt,
        });
      }
    }

    // From listings (fill in any gaps)
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_farmer", (q: any) => q.eq("farmerId", args.userId))
      .order("desc")
      .take(100);

    for (const l of listings) {
      if (l.createdAt < sixtyDaysAgo) continue;
      const key = l.produceType.toLowerCase();
      if (!seen.has(key)) {
        const price = l.pricePerUnit ?? l.pricePerKilo ?? 0;
        const unit = l.pricingUnit === "per_package" ? (l.packagingTypeEnum ?? "unit") : "kg";
        seen.set(key, {
          commodity: l.produceType,
          unit,
          latestPriceUGX: price,
          emoji: getCommodityEmoji(l.produceType),
          updatedAt: l.createdAt,
        });
      }
    }

    const sorted = Array.from(seen.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 8);

    return { commodities: sorted };
  },
});

/**
 * Current price sheet pricing from systemSettings.
 */
export const getPriceSheetPricing = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("systemSettings").first();
    return {
      dailyPriceUGX: settings?.priceSheetDailyPriceUGX ?? 0,
      weeklyPriceUGX: settings?.priceSheetWeeklyPriceUGX ?? 0,
      monthlyPriceUGX: settings?.priceSheetMonthlyPriceUGX ?? 0,
      currentDailyKey: getTodayDateKey(),
      currentWeeklyKey: getWeekScopeKey(),
      currentMonthlyKey: getMonthScopeKey(),
    };
  },
});

/**
 * Check if buyer has a valid completed entitlement for a given report.
 */
export const getDownloadEntitlement = query({
  args: {
    buyerId: v.id("users"),
    productType: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    scopeDateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") return null;

    const purchase = await ctx.db
      .query("downloadPurchases")
      .withIndex("by_buyer_scope", (q: any) =>
        q.eq("buyerId", args.buyerId).eq("scopeDateKey", args.scopeDateKey)
      )
      .filter((q: any) =>
        q.and(
          q.eq(q.field("productType"), args.productType),
          q.eq(q.field("status"), "completed")
        )
      )
      .first();

    if (!purchase) return null;
    if (purchase.entitlementExpiresAt && purchase.entitlementExpiresAt < getUgandaTime()) {
      return null;
    }

    return { purchased: true, purchasedAt: purchase.purchasedAt };
  },
});

/**
 * Buyer's FarmCoin reward balance.
 */
export const getBuyerRewardBalance = query({
  args: { buyerId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") return { balance: 0 };

    const latest = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", args.buyerId))
      .order("desc")
      .filter((q: any) => q.eq(q.field("accountType"), "buyer_reward"))
      .first();

    return { balance: latest?.balanceAfter ?? 0 };
  },
});

/**
 * SuperAdmin: list all published daily snapshots.
 */
export const getAdminSnapshots = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.adminId);
    assertSuperAdmin(user);

    const snapshots = await ctx.db
      .query("dailyPriceSnapshots")
      .withIndex("by_status", (q: any) => q.eq("status", "published"))
      .order("desc")
      .take(60);

    return snapshots.map((s: any) => ({
      id: s._id,
      dateKey: s.dateKey,
      rowCount: s.rowCount,
      publishedAt: s.publishedAt,
    }));
  },
});

/**
 * Get snapshot rows for XLSX download.
 * SuperAdmin: free. Buyer: must have valid completed purchase.
 */
export const getSnapshotRowsForDownload = query({
  args: {
    userId: v.id("users"),
    productType: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    scopeDateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const isSuperAdmin =
      user.role === "admin" &&
      (user.adminLevel === "super" || user.adminLevel === undefined);

    if (!isSuperAdmin) {
      if (user.role !== "buyer") throw new Error("Access denied");

      const purchase = await ctx.db
        .query("downloadPurchases")
        .withIndex("by_buyer_scope", (q: any) =>
          q.eq("buyerId", args.userId).eq("scopeDateKey", args.scopeDateKey)
        )
        .filter((q: any) =>
          q.and(
            q.eq(q.field("productType"), args.productType),
            q.eq(q.field("status"), "completed")
          )
        )
        .first();

      if (!purchase) throw new Error("No valid purchase found for this report");
      if (purchase.entitlementExpiresAt && purchase.entitlementExpiresAt < getUgandaTime()) {
        throw new Error("Your entitlement for this report has expired");
      }
    }

    const todayKey = getTodayDateKey();
    const dateKeys = resolveDateKeys(args.productType, args.scopeDateKey, todayKey);

    const allRows: any[] = [];
    for (const dk of dateKeys) {
      const snap = await ctx.db
        .query("dailyPriceSnapshots")
        .withIndex("by_date_key", (q: any) => q.eq("dateKey", dk))
        .filter((q: any) => q.eq(q.field("status"), "published"))
        .first();
      if (!snap) continue;

      const rows = await ctx.db
        .query("dailyPriceSnapshotRows")
        .withIndex("by_snapshot", (q: any) => q.eq("snapshotId", snap._id))
        .collect();

      for (const r of rows) {
        allRows.push({
          date: dk,
          commodity: r.commodity,
          unit: r.unit,
          marketName: r.marketName,
          minPriceUGX: r.minPriceUGX,
          medianPriceUGX: r.medianPriceUGX,
          maxPriceUGX: r.maxPriceUGX,
          latestPriceUGX: r.latestPriceUGX,
          source: r.source,
        });
      }
    }

    return { rows: allRows, scopeDateKey: args.scopeDateKey };
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Vendor/store submits an explicit market price.
 */
export const submitVendorPrice = mutation({
  args: {
    userId: v.id("users"),
    commodity: v.string(),
    unit: v.string(),
    priceUGX: v.number(),
    marketName: v.string(),
    marketType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !["vendor", "store"].includes(user.role)) {
      throw new Error("Only vendors and stores can submit prices");
    }
    if (args.priceUGX <= 0) throw new Error("Price must be positive");

    await ctx.db.insert("marketPriceSubmissions", {
      vendorId: args.userId,
      commodity: args.commodity.trim(),
      commodityEmoji: getCommodityEmoji(args.commodity),
      unit: args.unit,
      priceUGX: args.priceUGX,
      marketName: args.marketName.trim(),
      marketType: args.marketType,
      submittedAt: getUgandaTime(),
    });

    // ── FarmCoin reward: 1 coin per filled field ──────────────────────────
    // commodity, unit, priceUGX, marketName are always provided (4 coins)
    // marketType is optional (+1 if present)
    const fieldCount = 4 + (args.marketType ? 1 : 0);

    const latestCoinEntry = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_account", (q: any) => q.eq("accountType", "farmer"))
      .filter((q: any) => q.eq(q.field("userId"), args.userId))
      .order("desc")
      .first();

    const currentBalance = (latestCoinEntry as any)?.balanceAfter ?? 0;
    const newBalance = currentBalance + fieldCount;

    await ctx.db.insert("farmcoinLedger", {
      accountType: "farmer",
      userId: args.userId,
      delta: fieldCount,
      balanceAfter: newBalance,
      source: "form_field_reward",
      utid: generateUTID("vpr"),
      fieldCount,
      reason: `Vendor price submission reward: ${fieldCount} fields`,
      createdAt: getUgandaTime(),
    });

    // Rebuild snapshot with the new data
    await ctx.scheduler.runAfter(0, internal.marketPrices.buildDailySnapshot, {});

    return { success: true, coinsEarned: fieldCount };
  },
});

/**
 * Buyer pays for a price sheet using FarmCoin buyer_reward balance.
 */
export const purchasePriceSheetFarmcoin = mutation({
  args: {
    buyerId: v.id("users"),
    productType: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    scopeDateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") throw new Error("Buyer access required");

    const settings = await ctx.db.query("systemSettings").first();
    const priceMap: Record<string, number> = {
      daily: settings?.priceSheetDailyPriceUGX ?? 0,
      weekly: settings?.priceSheetWeeklyPriceUGX ?? 0,
      monthly: settings?.priceSheetMonthlyPriceUGX ?? 0,
    };
    const amountUGX = priceMap[args.productType] ?? 0;

    // If price is zero, grant free entitlement
    if (amountUGX <= 0) {
      await ctx.db.insert("downloadPurchases", {
        buyerId: args.buyerId,
        productType: args.productType,
        scopeDateKey: args.scopeDateKey,
        status: "completed",
        paymentMethod: "farmcoin",
        amountUGX: 0,
        purchasedAt: getUgandaTime(),
      });
      return { success: true, amountDeducted: 0 };
    }

    // Check for existing entitlement
    const existing = await ctx.db
      .query("downloadPurchases")
      .withIndex("by_buyer_scope", (q: any) =>
        q.eq("buyerId", args.buyerId).eq("scopeDateKey", args.scopeDateKey)
      )
      .filter((q: any) =>
        q.and(
          q.eq(q.field("productType"), args.productType),
          q.eq(q.field("status"), "completed")
        )
      )
      .first();
    if (existing) throw new Error("You already have access to this report");

    // Check buyer_reward balance
    const latestLedger = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", args.buyerId))
      .order("desc")
      .filter((q: any) => q.eq(q.field("accountType"), "buyer_reward"))
      .first();

    const currentBalance = latestLedger?.balanceAfter ?? 0;
    if (currentBalance < amountUGX) {
      throw new Error(`Insufficient FarmCoin balance. Need ${amountUGX}, you have ${currentBalance}`);
    }

    const utid = generateUTID("buyer");
    const balanceAfter = currentBalance - amountUGX;
    const now = getUgandaTime();

    // Deduct from buyer_reward
    await ctx.db.insert("farmcoinLedger", {
      accountType: "buyer_reward",
      userId: args.buyerId,
      delta: -amountUGX,
      balanceAfter,
      source: "price_sheet_download",
      utid,
      reason: `Market price sheet (${args.productType} – ${args.scopeDateKey})`,
      createdAt: now,
    });

    // Credit central
    const centralLatest = await ctx.db
      .query("farmcoinLedger")
      .withIndex("by_account", (q: any) => q.eq("accountType", "central"))
      .order("desc")
      .first();
    await ctx.db.insert("farmcoinLedger", {
      accountType: "central",
      delta: amountUGX,
      balanceAfter: (centralLatest?.balanceAfter ?? 0) + amountUGX,
      source: "price_sheet_download",
      utid,
      reason: `Market price sheet purchase by buyer`,
      createdAt: now,
    });

    // Create entitlement
    await ctx.db.insert("downloadPurchases", {
      buyerId: args.buyerId,
      productType: args.productType,
      scopeDateKey: args.scopeDateKey,
      status: "completed",
      paymentMethod: "farmcoin",
      amountUGX,
      purchasedAt: now,
    });

    return { success: true, amountDeducted: amountUGX, remainingBalance: balanceAfter };
  },
});

/**
 * Record a download event for audit purposes.
 */
export const recordDownloadAudit = mutation({
  args: {
    userId: v.id("users"),
    productType: v.string(),
    scopeDateKey: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    await ctx.db.insert("downloadAuditLog", {
      userId: args.userId,
      productType: args.productType,
      scopeDateKey: args.scopeDateKey,
      downloadedAt: getUgandaTime(),
    });
  },
});

/**
 * SuperAdmin: update price sheet pricing in systemSettings.
 */
export const updatePriceSheetPricing = mutation({
  args: {
    adminId: v.id("users"),
    dailyPriceUGX: v.optional(v.number()),
    weeklyPriceUGX: v.optional(v.number()),
    monthlyPriceUGX: v.optional(v.number()),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.adminId);
    assertSuperAdmin(user);

    if (args.dailyPriceUGX !== undefined && args.dailyPriceUGX < 0) throw new Error("Price cannot be negative");
    if (args.weeklyPriceUGX !== undefined && args.weeklyPriceUGX < 0) throw new Error("Price cannot be negative");
    if (args.monthlyPriceUGX !== undefined && args.monthlyPriceUGX < 0) throw new Error("Price cannot be negative");

    const now = getUgandaTime();
    const utid = generateUTID("admin");

    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      actionType: "update_price_sheet_pricing",
      utid,
      reason: args.reason,
      metadata: {
        dailyPriceUGX: args.dailyPriceUGX,
        weeklyPriceUGX: args.weeklyPriceUGX,
        monthlyPriceUGX: args.monthlyPriceUGX,
      },
      timestamp: now,
    });

    const patch: Record<string, number> = {};
    if (args.dailyPriceUGX !== undefined) patch.priceSheetDailyPriceUGX = args.dailyPriceUGX;
    if (args.weeklyPriceUGX !== undefined) patch.priceSheetWeeklyPriceUGX = args.weeklyPriceUGX;
    if (args.monthlyPriceUGX !== undefined) patch.priceSheetMonthlyPriceUGX = args.monthlyPriceUGX;

    const settings = await ctx.db.query("systemSettings").first();
    if (!settings) {
      await ctx.db.insert("systemSettings", {
        pilotMode: false,
        setBy: args.adminId,
        setAt: now,
        reason: args.reason,
        utid,
        ...patch,
      });
    } else {
      await ctx.db.patch(settings._id, patch);
    }

    return { utid, updated: patch };
  },
});

// ── Action: Pesapal purchase ──────────────────────────────────────────────────

/**
 * Buyer initiates a Pesapal payment to purchase a price sheet.
 */
export const purchasePriceSheetPesapal = action({
  args: {
    buyerId: v.id("users"),
    productType: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    scopeDateKey: v.string(),
    callbackUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const pricing: any = await ctx.runQuery(api.marketPrices.getPriceSheetPricing);
    const priceMap: Record<string, number> = {
      daily: pricing.dailyPriceUGX,
      weekly: pricing.weeklyPriceUGX,
      monthly: pricing.monthlyPriceUGX,
    };
    const amountUGX = priceMap[args.productType] ?? 0;
    if (amountUGX <= 0) {
      throw new Error("This report is currently free — use FarmCoin payment instead");
    }

    const existing: any = await ctx.runQuery(api.marketPrices.getDownloadEntitlement, {
      buyerId: args.buyerId,
      productType: args.productType,
      scopeDateKey: args.scopeDateKey,
    });
    if (existing) throw new Error("You already have access to this report");

    const result: any = await ctx.runAction(api.pesapal.initiateBuyerDeposit, {
      buyerId: args.buyerId,
      amount: amountUGX,
      currency: "UGX",
      callbackUrl: args.callbackUrl,
      cancelUrl: args.cancelUrl,
    });

    await ctx.runMutation(internal.marketPrices.createPendingDownloadPurchase, {
      buyerId: args.buyerId,
      productType: args.productType,
      scopeDateKey: args.scopeDateKey,
      amountUGX,
      pesapalTrackingId: result.orderTrackingId,
    });

    return { redirectUrl: result.redirectUrl, orderTrackingId: result.orderTrackingId };
  },
});
