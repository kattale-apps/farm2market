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
    // Get all active device tokens for the user
    const tokens = await ctx.runQuery(internal.pushNotifications.getUserDeviceTokensInternal, {
      userId: args.userId,
    });

    if (tokens.length === 0) {
      return { success: false, message: "No device tokens found for user" };
    }

    // Filter to Android tokens (FCM)
    const androidTokens = tokens.filter((t) => t.platform === "android");

    if (androidTokens.length === 0) {
      return { success: false, message: "No Android device tokens found" };
    }

    // TODO: Implement FCM push notification sending
    // For now, we'll just log that we would send notifications
    // In production, you'll need to:
    // 1. Get FCM server key from environment
    // 2. Make HTTP POST to https://fcm.googleapis.com/fcm/send
    // 3. Include Authorization header with server key
    // 4. Send to each device token

    console.log(`Would send push notification to ${androidTokens.length} devices for user ${args.userId}`);
    console.log(`Title: ${args.title}, Body: ${args.body}`);

    // For production implementation, uncomment and configure:
    /*
    const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY;
    if (!FCM_SERVER_KEY) {
      throw new Error("FCM_SERVER_KEY not configured");
    }

    const fcmUrl = "https://fcm.googleapis.com/fcm/send";
    
    for (const deviceToken of androidTokens) {
      try {
        const response = await fetch(fcmUrl, {
          method: "POST",
          headers: {
            "Authorization": `key=${FCM_SERVER_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: deviceToken.token,
            notification: {
              title: args.title,
              body: args.body,
              sound: "default",
              badge: "1",
            },
            data: args.data || {},
            priority: "high",
          }),
        });

        if (!response.ok) {
          console.error(`Failed to send push to token ${deviceToken.token}: ${response.statusText}`);
          // Mark token as inactive if it's invalid
          if (response.status === 400 || response.status === 404) {
            await ctx.runMutation(internal.pushNotifications.deactivateToken, {
              tokenId: deviceToken.tokenId,
            });
          }
        }
      } catch (error) {
        console.error(`Error sending push to token ${deviceToken.token}:`, error);
      }
    }
    */

    return {
      success: true,
      tokensSent: androidTokens.length,
      message: "Push notifications queued (FCM not configured yet)",
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
    await ctx.runMutation(internal.pushNotifications.deactivateTokenInternal, {
      tokenId: args.tokenId,
    });
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
