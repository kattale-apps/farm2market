import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_OFFER_DAYS, MAX_BOOKING_DAYS_AHEAD, OFFER_DAY_CHOICES, OFFER_VALID_DAYS, VENDOR_CROPS, districtKey, latestBookingDate, offerDaysLeft, priceRange } from "../convex/marketOffersShared";

test("a price stays up 1, 3 or 7 days (3 by default) and bookings go at most 5 days ahead", () => {
  assert.deepEqual(OFFER_DAY_CHOICES, [1, 3, 7]);
  assert.ok(OFFER_DAY_CHOICES.includes(DEFAULT_OFFER_DAYS));
  assert.equal(Math.max(...OFFER_DAY_CHOICES), OFFER_VALID_DAYS);
  assert.equal(MAX_BOOKING_DAYS_AHEAD, 5);
});

test("a price counts down its days and ends by itself", () => {
  // Posted for 3 days on the 26th: up until the 28th
  assert.equal(offerDaysLeft("2026-10-26", "2026-10-28"), 3);
  assert.equal(offerDaysLeft("2026-10-28", "2026-10-28"), 1, "its last day");
  assert.equal(offerDaysLeft("2026-10-29", "2026-10-28"), 0, "ended");
  // Across a month end
  assert.equal(offerDaysLeft("2026-10-31", "2026-11-02"), 3);
});

test("the latest booking date is 5 days ahead, or earlier when the price expires first", () => {
  // Price posted today, valid 7 days: bookings stop 5 days ahead.
  assert.equal(latestBookingDate("2026-09-27", "2026-10-03"), "2026-10-02");
  // Price expiring in 2 days: bookings stop when it expires.
  assert.equal(latestBookingDate("2026-09-27", "2026-09-29"), "2026-09-29");
  // Across a month end.
  assert.equal(latestBookingDate("2026-09-29", "2026-10-30"), "2026-10-04");
});

test("district names match regardless of case, spacing or a trailing 'District'", () => {
  assert.equal(districtKey("  Masaka  District "), "masaka");
  assert.equal(districtKey("MASAKA"), districtKey("masaka"));
  assert.equal(districtKey(undefined), "");
});

test("vendor crops have unique keys and at least one unit", () => {
  const keys = VENDOR_CROPS.map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(VENDOR_CROPS.every((c) => c.units.length > 0));
});

test("price range is the lowest and highest price", () => {
  assert.deepEqual(priceRange([7000, 6500, 7200]), { min: 6500, max: 7200 });
  assert.equal(priceRange([]), null);
});
