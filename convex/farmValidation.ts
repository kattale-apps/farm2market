import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const AGROFRESH_UG_COMMUNITY_ID = "AGROFRESH_UG"; // Legacy form identifier
const AGROFRESH_UG_COMMUNITY_NAME = "AGROFRESH UG";

const normalizeCommunityName = (value?: string) =>
  (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const resolveCommunityByName = async (ctx: any, name: string) => {
  const target = normalizeCommunityName(name);
  const communities = await ctx.db.query("communities").collect();
  return communities.find((c: any) => normalizeCommunityName(c.name) === target) || null;
};

const assertFarmer = async (ctx: any, farmerId: Id<"users">) => {
  const user = await ctx.db.get(farmerId);
  if (!user) {
    throw new Error("User not found.");
  }
  if (user.role !== "farmer") {
    throw new Error("User is not a farmer.");
  }
  return user;
};

/**
 * Get all farm validation drafts for the current farmer.
 */
export const getMyDrafts = query({
  args: { farmerId: v.id("users") },
  handler: async (ctx, { farmerId }) => {
    const user = await assertFarmer(ctx, farmerId);
    return await ctx.db
      .query("agroFreshUGFarmValidations")
      .withIndex("by_farmerId_and_community", (q) =>
        q.eq("farmerId", user._id).eq("community", AGROFRESH_UG_COMMUNITY_ID)
      )
      .filter((q) => q.eq(q.field("status"), "DRAFT"))
      .collect();
  },
});

/**
 * Get a single farm validation form by its ID.
 */
export const getFormById = query({
  args: { formId: v.id("agroFreshUGFarmValidations") },
  handler: async (ctx, { formId }) => {
    return await ctx.db.get(formId);
  },
});

/**
 * Get latest farm validation form for a farmer (draft or submitted)
 */
export const getLatestFormForFarmer = query({
  args: { farmerId: v.id("users") },
  handler: async (ctx, { farmerId }) => {
    const user = await assertFarmer(ctx, farmerId);
    const forms = await ctx.db
      .query("agroFreshUGFarmValidations")
      .withIndex("by_farmerId_and_community", (q) =>
        q.eq("farmerId", user._id).eq("community", AGROFRESH_UG_COMMUNITY_ID)
      )
      .collect();
    if (forms.length === 0) return null;
    const sorted = [...forms].sort((a: any, b: any) => {
      const aTime = a.updatedAt ?? a.createdAt ?? a._creationTime ?? 0;
      const bTime = b.updatedAt ?? b.createdAt ?? b._creationTime ?? 0;
      return bTime - aTime;
    });
    return sorted[0] ?? null;
  },
});

/**
 * Create a new, empty draft for a new farm.
 */
export const createNewDraft = mutation({
  args: { farmerId: v.id("users") },
  handler: async (ctx, { farmerId }) => {
    const user = await assertFarmer(ctx, farmerId);
    const now = Date.now();
    const formId = await ctx.db.insert("agroFreshUGFarmValidations", {
      farmerId: user._id,
      community: AGROFRESH_UG_COMMUNITY_ID,
      communityName: AGROFRESH_UG_COMMUNITY_NAME,
      status: "DRAFT",
      createdAt: now,
      updatedAt: now,
    });
    return formId;
  },
});

/**
 * Update a draft form (for autosaving).
 */
export const updateDraft = mutation({
  args: {
    formId: v.id("agroFreshUGFarmValidations"),
    patch: v.any(), // Use v.any() for partial updates during development.
  },
  handler: async (ctx, { formId, patch }) => {
    // Ensure protected fields are not changed
    delete patch.farmerId;
    delete patch.community;

    patch.updatedAt = Date.now();

    await ctx.db.patch(formId, patch);
  },
});

export const attachImage = mutation({
  args: {
    formId: v.id("agroFreshUGFarmValidations"),
    field: v.string(),
    metadata: v.object({
      storageId: v.id("_storage"),
      lat: v.optional(v.number()),
      lng: v.optional(v.number()),
      accuracy: v.optional(v.number()),
      capturedAt: v.string(),
    }),
  },
  handler: async (ctx, { formId, field, metadata }) => {
    const url = await ctx.storage.getUrl(metadata.storageId);
    const finalMetadata = { ...metadata, url: url || "" };

    if (field === "section1.verificationPhoto") {
      const existing = await ctx.db.get(formId);
      await ctx.db.patch(formId, {
        section1: {
          ...(existing?.section1 ?? {}),
          verificationPhoto: finalMetadata,
        },
        updatedAt: Date.now(),
      });
      return finalMetadata;
    }

    throw new Error("Unsupported image field");
  },
});

export const submitForm = mutation({
  args: { formId: v.id("agroFreshUGFarmValidations") },
  handler: async (ctx, { formId }) => {
    const form = await ctx.db.get(formId);
    if (!form) {
      throw new Error("Form not found.");
    }
    if (form.deletedByFarmer) {
      throw new Error("This form was deleted and cannot be submitted.");
    }
    if (form.status !== "DRAFT" && form.status !== "SUBMITTED") {
      throw new Error("Only drafts or submitted forms can be submitted.");
    }

    const section1 = form.section1 || {};
    const requiredFields = [
      "farmerFullName",
      "farmName",
      "phoneNumber",
      "emailAddress",
      "county",
      "districtSubCounty",
      "village",
      "farmSizeAcres",
      "totalAreaAgProductionAcres",
      "totalAreaPlantedForestAcres",
      "systemOfFarming",
      "yearsOfExperience",
      "waterSource",
    ] as const;

    for (const field of requiredFields) {
      if (!section1?.[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const enterpriseSectionMap: Record<string, any> = {
      "Dairy Farming": form.section2_1_dairy,
      "Poultry Farming": form.section2_2_poultry,
      "Piggery": form.section2_3_piggery,
      "Rabbitry": form.section2_4_rabbitry,
      "Apiary": form.section2_5_apiary,
      "Aquaculture": form.section2_6_aquaculture,
      "Banana Plantation": form.section2_7_banana,
      "Maize": form.section2_8_maize,
      "Fruit Trees": form.section2_9_fruitTrees,
      "Planted Forest": form.section2_10_plantedForest,
    };

    const selectedEnterprises = section1.mainEnterprises || [];
    for (const enterprise of selectedEnterprises) {
      const section = enterpriseSectionMap[enterprise];
      const hasData = section && Object.values(section).some((v: any) => v !== undefined && v !== "");
      if (!hasData) {
        throw new Error(`Missing details for selected enterprise: ${enterprise}`);
      }
    }

    const numericFields = [
      section1.farmSizeAcres,
      section1.totalAreaAgProductionAcres,
      section1.totalAreaPlantedForestAcres,
      section1.yearsOfExperience,
    ];
    if (numericFields.some((v) => v !== undefined && v !== null && isNaN(Number(v)))) {
      throw new Error("Invalid numeric value in Section 1");
    }

    const normalizeTransport = (section: any) => {
      if (!section) return;
      if (section.marketPointOfSale !== "Local Market") {
        section.transportToMarket = "None";
      }
    };
    normalizeTransport(form.section2_1_dairy);
    normalizeTransport(form.section2_2_poultry);
    normalizeTransport(form.section2_3_piggery);
    normalizeTransport(form.section2_4_rabbitry);
    normalizeTransport(form.section2_5_apiary);
    normalizeTransport(form.section2_6_aquaculture);
    normalizeTransport(form.section2_7_banana);
    normalizeTransport(form.section2_8_maize);
    normalizeTransport(form.section2_9_fruitTrees);
    normalizeTransport(form.section2_10_plantedForest);

    await ctx.db.patch(formId, {
      status: "SUBMITTED",
      updatedAt: Date.now(),
    });

    const existingApplication = await ctx.db
      .query("communityApplications")
      .withIndex("by_form", (q) => q.eq("formId", formId))
      .first();

    const now = Date.now();
    if (existingApplication) {
      await ctx.db.patch(existingApplication._id, {
        status: "PENDING",
        updatedAt: now,
      });

      await upsertPendingCommunityMember(ctx, {
        communityId: existingApplication.communityId,
        farmerId: form.farmerId,
        applicationId: existingApplication._id,
      });
    } else {
      const nameCandidate = form.communityName || form.community || AGROFRESH_UG_COMMUNITY_NAME;
      const resolvedName = nameCandidate === AGROFRESH_UG_COMMUNITY_ID ? AGROFRESH_UG_COMMUNITY_NAME : nameCandidate;
      const community = await resolveCommunityByName(ctx, resolvedName);
      if (!community) {
        throw new Error("Community not found. Please contact support.");
      }
      const applicationId = await ctx.db.insert("communityApplications", {
        communityId: community._id,
        farmerId: form.farmerId,
        formId,
        status: "PENDING",
        createdAt: now,
        updatedAt: now,
      });

      await upsertPendingCommunityMember(ctx, {
        communityId: community._id,
        farmerId: form.farmerId,
        applicationId,
      });
    }

    return { success: true };
  },
});

async function upsertPendingCommunityMember(
  ctx: any,
  args: { communityId: Id<"communities">; farmerId: Id<"users">; applicationId: Id<"communityApplications"> }
) {
  const existing = await ctx.db
    .query("communityMembers")
    .withIndex("by_community_farmer", (q: any) =>
      q.eq("communityId", args.communityId).eq("farmerId", args.farmerId)
    )
    .first();

  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, {
      status: "PENDING",
      applicationId: args.applicationId,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("communityMembers", {
      communityId: args.communityId,
      farmerId: args.farmerId,
      status: "PENDING",
      applicationId: args.applicationId,
      updatedAt: now,
    });
  }

  const existingMembership = await ctx.db
    .query("communityMemberships")
    .withIndex("by_community_user", (q: any) =>
      q.eq("communityId", args.communityId).eq("userId", args.farmerId)
    )
    .first();

  if (existingMembership) {
    await ctx.db.delete(existingMembership._id);
  }
}

export const deleteDraft = mutation({
  args: { formId: v.id("agroFreshUGFarmValidations"), farmerId: v.id("users") },
  handler: async (ctx, { formId, farmerId }) => {
    const user = await assertFarmer(ctx, farmerId);
    const form = await ctx.db.get(formId);
    if (!form) {
      throw new Error("Form not found.");
    }
    if (form.farmerId !== user._id) {
      throw new Error("Not authorized.");
    }
    if (form.status === "DRAFT") {
      await ctx.db.delete(formId);
      return { success: true };
    }
    await ctx.db.patch(formId, {
      deletedByFarmer: true,
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

// Admin-facing queries and actions moved to communityApplications module.