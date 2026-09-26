import assert from "node:assert/strict";
import test from "node:test";

import {
  SYSTEM_STEP_KEYS,
  centsPerLbToUsdPerKg,
  computeDealFees,
  defaultPipelineSteps,
  maskContactDetails,
  ugxPerUsd,
  validatePipelineSteps,
  type PipelineStep,
} from "../convex/exportMarketsShared";

test("contact details are masked before names are revealed", () => {
  const cases = [
    "email me at john.doe@coffee.co.ug",
    "john (at) coffee (dot) com",
    "call +256 772 123 456",
    "WhatsApp 0772123456",
    "see www.mycoffee.com",
    "https://example.org/offer",
    "find us on wa.me/256772123456",
    "ping @kampalacoffee",
  ];
  for (const c of cases) {
    const r = maskContactDetails(c);
    assert.equal(r.masked, true, c);
    assert.ok(r.text.includes("hidden until names are revealed"), c);
  }
});

test("ordinary trade talk is left alone", () => {
  const cases = [
    "Can you ship 320 bags in November?",
    "Shipment window 2026-11-01 to 2026-12-15",
    "Price 4.85 USD/kg FOB Mombasa, moisture 12.5%",
    "We need 19,200 kg, screen 15+",
  ];
  for (const c of cases) {
    const r = maskContactDetails(c);
    assert.equal(r.masked, false, c);
    assert.equal(r.text, c);
  }
});

test("success fee by percent applies the verification credit", () => {
  const f = computeDealFees({
    contractValueUsd: 100_000,
    bags: 320,
    fxUgxPerUsd: 3700,
    successFeeMode: "percent",
    successFeePercent: 1,
    successFeePerBagUsd: 0,
    buyerFeePercent: 0,
    exporterCreditUgx: 500_000,
  });
  assert.equal(f.successFeeUsd, 1000);
  assert.equal(f.successFeeUgx, 3_700_000);
  assert.equal(f.creditAppliedUgx, 500_000);
  assert.equal(f.exporterDueUgx, 3_200_000);
  assert.equal(f.buyerFeeUgx, 0);
});

test("per-bag success fee, buyer fee, and credit never exceeding the fee", () => {
  const f = computeDealFees({
    contractValueUsd: 50_000,
    bags: 100,
    fxUgxPerUsd: 3650.5,
    successFeeMode: "per_bag",
    successFeePercent: 0,
    successFeePerBagUsd: 2,
    buyerFeePercent: 0.5,
    exporterCreditUgx: 10_000_000,
  });
  assert.equal(f.successFeeUsd, 200);
  assert.equal(f.successFeeUgx, Math.ceil(200 * 3650.5));
  assert.equal(f.creditAppliedUgx, f.successFeeUgx);
  assert.equal(f.exporterDueUgx, 0);
  assert.equal(f.buyerFeeUgx, Math.ceil(250 * 3650.5));
});

test("exchange rate and price unit conversions", () => {
  assert.equal(ugxPerUsd(0), null);
  assert.equal(ugxPerUsd(undefined), null);
  assert.ok(Math.abs(ugxPerUsd(1 / 3700)! - 3700) < 1e-6);
  // 287.29 US cents/lb is about 6.33 USD/kg
  assert.ok(Math.abs(centsPerLbToUsdPerKg(287.29) - 6.3336) < 0.001);
});

test("default pipelines contain every built-in step in order; CIF adds insurance", () => {
  const fob = defaultPipelineSteps("FOB");
  assert.deepEqual(fob.map((s) => s.key), [...SYSTEM_STEP_KEYS]);
  assert.equal(validatePipelineSteps(fob), null);
  const cif = defaultPipelineSteps("CIF");
  assert.ok(cif.find((s) => s.key === "pre_shipment_docs")!.requiredDocuments.includes("Insurance certificate"));
  assert.ok(!fob.find((s) => s.key === "pre_shipment_docs")!.requiredDocuments.includes("Insurance certificate"));
  // Disclosure comes after fees, and payment security after disclosure
  const keys = fob.map((s) => s.key);
  assert.ok(keys.indexOf("platform_fees") < keys.indexOf("disclosure"));
  assert.ok(keys.indexOf("disclosure") < keys.indexOf("payment_security"));
});

test("pipeline validation protects built-in steps and anonymity", () => {
  const base = defaultPipelineSteps("FOB");
  const custom: PipelineStep = { key: "custom_x", name: "Warehouse receipt", actor: "exporter", kind: "documents", system: false, requiredDocuments: ["Receipt"] };

  // Custom step after disclosure is fine
  const ok = [...base.slice(0, 8), custom, ...base.slice(8)];
  assert.equal(validatePipelineSteps(ok), null);

  // Custom step before disclosure would leak before fees are paid
  const early = [...base.slice(0, 2), custom, ...base.slice(2)];
  assert.match(validatePipelineSteps(early)!, /after identities are revealed/);

  // Built-in steps cannot be removed or reordered
  assert.match(validatePipelineSteps(base.filter((s) => s.key !== "sample"))!, /Built-in steps/);
  const swapped = [...base];
  [swapped[2], swapped[3]] = [swapped[3], swapped[2]];
  assert.match(validatePipelineSteps(swapped)!, /Built-in steps/);

  // A document step needs documents; a custom step cannot pose as a system step
  assert.match(validatePipelineSteps([...base.slice(0, 8), { ...custom, requiredDocuments: [] }, ...base.slice(8)])!, /needs at least one document/);
  assert.match(validatePipelineSteps([...base.slice(0, 8), { ...custom, system: true }, ...base.slice(8)])!, /system steps/);
});
