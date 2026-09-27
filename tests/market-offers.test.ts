import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_BOOKING_DAYS_AHEAD, OFFER_VALID_DAYS, VENDOR_CROPS, districtKey, latestBookingDate, priceRange } from "../convex/marketOffersShared";

test("a price is valid for a week and bookings go at most 5 days ahead", () => {
  assert.equal(OFFER_VALID_DAYS, 7);
  assert.equal(MAX_BOOKING_DAYS_AHEAD, 5);
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
