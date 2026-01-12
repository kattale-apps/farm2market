/**
 * Push Notifications Backend
 * 
 * Handles device token registration and sending push notifications
 * via Firebase Cloud Messaging (FCM) for Android
 */

import { v } from "convex/values";
import { mutation, query, action, internalAction, internalQuery, internalMutation } from "./_generated/server";
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
type PushNotificationResult = {
  success: boolean;
  tokensSent?: number;
  tokensFailed?: number;
  totalTokens?: number;
  message: string;
};

export const sendPushNotification = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()), // Additional data payload
  },
  handler: async (ctx, args): Promise<PushNotificationResult> => {
    // Get all active device tokens for the user
    // Type assertion needed until Convex regenerates types with pushNotifications module
    const tokens: any[] = await ctx.runQuery(
      (internal as any).pushNotifications.getUserDeviceTokensInternal,
      {
        userId: args.userId,
      }
    );

    if (tokens.length === 0) {
      return { success: false, message: "No device tokens found for user" };
    }

    // Filter to Android tokens (FCM)
    // Type assertion needed until Convex regenerates types with pushNotifications module
    type DeviceToken = {
      tokenId: Id<"deviceTokens">;
      token: string;
      platform: "android" | "ios" | "web";
      lastUsedAt: number;
    };
    const androidTokens: DeviceToken[] = (tokens as DeviceToken[]).filter((t: DeviceToken) => t.platform === "android");

    if (androidTokens.length === 0) {
      return { success: false, message: "No Android device tokens found" };
    }

    // Get Cloud Function URL from environment
    const CLOUD_FUNCTION_URL = process.env.FCM_CLOUD_FUNCTION_URL;
    
    if (!CLOUD_FUNCTION_URL) {
      console.warn("FCM_CLOUD_FUNCTION_URL not configured. Push notifications will not be sent.");
      console.log(`Would send push notification to ${androidTokens.length} devices for user ${args.userId}`);
      console.log(`Title: ${args.title}, Body: ${args.body}`);
      return {
        success: false,
        tokensSent: 0,
        message: "FCM_CLOUD_FUNCTION_URL not configured. Please set it in Convex environment variables.",
      };
    }

    // Prepare tokens array
    const deviceTokens = androidTokens.map((t: DeviceToken) => t.token);

    try {
      // Call Cloud Function
      const response = await fetch(CLOUD_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tokens: deviceTokens,
          title: args.title,
          body: args.body,
          data: args.data || {},
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Cloud Function error: ${response.status} ${errorText}`);
        return {
          success: false,
          tokensSent: 0,
          tokensFailed: androidTokens.length,
          totalTokens: androidTokens.length,
          message: `Cloud Function error: ${response.status}`,
        };
      }

      const result = await response.json();
      
      // Handle individual token failures
      if (result.responses) {
        for (let i = 0; i < result.responses.length; i++) {
          const resp = result.responses[i];
          if (!resp.success && resp.error) {
            // Mark invalid tokens as inactive
            const errorCode = resp.error.code;
            if (errorCode === 'messaging/invalid-registration-token' || 
                errorCode === 'messaging/registration-token-not-registered' ||
                errorCode === 'messaging/invalid-argument') {
              // Type assertion needed until Convex regenerates types with pushNotifications module
              await ctx.runMutation(
                (internal as any).pushNotifications.deactivateTokenInternal,
                {
                  tokenId: androidTokens[i].tokenId,
                }
              );
            }
          }
        }
      }

      return {
        success: result.success !== false,
        tokensSent: result.successCount || 0,
        tokensFailed: result.failureCount || 0,
        totalTokens: androidTokens.length,
        message: result.success !== false
          ? `Sent ${result.successCount || 0} push notification(s) successfully`
          : "Failed to send push notifications",
      };
      
    } catch (error: any) {
      console.error("Error calling Cloud Function:", error);
      return {
        success: false,
        tokensSent: 0,
        tokensFailed: androidTokens.length,
        totalTokens: androidTokens.length,
        message: `Error calling Cloud Function: ${error.message || error}`,
      };
    }
  },
});

/**
 * Internal query to get device tokens
 */
export const getUserDeviceTokensInternal = internalQuery({
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
    // Type assertion needed until Convex regenerates types with pushNotifications module
    await ctx.runMutation(
      (internal as any).pushNotifications.deactivateTokenInternal,
      {
        tokenId: args.tokenId,
      }
    );
  },
});

/**
 * Deactivate a device token (internal mutation)
 */
export const deactivateTokenInternal = internalMutation({
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
