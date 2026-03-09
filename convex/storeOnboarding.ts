/**
 * Store Onboarding
 *
 * Handles mandatory location, storage capacity, and store type for stores.
 * Stores must complete onboarding before creating listings.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { generateUTID } from "./utils";

/**
 * Check if store has completed onboarding
 */
export const checkOnboardingStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "store") {
      throw new Error("User is not a store");
    }

    const profile = await ctx.db
      .query("storeProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    return {
      completed: profile?.onboardingCompleted === true && !!(profile?.streetAddress && profile?.buildingName && profile?.storeNumber),
      hasLocation: !!(profile?.districtId && profile?.subcountyId),
      hasStoreInfo: !!(profile?.storeType && profile?.storageCapacityTonnes),
      hasStoreAddress: !!(profile?.streetAddress && profile?.buildingName && profile?.storeNumber),
      region: profile?.region,
      districtId: profile?.districtId,
      subcountyId: profile?.subcountyId,
      parishId: profile?.parishId,
      storageCapacityTonnes: profile?.storageCapacityTonnes,
      storeType: profile?.storeType,
      storeTypeCustom: profile?.storeTypeCustom,
      streetAddress: profile?.streetAddress,
      buildingName: profile?.buildingName,
      storeNumber: profile?.storeNumber,
    };
  },
});

/**
 * Complete store onboarding
 * Sets location, storage capacity, and store type, creates store profile
 */
export const completeOnboarding = mutation({
  args: {
    userId: v.id("users"),
    region: v.string(),
    districtId: v.id("districts"),
    subcountyId: v.id("subcounties"),
    parishId: v.optional(v.id("parishes")),
    storageCapacityTonnes: v.number(),
    storeType: v.union(
      v.literal("cold_storage"),
      v.literal("dry_storage")
    ),
    storeTypeCustom: v.optional(v.string()),
    streetAddress: v.string(),
    buildingName: v.string(),
    storeNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "store") {
      throw new Error("User is not a store");
    }

    if (args.storageCapacityTonnes <= 0) {
      throw new Error("Storage capacity must be greater than 0");
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
      .query("storeProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    const utid = generateUTID(user.role);

    if (existing) {
      await ctx.db.patch(existing._id, {
        region: args.region,
        districtId: args.districtId,
        subcountyId: args.subcountyId,
        ...(args.parishId ? { parishId: args.parishId } : {}),
        storageCapacityTonnes: args.storageCapacityTonnes,
        storeType: args.storeType,
        storeTypeCustom: args.storeTypeCustom,
        streetAddress: args.streetAddress,
        buildingName: args.buildingName,
        storeNumber: args.storeNumber,
        onboardingCompleted: true,
      });
    } else {
      await ctx.db.insert("storeProfiles", {
        userId: args.userId,
        region: args.region,
        districtId: args.districtId,
        subcountyId: args.subcountyId,
        ...(args.parishId ? { parishId: args.parishId } : {}),
        storageCapacityTonnes: args.storageCapacityTonnes,
        storeType: args.storeType,
        storeTypeCustom: args.storeTypeCustom,
        streetAddress: args.streetAddress,
        buildingName: args.buildingName,
        storeNumber: args.storeNumber,
        onboardingCompleted: true,
        createdAt: Date.now(),
      });
    }

    // Also set onboardingCompleted on user record
    await ctx.db.patch(args.userId, {
      onboardingCompleted: true,
      region: args.region,
      districtId: args.districtId,
      subcountyId: args.subcountyId,
      ...(args.parishId ? { parishId: args.parishId } : {}),
    });

    return { utid };
  },
});
