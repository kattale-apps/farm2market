import { DatabaseReader, DatabaseWriter } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { generateUTID, getUgandaTime } from "./utils";

export type TestMode = "dev" | "test";

export type TestUserSeedResult = {
  superadminId: Id<"users">;
  traderId: Id<"users">;
  created: {
    superadmin: boolean;
    trader: boolean;
  };
};

const TEST_SUPERADMIN_EMAIL = "superadmin_test@local";
const TEST_TRADER_EMAIL = "trader_test@local";
const TEST_STORAGE_CODE = "TEST_FARMCOIN";

export function assertTestMode(mode: string | undefined) {
  const deployment = process.env.CONVEX_DEPLOYMENT;
  if (deployment && deployment.startsWith("prod:")) {
    throw new Error("Test utilities cannot run in production.");
  }
  if (mode !== "dev" && mode !== "test") {
    throw new Error("Test utilities require mode=dev or mode=test.");
  }
}

async function findUserByEmail(ctx: { db: DatabaseReader }, email: string) {
  return ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
}

async function getUser(ctx: { db: DatabaseReader }, userId: Id<"users">) {
  return ctx.db.get(userId);
}

export async function ensureTestUsers(
  ctx: { db: DatabaseWriter },
  overrides?: { superadminId?: Id<"users">; traderId?: Id<"users"> }
): Promise<TestUserSeedResult> {
  const now = getUgandaTime();
  let createdSuperadmin = false;
  let createdTrader = false;

  let superadminId = overrides?.superadminId;
  let traderId = overrides?.traderId;

  if (superadminId) {
    const user = await getUser(ctx, superadminId);
    if (!user || user.role !== "admin" || !user.isTestUser) {
      throw new Error("Override superadmin must be a test admin user.");
    }
  } else {
    const existing = await findUserByEmail(ctx, TEST_SUPERADMIN_EMAIL);
    if (existing) {
      superadminId = existing._id;
    } else {
      superadminId = await ctx.db.insert("users", {
        email: TEST_SUPERADMIN_EMAIL,
        role: "admin",
        alias: "Test Superadmin",
        state: "active",
        createdAt: now,
        lastActiveAt: now,
        adminLevel: "super",
        isTestUser: true,
      });
      createdSuperadmin = true;
    }
  }

  if (traderId) {
    const user = await getUser(ctx, traderId);
    if (!user || user.role !== "trader" || !user.isTestUser) {
      throw new Error("Override trader must be a test trader user.");
    }
  } else {
    const existing = await findUserByEmail(ctx, TEST_TRADER_EMAIL);
    if (existing) {
      traderId = existing._id;
    } else {
      traderId = await ctx.db.insert("users", {
        email: TEST_TRADER_EMAIL,
        role: "trader",
        alias: "Test Trader",
        state: "active",
        createdAt: now,
        lastActiveAt: now,
        isVerifiedTrader: true,
        verificationStatus: "verified",
        isTestUser: true,
      });
      createdTrader = true;
    }
  }

  return {
    superadminId: superadminId as Id<"users">,
    traderId: traderId as Id<"users">,
    created: { superadmin: createdSuperadmin, trader: createdTrader },
  };
}

export async function ensureTestStorageLocation(
  ctx: { db: DatabaseWriter },
  adminId: Id<"users">
): Promise<Id<"storageLocations">> {
  const existing = await ctx.db
    .query("storageLocations")
    .withIndex("by_code", (q) => q.eq("code", TEST_STORAGE_CODE))
    .first();

  if (existing) {
    return existing._id;
  }

  const now = getUgandaTime();
  return ctx.db.insert("storageLocations", {
    districtName: "Test District",
    code: TEST_STORAGE_CODE,
    active: true,
    order: 9999,
    createdAt: now,
    createdBy: adminId,
    utid: generateUTID("admin"),
  });
}

export type ResetTestStateOptions = {
  testUserIds: Id<"users">[];
  resetLedger?: boolean;
  resetListings?: boolean;
  cleanupUsers?: boolean;
  dryRun?: boolean;
};

export type ResetTestStateResult = {
  ledgerDeleted: number;
  listingsDeleted: number;
  listingUnitsDeleted: number;
  inventoriesDeleted: number;
  storageLocationsDeleted: number;
  usersDeleted: number;
  utidsDeleted: number;
};

export async function resetTestState(
  ctx: { db: DatabaseWriter },
  options: ResetTestStateOptions
): Promise<ResetTestStateResult> {
  const result: ResetTestStateResult = {
    ledgerDeleted: 0,
    listingsDeleted: 0,
    listingUnitsDeleted: 0,
    inventoriesDeleted: 0,
    storageLocationsDeleted: 0,
    usersDeleted: 0,
    utidsDeleted: 0,
  };

  const { testUserIds, resetLedger, resetListings, cleanupUsers, dryRun } = options;

  const ledgerEntries = await ctx.db.query("farmcoinLedger").collect();
  const traderLedgerEntries = ledgerEntries.filter(
    (entry: any) => entry.traderId && testUserIds.includes(entry.traderId)
  );
  const utidsToDelete = new Set(traderLedgerEntries.map((entry: any) => entry.utid));

  if (resetLedger) {
    for (const entry of ledgerEntries) {
      if (utidsToDelete.has(entry.utid)) {
        result.ledgerDeleted += 1;
        if (!dryRun) {
          await ctx.db.delete(entry._id);
        }
      }
    }
    result.utidsDeleted = utidsToDelete.size;
  }

  if (resetListings) {
    const inventories = await ctx.db
      .query("traderInventory")
      .collect();
    const inventoryIds = inventories
      .filter((inv: any) => testUserIds.includes(inv.traderId))
      .map((inv: any) => inv._id);

    for (const inventoryId of inventoryIds) {
      result.inventoriesDeleted += 1;
      if (!dryRun) {
        await ctx.db.delete(inventoryId);
      }
    }

    const listings = await ctx.db
      .query("listings")
      .collect();
    const listingIds = listings
      .filter((listing: any) => listing.traderId && testUserIds.includes(listing.traderId))
      .map((listing: any) => listing._id);

    const listingUnits = await ctx.db.query("listingUnits").collect();
    for (const unit of listingUnits) {
      if (listingIds.includes(unit.listingId)) {
        result.listingUnitsDeleted += 1;
        if (!dryRun) {
          await ctx.db.delete(unit._id);
        }
      }
    }

    for (const listingId of listingIds) {
      result.listingsDeleted += 1;
      if (!dryRun) {
        await ctx.db.delete(listingId);
      }
    }

    const storageLocations = await ctx.db
      .query("storageLocations")
      .withIndex("by_code", (q) => q.eq("code", TEST_STORAGE_CODE))
      .collect();

    for (const location of storageLocations) {
      if (testUserIds.includes(location.createdBy)) {
        result.storageLocationsDeleted += 1;
        if (!dryRun) {
          await ctx.db.delete(location._id);
        }
      }
    }
  }

  if (cleanupUsers) {
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      if (user.isTestUser && testUserIds.includes(user._id)) {
        result.usersDeleted += 1;
        if (!dryRun) {
          await ctx.db.delete(user._id);
        }
      }
    }
  }

  return result;
}
