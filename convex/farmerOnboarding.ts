/**
 * Farmer Onboarding
 * 
 * Handles mandatory location selection and farm size input for farmers
 * Farmers must complete onboarding before creating listings
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { generateUTID, getUgandaTime } from "./utils";

/**
 * Calculate farm size in acres from various input formats
 */
export function calculateFarmSizeAcres(input: {
  unit?: "ft" | "m";
  length?: number;
  width?: number;
  omwigo?: number;
  emiigo?: number;
}): number {
  // Omwigo = 10 × 100 ft = 1000 sq ft
  // 1 acre = 43,560 sq ft
  const OMWIGO_SQ_FT = 10 * 100; // 1000 sq ft
  const ACRES_PER_SQ_FT = 1 / 43560;

  if (input.omwigo !== undefined && input.omwigo > 0) {
    return input.omwigo * OMWIGO_SQ_FT * ACRES_PER_SQ_FT;
  }

  if (input.emiigo !== undefined && input.emiigo > 0) {
    // Emiigo = multiple Omwigo
    return input.emiigo * OMWIGO_SQ_FT * ACRES_PER_SQ_FT;
  }

  if (input.length && input.width && input.unit) {
    let sqFt: number;
    if (input.unit === "ft") {
      sqFt = input.length * input.width;
    } else if (input.unit === "m") {
      // Convert meters to feet: 1 m = 3.28084 ft
      const lengthFt = input.length * 3.28084;
      const widthFt = input.width * 3.28084;
      sqFt = lengthFt * widthFt;
    } else {
      throw new Error("Invalid unit. Must be 'ft' or 'm'");
    }
    return sqFt * ACRES_PER_SQ_FT;
  }

  throw new Error("Invalid farm size input");
}

/**
 * Check if farmer has completed onboarding
 */
export const checkOnboardingStatus = query({
  args: { farmerId: v.id("users") },
  handler: async (ctx, args) => {
    const farmer = await ctx.db.get(args.farmerId);
    if (!farmer || farmer.role !== "farmer") {
      throw new Error("User is not a farmer");
    }

    const completed = farmer.onboardingCompleted === true;
    const hasLocation = farmer.districtId && farmer.subcountyId && farmer.parishId;
    const hasFarmSize = farmer.farmSizeAcres !== undefined;

    return {
      completed,
      hasLocation,
      hasFarmSize,
      districtId: farmer.districtId,
      subcountyId: farmer.subcountyId,
      parishId: farmer.parishId,
      farmSizeAcres: farmer.farmSizeAcres,
    };
  },
});

/**
 * Complete farmer onboarding
 * Sets location and farm size, marks onboarding as complete
 */
export const completeOnboarding = mutation({
  args: {
    farmerId: v.id("users"),
    districtId: v.id("districts"),
    subcountyId: v.id("subcounties"),
    parishId: v.id("parishes"),
    farmSizeInput: v.any(), // {unit, length, width, omwigo, emiigo}
  },
  handler: async (ctx, args) => {
    // Verify user is a farmer
    const farmer = await ctx.db.get(args.farmerId);
    if (!farmer || farmer.role !== "farmer") {
      throw new Error("User is not a farmer");
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

    const parish = await ctx.db.get(args.parishId);
    if (!parish || !parish.active || parish.subcountyId !== args.subcountyId) {
      throw new Error("Invalid or inactive parish for this subcounty");
    }

    // Calculate farm size in acres
    let farmSizeAcres: number;
    try {
      farmSizeAcres = calculateFarmSizeAcres(args.farmSizeInput);
    } catch (error: any) {
      throw new Error(`Invalid farm size: ${error.message}`);
    }

    if (farmSizeAcres <= 0) {
      throw new Error("Farm size must be greater than 0");
    }

    // Generate UTID for onboarding completion
    const utid = generateUTID(farmer.role);

    // Update farmer profile
    await ctx.db.patch(args.farmerId, {
      districtId: args.districtId,
      subcountyId: args.subcountyId,
      parishId: args.parishId,
      farmSizeAcres,
      farmSizeRaw: args.farmSizeInput,
      onboardingCompleted: true,
    });

    return { utid, farmSizeAcres };
  },
});
