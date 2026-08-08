import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import {
  requireCrmSupervisorAccess,
  requireCrmSupervisorOrAgentAccess,
} from "./crmAuth";

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_OPENING_SCRIPT_TEMPLATE =
  "Good morning, {{customer_gender_title}} {{customer_last_name}}. My name is {{agent_name}} calling from Bio Farm. You previously purchased our fertilizer on {{purchase_date}}. We are following up to find out how it has performed on your farm and whether you need any assistance.";

const ALLOWED_SCRIPT_TOKENS = new Set([
  "agent_name",
  "customer_full_name",
  "customer_last_name",
  "customer_gender_title",
  "product_name",
  "quantity",
  "purchase_date",
  "district",
  "sub_county",
  "community_name",
  "today_date",
]);

function assertValidFollowUpOffsetDays(days: number) {
  if (!Number.isInteger(days) || days < 0 || days > 365) {
    throw new Error("followUpOffsetDays must be an integer between 0 and 365");
  }
}

function assertScriptTemplateSafe(template: string | undefined) {
  if (!template) return;

  const tokenMatches = template.match(/{{\s*([a-z_]+)\s*}}/g) || [];
  for (const tokenMatch of tokenMatches) {
    const token = tokenMatch.replace(/{{\s*|\s*}}/g, "");
    if (!ALLOWED_SCRIPT_TOKENS.has(token)) {
      throw new Error(`Unsupported script token: ${token}`);
    }
  }
}

function formatIsoDate(ts: number) {
  return new Date(ts).toISOString().split("T")[0];
}

function customerLastName(name: string | undefined) {
  if (!name) return "valued customer";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "valued customer";
  return parts[parts.length - 1];
}

function renderTemplate(template: string, tokens: Record<string, string>) {
  return template.replace(/{{\s*([a-z_]+)\s*}}/g, (_, key) => tokens[key] || "");
}

async function upsertLeadFromResponse(
  ctx: any,
  args: {
    communityId: Id<"communities">;
    memberId: Id<"users">;
    responseId: Id<"crmFormResponses">;
    crmFormId: Id<"crmForms">;
    autoNextCallAt: number;
  }
) {
  const now = getUgandaTime();
  const existing = await ctx.db
    .query("crmLeads")
    .withIndex("by_source_response", (q: any) =>
      q.eq("sourceCrmResponseId", args.responseId)
    )
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      nextCallAt: args.autoNextCallAt,
      queueStatus: existing.queueStatus === "closed" ? "open" : existing.queueStatus,
      updatedAt: now,
    });
    return existing._id as Id<"crmLeads">;
  }

  const leadId = await ctx.db.insert("crmLeads", {
    communityId: args.communityId,
    memberId: args.memberId,
    sourceCrmResponseId: args.responseId,
    sourceCrmFormId: args.crmFormId,
    queueStatus: "open",
    nextCallAt: args.autoNextCallAt,
    priority: 0,
    createdAt: now,
    updatedAt: now,
  });

  return leadId;
}

export const createCrmForm = mutation({
  args: {
    communityId: v.id("communities"),
    adminId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    followUpOffsetDays: v.number(),
    openingScriptEnabled: v.optional(v.boolean()),
    openingScriptTemplate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireCrmSupervisorAccess(ctx, args.adminId, args.communityId);
    assertValidFollowUpOffsetDays(args.followUpOffsetDays);

    const scriptTemplate = args.openingScriptTemplate || DEFAULT_OPENING_SCRIPT_TEMPLATE;
    assertScriptTemplateSafe(scriptTemplate);

    const now = getUgandaTime();
    const formId = await ctx.db.insert("crmForms", {
      communityId: args.communityId,
      createdByAdminId: args.adminId,
      name: args.name,
      description: args.description,
      isActive: true,
      followUpOffsetDays: args.followUpOffsetDays,
      openingScriptEnabled: args.openingScriptEnabled ?? true,
      openingScriptTemplate: scriptTemplate,
      openingScriptVersion: 1,
      createdAt: now,
      updatedAt: now,
    });

    return { formId };
  },
});

export const updateCrmForm = mutation({
  args: {
    crmFormId: v.id("crmForms"),
    adminId: v.id("users"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    followUpOffsetDays: v.optional(v.number()),
    openingScriptEnabled: v.optional(v.boolean()),
    openingScriptTemplate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.crmFormId);
    if (!form) throw new Error("CRM form not found");

    await requireCrmSupervisorAccess(ctx, args.adminId, form.communityId);

    if (args.followUpOffsetDays !== undefined) {
      assertValidFollowUpOffsetDays(args.followUpOffsetDays);
    }

    if (args.openingScriptTemplate !== undefined) {
      assertScriptTemplateSafe(args.openingScriptTemplate);
    }

    const now = getUgandaTime();
    const updates: any = { updatedAt: now };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    if (args.followUpOffsetDays !== undefined) updates.followUpOffsetDays = args.followUpOffsetDays;
    if (args.openingScriptEnabled !== undefined) updates.openingScriptEnabled = args.openingScriptEnabled;

    if (args.openingScriptTemplate !== undefined) {
      updates.openingScriptTemplate = args.openingScriptTemplate;
      updates.openingScriptVersion = Number(form.openingScriptVersion || 1) + 1;
    }

    await ctx.db.patch(args.crmFormId, updates);

    return { success: true };
  },
});

export const addCrmFormField = mutation({
  args: {
    crmFormId: v.id("crmForms"),
    adminId: v.id("users"),
    fieldType: v.string(),
    label: v.string(),
    required: v.boolean(),
    helpText: v.optional(v.string()),
    placeholder: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    presetKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.crmFormId);
    if (!form) throw new Error("CRM form not found");

    await requireCrmSupervisorAccess(ctx, args.adminId, form.communityId);

    const fields = await ctx.db
      .query("crmFormFields")
      .withIndex("by_form", (q: any) => q.eq("crmFormId", args.crmFormId))
      .collect();

    const now = getUgandaTime();
    const fieldId = await ctx.db.insert("crmFormFields", {
      crmFormId: args.crmFormId,
      fieldType: args.fieldType,
      label: args.label,
      required: args.required,
      helpText: args.helpText,
      placeholder: args.placeholder,
      options: args.options,
      presetKey: args.presetKey,
      order: fields.length + 1,
      createdAt: now,
      updatedAt: now,
    });

    return { fieldId };
  },
});

export const updateCrmFormField = mutation({
  args: {
    crmFieldId: v.id("crmFormFields"),
    adminId: v.id("users"),
    label: v.optional(v.string()),
    required: v.optional(v.boolean()),
    helpText: v.optional(v.string()),
    placeholder: v.optional(v.string()),
    options: v.optional(v.array(v.string())),
    presetKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const field = await ctx.db.get(args.crmFieldId);
    if (!field) throw new Error("CRM field not found");

    const form = await ctx.db.get(field.crmFormId);
    if (!form) throw new Error("CRM form not found");

    await requireCrmSupervisorAccess(ctx, args.adminId, form.communityId);

    const updates: any = { updatedAt: getUgandaTime() };
    if (args.label !== undefined) updates.label = args.label;
    if (args.required !== undefined) updates.required = args.required;
    if (args.helpText !== undefined) updates.helpText = args.helpText;
    if (args.placeholder !== undefined) updates.placeholder = args.placeholder;
    if (args.options !== undefined) updates.options = args.options;
    if (args.presetKey !== undefined) updates.presetKey = args.presetKey;

    await ctx.db.patch(args.crmFieldId, updates);

    return { success: true };
  },
});

export const removeCrmFormField = mutation({
  args: {
    crmFieldId: v.id("crmFormFields"),
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const field = await ctx.db.get(args.crmFieldId);
    if (!field) throw new Error("CRM field not found");

    const form = await ctx.db.get(field.crmFormId);
    if (!form) throw new Error("CRM form not found");

    await requireCrmSupervisorAccess(ctx, args.adminId, form.communityId);

    const values = await ctx.db
      .query("crmFormResponseValues")
      .withIndex("by_field", (q: any) => q.eq("crmFieldId", args.crmFieldId))
      .collect();

    for (const row of values) {
      await ctx.db.delete(row._id);
    }

    await ctx.db.delete(args.crmFieldId);

    return { success: true };
  },
});

export const getCommunityCrmForms = query({
  args: {
    communityId: v.id("communities"),
    requesterId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireCrmSupervisorOrAgentAccess(ctx, args.requesterId, args.communityId);

    const forms = await ctx.db
      .query("crmForms")
      .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
      .order("desc")
      .collect();

    return forms;
  },
});

export const getCrmFormDetails = query({
  args: {
    crmFormId: v.id("crmForms"),
    requesterId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.crmFormId);
    if (!form) return null;

    await requireCrmSupervisorOrAgentAccess(ctx, args.requesterId, form.communityId);

    const fields = await ctx.db
      .query("crmFormFields")
      .withIndex("by_form", (q: any) => q.eq("crmFormId", args.crmFormId))
      .collect();

    fields.sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0));

    return {
      form,
      fields,
    };
  },
});

export const submitCrmFormResponse = mutation({
  args: {
    crmFormId: v.id("crmForms"),
    memberId: v.id("users"),
    submittedByUserId: v.id("users"),
    sourceEventType: v.union(
      v.literal("biofarm_purchase"),
      v.literal("manual_entry"),
      v.literal("extension_capture")
    ),
    sourceEventId: v.optional(v.string()),
    purchaseDate: v.optional(v.string()),
    productName: v.optional(v.string()),
    purchaseQuantity: v.optional(v.string()),
    district: v.optional(v.string()),
    subCounty: v.optional(v.string()),
    responses: v.array(
      v.object({
        crmFieldId: v.id("crmFormFields"),
        value: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.crmFormId);
    if (!form) throw new Error("CRM form not found");

    await requireCrmSupervisorOrAgentAccess(ctx, args.submittedByUserId, form.communityId);

    const now = getUgandaTime();
    const autoNextCallAt = now + Number(form.followUpOffsetDays || 0) * DAY_MS;

    const responseId = await ctx.db.insert("crmFormResponses", {
      crmFormId: args.crmFormId,
      communityId: form.communityId,
      memberId: args.memberId,
      submittedByUserId: args.submittedByUserId,
      sourceEventType: args.sourceEventType,
      sourceEventId: args.sourceEventId,
      purchaseDate: args.purchaseDate,
      productName: args.productName,
      purchaseQuantity: args.purchaseQuantity,
      district: args.district,
      subCounty: args.subCounty,
      autoNextCallAt,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    for (const item of args.responses) {
      await ctx.db.insert("crmFormResponseValues", {
        crmResponseId: responseId,
        crmFieldId: item.crmFieldId,
        value: item.value,
        createdAt: now,
        updatedAt: now,
      });
    }

    const leadId = await upsertLeadFromResponse(ctx, {
      communityId: form.communityId,
      memberId: args.memberId,
      responseId,
      crmFormId: args.crmFormId,
      autoNextCallAt,
    });

    return {
      responseId,
      leadId,
      autoNextCallAt,
    };
  },
});

export const getLeadOpeningScript = query({
  args: {
    leadId: v.id("crmLeads"),
    requesterId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) return null;

    await requireCrmSupervisorOrAgentAccess(ctx, args.requesterId, lead.communityId);

    const form = await ctx.db.get(lead.sourceCrmFormId);
    if (!form || form.openingScriptEnabled === false) {
      return null;
    }

    const response = await ctx.db.get(lead.sourceCrmResponseId);
    const member = await ctx.db.get(lead.memberId);
    const community = await ctx.db.get(lead.communityId);
    const requester = await ctx.db.get(args.requesterId);

    const displayName =
      requester?.alias || requester?.email || requester?.phoneNumber || "Agent";

    const memberName =
      member?.alias || member?.email || member?.phoneNumber || "valued customer";

    const genderTitle =
      member?.sex === "M" ? "Mr" : member?.sex === "F" ? "Mrs" : "Mr/Mrs";

    const template =
      form.openingScriptTemplate || DEFAULT_OPENING_SCRIPT_TEMPLATE;

    const rendered = renderTemplate(template, {
      agent_name: String(displayName),
      customer_full_name: String(memberName),
      customer_last_name: customerLastName(String(memberName)),
      customer_gender_title: genderTitle,
      product_name: String(response?.productName || "Bio Farm fertilizer"),
      quantity: String(response?.purchaseQuantity || "-"),
      purchase_date: String(response?.purchaseDate || "your recent purchase"),
      district: String(response?.district || "-"),
      sub_county: String(response?.subCounty || "-"),
      community_name: String(community?.name || "Bio Farm"),
      today_date: formatIsoDate(getUgandaTime()),
    });

    return {
      leadId: args.leadId,
      scriptVersion: Number(form.openingScriptVersion || 1),
      template,
      rendered,
    };
  },
});
