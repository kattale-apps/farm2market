/**
 * Admin Finance Dashboard
 * 
 * Shows commission earnings aggregated by UTID, per-day, per-month
 * SuperAdmin only - no trader identities exposed
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { verifyAdminRole } from "./auth";

/**
 * Check if admin is SuperAdmin
 */
function isSuperAdmin(user: { adminLevel?: "super" | "junior" }): boolean {
  return user.adminLevel === "super" || user.adminLevel === undefined;
}

/**
 * Get commission earnings summary
 * Aggregates all trader commission deductions
 */
export const getCommissionEarnings = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    // Verify admin role
    const adminCheck = await verifyAdminRole({
      userId: args.adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can access commission earnings");
    }

    const adminUser = await ctx.db.get(args.adminId);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("User is not an admin");
    }

    // Only SuperAdmin can view commission earnings
    if (!isSuperAdmin(adminUser)) {
      throw new Error("Only SuperAdmin can view commission earnings");
    }

    // Get all commission deductions
    const allLedgerEntries = await ctx.db.query("walletLedger").collect();
    const commissionEntries = allLedgerEntries.filter(
      (e) => e.type === "trader_commission_deduction"
    );

    // Aggregate by UTID (main transaction UTID)
    const byUtid = new Map<string, { utid: string; commission: number; timestamp: number }>();
    const byDay = new Map<string, number>(); // YYYY-MM-DD -> total commission
    const byMonth = new Map<string, number>(); // YYYY-MM -> total commission

    let totalCommission = 0;

    for (const entry of commissionEntries) {
      const mainUtid = entry.metadata?.mainUtid as string | undefined;
      const utid = mainUtid || entry.utid;

      // Aggregate by UTID
      if (!byUtid.has(utid)) {
        byUtid.set(utid, { utid, commission: 0, timestamp: entry.timestamp });
      }
      const utidEntry = byUtid.get(utid)!;
      utidEntry.commission += entry.amount;

      // Aggregate by day
      const date = new Date(entry.timestamp);
      const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      byDay.set(dayKey, (byDay.get(dayKey) || 0) + entry.amount);

      // Aggregate by month
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      byMonth.set(monthKey, (byMonth.get(monthKey) || 0) + entry.amount);

      totalCommission += entry.amount;
    }

    // Convert maps to arrays
    const byUtidArray = Array.from(byUtid.values()).sort((a, b) => b.timestamp - a.timestamp);
    const byDayArray = Array.from(byDay.entries())
      .map(([day, commission]) => ({ day, commission }))
      .sort((a, b) => b.day.localeCompare(a.day));
    const byMonthArray = Array.from(byMonth.entries())
      .map(([month, commission]) => ({ month, commission }))
      .sort((a, b) => b.month.localeCompare(a.month));

    return {
      totalCommission,
      byUtid: byUtidArray,
      byDay: byDayArray,
      byMonth: byMonthArray,
      totalTransactions: byUtidArray.length,
    };
  },
});
