import assert from "node:assert/strict";
import test from "node:test";

import { BULK_RANGES, bulkRangeProblem, isLiteFor, priceBand, quantityBand, shapeCard, vendDayChoices, withDefaults } from "../convex/marketspaceShared";
import { maskContactDetails } from "../convex/exportMarketsShared";
import { LOT_SELLER_ROLES, bulkSellingDecision, defaultSteps, stockRowSource, stockSourceProblem } from "../convex/lotOrdersShared";

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

const lotCard = {
  _id: "card1",
  view: "produce" as const,
  kind: "offer" as const,
  title: "Maize",
  isBulk: true,
  bulkRange: "100kg_1t",
  sellerRole: "farmer",
  district: "Mbale",
  stockSource: "own_farm" as const,
  lotKg: 100,
  bagKg: 50,
  bagsPerLot: 2,
  lotsAvailable: 3,
  qtyKg: 300,
  pricePerKilo: 1200,
  commitPercent: 30,
  qualityRating: "Premium",
  expiresAt: 2,
  createdAt: 1,
};
const extras = { thumbUrl: "https://x/photo.jpg", sellerAlias: "Farmer F-12", sellerCategory: "Farmer" };

test("who gets a lite card", () => {
  assert.equal(isLiteFor("produce", "public"), true);
  assert.equal(isLiteFor("classifieds", "public"), true);
  assert.equal(isLiteFor("produce", "member"), true);
  assert.equal(isLiteFor("lots", "member"), true);
  assert.equal(isLiteFor("classifieds", "member"), false);
  assert.equal(isLiteFor("produce", "verified"), false);
  assert.equal(isLiteFor("produce", "public", true), false, "a seller sees their own card in full");
});

test("lite cards carry bands but never the exact price, alias or lot details", () => {
  const lite = shapeCard(lotCard, { tier: "public", isMine: false }, extras);
  assert.equal(lite.lite, true);
  assert.match(lite.liteReason ?? "", /Sign up as a buyer/);
  for (const hidden of ["sellerAlias", "pricePerKilo", "lotKg", "lotsAvailable", "qtyKg", "commitPercent", "qualityRating"] as const) {
    assert.equal(lite[hidden], null, `${hidden} is hidden`);
  }
  assert.equal(lite.priceBand, "UGX 1,000 – 1,500 /kg");
  assert.equal(lite.quantityBand, "100 kg – 1 tonne");
  assert.equal(lite.sellerCategory, "Farmer");
  assert.equal(lite.bulkLabel, "100 kg – 1 tonne");
  assert.equal(JSON.stringify(lite).includes("1200"), false, "the exact price is nowhere in a lite card");

  const member = shapeCard(lotCard, { tier: "member", isMine: false }, extras);
  assert.match(member.liteReason ?? "", /Get verified/);

  const full = shapeCard(lotCard, { tier: "verified", isMine: false }, extras);
  assert.equal(full.lite, false);
  assert.equal(full.pricePerKilo, 1200);
  assert.equal(full.sellerAlias, "Farmer F-12");
  assert.equal(full.lotsAvailable, 3);
});

test("cards and posts carry no contact details", () => {
  assert.equal("contactPhone" in shapeCard(lotCard, { tier: "verified", isMine: false }, extras), false);
  // Normal produce wording passes the contact check
  for (const ok of ["2 bags of 50 kg, 1,000 kg total", "Harvested 2026-10-01, moisture 13%", "Grade A coffee, 19,200 kg"]) {
    assert.equal(maskContactDetails(ok).masked, false, ok);
  }
  // Contact details do not
  for (const bad of ["call 0772 123 456", "WhatsApp +256772123456", "see www.mymaize.com", "email me at a@b.co.ug"]) {
    assert.equal(maskContactDetails(bad).masked, true, bad);
  }
});

test("stock bought in the app and off-app stock never mix", () => {
  const inApp = { source: "in_app" as const, produceType: "Maize" };
  const offApp = { source: "off_app" as const, produceType: "Maize" };
  const base = { produceType: "Maize", listingMode: "unit" };
  for (const sellerRole of ["vendor", "store", "trader"]) {
    // In-app listings must be stock bought in the app
    assert.equal(stockSourceProblem({ ...base, sellerRole, claimed: "in_app", stock: inApp }), null, `${sellerRole} in-app`);
    assert.match(stockSourceProblem({ ...base, sellerRole, claimed: "in_app", stock: null }) ?? "", /Choose stock you bought in the app/);
    assert.match(stockSourceProblem({ ...base, sellerRole, claimed: "in_app", stock: offApp }) ?? "", /Choose stock you bought in the app/);
    // Off-app listings: new stock, or stock declared off-app, never stock bought in the app
    assert.equal(stockSourceProblem({ ...base, sellerRole, claimed: "off_app", stock: null }), null);
    assert.equal(stockSourceProblem({ ...base, sellerRole, claimed: "off_app", stock: offApp }), null);
    assert.match(stockSourceProblem({ ...base, sellerRole, claimed: "off_app", stock: inApp }) ?? "", /bought in the app/);
  }
  // The stock's crop and selling in lots cannot be changed
  assert.match(stockSourceProblem({ sellerRole: "vendor", claimed: "in_app", stock: inApp, produceType: "Coffee", listingMode: "unit" }) ?? "", /list it as Maize/);
  assert.equal(stockSourceProblem({ sellerRole: "vendor", claimed: "in_app", stock: inApp, produceType: " maize ", listingMode: "unit" }), null);
  assert.match(stockSourceProblem({ sellerRole: "vendor", claimed: "in_app", stock: inApp, produceType: "Maize", listingMode: "packaging" }) ?? "", /bags and lots/);
  // Farmers sell their own farm's produce
  assert.equal(stockSourceProblem({ ...base, sellerRole: "farmer", stock: null }), null);
  assert.match(stockSourceProblem({ ...base, sellerRole: "farmer", stock: inApp }) ?? "", /own farm/);
  // Stock rows: lot orders are in-app; declared stock is off-app; old rows read their source lots
  assert.equal(stockRowSource({ source: "in_app", listingUnitIds: [] }), "in_app");
  assert.equal(stockRowSource({ source: "off_app", listingUnitIds: ["u1"] }), "off_app");
  assert.equal(stockRowSource({ listingUnitIds: ["u1"] }), "in_app");
  assert.equal(stockRowSource({ listingUnitIds: [] }), "off_app");
});
