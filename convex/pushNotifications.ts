/**
 * Push Notifications Backend
 * 
 * Handles device token registration and sending push notifications
 * via Firebase Cloud Messaging (FCM) for Android
 */

import { v } from "convex/values";
import { mutation, query, action, internalAction } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

/**
 * Register or update a device token for push notifications
 */
export const registerDeviceToken = mutation({
  args: {
    userId: v.id("users"),
    token: v.string(),
    platform: v.union(v.literal("android"), v.literal("ios"), v.literal("web")),
  },
  handler: async (ctx, args) => {
    // Verify user exists
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const now = Date.now();

    // Check if token already exists
    const existingToken = await ctx.db
      .query("deviceTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (existingToken) {
      // Update existing token
      await ctx.db.patch(existingToken._id, {
        userId: args.userId,
        platform: args.platform,
        lastUsedAt: now,
        active: true,
      });
      return { success: true, action: "updated" };
    } else {
      // Create new token
      await ctx.db.insert("deviceTokens", {
        userId: args.userId,
        token: args.token,
        platform: args.platform,
        createdAt: now,
        lastUsedAt: now,
        active: true,
      });
      return { success: true, action: "registered" };
    }
  },
});

/**
 * Get all active device tokens for a user
 */
export const getUserDeviceTokens = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const tokens = await ctx.db
      .query("deviceTokens")
      .withIndex("by_user_active", (q) => q.eq("userId", args.userId).eq("active", true))
      .collect();

    return tokens.map((token) => ({
      tokenId: token._id,
      token: token.token,
      platform: token.platform,
      lastUsedAt: token.lastUsedAt,
    }));
  },
});

/**
 * Send push notification to a user (internal action)
 * This is called internally when notifications are created
 * 
 * Note: This requires FCM server key to be configured
 * For production, you'll need to:
 * 1. Set up Firebase project
 * 2. Get FCM server key
 * 3. Store it securely (e.g., in Convex environment variables)
 * 4. Use it to send notifications via FCM REST API
 */
export const sendPushNotification = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()), // Additional data payload
  },
  handler: async (ctx, args) => {
    // TODO: Re-enable when pushNotifications internal API is properly generated
    // Push notifications are temporarily disabled until the internal API is available
    // This requires running `npx convex dev` to regenerate the API types
    return {
      success: false,
      tokensSent: 0,
      message: "Push notifications temporarily disabled - internal API not generated",
    };
  },
});

/**
 * Internal query to get device tokens
 */
export const getUserDeviceTokensInternal = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const tokens = await ctx.db
      .query("deviceTokens")
      .withIndex("by_user_active", (q) => q.eq("userId", args.userId).eq("active", true))
      .collect();

    return tokens.map((token) => ({
      tokenId: token._id,
      token: token.token,
      platform: token.platform,
      lastUsedAt: token.lastUsedAt,
    }));
  },
});

/**
 * Deactivate a device token (internal mutation)
 */
export const deactivateToken = internalAction({
  args: {
    tokenId: v.id("deviceTokens"),
  },
  handler: async (ctx, args) => {
    // TODO: Re-enable when pushNotifications internal API is properly generated
    // await ctx.runMutation(internal.pushNotifications.deactivateTokenInternal, {
    //   tokenId: args.tokenId,
    // });
    console.log(`Would deactivate token ${args.tokenId} - internal API not available`);
  },
});

/**
 * Deactivate a device token (internal mutation)
 */
export const deactivateTokenInternal = mutation({
  args: {
    tokenId: v.id("deviceTokens"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.tokenId, { active: false });
  },
});

/**
 * Unregister a device token (when user logs out or uninstalls app)
 */
export const unregisterDeviceToken = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const deviceToken = await ctx.db
      .query("deviceTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (deviceToken) {
      await ctx.db.patch(deviceToken._id, { active: false });
      return { success: true };
    }

    return { success: false, message: "Token not found" };
  },
});
