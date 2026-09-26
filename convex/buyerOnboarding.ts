/**
 * Buyer Onboarding
 *
 * Minimal mandatory profile step for buyers: a business/buying name and
 * their location. Buyers must complete onboarding before accessing the
 * dashboard.
 *
 * Buyers can be anywhere in the world. Ugandan buyers pick a district (and
 * optionally a subcounty) as before; buyers elsewhere give their country,
 * city and address plus basic company details. KYC documents are collected
 * later, once an export offer has been accepted.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { UGANDA_COUNTRY_CODE, countryName } from "./exportMarketsShared";

/**
 * Check if buyer has completed onboarding
 */
export const checkOnboardingStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    const profile = await ctx.db
      .query("buyerProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    return {
      completed: profile?.onboardingCompleted === true,
      businessName: profile?.businessName,
      region: profile?.region,
      districtId: profile?.districtId,
      subcountyId: profile?.subcountyId,
      countryCode: profile?.countryCode ?? (profile ? UGANDA_COUNTRY_CODE : undefined),
      countryName: profile?.countryName,
      city: profile?.city,
      kycStatus: profile?.kycStatus ?? "not_started",
    };
  },
});

/**
 * Complete buyer onboarding
 * Sets business name and location, creates buyer profile
 */
export const completeOnboarding = mutation({
  args: {
    userId: v.id("users"),
    businessName: v.string(),
    // Omitted by older clients, which only ever onboarded Ugandan buyers.
    countryCode: v.optional(v.string()),
    // Uganda
    region: v.optional(v.string()),
    districtId: v.optional(v.id("districts")),
    subcountyId: v.optional(v.id("subcounties")),
    // Outside Uganda
    city: v.optional(v.string()),
    addressLine: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    // Company details (optional at this step)
    companyRegistrationNumber: v.optional(v.string()),
    taxId: v.optional(v.string()),
    eoriNumber: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    if (!args.businessName.trim()) {
      throw new Error("Business name is required");
    }

    const countryCode = (args.countryCode || UGANDA_COUNTRY_CODE).toUpperCase();
    const country = countryName(countryCode);
    if (!country) {
      throw new Error("Select a valid country");
    }
    const isUganda = countryCode === UGANDA_COUNTRY_CODE;
    const clean = (s: string | undefined) => (s ?? "").trim() || undefined;

    let districtName: string | undefined;
    let subcountyName: string | undefined;
    if (isUganda) {
      if (!args.districtId) {
        throw new Error("Select your district");
      }
      const district = await ctx.db.get(args.districtId);
      if (!district || !district.active) {
        throw new Error("Invalid or inactive district");
      }
      districtName = district.name;
      if (args.subcountyId) {
        const subcounty = await ctx.db.get(args.subcountyId);
        if (!subcounty || !subcounty.active || subcounty.districtId !== args.districtId) {
          throw new Error("Invalid subcounty for this district");
        }
        subcountyName = subcounty.name;
      }
    } else {
      if (!clean(args.city)) throw new Error("City is required");
      if (!clean(args.addressLine)) throw new Error("Business address is required");
      if (!clean(args.contactPerson)) throw new Error("Contact person is required");
    }

    const existing = await ctx.db
      .query("buyerProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    const profileData = {
      businessName: args.businessName.trim(),
      countryCode,
      countryName: country,
      region: isUganda ? args.region : undefined,
      districtId: isUganda ? args.districtId : undefined,
      subcountyId: isUganda ? args.subcountyId : undefined,
      city: isUganda ? clean(args.city) ?? districtName : clean(args.city),
      addressLine: clean(args.addressLine),
      postalCode: clean(args.postalCode),
      companyRegistrationNumber: clean(args.companyRegistrationNumber),
      taxId: clean(args.taxId),
      eoriNumber: clean(args.eoriNumber),
      contactPerson: clean(args.contactPerson),
      contactPhone: clean(args.contactPhone),
      website: clean(args.website),
      onboardingCompleted: true,
    };

    if (existing) {
      await ctx.db.patch(existing._id, profileData);
    } else {
      await ctx.db.insert("buyerProfiles", {
        userId: args.userId,
        ...profileData,
        kycStatus: "not_started",
        createdAt: Date.now(),
      });
    }

    const patchData: Record<string, unknown> = { onboardingCompleted: true };
    if (isUganda) {
      patchData.districtId = args.districtId;
      patchData.districtText = districtName;
      if (args.region) patchData.region = args.region;
      if (args.subcountyId && subcountyName) {
        patchData.subcountyId = args.subcountyId;
        patchData.subCountyText = subcountyName;
      }
    } else {
      patchData.region = country;
    }
    await ctx.db.patch(args.userId, patchData);

    return { success: true };
  },
});
