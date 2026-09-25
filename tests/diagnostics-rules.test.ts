import test from "node:test";
import assert from "node:assert/strict";

import {
  canFlag,
  canRemove,
  canReview,
  flagKey,
  isFarmerVisible,
  isUnderReview,
  isValidHost,
  normalizeSourceUrl,
  UNDER_REVIEW_FLAG_THRESHOLD,
} from "../convex/diagnosticsRules";

const superAdmin = { isSuperAdmin: true, userId: "super1" };
const communityAdmin = { isSuperAdmin: false, userId: "admin1" };

test("a community admin cannot approve their own entry", () => {
  const result = canReview(communityAdmin, { status: "pending_review", addedBy: "admin1" });
  assert.equal(result.ok, false);
});

test("a community admin can approve another admin's entry", () => {
  assert.equal(canReview(communityAdmin, { status: "pending_review", addedBy: "admin2" }).ok, true);
});

test("a super admin can approve their own entry so the library can be seeded", () => {
  assert.equal(canReview(superAdmin, { status: "pending_review", addedBy: "super1" }).ok, true);
});

test("only entries waiting for review can be approved or rejected", () => {
  for (const status of ["active", "rejected", "removed"] as const) {
    assert.equal(canReview(superAdmin, { status, addedBy: "x" }).ok, false, status);
  }
});

test("only a super admin can remove, and never twice", () => {
  assert.equal(canRemove(communityAdmin, { status: "active" }).ok, false);
  assert.equal(canRemove(superAdmin, { status: "active" }).ok, true);
  assert.equal(canRemove(superAdmin, { status: "pending_review" }).ok, true);
  assert.equal(canRemove(superAdmin, { status: "removed" }).ok, false);
});

test("removed and rejected entries cannot be flagged", () => {
  assert.equal(canFlag({ status: "active" }).ok, true);
  assert.equal(canFlag({ status: "pending_review" }).ok, true);
  assert.equal(canFlag({ status: "removed" }).ok, false);
  assert.equal(canFlag({ status: "rejected" }).ok, false);
});

test("farmers only see items where both the item and its pest/disease are approved", () => {
  assert.equal(isFarmerVisible({ status: "active" }, { status: "active" }), true);
  assert.equal(isFarmerVisible({ status: "active" }, { status: "pending_review" }), false);
  assert.equal(isFarmerVisible({ status: "pending_review" }, { status: "active" }), false);
  assert.equal(isFarmerVisible({ status: "active" }, { status: "removed" }), false);
});

test("flags count once per community, so one community cannot trigger review alone", () => {
  assert.equal(flagKey(communityAdmin, "c1"), flagKey({ isSuperAdmin: false, userId: "admin2" }, "c1"));
  assert.notEqual(flagKey(communityAdmin, "c1"), flagKey(communityAdmin, "c2"));
  assert.equal(flagKey(superAdmin, "c1"), "user:super1");
});

test("the being-reviewed badge starts at the threshold", () => {
  assert.equal(isUnderReview(undefined), false);
  assert.equal(isUnderReview(UNDER_REVIEW_FLAG_THRESHOLD - 1), false);
  assert.equal(isUnderReview(UNDER_REVIEW_FLAG_THRESHOLD), true);
});

test("source links must be web links", () => {
  assert.equal(normalizeSourceUrl(undefined), undefined);
  assert.equal(normalizeSourceUrl("  "), undefined);
  assert.equal(normalizeSourceUrl(" https://www.fao.org/x "), "https://www.fao.org/x");
  assert.throws(() => normalizeSourceUrl("javascript:alert(1)"));
  assert.throws(() => normalizeSourceUrl("fao.org"));
});

test("only known crops are accepted", () => {
  assert.equal(isValidHost("maize"), true);
  assert.equal(isValidHost("Maize"), false);
  assert.equal(isValidHost("tobacco"), false);
});
