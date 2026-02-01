/**
 * Farmer Profile Management
 * 
 * Handles farmer profile viewing and updating
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import { calculateFarmSizeAcres } from "./farmerOnboarding";

/**
 * Get farmer profile with location names
 */
export const getFarmerProfile = query({
  args: { farmerId: v.id("users") },
  handler: async (ctx, args) => {
    const farmer = await ctx.db.get(args.farmerId);
    if (!farmer || farmer.role !== "farmer") {
      throw new Error("User is not a farmer");
    }

    // Get location names
    let districtName: string | undefined;
    let subcountyName: string | undefined;
    let parishName: string | undefined;

    if (farmer.districtId) {
      const district = await ctx.db.get(farmer.districtId);
      districtName = district?.name;
    }

    if (farmer.subcountyId) {
      const subcounty = await ctx.db.get(farmer.subcountyId);
      subcountyName = subcounty?.name;
    }

    if (farmer.parishId) {
      const parish = await ctx.db.get(farmer.parishId);
      parishName = parish?.name;
    }

    return {
      userId: farmer._id,
      alias: farmer.alias,
      email: farmer.email,
      phoneNumber: farmer.phoneNumber,
      sex: farmer.sex,
      districtId: farmer.districtId,
      districtName,
      subcountyId: farmer.subcountyId,
      subcountyName,
      parishId: farmer.parishId,
      parishName,
      farmSizeAcres: farmer.farmSizeAcres,
      farmSizeRaw: farmer.farmSizeRaw,
      onboardingCompleted: farmer.onboardingCompleted || false,
      createdAt: farmer.createdAt,
      lastActiveAt: farmer.lastActiveAt,
    };
  },
});

/**
 * Update farmer profile (location and farm size)
 */
export const updateFarmerProfile = mutation({
  args: {
    farmerId: v.id("users"),
    districtId: v.optional(v.id("districts")),
    subcountyId: v.optional(v.id("subcounties")),
    parishId: v.optional(v.id("parishes")),
    farmSizeInput: v.optional(v.any()), // {unit, length, width, omwigo, emiigo}
    phoneNumber: v.optional(v.string()),
    sex: v.optional(v.union(v.literal("M"), v.literal("F"))),
  },
  handler: async (ctx, args) => {
    const farmer = await ctx.db.get(args.farmerId);
    if (!farmer || farmer.role !== "farmer") {
      throw new Error("User is not a farmer");
    }

    // Calculate farm size if provided
    let farmSizeAcres: number | undefined;
    if (args.farmSizeInput) {
      farmSizeAcres = calculateFarmSizeAcres(args.farmSizeInput as any);
    }

    // Validate location hierarchy if provided
    if (args.subcountyId && args.districtId) {
      const subcounty = await ctx.db.get(args.subcountyId);
      if (!subcounty || subcounty.districtId !== args.districtId) {
        throw new Error("Subcounty does not belong to the selected district");
      }
    }

    if (args.parishId && args.subcountyId) {
      const parish = await ctx.db.get(args.parishId);
      if (!parish || parish.subcountyId !== args.subcountyId) {
        throw new Error("Parish does not belong to the selected subcounty");
      }
    }

    // Update farmer profile
    const updates: any = {
      lastActiveAt: getUgandaTime(),
    };

    if (args.districtId !== undefined) {
      updates.districtId = args.districtId;
    }
    if (args.subcountyId !== undefined) {
      updates.subcountyId = args.subcountyId;
    }
    if (args.parishId !== undefined) {
      updates.parishId = args.parishId;
    }
    if (args.phoneNumber !== undefined) {
      updates.phoneNumber = args.phoneNumber.trim() || undefined;
    }
    if (args.sex !== undefined) {
      updates.sex = args.sex;
    }
    if (farmSizeAcres !== undefined) {
      updates.farmSizeAcres = farmSizeAcres;
    }
    if (args.farmSizeInput !== undefined) {
      updates.farmSizeRaw = args.farmSizeInput;
    }

    // Mark onboarding as completed if location is set
    if (args.districtId && args.subcountyId && args.parishId) {
      updates.onboardingCompleted = true;
    }

    await ctx.db.patch(args.farmerId, updates);

    return {
      success: true,
      message: "Profile updated successfully",
    };
  },
});
