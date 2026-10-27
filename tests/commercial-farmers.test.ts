import assert from "node:assert/strict";
import test from "node:test";

import { commercialProfileProblem } from "../convex/commercialFarmersShared";
import { cardIsLive, produceVisible, seesFarmGate, type ViewerTier } from "../convex/marketspaceShared";

const viewer = (tier: ViewerTier, role: string | null, isMine = false) => ({ tier, role, isMine });
const farmer = (status: string, sellerCommercial?: "pending" | "verified") => ({ view: "produce" as const, status, sellerCommercial });

test("verified buyers (exporters, processors, vendors, business buyers) see every farmer lot, at the farm gate too", () => {
  for (const role of ["store", "trader", "vendor", "buyer"]) {
    const v = viewer("verified", role);
    assert.ok(seesFarmGate(v));
    assert.ok(produceVisible(farmer("farm_gate"), v), "no commercial profile, not on MarketSpace");
    assert.ok(produceVisible(farmer("active"), v), "a non-commercial farmer's vended lot");
    assert.ok(produceVisible(farmer("active", "pending"), v));
    assert.ok(produceVisible(farmer("active", "verified"), v));
    assert.ok(!seesFarmGate(viewer("member", role)), "an unverified buyer is like a visitor");
    assert.ok(!produceVisible(farmer("farm_gate"), viewer("member", role)));
  }
});

test("only buyers see the farm gate", () => {
  for (const role of ["farmer", "transporter", null]) {
    assert.ok(!seesFarmGate(viewer("verified", role)));
    assert.ok(!produceVisible(farmer("farm_gate"), viewer("verified", role)));
  }
});

test("visitors and unverified members see only verified commercial farmers' lots", () => {
  for (const v of [viewer("public", null), viewer("member", "buyer"), viewer("member", "vendor")]) {
    assert.ok(!produceVisible(farmer("active"), v));
    assert.ok(!produceVisible(farmer("active", "pending"), v));
    assert.ok(produceVisible(farmer("active", "verified"), v));
    assert.ok(!produceVisible(farmer("farm_gate", "verified"), v));
  }
});

test("a farmer always sees their own lots; other posts are not affected", () => {
  assert.ok(produceVisible(farmer("farm_gate"), viewer("member", "farmer", true)));
  assert.ok(produceVisible({ view: "lots", status: "active" }, viewer("public", null)));
  assert.ok(produceVisible({ view: "classifieds", status: "active" }, viewer("public", null)));
});

test("farm-gate cards stay live; MarketSpace cards end with their time", () => {
  assert.ok(cardIsLive({ status: "farm_gate", expiresAt: 0 }, 1000));
  assert.ok(cardIsLive({ status: "active", expiresAt: 2000 }, 1000));
  assert.ok(!cardIsLive({ status: "active", expiresAt: 1000 }, 1000));
  assert.ok(!cardIsLive({ status: "closed", expiresAt: 5000 }, 1000));
});

test("a commercial profile needs a trading name and one document", () => {
  const ok = { tradingName: "Kato Farm Supplies", kind: "trading_licence", hasPhoto: true };
  assert.equal(commercialProfileProblem(ok), null);
  assert.match(commercialProfileProblem({ ...ok, tradingName: " " }) ?? "", /trading name/);
  assert.match(commercialProfileProblem({ ...ok, hasPhoto: false }) ?? "", /photo of your trading licence/);
  assert.match(commercialProfileProblem({ ...ok, kind: "passport" }) ?? "", /Choose your document/);
  assert.equal(commercialProfileProblem({ tradingName: "Kato", kind: "tin", number: "1000 123 456", hasPhoto: false }), null, "a TIN needs the number, not a photo");
  assert.match(commercialProfileProblem({ tradingName: "Kato", kind: "tin", number: "12345", hasPhoto: true }) ?? "", /10 digits/);
});
