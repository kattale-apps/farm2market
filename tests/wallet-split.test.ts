import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_RUNNING,
  NotEnoughRealMoney,
  applyEntry,
  realOf,
  replayHistory,
  shareOf,
  type HistoryEntry,
} from "../convex/walletSplitShared";

const demoDeposit = (amount: number) => applyEntry(EMPTY_RUNNING, "capital_deposit", amount, { kind: "all" }).next;

test("demo deposits are demo and real deposits are real", () => {
  const afterDemo = demoDeposit(1_000_000);
  assert.deepEqual(afterDemo, { balance: 1_000_000, demo: 1_000_000 });
  const afterReal = applyEntry(afterDemo, "capital_deposit", 50_000, { kind: "none" }).next;
  assert.deepEqual(afterReal, { balance: 1_050_000, demo: 1_000_000 });
  assert.equal(realOf(afterReal), 50_000);
});

test("spending uses demo money first, then real", () => {
  const start = { balance: 150_000, demo: 100_000 };
  const small = applyEntry(start, "capital_lock", 80_000, { kind: "demo_first" });
  assert.equal(small.demoAmount, 80_000);
  assert.deepEqual(small.next, { balance: 70_000, demo: 20_000 });
  const big = applyEntry(start, "capital_lock", 130_000, { kind: "demo_first" });
  assert.equal(big.demoAmount, 100_000);
  assert.deepEqual(big.next, { balance: 20_000, demo: 0 });
});

test("cash-outs and FarmCoin purchases can only use real money", () => {
  const start = { balance: 1_030_000, demo: 1_000_000 };
  const ok = applyEntry(start, "cashout_hold", 30_000, { kind: "real_only" });
  assert.equal(ok.demoAmount, 0);
  assert.deepEqual(ok.next, { balance: 1_000_000, demo: 1_000_000 });
  assert.throws(() => applyEntry(start, "cashout_hold", 30_001, { kind: "real_only" }), NotEnoughRealMoney);
  assert.throws(() => applyEntry(start, "farmcoin_purchase_debit", 40_000, { kind: "real_only" }), NotEnoughRealMoney);
});

test("escrow releases keep the demo share they were locked with", () => {
  // A buyer locks 100k, 60k of it demo; the trader receives it with the same split.
  const lock = applyEntry({ balance: 100_000, demo: 60_000 }, "capital_lock", 100_000, { kind: "demo_first" });
  assert.equal(lock.demoAmount, 60_000);
  const traderAfter = applyEntry({ balance: 0, demo: 0 }, "profit_credit", 100_000, { kind: "exact", demoAmount: lock.demoAmount }).next;
  assert.equal(realOf(traderAfter), 40_000);
  assert.equal(traderAfter.demo, 60_000);
});

test("a part of a lock carries its proportional demo share", () => {
  assert.equal(shareOf(60_000, 100_000, 25_000), 15_000);
  assert.equal(shareOf(0, 100_000, 25_000), 0);
  assert.equal(shareOf(60_000, 100_000, 100_000), 60_000);
  assert.equal(shareOf(60_000, 100_000, 0), 0);
});

test("incoming purchase records leave balances unchanged", () => {
  const r = { balance: 500, demo: 200 };
  assert.deepEqual(applyEntry(r, "incoming_purchase", 900, { kind: "none" }).next, r);
});

function entry(id: string, type: string, amount: number, balanceAfter: number, metadata?: any, utid = id): HistoryEntry {
  return { id, utid, type, amount, balanceAfter, metadata };
}

test("history replay rebuilds a demo trader's split with demo spent first", () => {
  const history = [
    entry("1", "capital_deposit", 1_000_000, 1_000_000, { source: "auto_restore_demo_capital" }),
    entry("2", "capital_deposit", 200_000, 1_200_000, { source: "pesapal_payment" }),
    entry("3", "capital_lock", 1_100_000, 100_000, {}, "LOCK-A"),
    entry("4", "profit_credit", 300_000, 400_000, { source: "buyer_purchase_release" }),
  ];
  const { final, hadDemo, rows } = replayHistory(history);
  assert.equal(hadDemo, true);
  // Lock took all 1,000,000 demo and 100,000 real; 100,000 real left, plus 300,000 real profit.
  assert.deepEqual(final, { balance: 400_000, demo: 0 });
  assert.deepEqual(rows[2], { id: "3", demoAmount: 1_000_000, demoBalanceAfter: 0 });
});

test("history replay gives back a lock's demo share on unlock", () => {
  const history = [
    entry("1", "capital_deposit", 1_000_000, 1_000_000, { source: "admin_demo_deposit" }),
    entry("2", "capital_lock", 10_000, 990_000, {}, "LOCK-U"),
    entry("3", "capital_unlock", 10_000, 1_000_000, { reversedLockUtid: "LOCK-U" }),
  ];
  const { final } = replayHistory(history);
  assert.deepEqual(final, { balance: 1_000_000, demo: 1_000_000 });
});

test("an account that never had demo money is entirely real", () => {
  const history = [
    entry("1", "capital_deposit", 50_000, 50_000, { source: "pesapal_payment" }),
    entry("2", "capital_lock", 20_000, 30_000),
  ];
  const { final, hadDemo } = replayHistory(history);
  assert.equal(hadDemo, false);
  assert.equal(realOf(final), 30_000);
});

test("entries written after go-live keep their recorded split on replay", () => {
  const history: HistoryEntry[] = [
    { ...entry("1", "profit_credit", 100_000, 100_000), demoAmount: 60_000, demoBalanceAfter: 60_000 },
  ];
  assert.deepEqual(replayHistory(history).final, { balance: 100_000, demo: 60_000 });
});
