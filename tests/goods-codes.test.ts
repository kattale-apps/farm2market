import assert from "node:assert/strict";
import test from "node:test";

import { goodKeyOf, newGoodsCodeText } from "../convex/goodsCodesCore";
import { batchGoodLabel } from "../convex/processorShared";
import { exportLotGoodLabel } from "../convex/exportMarketsShared";

test("the same good is the same whatever the case or spacing, so its QR can be reused", () => {
  assert.equal(goodKeyOf("Maize"), goodKeyOf("  maize "));
  assert.equal(goodKeyOf("Sweet   Potatoes"), "sweet potatoes");
  assert.notEqual(goodKeyOf("Maize"), goodKeyOf("Maize flour"));
});

test("goods codes read easily off a label: F2M- and six letters or digits, no 0/O or 1/I", () => {
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 500; i++) {
    const code = newGoodsCodeText(random);
    assert.match(code, /^F2M-[A-HJ-NP-Z2-9]{6}$/);
  }
  assert.equal(newGoodsCodeText(() => 0), "F2M-AAAAAA");
  assert.equal(newGoodsCodeText(() => 0.9999), "F2M-999999");
});

test("batches and export lots name their good the same way every time", () => {
  assert.equal(batchGoodLabel("coffee", "faq"), "Coffee FAQ");
  assert.equal(batchGoodLabel("coffee", "green"), "Coffee Graded green beans");
  assert.equal(exportLotGoodLabel({ coffeeType: "Robusta", grade: "Screen 18" }), "Coffee Robusta Screen 18");
  assert.equal(exportLotGoodLabel({ crop: "coffee", coffeeType: "Arabica", grade: "Bugisu AA" }), "Coffee Arabica Bugisu AA");
});
