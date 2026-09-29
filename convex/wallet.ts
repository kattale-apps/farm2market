/**
 * Wallet System (Closed-Loop)
 * 
 * - Internal ledger only (not a bank)
 * - Capital and profit ledgers
 * - No balance overwrites
 * - All entries reference UTIDs
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { generateUTID, calculateTraderExposureInternal, getUgandaTime } from "./utils";
import { MAX_TRADER_EXPOSURE_UGX } from "./constants";
import { checkPilotMode } from "./pilotMode";
import { MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { hasDemoWallet, postWallet } from "./walletSplit";

/**
 * Get wallet balance (trader only)
 */
export const getWalletBalance = query({
  args: { traderId: v.id("users") },
  handler: async (ctx, args) => {
    // Verify user is a trader
    const user = await ctx.db.get(args.traderId);
    if (!user || !["trader", "transporter"].includes(user.role)) {
      throw new Error("User is not a trader");
    }

    // Get all ledger entries
    const entries = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", args.traderId))
      .order("desc")
      .collect();

    let capitalBalance = 0;
    let profitBalance = 0;
    let lockedCapital = 0;

    for (const entry of entries) {
      if (entry.type === "capital_deposit") {
        capitalBalance += entry.amount;
      } else if (entry.type === "capital_lock") {
        capitalBalance -= entry.amount;
        lockedCapital += entry.amount;
      } else if (entry.type === "capital_unlock") {
        capitalBalance += entry.amount;
        lockedCapital -= entry.amount;
      } else if (entry.type === "profit_credit") {
        profitBalance += entry.amount;
      } else if (entry.type === "profit_withdrawal") {
        profitBalance -= entry.amount;
      }
    }

    // Calculate exposure
    const exposure = await calculateTraderExposureInternal(ctx, args.traderId);

    return {
      capitalBalance,
      profitBalance,
      lockedCapital,
      availableCapital: capitalBalance - lockedCapital,
      exposure: exposure.totalExposure,
      spendCap: MAX_TRADER_EXPOSURE_UGX,
      remainingCapacity: exposure.remainingCapacity,
    };
  },
});

/**
 * Ensure trader has minimum capital (1,000,000 UGX)
 * Called automatically to ensure traders always have demo capital
 * Exported for use in payments.ts
 *
 * Only accounts that already hold demo money are topped up; real-money
 * accounts never receive demo funds (convex/walletSplit.ts).
 */
export async function ensureTraderCapital(
  ctx: any,
  traderId: string
): Promise<{ restored: boolean; utid?: string }> {
  if (!(await hasDemoWallet(ctx as MutationCtx, traderId as Id<"users">))) {
    return { restored: false };
  }

  // Get current balance
  const entries = await ctx.db
    .query("walletLedger")
    .withIndex("by_user", (q: any) => q.eq("userId", traderId))
    .order("desc")
    .collect();

  let capitalBalance = 0;
  let lockedCapital = 0;

  for (const entry of entries) {
    if (entry.type === "capital_deposit") {
      capitalBalance += entry.amount;
    } else if (entry.type === "capital_lock") {
      capitalBalance -= entry.amount;
      lockedCapital += entry.amount;
    } else if (entry.type === "capital_unlock") {
      capitalBalance += entry.amount;
      lockedCapital -= entry.amount;
    }
  }

  const availableCapital = capitalBalance - lockedCapital;

  // If trader doesn't have 1,000,000 UGX available, restore it
  if (availableCapital < MAX_TRADER_EXPOSURE_UGX) {
    const needed = MAX_TRADER_EXPOSURE_UGX - availableCapital;

    const utid = generateUTID("admin");
    await postWallet(ctx as MutationCtx, {
      userId: traderId as Id<"users">,
      utid,
      type: "capital_deposit",
      amount: needed,
      rule: { kind: "all" },
      metadata: {
        source: "auto_restore_demo_capital",
        reason: "Ensuring trader has 1,000,000 UGX for demo purchases",
        restored: true,
      },
    });

    return { restored: true, utid };
  }

  return { restored: false };
}

/**
 * Retired. depositCapital added any amount to a trader's wallet without a
 * payment; withdrawProfit recorded a withdrawal that paid nobody. Deposits
 * now come through Pesapal and withdrawals through the Wallet cash-out
 * (convex/farmcoinExchange.ts). Kept so older app builds get a clear message.
 */
export const depositCapital = mutation({
  args: {
    traderId: v.id("users"),
    amount: v.number(), // In UGX
  },
  handler: async () => {
    throw new Error("Deposits are made with mobile money through Pesapal from your Wallet.");
  },
});

export const withdrawProfit = mutation({
  args: {
    traderId: v.id("users"),
    amount: v.number(), // In UGX
  },
  handler: async () => {
    throw new Error("Withdrawals are made with Sentify cash-out from your Wallet.");
  },
});

/**
 * Get ledger breakdown (trader only)
 * Returns capital vs profit breakdown
 */
export const getLedgerBreakdown = query({
  args: { traderId: v.id("users") },
  handler: async (ctx, args) => {
    // Verify user is a trader
    const user = await ctx.db.get(args.traderId);
    if (!user || !["trader", "transporter"].includes(user.role)) {
      throw new Error("User is not a trader");
    }

    const entries = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q: any) => q.eq("userId", args.traderId))
      .order("desc")
      .collect();

    const capital = {
      balance: 0,
      locked: 0,
      available: 0,
      entries: [] as any[],
      totalEntries: 0,
    };

    const profit = {
      balance: 0,
      entries: [] as any[],
      totalEntries: 0,
    };

    let runningBalance = 0;

    for (const entry of entries) {
      if (
        entry.type === "capital_deposit" ||
        entry.type === "capital_lock" ||
        entry.type === "capital_unlock" ||
        entry.type === "incoming_purchase"
      ) {
        if (entry.type === "capital_deposit") {
          capital.balance += entry.amount;
        } else if (entry.type === "capital_lock") {
          capital.balance -= entry.amount;
          capital.locked += entry.amount;
        } else if (entry.type === "capital_unlock") {
          capital.balance += entry.amount;
          capital.locked -= entry.amount;
        }
        // incoming_purchase doesn't affect balance - it's just a record of pending purchase

        capital.entries.push({
          entryId: entry._id,
          utid: entry.utid,
          type: entry.type,
          amount: entry.amount,
          balanceAfter: entry.balanceAfter,
          timestamp: entry.timestamp,
          metadata: entry.metadata,
        });
        capital.totalEntries++;
      } else if (
        entry.type === "profit_credit" ||
        entry.type === "profit_withdrawal"
      ) {
        if (entry.type === "profit_credit") {
          profit.balance += entry.amount;
        } else {
          profit.balance -= entry.amount;
        }

        profit.entries.push({
          entryId: entry._id,
          utid: entry.utid,
          type: entry.type,
          amount: entry.amount,
          balanceAfter: entry.balanceAfter,
          timestamp: entry.timestamp,
          metadata: entry.metadata,
        });
        profit.totalEntries++;
      }

      runningBalance = entry.balanceAfter;
    }

    capital.available = capital.balance - capital.locked;

    return {
      capital,
      profit,
      totalBalance: runningBalance,
    };
  },
});
