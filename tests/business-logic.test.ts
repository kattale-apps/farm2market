import assert from "node:assert/strict";
import test from "node:test";

import {
    calculateBuyerPickupSLA,
    calculateExposure,
    calculateFarmerDeliverySLA,
    generateUTID,
    generateUserAlias,
    validateExposureLimit,
} from "../convex/utils/index";
import {
    calculateTotalOwed,
    canProceed,
    getPaymentLabel,
    hasFailed,
    hasPaid,
    isPending,
    requirePaymentForImagePost,
    type Payment,
} from "../utils/paymentGuards";

test("payment guard helpers detect the right payment states", () => {
  const paid: Payment = { payableAmount: 4000, billedAmount: 4000, status: "paid" };
  const pending: Payment = { payableAmount: 5000, billedAmount: 2500, status: "pending" };
  const failed: Payment = { payableAmount: 3000, billedAmount: 500, status: "failed" };

  assert.equal(hasPaid(paid), true);
  assert.equal(hasPaid(pending), false);
  assert.equal(isPending(pending), true);
  assert.equal(hasFailed(failed), true);
  assert.equal(canProceed(null), true);
  assert.equal(canProceed(paid), true);
  assert.equal(canProceed(pending), false);
  assert.equal(canProceed(failed), false);
});

test("payment guard totals and labels follow expected business rules", () => {
  const payments: Payment[] = [
    { payableAmount: 10000, billedAmount: 5000, status: "paid" },
    { payableAmount: 8000, billedAmount: 2000, status: "pending" },
    { payableAmount: 6000, billedAmount: 2000, status: "failed" },
  ];

  assert.equal(calculateTotalOwed(payments), 10000);
  assert.equal(getPaymentLabel("paid"), "Amount Paid");
  assert.equal(getPaymentLabel("pending"), "Amount to Pay");
  assert.equal(getPaymentLabel("failed"), "Payment Failed");
  assert.equal(getPaymentLabel(undefined), "Amount to Pay");
});

test("requirePaymentForImagePost blocks unpaid users", () => {
  assert.doesNotThrow(() => requirePaymentForImagePost({ payableAmount: 1000, billedAmount: 1000, status: "paid" }));
  assert.throws(() => requirePaymentForImagePost({ payableAmount: 1000, billedAmount: 0, status: "pending" }), /Payment required to post images/);
});

test("generateUTID is deterministic and includes entity metadata", () => {
  const context = {
    entityType: "listing",
    timestamp: 1700000000000,
    additionalData: { lot: 42, sku: "A12" },
  };

  const first = generateUTID(context);
  const second = generateUTID(context);

  assert.equal(first, second);
  assert.match(first, /^listing-[a-z0-9]+-[a-z0-9]+$/);
  assert.ok(first.includes("listing"));
});

test("calculateExposure enforces the UGX 1,000,000 exposure limit", () => {
  const withinLimit = calculateExposure({ capitalCommitted: 200000, lockedOrders: 350000, inventoryValue: 250000 });
  const overLimit = calculateExposure({ capitalCommitted: 400000, lockedOrders: 400000, inventoryValue: 300000 });

  assert.equal(withinLimit.totalExposure, 800000);
  assert.equal(withinLimit.exceedsLimit, false);
  assert.equal(withinLimit.remainingCapacity, 200000);

  assert.equal(overLimit.totalExposure, 1100000);
  assert.equal(overLimit.exceedsLimit, true);
  assert.equal(overLimit.remainingCapacity, 0);
  assert.equal(overLimit.limit, 1000000);
});

test("validateExposureLimit returns the expected excess and validity flags", () => {
  const valid = validateExposureLimit(1000000);
  const invalid = validateExposureLimit(1000001);

  assert.equal(valid.isValid, true);
  assert.equal(valid.exceedsLimit, false);
  assert.equal(valid.excess, 0);

  assert.equal(invalid.isValid, false);
  assert.equal(invalid.exceedsLimit, true);
  assert.equal(invalid.excess, 1);
});

test("delivery SLA calculations produce the expected deadlines", () => {
  const lockTime = 1700000000000;
  const farmerSla = calculateFarmerDeliverySLA(lockTime);
  const buyerSla = calculateBuyerPickupSLA(lockTime);

  assert.equal(farmerSla.slaHours, 6);
  assert.equal(farmerSla.deadline, lockTime + 6 * 60 * 60 * 1000);
  assert.equal(farmerSla.isExpired, false);
  assert.equal(farmerSla.timeRemaining, 0);

  assert.equal(buyerSla.slaHours, 48);
  assert.equal(buyerSla.deadline, lockTime + 48 * 60 * 60 * 1000);
  assert.equal(buyerSla.isExpired, false);
  assert.equal(buyerSla.timeRemaining, 0);
});

test("user aliases are deterministic and privacy-safe", () => {
  const first = generateUserAlias({ role: "farmer", email: "Farmer.User@example.com", timestamp: 1700000000000 });
  const second = generateUserAlias({ role: "farmer", email: "Farmer.User@example.com", timestamp: 1700000000000 });

  assert.equal(first, second);
  assert.match(first, /^farmer_[a-z0-9]+_[a-z0-9]+$/);
  assert.equal(first.includes("example"), false);
  assert.equal(first.includes("@"), false);
});
