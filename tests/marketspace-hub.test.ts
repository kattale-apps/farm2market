import assert from "node:assert/strict";
import test from "node:test";

import { BULK_RANGES, bulkRangeProblem, isLiteFor, listingCardStatus, priceBand, purchaseHelp, quantityBand, shapeCard, vendDayChoices, withDefaults } from "../convex/marketspaceShared";
import { maskContactDetails } from "../convex/exportMarketsShared";
import { LOT_SELLER_ROLES, PACKAGED_COMMIT_PERCENT, bulkSellingDecision, defaultPlan, defaultSteps, isPackagedPlan, packageLabel, packagedPlan, packagedUnitPrice, packagesText, stockRowSource, stockSourceProblem, validatePlan } from "../convex/lotOrdersShared";

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
  const produce = { view: "produce" as const, isBulk: false, status: "active" };
  const lots = { view: "lots" as const, isBulk: false, status: "active" };
  const ads = { view: "classifieds" as const, isBulk: false };
  const bulk = { ...produce, isBulk: true };
  const farmGate = { ...produce, status: "farm_gate" };
  const as = (tier: "public" | "member" | "verified", role: string | null, isMine = false) => ({ tier, role, isMine });
  assert.equal(isLiteFor(produce, as("public", null)), true);
  assert.equal(isLiteFor(ads, as("public", null)), true);
  assert.equal(isLiteFor(ads, as("member", "farmer")), false, "members see classified ads in full");
  assert.equal(isLiteFor(produce, as("verified", "buyer")), false);
  assert.equal(isLiteFor(bulk, as("verified", "vendor")), false);
  assert.equal(isLiteFor(produce, as("public", null, true)), false, "a seller sees their own card in full");
  // Purchasers not verified yet: lots on MarketSpace that are not bulk in full, bulk and farm-gate lots lite
  for (const role of ["buyer", "vendor", "store", "trader"]) {
    assert.equal(isLiteFor(produce, as("member", role)), false, role);
    assert.equal(isLiteFor(lots, as("member", role)), false, role);
    assert.equal(isLiteFor(bulk, as("member", role)), true, role);
    assert.equal(isLiteFor(farmGate, as("member", role)), true, role);
  }
  // Members who do not buy lots keep the preview
  assert.equal(isLiteFor(produce, as("member", "farmer")), true);
  assert.equal(isLiteFor(lots, as("member", "transporter")), true);
});

test("lite cards carry bands but never the exact price, alias or lot details", () => {
  const lite = shapeCard(lotCard, { tier: "public", role: null, isMine: false }, extras);
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

  const member = shapeCard(lotCard, { tier: "member", role: "buyer", isMine: false }, extras);
  assert.match(member.liteReason ?? "", /Bulk lots are for verified purchasers/, "a buyer not verified yet: only bulk lots are lite");
  assert.match(shapeCard(lotCard, { tier: "member", role: "farmer", isMine: false }, extras).liteReason ?? "", /Get verified/);
  const open = shapeCard({ ...lotCard, isBulk: false }, { tier: "member", role: "buyer", isMine: false }, extras);
  assert.equal(open.lite, false, "a buyer not verified yet sees a lot that is not bulk in full");
  assert.equal(open.pricePerKilo, 1200);

  const full = shapeCard(lotCard, { tier: "verified", role: "buyer", isMine: false }, extras);
  assert.equal(full.lite, false);
  assert.equal(full.pricePerKilo, 1200);
  assert.equal(full.sellerAlias, "Farmer F-12");
  assert.equal(full.lotsAvailable, 3);
});

test("cards and posts carry no contact details", () => {
  assert.equal("contactPhone" in shapeCard(lotCard, { tier: "verified", role: "buyer", isMine: false }, extras), false);
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

test("packaged items: no payment steps by default, paid in full and then collected", () => {
  const plan = packagedPlan();
  assert.equal(PACKAGED_COMMIT_PERCENT, 100);
  assert.deepEqual(validatePlan(plan, PACKAGED_COMMIT_PERCENT), plan, "a valid plan");
  assert.equal(plan.length, 1);
  assert.equal(plan[0].handover, true);
  assert.equal(isPackagedPlan(plan, 100), true);
  // Steps switched on: the usual plan
  assert.equal(isPackagedPlan(defaultPlan("vendor", 30), 30), false);
});

test("packaged items are priced per item, or per batch of items", () => {
  assert.equal(packagedUnitPrice(25000, 1), 25000, "a single item");
  assert.equal(packagedUnitPrice(25000, 20), 500000, "a batch of 20");
  assert.equal(packagedUnitPrice(25000, 0), 25000, "a batch is at least one item");
});

test("packaged items read plainly", () => {
  assert.equal(packageLabel({ packagingTypeEnum: "crate" }), "crate");
  assert.equal(packageLabel({ packagingTypeCustom: "Tray", packagingTypeEnum: "crate" }), "Tray");
  assert.equal(packageLabel({}), "item");
  assert.equal(packagesText(1, "crate"), "1 crate");
  assert.equal(packagesText(3, "crate"), "3 crates");
  assert.equal(packagesText(2, "bunch"), "2 bunches");
  assert.equal(packagesText(4, "box"), "4 boxes");
  assert.equal(packagesText(2, "Tin / Debe"), "2 × Tin / Debe");
});

test("only a vendor whose business documents were approved shows Verified Vendor", () => {
  const vendorCard = { ...lotCard, view: "lots" as const, sellerRole: "vendor" };
  assert.equal(shapeCard({ ...vendorCard, sellerCommercial: "verified" }, { tier: "public", role: null, isMine: false }, extras).verifiedVendor, true);
  assert.equal(shapeCard({ ...vendorCard, sellerCommercial: "pending" }, { tier: "public", role: null, isMine: false }, extras).verifiedVendor, false);
  assert.equal(shapeCard(vendorCard, { tier: "public", role: null, isMine: false }, extras).verifiedVendor, false);
  const farmer = shapeCard({ ...lotCard, sellerCommercial: "verified" }, { tier: "public", role: null, isMine: false }, extras);
  assert.equal(farmer.verifiedVendor, false, "a farmer gets the Commercial Farmer badge instead");
  assert.equal(farmer.commercialFarmer, true);
});

test("Purchase now tells an unverified member what to do next", () => {
  const vendor = purchaseHelp("vendor");
  assert.equal(vendor.ledger, true, "vendors get verified with their business profile in My Ledger");
  assert.match(vendor.text, /business profile/);
  for (const role of ["trader", "store", "buyer"]) {
    const help = purchaseHelp(role);
    assert.equal(help.ledger, false);
    assert.match(help.text, /not verified your account yet. Lots that are not bulk you can buy now/, role);
  }
  for (const role of ["farmer", "transporter", null]) {
    assert.match(purchaseHelp(role).text, /Buying lots is for vendors, processors, exporters and business buyers/, String(role));
  }
});

test("an animal lot sold by weight says animals, a crop lot says bags", () => {
  assert.equal(shapeCard({ ...lotCard, produceKind: "animal" }, { tier: "verified", role: "buyer", isMine: false }, extras).animal, true);
  assert.equal(shapeCard(lotCard, { tier: "verified", role: "buyer", isMine: false }, extras).animal, false, "no kind stored: a crop");
});

test("a post stays up when it sells out, until the seller takes it off or its time ends", () => {
  const base = { open: true, lotsAvailable: 0, isFarmer: false, vended: true, vendedNow: true };
  assert.equal(listingCardStatus(base), "active", "sold out, still on MarketSpace: repeat sales");
  assert.equal(listingCardStatus({ ...base, lotsAvailable: 3 }), "active");
  assert.equal(listingCardStatus({ ...base, vended: false, vendedNow: false }), "closed", "taken off by the seller");
  assert.equal(listingCardStatus({ ...base, open: false }), "closed", "withdrawn by the seller");
  // Farmers: sold out on MarketSpace stays up; off MarketSpace it is a farm-gate card only while lots are for sale
  const farmer = { ...base, isFarmer: true };
  assert.equal(listingCardStatus(farmer), "active");
  assert.equal(listingCardStatus({ ...farmer, vendedNow: false, lotsAvailable: 2 }), "farm_gate");
  assert.equal(listingCardStatus({ ...farmer, vendedNow: false, lotsAvailable: 0 }), "closed");
  assert.equal(listingCardStatus({ ...farmer, vended: false, vendedNow: false, lotsAvailable: 2 }), "farm_gate");
});

test("a sold-out lot post says so to everyone; classified ads never do", () => {
  const viewer = { tier: "public" as const, role: null, isMine: false };
  assert.equal(shapeCard({ ...lotCard, lotsAvailable: 0 }, viewer, extras).soldOut, true);
  assert.equal(shapeCard(lotCard, viewer, extras).soldOut, false);
  assert.equal(shapeCard({ ...lotCard, view: "classifieds" as const, lotsAvailable: undefined }, viewer, extras).soldOut, false);
});
