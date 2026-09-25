import test from "node:test";
import assert from "node:assert/strict";

import {
  aiHealthLevel,
  canFlag,
  canRemove,
  cleanAiMatches,
  ugandaMonthKey,
  CONFIDENT_MATCH_PERCENT,
  healthLevel,
  isValidSymptom,
  rankMatches,
  STRONG_MATCH_PERCENT,
  symptomMatchPercent,
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

// ─── Farmer check matching ─────────────────────────────────────────────────

test("identical symptom lists are a 100% match and disjoint ones 0%", () => {
  assert.equal(symptomMatchPercent(["leaf_holes", "insects_seen"], ["insects_seen", "leaf_holes"]), 100);
  assert.equal(symptomMatchPercent(["wilting"], ["leaf_holes"]), 0);
});

test("an entry with no symptom tags never matches", () => {
  assert.equal(symptomMatchPercent(["wilting"], undefined), 0);
  assert.equal(symptomMatchPercent(["wilting"], []), 0);
});

test("partial overlap scores between the two", () => {
  // 1 of 1 picked is shared, 1 of 4 tags matched: F1 = 0.4
  assert.equal(symptomMatchPercent(["wilting"], ["wilting", "leaf_yellow", "stunted", "root_rot"]), 40);
});

test("matches are ranked strongest first, capped, and zero matches dropped", () => {
  const results = rankMatches(
    [
      { id: "a", symptomTags: ["wilting", "leaf_yellow"] },
      { id: "b", symptomTags: ["wilting"] },
      { id: "c", symptomTags: ["leaf_holes"] },
      { id: "d", symptomTags: [] },
    ],
    ["wilting"],
    2
  );
  assert.deepEqual(results.map((r) => r.id), ["b", "a"]);
});

test("the scorecard says healthy, likely, possible or unsure", () => {
  assert.equal(healthLevel([], []), "healthy");
  assert.equal(healthLevel(["wilting"], [{ id: "a", percent: STRONG_MATCH_PERCENT }]), "likely");
  assert.equal(healthLevel(["wilting"], [{ id: "a", percent: CONFIDENT_MATCH_PERCENT }]), "possible");
  assert.equal(healthLevel(["wilting"], [{ id: "a", percent: CONFIDENT_MATCH_PERCENT - 1 }]), "unsure");
  assert.equal(healthLevel(["wilting"], []), "unsure");
});

test("only known symptom keys are accepted", () => {
  assert.equal(isValidSymptom("wilting"), true);
  assert.equal(isValidSymptom("sad plant"), false);
});

// ─── AI photo check ────────────────────────────────────────────────────────

test("AI matches outside the library are dropped, and percentages clamped and ranked", () => {
  const out = cleanAiMatches(
    [
      { id: "made-up", percent: 99 },
      { id: "a", percent: 40 },
      { id: "b", percent: 140 },
      { id: "a", percent: 90 },
      { id: "c", percent: 0 },
    ],
    ["a", "b", "c"]
  );
  assert.deepEqual(out, [
    { id: "b", percent: 100 },
    { id: "a", percent: 40 },
  ]);
});

test("an unusable photo is always 'not sure'", () => {
  assert.equal(aiHealthLevel({ photoUsable: false, looksHealthy: true, matches: [{ id: "a", percent: 95 }] }), "unsure");
});

test("the AI scorecard uses the same thresholds, and healthy needs no real match", () => {
  const m = (percent: number) => [{ id: "a", percent }];
  assert.equal(aiHealthLevel({ photoUsable: true, looksHealthy: false, matches: m(STRONG_MATCH_PERCENT) }), "likely");
  assert.equal(aiHealthLevel({ photoUsable: true, looksHealthy: false, matches: m(CONFIDENT_MATCH_PERCENT) }), "possible");
  assert.equal(aiHealthLevel({ photoUsable: true, looksHealthy: true, matches: m(10) }), "healthy");
  assert.equal(aiHealthLevel({ photoUsable: true, looksHealthy: true, matches: m(STRONG_MATCH_PERCENT) }), "likely");
  assert.equal(aiHealthLevel({ photoUsable: true, looksHealthy: false, matches: [] }), "unsure");
});

test("the usage month follows the Uganda calendar", () => {
  // 30 Sep 2026 23:30 in Kampala, stored as a getUgandaTime() value
  assert.equal(ugandaMonthKey(Date.UTC(2026, 8, 30, 23, 30)), "2026-09");
  assert.equal(ugandaMonthKey(Date.UTC(2026, 9, 1, 0, 5)), "2026-10");
});
