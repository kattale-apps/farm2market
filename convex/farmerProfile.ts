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
      region: farmer.region,
      county: farmer.county,
      village: farmer.village,
      waterSource: farmer.waterSource,
      districtText: farmer.districtText,
      subCountyText: farmer.subCountyText,
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
    email: v.optional(v.string()),
    sex: v.optional(v.union(v.literal("M"), v.literal("F"))),
    region: v.optional(v.string()),
    county: v.optional(v.string()),
    village: v.optional(v.string()),
    waterSource: v.optional(v.string()),
    districtText: v.optional(v.string()),
    subCountyText: v.optional(v.string()),
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
    if (args.email !== undefined) {
      updates.email = args.email.trim() || undefined;
    }
    if (args.sex !== undefined) {
      updates.sex = args.sex;
    }
    if (args.region !== undefined) {
      updates.region = args.region.trim() || undefined;
    }
    if (args.county !== undefined) {
      updates.county = args.county.trim() || undefined;
    }
    if (args.village !== undefined) {
      updates.village = args.village.trim() || undefined;
    }
    if (args.waterSource !== undefined) {
      updates.waterSource = args.waterSource.trim() || undefined;
    }
    if (args.districtText !== undefined) {
      updates.districtText = args.districtText.trim() || undefined;
    }
    if (args.subCountyText !== undefined) {
      updates.subCountyText = args.subCountyText.trim() || undefined;
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

/**
 * Backfill location text fields for existing farmers
 * Populates districtText and subCountyText from districtId/subcountyId references
 * This enables proper export of location data for communities
 * 
 * Only callable by super admins
 */
export const backfillLocationText = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.optional(v.id("communities")), // If provided, only backfill farmers in this community
  },
  handler: async (ctx, args) => {
    // Verify super admin
    const admin = await ctx.db.get(args.adminId);
    if (!admin || admin.role !== "admin") {
      throw new Error("Not authorized - admin role required");
    }

    const isSuperAdmin = admin.adminLevel === "super" || admin.adminLevel === undefined;
    if (!isSuperAdmin) {
      throw new Error("Not authorized - super admin required");
    }

    let farmersToBackfill: any[] = [];

    if (args.communityId) {
      // Backfill only farmers in specified community
      const members = await ctx.db
        .query("communityMembers")
        .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
        .collect();

      farmersToBackfill = await Promise.all(
        members.map((m: any) => ctx.db.get(m.userId))
      );
    } else {
      // Backfill all farmers
      farmersToBackfill = await ctx.db
        .query("users")
        .withIndex("by_role", (q: any) => q.eq("role", "farmer"))
        .collect();
    }

    // Filter to only farmers with districtId/subcountyId but missing text fields
    const farmersNeedingBackfill = farmersToBackfill.filter(
      (f: any) =>
        f &&
        f.districtId &&
        (f.subcountyId || f.parishId) &&
        (!f.districtText || !f.subCountyText)
    );

    if (farmersNeedingBackfill.length === 0) {
      return {
        success: true,
        backfilledCount: 0,
        message: "No farmers needed backfill",
      };
    }

    // Backfill each farmer
    let backfilledCount = 0;
    const errors: string[] = [];

    for (const farmer of farmersNeedingBackfill) {
      try {
        const updates: any = {};

        // Look up district name if districtId exists
        if (farmer.districtId && !farmer.districtText) {
          const district = await ctx.db.get(farmer.districtId);
          if (district?.name) {
            updates.districtText = district.name;
          } else {
            errors.push(`Farmer ${farmer.alias}: Invalid districtId`);
          }
        }

        // Look up subcounty name if subcountyId exists
        if (farmer.subcountyId && !farmer.subCountyText) {
          const subcounty = await ctx.db.get(farmer.subcountyId);
          if (subcounty?.name) {
            updates.subCountyText = subcounty.name;
          } else {
            errors.push(`Farmer ${farmer.alias}: Invalid subcountyId`);
          }
        }

        // Apply updates if any
        if (Object.keys(updates).length > 0) {
          await ctx.db.patch(farmer._id, updates);
          backfilledCount++;
        }
      } catch (err: any) {
        errors.push(`Farmer ${farmer.alias}: ${err.message}`);
      }
    }

    return {
      success: true,
      totalNeededBackfill: farmersNeedingBackfill.length,
      backfilledCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Backfilled ${backfilledCount}/${farmersNeedingBackfill.length} farmers`,
    };
  },
});
