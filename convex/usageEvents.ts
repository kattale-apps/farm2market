import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";

/**
 * Log a usage event for billing and analytics tracking
 * Used to track user actions in community-only features
 */
export const logUsageEvent = mutation({
  args: {
    communityId: v.id("communities"),
    userId: v.id("users"),
    eventType: v.string(),
    isBillable: v.boolean(),
    sourceModule: v.optional(v.string()),
    apkFlavourId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const createdAt = getUgandaTime();

    const eventId = await ctx.db.insert("usageEvents", {
      communityId: args.communityId,
      userId: args.userId,
      eventType: args.eventType,
      isBillable: args.isBillable,
      createdAt,
      sourceModule: args.sourceModule,
      apkFlavourId: args.apkFlavourId,
    });

    return {
      _id: eventId,
      ...args,
      createdAt,
    };
  },
});

/**
 * Get usage events for a community
 */
export const getCommunityUsageEvents = query({
  args: {
    communityId: v.id("communities"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("usageEvents")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .order("desc")
      .take(args.limit ?? 100);

    return events;
  },
});

/**
 * Get usage events for a user in a community
 */
export const getUserCommunityUsageEvents = query({
  args: {
    communityId: v.id("communities"),
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("usageEvents")
      .withIndex("by_community_user", (q) =>
        q.eq("communityId", args.communityId).eq("userId", args.userId)
      )
      .order("desc")
      .take(args.limit ?? 100);

    return events;
  },
});

/**
 * Get billable events for a community and date range
 */
export const getBillableEventsForCommunity = query({
  args: {
    communityId: v.id("communities"),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, args) => {
    const allEvents = await ctx.db
      .query("usageEvents")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .collect();

    const billableEvents = allEvents.filter(
      (event) =>
        event.isBillable &&
        event.createdAt >= args.startTime &&
        event.createdAt <= args.endTime
    );

    return billableEvents;
  },
});

/**
 * Get usage summary for a community for the current month
 * Groups billable events by type and calculates totals
 */
export const getCommunityUsageSummary = query({
  args: {
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    // Get community to verify it exists
    const community = await ctx.db.get(args.communityId);
    if (!community) {
      throw new Error("Community not found");
    }

    // Get monetisation settings for pricing
    const monetisationSettings = await ctx.db
      .query("communityMonetisationSettings")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .first();

    // Get current month's date range
    const now = getUgandaTime();
    const currentMonthStart = new Date(now);
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const monthStartTime = currentMonthStart.getTime();

    const nextMonth = new Date(currentMonthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthEndTime = nextMonth.getTime() - 1;

    // Get all events for community in current month
    const allEvents = await ctx.db
      .query("usageEvents")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .collect();

    const monthEvents = allEvents.filter(
      (event) => event.createdAt >= monthStartTime && event.createdAt <= monthEndTime
    );

    // Initialize counters
    let totalNoticeboardImagePosts = 0;
    let totalBillableNoticeboardImagePosts = 0;
    let totalMessageImages = 0;
    let totalBillableMessageImages = 0;
    let totalAmount = 0;

    // Group by event type
    const breakdownMap: Record<
      string,
      { count: number; billableCount: number; totalAmount: number }
    > = {};

    for (const event of monthEvents) {
      if (!breakdownMap[event.eventType]) {
        breakdownMap[event.eventType] = {
          count: 0,
          billableCount: 0,
          totalAmount: 0,
        };
      }

      breakdownMap[event.eventType].count++;

      // Track noticeboard image posts
      if (event.eventType === "noticeboard_image_post") {
        totalNoticeboardImagePosts++;
        if (event.isBillable) {
          totalBillableNoticeboardImagePosts++;
          breakdownMap[event.eventType].billableCount++;
          const amount = (monetisationSettings?.juniorAdminImagePrice as number) || 0;
          breakdownMap[event.eventType].totalAmount += amount;
          totalAmount += amount;
        }
      }
      // Track message images
      else if (event.eventType === "message_image") {
        totalMessageImages++;
        if (event.isBillable) {
          totalBillableMessageImages++;
          breakdownMap[event.eventType].billableCount++;
          const amount = (monetisationSettings?.memberImageMessagePrice as number) || 0;
          breakdownMap[event.eventType].totalAmount += amount;
          totalAmount += amount;
        }
      }
    }

    // Convert breakdown map to array
    const breakdown = Object.entries(breakdownMap).map(([type, data]) => ({
      type,
      count: data.count,
      billableCount: data.billableCount,
      totalAmount: data.totalAmount,
    }));

    return {
      totalNoticeboardImagePosts,
      totalBillableNoticeboardImagePosts,
      totalMessageImages,
      totalBillableMessageImages,
      totalAmount,
      breakdown,
    };
  },
});