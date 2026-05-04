import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { generateUTID, getUgandaTime } from "./utils";
import { verifyAdminRole } from "./auth";
import { isUserCommunityMember } from "./communities";
import { Id } from "./_generated/dataModel";

function buildFarmNeedsQrSlug(formId: Id<"communityForms">) {
  return `farm-needs-${String(formId).slice(0, 12)}`;
}

/**
 * Get all active Farm Needs forms from communities the farmer is a member of
 * Grouped by community and categorized as crops/livestock
 */
export const getFarmNeedsFormsForFarmer = query({
  args: { farmerId: v.id("users") },
  handler: async (ctx, { farmerId }) => {
    // Get communities farmer is member of
    const communities = await ctx.db
      .query("communities")
      .collect();

    const memberCommunities = [];
    for (const community of communities) {
      const isMember = await isUserCommunityMember(ctx.db, farmerId, community._id);
      if (isMember) {
        memberCommunities.push(community);
      }
    }

    // Get active farm needs forms for these communities
    const communityIds = memberCommunities.map(c => c._id);
    const forms = [];

    for (const communityId of communityIds) {
      const communityForms = await ctx.db
        .query("communityForms")
        .withIndex("by_community", q => q.eq("communityId", communityId))
        .collect();

      const farmNeedsForms = communityForms.filter(
        (f: any) => f.isActive && f.formPurpose === "farmNeeds"
      );

      for (const form of farmNeedsForms) {
        const fields = await ctx.db
          .query("formFields")
          .withIndex("by_form", q => q.eq("formId", form._id))
          .collect();

        const community = memberCommunities.find(c => c._id === communityId);
        forms.push({
          formId: form._id,
          communityId: form.communityId,
          communityName: community?.name,
          name: form.name,
          description: form.description,
          category: form.category || "crops", // crops | livestock
          fields: fields.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)),
          createdAt: form.createdAt,
        });
      }
    }

    // Group by category
    const crops = forms.filter((f: any) => f.category === "crops");
    const livestock = forms.filter((f: any) => f.category === "livestock");

    return { crops, livestock };
  },
});

/**
 * Submit a Farm Needs form response
 */
export const submitFarmNeedsResponse = mutation({
  args: {
    farmerId: v.id("users"),
    formId: v.id("communityForms"),
    communityId: v.id("communities"),
    fieldValues: v.array(v.object({
      fieldId: v.id("formFields"),
      value: v.string(),
    })),
  },
  handler: async (ctx, { farmerId, formId, communityId, fieldValues }) => {
    // Verify farmer is member of community
    const isMember = await isUserCommunityMember(ctx.db, farmerId, communityId);
    if (!isMember) throw new Error("Not a member of this community");

    // Verify form exists and is farm needs type
    const form = await ctx.db.get(formId);
    if (!form || (form as any).formPurpose !== "farmNeeds") {
      throw new Error("Invalid form");
    }

    // Create response record
    const responseId = await ctx.db.insert("formResponses", {
      formId,
      communityId,
      memberId: farmerId,
      status: "SUBMITTED",
      createdAt: getUgandaTime(),
      updatedAt: getUgandaTime(),
    });

    // Insert field values
    for (const { fieldId, value } of fieldValues) {
      await ctx.db.insert("formResponseValues", {
        responseId,
        fieldId,
        value,
        createdAt: getUgandaTime(),
      });
    }

    return { responseId };
  },
});

/**
 * Get farmer's past Farm Needs responses
 */
export const getMyFarmNeedsResponses = query({
  args: { farmerId: v.id("users") },
  handler: async (ctx, { farmerId }) => {
    const responses = await ctx.db
      .query("formResponses")
      .withIndex("by_member", q => q.eq("memberId", farmerId))
      .collect();

    // Filter to only farm needs form responses
    const farmNeedsResponses = [];
    for (const response of responses) {
      const form = await ctx.db.get((response as any).formId);
      if (form && (form as any).formPurpose === "farmNeeds") {
        const fields = await ctx.db
          .query("formFields")
          .withIndex("by_form", q => q.eq("formId", (response as any).formId))
          .collect();

        const values = await ctx.db
          .query("formResponseValues")
          .withIndex("by_response", q => q.eq("responseId", response._id))
          .collect();

        const community = await ctx.db.get((response as any).communityId);

        farmNeedsResponses.push({
          responseId: response._id,
          formId: (response as any).formId,
          formName: (form as any).name,
          communityId: (response as any).communityId,
          communityName: (community as any)?.name,
          category: (form as any).category || "crops",
          submittedAt: response.createdAt,
          fieldResponses: values.map((v: any) => {
            const field = fields.find((f: any) => f._id === v.fieldId);
            const fieldType = (field as any)?.fieldType || "text";
            let photoUrl: string | null = null;
            if (fieldType === "camera" && v.value) {
              try {
                const parsed = JSON.parse(v.value as string);
                photoUrl = typeof parsed?.dataUrl === "string" ? parsed.dataUrl : null;
              } catch { photoUrl = null; }
            }
            return {
              fieldLabel: (field as any)?.label || "Unknown",
              fieldType,
              value: v.value,
              photoUrl,
            };
          }),
        });
      }
    }

    return farmNeedsResponses.sort((a: any, b: any) => b.submittedAt - a.submittedAt);
  },
});

/**
 * Get a Farm Needs form by ID with all fields
 */
export const getFarmNeedsFormById = query({
  args: { formId: v.id("communityForms") },
  handler: async (ctx, { formId }) => {
    const form = await ctx.db.get(formId);
    if (!form || (form as any).formPurpose !== "farmNeeds") {
      return null;
    }

    const fields = await ctx.db
      .query("formFields")
      .withIndex("by_form", q => q.eq("formId", formId))
      .collect();

    const community = await ctx.db.get((form as any).communityId);

    return {
      formId: form._id,
      communityId: (form as any).communityId,
      communityName: (community as any)?.name,
      name: (form as any).name,
      description: (form as any).description,
      category: (form as any).category || "crops",
      fields: fields.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)),
    };
  },
});

/**
 * Create a new Farm Needs form (Community Admin or SuperAdmin)
 */
export const createFarmNeedsForm = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.id("communities"),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.union(v.literal("crops"), v.literal("livestock")), // crops | livestock
    fields: v.array(v.object({
      fieldType: v.string(),
      label: v.string(),
      required: v.boolean(),
      placeholder: v.optional(v.string()),
      helpText: v.optional(v.string()),
      options: v.optional(v.array(v.string())),
      order: v.number(),
    })),
  },
  handler: async (ctx, { adminId, communityId, name, description, category, fields }) => {
    const admin = await ctx.db.get(adminId);
    if (!admin || (admin as any).role !== "admin") {
      throw new Error("Not an admin");
    }

    const community = await ctx.db.get(communityId);
    if (!community) throw new Error("Community not found");

    // Verify admin has access to this community
    const isCommunityAdmin = (community as any).communityAdminId === adminId;
    const isSuperAdmin = (admin as any).adminLevel === "super" || !(admin as any).adminLevel;
    if (!isCommunityAdmin && !isSuperAdmin) {
      throw new Error("Not authorized to manage this community");
    }

    const now = getUgandaTime();

    // Create form
    const formId = await ctx.db.insert("communityForms", {
      communityId,
      adminId,
      name,
      description,
      isActive: true,
      responseCount: 0,
      category,
      formPurpose: "farmNeeds",
      qrEnabled: true,
      qrSlug: "pending",
      qrCreatedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(formId, {
      qrEnabled: true,
      qrSlug: buildFarmNeedsQrSlug(formId),
      qrCreatedAt: now,
      updatedAt: now,
    });

    // Create fields
    for (const field of fields) {
      await ctx.db.insert("formFields", {
        formId,
        fieldType: field.fieldType,
        label: field.label,
        required: field.required,
        placeholder: field.placeholder,
        helpText: field.helpText,
        options: field.options,
        order: field.order,
        createdAt: now,
      });
    }

    return { formId };
  },
});

/**
 * Enable/disable Farm Needs feature for a community (SuperAdmin only)
 */
export const enableCommunityFarmNeeds = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.id("communities"),
    enabled: v.boolean(),
  },
  handler: async (ctx, { adminId, communityId, enabled }) => {
    const admin = await ctx.db.get(adminId);
    if (!admin) throw new Error("User not found");

    // Verify SuperAdmin
    const isSuperAdmin = (admin as any).adminLevel === "super" || !(admin as any).adminLevel;
    if (!isSuperAdmin) {
      throw new Error("Only SuperAdmin can enable/disable community features");
    }

    const community = await ctx.db.get(communityId);
    if (!community) throw new Error("Community not found");

    // Update community
    await ctx.db.patch(communityId, {
      farmNeedsEnabled: enabled,
    });

    return { success: true };
  },
});

/**
 * Enable/disable Fertilizer feature for a community (SuperAdmin only)
 */
export const enableCommunityFertilizer = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.id("communities"),
    enabled: v.boolean(),
  },
  handler: async (ctx, { adminId, communityId, enabled }) => {
    const admin = await ctx.db.get(adminId);
    if (!admin) throw new Error("User not found");

    // Verify SuperAdmin
    const isSuperAdmin = (admin as any).adminLevel === "super" || !(admin as any).adminLevel;
    if (!isSuperAdmin) {
      throw new Error("Only SuperAdmin can enable/disable community features");
    }

    const community = await ctx.db.get(communityId);
    if (!community) throw new Error("Community not found");

    // Update community
    await ctx.db.patch(communityId, {
      fertilizerEnabled: enabled,
    });

    return { success: true };
  },
});

/**
 * Get all Farm Needs forms for a community (Admin view)
 */
export const getCommunityFarmNeedsForms = query({
  args: { adminId: v.id("users"), communityId: v.id("communities") },
  handler: async (ctx, { adminId, communityId }) => {
    const admin = await ctx.db.get(adminId);
    if (!admin || (admin as any).role !== "admin") {
      throw new Error("Not an admin");
    }

    const community = await ctx.db.get(communityId);
    if (!community) throw new Error("Community not found");

    // Verify admin has access
    const isCommunityAdmin = (community as any).communityAdminId === adminId;
    const isSuperAdmin = (admin as any).adminLevel === "super" || !(admin as any).adminLevel;
    if (!isCommunityAdmin && !isSuperAdmin) {
      throw new Error("Not authorized");
    }

    const forms = await ctx.db
      .query("communityForms")
      .withIndex("by_community", q => q.eq("communityId", communityId))
      .collect();

    const farmNeedsForms = [];
    for (const form of forms) {
      if ((form as any).formPurpose === "farmNeeds") {
        const fields = await ctx.db
          .query("formFields")
          .withIndex("by_form", q => q.eq("formId", form._id))
          .collect();

        const responses = await ctx.db
          .query("formResponses")
          .withIndex("by_form", q => q.eq("formId", form._id))
          .collect();

        farmNeedsForms.push({
          formId: form._id,
          name: (form as any).name,
          category: (form as any).category || "crops",
          isActive: (form as any).isActive,
          responseCount: responses.length,
          fieldCount: fields.length,
          qrEnabled: (form as any).qrEnabled ?? true,
          qrSlug: (form as any).qrSlug || buildFarmNeedsQrSlug(form._id),
          qrPath: `/farmer/farm-needs?formId=${String(form._id)}`,
          createdAt: (form as any).createdAt,
        });
      }
    }

    return farmNeedsForms.sort((a: any, b: any) => b.createdAt - a.createdAt);
  },
});
