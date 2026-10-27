import assert from "node:assert/strict";
import test from "node:test";

import { SECTION_LABELS, lotSections, pastLotOutcome } from "../convex/marketspaceShared";

test("a farmer's lot shows in Farmers Produce, at the Farm Gate while it is not on MarketSpace", () => {
  assert.deepEqual(lotSections("farmer", { bulk: false, farmGate: false }), [SECTION_LABELS.produce]);
  assert.deepEqual(lotSections("farmer", { bulk: true, farmGate: false }), [SECTION_LABELS.produce, SECTION_LABELS.bulk]);
  assert.deepEqual(lotSections("farmer", { bulk: true, farmGate: true }), [SECTION_LABELS.farmgate]);
});

test("vendors', processors' and exporters' lots show in Vendors and Processors, and Local Bulk when sold in bulk", () => {
  for (const role of ["vendor", "store", "trader"]) {
    assert.deepEqual(lotSections(role, { bulk: false, farmGate: false }), [SECTION_LABELS.lots]);
    assert.deepEqual(lotSections(role, { bulk: true, farmGate: true }), [SECTION_LABELS.lots, SECTION_LABELS.bulk], "the farm gate is for farmers only");
  }
});

test("a past lot post says why it ended", () => {
  const now = 10_000;
  const closed = { status: "closed", expiresAt: 20_000 };
  const vended = { status: "active", vendExpiresAt: 20_000 };
  assert.equal(pastLotOutcome(closed, { ...vended, status: "fully_locked" }, now), "sold");
  assert.equal(pastLotOutcome(closed, { ...vended, status: "delivered" }, now), "sold");
  assert.equal(pastLotOutcome(closed, { ...vended, status: "cancelled" }, now), "withdrawn");
  assert.equal(pastLotOutcome(closed, { ...vended, withdrawnAt: 5_000 }, now), "withdrawn");
  assert.equal(pastLotOutcome(closed, null, now), "withdrawn", "a deleted listing");
  assert.equal(pastLotOutcome(closed, { status: "active" }, now), "taken_off");
  assert.equal(pastLotOutcome({ status: "active", expiresAt: 9_000 }, { status: "active", vendExpiresAt: 9_000 }, now), "time_ran_out");
  assert.equal(pastLotOutcome(closed, { ...vended, status: "partially_locked" }, now), "all_ordered");
});
