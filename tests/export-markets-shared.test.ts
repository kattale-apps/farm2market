import assert from "node:assert/strict";
import test from "node:test";

import {
  COUNTRIES,
  DEFAULT_EXPORT_DOCUMENT_TYPES,
  addDaysToIsoDate,
  countryName,
  daysBetweenIsoDates,
  expiryState,
  isIsoDate,
  ugandaDateFromInstant,
  ugandaDateFromStored,
} from "../convex/exportMarketsShared";

test("Uganda date rolls over at Uganda midnight, not UTC midnight", () => {
  // 2026-09-26 21:30 UTC is 00:30 on the 27th in Kampala.
  const instant = Date.UTC(2026, 8, 26, 21, 30);
  assert.equal(ugandaDateFromInstant(instant), "2026-09-27");
  // 20:59 UTC is still the 26th in Kampala.
  assert.equal(ugandaDateFromInstant(Date.UTC(2026, 8, 26, 20, 59)), "2026-09-26");
  // A getUgandaTime() value is already shifted by 3 hours.
  assert.equal(ugandaDateFromStored(instant + 3 * 3600 * 1000), "2026-09-27");
});

test("isIsoDate accepts real calendar dates only", () => {
  assert.equal(isIsoDate("2026-02-28"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("26-02-2026"), false);
  assert.equal(isIsoDate(""), false);
  assert.equal(isIsoDate(undefined), false);
});

test("date arithmetic crosses months and years", () => {
  assert.equal(addDaysToIsoDate("2026-12-20", 365), "2027-12-20");
  assert.equal(addDaysToIsoDate("2026-01-31", 1), "2026-02-01");
  assert.equal(daysBetweenIsoDates("2026-09-26", "2026-10-26"), 30);
  assert.equal(daysBetweenIsoDates("2026-09-26", "2026-09-25"), -1);
});

test("expiry states: valid through the expiry date, warning 30 days before", () => {
  const today = "2026-09-26";
  assert.equal(expiryState(undefined, today), "no_expiry");
  assert.equal(expiryState("2026-12-31", today), "valid");
  assert.equal(expiryState("2026-10-26", today), "expiring"); // exactly 30 days
  assert.equal(expiryState("2026-10-27", today), "valid"); // 31 days
  assert.equal(expiryState("2026-09-26", today), "expiring"); // last valid day
  assert.equal(expiryState("2026-09-25", today), "expired");
});

test("country list covers the world and resolves names", () => {
  assert.ok(COUNTRIES.length >= 240);
  const codes = new Set(COUNTRIES.map((c) => c.code));
  assert.equal(codes.size, COUNTRIES.length, "country codes are unique");
  assert.equal(countryName("ug"), "Uganda");
  assert.equal(countryName("DE"), "Germany");
  assert.equal(countryName("XX"), undefined);
});

test("default document types have unique keys and cover both audiences", () => {
  const keys = DEFAULT_EXPORT_DOCUMENT_TYPES.map((d) => d.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(DEFAULT_EXPORT_DOCUMENT_TYPES.some((d) => d.appliesTo === "exporter" && d.required && d.hasExpiry));
  assert.ok(DEFAULT_EXPORT_DOCUMENT_TYPES.some((d) => d.appliesTo === "buyer" && d.required));
});
