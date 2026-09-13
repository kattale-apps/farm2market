/**
 * SuperAdmin user directory
 *
 * Powers the "Users" card on the SuperAdmin dashboard:
 * - Browse every user on the platform, filtered by category (role) and state
 * - See non-anonymised details (real name, email, phone, location) alongside
 *   the anonymised alias the rest of the app shows
 * - Activate / suspend accounts (login checks `state === "active"`)
 * - Reset a user's password on their behalf
 *
 * Every mutation here is super-admin only and writes an `adminActions` audit row.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { simpleHash } from "./auth";
import { getUgandaTime } from "./utils";

/** Every user category (role) the platform supports. */
const USER_CATEGORIES = [
  "farmer",
  "trader",
  "buyer",
  "vendor",
  "transporter",
  "store",
  "admin",
] as const;

/** Upper bound on how many user rows a single directory query may read. */
const MAX_WINDOW = 2000;

/**
 * Upper bound per category when tallying the directory counts.
 * The tally reads full user docs for all 7 categories in a single query, so
 * this stays well clear of Convex's per-query document/bytes read limits.
 */
const COUNT_CAP = 1000;

/**
 * Authorize a super admin.
 * Mirrors `adminListings.getAllListingsLog`: `adminLevel === undefined` still
 * means super admin, for accounts created before the hierarchy existed.
 */
async function verifySuperAdmin(ctx: any, adminId: Id<"users">) {
  const admin = await ctx.db.get(adminId);
  if (!admin || admin.role !== "admin") {
    throw new ConvexError("Not authorized");
  }
  const isSuperAdmin =
    (admin as any).adminLevel === "super" || (admin as any).adminLevel === undefined;
  if (!isSuperAdmin) {
    throw new ConvexError("Only super admins can manage users");
  }
  return admin;
}

/** Invalidate every live session for a user, so a state/password change bites immediately. */
async function invalidateUserSessions(ctx: any, userId: Id<"users">) {
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_user_active", (q: any) => q.eq("userId", userId).eq("invalidated", false))
    .collect();
  const now = getUgandaTime();
  for (const session of sessions) {
    await ctx.db.patch(session._id, { invalidated: true, invalidatedAt: now });
  }
  return sessions.length;
}

/**
 * How many users exist in each category, and how many are active vs suspended.
 * Counts are capped at COUNT_CAP per category; `truncated` says so when hit.
 */
export const getUserCategoryCounts = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    await verifySuperAdmin(ctx, args.adminId);

    const categories = [];
    let total = 0;
    let truncated = false;

    for (const category of USER_CATEGORIES) {
      const rows = await ctx.db
        .query("users")
        .withIndex("by_role", (q: any) => q.eq("role", category))
        .take(COUNT_CAP);

      if (rows.length === COUNT_CAP) truncated = true;
      total += rows.length;

      categories.push({
        category,
        total: rows.length,
        active: rows.filter((u: any) => u.state === "active").length,
        suspended: rows.filter((u: any) => u.state === "suspended").length,
        deleted: rows.filter((u: any) => u.state === "deleted").length,
      });
    }

    return { categories, total, truncated };
  },
});

/**
 * Paginated directory of every user, with non-anonymised detail resolved
 * (district / subcounty / parish names, community memberships).
 */
export const getAllUsers = query({
  args: {
    adminId: v.id("users"),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    categoryFilter: v.optional(v.string()),
    stateFilter: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifySuperAdmin(ctx, args.adminId);

    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(100, Math.max(10, args.pageSize ?? 25));
    const categoryFilter =
      args.categoryFilter && args.categoryFilter !== "all" ? args.categoryFilter : null;
    const stateFilter =
      args.stateFilter && args.stateFilter !== "all" ? args.stateFilter : null;
    const search = args.search?.trim().toLowerCase() || null;

    // Cap read volume: pull a bounded window, then filter/paginate in memory.
    // Widen the window when in-memory filters will discard many rows.
    const filterMultiplier = (stateFilter ? 3 : 1) * (search ? 4 : 1) * 2;
    const windowSize = Math.min(
      MAX_WINDOW,
      Math.max(page * pageSize * filterMultiplier, pageSize)
    );

    const window = categoryFilter
      ? await ctx.db
          .query("users")
          .withIndex("by_role", (q: any) => q.eq("role", categoryFilter))
          .order("desc")
          .take(windowSize)
      : await ctx.db.query("users").order("desc").take(windowSize);

    const matches = window.filter((user: any) => {
      if (stateFilter && user.state !== stateFilter) return false;
      if (!search) return true;
      const haystack = [
        user.alias,
        user.verifiedName,
        user.email,
        user.phoneNumber,
        user.village,
        user.districtText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });

    const start = (page - 1) * pageSize;
    const pageUsers = matches.slice(start, start + pageSize);

    // Resolve the location and community lookups only for the rows on this page.
    const items = await Promise.all(
      pageUsers.map(async (user: any) => {
        const [district, subcounty, parish] = await Promise.all([
          user.districtId ? ctx.db.get(user.districtId) : null,
          user.subcountyId ? ctx.db.get(user.subcountyId) : null,
          user.parishId ? ctx.db.get(user.parishId) : null,
        ]);

        const memberships = await ctx.db
          .query("communityMemberships")
          .withIndex("by_user", (q: any) => q.eq("userId", user._id))
          .take(10);
        const communities = await Promise.all(
          memberships.map(async (m: any) => {
            const community = await ctx.db.get(m.communityId);
            return community ? (community as any).name : null;
          })
        );

        const activeSessions = await ctx.db
          .query("sessions")
          .withIndex("by_user_active", (q: any) =>
            q.eq("userId", user._id).eq("invalidated", false)
          )
          .take(20);

        return {
          userId: user._id as Id<"users">,
          alias: user.alias,
          // Non-anonymised identity
          verifiedName: user.verifiedName ?? null,
          email: user.email ?? null,
          phoneNumber: user.phoneNumber ?? null,
          sex: user.sex ?? null,
          category: user.role,
          adminLevel: user.adminLevel ?? null,
          adminCategory: user.adminCategory ?? null,
          state: user.state,
          createdAt: user.createdAt,
          lastActiveAt: user.lastActiveAt,
          hasPassword: Boolean(user.passwordHash),
          activeSessionCount: activeSessions.length,
          // Location
          region: user.region ?? null,
          district: (district as any)?.name ?? user.districtText ?? null,
          subcounty: (subcounty as any)?.name ?? user.subCountyText ?? null,
          parish: (parish as any)?.name ?? user.parishText ?? null,
          village: user.village ?? null,
          // Profile / scope
          farmSizeAcres: user.farmSizeAcres ?? null,
          onboardingCompleted: user.onboardingCompleted ?? null,
          accountScope: user.accountScope ?? null,
          supplyChainRole: user.supplyChainRole ?? null,
          isVerifiedTrader: user.isVerifiedTrader ?? null,
          verificationStatus: user.verificationStatus ?? null,
          isTestUser: user.isTestUser ?? false,
          communities: communities.filter(Boolean),
        };
      })
    );

    return {
      items,
      currentPage: page,
      pageSize,
      // Only promise pages this bounded window can actually serve. When the
      // window is full, rows beyond it are unreachable until the caller
      // narrows by category/state/search — `windowTruncated` says so.
      hasMore: matches.length > start + pageSize,
      windowTruncated: window.length === windowSize,
    };
  },
});

/**
 * Activate or suspend a user account.
 * Login rejects any account whose state isn't "active", so this is the
 * activate/deactivate switch. Leaving "active" also kills live sessions.
 */
export const setUserState = mutation({
  args: {
    adminId: v.id("users"),
    userId: v.id("users"),
    state: v.union(v.literal("active"), v.literal("suspended"), v.literal("deleted")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifySuperAdmin(ctx, args.adminId);

    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError("User not found");

    // A super admin locking themselves out can't be undone from the UI.
    if (args.adminId === args.userId && args.state !== "active") {
      throw new ConvexError("You cannot suspend or delete your own account");
    }

    if (target.state === args.state) {
      return { success: true, unchanged: true, sessionsEnded: 0 };
    }

    await ctx.db.patch(args.userId, { state: args.state });

    // Losing "active" must take effect now, not when the session expires.
    const sessionsEnded =
      args.state === "active" ? 0 : await invalidateUserSessions(ctx, args.userId);

    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      action: args.state === "active" ? "activate_user" : `set_user_state_${args.state}`,
      targetUserId: args.userId,
      details: `Changed ${target.alias} (${target.role}) from ${target.state} to ${args.state}`,
      reason: args.reason,
      timestamp: getUgandaTime(),
    });

    return { success: true, unchanged: false, sessionsEnded };
  },
});

/**
 * Reset a user's password on their behalf.
 * Returns nothing secret — the caller already knows the password it sent.
 * Existing sessions are invalidated so the old credential stops working.
 */
export const resetUserPassword = mutation({
  args: {
    adminId: v.id("users"),
    userId: v.id("users"),
    newPassword: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifySuperAdmin(ctx, args.adminId);

    const target = await ctx.db.get(args.userId);
    if (!target) throw new ConvexError("User not found");

    const newPassword = args.newPassword.trim();
    if (newPassword.length < 8) {
      throw new ConvexError("Password must be at least 8 characters");
    }

    await ctx.db.patch(args.userId, { passwordHash: simpleHash(newPassword) });
    const sessionsEnded = await invalidateUserSessions(ctx, args.userId);

    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      action: "reset_user_password",
      targetUserId: args.userId,
      details: `Reset password for ${target.alias} (${target.role})`,
      reason: args.reason,
      timestamp: getUgandaTime(),
    });

    return { success: true, sessionsEnded };
  },
});
