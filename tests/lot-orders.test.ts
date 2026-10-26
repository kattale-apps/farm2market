import assert from "node:assert/strict";
import test from "node:test";

import {
  chargeForStep,
  commitAmount,
  defaultPlan,
  defaultSteps,
  demoShares,
  earnedSoFar,
  escrowTargetAfter,
  lotBuyingDecision,
  lotTerms,
  nextStepIndex,
  penaltySplit,
  proRatePay,
  validatePlan,
  type PlanStep,
} from "../convex/lotOrdersShared";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

test("farmers start from Harvest, Prepare, Collect from farm gate", () => {
  const steps = defaultSteps("farmer");
  assert.deepEqual(steps.map((s) => s.name), ["Harvest", "Prepare (dry, sort, bag and weigh)", "Collect from farm gate"]);
  assert.deepEqual(steps.map((s) => s.earnPercent), [30, 30, 40]);
  assert.equal(steps[steps.length - 1].handover, true);
});

test("vendors and processors end with collection from their store", () => {
  for (const role of ["vendor", "store"]) {
    const steps = defaultSteps(role);
    assert.equal(steps[steps.length - 1].name, "Collect from my store");
    assert.equal(sum(steps.map((s) => s.earnPercent)), 100);
  }
});

test("a 30% commit pro-rates the rest over the steps before collection: +35% / +35% / 0%", () => {
  assert.deepEqual(proRatePay(defaultSteps("farmer"), 30), [35, 35, 0]);
});

test("pro-rating follows what each step earns", () => {
  const steps = [
    { earnPercent: 20, handover: false },
    { earnPercent: 40, handover: false },
    { earnPercent: 40, handover: true },
  ];
  // 80% left, split 20:40 over the first two steps
  assert.deepEqual(proRatePay(steps, 20), [26.67, 53.33, 0]);
});

test("with 100% committed nothing more is charged", () => {
  assert.deepEqual(proRatePay(defaultSteps("farmer"), 100), [0, 0, 0]);
});

test("with no step before collection the rest is due at the handover", () => {
  assert.deepEqual(proRatePay([{ earnPercent: 100, handover: true }], 25), [75]);
});

test("default plans validate for any commit from 1 to 100", () => {
  for (const commit of [1, 7.5, 20, 33, 50, 99, 100]) {
    for (const role of ["farmer", "vendor"]) {
      const plan = defaultPlan(role, commit);
      assert.doesNotThrow(() => validatePlan(plan, commit), `${role} at ${commit}%`);
    }
  }
});

test("plan validation catches the plain mistakes", () => {
  const good = defaultPlan("farmer", 30);
  assert.throws(() => validatePlan(good, 0), /between 1% and 100%/);
  assert.throws(() => validatePlan(good, 101), /between 1% and 100%/);
  assert.throws(() => validatePlan([], 30), /between 1 and 8 steps/);
  assert.throws(() => validatePlan(good.map((s, i) => (i === 0 ? { ...s, name: "  " } : s)), 30), /needs a name/);
  assert.throws(() => validatePlan(good.map((s, i) => (i === 0 ? { ...s, earnPercent: 20 } : s)), 30), /add up to 100%/);
  assert.throws(() => validatePlan(good.map((s, i) => (i === 0 ? { ...s, payPercent: 10 } : s)), 30), /first payment and the step payments/);
  const handoverFirst: PlanStep[] = [{ ...good[2] }, { ...good[0] }, { ...good[1] }];
  assert.throws(() => validatePlan(handoverFirst, 30), /last step must be the collection/);
});

test("step charges add up to exactly the total, with no shilling lost", () => {
  for (const total of [100_000, 333_333, 1, 999_999]) {
    const plan = defaultPlan("farmer", 30);
    const pays = plan.map((s) => s.payPercent);
    const charges = plan.map((_, i) => chargeForStep(total, 30, pays, i));
    assert.equal(commitAmount(total, 30) + sum(charges), total, `total ${total}`);
    assert.equal(escrowTargetAfter(total, 30, pays, plan.length - 1), total);
  }
});

test("an accepted offer moves every step amount with the agreed price", () => {
  const plan = defaultPlan("farmer", 30);
  const pays = plan.map((s) => s.payPercent);
  const posted = 100 * 2000; // 100 kg at UGX 2,000
  const agreed = 100 * 2500; // offer accepted at UGX 2,500
  assert.deepEqual(plan.map((_, i) => chargeForStep(posted, 30, pays, i)), [70_000, 70_000, 0]);
  assert.deepEqual(plan.map((_, i) => chargeForStep(agreed, 30, pays, i)), [87_500, 87_500, 0]);
  assert.equal(commitAmount(agreed, 30), 75_000);
});

test("earned so far counts finished steps and is the total once all are done", () => {
  const steps = defaultSteps("farmer").map((s) => ({ ...s, doneAt: undefined as number | undefined }));
  assert.equal(earnedSoFar(100_000, steps), 0);
  steps[0].doneAt = 1;
  assert.equal(earnedSoFar(100_000, steps), 30_000);
  steps[1].doneAt = 2;
  steps[2].doneAt = 3;
  assert.equal(earnedSoFar(100_001, steps), 100_001);
  assert.equal(nextStepIndex(steps), -1);
});

test("a missed payment: 25% to the seller, 25% to the platform, 50% back to the buyer", () => {
  assert.deepEqual(penaltySplit(100_000), { fineToSeller: 25_000, fineToPlatform: 25_000, toBuyer: 50_000 });
  for (const escrow of [1, 3, 99_999, 123_457]) {
    const split = penaltySplit(escrow);
    assert.equal(split.fineToSeller + split.fineToPlatform + split.toBuyer, escrow, `escrow ${escrow}`);
  }
});

test("demo money follows the payouts and is never created", () => {
  // Settlement: everything to the seller keeps all the demo.
  assert.deepEqual(demoShares(40_000, 100_000, [100_000]), [40_000]);
  // An admin split: the two parts carry all the demo between them.
  const [seller, buyer] = demoShares(33_333, 100_000, [40_000, 60_000]);
  assert.equal(seller + buyer, 33_333);
  assert.ok(seller <= 40_000 && buyer <= 60_000);
  // A penalty: the platform's share of demo is not handed to anyone.
  const [toSeller, toBuyer] = demoShares(40_000, 100_000, [25_000, 50_000]);
  assert.deepEqual([toSeller, toBuyer], [10_000, 20_000]);
  // No demo in escrow, none paid out.
  assert.deepEqual(demoShares(0, 100_000, [60_000, 40_000]), [0, 0]);
});

test("who can buy lots: verified exporters, processors, vendors and business buyers", () => {
  const verified = { verificationStatus: "verified" };
  for (const role of ["trader", "store", "vendor", "buyer"]) {
    assert.equal(lotBuyingDecision({ role, ...verified }, false).ok, true, `${role} verified`);
    assert.equal(lotBuyingDecision({ role }, false).ok, false, `${role} not verified`);
  }
  // Transporters move goods; they do not buy lots, even verified
  assert.equal(lotBuyingDecision({ role: "transporter", ...verified }, false).ok, false);
  // Exporters verified before the switch was widened
  assert.equal(lotBuyingDecision({ role: "trader", isVerifiedTrader: true }, false).ok, true);
  // A processor with an approved facility needs no separate switch
  assert.equal(lotBuyingDecision({ role: "store" }, true).ok, true);
  // ...but an approved facility means nothing for other roles
  assert.equal(lotBuyingDecision({ role: "vendor" }, true).ok, false);
  // Farmers sell; they do not buy lots
  assert.match(lotBuyingDecision({ role: "farmer", ...verified }, false).reason ?? "", /Only exporters, processors/);
  assert.equal(lotBuyingDecision(null, false).ok, false);
});

test("listing terms: defaults from a commit %, nothing stored for older callers", () => {
  assert.equal(lotTerms("farmer"), null);
  const terms = lotTerms("farmer", 20)!;
  assert.equal(terms.commitPercent, 20);
  assert.deepEqual(terms.milestonePlan.map((s) => s.payPercent), [40, 40, 0]);
  // A seller's own plan is checked
  assert.throws(() => lotTerms("farmer", 20, [{ name: "Collect", earnPercent: 100, payPercent: 0, handover: true }]), /add up to 100%/);
  assert.equal(lotTerms("vendor", 50, [{ name: "Collect from my store", earnPercent: 100, payPercent: 50, handover: true }])!.commitPercent, 50);
});
