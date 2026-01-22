/**
 * Messaging System (UTID-Linked)
 * 
 * - Users can message SuperAdmin
 * - SuperAdmin can message any user
 * - All messages must link to a UTID
 * - No phone numbers or identities visible
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { generateUTID, getUgandaTime } from "./utils";
import { Id } from "./_generated/dataModel";

/**
 * Check if user is SuperAdmin
 */
function isSuperAdmin(user: { adminLevel?: "super" | "junior" }): boolean {
  return user.adminLevel === "super" || user.adminLevel === undefined;
}

/**
 * Get SuperAdmin user ID (for messaging)
 */
export const getSuperAdmin = query({
  args: {},
  handler: async (ctx) => {
    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();

    const superAdmin = admins.find(
      (admin) => isSuperAdmin(admin)
    );

    if (!superAdmin) {
      return null;
    }

    return {
      id: superAdmin._id,
      alias: superAdmin.alias,
    };
  },
});

/**
 * Get message thread between two users
 * Returns messages linked to a specific UTID
 */
export const getMessageThread = query({
  args: {
    userId: v.id("users"),
    utid: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get all messages for this UTID
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_utid", (q) => q.eq("utid", args.utid))
      .order("asc")
      .collect();

    // Filter messages where user is either sender or recipient
    const userMessages = messages.filter(
      (m) => m.fromUserId === args.userId || m.toUserId === args.userId
    );

    // Get user aliases for display (maintain anonymity)
    const userIds = new Set<Id<"users">>();
    userMessages.forEach((m) => {
      userIds.add(m.fromUserId);
      userIds.add(m.toUserId);
    });

    const userMap = new Map<Id<"users">, string>();
    for (const uid of userIds) {
      const u = await ctx.db.get(uid);
      if (u) {
        userMap.set(uid, u.alias);
      }
    }

    return userMessages.map((m) => ({
      id: m._id,
      fromAlias: userMap.get(m.fromUserId) || "Unknown",
      toAlias: userMap.get(m.toUserId) || "Unknown",
      message: m.message,
      read: m.read,
      createdAt: m.createdAt,
      isFromMe: m.fromUserId === args.userId,
    }));
  },
});

/**
 * Get all message threads for a user
 * Returns list of UTIDs the user has messages for
 */
export const getUserMessageThreads = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get all messages where user is sender or recipient
    const sentMessages = await ctx.db
      .query("messages")
      .withIndex("by_from_user", (q) => q.eq("fromUserId", args.userId))
      .collect();

    const receivedMessages = await ctx.db
      .query("messages")
      .withIndex("by_to_user_unread", (q) => q.eq("toUserId", args.userId))
      .collect();

    // Get unique UTIDs
    const utidSet = new Set<string>();
    sentMessages.forEach((m) => utidSet.add(m.utid));
    receivedMessages.forEach((m) => utidSet.add(m.utid));

    // Get unread count per UTID
    const unreadCounts = new Map<string, number>();
    receivedMessages.forEach((m) => {
      if (!m.read) {
        unreadCounts.set(m.utid, (unreadCounts.get(m.utid) || 0) + 1);
      }
    });

    return Array.from(utidSet).map((utid) => ({
      utid,
      unreadCount: unreadCounts.get(utid) || 0,
    }));
  },
});

/**
 * Send a message (UTID-linked)
 * Users can only message SuperAdmin
 * SuperAdmin can message any user
 */
export const sendMessage = mutation({
  args: {
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    utid: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.message.trim()) {
      throw new Error("Message cannot be empty");
    }

    const fromUser = await ctx.db.get(args.fromUserId);
    if (!fromUser) {
      throw new Error("Sender not found");
    }

    const toUser = await ctx.db.get(args.toUserId);
    if (!toUser) {
      throw new Error("Recipient not found");
    }

    // Verify UTID exists (check if it's referenced in any entity)
    // This is a basic check - in production, you might want more thorough validation
    const utidExists = await validateUTID(ctx, args.utid);
    if (!utidExists) {
      throw new Error("Invalid UTID. Message must be linked to a valid transaction.");
    }

    // Authorization: Users can only message SuperAdmin, SuperAdmin can message anyone
    const isFromSuperAdmin = fromUser.role === "admin" && isSuperAdmin(fromUser);
    const isToSuperAdmin = toUser.role === "admin" && isSuperAdmin(toUser);

    if (!isFromSuperAdmin && !isToSuperAdmin) {
      throw new Error("Users can only message SuperAdmin. SuperAdmin can message any user.");
    }

    // Create message
    await ctx.db.insert("messages", {
      fromUserId: args.fromUserId,
      toUserId: args.toUserId,
      utid: args.utid,
      message: args.message.trim(),
      read: false,
      createdAt: getUgandaTime(),
    });

    return { success: true };
  },
});

/**
 * Mark messages as read
 */
export const markMessagesAsRead = mutation({
  args: {
    userId: v.id("users"),
    utid: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get all unread messages for this UTID where user is recipient
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_utid", (q) => q.eq("utid", args.utid))
      .collect();

    const unreadMessages = messages.filter(
      (m) => m.toUserId === args.userId && !m.read
    );

    // Mark as read
    for (const message of unreadMessages) {
      await ctx.db.patch(message._id, { read: true });
    }

    return { markedRead: unreadMessages.length };
  },
});

/**
 * Helper function to validate UTID exists
 * Checks if UTID is referenced in listings, negotiations, walletLedger, etc.
 */
async function validateUTID(ctx: any, utid: string): Promise<boolean> {
  // Check listings
  const listing = await ctx.db
    .query("listings")
    .withIndex("by_utid", (q: any) => q.eq("utid", utid))
    .first();
  if (listing) return true;

  // Check negotiations
  const negotiation = await ctx.db
    .query("negotiations")
    .withIndex("by_utid", (q: any) => q.eq("negotiationUtid", utid))
    .first();
  if (negotiation) return true;

  // Check wallet ledger
  const ledgerEntry = await ctx.db
    .query("walletLedger")
    .withIndex("by_utid", (q: any) => q.eq("utid", utid))
    .first();
  if (ledgerEntry) return true;

  // Check admin actions
  const adminAction = await ctx.db
    .query("adminActions")
    .withIndex("by_utid", (q: any) => q.eq("utid", utid))
    .first();
  if (adminAction) return true;

  return false;
}
