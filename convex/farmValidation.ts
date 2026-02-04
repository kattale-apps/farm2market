import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyAdminRole } from "./auth";
import { Id } from "./_generated/dataModel";

const AGROFRESH_UG_COMMUNITY_ID = "AGROFRESH_UG"; // Use the actual community identifier

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
      lat: v.number(),
      lng: v.number(),
      accuracy: v.number(),
      capturedAt: v.string(),
    }),
  },
  handler: async (ctx, { formId, field, metadata }) => {
    const url = await ctx.storage.getUrl(metadata.storageId);
    const finalMetadata = { ...metadata, url: url || "" };

    if (field === "section1.farmerPhoto") {
      await ctx.db.patch(formId, {
        section1: {
          farmerPhoto: finalMetadata,
        },
        updatedAt: Date.now(),
      });
      return finalMetadata;
    }

    if (field === "section1.farmPhotos") {
      const existing = await ctx.db.get(formId);
      const currentPhotos = existing?.section1?.farmPhotos ?? [];
      await ctx.db.patch(formId, {
        section1: {
          ...existing?.section1,
          farmPhotos: [...currentPhotos, finalMetadata],
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
    await ctx.db.patch(formId, {
      status: "SUBMITTED",
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

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
    if (form.status !== "DRAFT") {
      throw new Error("Only drafts can be deleted.");
    }
    await ctx.db.delete(formId);
    return { success: true };
  },
});

export const getSubmittedForms = query({
  args: {
    adminId: v.id("users"),
    status: v.optional(v.union(v.literal("DRAFT"), v.literal("SUBMITTED"), v.literal("VERIFIED"))),
  },
  handler: async (ctx, { adminId, status }) => {
    const adminCheck = await verifyAdminRole({ userId: adminId, db: ctx.db });
    if (!adminCheck.authorized) {
      throw new Error("Not authorized");
    }

    const forms = await ctx.db
      .query("agroFreshUGFarmValidations")
      .filter((q) => (status ? q.eq(q.field("status"), status) : q.eq(q.field("community"), "AGROFRESH_UG")))
      .collect();

    const farmerIds = new Set(forms.map((f) => f.farmerId));
    const farmers = await Promise.all(
      Array.from(farmerIds).map((id) => ctx.db.get(id))
    );
    const farmerById = new Map(farmers.filter(Boolean).map((f: any) => [f._id, f]));

    return forms.map((f) => {
      const farmer = farmerById.get(f.farmerId);
      return {
        ...f,
        farmer: farmer
          ? {
              id: farmer._id,
              alias: farmer.alias,
              email: farmer.email,
              phoneNumber: farmer.phoneNumber,
            }
          : null,
      };
    });
  },
});

export const getFormByIdAdmin = query({
  args: { adminId: v.id("users"), formId: v.id("agroFreshUGFarmValidations") },
  handler: async (ctx, { adminId, formId }) => {
    const adminCheck = await verifyAdminRole({ userId: adminId, db: ctx.db });
    if (!adminCheck.authorized) {
      throw new Error("Not authorized");
    }
    return await ctx.db.get(formId);
  },
});

export const verifyForm = mutation({
  args: { adminId: v.id("users"), formId: v.id("agroFreshUGFarmValidations") },
  handler: async (ctx, { adminId, formId }) => {
    const adminCheck = await verifyAdminRole({ userId: adminId, db: ctx.db });
    if (!adminCheck.authorized) {
      throw new Error("Not authorized");
    }
    await ctx.db.patch(formId, {
      status: "VERIFIED",
      verifiedAt: Date.now(),
      verifiedBy: adminId,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});