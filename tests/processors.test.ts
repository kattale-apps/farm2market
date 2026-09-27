import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applicableStages,
  combineTraceLevels,
  outturnPercent,
  processorSuccessFeeUgx,
  traceLevelFromIntakes,
  DEFAULT_PROCESSOR_DOCUMENT_TYPES,
} from "../convex/processorShared";
import { DEFAULT_EXPORT_DOCUMENT_TYPES, DEFAULT_EXPORT_FEE_SETTINGS } from "../convex/exportMarketsShared";

test("farmers on the app make processed coffee platform-traced", () => {
  assert.equal(traceLevelFromIntakes([{ sourceKind: "platform_farmer", evidenceStatus: "none" }]), "platform_traced");
});

test("declared intake stays declared until its evidence is approved, then is declared + evidenced", () => {
  assert.equal(traceLevelFromIntakes([{ sourceKind: "declared", evidenceStatus: "pending" }]), "declared");
  assert.equal(traceLevelFromIntakes([{ sourceKind: "declared", evidenceStatus: "approved" }]), "declared_evidenced");
  assert.equal(
    traceLevelFromIntakes([
      { sourceKind: "declared", evidenceStatus: "approved" },
      { sourceKind: "declared", evidenceStatus: "rejected" },
    ]),
    "declared"
  );
  assert.equal(
    traceLevelFromIntakes([
      { sourceKind: "declared", evidenceStatus: "approved" },
      { sourceKind: "platform_farmer", evidenceStatus: "none" },
    ]),
    "partly_declared"
  );
  assert.equal(traceLevelFromIntakes([]), "declared");
});

test("a lot's trace level combines its sources", () => {
  assert.equal(combineTraceLevels(["platform_traced", "platform_traced"]), "platform_traced");
  assert.equal(combineTraceLevels(["declared_evidenced", "declared_evidenced"]), "declared_evidenced");
  assert.equal(combineTraceLevels(["declared_evidenced", "declared"]), "declared");
  assert.equal(combineTraceLevels(["platform_traced", "declared_evidenced"]), "partly_declared");
  assert.equal(combineTraceLevels([]), "declared");
});

test("farm stages drop out only when every source is a processor purchase", () => {
  const stages = [{ scope: "farm" }, { scope: "processor" }, { scope: "exporter" }];
  assert.equal(applicableStages(stages, [{ kind: "processor_purchase" }]).length, 2);
  assert.equal(applicableStages(stages, [{ kind: "processor_purchase" }, { kind: "declared" }]).length, 3);
  assert.equal(applicableStages(stages, []).length, 3);
});

test("outturn is weight out over weight in", () => {
  assert.equal(outturnPercent(1000, 800), 80);
  assert.equal(outturnPercent(1000, undefined), null);
  assert.equal(outturnPercent(0, 10), null);
});

test("processor fees are 0 by default and only charged when a super admin sets them", () => {
  assert.equal(DEFAULT_EXPORT_FEE_SETTINGS.processorVerificationFeeUgx, 0);
  assert.equal(DEFAULT_EXPORT_FEE_SETTINGS.processorSuccessFeePercent, 0);
  assert.equal(processorSuccessFeeUgx(1_000_000, 0), 0);
  assert.equal(processorSuccessFeeUgx(1_000_000, undefined), 0);
  assert.equal(processorSuccessFeeUgx(1_000_000, 1.5), 15_000);
});

test("processor document keys do not clash with exporter or buyer keys", () => {
  const keys = [...DEFAULT_EXPORT_DOCUMENT_TYPES, ...DEFAULT_PROCESSOR_DOCUMENT_TYPES].map((d) => d.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(DEFAULT_PROCESSOR_DOCUMENT_TYPES.every((d) => d.appliesTo === "processor"));
});
