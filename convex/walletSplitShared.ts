/**
 * Demo and real money in the wallet ledger. Pure rules, no database.
 *
 * Every walletLedger entry records how much of its amount was demo money
 * (`demoAmount`) and the account's running demo balance after it
 * (`demoBalanceAfter`). The running total stays in `balanceAfter`, which is
 * what the purchase and fee flows check, so real = balanceAfter - demo.
 *
 * - Demo money: the automatic trader top-up, admin demo deposits, the reset
 *   restore, seeded demo data and the retired manual deposit. It can be
 *   traded with but never cashed out.
 * - Real money: Pesapal deposits, Wallet top-ups, FarmCoin sale proceeds.
 * - Spending on produce, escrow and fees uses demo money first.
 * - Buying FarmCoin and cashing out use real money only.
 * - Money moving out of escrow (a release to a trader or farmer, or a
 *   refund) keeps the demo share it was locked with, so demo never turns
 *   into real money by changing hands.
 */

export const DEMO_DEPOSIT_SOURCES = new Set([
  "auto_restore_demo_capital",
  "admin_demo_deposit",
  "admin_reset_restore",
  "demo_seed",
  "manual_deposit",
]);

const DEBIT_TYPES = new Set([
  "capital_lock",
  "trader_commission_deduction",
  "export_fee_payment",
  "profit_withdrawal",
  "farmcoin_purchase_debit",
  "cashout_hold",
]);

const NEUTRAL_TYPES = new Set(["incoming_purchase"]);

/** +1 adds to the balance, -1 takes from it, 0 leaves it alone. */
export function direction(type: string): 1 | -1 | 0 {
  if (NEUTRAL_TYPES.has(type)) return 0;
  return DEBIT_TYPES.has(type) ? -1 : 1;
}

/** How the demo share of an entry is decided. */
export type DemoRule =
  | { kind: "all" } // demo deposits
  | { kind: "none" } // real deposits and real-only credits
  | { kind: "demo_first" } // spending on produce, escrow and fees
  | { kind: "real_only" } // buying FarmCoin, cashing out
  | { kind: "exact"; demoAmount: number }; // escrow releases and refunds

export type Running = { balance: number; demo: number };

export const EMPTY_RUNNING: Running = { balance: 0, demo: 0 };

export function realOf(r: Running): number {
  return Math.max(0, r.balance - r.demo);
}

export class NotEnoughRealMoney extends Error {
  constructor(public available: number) {
    super(`Only UGX ${Math.round(available).toLocaleString("en-US")} of your wallet is real money that can be used for this.`);
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Applies one entry. `balanceAfter` overrides the computed total, for
 * replaying history whose stored totals are the source of truth.
 */
export function applyEntry(
  r: Running,
  type: string,
  amount: number,
  rule: DemoRule,
  balanceAfter?: number
): { demoAmount: number; next: Running } {
  const dir = direction(type);
  let demoAmount = 0;
  if (dir !== 0) {
    if (rule.kind === "exact") demoAmount = clamp(rule.demoAmount, 0, amount);
    else if (dir > 0) demoAmount = rule.kind === "all" ? amount : 0;
    else if (rule.kind === "real_only") {
      if (realOf(r) < amount) throw new NotEnoughRealMoney(realOf(r));
    } else if (rule.kind === "demo_first" || rule.kind === "all") demoAmount = Math.min(amount, Math.max(0, r.demo));
    if (dir < 0) demoAmount = Math.min(demoAmount, Math.max(0, r.demo));
  }
  const balance = balanceAfter ?? r.balance + dir * amount;
  const demo = clamp(r.demo + dir * demoAmount, 0, Math.max(0, balance));
  return { demoAmount, next: { balance, demo } };
}

/** The demo share of `part` of a lock that held `lockDemo` demo out of `lockAmount`. */
export function shareOf(lockDemo: number, lockAmount: number, part: number): number {
  if (lockAmount <= 0 || lockDemo <= 0 || part <= 0) return 0;
  return Math.min(lockDemo, part, Math.round((lockDemo * part) / lockAmount));
}

export type HistoryEntry = {
  id: string;
  utid: string;
  type: string;
  amount: number;
  balanceAfter?: number;
  demoAmount?: number;
  demoBalanceAfter?: number;
  metadata?: any;
};

export function isDemoDeposit(entry: Pick<HistoryEntry, "type" | "metadata">): boolean {
  return entry.type === "capital_deposit" && DEMO_DEPOSIT_SOURCES.has(entry.metadata?.source);
}

/** The lock an unlock reverses, from the metadata the unlock paths write. */
function reversedLock(entry: HistoryEntry): string | undefined {
  const m = entry.metadata ?? {};
  return m.reversedLockUtid ?? m.originalLockUtid;
}

/**
 * Rebuilds the demo split of one account from its history, oldest first.
 * Entries written after this feature (they carry `demoBalanceAfter`) keep
 * their recorded demo share. Older ones follow the rules above, except that
 * credits from escrow releases count as real (the user's decision for
 * profit earned before go-live), and an unlock gives back the demo share
 * of the lock it reverses.
 */
export function replayHistory(entries: HistoryEntry[]): {
  rows: { id: string; demoAmount: number; demoBalanceAfter: number }[];
  final: Running;
  hadDemo: boolean;
} {
  let r: Running = EMPTY_RUNNING;
  let hadDemo = false;
  const locks = new Map<string, { amount: number; demo: number }>();
  const rows: { id: string; demoAmount: number; demoBalanceAfter: number }[] = [];

  for (const e of entries) {
    let rule: DemoRule;
    if (e.demoBalanceAfter !== undefined && e.demoAmount !== undefined) rule = { kind: "exact", demoAmount: e.demoAmount };
    else if (isDemoDeposit(e)) rule = { kind: "all" };
    else if (e.type === "capital_unlock") {
      const lock = locks.get(reversedLock(e) ?? "");
      rule = { kind: "exact", demoAmount: lock ? shareOf(lock.demo, lock.amount, e.amount) : 0 };
    } else if (direction(e.type) < 0) rule = { kind: "demo_first" };
    else rule = { kind: "none" };

    if (isDemoDeposit(e)) hadDemo = true;
    // Replays never use real_only, so they never refuse: history already happened.
    const { demoAmount, next } = applyEntry(r, e.type, e.amount, rule, e.balanceAfter);
    if (e.type === "capital_lock") locks.set(e.utid, { amount: e.amount, demo: demoAmount });
    r = next;
    rows.push({ id: e.id, demoAmount, demoBalanceAfter: r.demo });
  }
  return { rows, final: r, hadDemo };
}
