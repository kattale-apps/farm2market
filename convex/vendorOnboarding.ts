/**
 * Vendor Onboarding
 *
 * Handles mandatory location selection and market type for vendors.
 * Vendors must complete onboarding before creating listings.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { generateUTID } from "./utils";

/**
 * Check if vendor has completed onboarding
 */
export const checkOnboardingStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "vendor") {
      throw new Error("User is not a vendor");
    }

    const profile = await ctx.db
      .query("vendorProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    return {
      completed: profile?.onboardingCompleted === true && !!profile?.marketName,
      hasLocation: !!(profile?.districtId && profile?.subcountyId),
      hasMarketType: !!profile?.marketType,
      hasMarketDetails: !!profile?.marketName,
      region: profile?.region,
      districtId: profile?.districtId,
      subcountyId: profile?.subcountyId,
      parishId: profile?.parishId,
      marketType: profile?.marketType,
      marketName: profile?.marketName,
      stallNumber: profile?.stallNumber,
    };
  },
});

/**
 * Complete vendor onboarding
 * Sets location and market type, creates vendor profile
 */
export const completeOnboarding = mutation({
  args: {
    userId: v.id("users"),
    region: v.string(),
    districtId: v.id("districts"),
    subcountyId: v.id("subcounties"),
    parishId: v.optional(v.id("parishes")),
    marketType: v.union(
      v.literal("city_market"),
      v.literal("supermarket"),
      v.literal("roadside_market"),
      v.literal("town_market"),
      v.literal("village_market")
    ),
    marketName: v.string(),
    stallNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "vendor") {
      throw new Error("User is not a vendor");
    }

    // Verify location hierarchy
    const district = await ctx.db.get(args.districtId);
    if (!district || !district.active) {
      throw new Error("Invalid or inactive district");
    }

    const subcounty = await ctx.db.get(args.subcountyId);
    if (!subcounty || !subcounty.active || subcounty.districtId !== args.districtId) {
      throw new Error("Invalid or inactive subcounty for this district");
    }

    if (args.parishId) {
      const parish = await ctx.db.get(args.parishId);
      if (!parish || !parish.active || parish.subcountyId !== args.subcountyId) {
        throw new Error("Invalid or inactive parish for this subcounty");
      }
    }

    // Check for existing profile
    const existing = await ctx.db
      .query("vendorProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    const utid = generateUTID(user.role);

    if (existing) {
      await ctx.db.patch(existing._id, {
        region: args.region,
        districtId: args.districtId,
        subcountyId: args.subcountyId,
        ...(args.parishId ? { parishId: args.parishId } : {}),
        marketType: args.marketType,
        marketName: args.marketName,
        stallNumber: args.stallNumber,
        onboardingCompleted: true,
      });
    } else {
      await ctx.db.insert("vendorProfiles", {
        userId: args.userId,
        region: args.region,
        districtId: args.districtId,
        subcountyId: args.subcountyId,
        ...(args.parishId ? { parishId: args.parishId } : {}),
        marketType: args.marketType,
        marketName: args.marketName,
        stallNumber: args.stallNumber,
        onboardingCompleted: true,
        createdAt: Date.now(),
      });
    }

    // Also set onboardingCompleted on user record
    const districtText = district?.name;
    const subCountyText = subcounty?.name;
    const parishRecord = args.parishId ? await ctx.db.get(args.parishId) : null;
    const parishText = parishRecord?.name;
    await ctx.db.patch(args.userId, {
      onboardingCompleted: true,
      region: args.region,
      districtId: args.districtId,
      districtText,
      subcountyId: args.subcountyId,
      subCountyText,
      ...(args.parishId ? { parishId: args.parishId } : {}),
      parishText,
    });

    return { utid };
  },
});
