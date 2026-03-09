/**
 * Rate Limiting System
 * 
 * Soft rate limits per role to discourage spam and manipulation.
 * 
 * Features:
 * - Server-side only (no client-side checks)
 * - Graceful failures (explicit error messages)
 * - All rate limit hits logged (admin-visible)
 * - No external libraries (pure Convex implementation)
 * 
 * Rate Limits:
 * - Traders: Max X negotiations per hour
 * - Farmers: Max Y listings per day
 * - Buyers: Max Z purchases per hour
 */

import { v } from "convex/values";
import { query, DatabaseReader, DatabaseWriter } from "./_generated/server";
import { RATE_LIMITS } from "./constants";
import { Id } from "./_generated/dataModel";
import { rateLimitExceededError, throwAppError } from "./errors";

/**
 * Rate limit configuration
 */
type RateLimitConfig = {
  limit: number;
  windowMs: number; // Window size in milliseconds
  limitType: string; // e.g., "negotiations_per_hour", "listings_per_day"
};

/**
 * Get rate limit configuration for an action type
 */
function getRateLimitConfig(
  role: "farmer" | "trader" | "buyer",
  actionType: string
): RateLimitConfig | null {
  // Trader limits
  if (role === "trader") {
    if (actionType === "lock_unit" || actionType === "make_offer") {
      return {
        limit: RATE_LIMITS.TRADER_NEGOTIATIONS_PER_HOUR,
        windowMs: 60 * 60 * 1000, // 1 hour
        limitType: "negotiations_per_hour",
      };
    }
    if (actionType === "deposit_capital" || actionType === "withdraw_profit") {
      return {
        limit: RATE_LIMITS.TRADER_WALLET_OPERATIONS_PER_HOUR,
        windowMs: 60 * 60 * 1000, // 1 hour
        limitType: "wallet_operations_per_hour",
      };
    }
  }

  // Farmer limits
  if (role === "farmer") {
    if (actionType === "create_listing") {
      return {
        limit: RATE_LIMITS.FARMER_LISTINGS_PER_DAY,
        windowMs: 24 * 60 * 60 * 1000, // 24 hours
        limitType: "listings_per_day",
      };
    }
  }

  // Buyer limits
  if (role === "buyer") {
    if (actionType === "create_purchase") {
      return {
        limit: RATE_LIMITS.BUYER_PURCHASES_PER_HOUR,
        windowMs: 60 * 60 * 1000, // 1 hour
        limitType: "purchases_per_hour",
      };
    }
  }

  // No rate limit for this action
  return null;
}

/**
 * Count actions in the current window
 * 
 * This function counts how many times a user has performed a specific action
 * within the rate limit window. It queries the relevant tables based on action type.
 */
async function countActionsInWindow(
  ctx: { db: DatabaseReader },
  userId: Id<"users">,
  actionType: string,
  windowStart: number,
  windowEnd: number
): Promise<number> {
  const now = Date.now();

  // Trader: lock_unit (negotiations)
  if (actionType === "lock_unit") {
    // Count locked units in the window
    const allUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_status", (q) => q.eq("status", "locked"))
      .collect();

    const unitsInWindow = allUnits.filter((unit) => {
      if (unit.lockedBy !== userId) return false;
      if (!unit.lockedAt) return false;
      return unit.lockedAt >= windowStart && unit.lockedAt <= windowEnd;
    });

    return unitsInWindow.length;
  }

  // Trader: make_offer (negotiations)
  if (actionType === "make_offer") {
    // Count negotiations created in the window
    const allNegotiations = await ctx.db
      .query("negotiations")
      .withIndex("by_trader_status", (q) => q.eq("traderId", userId))
      .collect();

    const negotiationsInWindow = allNegotiations.filter((neg) => {
      return neg.createdAt >= windowStart && neg.createdAt <= windowEnd;
    });

    return negotiationsInWindow.length;
  }

  // Trader: wallet operations
  if (actionType === "deposit_capital" || actionType === "withdraw_profit") {
    const ledgerType = actionType === "deposit_capital" ? "capital_deposit" : "profit_withdrawal";
    
    const entries = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const entriesInWindow = entries.filter((entry) => {
      return entry.type === ledgerType && entry.timestamp >= windowStart && entry.timestamp <= windowEnd;
    });

    return entriesInWindow.length;
  }

  // Farmer: create_listing
  if (actionType === "create_listing") {
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_farmer", (q) => q.eq("farmerId", userId))
      .collect();

    const listingsInWindow = listings.filter((listing) => {
      return listing.createdAt >= windowStart && listing.createdAt <= windowEnd;
    });

    return listingsInWindow.length;
  }

  // Buyer: create_purchase
  if (actionType === "create_purchase") {
    const purchases = await ctx.db
      .query("buyerPurchases")
      .withIndex("by_buyer", (q) => q.eq("buyerId", userId))
      .collect();

    const purchasesInWindow = purchases.filter((purchase) => {
      return purchase.purchasedAt >= windowStart && purchase.purchasedAt <= windowEnd;
    });

    return purchasesInWindow.length;
  }

  // Unknown action type
  return 0;
}

/**
 * Check rate limit and throw if exceeded
 * 
 * This function:
 * 1. Gets the rate limit configuration for the action
 * 2. Calculates the current window
 * 3. Counts actions in the window
 * 4. Throws if limit exceeded
 * 5. Logs rate limit hit if exceeded
 * 
 * @throws Error if rate limit exceeded
 */
export async function checkRateLimit(
  ctx: { db: DatabaseReader | DatabaseWriter },
  userId: Id<"users">,
  userRole: string,
  actionType: string,
  metadata?: any
): Promise<void> {
  // Admins are not rate limited
  if (userRole === "admin") {
    return;
  }

  // Only rate-limit known roles; other roles pass through
  const knownRoles = ["farmer", "trader", "buyer"] as const;
  if (!knownRoles.includes(userRole as any)) {
    return;
  }

  // Get rate limit configuration
  const config = getRateLimitConfig(userRole as "farmer" | "trader" | "buyer", actionType);
  if (!config) {
    // No rate limit for this action
    return;
  }

  const now = Date.now();
  const windowStart = now - config.windowMs;
  const windowEnd = now;

  // Count actions in the current window
  const currentCount = await countActionsInWindow(ctx, userId, actionType, windowStart, windowEnd);

  // Check if limit exceeded
  if (currentCount >= config.limit) {
    // Log rate limit hit (admin-visible)
    // Note: This function is only called from mutations, so ctx.db is always DatabaseWriter
    // Type assertion is safe because checkRateLimit is only used in mutation contexts
    if ("insert" in ctx.db) {
      await ctx.db.insert("rateLimitHits", {
        userId,
        userRole: userRole as "farmer" | "trader" | "buyer" | "admin" | "vendor" | "transporter" | "store",
        actionType,
        limitType: config.limitType,
        limitValue: config.limit,
        attemptedAt: now,
        windowStart,
        windowEnd,
        currentCount: currentCount + 1, // Include this attempt
        metadata: metadata || {},
      });
    }

    // Calculate time until limit resets
    const oldestActionInWindow = await findOldestActionInWindow(
      ctx,
      userId,
      actionType,
      windowStart,
      windowEnd
    );

    const resetTime = oldestActionInWindow
      ? oldestActionInWindow + config.windowMs
      : now + config.windowMs;

    const minutesUntilReset = Math.ceil((resetTime - now) / (60 * 1000));

    // Standardized error - no internal details exposed
    throwAppError(
      rateLimitExceededError(
        config.limitType,
        config.limit,
        resetTime
      )
    );
  }
}

/**
 * Find the oldest action in the current window
 * Used to calculate when the rate limit will reset
 */
async function findOldestActionInWindow(
  ctx: { db: DatabaseReader },
  userId: Id<"users">,
  actionType: string,
  windowStart: number,
  windowEnd: number
): Promise<number | null> {
  // Trader: lock_unit
  if (actionType === "lock_unit") {
    const allUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_status", (q) => q.eq("status", "locked"))
      .collect();

    const unitsInWindow = allUnits
      .filter((unit) => {
        if (unit.lockedBy !== userId) return false;
        if (!unit.lockedAt) return false;
        return unit.lockedAt >= windowStart && unit.lockedAt <= windowEnd;
      })
      .map((unit) => unit.lockedAt!)
      .sort((a, b) => a - b);

    return unitsInWindow.length > 0 ? unitsInWindow[0] : null;
  }

  // Trader: wallet operations
  if (actionType === "deposit_capital" || actionType === "withdraw_profit") {
    const ledgerType = actionType === "deposit_capital" ? "capital_deposit" : "profit_withdrawal";
    
    const entries = await ctx.db
      .query("walletLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const entriesInWindow = entries
      .filter((entry) => {
        return entry.type === ledgerType && entry.timestamp >= windowStart && entry.timestamp <= windowEnd;
      })
      .map((entry) => entry.timestamp)
      .sort((a, b) => a - b);

    return entriesInWindow.length > 0 ? entriesInWindow[0] : null;
  }

  // Farmer: create_listing
  if (actionType === "create_listing") {
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_farmer", (q) => q.eq("farmerId", userId))
      .collect();

    const listingsInWindow = listings
      .filter((listing) => {
        return listing.createdAt >= windowStart && listing.createdAt <= windowEnd;
      })
      .map((listing) => listing.createdAt)
      .sort((a, b) => a - b);

    return listingsInWindow.length > 0 ? listingsInWindow[0] : null;
  }

  // Buyer: create_purchase
  if (actionType === "create_purchase") {
    const purchases = await ctx.db
      .query("buyerPurchases")
      .withIndex("by_buyer", (q) => q.eq("buyerId", userId))
      .collect();

    const purchasesInWindow = purchases
      .filter((purchase) => {
        return purchase.purchasedAt >= windowStart && purchase.purchasedAt <= windowEnd;
      })
      .map((purchase) => purchase.purchasedAt)
      .sort((a, b) => a - b);

    return purchasesInWindow.length > 0 ? purchasesInWindow[0] : null;
  }

  return null;
}

/**
 * Get rate limit hits (admin only)
 * 
 * Returns all rate limit violations for admin review.
 */
export const getRateLimitHits = query({
  args: {
    adminId: v.id("users"),
    limit: v.optional(v.number()),
    userId: v.optional(v.id("users")), // Filter by user
    actionType: v.optional(v.string()), // Filter by action type
    startTime: v.optional(v.number()), // Filter by start time
    endTime: v.optional(v.number()), // Filter by end time
  },
  handler: async (ctx, args) => {
    // Verify admin
    const user = await ctx.db.get(args.adminId);
    if (!user || user.role !== "admin") {
      throw new Error("User is not an admin");
    }

    const limit = args.limit || 100;

    // Get all rate limit hits
    let hits = await ctx.db
      .query("rateLimitHits")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    // Apply filters
    if (args.userId) {
      hits = hits.filter((hit) => hit.userId === args.userId);
    }
    if (args.actionType) {
      hits = hits.filter((hit) => hit.actionType === args.actionType);
    }
    if (args.startTime) {
      hits = hits.filter((hit) => hit.attemptedAt >= args.startTime!);
    }
    if (args.endTime) {
      hits = hits.filter((hit) => hit.attemptedAt <= args.endTime!);
    }

    // Limit results
    const limited = hits.slice(0, limit);

    // Enrich with user aliases
    const enriched = await Promise.all(
      limited.map(async (hit) => {
        const user = await ctx.db.get(hit.userId);
        return {
          hitId: hit._id,
          userId: hit.userId,
          userAlias: user?.alias || null,
          userRole: hit.userRole,
          actionType: hit.actionType,
          limitType: hit.limitType,
          limitValue: hit.limitValue,
          attemptedAt: hit.attemptedAt,
          windowStart: hit.windowStart,
          windowEnd: hit.windowEnd,
          currentCount: hit.currentCount,
          metadata: hit.metadata,
        };
      })
    );

    // Calculate summary statistics
    const summary = {
      total: hits.length,
      byRole: {
        farmer: hits.filter((h) => h.userRole === "farmer").length,
        trader: hits.filter((h) => h.userRole === "trader").length,
        buyer: hits.filter((h) => h.userRole === "buyer").length,
      },
      byActionType: {
        lock_unit: hits.filter((h) => h.actionType === "lock_unit").length,
        create_listing: hits.filter((h) => h.actionType === "create_listing").length,
        create_purchase: hits.filter((h) => h.actionType === "create_purchase").length,
        deposit_capital: hits.filter((h) => h.actionType === "deposit_capital").length,
        withdraw_profit: hits.filter((h) => h.actionType === "withdraw_profit").length,
      },
      uniqueUsers: new Set(hits.map((h) => h.userId)).size,
    };

    return {
      summary,
      hits: enriched,
      hasMore: hits.length > limit,
    };
  },
});

/**
 * Get rate limit status for a user (admin only)
 * 
 * Returns current rate limit status for a specific user.
 */
export const getUserRateLimitStatus = query({
  args: {
    adminId: v.id("users"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify admin
    const user = await ctx.db.get(args.adminId);
    if (!user || user.role !== "admin") {
      throw new Error("User is not an admin");
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    const now = Date.now();
    const role = targetUser.role;

    // Get rate limit configurations for this role
    const configs: Array<{ actionType: string; config: RateLimitConfig }> = [];

    if (role === "trader") {
      configs.push(
        { actionType: "lock_unit", config: getRateLimitConfig("trader", "lock_unit")! },
        { actionType: "deposit_capital", config: getRateLimitConfig("trader", "deposit_capital")! },
        { actionType: "withdraw_profit", config: getRateLimitConfig("trader", "withdraw_profit")! }
      );
    } else if (role === "farmer") {
      configs.push({ actionType: "create_listing", config: getRateLimitConfig("farmer", "create_listing")! });
    } else if (role === "buyer") {
      configs.push({ actionType: "create_purchase", config: getRateLimitConfig("buyer", "create_purchase")! });
    }

    // Calculate current counts for each action type
    const statuses = await Promise.all(
      configs.map(async ({ actionType, config }) => {
        const windowStart = now - config.windowMs;
        const windowEnd = now;
        const currentCount = await countActionsInWindow(ctx, args.userId, actionType, windowStart, windowEnd);

        return {
          actionType,
          limitType: config.limitType,
          limit: config.limit,
          currentCount,
          remaining: Math.max(0, config.limit - currentCount),
          windowMs: config.windowMs,
          windowStart,
          windowEnd,
          isAtLimit: currentCount >= config.limit,
        };
      })
    );

    // Get recent rate limit hits for this user
    const recentHits = await ctx.db
      .query("rateLimitHits")
      .withIndex("by_user_timestamp", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(10);

    return {
      userId: args.userId,
      userAlias: targetUser.alias,
      userRole: role,
      statuses,
      recentHits: recentHits.map((hit) => ({
        actionType: hit.actionType,
        limitType: hit.limitType,
        attemptedAt: hit.attemptedAt,
        currentCount: hit.currentCount,
      })),
    };
  },
});
