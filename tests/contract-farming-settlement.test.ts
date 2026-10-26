import assert from "node:assert/strict";
import test from "node:test";

import { milestoneRelease } from "../convex/advancePurchase";

const order = { totalAmount: 100_000, releasedAmount: 0, earnedAmount: 0 };

test("at completion: approvals before the last are earned, not paid", () => {
  const first = milestoneRelease({ ...order, settlementRule: "at_completion" }, 30, false);
  assert.deepEqual(first, { stageAmount: 30_000, earned: 30_000, releaseAmount: 0, atCompletion: true });
  const second = milestoneRelease({ ...order, earnedAmount: 30_000, settlementRule: "at_completion" }, 30, false);
  assert.equal(second.earned, 60_000);
  assert.equal(second.releaseAmount, 0);
});

test("at completion: the last approval pays everything not yet paid", () => {
  const last = milestoneRelease({ ...order, earnedAmount: 60_000, settlementRule: "at_completion" }, 40, true);
  assert.equal(last.releaseAmount, 100_000);
  assert.equal(last.earned, 100_000);
});

test("an order already part-paid per milestone keeps that money; the rest comes at the end", () => {
  // Funded before the switch: no rule stored, 30% already released.
  const legacy = { totalAmount: 100_000, releasedAmount: 30_000 };
  assert.equal(milestoneRelease(legacy, 30, false).releaseAmount, 0);
  assert.equal(milestoneRelease({ ...legacy, earnedAmount: 60_000 }, 40, true).releaseAmount, 70_000);
});

test("per milestone: each approval pays its share, as before", () => {
  const stage = milestoneRelease({ ...order, settlementRule: "per_milestone" }, 30, false);
  assert.equal(stage.releaseAmount, 30_000);
  assert.equal(stage.atCompletion, false);
  const last = milestoneRelease({ totalAmount: 100_000, releasedAmount: 60_000, earnedAmount: 60_000, settlementRule: "per_milestone" }, 40, true);
  assert.equal(last.releaseAmount, 40_000);
});
