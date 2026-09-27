/**
 * Demo Data Seeding (Pilot Mode Only)
 * 
 * This mutation seeds the system with demo data for testing:
 * - Creates farmer listings
 * - Deposits capital into trader wallets (1,000,000 UGX max)
 * - Deposits capital into buyer wallets (2,000,000 UGX)
 * 
 * ⚠️ PILOT ONLY - This should be disabled in production
 */

import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { generateUTID, getUgandaTime } from "./utils";
import { MAX_TRADER_EXPOSURE_UGX } from "./constants";
import { Id } from "./_generated/dataModel";

/**
 * Seed demo data for pilot testing
 * 
 * Creates:
 * - 2-3 farmer listings (different produce types)
 * - Deposits 1,000,000 UGX into each trader wallet
 * - Deposits 2,000,000 UGX into each buyer wallet
 */
export const seedDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    const results = {
      listings: [] as any[],
      traderDeposits: [] as any[],
      buyerDeposits: [] as any[],
      errors: [] as string[],
    };

    try {
      // Get all users - ONLY test accounts (pilot.farm2market domain)
      const allUsers = await ctx.db.query("users").collect();
      const testUsers = allUsers.filter((u) => u.email?.endsWith("@pilot.farm2market"));
      
      if (testUsers.length === 0) {
        return {
          success: false,
          error: "No test accounts found. Seed demo data only works with test accounts (pilot.farm2market domain).",
          summary: {
            listingsCreated: 0,
            traderDeposits: 0,
            buyerDeposits: 0,
            errors: 1,
          },
          details: results,
        };
      }

      const farmers = testUsers.filter((u) => u.role === "farmer");
      const traders = testUsers.filter((u) => u.role === "trader");
      const buyers = testUsers.filter((u) => u.role === "buyer");

      // ============================================================
      // 1. CREATE FARMER LISTINGS
      // ============================================================
      const produceTypes = [
        { type: "Maize", pricePerKilo: 2000, totalKilos: 100 },
        { type: "Beans", pricePerKilo: 3000, totalKilos: 80 },
        { type: "Rice", pricePerKilo: 4000, totalKilos: 120 },
      ];

      for (let i = 0; i < Math.min(farmers.length, produceTypes.length); i++) {
        const farmer = farmers[i];
        const produce = produceTypes[i];

        try {
          // Generate UTID
          const utid = generateUTID(farmer.role);

          // Calculate units (10kg each)
          const totalUnits = Math.floor(produce.totalKilos / 10);

          // Create listing
          const listingId = await ctx.db.insert("listings", {
            farmerId: farmer._id,
            utid,
            produceType: produce.type,
            totalKilos: produce.totalKilos,
            pricePerKilo: produce.pricePerKilo,
            unitSize: 10,
            totalUnits,
            status: "active",
            createdAt: getUgandaTime(),
            deliverySLA: 0,
          });

          // Create individual units
          const unitIds = [];
          for (let j = 1; j <= totalUnits; j++) {
            const unitId = await ctx.db.insert("listingUnits", {
              listingId,
              unitNumber: j,
              status: "available",
            });
            unitIds.push(unitId);
          }

          results.listings.push({
            listingId,
            utid,
            farmerAlias: farmer.alias,
            produceType: produce.type,
            totalKilos: produce.totalKilos,
            pricePerKilo: produce.pricePerKilo,
            totalUnits,
          });
        } catch (error: any) {
          results.errors.push(`Failed to create listing for ${farmer.alias}: ${error.message}`);
        }
      }

      // ============================================================
      // 2. DEPOSIT CAPITAL INTO TRADER WALLETS (1,000,000 UGX)
      // ============================================================
      for (const trader of traders) {
        try {
          // Generate UTID
          const utid = generateUTID(trader.role);

          // Get current balance
          const currentEntries = await ctx.db
            .query("walletLedger")
            .withIndex("by_user", (q) => q.eq("userId", trader._id))
            .order("desc")
            .first();

          const currentBalance = currentEntries?.balanceAfter || 0;
          const depositAmount = MAX_TRADER_EXPOSURE_UGX; // 1,000,000 UGX
          const balanceAfter = currentBalance + depositAmount;

          // Create ledger entry
          await ctx.db.insert("walletLedger", {
            userId: trader._id,
            utid,
            type: "capital_deposit",
            amount: depositAmount,
            balanceAfter,
            timestamp: getUgandaTime(),
            metadata: { source: "demo_seed", pilot: true },
          });

          results.traderDeposits.push({
            traderId: trader._id,
            traderAlias: trader.alias,
            utid,
            amount: depositAmount,
            balanceAfter,
          });
        } catch (error: any) {
          results.errors.push(`Failed to deposit for trader ${trader.alias}: ${error.message}`);
        }
      }

      // ============================================================
      // 3. DEPOSIT CAPITAL INTO BUYER WALLETS (2,000,000 UGX)
      // ============================================================
      // Note: Buyers may not have a wallet system in the schema
      // If they do, we'll deposit. If not, we'll skip with a note.
      for (const buyer of buyers) {
        try {
          // Generate UTID
          const utid = generateUTID(buyer.role);

          // Get current balance (if wallet exists)
          const currentEntries = await ctx.db
            .query("walletLedger")
            .withIndex("by_user", (q) => q.eq("userId", buyer._id))
            .order("desc")
            .first();

          const currentBalance = currentEntries?.balanceAfter || 0;
          const depositAmount = 2_000_000; // 2,000,000 UGX
          const balanceAfter = currentBalance + depositAmount;

          // Create ledger entry (buyers might use same wallet system)
          await ctx.db.insert("walletLedger", {
            userId: buyer._id,
            utid,
            type: "capital_deposit",
            amount: depositAmount,
            balanceAfter,
            timestamp: getUgandaTime(),
            metadata: { source: "demo_seed", pilot: true, role: "buyer" },
          });

          results.buyerDeposits.push({
            buyerId: buyer._id,
            buyerAlias: buyer.alias,
            utid,
            amount: depositAmount,
            balanceAfter,
          });
        } catch (error: any) {
          results.errors.push(`Failed to deposit for buyer ${buyer.alias}: ${error.message}`);
        }
      }

      return {
        success: true,
        summary: {
          listingsCreated: results.listings.length,
          traderDeposits: results.traderDeposits.length,
          buyerDeposits: results.buyerDeposits.length,
          errors: results.errors.length,
        },
        details: results,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        summary: {
          listingsCreated: results.listings.length,
          traderDeposits: results.traderDeposits.length,
          buyerDeposits: results.buyerDeposits.length,
          errors: results.errors.length + 1,
        },
        details: results,
      };
    }
  },
});
