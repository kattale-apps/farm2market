import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { assertTestMode, ensureTestStorageLocation, ensureTestUsers, resetTestState } from "./testUtils";
import { getUgandaTime } from "./utils";

async function getLatestFarmcoinBalance(
  ctx: any,
  accountType: "central" | "trader",
  traderId?: Id<"users">
): Promise<number> {
  let query = ctx.db
    .query("farmcoinLedger")
    .withIndex("by_account", (q: any) => q.eq("accountType", accountType))
    .order("desc");

  if (accountType === "trader" && traderId) {
    query = query.filter((q: any) => q.eq(q.field("traderId"), traderId));
  }

  const latest = await query.first();
  return latest?.balanceAfter ?? 0;
}

export const runFarmcoinTokenTest = mutation({
  args: {
    mode: v.string(),
    superadminId: v.optional(v.id("users")),
    traderId: v.optional(v.id("users")),
    resetLedger: v.optional(v.boolean()),
    cleanup: v.optional(v.boolean()),
    cleanupOnly: v.optional(v.boolean()),
    resetListings: v.optional(v.boolean()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<any> => {
    assertTestMode(args.mode);

    const apiAny = api as any;
    const internalAny = internal as any;

    const seedResult = await ensureTestUsers(ctx, {
      superadminId: args.superadminId,
      traderId: args.traderId,
    });

    const testUserIds = [seedResult.superadminId, seedResult.traderId];

    if (args.cleanup || args.resetLedger || args.resetListings) {
      const resetResult = await resetTestState(ctx, {
        testUserIds,
        resetLedger: Boolean(args.resetLedger || args.cleanup),
        resetListings: Boolean(args.resetListings || args.cleanup),
        cleanupUsers: Boolean(args.cleanup),
        dryRun: Boolean(args.dryRun),
      });

      if (args.cleanupOnly) {
        return {
          cleaned: true,
          resetResult,
        };
      }
    }

    const now = getUgandaTime();
    const grantAmount = 5;
    const spendAmount = 1;

    const centralBefore = await getLatestFarmcoinBalance(ctx, "central");
    const traderBefore = await getLatestFarmcoinBalance(ctx, "trader", seedResult.traderId);

    const grantResult = await ctx.runMutation(apiAny.farmcoin.grantFarmcoinTokens, {
      adminId: seedResult.superadminId,
      traderId: seedResult.traderId,
      amount: grantAmount,
      reason: "TEST_FARMCOIN_GRANT",
    });

    const traderAfterGrant = await getLatestFarmcoinBalance(ctx, "trader", seedResult.traderId);
    if (traderAfterGrant !== traderBefore + grantAmount) {
      throw new Error("Grant did not increase trader balance correctly.");
    }

    await ctx.runMutation(internalAny.farmcoin.spendFarmcoinTokens, {
      traderId: seedResult.traderId,
      amount: spendAmount,
      source: "posting_cost",
      reason: "TEST_FARMCOIN_SPEND_DIRECT",
    });

    const traderAfterSpend = await getLatestFarmcoinBalance(ctx, "trader", seedResult.traderId);
    const centralAfterSpend = await getLatestFarmcoinBalance(ctx, "central");
    if (traderAfterSpend !== traderAfterGrant - spendAmount) {
      throw new Error("Spend did not reduce trader balance correctly.");
    }
    if (centralAfterSpend !== centralBefore - grantAmount + spendAmount) {
      throw new Error("Central balance did not reconcile after spend.");
    }

    let overspendFailed = false;
    try {
      await ctx.runMutation(internalAny.farmcoin.spendFarmcoinTokens, {
        traderId: seedResult.traderId,
        amount: traderAfterSpend + 999,
        source: "posting_cost",
        reason: "TEST_FARMCOIN_OVERSPEND",
      });
    } catch (error) {
      overspendFailed = true;
    }
    if (!overspendFailed) {
      throw new Error("Overspend test failed to throw.");
    }

    const settings = await ctx.db.query("systemSettings").first();
    const pilotModeWasEnabled = Boolean(settings?.pilotMode);
    if (pilotModeWasEnabled) {
      await ctx.runMutation(apiAny.pilotMode.setPilotMode, {
        adminId: seedResult.superadminId,
        pilotMode: false,
        reason: "TEST_FARMCOIN_DISABLE_PILOT",
      });
    }

    let listingResult: { listingId: Id<"listings">; utid: string; totalUnits: number; unitIds: Id<"listingUnits">[] } | null = null;
    let postingEntry: any = null;

    try {
      const storageLocationId = await ensureTestStorageLocation(ctx, seedResult.superadminId);

      const inventoryResult = await ctx.runMutation(apiAny.listings.createTraderInventoryLot, {
        traderId: seedResult.traderId,
        produceType: `TEST_FARMCOIN_${now}`,
        totalKilos: 100,
        unitPrice: 1000,
        storageLocationId,
        qualityRating: "A",
      });

      listingResult = await ctx.runMutation(apiAny.listings.createTraderListing, {
        traderId: seedResult.traderId,
        inventoryId: inventoryResult.inventoryId,
        pricePerKilo: 1000,
      });

      const traderEntries = await ctx.db
        .query("farmcoinLedger")
        .withIndex("by_trader", (q: any) => q.eq("traderId", seedResult.traderId))
        .order("desc")
        .collect();

      postingEntry = traderEntries.find(
        (entry: any) => entry.source === "posting_cost" && entry.createdAt >= now
      );

      if (!postingEntry) {
        throw new Error("Expected posting_cost ledger entry after listing creation.");
      }
    } finally {
      if (pilotModeWasEnabled) {
        await ctx.runMutation(apiAny.pilotMode.setPilotMode, {
          adminId: seedResult.superadminId,
          pilotMode: true,
          reason: "TEST_FARMCOIN_RESTORE_PILOT",
        });
      }
    }

    return {
      success: true,
      testUsers: seedResult,
      grantResult,
      listingResult,
      balances: {
        centralBefore,
        traderBefore,
        traderAfterGrant,
        traderAfterSpend,
        centralAfterSpend,
      },
      postingEntryFound: Boolean(postingEntry),
    };
  },
});
