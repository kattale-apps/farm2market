import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";

/**
 * Create a noticeboard image post (admin only)
 * 
 * Rules:
 * - Only the community admin can create noticeboard image posts
 * - Free quota applies per month (freeImageQuotaPerMonth)
 * - If over quota, charge imagePostPrice and log billable event
 * - Members cannot create noticeboard image posts
 */
export const createNoticeboardImagePost = mutation({
  args: {
    communityId: v.id("communities"),
    userId: v.id("users"),
    imageStorageId: v.id("_storage"),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Fetch community
    const community = await ctx.db.get(args.communityId);
    if (!community) {
      throw new Error("Community not found");
    }

    // Fetch monetisation settings for quota and pricing
    const monetisationSettings = await ctx.db
      .query("communityMonetisationSettings")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .first();

    // Verify user is the community admin
    const isAdmin = community.communityAdminId === args.userId;
    if (!isAdmin) {
      throw new Error("Only the community admin can create noticeboard image posts");
    }

    // Get current month for quota tracking
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Count existing noticeboard image posts by this admin this month
    const currentMonthPosts = await ctx.db
      .query("noticeboardPosts")
      .filter((q) =>
        q.and(
          q.eq(q.field("communityId"), args.communityId),
          q.eq(q.field("adminId"), args.userId),
          q.eq(q.field("monthKey"), monthKey)
        )
      )
      .collect();

    const usageCount = currentMonthPosts.length;
    const freeQuota = monetisationSettings?.juniorAdminFreeMonthlyImageQuota ?? 0;
    const isWithinQuota = usageCount < freeQuota;

    const createdAt = getUgandaTime();

    // Create the noticeboard post
    const postId = await ctx.db.insert("noticeboardPosts", {
      communityId: args.communityId,
      adminId: args.userId,
      imageStorageId: args.imageStorageId,
      caption: args.caption,
      monthKey, // Track which month this post was created
      createdAt,
    });

    // Log billable event if over quota
    if (!isWithinQuota) {
      const imagePostPrice = monetisationSettings?.juniorAdminImagePrice ?? 0;
      await ctx.db.insert("usageEvents", {
        communityId: args.communityId,
        userId: args.userId,
        eventType: "noticeboard_image_post",
        isBillable: true,
        createdAt,
        sourceModule: "qr_community",
      });
    }

    return {
      _id: postId,
      communityId: args.communityId,
      adminId: args.userId,
      caption: args.caption,
      createdAt,
      isBillable: !isWithinQuota,
      usageCount: usageCount + 1, // Include the just-created post
      freeQuota,
    };
  },
});

/**
 * Get noticeboard posts for a community
 */
export const getCommunityNoticeboardPosts = query({
  args: {
    communityId: v.id("communities"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query("noticeboardPosts")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .order("desc")
      .take(args.limit ?? 100);

    return posts;
  },
});

/**
 * Get admin noticeboard quota status for current month
 */
export const getAdminNoticeboardQuotaStatus = query({
  args: {
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    // Get community
    const community = await ctx.db.get(args.communityId);
    if (!community) {
      throw new Error("Community not found");
    }

    // Get monetisation settings
    const monetisationSettings = await ctx.db
      .query("communityMonetisationSettings")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .first();

    const quota = monetisationSettings?.juniorAdminFreeMonthlyImageQuota ?? 0;

    // Get current month
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Count noticeboard posts created this month
    const monthPosts = await ctx.db
      .query("noticeboardPosts")
      .filter((q) =>
        q.and(
          q.eq(q.field("communityId"), args.communityId),
          q.eq(q.field("monthKey"), monthKey)
        )
      )
      .collect();

    const used = monthPosts.length;
    const remaining = Math.max(0, quota - used);

    return {
      quota,
      used,
      remaining,
    };
  },
});

/**
 * Send text message to community (free)
 * 
 * Can be a reply to a noticeboard post or a standalone message
 */
export const sendNoticeboardTextMessage = mutation({
  args: {
    communityId: v.id("communities"),
    text: v.string(),
    replyToPostId: v.optional(v.id("noticeboardPosts")),
  },
  handler: async (ctx, args) => {
    const adminUser = await ctx.auth.getUserIdentity();
    if (!adminUser) {
      throw new Error("Not authenticated");
    }

    // Get user
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("userId"), adminUser.tokenIdentifier))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Verify membership
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

    // Create message
    const messageId = await ctx.db.insert("communityMessages", {
      communityId: args.communityId,
      userId: user._id,
      text: args.text.trim(),
      replyToPostId: args.replyToPostId || undefined,
      createdAt: Date.now(),
    });

    return messageId;
  },
});

/**
 * Send image message to community (payment required)
 * 
 * Call this after payment is confirmed
 * Can be a reply to a noticeboard post
 */
export const sendImageMessage = mutation({
  args: {
    communityId: v.id("communities"),
    imageStorageId: v.id("_storage"),
    caption: v.optional(v.string()),
    replyToPostId: v.optional(v.id("noticeboardPosts")),
    paymentId: v.id("payments"), // Link to the payment that authorized this
  },
  handler: async (ctx, args) => {
    const adminUser = await ctx.auth.getUserIdentity();
    if (!adminUser) {
      throw new Error("Not authenticated");
    }

    // Get user
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("userId"), adminUser.tokenIdentifier))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Verify membership
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

    // Verify payment was successful
    const payment = await ctx.db.get(args.paymentId);
    if (!payment || payment.status !== "paid") {
      throw new Error("Payment not verified. Please try again.");
    }

    // Create message with image
    const messageId = await ctx.db.insert("communityMessages", {
      communityId: args.communityId,
      userId: user._id,
      imageStorageId: args.imageStorageId,
      text: args.caption?.trim() || undefined,
      replyToPostId: args.replyToPostId || undefined,
      createdAt: Date.now(),
    });

    return messageId;
  },
});

/**
 * Toggle like on a noticeboard post (free engagement)
 */
export const togglePostLike = mutation({
  args: {
    postId: v.id("noticeboardPosts"),
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    const adminUser = await ctx.auth.getUserIdentity();
    if (!adminUser) {
      throw new Error("Not authenticated");
    }

    // Get user
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("userId"), adminUser.tokenIdentifier))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Check if user already liked
    const existingLike = await ctx.db
      .query("postLikes")
      .filter((q) =>
        q.and(
          q.eq(q.field("postId"), args.postId),
          q.eq(q.field("userId"), user._id)
        )
      )
      .first();

    if (existingLike) {
      // Remove like
      await ctx.db.delete(existingLike._id);
      return { liked: false };
    } else {
      // Add like and remove dislike if exists
      const existingDislike = await ctx.db
        .query("postDislikes")
        .filter((q) =>
          q.and(
            q.eq(q.field("postId"), args.postId),
            q.eq(q.field("userId"), user._id)
          )
        )
        .first();

      if (existingDislike) {
        await ctx.db.delete(existingDislike._id);
      }

      await ctx.db.insert("postLikes", {
        postId: args.postId,
        userId: user._id,
        communityId: args.communityId,
        createdAt: Date.now(),
      });

      return { liked: true };
    }
  },
});

/**
 * Toggle dislike on a noticeboard post (free engagement)
 */
export const togglePostDislike = mutation({
  args: {
    postId: v.id("noticeboardPosts"),
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    const adminUser = await ctx.auth.getUserIdentity();
    if (!adminUser) {
      throw new Error("Not authenticated");
    }

    // Get user
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("userId"), adminUser.tokenIdentifier))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    // Check if user already disliked
    const existingDislike = await ctx.db
      .query("postDislikes")
      .filter((q) =>
        q.and(
          q.eq(q.field("postId"), args.postId),
          q.eq(q.field("userId"), user._id)
        )
      )
      .first();

    if (existingDislike) {
      // Remove dislike
      await ctx.db.delete(existingDislike._id);
      return { disliked: false };
    } else {
      // Add dislike and remove like if exists
      const existingLike = await ctx.db
        .query("postLikes")
        .filter((q) =>
          q.and(
            q.eq(q.field("postId"), args.postId),
            q.eq(q.field("userId"), user._id)
          )
        )
        .first();

      if (existingLike) {
        await ctx.db.delete(existingLike._id);
      }

      await ctx.db.insert("postDislikes", {
        postId: args.postId,
        userId: user._id,
        communityId: args.communityId,
        createdAt: Date.now(),
      });

      return { disliked: true };
    }
  },
});
