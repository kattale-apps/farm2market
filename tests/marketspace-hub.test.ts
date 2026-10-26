import assert from "node:assert/strict";
import test from "node:test";

import { BULK_RANGES, bulkRangeProblem, priceBand, quantityBand, vendDayChoices, withDefaults } from "../convex/marketspaceShared";
import { LOT_SELLER_ROLES, bulkSellingDecision, defaultSteps } from "../convex/lotOrdersShared";

test("exporters sell lots like farmers, vendors and processors", () => {
  assert.deepEqual([...LOT_SELLER_ROLES], ["farmer", "vendor", "store", "trader"]);
  // An exporter's warehouse uses the store-style steps
  assert.equal(defaultSteps("trader").at(-1)?.name, "Collect from my store");
});

test("selling in bulk is for verified sellers", () => {
  for (const role of ["farmer", "vendor", "store", "trader"]) {
    assert.equal(bulkSellingDecision({ role, verificationStatus: "verified" }, false).ok, true, `${role} verified`);
    assert.equal(bulkSellingDecision({ role }, false).ok, false, `${role} not verified`);
  }
  assert.equal(bulkSellingDecision({ role: "trader", isVerifiedTrader: true }, false).ok, true);
  assert.equal(bulkSellingDecision({ role: "store" }, true).ok, true, "an approved processor facility counts");
  assert.equal(bulkSellingDecision({ role: "vendor" }, true).ok, false);
  assert.match(bulkSellingDecision({ role: "buyer", verificationStatus: "verified" }, false).reason ?? "", /Only farmers, vendors/);
});

test("the kilos for sale must fall in the chosen bulk range", () => {
  assert.equal(bulkRangeProblem("100kg_1t", 300), null);
  assert.equal(bulkRangeProblem("1t_5t", 1000), null);
  assert.equal(bulkRangeProblem("over_20t", 50_000), null);
  assert.match(bulkRangeProblem("1t_5t", 300) ?? "", /300 kg for sale/);
  assert.match(bulkRangeProblem("100kg_1t", 99) ?? "", /not in/);
  assert.match(bulkRangeProblem("nope", 500) ?? "", /Choose one of the bulk ranges/);
  assert.equal(BULK_RANGES.length, 4);
});

test("vend periods stop at the super admin's maximum", () => {
  assert.deepEqual(vendDayChoices(30), [7, 14, 30]);
  assert.deepEqual(vendDayChoices(7), [7]);
  assert.deepEqual(vendDayChoices(90), [7, 14, 30, 60, 90]);
  assert.equal(withDefaults(null).maxVendDays, 30);
  assert.equal(withDefaults(null).bulkVendCostFarmcoin, 0);
});

test("lite cards show bands, not exact prices or quantities", () => {
  assert.equal(priceBand(1200), "UGX 1,000 – 1,500 /kg");
  assert.equal(priceBand(7300), "UGX 7,000 – 8,000 /kg");
  assert.equal(priceBand(12_000), "UGX 10,000 – 15,000 /kg");
  assert.equal(priceBand(0), null);
  assert.equal(quantityBand(60), "under 100 kg");
  assert.equal(quantityBand(300), "100 kg – 1 tonne");
  assert.equal(quantityBand(2500), "1 – 5 tonnes");
  assert.equal(quantityBand(25_000), "Over 20 tonnes");
});
