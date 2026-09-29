/**
 * Writing wallet ledger entries with their demo/real split, and the one-off
 * migration that splits existing history. Rules live in walletSplitShared.ts.
 *
 * Every insert into walletLedger goes through postWallet(), so each entry
 * records `demoAmount` and `demoBalanceAfter` alongside `balanceAfter`.
 */

import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import {
  EMPTY_RUNNING,
  applyEntry,
  isDemoDeposit,
  realOf,
  replayHistory,
  shareOf,
  type DemoRule,
  type HistoryEntry,
  type Running,
} from "./walletSplitShared";

type Ctx = QueryCtx | MutationCtx;
type LedgerType = Doc<"walletLedger">["type"];

function toHistory(e: Doc<"walletLedger">): HistoryEntry {
  return {
    id: e._id,
    utid: e.utid,
    type: e.type,
    amount: e.amount,
    balanceAfter: e.balanceAfter,
    demoAmount: e.demoAmount,
    demoBalanceAfter: e.demoBalanceAfter,
    metadata: e.metadata,
  };
}

async function history(ctx: Ctx, userId: Id<"users">): Promise<Doc<"walletLedger">[]> {
  const entries: Doc<"walletLedger">[] = [];
  for await (const e of ctx.db.query("walletLedger").withIndex("by_user", (q) => q.eq("userId", userId))) {
    entries.push(e);
  }
  return entries;
}

/** An account's running total and demo balance right now. */
export async function currentRunning(ctx: Ctx, userId: Id<"users">): Promise<Running> {
  const latest = await ctx.db
    .query("walletLedger")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .first();
  if (!latest) return EMPTY_RUNNING;
  if (latest.demoBalanceAfter !== undefined) return { balance: latest.balanceAfter, demo: latest.demoBalanceAfter };
  // Not migrated yet: rebuild the split from the account's history.
  return replayHistory((await history(ctx, userId)).map(toHistory)).final;
}

export async function realBalance(ctx: Ctx, userId: Id<"users">): Promise<number> {
  return realOf(await currentRunning(ctx, userId));
}

/** Inserts one wallet ledger entry with its demo split. Throws NotEnoughRealMoney for a real-only debit that cannot be covered. */
export async function postWallet(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    utid: string;
    type: LedgerType;
    amount: number;
    rule: DemoRule;
    metadata?: Record<string, unknown>;
    timestamp?: number;
  }
) {
  const running = await currentRunning(ctx, args.userId);
  const { demoAmount, next } = applyEntry(running, args.type, args.amount, args.rule);
  await ctx.db.insert("walletLedger", {
    userId: args.userId,
    utid: args.utid,
    type: args.type,
    amount: args.amount,
    balanceAfter: next.balance,
    demoAmount,
    demoBalanceAfter: next.demo,
    timestamp: args.timestamp ?? getUgandaTime(),
    metadata: args.metadata,
  });
  return { demoAmount, balanceAfter: next.balance, demoBalanceAfter: next.demo, realBalanceAfter: realOf(next) };
}

/** The capital_lock entry written under `lockUtid`, if any. */
export async function findLock(ctx: Ctx, lockUtid: string | undefined): Promise<Doc<"walletLedger"> | null> {
  if (!lockUtid) return null;
  const rows = await ctx.db
    .query("walletLedger")
    .withIndex("by_utid", (q) => q.eq("utid", lockUtid))
    .take(10);
  return rows.find((r) => r.type === "capital_lock") ?? null;
}

/** Demo share of `part` of the lock written under `lockUtid`. Unsplit legacy locks count as real. */
export async function lockDemoShare(ctx: Ctx, lockUtid: string | undefined, part: number): Promise<number> {
  const lock = await findLock(ctx, lockUtid);
  if (!lock) return 0;
  return shareOf(lock.demoAmount ?? 0, lock.amount, part);
}

/**
 * Whether the account holds demo money and may keep receiving it. Accounts
 * without demo money never get any (the user's decision). The flag is set by
 * the migration; until then it is worked out from the ledger once.
 */
export async function hasDemoWallet(ctx: MutationCtx, userId: Id<"users">): Promise<boolean> {
  const user = await ctx.db.get(userId);
  if (!user) return false;
  if (typeof user.demoWallet === "boolean") return user.demoWallet;
  let found = false;
  for await (const e of ctx.db.query("walletLedger").withIndex("by_user", (q) => q.eq("userId", userId))) {
    if (isDemoDeposit(e)) {
      found = true;
      break;
    }
  }
  await ctx.db.patch(userId, { demoWallet: found });
  return found;
}

/**
 * How many accounts hold real money, and how many cash-outs are still
 * waiting. Used to stop destructive admin resets from wiping real money.
 */
export async function realMoneyAtRisk(ctx: Ctx): Promise<{ accounts: number; pendingCashouts: number }> {
  const byUser = new Map<string, HistoryEntry[]>();
  for await (const e of ctx.db.query("walletLedger")) {
    const list = byUser.get(e.userId) ?? [];
    list.push(toHistory(e));
    byUser.set(e.userId, list);
  }
  let accounts = 0;
  for (const entries of byUser.values()) {
    if (realOf(replayHistory(entries).final) > 0) accounts++;
  }
  const pending = await ctx.db
    .query("walletCashouts")
    .withIndex("by_status_and_requestedAt", (q) => q.eq("status", "pending"))
    .take(1000);
  return { accounts, pendingCashouts: pending.length };
}

// ------------------------------------------------------------------
// One-off migration: split existing history into demo and real.
// Run with: npx convex run walletSplit:migrateWalletSplit '{}'
// Safe to re-run; entries written by postWallet keep their split.
// ------------------------------------------------------------------

export const migrateWalletSplit = internalMutation({
  args: { paginationOpts: v.optional(paginationOptsValidator) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("users").paginate(args.paginationOpts ?? { numItems: 25, cursor: null });
    let entriesPatched = 0;
    for (const user of page.page) {
      const entries = await history(ctx, user._id);
      const { rows, hadDemo } = replayHistory(entries.map(toHistory));
      for (let i = 0; i < rows.length; i++) {
        const e = entries[i];
        const row = rows[i];
        if (e.demoAmount !== row.demoAmount || e.demoBalanceAfter !== row.demoBalanceAfter) {
          await ctx.db.patch(e._id, { demoAmount: row.demoAmount, demoBalanceAfter: row.demoBalanceAfter });
          entriesPatched++;
        }
      }
      if (user.demoWallet !== hadDemo) await ctx.db.patch(user._id, { demoWallet: hadDemo });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.walletSplit.migrateWalletSplit, {
        paginationOpts: { numItems: 25, cursor: page.continueCursor },
      });
    }
    console.log(`walletSplit migration: ${page.page.length} users, ${entriesPatched} entries patched, done=${page.isDone}`);
    return { users: page.page.length, entriesPatched, isDone: page.isDone };
  },
});
