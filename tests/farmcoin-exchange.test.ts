import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_EXCHANGE_SETTINGS,
  guessNetwork,
  sentifyCash,
  planFills,
  priceFill,
  validateExchangeSettings,
} from "../convex/farmcoinExchangeShared";

test("a fill is priced at the rate with the fee taken from the seller", () => {
  assert.deepEqual(priceFill(10, 500, 5), { grossUGX: 5000, feeUGX: 250, netUGX: 4750 });
  assert.deepEqual(priceFill(3, 333, 2.5), { grossUGX: 999, feeUGX: 25, netUGX: 974 });
  assert.deepEqual(priceFill(4, 1000, 0), { grossUGX: 4000, feeUGX: 0, netUGX: 4000 });
});

test("purchases fill from the oldest offer first, across sellers", () => {
  const queue = [
    { id: "o1", sellerId: "a", coinsRemaining: 5 },
    { id: "o2", sellerId: "b", coinsRemaining: 10 },
    { id: "o3", sellerId: "c", coinsRemaining: 10 },
  ];
  assert.deepEqual(planFills(queue, "buyer", 12), [
    { offerId: "o1", sellerId: "a", coins: 5 },
    { offerId: "o2", sellerId: "b", coins: 7 },
  ]);
});

test("the buyer's own offers are skipped", () => {
  const queue = [
    { id: "o1", sellerId: "buyer", coinsRemaining: 5 },
    { id: "o2", sellerId: "b", coinsRemaining: 3 },
  ];
  assert.deepEqual(planFills(queue, "buyer", 4), [{ offerId: "o2", sellerId: "b", coins: 3 }]);
});

test("a short queue fills only what is there", () => {
  const queue = [{ id: "o1", sellerId: "a", coinsRemaining: 2 }];
  const fills = planFills(queue, "buyer", 50);
  assert.equal(fills.reduce((s, f) => s + f.coins, 0), 2);
  assert.deepEqual(planFills([], "buyer", 5), []);
});

test("settings are validated", () => {
  assert.equal(validateExchangeSettings(DEFAULT_EXCHANGE_SETTINGS), null);
  assert.equal(validateExchangeSettings({ ...DEFAULT_EXCHANGE_SETTINGS, rateUGX: 500, feePercent: 2.5 }), null);
  assert.notEqual(validateExchangeSettings({ ...DEFAULT_EXCHANGE_SETTINGS, rateUGX: 1.5 }), null);
  assert.notEqual(validateExchangeSettings({ ...DEFAULT_EXCHANGE_SETTINGS, feePercent: 60 }), null);
  assert.notEqual(validateExchangeSettings({ ...DEFAULT_EXCHANGE_SETTINGS, minSellCoins: 0 }), null);
  assert.notEqual(validateExchangeSettings({ ...DEFAULT_EXCHANGE_SETTINGS, minCashoutUGX: 0 }), null);
});

test("the mobile network is guessed from the number", () => {
  assert.equal(guessNetwork("+256772123456"), "mtn");
  assert.equal(guessNetwork("+256701123456"), "airtel");
  assert.equal(guessNetwork("+256751123456"), "airtel");
  assert.equal(guessNetwork("+256414123456"), null);
});

test("Sentify cash is the FarmCoin part of real money", () => {
  const sold = [{ type: "farmcoin_sale_credit", amount: 20_000 }];
  assert.equal(sentifyCash(sold, 50_000), 20_000);
  // Never more than the real money in the wallet.
  assert.equal(sentifyCash(sold, 12_000), 12_000);
  // Cash-outs count against it first; a rejected cash-out gives it back.
  const held = [...sold, { type: "cashout_hold", amount: 15_000 }];
  assert.equal(sentifyCash(held, 35_000), 5_000);
  assert.equal(sentifyCash([...held, { type: "cashout_release", amount: 15_000 }], 50_000), 20_000);
  assert.equal(sentifyCash([{ type: "profit_credit", amount: 9_000 }], 9_000), 0);
});
