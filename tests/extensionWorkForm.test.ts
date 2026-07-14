import test from "node:test";
import assert from "node:assert/strict";
import { getEffectivePaymentAmount, getPaymentStatusLabel } from "../utils/extensionWorkForm";

test("returns a fixed payment amount when configured", () => {
  const amount = getEffectivePaymentAmount({ paymentEnabled: true, paymentAmount: 5000, paymentAmountEditable: false }, undefined);
  assert.equal(amount, 5000);
});

test("uses the worker-entered amount when editing is allowed", () => {
  const amount = getEffectivePaymentAmount({ paymentEnabled: true, paymentAmount: undefined, paymentAmountEditable: true }, "7500");
  assert.equal(amount, 7500);
});

test("returns null when payment is disabled", () => {
  const amount = getEffectivePaymentAmount({ paymentEnabled: false, paymentAmount: 5000, paymentAmountEditable: false }, undefined);
  assert.equal(amount, null);
});

test("maps payment status values to simple labels", () => {
  assert.equal(getPaymentStatusLabel("paid"), "Paid");
  assert.equal(getPaymentStatusLabel("failed"), "Failed");
  assert.equal(getPaymentStatusLabel("pending"), "Pending");
});
