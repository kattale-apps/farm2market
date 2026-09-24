import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import {
  requireCrmSupervisorAccess,
  requireCrmSupervisorOrAgentAccess,
  resolveCrmAgentDisplayName,
} from "./crmAuth";
import { getCommunityDefaultRole, ensureMandatoryRoleCommunityMembershipsForUser } from "./communities";
import {
  ALLOWED_SCRIPT_TOKENS as SHARED_SCRIPT_TOKENS,
  DEFAULT_OPENING_SCRIPT_TEMPLATE,
  SCRIPT_TOKEN_FALLBACKS,
} from "./crmPresets";

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

/**
 * Every spelling one phone number is stored under. CRM-created accounts hold
 * the normalized 256XXXXXXXXX form, but older sign-ups kept what was typed
 * (0XXXXXXXXX, +256XXXXXXXXX), and a lookup on the normalized form alone
 * missed them - so intake created a second account for a number already on
 * file.
 */
function phoneLookupVariants(phone: string): string[] {
  const normalized = normalizePhoneNumber(phone);
  const local = normalized.substring(3);
  return Array.from(new Set([normalized, `+${normalized}`, `0${local}`, local]));
}

async function findUsersByPhone(ctx: any, phone: string) {
  const found = new Map<string, any>();
  for (const variant of phoneLookupVariants(phone)) {
    const rows = await ctx.db
      .query("users")
      .withIndex("by_phone", (q: any) => q.eq("phoneNumber", variant))
      .collect();
    for (const row of rows) found.set(String(row._id), row);
  }
  return Array.from(found.values());
}

/**
 * The one CRM contact a phone number has in a community: the lead already
 * held by any of the accounts on that number. A phone number is a single
 * contact to the agents calling it, so every intake for it lands on this lead.
 * Should older data still hold several, the one still in the queue wins, then
 * the most recently called, then the oldest.
 */
async function findExistingLeadForMembers(
  ctx: any,
  communityId: Id<"communities">,
  memberIds: Id<"users">[]
) {
  const leads: any[] = [];
  for (const memberId of memberIds) {
    const rows = await ctx.db
      .query("crmLeads")
      .withIndex("by_member_community", (q: any) =>
        q.eq("communityId", communityId).eq("memberId", memberId)
      )
      .collect();
    leads.push(...rows);
  }
  if (leads.length === 0) return null;

  const isClosed = (lead: any) => (lead.queueStatus === "closed" ? 1 : 0);
  leads.sort(
    (a, b) =>
      isClosed(a) - isClosed(b) ||
      Number(b.lastCallAt || 0) - Number(a.lastCallAt || 0) ||
      Number(a.createdAt || 0) - Number(b.createdAt || 0)
  );
  return leads[0];
}

/**
 * The account an intake for this member should be filed against. When another
 * account on the same phone number already has the community's lead, that
 * account is used, so picking the "other" account from the member list does
 * not start a second contact for one number.
 */
async function resolveCanonicalCrmMemberId(
  ctx: any,
  communityId: Id<"communities">,
  member: any
): Promise<Id<"users">> {
  if (!member?.phoneNumber) return member._id;
  const siblings = await findUsersByPhone(ctx, member.phoneNumber);
  const ids = siblings.map((s: any) => s._id as Id<"users">);
  if (!ids.some((id) => String(id) === String(member._id))) ids.push(member._id);
  const lead = await findExistingLeadForMembers(ctx, communityId, ids);
  return (lead ? lead.memberId : member._id) as Id<"users">;
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

  // Several accounts can share a number. The one already holding this
  // community's lead is the contact; failing that, one already in the
  // community, then the oldest.
  const candidates = await findUsersByPhone(ctx, args.phoneNumber);
  let existing: any = null;
  if (candidates.length > 0) {
    const lead = await findExistingLeadForMembers(
      ctx,
      args.communityId,
      candidates.map((c: any) => c._id)
    );
    if (lead) {
      existing = candidates.find((c: any) => String(c._id) === String(lead.memberId));
    }
    if (!existing) {
      for (const candidate of candidates) {
        const membership = await ctx.db
          .query("communityMemberships")
          .withIndex("by_community_user", (q: any) =>
            q.eq("communityId", args.communityId).eq("userId", candidate._id)
          )
          .first();
        if (membership) {
          existing = candidate;
          break;
        }
      }
    }
    if (!existing) {
      existing = [...candidates].sort(
        (a: any, b: any) => Number(a._creationTime) - Number(b._creationTime)
      )[0];
    }
  }

  const now = getUgandaTime();

  const capturedName = String(args.name || "").trim();

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

    // Reconcile the two ways the same person reaches the CRM. Someone captured
    // once as a "new client" and later picked from the "existing member" list
    // is the same account, matched here on phone number - but until now the
    // name typed at intake was written only onto that one submission, so the
    // member itself kept its anonymous alias and every later lead showed
    // `farmer_ab12cd` instead of who the agent is actually calling. Promoting
    // the captured name onto the member fixes it everywhere at once.
    if (capturedName && !existing.verifiedName) {
      await ctx.db.patch(existing._id, { verifiedName: capturedName });
    }

    return {
      memberId: existing._id as Id<"users">,
      wasNewClient: false,
      resolvedName: capturedName || existing.verifiedName || undefined,
    };
  }

  const community = await ctx.db.get(args.communityId);
  const role = getCommunityDefaultRole((community as any)?.communityType);
  const alias = generateAlias(role);
  const passwordHash = simpleHash(normalizedPhone);

  const memberId = await ctx.db.insert("users", {
    phoneNumber: normalizedPhone,
    role,
    alias,
    // The alias stays anonymized, but the name the supervisor typed is the
    // whole point of the intake - it is stored on the member so it survives
    // beyond the single submission that captured it.
    verifiedName: capturedName || undefined,
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

  return {
    memberId: memberId as Id<"users">,
    wasNewClient: true,
    resolvedName: capturedName || undefined,
  };
}

const ALLOWED_SCRIPT_TOKENS = new Set<string>(SHARED_SCRIPT_TOKENS);

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
  if (!name) return SCRIPT_TOKEN_FALLBACKS.customer_name;
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return SCRIPT_TOKEN_FALLBACKS.customer_name;
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
    return { leadId: existing._id as Id<"crmLeads">, reconciled: false };
  }

  // One contact per phone number per community. Callers have already resolved
  // memberId to the account holding that contact's lead, so any lead this
  // member has - whatever its form, whether or not it has been called, even if
  // closed - is the same contact and is updated rather than duplicated. Its
  // call logs, answers and tickets hang off the lead id and carry on intact.
  //
  // A lead already waiting in the queue keeps the sooner of its due date and
  // this intake's; a finished or closed one returns to the queue on this
  // intake's schedule.
  const existingLead = await findExistingLeadForMembers(ctx, args.communityId, [args.memberId]);

  if (existingLead) {
    const inQueue =
      existingLead.queueStatus === "open" || existingLead.queueStatus === "in_progress";
    await ctx.db.patch(existingLead._id, {
      sourceCrmResponseId: args.responseId,
      sourceCrmFormId: args.crmFormId,
      nextCallAt: inQueue
        ? Math.min(Number(existingLead.nextCallAt), args.autoNextCallAt)
        : args.autoNextCallAt,
      queueStatus: inQueue ? existingLead.queueStatus : "open",
      updatedAt: now,
    });
    return { leadId: existingLead._id as Id<"crmLeads">, reconciled: true };
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

  return { leadId: leadId as Id<"crmLeads">, reconciled: false };
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

/**
 * Delete a CRM form.
 *
 * A form with submissions used to be undeletable: the mutation threw and told
 * the supervisor to deactivate it instead. That left the delete button on the
 * dashboard looking broken, because every form that had ever been used refused
 * to go. It now deletes them, but never on the strength of one click - the
 * caller has to come back a second time with deleteResponses set, and the
 * first call returns the exact counts so the confirmation can say what is
 * about to be destroyed. Submitted intake answers and the call answers taken
 * against them are the community's record of those conversations, so they are
 * only removed when someone has been shown what they are giving up.
 *
 * Convex has no cascading delete, so every child row is swept explicitly. A
 * missed table leaves call answers pointing at a field or lead id that no
 * longer resolves, which the analytics queries go on counting.
 */
export const deleteCrmForm = mutation({
  args: {
    crmFormId: v.id("crmForms"),
    adminId: v.id("users"),
    /**
     * Destroy the form's submissions, leads and call history along with it.
     * Omitted on the first call so the UI can report what would be lost.
     */
    deleteResponses: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const form = await ctx.db.get(args.crmFormId);
    if (!form) throw new Error("CRM form not found");

    await requireCrmSupervisorAccess(ctx, args.adminId, form.communityId);

    const responses = await ctx.db
      .query("crmFormResponses")
      .withIndex("by_form", (q: any) => q.eq("crmFormId", args.crmFormId))
      .collect();

    const leads: any[] = [];
    for (const response of responses) {
      const responseLeads = await ctx.db
        .query("crmLeads")
        .withIndex("by_source_response", (q: any) =>
          q.eq("sourceCrmResponseId", response._id)
        )
        .collect();
      leads.push(...responseLeads);
    }

    let callCount = 0;
    for (const lead of leads) {
      const calls = await ctx.db
        .query("crmCallLogs")
        .withIndex("by_lead", (q: any) => q.eq("leadId", lead._id))
        .collect();
      callCount += calls.length;
    }

    // First pass: report, do not delete. The UI turns these counts into the
    // second confirmation prompt.
    if (responses.length > 0 && !args.deleteResponses) {
      return {
        success: false,
        requiresConfirmation: true,
        formName: form.name,
        responseCount: responses.length,
        leadCount: leads.length,
        callCount,
      };
    }

    for (const lead of leads) {
      const callLogs = await ctx.db
        .query("crmCallLogs")
        .withIndex("by_lead", (q: any) => q.eq("leadId", lead._id))
        .collect();
      const callAnswers = await ctx.db
        .query("crmCallAnswers")
        .withIndex("by_lead", (q: any) => q.eq("leadId", lead._id))
        .collect();
      const tickets = await ctx.db
        .query("crmTickets")
        .withIndex("by_lead", (q: any) => q.eq("leadId", lead._id))
        .collect();
      const opportunities = await ctx.db
        .query("crmSalesOpportunities")
        .withIndex("by_lead", (q: any) => q.eq("leadId", lead._id))
        .collect();

      for (const row of callAnswers) await ctx.db.delete(row._id);
      for (const row of callLogs) await ctx.db.delete(row._id);
      for (const row of tickets) await ctx.db.delete(row._id);
      for (const row of opportunities) await ctx.db.delete(row._id);
      await ctx.db.delete(lead._id);
    }

    for (const response of responses) {
      const values = await ctx.db
        .query("crmFormResponseValues")
        .withIndex("by_response", (q: any) => q.eq("crmResponseId", response._id))
        .collect();
      for (const row of values) await ctx.db.delete(row._id);
      await ctx.db.delete(response._id);
    }

    const fields = await ctx.db
      .query("crmFormFields")
      .withIndex("by_form", (q: any) => q.eq("crmFormId", args.crmFormId))
      .collect();

    for (const field of fields) {
      const values = await ctx.db
        .query("crmFormResponseValues")
        .withIndex("by_field", (q: any) => q.eq("crmFieldId", field._id))
        .collect();
      for (const row of values) await ctx.db.delete(row._id);

      // Call answers snapshot the field they were taken against. They belong
      // to a lead that has just gone, but a call answer from a lead sourced
      // elsewhere could still reference this field, so sweep by field too.
      const answers = await ctx.db
        .query("crmCallAnswers")
        .withIndex("by_field", (q: any) => q.eq("crmFieldId", field._id))
        .collect();
      for (const row of answers) await ctx.db.delete(row._id);

      await ctx.db.delete(field._id);
    }

    await ctx.db.delete(args.crmFormId);

    return {
      success: true,
      requiresConfirmation: false,
      formName: form.name,
      responseCount: responses.length,
      leadCount: leads.length,
      callCount,
    };
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

/**
 * Community members available for CRM intake, with their on-file location
 * (district/sub-county/parish/county/village) so the intake form can
 * auto-populate location instead of the admin re-entering it by hand. Sourced
 * from the same `communityMemberships` join used for community messaging, so
 * the set of members returned matches what admins already see elsewhere -
 * this only adds location fields, it doesn't change who counts as a member.
 */
export const getCommunityMembersForCrmIntake = query({
  args: {
    communityId: v.id("communities"),
    requesterId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireCrmSupervisorOrAgentAccess(ctx, args.requesterId, args.communityId);

    const memberships = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
      .collect();

    const members: any[] = [];
    for (const m of memberships) {
      const user = await ctx.db.get(m.userId);
      if (!user) continue;
      members.push({
        userId: user._id,
        alias: user.alias || "Unknown",
        // What a supervisor should actually see in the picker. Without it the
        // list showed only anonymized aliases, so a member captured earlier by
        // name was unrecognisable and unsearchable, and got re-added as a
        // brand new client instead of being reused.
        displayName: user.verifiedName || user.alias || "Unknown",
        hasVerifiedName: Boolean(user.verifiedName),
        role: user.role || "farmer",
        email: user.email,
        phoneNumber: user.phoneNumber,
        districtText: user.districtText,
        subCountyText: user.subCountyText,
        parishText: user.parishText,
        county: user.county,
        village: user.village,
      });
    }

    return members;
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
      v.literal("purchase_capture"),
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

    const member = await ctx.db.get(args.memberId);
    const memberId = member
      ? await resolveCanonicalCrmMemberId(ctx, form.communityId, member)
      : args.memberId;

    const now = getUgandaTime();
    const autoNextCallAt = now + Number(form.followUpOffsetDays || 0) * DAY_MS;

    const responseId = await ctx.db.insert("crmFormResponses", {
      crmFormId: args.crmFormId,
      communityId: form.communityId,
      memberId,
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

    const lead = await upsertLeadFromResponse(ctx, {
      communityId: form.communityId,
      memberId,
      responseId,
      crmFormId: args.crmFormId,
      autoNextCallAt,
    });

    return {
      responseId,
      leadId: lead.leadId,
      reconciledExistingLead: lead.reconciled,
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
    // Only ever a real name. Falling back to the account alias here wrote
    // `vendor_akkqf4` into the submission as though a human had given that
    // name, and the agent queue then showed it as the person to ask for.
    // Leaving it unset lets every reader fall back to the member's own alias,
    // which at least reads as the placeholder it is.
    let resolvedClientName: string | undefined;

    if (args.newClient) {
      const resolved = await resolveOrCreateClientMember(ctx, {
        communityId: form.communityId,
        name: args.newClient.name,
        phoneNumber: args.newClient.phoneNumber,
      });
      memberId = resolved.memberId;
      wasNewClient = resolved.wasNewClient;
      resolvedClientName = resolved.resolvedName;
    } else {
      const member = await ctx.db.get(args.existingMemberId as Id<"users">);
      if (!member) throw new Error("Selected member not found");
      memberId = await resolveCanonicalCrmMemberId(ctx, form.communityId, member);
      const canonical =
        String(memberId) === String(member._id) ? member : await ctx.db.get(memberId);
      resolvedClientName = canonical?.verifiedName || member.verifiedName || undefined;
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

    const lead = await upsertLeadFromResponse(ctx, {
      communityId: form.communityId,
      memberId,
      responseId,
      crmFormId: args.crmFormId,
      autoNextCallAt,
    });

    return {
      responseId,
      leadId: lead.leadId,
      // True when this intake updated an existing uncalled lead for the same
      // member instead of adding a second one to the queue.
      reconciledExistingLead: lead.reconciled,
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
    // The agent introduces themselves by the display name their supervisor
    // captured when assigning them, not by their account alias.
    const displayName = await resolveCrmAgentDisplayName(
      ctx,
      args.requesterId,
      lead.communityId
    );

    const memberName =
      member?.verifiedName || (response as any)?.clientName || member?.alias || member?.email || member?.phoneNumber || SCRIPT_TOKEN_FALLBACKS.customer_name;

    const genderTitle =
      member?.sex === "M" ? "Mr" : member?.sex === "F" ? "Mrs" : "Mr/Mrs";

    const template =
      form.openingScriptTemplate || DEFAULT_OPENING_SCRIPT_TEMPLATE;

    const rendered = renderTemplate(template, {
      agent_name: String(displayName),
      customer_full_name: String(memberName),
      customer_last_name: customerLastName(String(memberName)),
      customer_gender_title: genderTitle,
      product_name: String(response?.productName || SCRIPT_TOKEN_FALLBACKS.product_name),
      quantity: String(response?.purchaseQuantity || "-"),
      purchase_date: String(response?.purchaseDate || SCRIPT_TOKEN_FALLBACKS.purchase_date),
      district: String(response?.district || "-"),
      sub_county: String(response?.subCounty || "-"),
      parish: String((response as any)?.parish || "-"),
      phone_number: String(member?.phoneNumber || "-"),
      crop_grown: String((response as any)?.cropGrown || "-"),
      month_of_planting: String((response as any)?.monthOfPlanting || "-"),
      community_name: String(community?.name || SCRIPT_TOKEN_FALLBACKS.community_name),
      today_date: formatIsoDate(getUgandaTime()),
    });

    return {
      leadId: args.leadId,
      scriptVersion: Number(form.openingScriptVersion || 1),
      template,
      rendered,
      profile: {
        clientName: member?.verifiedName || (response as any)?.clientName || member?.alias || "Unknown",
        isNameVerified: Boolean(member?.verifiedName),
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

/**
 * Promote names captured at intake onto the member accounts they belong to.
 *
 * Intake used to write the client's name only onto the submission, so a person
 * captured by name once and then picked from the member list later showed up
 * under their anonymized alias - the same human appearing twice in the queue,
 * unrecognisable the second time. New intakes now set the member's name
 * directly; this repairs the accounts captured before that.
 *
 * Only fills a name that is missing. An account whose name an agent already
 * verified on a call is left exactly as it is, because that name was confirmed
 * with the person themselves and outranks anything typed at intake.
 */
export const backfillCrmMemberNames = mutation({
  args: {
    communityId: v.id("communities"),
    requesterId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireCrmSupervisorAccess(ctx, args.requesterId, args.communityId);

    const responses = await ctx.db
      .query("crmFormResponses")
      .withIndex("by_community_submitted", (q: any) =>
        q.eq("communityId", args.communityId)
      )
      .collect();

    // Oldest first, so the earliest captured name wins rather than whichever
    // submission happens to be scanned last.
    const ordered = [...responses].sort(
      (a: any, b: any) => Number(a.submittedAt || 0) - Number(b.submittedAt || 0)
    );

    let namesRestored = 0;
    let aliasSnapshotsCleared = 0;
    const handled = new Set<string>();

    for (const response of ordered) {
      const memberKey = String(response.memberId);
      const member = await ctx.db.get(response.memberId);
      if (!member) continue;

      const captured = String((response as any).clientName || "").trim();

      // A submission whose clientName is just a copy of the account alias is
      // the bug's other half: it looked like a real name everywhere it was
      // displayed. Clearing it lets readers fall back to the alias knowingly.
      if (captured && captured === String(member.alias || "")) {
        await ctx.db.patch(response._id, { clientName: undefined });
        aliasSnapshotsCleared++;
        continue;
      }

      if (!captured || handled.has(memberKey)) continue;
      handled.add(memberKey);

      if (!member.verifiedName) {
        await ctx.db.patch(response.memberId, { verifiedName: captured });
        namesRestored++;
      }
    }

    return {
      success: true,
      scanned: ordered.length,
      namesRestored,
      aliasSnapshotsCleared,
    };
  },
});
