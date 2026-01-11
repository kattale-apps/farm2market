/**
 * Trader Dashboard Queries (Read-Only)
 * 
 * Read-only queries for traders to view their dashboard.
 * All data is trader-specific - no cross-user data exposure.
 * All calculations done server-side.
 * Anonymity preserved - only aliases shown.
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { calculateTraderExposureInternal, getStorageFeeRate } from "./utils";
import { MAX_TRADER_EXPOSURE_UGX } from "./constants";

/**
 * Get capital ledger vs profit ledger breakdown
 * 
 * Returns detailed breakdown of capital and profit ledgers
 * with all entries grouped by type.
 */
export const getLedgerBreakdown = query({
  args: {
    traderId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a trader
    const user = await ctx.db.get(args.traderId);
    if (!user || user.role !== "trader") {
      throw new Error("User is not a trader");
    }

    // Get all ledger entries for this trader only
    const entries = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q) => q.eq("userId", args.traderId))
      .order("desc")
      .collect();

    // Separate capital and profit entries
    const capitalEntries = entries.filter((e) =>
      e.type === "capital_deposit" ||
      e.type === "capital_lock" ||
      e.type === "capital_unlock"
    );

    const profitEntries = entries.filter((e) =>
      e.type === "profit_credit" ||
      e.type === "profit_withdrawal"
    );

    // Calculate balances
    let capitalBalance = 0;
    let lockedCapital = 0;
    let profitBalance = 0;

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

    return {
      capital: {
        balance: capitalBalance,
        locked: lockedCapital,
        available: capitalBalance - lockedCapital,
        entries: capitalEntries.map((e) => ({
          entryId: e._id,
          utid: e.utid,
          type: e.type,
          amount: e.amount,
          balanceAfter: e.balanceAfter,
          timestamp: e.timestamp,
          metadata: e.metadata,
        })),
        totalEntries: capitalEntries.length,
      },
      profit: {
        balance: profitBalance,
        entries: profitEntries.map((e) => ({
          entryId: e._id,
          utid: e.utid,
          type: e.type,
          amount: e.amount,
          balanceAfter: e.balanceAfter,
          timestamp: e.timestamp,
          metadata: e.metadata,
        })),
        totalEntries: profitEntries.length,
      },
    };
  },
});

/**
 * Get current exposure vs spend cap
 * 
 * Returns detailed exposure breakdown and comparison to cap.
 */
export const getExposureStatus = query({
  args: {
    traderId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a trader
    const user = await ctx.db.get(args.traderId);
    if (!user || user.role !== "trader") {
      throw new Error("User is not a trader");
    }

    // Calculate exposure using canonical function
    const exposure = await calculateTraderExposureInternal(ctx, args.traderId);

    // Calculate percentage of cap used
    const capUsagePercent = (exposure.totalExposure / MAX_TRADER_EXPOSURE_UGX) * 100;

    return {
      exposure: {
        lockedCapital: exposure.lockedCapital,
        lockedOrdersValue: exposure.lockedOrdersValue,
        inventoryValue: exposure.inventoryValue,
        totalExposure: exposure.totalExposure,
      },
      spendCap: {
        maxExposure: MAX_TRADER_EXPOSURE_UGX,
        remainingCapacity: exposure.remainingCapacity,
        usagePercent: Math.round(capUsagePercent * 100) / 100,
        canSpend: exposure.canSpend,
      },
      breakdown: {
        lockedCapitalPercent: exposure.totalExposure > 0
          ? Math.round((exposure.lockedCapital / exposure.totalExposure) * 100 * 100) / 100
          : 0,
        lockedOrdersPercent: exposure.totalExposure > 0
          ? Math.round((exposure.lockedOrdersValue / exposure.totalExposure) * 100 * 100) / 100
          : 0,
        inventoryPercent: exposure.totalExposure > 0
          ? Math.round((exposure.inventoryValue / exposure.totalExposure) * 100 * 100) / 100
          : 0,
      },
    };
  },
});

/**
 * Get active UTIDs with status
 * 
 * Returns all UTIDs associated with this trader's transactions,
 * showing their current status and related entities.
 */
export const getTraderActiveUTIDs = query({
  args: {
    traderId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a trader
    const user = await ctx.db.get(args.traderId);
    if (!user || user.role !== "trader") {
      throw new Error("User is not a trader");
    }

    const utidMap = new Map<string, any>();

    // 1. Wallet ledger UTIDs (trader's own entries only)
    const walletEntries = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q) => q.eq("userId", args.traderId))
      .collect();

    for (const entry of walletEntries) {
      if (!utidMap.has(entry.utid)) {
        // Determine state based on entry type
        let state = "Active";
        if (entry.type === "capital_deposit") {
          state = "Deposit";
        } else if (entry.type === "capital_lock") {
          state = "Capital Locked";
        } else if (entry.type === "capital_unlock") {
          state = "Capital Unlocked";
        } else if (entry.type === "profit_credit") {
          state = "Profit Credit";
        } else if (entry.type === "profit_withdrawal") {
          state = "Profit Withdrawal";
        }
        
        utidMap.set(entry.utid, {
          utid: entry.utid,
          type: entry.type,
          timestamp: entry.timestamp,
          status: "active",
          state: state,
          entities: [],
        });
      }
      const utidData = utidMap.get(entry.utid)!;
      utidData.entities.push({
        table: "walletLedger",
        entryId: entry._id,
        type: entry.type,
        amount: entry.amount,
        balanceAfter: entry.balanceAfter,
        timestamp: entry.timestamp,
      });
    }

    // 2. Unit lock UTIDs (units locked by this trader)
    const lockedUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_status", (q) => q.eq("status", "locked"))
      .collect();

    for (const unit of lockedUnits) {
      if (unit.lockedBy === args.traderId && unit.lockUtid) {
        if (!utidMap.has(unit.lockUtid)) {
          // Determine state: if deliveryStatus is "pending", it's "Locked-In (In Transit)"
          // Once delivered, it becomes inventory (handled separately)
          const deliveryStatus = unit.deliveryStatus || "pending";
          const state = deliveryStatus === "pending" 
            ? "Locked-In (In Transit)" 
            : deliveryStatus === "delivered"
            ? "Delivered (Awaiting Inventory)"
            : deliveryStatus === "late"
            ? "Locked-In (Late Delivery)"
            : "Locked-In (Cancelled)";
          
          utidMap.set(unit.lockUtid, {
            utid: unit.lockUtid,
            type: "unit_lock",
            timestamp: unit.lockedAt || 0,
            status: deliveryStatus,
            state: state,
            entities: [],
          });
        }
        const utidData = utidMap.get(unit.lockUtid)!;
        
        // Get listing info (no farmer identity exposed)
        const listing = await ctx.db.get(unit.listingId);
        const farmer = listing && listing.farmerId ? await ctx.db.get(listing.farmerId) : null;

        utidData.entities.push({
          table: "listingUnits",
          unitId: unit._id,
          unitNumber: unit.unitNumber,
          listingId: unit.listingId,
          produceType: listing?.produceType || null,
          farmerAlias: farmer?.alias || null, // Only alias, no real identity
          status: unit.status,
          deliveryStatus: unit.deliveryStatus,
          deliveryDeadline: unit.deliveryDeadline,
          lockedAt: unit.lockedAt,
        });
      }
    }

    // 3. Trader inventory UTIDs (inventory owned by this trader)
    const inventory = await ctx.db
      .query("traderInventory")
      .withIndex("by_trader", (q) => q.eq("traderId", args.traderId))
      .collect();

    for (const inv of inventory) {
      if (!utidMap.has(inv.utid)) {
        // Determine state based on inventory status
        const state = inv.status === "in_storage"
          ? "Inventory"
          : inv.status === "sold"
          ? "Inventory (Sold)"
          : inv.status === "pending_delivery"
          ? "Inventory (Pending Delivery)"
          : "Inventory (Expired)";
        
        utidMap.set(inv.utid, {
          utid: inv.utid,
          type: "inventory",
          timestamp: inv.acquiredAt,
          status: inv.status,
          state: state,
          entities: [],
        });
      }
      const utidData = utidMap.get(inv.utid)!;
      utidData.entities.push({
        table: "traderInventory",
        inventoryId: inv._id,
        status: inv.status,
        totalKilos: inv.totalKilos,
        produceType: inv.produceType,
        acquiredAt: inv.acquiredAt,
        storageStartTime: inv.storageStartTime,
      });
    }

    // Convert to array and sort by timestamp
    const utids = Array.from(utidMap.values()).sort((a, b) => b.timestamp - a.timestamp);

    return {
      totalUTIDs: utids.length,
      utids: utids,
    };
  },
});

/**
 * Get inventory in storage with projected kilo loss
 * 
 * Returns trader's inventory in storage with projected storage fee
 * deductions based on current storage time.
 */
export const getInventoryWithProjectedLoss = query({
  args: {
    traderId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a trader
    const user = await ctx.db.get(args.traderId);
    if (!user || user.role !== "trader") {
      throw new Error("User is not a trader");
    }

    const now = Date.now();

    // Get trader's inventory in storage
    const inventory = await ctx.db
      .query("traderInventory")
      .withIndex("by_trader", (q) => q.eq("traderId", args.traderId))
      .collect();

    // Filter to in_storage status
    const inStorage = inventory.filter((inv) => inv.status === "in_storage");

    // Calculate projected kilo loss for each inventory block
    const inventoryWithProjection = await Promise.all(
      inStorage.map(async (inv) => {
        // Calculate days in storage
        const daysInStorage = (now - inv.storageStartTime) / (1000 * 60 * 60 * 24);
        const fullDays = Math.floor(daysInStorage);

        // Calculate projected kilo loss (using current rate from system settings)
        // Rate is per 100kg block per day
        const storageFeeRate = await getStorageFeeRate({ db: ctx.db });
        const blocks = inv.totalKilos / 100; // Number of 100kg blocks
        const projectedKilosLost = blocks * storageFeeRate * fullDays;
        const projectedKilosRemaining = Math.max(0, inv.totalKilos - projectedKilosLost);

        // Project future loss (next 7 days)
        const projectedLossNext7Days = blocks * storageFeeRate * 7;
        const projectedKilosAfter7Days = Math.max(0, projectedKilosRemaining - projectedLossNext7Days);

        // Get original listing info (for context, no farmer identity)
        let originalPricePerKilo = 0;
        if (inv.listingUnitIds.length > 0) {
          const firstUnit = await ctx.db.get(inv.listingUnitIds[0]);
          if (firstUnit) {
            const listing = await ctx.db.get(firstUnit.listingId);
            if (listing) {
              originalPricePerKilo = listing.pricePerKilo;
            }
          }
        }

        return {
          inventoryId: inv._id,
          utid: inv.utid,
          produceType: inv.produceType,
          totalKilos: inv.totalKilos,
          originalKilos: inv.totalKilos, // Before any deductions
          storageStartTime: inv.storageStartTime,
          daysInStorage: Math.round(daysInStorage * 100) / 100,
          // Projected losses (server-side calculation)
          projectedKilosLost: Math.round(projectedKilosLost * 100) / 100,
          projectedKilosRemaining: Math.round(projectedKilosRemaining * 100) / 100,
          projectedLossNext7Days: Math.round(projectedLossNext7Days * 100) / 100,
          projectedKilosAfter7Days: Math.round(projectedKilosAfter7Days * 100) / 100,
          // Storage fee rate (for reference)
          storageFeeRate: storageFeeRate,
          // Original price (for context, no farmer identity)
          originalPricePerKilo: originalPricePerKilo,
        };
      })
    );

    // Calculate totals
    const totalOriginalKilos = inventoryWithProjection.reduce((sum, inv) => sum + inv.originalKilos, 0);
    const totalProjectedLoss = inventoryWithProjection.reduce((sum, inv) => sum + inv.projectedKilosLost, 0);
    const totalProjectedRemaining = inventoryWithProjection.reduce((sum, inv) => sum + inv.projectedKilosRemaining, 0);

    // Get current storage fee rate for display
    const storageFeeRate = await getStorageFeeRate({ db: ctx.db });

    return {
      inventory: inventoryWithProjection,
      summary: {
        totalBlocks: inventoryWithProjection.length,
        totalOriginalKilos: Math.round(totalOriginalKilos * 100) / 100,
        totalProjectedLoss: Math.round(totalProjectedLoss * 100) / 100,
        totalProjectedRemaining: Math.round(totalProjectedRemaining * 100) / 100,
        averageDaysInStorage: inventoryWithProjection.length > 0
          ? Math.round(
              (inventoryWithProjection.reduce((sum, inv) => sum + inv.daysInStorage, 0) /
                inventoryWithProjection.length) *
                100
            ) / 100
          : 0,
      },
      storageFeeRate: storageFeeRate, // Current kilo-shaving rate
      currentTime: now,
    };
  },
});

/**
 * Get current storage fee rate (kilo-shaving rate)
 * Returns the current storage fee rate for display in trader dashboard
 */
export const getTraderStorageFeeRate = query({
  args: {
    traderId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a trader
    const user = await ctx.db.get(args.traderId);
    if (!user || user.role !== "trader") {
      throw new Error("User is not a trader");
    }

    const rate = await getStorageFeeRate({ db: ctx.db });
    return { rateKgPerDay: rate };
  },
});
