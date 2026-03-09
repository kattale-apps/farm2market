/**
 * User Settings Management
 * 
 * Handles user notification preferences and other settings
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Get user notification preferences
 */
export const getNotificationPreferences = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Default preferences
    const defaults = {
      newListings: true, // Traders can toggle this
      offers: true, // Always enabled (critical)
      counters: true, // Always enabled (critical)
      transactions: true, // Always enabled (critical)
    };

    return user.notificationPreferences || defaults;
  },
});

/**
 * Update notification preferences (trader only)
 * Critical alerts (offers, counters, transactions) cannot be disabled
 */
export const updateNotificationPreferences = mutation({
  args: {
    userId: v.id("users"),
    preferences: v.any(), // { newListings: boolean, ... }
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Only traders can update preferences
    if (!["trader", "transporter"].includes(user.role)) {
      throw new Error("Only traders can update notification preferences");
    }

    // Ensure critical alerts are always enabled
    const updatedPreferences = {
      ...(user.notificationPreferences || {}),
      ...args.preferences,
      offers: true, // Always enabled
      counters: true, // Always enabled
      transactions: true, // Always enabled
    };

    await ctx.db.patch(args.userId, {
      notificationPreferences: updatedPreferences,
    });

    return { success: true, preferences: updatedPreferences };
  },
});

/**
 * Get user pagination preferences
 */
export const getPaginationPreferences = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const roleDefault = user.role === "admin" ? 20 : 10;
    const stored = (user as any).paginationPreferences || {};

    return {
      defaultPageSize: stored.defaultPageSize ?? roleDefault,
      list: stored.list ?? {},
    };
  },
});

/**
 * Update pagination preference for a list
 */
export const updatePaginationPreferences = mutation({
  args: {
    userId: v.id("users"),
    listKey: v.string(),
    pageSize: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const allowed = new Set([10, 20, 50]);
    if (!allowed.has(args.pageSize)) {
      throw new Error("Invalid page size");
    }

    const roleDefault = user.role === "admin" ? 20 : 10;
    const existing = (user as any).paginationPreferences || {};
    const updated = {
      defaultPageSize: existing.defaultPageSize ?? roleDefault,
      list: {
        ...(existing.list || {}),
        [args.listKey]: args.pageSize,
      },
    };

    await ctx.db.patch(args.userId, {
      paginationPreferences: updated,
    });

    return { success: true, preferences: updated };
  },
});
