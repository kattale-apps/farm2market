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
    if (user.role !== "trader") {
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
