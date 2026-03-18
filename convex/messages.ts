/**
 * Messaging System
 *
 * - Users can message SuperAdmin
 * - SuperAdmin can message any user
 * - Messages are UTID-linked OR use SUPPORT thread for general help
 * - No phone numbers or identities visible to non-admins
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

const SUPPORT_THREAD = "SUPPORT";

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
    // Always include support thread (non-UTID general help)
    utidSet.add(SUPPORT_THREAD);

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

    const normalizedUtid = args.utid.trim() || SUPPORT_THREAD;

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
    const utidExists = await validateUTID(ctx, normalizedUtid);
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
      utid: normalizedUtid,
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
 * Get all message threads for SuperAdmin
 * Returns UTID threads with last message and participant details
 */
export const getAdminMessageThreads = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.adminId);
    if (!admin || admin.role !== "admin" || !isSuperAdmin(admin)) {
      throw new Error("Only SuperAdmin can view all message threads");
    }

    const messages = await ctx.db.query("messages").collect();
    const threads = new Map<string, any>();

    for (const msg of messages) {
      const existing = threads.get(msg.utid);
      if (!existing || msg.createdAt > existing.lastMessageAt) {
        threads.set(msg.utid, {
          utid: msg.utid,
          lastMessageAt: msg.createdAt,
          lastMessage: msg.message,
          lastFromUserId: msg.fromUserId,
          lastToUserId: msg.toUserId,
        });
      }
      if (msg.toUserId === args.adminId && !msg.read) {
        const current = threads.get(msg.utid);
        current.unreadCount = (current.unreadCount || 0) + 1;
        threads.set(msg.utid, current);
      }
    }

    const threadList = Array.from(threads.values()).sort(
      (a, b) => b.lastMessageAt - a.lastMessageAt
    );

    const userCache = new Map<Id<"users">, { alias: string; email?: string; phoneNumber?: string }>();
    const resolveUser = async (userId: Id<"users">) => {
      if (userCache.has(userId)) return userCache.get(userId)!;
      const user = await ctx.db.get(userId);
      const payload = {
        alias: user?.alias || "Unknown",
        email: user?.email,
        phoneNumber: user?.phoneNumber,
      };
      userCache.set(userId, payload);
      return payload;
    };

    const enriched = [];
    for (const thread of threadList) {
      const otherUserId =
        thread.lastFromUserId === args.adminId
          ? thread.lastToUserId
          : thread.lastFromUserId;
      const otherUser = await resolveUser(otherUserId);
      enriched.push({
        utid: thread.utid,
        unreadCount: thread.unreadCount || 0,
        lastMessageAt: thread.lastMessageAt,
        lastMessage: thread.lastMessage,
        otherUserId,
        otherUserAlias: otherUser.alias,
        otherUserEmail: otherUser.email,
        otherUserPhoneNumber: otherUser.phoneNumber,
      });
    }

    return enriched;
  },
});

/**
 * Helper function to validate UTID exists
 * Checks if UTID is referenced in listings, negotiations, walletLedger, etc.
 */
async function validateUTID(ctx: any, utid: string): Promise<boolean> {
  if (utid === SUPPORT_THREAD) return true;
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

/**
 * Send a message with image in community (members only)
 *
 * Rules:
 * - Members are allowed to send image messages
 * - Every image message sent by a member is ALWAYS billable (no free quota)
 * - Read messageImagePrice from the community
 * - Text-only messages remain free
 */
export const sendMessageWithImage = mutation({
  args: {
    communityId: v.id("communities"),
    userId: v.id("users"),
    imageStorageId: v.id("_storage"),
    text: v.optional(v.string()),
    replyToPostId: v.optional(v.id("noticeboardPosts")),
  },
  handler: async (ctx, args) => {
    // Fetch community to get monetisation settings
    const community = await ctx.db.get(args.communityId);
    if (!community) {
      throw new Error("Community not found");
    }

    // Fetch monetisation settings for the community
    const monetisationSettings = await ctx.db
      .query("communityMonetisationSettings")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .first();

    // Verify user is a member of the community
    const membership = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community_user", (q) =>
        q.eq("communityId", args.communityId).eq("userId", args.userId)
      )
      .first();

    if (!membership) {
      throw new Error("User is not a member of this community");
    }

    const createdAt = getUgandaTime();

    // Create the message
    const messageId = await ctx.db.insert("communityMessages", {
      communityId: args.communityId,
      userId: args.userId,
      imageStorageId: args.imageStorageId,
      text: args.text,
      replyToPostId: args.replyToPostId,
      createdAt,
    });

    // ALWAYS log billable event for image messages
    const messageImagePrice = monetisationSettings?.memberImageMessagePrice ?? 0;
    await ctx.db.insert("usageEvents", {
      communityId: args.communityId,
      userId: args.userId,
      eventType: "message_image",
      isBillable: true,
      createdAt,
      sourceModule: "qr_community",
    });

    return {
      _id: messageId,
      communityId: args.communityId,
      userId: args.userId,
      text: args.text,
      createdAt,
      isBillable: true,
      imagePrice: messageImagePrice,
    };
  },
});

/**
 * Send a text-only message in community (members only) - NO BILLING
 */
export const sendTextMessage = mutation({
  args: {
    communityId: v.id("communities"),
    userId: v.id("users"),
    text: v.string(),
    replyToPostId: v.optional(v.id("noticeboardPosts")),
  },
  handler: async (ctx, args) => {
    const community = await ctx.db.get(args.communityId);
    if (!community) {
      throw new Error("Community not found");
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const userIsSuperAdmin = user.role === "admin" && isSuperAdmin(user as any);
    const assignedCommunityIds: string[] = ((user as any).assignedCommunityIds || []).map((id: any) => String(id));
    const userIsCommunityAdmin =
      user.role === "admin" &&
      ((community as any).communityAdminId === user._id || assignedCommunityIds.includes(String(args.communityId)));

    const membership = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community_user", (q) =>
        q.eq("communityId", args.communityId).eq("userId", args.userId)
      )
      .first();

    if (!membership && !userIsSuperAdmin && !userIsCommunityAdmin) {
      throw new Error("User is not a member of this community");
    }

    const createdAt = getUgandaTime();

    // Create the message - NO BILLING for text-only
    const messageId = await ctx.db.insert("communityMessages", {
      communityId: args.communityId,
      userId: args.userId,
      imageStorageId: undefined,
      text: args.text,
      replyToPostId: args.replyToPostId,
      createdAt,
    });

    return {
      _id: messageId,
      communityId: args.communityId,
      userId: args.userId,
      text: args.text,
      createdAt,
      isBillable: false,
    };
  },
});

/**
 * Like a noticeboard post in community (members only) - NO BILLING
 */
export const likeNoticeboardPost = mutation({
  args: {
    communityId: v.id("communities"),
    postId: v.id("noticeboardPosts"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a member of the community
    const membership = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community_user", (q) =>
        q.eq("communityId", args.communityId).eq("userId", args.userId)
      )
      .first();

    if (!membership) {
      throw new Error("User is not a member of this community");
    }

    // Check if user already liked this post
    const existingLike = await ctx.db
      .query("postLikes")
      .withIndex("by_post_user", (q) =>
        q.eq("postId", args.postId).eq("userId", args.userId)
      )
      .first();

    if (existingLike) {
      throw new Error("User already liked this post");
    }

    const createdAt = getUgandaTime();

    const likeId = await ctx.db.insert("postLikes", {
      postId: args.postId,
      userId: args.userId,
      communityId: args.communityId,
      createdAt,
    });

    return {
      _id: likeId,
      postId: args.postId,
      userId: args.userId,
      createdAt,
      isBillable: false,
    };
  },
});

/**
 * Dislike a noticeboard post in community (members only) - NO BILLING
 */
export const dislikeNoticeboardPost = mutation({
  args: {
    communityId: v.id("communities"),
    postId: v.id("noticeboardPosts"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify user is a member of the community
    const membership = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community_user", (q) =>
        q.eq("communityId", args.communityId).eq("userId", args.userId)
      )
      .first();

    if (!membership) {
      throw new Error("User is not a member of this community");
    }

    // Check if user already disliked this post
    const existingDislike = await ctx.db
      .query("postDislikes")
      .withIndex("by_post_user", (q) =>
        q.eq("postId", args.postId).eq("userId", args.userId)
      )
      .first();

    if (existingDislike) {
      throw new Error("User already disliked this post");
    }

    const createdAt = getUgandaTime();

    const dislikeId = await ctx.db.insert("postDislikes", {
      postId: args.postId,
      userId: args.userId,
      communityId: args.communityId,
      createdAt,
    });

    return {
      _id: dislikeId,
      postId: args.postId,
      userId: args.userId,
      createdAt,
      isBillable: false,
    };
  },
});

/**
 * Unlike a noticeboard post (toggle dislike) - NO BILLING
 */
export const unlikeNoticeboardPost = mutation({
  args: {
    communityId: v.id("communities"),
    postId: v.id("noticeboardPosts"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existingLike = await ctx.db
      .query("postLikes")
      .withIndex("by_post_user", (q) =>
        q.eq("postId", args.postId).eq("userId", args.userId)
      )
      .first();

    if (existingLike) {
      await ctx.db.delete(existingLike._id);
    }

    return { removed: !!existingLike };
  },
});

/**
 * Undislike a noticeboard post (toggle dislike) - NO BILLING
 */
export const undislikeNoticeboardPost = mutation({
  args: {
    communityId: v.id("communities"),
    postId: v.id("noticeboardPosts"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existingDislike = await ctx.db
      .query("postDislikes")
      .withIndex("by_post_user", (q) =>
        q.eq("postId", args.postId).eq("userId", args.userId)
      )
      .first();

    if (existingDislike) {
      await ctx.db.delete(existingDislike._id);
    }

    return { removed: !!existingDislike };
  },
});

/**
 * Get like count for a post
 */
export const getPostLikeCount = query({
  args: {
    postId: v.id("noticeboardPosts"),
  },
  handler: async (ctx, args) => {
    const likes = await ctx.db
      .query("postLikes")
      .withIndex("by_post_user", (q) => q.eq("postId", args.postId))
      .collect();

    return likes.length;
  },
});

/**
 * Get dislike count for a post
 */
export const getPostDislikeCount = query({
  args: {
    postId: v.id("noticeboardPosts"),
  },
  handler: async (ctx, args) => {
    const dislikes = await ctx.db
      .query("postDislikes")
      .withIndex("by_post_user", (q) => q.eq("postId", args.postId))
      .collect();

    return dislikes.length;
  },
});

/**
 * Check user's engagement status with a post
 */
export const getUserPostEngagement = query({
  args: {
    postId: v.id("noticeboardPosts"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const like = await ctx.db
      .query("postLikes")
      .withIndex("by_post_user", (q) =>
        q.eq("postId", args.postId).eq("userId", args.userId)
      )
      .first();

    const dislike = await ctx.db
      .query("postDislikes")
      .withIndex("by_post_user", (q) =>
        q.eq("postId", args.postId).eq("userId", args.userId)
      )
      .first();

    return {
      liked: !!like,
      disliked: !!dislike,
    };
  },
});

/**
 * Get community messages (for noticeboard post replies)
 */
export const getCommunityMessages = query({
  args: {
    communityId: v.id("communities"),
    userId: v.optional(v.id("users")),
    replyToPostId: v.optional(v.id("noticeboardPosts")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const baseQuery = ctx.db
      .query("communityMessages")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId));

    const allMessages = await baseQuery.collect();
    let scopedMessages = args.replyToPostId
      ? allMessages.filter((m) => m.replyToPostId === args.replyToPostId)
      : allMessages;

    // Backward-compatible fallback when viewer context is not provided.
    if (!args.userId) {
      return scopedMessages
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, args.limit ?? 100);
    }

    const viewerId = args.userId;
    const viewer = await ctx.db.get(viewerId);
    if (!viewer) {
      throw new Error("User not found");
    }

    const community = await ctx.db.get(args.communityId);
    if (!community) {
      throw new Error("Community not found");
    }

    const viewerIsSuperAdmin = viewer.role === "admin" && isSuperAdmin(viewer as any);
    const viewerAssigned: string[] = ((viewer as any).assignedCommunityIds || []).map((id: any) => String(id));
    const viewerIsCommunityAdmin =
      viewer.role === "admin" &&
      ((community as any).communityAdminId === viewer._id || viewerAssigned.includes(String(args.communityId)));

    const membership = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community_user", (q) =>
        q.eq("communityId", args.communityId).eq("userId", viewerId)
      )
      .first();

    const approvedMember = await ctx.db
      .query("communityMembers")
      .withIndex("by_community_farmer", (q) =>
        q.eq("communityId", args.communityId).eq("farmerId", viewerId)
      )
      .first();

    const viewerIsMember = !!membership || (approvedMember?.status === "APPROVED");

    if (!viewerIsSuperAdmin && !viewerIsCommunityAdmin && !viewerIsMember) {
      throw new Error("Not authorized to view community messages");
    }

    const targets = await ctx.db
      .query("messageTargets")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .collect();

    const targetByMessageId = new Map<string, any>();
    for (const t of targets) {
      targetByMessageId.set(String(t.messageId), t);
    }

    const visible = scopedMessages.filter((m) => {
      const target = targetByMessageId.get(String(m._id));
      if (!target) return true;

      // SuperAdmin must always be able to audit all targeted messages.
      if (viewerIsSuperAdmin) return true;

      // Sender should always see own message regardless of target.
      if (String(m.userId) === String(viewerId)) return true;

      if (target.targetType === "all") return true;
      if (target.targetType === "superadmin") return false;
      if (target.targetType === "role") return target.targetRole === viewer.role;
      if (target.targetType === "individual") {
        return (target.targetUserIds || []).some((uid: Id<"users">) => String(uid) === String(viewerId));
      }
      return true;
    });

    return visible
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, args.limit ?? 100);
  },
});

/**
 * Get community members with role info for targeted messaging
 */
export const getCommunityMembersForMessaging = query({
  args: {
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
      .collect();

    const members: any[] = [];
    for (const m of memberships) {
      const user = await ctx.db.get(m.userId);
      if (user) {
        members.push({
          userId: user._id,
          alias: user.alias || "Unknown",
          role: user.role || "farmer",
          email: user.email,
          phoneNumber: user.phoneNumber,
        });
      }
    }

    // Also get super admin
    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();
    const superAdmin = admins.find(
      (a) => a.adminLevel === "super" || a.adminLevel === undefined
    );
    if (superAdmin) {
      // Add super admin if not already in the list
      const alreadyIn = members.some((m) => String(m.userId) === String(superAdmin._id));
      if (!alreadyIn) {
        members.push({
          userId: superAdmin._id,
          alias: superAdmin.alias || "Super Admin",
          role: "superadmin",
          email: superAdmin.email,
          phoneNumber: superAdmin.phoneNumber,
        });
      }
    }

    return members;
  },
});

/**
 * Send a targeted community message to specific members or role groups
 */
export const sendTargetedCommunityMessage = mutation({
  args: {
    communityId: v.id("communities"),
    userId: v.id("users"),
    text: v.string(),
    targetType: v.union(
      v.literal("all"),
      v.literal("individual"),
      v.literal("role"),
      v.literal("superadmin")
    ),
    targetUserIds: v.optional(v.array(v.id("users"))),
    targetRole: v.optional(v.string()),
    replyToPostId: v.optional(v.id("noticeboardPosts")),
  },
  handler: async (ctx, args) => {
    if (!args.text.trim()) throw new Error("Message cannot be empty");

    const createdAt = getUgandaTime();

    // Create the community message with targeting metadata
    const messageId = await ctx.db.insert("communityMessages", {
      communityId: args.communityId,
      userId: args.userId,
      imageStorageId: undefined,
      text: args.text.trim(),
      replyToPostId: args.replyToPostId,
      createdAt,
    });

    // Store targeting metadata as a separate record for filtering
    await ctx.db.insert("messageTargets", {
      messageId,
      communityId: args.communityId,
      targetType: args.targetType,
      targetUserIds: args.targetUserIds,
      targetRole: args.targetRole,
      createdAt,
    });

    return {
      _id: messageId,
      communityId: args.communityId,
      userId: args.userId,
      text: args.text,
      targetType: args.targetType,
      replyToPostId: args.replyToPostId,
      createdAt,
    };
  },
});
