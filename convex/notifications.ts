/**
 * Notification System
 * 
 * Admin-controlled notification delivery:
 * - Broadcast notifications (to all users)
 * - Role-based notifications (to specific roles)
 * - UTID-specific notifications (to users related to a specific UTID)
 * 
 * Features:
 * - Server-side storage only
 * - Frontend receives via queries/subscriptions
 * - No email or SMS (v1.x)
 * - Complete notification history for auditability
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { generateUTID, getUgandaTime } from "./utils";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

/**
 * Verify user is admin
 */
async function verifyAdmin(ctx: any, adminId: string) {
  const user = await ctx.db.get(adminId);
  if (!user || user.role !== "admin") {
    throw new Error("User is not an admin");
  }
  return user;
}

/**
 * Log admin action for notification sending
 */
async function logAdminNotificationAction(
  ctx: any,
  adminId: string,
  notificationType: string,
  reason: string,
  metadata?: any
) {
  const utid = generateUTID("admin");
  await ctx.db.insert("adminActions", {
    adminId,
    actionType: `send_notification_${notificationType}`,
    utid,
    reason,
    targetUtid: metadata?.targetUtid,
    metadata: {
      notificationType,
      ...metadata,
    },
        timestamp: getUgandaTime(),
  });
  return utid;
}

/**
 * Find users related to a UTID
 * 
 * UTIDs can be associated with:
 * - Wallet ledger entries (trader)
 * - Listing units (farmer, trader)
 * - Buyer purchases (buyer, trader via inventory)
 * - Admin actions (admin)
 */
async function findUsersByUTID(
  ctx: any,
  targetUtid: string
): Promise<Array<{ userId: Id<"users">; role: string }>> {
  const users: Array<{ userId: Id<"users">; role: string }> = [];
  const seenUserIds = new Set<string>();

  // 1. Wallet ledger entries (traders)
  const walletEntries = await ctx.db
    .query("walletLedger")
    .withIndex("by_utid", (q: any) => q.eq("utid", targetUtid))
    .collect();

  for (const entry of walletEntries) {
    if (!seenUserIds.has(entry.userId)) {
      const user = await ctx.db.get(entry.userId);
      if (user) {
        users.push({ userId: entry.userId, role: user.role });
        seenUserIds.add(entry.userId);
      }
    }
  }

  // 2. Listing units (farmers via listing, traders via lockedBy)
  const units = await ctx.db
    .query("listingUnits")
    .withIndex("by_lock_utid", (q: any) => q.eq("lockUtid", targetUtid))
    .collect();

  for (const unit of units) {
    // Get farmer via listing
    const listing = await ctx.db.get(unit.listingId);
    if (listing && listing.farmerId) {
      if (!seenUserIds.has(listing.farmerId)) {
        const farmer = await ctx.db.get(listing.farmerId);
        if (farmer) {
          users.push({ userId: listing.farmerId, role: farmer.role });
          seenUserIds.add(listing.farmerId);
        }
      }
    }

    // Get trader via lockedBy
    if (unit.lockedBy && !seenUserIds.has(unit.lockedBy)) {
      const trader = await ctx.db.get(unit.lockedBy);
      if (trader) {
        users.push({ userId: unit.lockedBy, role: trader.role });
        seenUserIds.add(unit.lockedBy);
      }
    }
  }

  // 3. Buyer purchases (buyers, traders via inventory)
  const purchases = await ctx.db
    .query("buyerPurchases")
    .withIndex("by_utid", (q: any) => q.eq("utid", targetUtid))
    .collect();

  for (const purchase of purchases) {
    // Get buyer
    if (!seenUserIds.has(purchase.buyerId)) {
      const buyer = await ctx.db.get(purchase.buyerId);
      if (buyer) {
        users.push({ userId: purchase.buyerId, role: buyer.role });
        seenUserIds.add(purchase.buyerId);
      }
    }

    // Get trader via inventory
    const inventory = await ctx.db.get(purchase.inventoryId);
    if (inventory && !seenUserIds.has(inventory.traderId)) {
      const trader = await ctx.db.get(inventory.traderId);
      if (trader) {
        users.push({ userId: inventory.traderId, role: trader.role });
        seenUserIds.add(inventory.traderId);
      }
    }
  }

  // 4. Listings (farmers)
  const listings = await ctx.db
    .query("listings")
    .withIndex("by_utid", (q: any) => q.eq("utid", targetUtid))
    .collect();

  for (const listing of listings) {
    if (listing.farmerId && !seenUserIds.has(listing.farmerId)) {
      const farmer = await ctx.db.get(listing.farmerId);
      if (farmer) {
        users.push({ userId: listing.farmerId, role: farmer.role });
        seenUserIds.add(listing.farmerId);
      }
    }
  }

  // 5. Trader inventory (traders)
  const inventory = await ctx.db
    .query("traderInventory")
    .withIndex("by_utid", (q: any) => q.eq("utid", targetUtid))
    .collect();

  for (const inv of inventory) {
    if (!seenUserIds.has(inv.traderId)) {
      const trader = await ctx.db.get(inv.traderId);
      if (trader) {
        users.push({ userId: inv.traderId, role: trader.role });
        seenUserIds.add(inv.traderId);
      }
    }
  }

  // 6. Admin actions (admins)
  const adminActions = await ctx.db
    .query("adminActions")
    .withIndex("by_utid", (q: any) => q.eq("utid", targetUtid))
    .collect();

  for (const action of adminActions) {
    if (!seenUserIds.has(action.adminId)) {
      const admin = await ctx.db.get(action.adminId);
      if (admin) {
        users.push({ userId: action.adminId, role: admin.role });
        seenUserIds.add(action.adminId);
      }
    }
  }

  return users;
}

/**
 * Send broadcast notification (admin only)
 * 
 * Sends notification to all users in the system.
 */
export const sendBroadcastNotification = mutation({
  args: {
    adminId: v.id("users"),
    title: v.string(),
    message: v.string(),
    reason: v.string(), // Required reason for sending notification
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    // Get all users
    const allUsers = await ctx.db.query("users").collect();

    const now = getUgandaTime();
    const notificationUtid = generateUTID("admin");

    // Create notification for each user
    const notificationIds = [];
    for (const user of allUsers) {
      const notificationId = await ctx.db.insert("notifications", {
        userId: user._id,
        type: "admin_broadcast",
        title: args.title,
        message: args.message,
        utid: notificationUtid, // Same UTID for all notifications in this broadcast
        read: false,
        createdAt: getUgandaTime(),
      });
      notificationIds.push(notificationId);
    }

    // Log admin action
    await logAdminNotificationAction(
      ctx,
      args.adminId,
      "broadcast",
      args.reason,
      {
        title: args.title,
        message: args.message,
        notificationUtid,
        recipientsCount: allUsers.length,
      }
    );

    return {
      notificationUtid,
      recipientsCount: allUsers.length,
      notificationIds: notificationIds.length,
      sentAt: now,
    };
  },
});

/**
 * Send role-based notification (admin only)
 * 
 * Sends notification to all users with a specific role.
 */
export const sendRoleBasedNotification = mutation({
  args: {
    adminId: v.id("users"),
    role: v.union(v.literal("farmer"), v.literal("trader"), v.literal("buyer"), v.literal("admin")),
    title: v.string(),
    message: v.string(),
    reason: v.string(), // Required reason for sending notification
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    // Get all users with the specified role
    const users = await ctx.db
      .query("users")
      .withIndex("by_role", (q: any) => q.eq("role", args.role))
      .collect();

    const now = getUgandaTime();
    const notificationUtid = generateUTID("admin");

    // Create notification for each user and send push notifications
    const notificationIds = [];
    for (const user of users) {
      const notificationId = await ctx.db.insert("notifications", {
        userId: user._id,
        type: "role_based",
        title: args.title,
        message: args.message,
        utid: notificationUtid, // Same UTID for all notifications in this role-based send
        read: false,
        createdAt: getUgandaTime(),
      });
      notificationIds.push(notificationId);
      
      // Send push notification (non-blocking, scheduled)
      try {
        await ctx.scheduler.runAfter(0, internal.pushNotifications.sendPushNotification, {
          userId: user._id,
          title: args.title,
          body: args.message,
          data: { utid: notificationUtid, type: "role_based", role: args.role },
        });
      } catch (error) {
        console.error(`Failed to schedule push notification for user ${user._id}:`, error);
      }
    }

    // Log admin action
    await logAdminNotificationAction(
      ctx,
      args.adminId,
      "role_based",
      args.reason,
      {
        role: args.role,
        title: args.title,
        message: args.message,
        notificationUtid,
        recipientsCount: users.length,
      }
    );

    return {
      notificationUtid,
      role: args.role,
      recipientsCount: users.length,
      notificationIds: notificationIds.length,
      sentAt: now,
    };
  },
});

/**
 * Send UTID-specific notification (admin only)
 * 
 * Sends notification to all users related to a specific UTID.
 * Finds users by searching:
 * - Wallet ledger entries
 * - Listing units (farmers and traders)
 * - Buyer purchases (buyers and traders)
 * - Listings (farmers)
 * - Trader inventory (traders)
 * - Admin actions (admins)
 */
export const sendUTIDSpecificNotification = mutation({
  args: {
    adminId: v.id("users"),
    targetUtid: v.string(), // UTID to find related users
    title: v.string(),
    message: v.string(),
    reason: v.string(), // Required reason for sending notification
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    // Find all users related to this UTID
    const relatedUsers = await findUsersByUTID(ctx, args.targetUtid);

    if (relatedUsers.length === 0) {
      throw new Error(`No users found related to UTID: ${args.targetUtid}`);
    }

    const now = getUgandaTime();
    const notificationUtid = generateUTID("admin");

    // Create notification for each related user and send push notifications
    const notificationIds = [];
    for (const { userId } of relatedUsers) {
      const notificationId = await ctx.db.insert("notifications", {
        userId,
        type: "utid_specific",
        title: args.title,
        message: args.message,
        utid: args.targetUtid, // Reference to the transaction UTID
        read: false,
        createdAt: getUgandaTime(),
      });
      notificationIds.push(notificationId);
      
      // Send push notification (non-blocking, scheduled)
      try {
        await ctx.scheduler.runAfter(0, internal.pushNotifications.sendPushNotification, {
          userId,
          title: args.title,
          body: args.message,
          data: { utid: args.targetUtid, type: "utid_specific" },
        });
      } catch (error) {
        console.error(`Failed to schedule push notification for user ${userId}:`, error);
      }
    }

    // Log admin action
    await logAdminNotificationAction(
      ctx,
      args.adminId,
      "utid_specific",
      args.reason,
      {
        targetUtid: args.targetUtid,
        title: args.title,
        message: args.message,
        notificationUtid,
        recipientsCount: relatedUsers.length,
        recipientRoles: relatedUsers.map((u) => u.role),
      }
    );

    return {
      notificationUtid,
      targetUtid: args.targetUtid,
      recipientsCount: relatedUsers.length,
      recipientRoles: relatedUsers.map((u) => u.role),
      notificationIds: notificationIds.length,
      sentAt: now,
    };
  },
});

/**
 * Get user notifications (any user)
 * 
 * Returns all notifications for the requesting user.
 * Supports filtering by read status and limiting results.
 */
export const getUserNotifications = query({
  args: {
    userId: v.id("users"),
    unreadOnly: v.optional(v.boolean()), // Filter to unread only
    limit: v.optional(v.number()), // Limit results
  },
  handler: async (ctx, args) => {
    // Verify user exists
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const limit = args.limit || 50;

    // Get notifications for this user
    let notifications;
    if (args.unreadOnly) {
      notifications = await ctx.db
        .query("notifications")
        .withIndex("by_user_unread", (q: any) => q.eq("userId", args.userId).eq("read", false))
        .order("desc")
        .take(limit);
    } else {
      notifications = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
        .order("desc")
        .take(limit);
    }

    // Calculate unread count
    const allNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .collect();

    const unreadCount = allNotifications.filter((n) => !n.read).length;

    return {
      notifications: notifications.map((n) => ({
        notificationId: n._id,
        type: n.type,
        title: n.title,
        message: n.message,
        utid: n.utid,
        read: n.read,
        createdAt: n.createdAt,
      })),
      unreadCount,
      totalCount: allNotifications.length,
      hasMore: allNotifications.length > limit,
    };
  },
});

/**
 * Mark notification as read (any user)
 * 
 * Marks a specific notification as read by the user.
 */
export const markNotificationAsRead = mutation({
  args: {
    userId: v.id("users"),
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    // Verify user exists
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get notification
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }

    // Verify notification belongs to user
    if (notification.userId !== args.userId) {
      throw new Error("Notification does not belong to user");
    }

    // Mark as read
    await ctx.db.patch(args.notificationId, {
      read: true,
    });

    return {
      notificationId: args.notificationId,
      read: true,
      updatedAt: getUgandaTime(),
    };
  },
});

/**
 * Mark all notifications as read (any user)
 * 
 * Marks all unread notifications for the user as read.
 */
export const markAllNotificationsAsRead = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user exists
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get all unread notifications
    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q: any) => q.eq("userId", args.userId).eq("read", false))
      .collect();

    // Mark all as read
    for (const notification of unreadNotifications) {
      await ctx.db.patch(notification._id, {
        read: true,
      });
    }

    return {
      markedCount: unreadNotifications.length,
      updatedAt: getUgandaTime(),
    };
  },
});

/**
 * Send notification to selected users (admin only)
 * 
 * Sends notification to a specific list of user IDs.
 */
export const sendNotificationToSelectedUsers = mutation({
  args: {
    adminId: v.id("users"),
    userIds: v.array(v.id("users")), // List of user IDs to send notification to
    title: v.string(),
    message: v.string(),
    reason: v.string(), // Required reason for sending notification
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    if (args.userIds.length === 0) {
      throw new Error("At least one user ID must be provided");
    }

    // Verify all users exist
    const users = [];
    for (const userId of args.userIds) {
      const user = await ctx.db.get(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      users.push(user);
    }

    const now = getUgandaTime();
    const notificationUtid = generateUTID("admin");

    // Create notification for each selected user
    const notificationIds = [];
    for (const user of users) {
      const notificationId = await ctx.db.insert("notifications", {
        userId: user._id,
        type: "admin_broadcast",
        title: args.title,
        message: args.message,
        utid: notificationUtid,
        read: false,
        createdAt: getUgandaTime(),
      });
      notificationIds.push(notificationId);
    }

    // Log admin action
    await logAdminNotificationAction(
      ctx,
      args.adminId,
      "selected_users",
      args.reason,
      {
        title: args.title,
        message: args.message,
        notificationUtid,
        recipientsCount: users.length,
        recipientIds: args.userIds,
        recipientRoles: users.map((u) => u.role),
      }
    );

    return {
      notificationUtid,
      recipientsCount: users.length,
      recipientIds: args.userIds,
      recipientRoles: users.map((u) => u.role),
      notificationIds: notificationIds.length,
      sentAt: now,
    };
  },
});

/**
 * Get notification history (admin only)
 * 
 * Returns all notifications sent by admins for audit purposes.
 * Supports filtering by type, time range, and admin.
 */
export const getNotificationHistory = query({
  args: {
    adminId: v.id("users"),
    notificationType: v.optional(
      v.union(
        v.literal("admin_broadcast"),
        v.literal("role_based"),
        v.literal("utid_specific"),
        v.literal("system")
      )
    ),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyAdmin(ctx, args.adminId);

    const limit = args.limit || 100;

    // Get all notifications
    let notifications = await ctx.db.query("notifications").collect();

    // Filter by type
    if (args.notificationType) {
      notifications = notifications.filter((n) => n.type === args.notificationType);
    }

    // Filter by time range
    if (args.startTime) {
      notifications = notifications.filter((n) => n.createdAt >= args.startTime!);
    }
    if (args.endTime) {
      notifications = notifications.filter((n) => n.createdAt <= args.endTime!);
    }

    // Group by notification UTID (same UTID = same send operation)
    const byUtid = new Map<string, typeof notifications>();
    for (const notification of notifications) {
      const utid = notification.utid || "no_utid";
      if (!byUtid.has(utid)) {
        byUtid.set(utid, []);
      }
      byUtid.get(utid)!.push(notification);
    }

    // Convert to array and sort by most recent first
    const grouped = Array.from(byUtid.entries())
      .map(([utid, notifs]) => ({
        notificationUtid: utid,
        type: notifs[0].type,
        title: notifs[0].title,
        message: notifs[0].message,
        sentAt: notifs[0].createdAt,
        recipientsCount: notifs.length,
        readCount: notifs.filter((n) => n.read).length,
        unreadCount: notifs.filter((n) => !n.read).length,
      }))
      .sort((a, b) => b.sentAt - a.sentAt)
      .slice(0, limit);

    // Get admin actions related to notifications
    const adminActions = await ctx.db
      .query("adminActions")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    const notificationActions = adminActions.filter((action) =>
      action.actionType.startsWith("send_notification_")
    );

    return {
      summary: {
        totalNotifications: notifications.length,
        totalSends: grouped.length,
        byType: {
          admin_broadcast: notifications.filter((n) => n.type === "admin_broadcast").length,
          role_based: notifications.filter((n) => n.type === "role_based").length,
          utid_specific: notifications.filter((n) => n.type === "utid_specific").length,
          system: notifications.filter((n) => n.type === "system").length,
        },
      },
      sends: grouped,
      adminActions: notificationActions.slice(0, limit).map((action) => ({
        actionId: action._id,
        adminId: action.adminId,
        actionType: action.actionType,
        utid: action.utid,
        reason: action.reason,
        targetUtid: action.targetUtid,
        timestamp: action.timestamp,
        metadata: action.metadata,
      })),
      hasMore: grouped.length > limit,
    };
  },
});
