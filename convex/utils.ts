/**
 * Utility functions
 * 
 * - UTID generation
 * - Spend cap calculations
 * - Time-based SLA calculations
 */

import { v } from "convex/values";
import { query, DatabaseReader, DatabaseWriter } from "./_generated/server";
import { MAX_TRADER_EXPOSURE_UGX, DEFAULT_STORAGE_FEE_RATE_KG_PER_DAY, DEFAULT_BUYER_SERVICE_FEE_PERCENTAGE } from "./constants";
import { Id } from "./_generated/dataModel";

/**
 * Get current time in Uganda timezone (UTC+3)
 * All database timestamps should use this function to store Uganda time
 * 
 * @returns Timestamp in milliseconds (UTC time + 3 hours)
 */
export function getUgandaTime(): number {
  const ugandaOffset = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
  return Date.now() + ugandaOffset;
}

/**
 * Generate a human-readable UTID (Unique Transaction ID)
 * Format: YYYYMMDD-HHMMSS-ROLE-RANDOM
 * Example: 20240315-143022-trader-a3k9x2
 * Uses Uganda time for date/time components
 */
export function generateUTID(role: string): string {
  const now = getUgandaTime();
  const date = new Date(now);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;
  const timeStr = `${hours}${minutes}${seconds}`;
  const rolePrefix = role;
  const random = Math.random().toString(36).substring(2, 8);
  return `${dateStr}-${timeStr}-${rolePrefix}-${random}`;
}

/**
 * CANONICAL trader exposure calculation function
 * 
 * This is the SINGLE SOURCE OF TRUTH for trader exposure calculations.
 * Used consistently in:
 * - Wallet mutations (spend cap enforcement)
 * - Payment/pay-to-lock mutations (spend cap enforcement BEFORE wallet debit)
 * - Query endpoints (exposure reporting)
 * 
 * Exposure = locked capital + locked orders value + inventory value
 * Must not exceed trader's spend cap (custom or default MAX_TRADER_EXPOSURE_UGX)
 * 
 * @param ctx - Database context (works with both DatabaseReader and DatabaseWriter)
 * @param traderId - The trader's user ID
 * @returns Exposure breakdown and spend capacity information
 */
export async function calculateTraderExposureInternal(
  ctx: { db: DatabaseReader | DatabaseWriter },
  traderId: string
) {
  // Get trader to check for custom spend cap
  const trader = await ctx.db.get(traderId as Id<"users">);
  if (!trader || !["trader", "transporter"].includes(trader.role)) {
    return {
      totalExposure: 0,
      lockedCapital: 0,
      lockedOrdersValue: 0,
      inventoryValue: 0,
    };
  }
  const spendCap = trader.customSpendCap || MAX_TRADER_EXPOSURE_UGX;

  // Get locked capital from wallet ledger
  const capitalEntries = await ctx.db
    .query("walletLedger")
    .withIndex("by_user", (q: any) => q.eq("userId", traderId))
    .collect();

  let lockedCapital = 0;

  for (const entry of capitalEntries) {
    if (entry.type === "capital_lock") {
      lockedCapital += entry.amount;
    } else if (entry.type === "capital_unlock") {
      lockedCapital -= entry.amount;
    }
  }

  // Get value of locked orders (pending payments)
  const lockedUnits = await ctx.db
    .query("listingUnits")
    .withIndex("by_status", (q: any) => q.eq("status", "locked"))
    .collect();

  let lockedOrdersValue = 0;
  for (const unit of lockedUnits) {
    if (unit.lockedBy === traderId) {
      const listing = await ctx.db.get(unit.listingId);
      if (listing) {
        // Use listing's unitSize (which may be less than 10kg for small listings)
        const unitSize = listing.unitSize || 10;
        lockedOrdersValue += listing.pricePerKilo * unitSize;
      }
    }
  }

  // Get inventory value
  const inventory = await ctx.db
    .query("traderInventory")
    .withIndex("by_trader", (q: any) => q.eq("traderId", traderId))
    .collect();

  let inventoryValue = 0;
  for (const inv of inventory) {
    if (inv.status === "in_storage" && inv.listingUnitIds.length > 0) {
      const firstUnit = await ctx.db.get(inv.listingUnitIds[0]);
      if (firstUnit) {
        const listing = await ctx.db.get(firstUnit.listingId);
        if (listing) {
          inventoryValue += listing.pricePerKilo * inv.totalKilos;
        }
      }
    }
  }

  const totalExposure = lockedCapital + lockedOrdersValue + inventoryValue;

  return {
    lockedCapital,
    lockedOrdersValue,
    inventoryValue,
    totalExposure,
    spendCap,
    canSpend: totalExposure < spendCap,
    remainingCapacity: Math.max(0, spendCap - totalExposure),
  };
}

/**
 * Calculate trader exposure (public query endpoint)
 * 
 * Wrapper around calculateTraderExposureInternal for client access.
 * The canonical calculation logic is in calculateTraderExposureInternal.
 */
export const calculateTraderExposure = query({
  args: { traderId: v.id("users") },
  handler: async (ctx, args) => {
    return await calculateTraderExposureInternal(ctx, args.traderId);
  },
});

/**
 * Calculate delivery SLA timestamp (6 hours after payment)
 */
export function calculateDeliverySLA(paymentTimestamp: number): number {
  return paymentTimestamp + 6 * 60 * 60 * 1000; // 6 hours in milliseconds
}

/**
 * Calculate pickup SLA timestamp (48 hours after purchase)
 */
export function calculatePickupSLA(purchaseTimestamp: number): number {
  return purchaseTimestamp + 48 * 60 * 60 * 1000; // 48 hours in milliseconds
}

/**
 * Get storage fee rate from system settings
 * Returns the current storage fee rate from system settings, or default if not set
 * 
 * @param ctx - Database context (works with both DatabaseReader and DatabaseWriter)
 * @returns Storage fee rate in kilos per day per 100kg block
 */
export async function getStorageFeeRate(
  ctx: { db: DatabaseReader | DatabaseWriter }
): Promise<number> {
  const settings = await ctx.db.query("systemSettings").first();
  return settings?.storageFeeRateKgPerDay ?? DEFAULT_STORAGE_FEE_RATE_KG_PER_DAY;
}

/**
 * Get buyer service fee percentage
 * Returns the current service fee percentage for buyer purchases
 * @param ctx - Database context
 * @returns Service fee percentage (e.g., 3 for 3%)
 */
export async function getBuyerServiceFeePercentage(
  ctx: { db: DatabaseReader | DatabaseWriter }
): Promise<number> {
  const settings = await ctx.db.query("systemSettings").first();
  return settings?.buyerServiceFeePercentage ?? DEFAULT_BUYER_SERVICE_FEE_PERCENTAGE;
}

/**
 * Get trader commission percentage
 * Returns the current commission percentage for trader sales
 * @param ctx - Database context
 * @returns Commission percentage (e.g., 2 for 2%)
 */
export async function getTraderCommissionPercentage(
  ctx: { db: DatabaseReader | DatabaseWriter }
): Promise<number> {
  const settings = await ctx.db.query("systemSettings").first();
  return settings?.traderCommissionPercentage ?? 0; // Default: 0% (no commission)
}

/**
 * Calculate price per kilo from inventory
 * Gets the average price per kilo from the listing units that make up the inventory
 * @param ctx - Database context
 * @param inventoryId - The inventory ID
 * @returns Price per kilo in UGX
 */
export async function calculateInventoryPricePerKilo(
  ctx: { db: DatabaseReader | DatabaseWriter },
  inventoryId: Id<"traderInventory">
): Promise<number> {
  const inventory = await ctx.db.get(inventoryId);
  if (!inventory || !inventory.listingUnitIds || inventory.listingUnitIds.length === 0) {
    // Backward compatibility: allow manual inventory lots without listing units.
    return inventory?.unitPrice ?? 0;
  }

  // Get all listing units and their prices
  let totalPrice = 0;
  let totalKilos = 0;

  for (const unitId of inventory.listingUnitIds) {
    const unit = await ctx.db.get(unitId);
    if (unit) {
      const listing = await ctx.db.get(unit.listingId);
      if (listing) {
        const unitSize = listing.unitSize || 10; // Default to 10kg if not set
        const unitPrice = listing.pricePerKilo * unitSize;
        totalPrice += unitPrice;
        totalKilos += unitSize;
      }
    }
  }

  if (totalKilos === 0) {
    return 0;
  }

  // Return average price per kilo
  return totalPrice / totalKilos;
}
