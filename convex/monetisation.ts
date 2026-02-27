/**
 * Community Monetisation Services
 * 
 * Handles:
 * - Monetisation settings management
 * - Payment tracking
 * - Junior admin quota enforcement
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Create or update monetisation settings for a community
 */
export const setMonetisationSettings = mutation({
  args: {
    communityId: v.id("communities"),
    juniorAdminFreeMonthlyImageQuota: v.number(),
    juniorAdminImagePrice: v.number(),
    memberImageMessagePrice: v.number(),
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify admin is superadmin
    const admin = await ctx.db.get(args.adminId);
    if (!admin || admin.adminLevel !== "super") {
      throw new Error("Only superadmin can set monetisation settings");
    }

    // Check if settings already exist
    const existing = await ctx.db
      .query("communityMonetisationSettings")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing settings
      await ctx.db.patch(existing._id, {
        juniorAdminFreeMonthlyImageQuota: args.juniorAdminFreeMonthlyImageQuota,
        juniorAdminImagePrice: args.juniorAdminImagePrice,
        memberImageMessagePrice: args.memberImageMessagePrice,
        updatedAt: now,
        updatedBy: args.adminId,
      });
      return existing._id;
    } else {
      // Create new settings
      return await ctx.db.insert("communityMonetisationSettings", {
        communityId: args.communityId,
        juniorAdminFreeMonthlyImageQuota: args.juniorAdminFreeMonthlyImageQuota,
        juniorAdminImagePrice: args.juniorAdminImagePrice,
        memberImageMessagePrice: args.memberImageMessagePrice,
        createdAt: now,
        updatedAt: now,
        updatedBy: args.adminId,
      });
    }
  },
});

/**
 * Get monetisation settings for a community
 */
export const getMonetisationSettings = query({
  args: {
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("communityMonetisationSettings")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .first();
  },
});

/**
 * Create a payment record
 * Called when user initiates action requiring payment
 */
export const createPayment = mutation({
  args: {
    communityId: v.id("communities"),
    userId: v.id("users"),
    paymentType: v.union(
      v.literal("juniorAdminImagePost"),
      v.literal("memberImageMessage"),
      v.literal("other")
    ),
    payableAmount: v.number(),
    relatedEntityId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("payments", {
      communityId: args.communityId,
      userId: args.userId,
      paymentType: args.paymentType,
      payableAmount: args.payableAmount,
      billedAmount: 0,
      status: "pending",
      relatedEntityId: args.relatedEntityId,
      createdAt: now,
    });
  },
});

/**
 * Get latest payment for a user's action
 */
export const getLatestPayment = query({
  args: {
    communityId: v.id("communities"),
    userId: v.id("users"),
    paymentType: v.union(
      v.literal("juniorAdminImagePost"),
      v.literal("memberImageMessage"),
      v.literal("other")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payments")
      .withIndex("by_type", (q) => q.eq("paymentType", args.paymentType))
      .filter((q) =>
        q.and(
          q.eq(q.field("communityId"), args.communityId),
          q.eq(q.field("userId"), args.userId)
        )
      )
      .order("desc")
      .first();
  },
});

/**
 * Confirm payment after Pesapal verification
 */
export const confirmPayment = mutation({
  args: {
    paymentId: v.id("payments"),
    pesapalTrackingId: v.optional(v.string()),
    billedAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) {
      throw new Error("Payment not found");
    }

    await ctx.db.patch(args.paymentId, {
      status: "paid",
      billedAmount: args.billedAmount,
      pesapalTrackingId: args.pesapalTrackingId,
      paidAt: Date.now(),
    });

    return args.paymentId;
  },
});

/**
 * Mark payment as failed
 */
export const failPayment = mutation({
  args: {
    paymentId: v.id("payments"),
    failedReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) {
      throw new Error("Payment not found");
    }

    await ctx.db.patch(args.paymentId, {
      status: "failed",
      failedReason: args.failedReason,
    });

    return args.paymentId;
  },
});

/**
 * Get current month key (YYYY-MM format)
 */
function getMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Get or create quota tracker for junior admin
 */
export const getOrCreateQuotaTracker = mutation({
  args: {
    communityId: v.id("communities"),
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const monthKey = getMonthKey();
    const now = Date.now();

    let tracker = await ctx.db
      .query("juniorAdminImageQuota")
      .withIndex("by_community_admin", (q) =>
        q.eq("communityId", args.communityId).eq("adminId", args.adminId)
      )
      .filter((q) => q.eq(q.field("monthKey"), monthKey))
      .first();

    if (!tracker) {
      const trackerId = await ctx.db.insert("juniorAdminImageQuota", {
        communityId: args.communityId,
        adminId: args.adminId,
        monthKey: monthKey,
        usedQuota: 0,
        lastQuotaResetAt: now,
        resetsAt: getNextMonthTimestamp(now),
        createdAt: now,
        updatedAt: now,
      });

      tracker = await ctx.db.get(trackerId);
    }

    return tracker;
  },
});

/**
 * Decrement quota for junior admin
 */
export const decrementQuota = mutation({
  args: {
    trackerId: v.id("juniorAdminImageQuota"),
  },
  handler: async (ctx, args) => {
    const tracker = await ctx.db.get(args.trackerId);
    if (!tracker) {
      throw new Error("Quota tracker not found");
    }

    await ctx.db.patch(args.trackerId, {
      usedQuota: tracker.usedQuota + 1,
      updatedAt: Date.now(),
    });

    return args.trackerId;
  },
});

/**
 * Check remaining quota for junior admin
 */
export const getRemainingQuota = query({
  args: {
    communityId: v.id("communities"),
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get monetisation settings
    const settings = await ctx.db
      .query("communityMonetisationSettings")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .first();

    if (!settings) {
      return 0; // No settings configured
    }

    const monthKey = getMonthKey();

    // Get quota tracker
    const tracker = await ctx.db
      .query("juniorAdminImageQuota")
      .withIndex("by_community_admin", (q) =>
        q.eq("communityId", args.communityId).eq("adminId", args.adminId)
      )
      .filter((q) => q.eq(q.field("monthKey"), monthKey))
      .first();

    if (!tracker) {
      // No tracker yet means full quota is available
      return settings.juniorAdminFreeMonthlyImageQuota;
    }

    const remaining = Math.max(
      0,
      settings.juniorAdminFreeMonthlyImageQuota - tracker.usedQuota
    );

    return remaining;
  },
});

/**
 * Helper: Get timestamp for next month's reset
 */
function getNextMonthTimestamp(now: number): number {
  const date = new Date(now);
  date.setMonth(date.getMonth() + 1);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Get Junior Admin Messaging Dashboard
 * Returns all data needed for the junior admin to manage their community
 * Filtered to ONLY the admin's own community
 */
export const getJuniorAdminMessagingDashboard = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get admin user and their community
    const adminUser = await ctx.db.get(args.adminId);
    if (!adminUser || !adminUser.assignedCommunityIds || adminUser.assignedCommunityIds.length === 0) {
      throw new Error("Admin user not found or not assigned to a community");
    }

    const communityId = adminUser.assignedCommunityIds[0];

    // Get community data
    const community = await ctx.db.get(communityId);
    if (!community) {
      throw new Error("Community not found");
    }

    // Get monetisation settings
    const monetisationSettings = await ctx.db
      .query("communityMonetisationSettings")
      .withIndex("by_community", (q) => q.eq("communityId", communityId))
      .first();

    // Get quota tracker for this month
    const monthKey = getMonthKey();
    const quotaTracker = await ctx.db
      .query("juniorAdminImageQuota")
      .withIndex("by_community_admin", (q) =>
        q.eq("communityId", communityId).eq("adminId", args.adminId)
      )
      .filter((q) => q.eq(q.field("monthKey"), monthKey))
      .first();

    const freeQuota = monetisationSettings?.juniorAdminFreeMonthlyImageQuota || 0;
    const usedThisMonth = quotaTracker?.usedQuota || 0;
    const remaining = Math.max(0, freeQuota - usedThisMonth);

    // Get all payments for this admin in current month (payable + billed)
    const allPayments = await ctx.db
      .query("payments")
      .withIndex("by_user", (q) => q.eq("userId", args.adminId))
      .filter((q) =>
        q.and(
          q.eq(q.field("communityId"), communityId),
          q.eq(q.field("paymentType"), "juniorAdminImagePost")
        )
      )
      .collect();

    // Sum up pending (payable) and paid (billed) amounts
    let payableAmount = 0;
    let billedAmount = 0;
    for (const payment of allPayments) {
      if (payment.status === "pending") {
        payableAmount += payment.payableAmount;
      } else if (payment.status === "paid") {
        billedAmount += payment.billedAmount;
      }
    }

    // Get noticeboard posts for this community (all admins' posts)
    const noticeboardPosts = await ctx.db
      .query("noticeboardPosts")
      .filter((q) => q.eq(q.field("communityId"), communityId))
      .order("desc")
      .take(50);

    // Get all messages for this community
    const communityMessages = await ctx.db
      .query("communityMessages")
      .filter((q) => q.eq(q.field("communityId"), communityId))
      .order("desc")
      .take(200);

    return {
      community,
      quota: {
        freeQuota,
        usedThisMonth,
        remaining,
      },
      pricing: {
        imagePostPrice: monetisationSettings?.juniorAdminImagePrice || 0,
      },
      payableAmount,
      billedAmount,
      noticeboardPosts,
      communityMessages,
      quotaTrackerId: quotaTracker?._id,
    };
  },
});

/**
 * Get messaging feed for regular community members
 * 
 * Returns:
 * - Community data
 * - Admin noticeboard posts
 * - Member replies to posts
 * - Image message pricing
 * - Like/dislike counts per post
 */
export const getMemberMessagingFeed = query({
  args: { communityId: v.id("communities") },
  handler: async (ctx, args) => {
    const adminUser = await ctx.auth.getUserIdentity();
    if (!adminUser) {
      throw new Error("Not authenticated");
    }

    // Get user from DB
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("userId"), adminUser.tokenIdentifier))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Get community
    const community = await ctx.db.get(args.communityId);
    if (!community) {
      throw new Error("Community not found");
    }

    // Verify user is a member of the community (not admin)
    const membership = await ctx.db
      .query("communityMemberships")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), user._id),
          q.eq(q.field("communityId"), args.communityId)
        )
      )
      .first();

    if (!membership) {
      throw new Error("You are not a member of this community");
    }

    // Members cannot be the community admin
    if (community.communityAdminId === user._id) {
      throw new Error("Admins should use the admin messaging screen");
    }

    // Get monetisation settings for image pricing
    const monetisationSettings = await ctx.db
      .query("communityMonetisationSettings")
      .filter((q) => q.eq(q.field("communityId"), args.communityId))
      .first();

    const messageImagePrice = monetisationSettings?.memberImageMessagePrice || 0;

    // Get noticeboard posts (all admin posts for this community)
    const noticeboardPosts = await ctx.db
      .query("noticeboardPosts")
      .filter((q) => q.eq(q.field("communityId"), args.communityId))
      .order("desc")
      .take(50);

    // Get all replies to these posts from the community
    const replies = await ctx.db
      .query("communityMessages")
      .filter((q) => q.eq(q.field("communityId"), args.communityId))
      .order("desc")
      .take(200);

    // For each post, count likes and dislikes
    const postInteractions: Record<
      string,
      { likeCount: number; dislikeCount: number; userLiked: boolean; userDisliked: boolean }
    > = {};

    for (const post of noticeboardPosts) {
      const likes = await ctx.db
        .query("postLikes")
        .filter((q) =>
          q.and(q.eq(q.field("postId"), post._id), q.eq(q.field("communityId"), args.communityId))
        )
        .collect();

      const dislikes = await ctx.db
        .query("postDislikes")
        .filter((q) =>
          q.and(q.eq(q.field("postId"), post._id), q.eq(q.field("communityId"), args.communityId))
        )
        .collect();

      const userLike = likes.find((l) => l.userId === user._id);
      const userDislike = dislikes.find((d) => d.userId === user._id);

      postInteractions[post._id] = {
        likeCount: likes.length,
        dislikeCount: dislikes.length,
        userLiked: !!userLike,
        userDisliked: !!userDislike,
      };
    }

    return {
      community,
      noticeboardPosts,
      replies,
      messageImagePrice,
      postInteractions,
    };
  },
});
