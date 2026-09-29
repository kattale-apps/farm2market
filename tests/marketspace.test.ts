import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAY_MS,
  DEFAULT_SETTINGS,
  STARTER_GROUPS,
  daysLeft,
  extendedExpiry,
  nextAdTerms,
  validateSettings,
  withDefaults,
  isLive,
  normalizeUgandaPhone,
  validateAd,
  walletForRole,
  whatsappNumber,
  type AdInput,
} from "../convex/marketspaceShared";

test("Ugandan phone numbers are normalised to +256", () => {
  assert.equal(normalizeUgandaPhone("0772 123456"), "+256772123456");
  assert.equal(normalizeUgandaPhone("+256-772-123-456"), "+256772123456");
  assert.equal(normalizeUgandaPhone("256772123456"), "+256772123456");
  assert.equal(normalizeUgandaPhone("772123456"), "+256772123456");
  assert.equal(normalizeUgandaPhone("0414 123456"), "+256414123456");
});

test("numbers that are not Ugandan are rejected", () => {
  assert.equal(normalizeUgandaPhone(""), null);
  assert.equal(normalizeUgandaPhone("12345"), null);
  assert.equal(normalizeUgandaPhone("0812 123456"), null);
  assert.equal(normalizeUgandaPhone("+254712345678"), null);
});

test("WhatsApp links use digits only", () => {
  assert.equal(whatsappNumber("+256772123456"), "256772123456");
});

test("an extension adds its period to the expiry, or starts from now if already expired", () => {
  const now = 1_000 * DAY_MS;
  // Still live with 5 days left: a 14-day extension is added on top.
  assert.equal(extendedExpiry(now + 5 * DAY_MS, now, 14), now + 19 * DAY_MS);
  // Expired 10 days ago: the new period starts now.
  assert.equal(extendedExpiry(now - 10 * DAY_MS, now, 30), now + 30 * DAY_MS);
});

test("free ads are counted per account; after the quota, ads cost the paid price and run the paid period", () => {
  const settings = { ...DEFAULT_SETTINGS, freeAdsPerAccount: 2, freeAdDays: 30, paidAdDays: 60, paidAdCostFarmcoin: 15 };
  assert.deepEqual(nextAdTerms(settings, 0), { free: true, freeAdsLeft: 2, cost: 0, days: 30 });
  assert.deepEqual(nextAdTerms(settings, 1), { free: true, freeAdsLeft: 1, cost: 0, days: 30 });
  assert.deepEqual(nextAdTerms(settings, 2), { free: false, freeAdsLeft: 0, cost: 15, days: 60 });
  // Lowering the quota below what was used never goes negative.
  assert.deepEqual(nextAdTerms({ ...settings, freeAdsPerAccount: 1 }, 2), { free: false, freeAdsLeft: 0, cost: 15, days: 60 });
  // A quota of 0 makes every ad a paid ad.
  assert.equal(nextAdTerms({ ...settings, freeAdsPerAccount: 0 }, 0).free, false);
});

test("settings not saved yet fall back to the defaults", () => {
  assert.deepEqual(withDefaults(null), DEFAULT_SETTINGS);
  const partial = withDefaults({ extensionCostFarmcoin: 7 });
  assert.equal(partial.extensionCostFarmcoin, 7);
  assert.equal(partial.freeAdDays, DEFAULT_SETTINGS.freeAdDays);
});

test("settings must be whole numbers within their limits", () => {
  assert.equal(validateSettings(DEFAULT_SETTINGS), null);
  assert.match(validateSettings({ ...DEFAULT_SETTINGS, freeAdDays: 0 })!, /Free ad period/);
  assert.match(validateSettings({ ...DEFAULT_SETTINGS, paidAdCostFarmcoin: 2.5 })!, /Paid ad cost/);
  assert.match(validateSettings({ ...DEFAULT_SETTINGS, maxPhotosPerAd: 11 })!, /photos/);
  assert.equal(validateSettings({ ...DEFAULT_SETTINGS, freeAdsPerAccount: 0 }), null);
});

test("only active ads before their expiry are live", () => {
  const now = 500 * DAY_MS;
  assert.equal(isLive({ status: "active", expiresAt: now + 1 }, now), true);
  assert.equal(isLive({ status: "active", expiresAt: now }, now), false);
  assert.equal(isLive({ status: "sold", expiresAt: now + DAY_MS }, now), false);
  assert.equal(daysLeft(now + 30 * DAY_MS + 45_000, now), 30);
  assert.equal(daysLeft(now + 2 * 60 * 60 * 1000, now), 1);
  assert.equal(daysLeft(now - DAY_MS, now), 0);
});

test("wallets: traders and transporters pay from the trader account, buyers from buyer_reward, others from farmer", () => {
  assert.deepEqual(walletForRole("trader"), { accountType: "trader", key: "traderId" });
  assert.deepEqual(walletForRole("transporter"), { accountType: "trader", key: "traderId" });
  assert.deepEqual(walletForRole("buyer"), { accountType: "buyer_reward", key: "userId" });
  assert.deepEqual(walletForRole("farmer"), { accountType: "farmer", key: "userId" });
  assert.deepEqual(walletForRole("store"), { accountType: "farmer", key: "userId" });
  assert.equal(walletForRole("admin"), null);
});

const base: AdInput = {
  kind: "offer",
  title: "Dry maize, 2 tonnes",
  description: "",
  priceUGX: 900,
  priceUnit: "per kg",
  negotiable: false,
  district: "Mbale",
  contactPhone: "0772123456",
  photoCount: 1,
};

test("a complete ad is valid", () => {
  assert.equal(validateAd(base, 5), null);
});

test("an offer needs a price or to be negotiable; a wanted ad does not", () => {
  assert.match(validateAd({ ...base, priceUGX: undefined }, 5)!, /price/i);
  assert.equal(validateAd({ ...base, priceUGX: undefined, negotiable: true }, 5), null);
  assert.equal(validateAd({ ...base, kind: "wanted", priceUGX: undefined }, 5), null);
});

test("only wanted ads carry a needed-by date", () => {
  assert.equal(validateAd({ ...base, kind: "wanted", neededBy: "2026-10-15" }, 5), null);
  assert.match(validateAd({ ...base, neededBy: "2026-10-15" }, 5)!, /Wanted/);
  assert.match(validateAd({ ...base, kind: "wanted", neededBy: "15/10/2026" }, 5)!, /date/);
});

test("ads are checked for title, district, phone and photo count", () => {
  assert.match(validateAd({ ...base, title: "ab" }, 5)!, /title/);
  assert.match(validateAd({ ...base, district: " " }, 5)!, /district/);
  assert.match(validateAd({ ...base, contactPhone: "123" }, 5)!, /phone/);
  assert.match(validateAd({ ...base, photoCount: 4 }, 3)!, /photos/);
});

test("starter data is Goods (Crops, Animals) and Services (Extension, Equipment sales, Rental)", () => {
  assert.deepEqual(
    STARTER_GROUPS.map((g) => [g.name, g.categories.map((c) => c.name)]),
    [
      ["Goods", ["Crops", "Animals"]],
      ["Services", ["Extension services", "Equipment sales", "Rental services"]],
    ]
  );
});
