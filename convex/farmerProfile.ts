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
    if (!farmer || !["farmer", "vendor", "store"].includes(farmer.role)) {
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
    if (!farmer || !["farmer", "vendor", "store"].includes(farmer.role)) {
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
 * Get vendor profile (market info)
 */
export const getVendorProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const vp = await ctx.db
      .query("vendorProfiles")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .first();
    if (!vp) return null;
    return {
      marketType: vp.marketType,
      marketName: vp.marketName,
      stallNumber: vp.stallNumber,
    };
  },
});

/**
 * Get store profile (store info)
 */
export const getStoreProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const sp = await ctx.db
      .query("storeProfiles")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .first();
    if (!sp) return null;
    return {
      storeType: sp.storeType,
      storageCapacityTonnes: sp.storageCapacityTonnes,
      buildingName: sp.buildingName,
      streetAddress: sp.streetAddress,
      storeNumber: sp.storeNumber,
    };
  },
});

/**
 * Update vendor profile (upsert)
 */
export const updateVendorProfile = mutation({
  args: {
    userId: v.id("users"),
    marketType: v.optional(v.union(
      v.literal("city_market"),
      v.literal("supermarket"),
      v.literal("roadside_market"),
      v.literal("town_market"),
      v.literal("village_market")
    )),
    marketName: v.optional(v.string()),
    stallNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "vendor") {
      throw new Error("User is not a vendor");
    }
    const existing = await ctx.db
      .query("vendorProfiles")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .first();

    const updates: any = {};
    if (args.marketType !== undefined) updates.marketType = args.marketType;
    if (args.marketName !== undefined) updates.marketName = args.marketName.trim() || undefined;
    if (args.stallNumber !== undefined) updates.stallNumber = args.stallNumber.trim() || undefined;

    if (existing) {
      await ctx.db.patch(existing._id, updates);
    } else {
      await ctx.db.insert("vendorProfiles", {
        userId: args.userId,
        marketType: args.marketType || "village_market",
        marketName: args.marketName?.trim(),
        stallNumber: args.stallNumber?.trim(),
        onboardingCompleted: true,
        createdAt: getUgandaTime(),
      });
    }
    return { success: true };
  },
});

/**
 * Update store profile (upsert)
 */
export const updateStoreProfile = mutation({
  args: {
    userId: v.id("users"),
    storeType: v.optional(v.union(
      v.literal("cold_storage"),
      v.literal("dry_storage")
    )),
    buildingName: v.optional(v.string()),
    streetAddress: v.optional(v.string()),
    storeNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "store") {
      throw new Error("User is not a store");
    }
    const existing = await ctx.db
      .query("storeProfiles")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .first();

    const updates: any = {};
    if (args.storeType !== undefined) updates.storeType = args.storeType;
    if (args.buildingName !== undefined) updates.buildingName = args.buildingName.trim() || undefined;
    if (args.streetAddress !== undefined) updates.streetAddress = args.streetAddress.trim() || undefined;
    if (args.storeNumber !== undefined) updates.storeNumber = args.storeNumber.trim() || undefined;

    if (existing) {
      await ctx.db.patch(existing._id, updates);
    } else {
      await ctx.db.insert("storeProfiles", {
        userId: args.userId,
        storeType: args.storeType || "dry_storage",
        storageCapacityTonnes: 0,
        buildingName: args.buildingName?.trim(),
        streetAddress: args.streetAddress?.trim(),
        storeNumber: args.storeNumber?.trim(),
        onboardingCompleted: true,
        createdAt: getUgandaTime(),
      });
    }
    return { success: true };
  },
});

/**
 * Get active supply chain roles
 */
export const getActiveSupplyChainRoles = query({
  args: {},
  handler: async (ctx) => {
    return [
      { id: "producer", label: "Producer" },
      { id: "aggregator", label: "Aggregator" },
      { id: "processor", label: "Processor" },
      { id: "exporter", label: "Exporter" },
      { id: "transporter", label: "Transporter" },
      { id: "trader", label: "Trader" },
      { id: "other", label: "Other (please specify)" },
    ];
  },
});

/**
 * Update user's supply chain role
 */
export const updateSupplyChainRole = mutation({
  args: {
    userId: v.id("users"),
    supplyChainRole: v.optional(v.string()),
    supplyChainRoleOther: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const updates: any = {};

    if (args.supplyChainRole !== undefined) {
      updates.supplyChainRole = args.supplyChainRole;
    }

    if (args.supplyChainRoleOther !== undefined) {
      updates.supplyChainRoleOther = args.supplyChainRoleOther;
    }

    await ctx.db.patch(args.userId, updates);

    return {
      success: true,
      message: "Supply chain role updated successfully",
    };
  },
});

// ── Generic profile for traders & buyers ──

/**
 * Get a user profile (works for any role: trader, buyer, farmer)
 */
export const getUserProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    let districtName: string | undefined;
    let subcountyName: string | undefined;
    let parishName: string | undefined;

    if (user.districtId) {
      const d = await ctx.db.get(user.districtId);
      districtName = d?.name;
    }
    if (user.subcountyId) {
      const s = await ctx.db.get(user.subcountyId);
      subcountyName = s?.name;
    }
    if (user.parishId) {
      const p = await ctx.db.get(user.parishId);
      parishName = p?.name;
    }

    return {
      userId: user._id,
      alias: user.alias,
      role: user.role,
      email: user.email,
      phoneNumber: user.phoneNumber,
      sex: user.sex,
      region: user.region,
      county: user.county,
      village: user.village,
      districtId: user.districtId,
      districtName,
      districtText: user.districtText,
      subcountyId: user.subcountyId,
      subcountyName,
      subCountyText: user.subCountyText,
      parishId: user.parishId,
      parishName,
      parishText: (user as any).parishText,
    };
  },
});

/**
 * Update profile for trader / buyer (location + contact details).
 * Accepts the same fields as updateFarmerProfile but without
 * the farmer-role gate.
 */
export const updateUserProfile = mutation({
  args: {
    userId: v.id("users"),
    phoneNumber: v.optional(v.string()),
    email: v.optional(v.string()),
    sex: v.optional(v.union(v.literal("M"), v.literal("F"))),
    region: v.optional(v.string()),
    county: v.optional(v.string()),
    village: v.optional(v.string()),
    districtText: v.optional(v.string()),
    subCountyText: v.optional(v.string()),
    districtId: v.optional(v.id("districts")),
    subcountyId: v.optional(v.id("subcounties")),
    parishId: v.optional(v.id("parishes")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const updates: Record<string, any> = {
      lastActiveAt: getUgandaTime(),
    };

    if (args.phoneNumber !== undefined) updates.phoneNumber = args.phoneNumber.trim() || undefined;
    if (args.email !== undefined) updates.email = args.email.trim() || undefined;
    if (args.sex !== undefined) updates.sex = args.sex;
    if (args.region !== undefined) updates.region = args.region.trim() || undefined;
    if (args.county !== undefined) updates.county = args.county.trim() || undefined;
    if (args.village !== undefined) updates.village = args.village.trim() || undefined;
    if (args.districtText !== undefined) updates.districtText = args.districtText.trim() || undefined;
    if (args.subCountyText !== undefined) updates.subCountyText = args.subCountyText.trim() || undefined;
    if (args.districtId !== undefined) updates.districtId = args.districtId;
    if (args.subcountyId !== undefined) updates.subcountyId = args.subcountyId;
    if (args.parishId !== undefined) updates.parishId = args.parishId;

    await ctx.db.patch(args.userId, updates);
    return { success: true, message: "Profile updated successfully" };
  },
});
