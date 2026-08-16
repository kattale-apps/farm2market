import assert from "node:assert/strict";
import test from "node:test";

function add(a: number, b: number): number {
  return a + b;
}

test("adds numbers correctly", () => {
  assert.equal(add(2, 3), 5);
  assert.equal(add(-1, 1), 0);
});

test("supports decimal numbers", () => {
  assert.equal(add(1.5, 2.25), 3.75);
});
