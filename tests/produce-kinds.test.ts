import assert from "node:assert/strict";
import test from "node:test";

import { ANIMAL_OPTIONS, ANIMAL_UNIT, isAnimalOption } from "../convex/produceKinds";
import { packagedPlan, packagesText } from "../convex/lotOrdersShared";

test("the animal choices carry their own icons: cows are cattle 🐮, a pig is 🐷", () => {
  const icon = (value: string) => ANIMAL_OPTIONS.find((a) => a.value === value)?.icon;
  assert.equal(icon("Cattle"), "🐮");
  assert.equal(icon("Pig"), "🐷");
  assert.equal(icon("Goat"), "🐐");
  assert.equal(new Set(ANIMAL_OPTIONS.map((a) => a.icon)).size, ANIMAL_OPTIONS.length, "every animal has its own icon");
});

test("admin produce options in an animal category show under Animal, the rest under Crop", () => {
  for (const category of ["Livestock", "Animals", "Poultry", "Fish & Aquaculture"]) assert.equal(isAnimalOption({ category }), true, category);
  for (const category of ["Grains & Cereals", "Legumes", "Vegetables", undefined]) assert.equal(isAnimalOption({ category }), false, String(category));
});

test("an animal sold per animal is counted in heads", () => {
  assert.equal(packagesText(1, ANIMAL_UNIT), "1 head");
  assert.equal(packagesText(3, ANIMAL_UNIT), "3 heads");
});

test("an animal a farmer sells per animal is collected at the farm gate, a vendor's items at the shop", () => {
  assert.equal(packagedPlan("farmer")[0].name, "Collect from farm gate");
  assert.equal(packagedPlan("vendor")[0].name, "Collect from my shop");
  assert.equal(packagedPlan()[0].name, "Collect from my shop");
  assert.equal(packagedPlan("farmer")[0].handover, true);
});
