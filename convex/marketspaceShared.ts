/**
 * MarketSpace rules shared by the Convex functions, the pages and the tests.
 * Pure functions only: no database access.
 */

import { PURCHASER_ROLES } from "./lotOrdersShared";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 1000;
export const SAFETY_NOTICE = "Always pay on delivery after inspecting the goods.";

export type AdKind = "offer" | "wanted";

/** Everything the super admin controls about posting and paying for ads. */
export type MarketspaceSettings = {
  freeAdDays: number; // How long a free ad stays up
  paidAdDays: number; // How long a paid ad stays up
  extensionDays: number; // Days each extension adds
  freeAdsPerAccount: number; // Free ads per account, over its lifetime; later ads are paid
  paidAdCostFarmcoin: number;
  extensionCostFarmcoin: number;
  maxPhotosPerAd: number;
  maxAdsPerDay: number; // Anti-spam: new ads one user can post in 24 hours
  maxVendDays: number; // Longest a vended listing stays up before it must be refreshed
  bulkVendCostFarmcoin: number; // FarmCoin to switch on "Sell in bulk" (0 = free)
};

/**
 * Used only until the super admin saves the settings (and for a setting added
 * later that has not been saved yet). The admin page shows the values in effect.
 */
export const DEFAULT_SETTINGS: MarketspaceSettings = {
  freeAdDays: 30,
  paidAdDays: 30,
  extensionDays: 30,
  freeAdsPerAccount: 3,
  paidAdCostFarmcoin: 0,
  extensionCostFarmcoin: 0,
  maxPhotosPerAd: 5,
  maxAdsPerDay: 5,
  maxVendDays: 30,
  bulkVendCostFarmcoin: 0,
};

/** Allowed range for each setting (whole numbers). */
export const SETTING_LIMITS: Record<keyof MarketspaceSettings, { min: number; max: number; label: string }> = {
  freeAdDays: { min: 1, max: 365, label: "Free ad period (days)" },
  paidAdDays: { min: 1, max: 365, label: "Paid ad period (days)" },
  extensionDays: { min: 1, max: 365, label: "Extension period (days)" },
  freeAdsPerAccount: { min: 0, max: 1000, label: "Free ads per account" },
  paidAdCostFarmcoin: { min: 0, max: 1_000_000, label: "Paid ad cost (FarmCoin)" },
  extensionCostFarmcoin: { min: 0, max: 1_000_000, label: "Extension cost (FarmCoin)" },
  maxPhotosPerAd: { min: 1, max: 10, label: "Maximum photos per ad" },
  maxAdsPerDay: { min: 1, max: 100, label: "Maximum new ads per user per day" },
  maxVendDays: { min: 7, max: 90, label: "Longest a vended listing stays up (days)" },
  bulkVendCostFarmcoin: { min: 0, max: 1_000_000, label: "Sell in bulk cost (FarmCoin)" },
};

/** Saved settings with defaults filled in for anything not saved yet. */
export function withDefaults(saved: Partial<MarketspaceSettings> | null | undefined): MarketspaceSettings {
  const out = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof MarketspaceSettings)[]) {
    const value = saved?.[key];
    if (typeof value === "number") out[key] = value;
  }
  return out;
}

/** Returns the first invalid setting, or null. */
export function validateSettings(s: MarketspaceSettings): string | null {
  for (const key of Object.keys(SETTING_LIMITS) as (keyof MarketspaceSettings)[]) {
    const { min, max, label } = SETTING_LIMITS[key];
    const value = s[key];
    if (!Number.isInteger(value) || value < min || value > max) return `${label} must be a whole number from ${min} to ${max}.`;
  }
  return null;
}

/** Whether the next ad is free, and what it costs and how long it runs if not. */
export function nextAdTerms(settings: MarketspaceSettings, freeAdsUsed: number): { free: boolean; freeAdsLeft: number; cost: number; days: number } {
  const freeAdsLeft = Math.max(0, settings.freeAdsPerAccount - freeAdsUsed);
  const free = freeAdsLeft > 0;
  return { free, freeAdsLeft, cost: free ? 0 : settings.paidAdCostFarmcoin, days: free ? settings.freeAdDays : settings.paidAdDays };
}

export function daysText(days: number): string {
  return `${days} day${days === 1 ? "" : "s"}`;
}

export const REPORT_REASONS = [
  { value: "scam", label: "Scam or fraud" },
  { value: "wrong_category", label: "Wrong category" },
  { value: "offensive", label: "Offensive content" },
  { value: "already_sold", label: "Already sold / no longer available" },
  { value: "other", label: "Other" },
] as const;

/** Starter groups and categories; the super admin can edit all of them. */
export const STARTER_GROUPS = [
  {
    name: "Goods",
    icon: "🧺",
    color: "#2e7d32",
    categories: [
      { name: "Crops", icon: "🌾" },
      { name: "Animals", icon: "🐄" },
    ],
  },
  {
    name: "Services",
    icon: "🛠️",
    color: "#1565c0",
    categories: [
      { name: "Extension services", icon: "🧑‍🌾" },
      { name: "Equipment sales", icon: "🚜" },
      { name: "Rental services", icon: "🔑" },
    ],
  },
];

/**
 * Normalise a Ugandan phone number to +256XXXXXXXXX, or return null when it
 * is not one. Accepts 07…/03…/04…, 256…, +256… with spaces or dashes.
 */
export function normalizeUgandaPhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/[\s\-().]/g, "").replace(/^\+/, "");
  let national: string;
  if (/^256\d{9}$/.test(digits)) national = digits.slice(3);
  else if (/^0\d{9}$/.test(digits)) national = digits.slice(1);
  else if (/^\d{9}$/.test(digits)) national = digits;
  else return null;
  // Mobile numbers start with 7, landlines with 3 or 4.
  if (!/^[347]/.test(national)) return null;
  return `+256${national}`;
}

/** Digits only, for wa.me links. */
export function whatsappNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** The expiry after an extension of `days`: counted from now if already expired. */
export function extendedExpiry(currentExpiresAt: number, now: number, days: number): number {
  return Math.max(currentExpiresAt, now) + days * DAY_MS;
}

export function isLive(ad: { status: string; expiresAt: number }, now: number): boolean {
  return ad.status === "active" && ad.expiresAt > now;
}

/** Days left before expiry, to the nearest day: 0 once expired, at least 1 while live. */
export function daysLeft(expiresAt: number, now: number): number {
  if (expiresAt <= now) return 0;
  return Math.max(1, Math.round((expiresAt - now) / DAY_MS));
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * Which FarmCoin wallet a role pays from. Traders and transporters hold the
 * "trader" account (keyed by traderId); buyers hold "buyer_reward"; every
 * other member earns into the "farmer" account (keyed by userId).
 */
export function walletForRole(role: string): { accountType: "trader" | "buyer_reward" | "farmer"; key: "traderId" | "userId" } | null {
  if (role === "admin") return null;
  if (role === "trader" || role === "transporter") return { accountType: "trader", key: "traderId" };
  if (role === "buyer") return { accountType: "buyer_reward", key: "userId" };
  return { accountType: "farmer", key: "userId" };
}

export type AdInput = {
  kind: AdKind;
  title: string;
  description: string;
  priceUGX?: number;
  priceUnit?: string;
  negotiable: boolean;
  quantity?: string;
  neededBy?: string;
  district: string;
  locationDetail?: string;
  contactPhone: string;
  photoCount: number;
};

/** Returns the first problem with an ad, or null when it is valid. */
export function validateAd(ad: AdInput, maxPhotos: number): string | null {
  const title = ad.title.trim();
  if (title.length < 3) return "Give the ad a title (at least 3 characters).";
  if (title.length > TITLE_MAX) return `Keep the title under ${TITLE_MAX} characters.`;
  if (ad.description.trim().length > DESCRIPTION_MAX) return `Keep the description under ${DESCRIPTION_MAX} characters.`;
  if (!ad.district.trim()) return "Choose a district.";
  if (!normalizeUgandaPhone(ad.contactPhone)) return "Enter a valid Ugandan phone number, e.g. 0772 123456.";
  if (ad.priceUGX !== undefined && (!Number.isFinite(ad.priceUGX) || ad.priceUGX < 0)) return "Price must be zero or more.";
  if (ad.kind === "offer" && ad.priceUGX === undefined && !ad.negotiable) return "Enter a price or mark it negotiable.";
  if (ad.neededBy !== undefined && ad.neededBy !== "" && !isIsoDate(ad.neededBy)) return "The 'needed by' date is not valid.";
  if (ad.kind === "offer" && ad.neededBy) return "Only Wanted ads have a 'needed by' date.";
  if (ad.photoCount > maxPhotos) return `Add at most ${maxPhotos} photo${maxPhotos === 1 ? "" : "s"}.`;
  return null;
}

// ------------------------------------------------------------------
// Vending lot listings on MarketSpace
// ------------------------------------------------------------------

/** How long a vended listing stays up before it must be refreshed (the "self-destruct timer"). */
export function vendDayChoices(maxVendDays: number): number[] {
  return [7, 14, 30, 60, 90].filter((d) => d <= maxVendDays);
}

/** Preset bulk ranges a verified seller picks from; the kilos for sale must fall in the range. */
export const BULK_RANGES = [
  { key: "100kg_1t", label: "100 kg – 1 tonne", minKg: 100, maxKg: 1000 },
  { key: "1t_5t", label: "1 – 5 tonnes", minKg: 1000, maxKg: 5000 },
  { key: "5t_20t", label: "5 – 20 tonnes", minKg: 5000, maxKg: 20000 },
  { key: "over_20t", label: "Over 20 tonnes", minKg: 20000, maxKg: null as number | null },
] as const;

export type BulkRangeKey = (typeof BULK_RANGES)[number]["key"];

export function bulkRange(key: string | undefined | null) {
  return BULK_RANGES.find((r) => r.key === key) ?? null;
}

/** Packaged items sold in batches go under Local Bulk without a kilo range. */
export const PACKAGED_BATCHES = { key: "batches", label: "Packaged batches" };

/** Why `kg` does not fit the range, or null when it does. */
export function bulkRangeProblem(key: string, kg: number): string | null {
  const range = bulkRange(key);
  if (!range) return "Choose one of the bulk ranges.";
  if (kg < range.minKg || (range.maxKg !== null && kg > range.maxKg)) {
    return `This listing has ${kg.toLocaleString()} kg for sale, which is not in "${range.label}".`;
  }
  return null;
}

// ------------------------------------------------------------------
// The lite card: what visitors and unverified viewers see
// ------------------------------------------------------------------

/** "UGX 1,000 – 1,500 /kg": a price band in steps of 500 (lite cards hide the exact price). */
export function priceBand(pricePerKilo: number | undefined | null): string | null {
  if (!pricePerKilo || pricePerKilo <= 0) return null;
  const step = pricePerKilo < 2000 ? 500 : pricePerKilo < 10000 ? 1000 : 5000;
  const low = Math.floor(pricePerKilo / step) * step;
  return `UGX ${low.toLocaleString()} – ${(low + step).toLocaleString()} /kg`;
}

/** A rough quantity for lite cards: "under 100 kg", "1 – 5 tonnes", ... */
export function quantityBand(kg: number | undefined | null): string | null {
  if (!kg || kg <= 0) return null;
  if (kg < 100) return "under 100 kg";
  const range = BULK_RANGES.find((r) => kg >= r.minKg && (r.maxKg === null || kg <= r.maxKg));
  return range?.label ?? null;
}

/** Who is looking at a card: not signed in, signed in, or a verified purchaser (convex/lotOrders lotBuyingAccess). */
export type ViewerTier = "public" | "member" | "verified";

export type CardView = "produce" | "lots" | "classifieds";

/**
 * Lite cards hide what only verified purchasers should see. Visitors get lite cards
 * everywhere; signed-in members get full classified ads but lite produce
 * and lots until they are verified purchasers. A seller always sees their own
 * card in full.
 */
export function isLiteFor(view: CardView, tier: ViewerTier, isMine = false): boolean {
  if (isMine || tier === "verified") return false;
  return tier === "public" || view !== "classifieds";
}

/**
 * Farmers' produce (the commercial farmer rule). Verified purchasers (exporters,
 * processors, vendors and business buyers) see every farmer's lots,
 * including farm-gate cards (lots not on MarketSpace); visitors and
 * unverified members see only verified commercial farmers' lots. Other posts
 * and a seller's own lots are not affected.
 */
export function produceVisible(
  card: { view: CardView; status: string; sellerCommercial?: "pending" | "verified" },
  viewer: { tier: ViewerTier; role: string | null; isMine: boolean }
): boolean {
  if (card.view !== "produce" || viewer.isMine) return true;
  if (seesFarmGate(viewer)) return true;
  if (card.status === "farm_gate") return false;
  return card.sellerCommercial === "verified";
}

/** Verified purchasers (exporters, processors, vendors and business buyers) buy at the farm gate, so they see every farmer's lots. */
export function seesFarmGate(viewer: { tier: ViewerTier; role: string | null }): boolean {
  return viewer.tier === "verified" && (PURCHASER_ROLES as readonly string[]).includes(viewer.role ?? "");
}

/** Whether a card can be opened and bought from now: on MarketSpace and in time, or a farm-gate card. */
export function cardIsLive(card: { status: string; expiresAt: number }, now: number): boolean {
  return (card.status === "active" && card.expiresAt > now) || card.status === "farm_gate";
}

/** Discover's sections as its chips name them; "where it shows" lines use the same words. */
export const SECTION_LABELS = {
  all: "All",
  produce: "🌾 Farmers Produce",
  farmgate: "🚜 Farm Gate",
  bulk: "📦 Local Bulk",
  lots: "🏪 Vendors and Processors",
  classifieds: "📰 Classifieds",
} as const;

/**
 * Where a seller's lot shows in Discover: a farmer's in Farmers Produce (at
 * the Farm Gate while it is not on MarketSpace), everyone else's in Vendors
 * and Processors, and in Local Bulk too when it sells in bulk.
 */
export function lotSections(role: string, lot: { bulk: boolean; farmGate: boolean }): string[] {
  if (role === "farmer" && lot.farmGate) return [SECTION_LABELS.farmgate];
  const main = role === "farmer" ? SECTION_LABELS.produce : SECTION_LABELS.lots;
  return lot.bulk ? [main, SECTION_LABELS.bulk] : [main];
}

export type PastLotOutcome = "sold" | "withdrawn" | "taken_off" | "time_ran_out" | "all_ordered";

export const PAST_LOT_OUTCOMES: Record<PastLotOutcome, string> = {
  sold: "Sold out",
  withdrawn: "Withdrawn",
  taken_off: "Taken off",
  time_ran_out: "Time ran out",
  all_ordered: "All lots ordered",
};

/** Why a lot post is no longer on MarketSpace, for My posts' past posts. */
export function pastLotOutcome(
  card: { status: string; expiresAt: number },
  listing: { status: string; withdrawnAt?: number; vendExpiresAt?: number } | null,
  now: number
): PastLotOutcome {
  if (listing && (listing.status === "fully_locked" || listing.status === "delivered")) return "sold";
  if (!listing || listing.status === "cancelled" || listing.withdrawnAt !== undefined) return "withdrawn";
  if (listing.vendExpiresAt === undefined) return "taken_off";
  if (card.status === "active" && card.expiresAt <= now) return "time_ran_out";
  return "all_ordered"; // Closed while still vended: every lot left is in an order
}

/** The line a lite card shows instead of the details. */
export function liteReason(tier: ViewerTier): string {
  return tier === "public"
    ? "Sign up as a buyer to see prices and full details."
    : "Get verified to see prices, ask questions and buy.";
}

/**
 * What Purchase now on a lot tells a signed-in member who cannot buy yet:
 * a vendor gets verified by sending their business profile from My Ledger
 * (ledger: true); other purchasers wait for Farm2Market to verify them;
 * everyone else does not buy lots.
 */
export function purchaseHelp(role: string | null): { text: string; ledger: boolean } {
  const why = "Only verified purchasers can buy, to keep your money and the seller's goods safe.";
  if (role === "vendor") {
    return { text: `${why} Send your business profile (business name and one document) from My Ledger. When Farm2Market approves it, you can buy.`, ledger: true };
  }
  if ((PURCHASER_ROLES as readonly string[]).includes(role ?? "")) {
    return { text: `${why} Farm2Market has not verified your account yet. Once it does, come back here to buy.`, ledger: false };
  }
  return { text: "Buying lots is for vendors, processors, exporters and business buyers.", ledger: false };
}

type CardSource = {
  _id: string;
  view: CardView;
  kind: "offer" | "wanted";
  title: string;
  isBulk: boolean;
  bulkRange?: string;
  sellerRole: string;
  district: string;
  stockSource?: "own_farm" | "in_app" | "off_app";
  lotKg?: number;
  bagKg?: number;
  bagsPerLot?: number;
  lotsAvailable?: number;
  qtyKg?: number;
  quantityText?: string;
  packaged?: boolean;
  pricePerKilo?: number;
  priceUGX?: number;
  priceUnit?: string;
  commitPercent?: number;
  qualityRating?: string;
  status?: string;
  sellerCommercial?: "pending" | "verified";
  expiresAt: number;
  createdAt: number;
};

/**
 * What a card sends to a viewer. Lite cards keep the same shape with the
 * hidden fields set to null, so the screens stay simple; the server never
 * sends what the viewer may not see.
 */
export function shapeCard(
  card: CardSource,
  viewer: { tier: ViewerTier; isMine: boolean },
  extras: { thumbUrl: string | null; sellerAlias: string | null; sellerCategory: string }
) {
  const lite = isLiteFor(card.view, viewer.tier, viewer.isMine);
  const range = card.bulkRange === PACKAGED_BATCHES.key ? PACKAGED_BATCHES : bulkRange(card.bulkRange);
  return {
    cardId: card._id,
    view: card.view,
    kind: card.kind,
    title: card.title,
    thumbUrl: extras.thumbUrl,
    sellerCategory: extras.sellerCategory,
    district: card.district,
    stockSource: card.stockSource ?? null,
    isBulk: card.isBulk,
    bulkLabel: range?.label ?? null,
    packaged: !!card.packaged, // Priced per item (priceUGX, priceUnit), counted in quantityText
    farmGate: card.status === "farm_gate", // Not on MarketSpace: seen by verified purchasers as a farm-gate source
    commercialFarmer: card.view === "produce" && card.sellerCommercial === "verified", // The "Commercial Farmer" badge
    verifiedVendor: card.sellerRole === "vendor" && card.sellerCommercial === "verified", // The "Verified Vendor" badge: business documents approved
    createdAt: card.createdAt,
    expiresAt: card.expiresAt,
    isMine: viewer.isMine,
    lite,
    liteReason: lite ? liteReason(viewer.tier) : null,
    // Bands for everyone
    priceBand: priceBand(card.pricePerKilo),
    quantityBand: quantityBand(card.qtyKg),
    // Details only full viewers get
    sellerAlias: lite ? null : extras.sellerAlias,
    pricePerKilo: lite ? null : card.pricePerKilo ?? null,
    priceUGX: lite ? null : card.priceUGX ?? null,
    priceUnit: lite ? null : card.priceUnit ?? null,
    lotKg: lite ? null : card.lotKg ?? null,
    bagKg: lite ? null : card.bagKg ?? null,
    bagsPerLot: lite ? null : card.bagsPerLot ?? null,
    lotsAvailable: lite ? null : card.lotsAvailable ?? null,
    qtyKg: lite ? null : card.qtyKg ?? null,
    quantityText: lite ? null : card.quantityText ?? null,
    commitPercent: lite ? null : card.commitPercent ?? null,
    qualityRating: lite ? null : card.qualityRating ?? null,
  };
}
