/**
 * MarketSpace rules shared by the Convex functions, the pages and the tests.
 * Pure functions only: no database access.
 */

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
