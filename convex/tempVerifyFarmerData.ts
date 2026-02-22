/**
 * TEMPORARY VERIFICATION QUERY
 * Check what farmer profile data exists for DEI Agro community
 * This helps us understand the current state before any data migrations
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { verifyAdminRole } from "./auth";

const DEIGRO_COMMUNITY_ID = "ms7b1qga2n0kwjvczv3n1dqwwx809p81";

export const verifyDEIAgroFarmerData = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 50 }) => {
    // Get community members in DEI Agro
    const members = await ctx.db
      .query("communityMembers")
      .withIndex("by_community", (q: any) => q.eq("communityId", DEIGRO_COMMUNITY_ID as any))
      .take(limit);

    const farmerIds = members.map((m: any) => m.userId);

    // Get all farmer profiles
    const farmers = await Promise.all(
      farmerIds.map((id: any) => ctx.db.get(id))
    );

    // Build detailed report
    const farmerDataReport = farmers.filter(Boolean).map((farmer: any) => ({
      farmerId: farmer._id,
      alias: farmer.alias,
      email: farmer.email,
      phoneNumber: farmer.phoneNumber,
      sex: farmer.sex,
      // Location IDs (from onboarding)
      hasDistrictId: !!farmer.districtId,
      hasSubcountyId: !!farmer.subcountyId,
      hasParishId: !!farmer.parishId,
      // Location Text (for export)
      region: farmer.region || "❌",
      districtText: farmer.districtText || "❌",
      subCountyText: farmer.subCountyText || "❌",
      county: farmer.county || "❌",
      village: farmer.village || "❌",
      waterSource: farmer.waterSource || "❌",
      // Farm info
      farmSizeAcres: farmer.farmSizeAcres ? "✅" : "❌",
      // Onboarding status
      onboardingCompleted: farmer.onboardingCompleted || false,
    }));

    // Summary stats
    const stats = {
      totalFarmersInCommunity: farmerIds.length,
      farmersWithLocationIds: farmerDataReport.filter(
        (f) => f.hasDistrictId && f.hasSubcountyId && f.hasParishId
      ).length,
      farmersWithLocationText: farmerDataReport.filter(
        (f) => f.districtText !== "❌" && f.subCountyText !== "❌"
      ).length,
      farmersOnboardingCompleted: farmerDataReport.filter((f) => f.onboardingCompleted).length,
      farmersNeedingBackfill: farmerDataReport.filter(
        (f) => (f.hasDistrictId || f.hasSubcountyId) && (f.districtText === "❌" || f.subCountyText === "❌")
      ).length,
    };

    return {
      communityName: "DEI Agro",
      stats,
      farmers: farmerDataReport,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * Admin-only query to get verification data
 */
export const verifyDEIAgroDataForAdmin = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const adminCheck = await verifyAdminRole({ userId: args.adminId, db: ctx.db });
    if (!adminCheck.authorized) {
      throw new Error("Not authorized");
    }

    // Get community members in DEI Agro
    const members = await ctx.db
      .query("communityMembers")
      .withIndex("by_community", (q: any) => q.eq("communityId", DEIGRO_COMMUNITY_ID as any))
      .collect();

    const farmerIds = members.map((m: any) => m.userId);
    const farmers = await Promise.all(farmerIds.map((id: any) => ctx.db.get(id)));

    const farmersWithMissingText = farmers.filter(
      (f: any) =>
        f &&
        ((f.districtId && !f.districtText) || (f.subcountyId && !f.subCountyText))
    );

    return {
      totalFarmers: farmerIds.length,
      farmersNeedingBackfill: farmersWithMissingText.length,
      sampleFarmersNeedingBackfill: farmersWithMissingText.slice(0, 5).map((f: any) => ({
        alias: f.alias,
        email: f.email,
        hasDistrictId: !!f.districtId,
        hasdistrictText: !!f.districtText,
        hasSubcountyId: !!f.subcountyId,
        hasSubCountyText: !!f.subCountyText,
      })),
    };
  },
});
