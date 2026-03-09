/**
 * Transporter Onboarding
 *
 * Handles mandatory vehicle details and departure location for transporters.
 * Transporters must complete onboarding before accessing the dashboard.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { generateUTID } from "./utils";

/**
 * Check if transporter has completed onboarding
 */
export const checkOnboardingStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "transporter") {
      throw new Error("User is not a transporter");
    }

    const profile = await ctx.db
      .query("transporterProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    return {
      completed: profile?.onboardingCompleted === true,
      hasVehicleInfo: !!(profile?.vehicleType && profile?.weightCapacityTonnes),
      vehicleType: profile?.vehicleType,
      vehicleTypeCustom: profile?.vehicleTypeCustom,
      weightCapacityTonnes: profile?.weightCapacityTonnes,
      vehicleCount: profile?.vehicleCount,
      departureRegion: profile?.departureRegion,
      departureDistrictId: profile?.departureDistrictId,
      departureSubcountyId: profile?.departureSubcountyId,
    };
  },
});

/**
 * Complete transporter onboarding
 * Sets vehicle details and departure location, creates transporter profile
 */
export const completeOnboarding = mutation({
  args: {
    userId: v.id("users"),
    vehicleType: v.union(
      v.literal("cold_storage"),
      v.literal("open_pickup"),
      v.literal("box_body")
    ),
    vehicleTypeCustom: v.optional(v.string()),
    weightCapacityTonnes: v.number(),
    vehicleCount: v.number(),
    departureRegion: v.optional(v.string()),
    departureDistrictId: v.optional(v.id("districts")),
    departureSubcountyId: v.optional(v.id("subcounties")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "transporter") {
      throw new Error("User is not a transporter");
    }

    if (args.weightCapacityTonnes <= 0) {
      throw new Error("Weight capacity must be greater than 0");
    }
    if (args.vehicleCount <= 0) {
      throw new Error("Vehicle count must be at least 1");
    }

    // Verify departure location if provided
    if (args.departureDistrictId) {
      const district = await ctx.db.get(args.departureDistrictId);
      if (!district || !district.active) {
        throw new Error("Invalid or inactive departure district");
      }
    }

    if (args.departureSubcountyId && args.departureDistrictId) {
      const subcounty = await ctx.db.get(args.departureSubcountyId);
      if (!subcounty || !subcounty.active || subcounty.districtId !== args.departureDistrictId) {
        throw new Error("Invalid departure subcounty for this district");
      }
    }

    // Check for existing profile
    const existing = await ctx.db
      .query("transporterProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    const utid = generateUTID(user.role);

    if (existing) {
      await ctx.db.patch(existing._id, {
        vehicleType: args.vehicleType,
        vehicleTypeCustom: args.vehicleTypeCustom,
        weightCapacityTonnes: args.weightCapacityTonnes,
        vehicleCount: args.vehicleCount,
        departureRegion: args.departureRegion,
        departureDistrictId: args.departureDistrictId,
        departureSubcountyId: args.departureSubcountyId,
        onboardingCompleted: true,
      });
    } else {
      await ctx.db.insert("transporterProfiles", {
        userId: args.userId,
        vehicleType: args.vehicleType,
        vehicleTypeCustom: args.vehicleTypeCustom,
        weightCapacityTonnes: args.weightCapacityTonnes,
        vehicleCount: args.vehicleCount,
        departureRegion: args.departureRegion,
        departureDistrictId: args.departureDistrictId,
        departureSubcountyId: args.departureSubcountyId,
        onboardingCompleted: true,
        createdAt: Date.now(),
      });
    }

    // Also set onboardingCompleted on user record
    const patchData: any = { onboardingCompleted: true };
    if (args.departureRegion) patchData.region = args.departureRegion;
    if (args.departureDistrictId) patchData.districtId = args.departureDistrictId;
    if (args.departureSubcountyId) patchData.subcountyId = args.departureSubcountyId;
    await ctx.db.patch(args.userId, patchData);

    return { utid };
  },
});
