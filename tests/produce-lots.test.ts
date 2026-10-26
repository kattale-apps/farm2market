import assert from "node:assert/strict";
import test from "node:test";

import { planLots } from "../convex/listings";
import { MAX_BAGS_PER_LOT, MAX_BAG_KG, MAX_LOTS_PER_LISTING } from "../convex/constants";

test("one big lot: 1 lot of 20 bags of 50 kg is 1,000 kg", () => {
  assert.deepEqual(planLots(50, 20, 1), { bagKg: 50, bagsPerLot: 20, lotCount: 1, lotKg: 1000, totalKilos: 1000 });
});

test("many small lots: 10 lots of 2 bags of 50 kg", () => {
  const plan = planLots(50, 2, 10);
  assert.equal(plan.lotKg, 100);
  assert.equal(plan.totalKilos, 1000);
});

test("the old 10 kg unit is one lot of one 10 kg bag", () => {
  const plan = planLots(10, 1, 5);
  assert.equal(plan.lotKg, 10);
  assert.equal(plan.totalKilos, 50);
});

test("odd bag sizes keep tidy kilos", () => {
  const plan = planLots(0.1, 3, 3);
  assert.equal(plan.lotKg, 0.3);
  assert.equal(plan.totalKilos, 0.9);
});

test("bag size must be positive and within the limit", () => {
  assert.throws(() => planLots(0, 1, 1), /Bag size/);
  assert.throws(() => planLots(-5, 1, 1), /Bag size/);
  assert.throws(() => planLots(Number.NaN, 1, 1), /Bag size/);
  assert.throws(() => planLots(MAX_BAG_KG + 1, 1, 1), /Bag size/);
  assert.doesNotThrow(() => planLots(MAX_BAG_KG, 1, 1));
});

test("bags in a lot and number of lots must be whole numbers in range", () => {
  assert.throws(() => planLots(50, 0, 1), /Bags in each lot/);
  assert.throws(() => planLots(50, 1.5, 1), /Bags in each lot/);
  assert.throws(() => planLots(50, MAX_BAGS_PER_LOT + 1, 1), /Bags in each lot/);
  assert.throws(() => planLots(50, 1, 0), /Number of lots/);
  assert.throws(() => planLots(50, 1, 2.5), /Number of lots/);
  assert.throws(() => planLots(50, 1, MAX_LOTS_PER_LISTING + 1), /Number of lots/);
  assert.doesNotThrow(() => planLots(50, MAX_BAGS_PER_LOT, MAX_LOTS_PER_LISTING));
});
