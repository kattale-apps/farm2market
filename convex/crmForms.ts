import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import {
  requireCrmSupervisorAccess,
  requireCrmSupervisorOrAgentAccess,
} from "./crmAuth";
import { getCommunityDefaultRole, ensureMandatoryRoleCommunityMembershipsForUser } from "./communities";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Simple hash function for preset passwords (consistent with the rest of the
 * pilot's password handling - NOT production-grade).
 */
function simpleHash(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "256" + cleaned.substring(1);
  } else if (!cleaned.startsWith("256")) {
    cleaned = "256" + cleaned;
  }
  return cleaned;
}

function generateAlias(role: string): string {
  const random = Math.random().toString(36).substring(2, 8);
  return `${role}_${random}`;
}

/**
 * Find an existing community member by phone number, or create a brand-new
 * member account for them. New accounts use their phone number as both the
 * login identifier and the (pilot-grade) password, so CRM staff can capture
 * leads for people who have never used the app before. The account is joined
 * to the intake community immediately so the lead is queryable right away;
 * richer profile data (crops, farm size, GPS, etc.) is filled in later by an
 * agent through the normal community profile/tracker forms once the farmer
 * has been reached.
 */
async function resolveOrCreateClientMember(
  ctx: any,
  args: { communityId: Id<"communities">; name: string; phoneNumber: string }
) {
  const normalizedPhone = normalizePhoneNumber(args.phoneNumber);

  const existing = await ctx.db
    .query("users")
    .withIndex("by_phone", (q: any) => q.eq("phoneNumber", normalizedPhone))
    .first();

  const now = getUgandaTime();

  if (existing) {
    const alreadyMember = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community_user", (q: any) =>
        q.eq("communityId", args.communityId).eq("userId", existing._id)
      )
      .first();

    if (!alreadyMember) {
      await ctx.db.insert("communityMemberships", {
        communityId: args.communityId,
        userId: existing._id,
        joinedAt: now,
      });
    }

    return { memberId: existing._id as Id<"users">, wasNewClient: false };
  }

  const community = await ctx.db.get(args.communityId);
  const role = getCommunityDefaultRole((community as any)?.communityType);
  const alias = generateAlias(role);
  const passwordHash = simpleHash(normalizedPhone);

  const memberId = await ctx.db.insert("users", {
    phoneNumber: normalizedPhone,
    role,
    alias,
    state: "active",
    createdAt: now,
    lastActiveAt: now,
    passwordHash,
    accountScope: "community_only",
    onboardedViaCommunityId: args.communityId,
  });

  await ctx.db.insert("communityMemberships", {
    communityId: args.communityId,
    userId: memberId,
    joinedAt: now,
  });

  await ensureMandatoryRoleCommunityMembershipsForUser(ctx, memberId, role);

  return { memberId: memberId as Id<"users">, wasNewClient: true };
}

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
  "parish",
  "phone_number",
  "crop_grown",
  "month_of_planting",
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

/**
 * CRM intake mutation used by admins/supervisors to start the CRM cycle for a
 * person. Either points at an existing community member, or creates a brand
 * new member account from just a name + phone number (the account uses the
 * phone number as its login id and pilot-grade password). Either way, this
 * produces a crmFormResponse + crmLeads row so the person immediately shows
 * up in the agent call queue with an opening script built from the captured
 * profile/agronomic details.
 */
export const submitCrmIntake = mutation({
  args: {
    crmFormId: v.id("crmForms"),
    adminId: v.id("users"),
    existingMemberId: v.optional(v.id("users")),
    newClient: v.optional(
      v.object({
        name: v.string(),
        phoneNumber: v.string(),
      })
    ),
    purchaseDate: v.optional(v.string()),
    productName: v.optional(v.string()),
    purchaseQuantity: v.optional(v.string()),
    district: v.optional(v.string()),
    subCounty: v.optional(v.string()),
    parish: v.optional(v.string()),
    cropGrown: v.optional(v.string()),
    monthOfPlanting: v.optional(v.string()),
    pastSprayDates: v.optional(v.array(v.string())),
    upcomingSprayScheduleAt: v.optional(v.number()),
    responses: v.array(
      v.object({
        crmFieldId: v.id("crmFormFields"),
        value: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (!args.existingMemberId && !args.newClient) {
      throw new Error("Either existingMemberId or newClient is required");
    }

    const form = await ctx.db.get(args.crmFormId);
    if (!form) throw new Error("CRM form not found");

    await requireCrmSupervisorAccess(ctx, args.adminId, form.communityId);

    let memberId: Id<"users">;
    let wasNewClient = false;
    let resolvedClientName = args.newClient?.name;

    if (args.newClient) {
      const resolved = await resolveOrCreateClientMember(ctx, {
        communityId: form.communityId,
        name: args.newClient.name,
        phoneNumber: args.newClient.phoneNumber,
      });
      memberId = resolved.memberId;
      wasNewClient = resolved.wasNewClient;
    } else {
      memberId = args.existingMemberId as Id<"users">;
      const member = await ctx.db.get(memberId);
      if (!member) throw new Error("Selected member not found");
      resolvedClientName = member.alias;
    }

    const now = getUgandaTime();
    const autoNextCallAt = now + Number(form.followUpOffsetDays || 0) * DAY_MS;

    const responseId = await ctx.db.insert("crmFormResponses", {
      crmFormId: args.crmFormId,
      communityId: form.communityId,
      memberId,
      submittedByUserId: args.adminId,
      sourceEventType: "manual_entry",
      purchaseDate: args.purchaseDate,
      productName: args.productName,
      purchaseQuantity: args.purchaseQuantity,
      district: args.district,
      subCounty: args.subCounty,
      parish: args.parish,
      clientName: resolvedClientName,
      cropGrown: args.cropGrown,
      monthOfPlanting: args.monthOfPlanting,
      pastSprayDates: args.pastSprayDates,
      upcomingSprayScheduleAt: args.upcomingSprayScheduleAt,
      wasNewClientAtIntake: wasNewClient,
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
      memberId,
      responseId,
      crmFormId: args.crmFormId,
      autoNextCallAt,
    });

    return {
      responseId,
      leadId,
      memberId,
      wasNewClient,
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
      (response as any)?.clientName || member?.alias || member?.email || member?.phoneNumber || "valued customer";

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
      parish: String((response as any)?.parish || "-"),
      phone_number: String(member?.phoneNumber || "-"),
      crop_grown: String((response as any)?.cropGrown || "-"),
      month_of_planting: String((response as any)?.monthOfPlanting || "-"),
      community_name: String(community?.name || "Bio Farm"),
      today_date: formatIsoDate(getUgandaTime()),
    });

    return {
      leadId: args.leadId,
      scriptVersion: Number(form.openingScriptVersion || 1),
      template,
      rendered,
      profile: {
        clientName: (response as any)?.clientName || member?.alias || "Unknown",
        phoneNumber: member?.phoneNumber || "-",
        district: response?.district || "-",
        subCounty: response?.subCounty || "-",
        parish: (response as any)?.parish || "-",
        cropGrown: (response as any)?.cropGrown || "-",
        monthOfPlanting: (response as any)?.monthOfPlanting || "-",
        pastSprayDates: (response as any)?.pastSprayDates || [],
        upcomingSprayScheduleAt: (response as any)?.upcomingSprayScheduleAt || null,
      },
    };
  },
});
