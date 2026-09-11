/**
 * Trader Onboarding
 *
 * Minimal mandatory profile step for traders: a business/trading name and
 * their trading location. Traders must complete onboarding before accessing
 * the dashboard.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Check if trader has completed onboarding
 */
export const checkOnboardingStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "trader") {
      throw new Error("User is not a trader");
    }

    const profile = await ctx.db
      .query("traderProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    return {
      completed: profile?.onboardingCompleted === true,
      businessName: profile?.businessName,
      region: profile?.region,
      districtId: profile?.districtId,
      subcountyId: profile?.subcountyId,
    };
  },
});

/**
 * Complete trader onboarding
 * Sets business name and trading location, creates trader profile
 */
export const completeOnboarding = mutation({
  args: {
    userId: v.id("users"),
    businessName: v.string(),
    region: v.optional(v.string()),
    districtId: v.id("districts"),
    subcountyId: v.optional(v.id("subcounties")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "trader") {
      throw new Error("User is not a trader");
    }

    if (!args.businessName.trim()) {
      throw new Error("Business name is required");
    }

    const district = await ctx.db.get(args.districtId);
    if (!district || !district.active) {
      throw new Error("Invalid or inactive district");
    }

    if (args.subcountyId) {
      const subcounty = await ctx.db.get(args.subcountyId);
      if (!subcounty || !subcounty.active || subcounty.districtId !== args.districtId) {
        throw new Error("Invalid subcounty for this district");
      }
    }

    const existing = await ctx.db
      .query("traderProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    const profileData = {
      businessName: args.businessName.trim(),
      region: args.region,
      districtId: args.districtId,
      subcountyId: args.subcountyId,
      onboardingCompleted: true,
    };

    if (existing) {
      await ctx.db.patch(existing._id, profileData);
    } else {
      await ctx.db.insert("traderProfiles", {
        userId: args.userId,
        ...profileData,
        createdAt: Date.now(),
      });
    }

    const patchData: any = { onboardingCompleted: true, districtId: args.districtId, districtText: district.name };
    if (args.region) patchData.region = args.region;
    if (args.subcountyId) {
      const subcounty = await ctx.db.get(args.subcountyId);
      if (subcounty) {
        patchData.subcountyId = args.subcountyId;
        patchData.subCountyText = subcounty.name;
      }
    }
    await ctx.db.patch(args.userId, patchData);

    return { success: true };
  },
});
