import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AD_PERIOD_MS,
  DAY_MS,
  MAX_PHOTOS,
  STARTER_GROUPS,
  daysLeft,
  extendedExpiry,
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

test("an ad runs 30 days, and extending adds 30 days from its expiry or from now if expired", () => {
  assert.equal(AD_PERIOD_MS, 30 * DAY_MS);
  const now = 1_000 * DAY_MS;
  // Still live with 5 days left: the new period is added on top.
  assert.equal(extendedExpiry(now + 5 * DAY_MS, now), now + 35 * DAY_MS);
  // Expired 10 days ago: the new period starts now.
  assert.equal(extendedExpiry(now - 10 * DAY_MS, now), now + 30 * DAY_MS);
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
  assert.equal(validateAd(base), null);
});

test("an offer needs a price or to be negotiable; a wanted ad does not", () => {
  assert.match(validateAd({ ...base, priceUGX: undefined })!, /price/i);
  assert.equal(validateAd({ ...base, priceUGX: undefined, negotiable: true }), null);
  assert.equal(validateAd({ ...base, kind: "wanted", priceUGX: undefined }), null);
});

test("only wanted ads carry a needed-by date", () => {
  assert.equal(validateAd({ ...base, kind: "wanted", neededBy: "2026-10-15" }), null);
  assert.match(validateAd({ ...base, neededBy: "2026-10-15" })!, /Wanted/);
  assert.match(validateAd({ ...base, kind: "wanted", neededBy: "15/10/2026" })!, /date/);
});

test("ads are checked for title, district, phone and photo count", () => {
  assert.match(validateAd({ ...base, title: "ab" })!, /title/);
  assert.match(validateAd({ ...base, district: " " })!, /district/);
  assert.match(validateAd({ ...base, contactPhone: "123" })!, /phone/);
  assert.match(validateAd({ ...base, photoCount: MAX_PHOTOS + 1 })!, /photos/);
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
