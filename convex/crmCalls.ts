import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUgandaTime } from "./utils";
import {
  requireCrmSupervisorAccess,
  requireCrmSupervisorOrAgentAccess,
  resolveCrmAgentDisplayName,
} from "./crmAuth";
import { PRESET_KEYS, literalForPresetAnswer } from "./crmPresets";

const DAY_MS = 24 * 60 * 60 * 1000;

function computeHealthScore(args: {
  usageStatus?: "yes" | "partly" | "no" | "unknown";
  resultRating?: "very_good" | "good" | "average" | "poor" | "very_poor";
  issueType?:
    | "none"
    | "application_problem"
    | "product_problem"
    | "packaging_problem"
    | "delivery_problem"
    | "technical_advice"
    | "other";
  repurchaseIntent?: "yes" | "no" | "maybe";
}) {
  // A call nobody recorded anything on has no health, and must not be scored
  // as an average one. Previously the four inputs defaulted to optimistic
  // values on the client, so an unanswered call banked a green 95 and dragged
  // every community average up with it.
  const hasAnySignal =
    args.usageStatus !== undefined ||
    args.resultRating !== undefined ||
    args.issueType !== undefined ||
    args.repurchaseIntent !== undefined;

  if (!hasAnySignal) {
    return { score: undefined, band: undefined };
  }

  let score = 50;

  if (args.usageStatus === "yes") score += 15;
  if (args.usageStatus === "partly") score += 5;
  if (args.usageStatus === "no") score -= 10;

  if (args.resultRating === "very_good") score += 20;
  if (args.resultRating === "good") score += 10;
  if (args.resultRating === "average") score += 0;
  if (args.resultRating === "poor") score -= 15;
  if (args.resultRating === "very_poor") score -= 30;

  if (args.issueType && args.issueType !== "none") score -= 20;
  if (args.repurchaseIntent === "yes") score += 20;
  if (args.repurchaseIntent === "maybe") score += 5;
  if (args.repurchaseIntent === "no") score -= 10;

  const normalized = Math.max(0, Math.min(100, score));

  const band: "green" | "yellow" | "red" =
    normalized >= 70 ? "green" : normalized >= 40 ? "yellow" : "red";

  return {
    score: normalized as number | undefined,
    band: band as "green" | "yellow" | "red" | undefined,
  };
}

/**
 * Reads the four structured outcome values off the answers the agent gave to
 * the form's own questions.
 *
 * The form is the source of truth for a call. Where a supervisor tagged a
 * question with a preset key, that question's answer decides the column, and
 * the matching value passed separately is only a fallback for forms that have
 * no such question. Anything the agent did not answer stays undefined rather
 * than taking a default, so "not recorded" survives all the way into the
 * database instead of being silently read as a good result.
 */
function derivePresetOutcomes(
  answeredFields: Array<{ presetKey?: string; value: string }>
) {
  const byPreset = new Map<string, string>();
  for (const field of answeredFields) {
    const presetKey = String(field.presetKey || "");
    const value = String(field.value || "").trim();
    if (!presetKey || !value) continue;
    const literal = literalForPresetAnswer(presetKey, value);
    if (literal) byPreset.set(presetKey, literal);
  }

  return {
    usageStatus: byPreset.get(PRESET_KEYS.usageStatus) as any,
    resultRating: byPreset.get(PRESET_KEYS.resultRating) as any,
    issueType: byPreset.get(PRESET_KEYS.issueType) as any,
    repurchaseIntent: byPreset.get(PRESET_KEYS.repurchaseIntent) as any,
  };
}

export const submitCrmCallOutcome = mutation({
  args: {
    leadId: v.id("crmLeads"),
    agentId: v.id("users"),
    outcome: v.union(
      v.literal("good_result"),
      v.literal("problem"),
      v.literal("wants_more"),
      v.literal("no_answer")
    ),
    usageStatus: v.optional(v.union(v.literal("yes"), v.literal("partly"), v.literal("no"), v.literal("unknown"))),
    resultRating: v.optional(v.union(v.literal("very_good"), v.literal("good"), v.literal("average"), v.literal("poor"), v.literal("very_poor"))),
    issueType: v.optional(v.union(v.literal("none"), v.literal("application_problem"), v.literal("product_problem"), v.literal("packaging_problem"), v.literal("delivery_problem"), v.literal("technical_advice"), v.literal("other"))),
    repurchaseIntent: v.optional(v.union(v.literal("yes"), v.literal("no"), v.literal("maybe"))),
    notes: v.optional(v.string()),
    callbackDaysOverride: v.optional(v.number()),
    callbackDateOverride: v.optional(v.number()),
    createOpportunity: v.optional(v.boolean()),
    opportunityProductName: v.optional(v.string()),
    opportunityQuantity: v.optional(v.string()),
    expectedPurchaseMonth: v.optional(v.string()),
    probability: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    opportunityNextActionAt: v.optional(v.number()),
    /**
     * Answers to the source form's own questions, captured on this call.
     * Optional so an agent logging "no answer" is not forced to invent them.
     */
    answers: v.optional(
      v.array(
        v.object({
          crmFieldId: v.id("crmFormFields"),
          value: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) {
      throw new Error("CRM lead not found");
    }

    const access = await requireCrmSupervisorOrAgentAccess(ctx, args.agentId, lead.communityId);

    // Agents can only submit outcomes for unassigned leads or their own assigned leads.
    if (
      access.accessRole === "agent" &&
      lead.assignedAgentId &&
      String(lead.assignedAgentId) !== String(args.agentId)
    ) {
      throw new Error("Lead is assigned to another agent");
    }

    const now = getUgandaTime();

    const sourceForm = await ctx.db.get(lead.sourceCrmFormId);
    const defaultDays = Number(sourceForm?.followUpOffsetDays || 0);

    let nextCallAt: number | undefined;
    if (args.callbackDateOverride !== undefined) {
      nextCallAt = args.callbackDateOverride;
    } else if (args.callbackDaysOverride !== undefined) {
      nextCallAt = now + Number(args.callbackDaysOverride) * DAY_MS;
    } else if (args.outcome !== "good_result") {
      nextCallAt = now + defaultDays * DAY_MS;
    }

    // Resolve the answers BEFORE writing the call log, because the answers are
    // what the log's structured columns are derived from. Field definitions are
    // verified to belong to the lead's own form so a caller cannot write values
    // onto another community's questions, and the label is snapshotted so the
    // answer stays readable if the question is later renamed or removed.
    const resolvedAnswers: Array<{
      crmFieldId: any;
      label: string;
      fieldType: string;
      presetKey?: string;
      value: string;
    }> = [];

    for (const answer of args.answers || []) {
      if (!answer.value.trim()) continue;
      const field = await ctx.db.get(answer.crmFieldId);
      if (!field) continue;
      if (String(field.crmFormId) !== String(lead.sourceCrmFormId)) {
        throw new Error("Answer does not belong to this lead's form");
      }
      resolvedAnswers.push({
        crmFieldId: answer.crmFieldId,
        label: field.label,
        fieldType: field.fieldType,
        presetKey: (field as any).presetKey,
        value: answer.value.trim(),
      });
    }

    // The form's own questions win. The explicit arguments are kept only so a
    // form with no preset-tagged questions still records something, and so
    // older clients keep working; neither path invents a value the agent did
    // not give.
    const derived = derivePresetOutcomes(resolvedAnswers);
    const usageStatus = derived.usageStatus ?? args.usageStatus;
    const resultRating = derived.resultRating ?? args.resultRating;
    const issueType = derived.issueType ?? args.issueType;
    const repurchaseIntent = derived.repurchaseIntent ?? args.repurchaseIntent;

    const health = computeHealthScore({
      usageStatus,
      resultRating,
      issueType,
      repurchaseIntent,
    });

    const callLogId = await ctx.db.insert("crmCallLogs", {
      leadId: args.leadId,
      communityId: lead.communityId,
      agentId: args.agentId,
      outcome: args.outcome,
      usageStatus,
      resultRating,
      issueType,
      repurchaseIntent,
      notes: args.notes,
      callbackDaysOverride: args.callbackDaysOverride,
      callbackDateOverride: args.callbackDateOverride,
      computedNextCallAt: nextCallAt,
      healthScore: health.score,
      healthBand: health.band,
      createdAt: now,
    });

    for (const answer of resolvedAnswers) {
      await ctx.db.insert("crmCallAnswers", {
        callLogId,
        leadId: args.leadId,
        communityId: lead.communityId,
        crmFieldId: answer.crmFieldId,
        label: answer.label,
        fieldType: answer.fieldType,
        value: answer.value,
        createdAt: now,
      });
    }

    let queueStatus: "open" | "in_progress" | "called" | "overdue" | "closed" = "called";

    if (args.outcome === "good_result") {
      queueStatus = nextCallAt ? "open" : "closed";
    } else if (args.outcome === "no_answer") {
      queueStatus = "open";
    } else if (args.outcome === "problem") {
      queueStatus = "open";
    } else if (args.outcome === "wants_more") {
      queueStatus = "open";
    }

    await ctx.db.patch(args.leadId, {
      lastCallAt: now,
      lastOutcome: args.outcome,
      nextCallAt: nextCallAt ?? lead.nextCallAt,
      queueStatus,
      // Only overwrite the lead's health when this call actually produced one.
      // A later "no answer" must not erase what the last real conversation said.
      latestHealthScore: health.score ?? lead.latestHealthScore,
      latestHealthBand: health.band ?? lead.latestHealthBand,
      updatedAt: now,
    });

    let ticketId: string | undefined;
    if (args.outcome === "problem" || (issueType && issueType !== "none")) {
      const id = await ctx.db.insert("crmTickets", {
        leadId: args.leadId,
        communityId: lead.communityId,
        openedByAgentId: args.agentId,
        title: "Customer follow-up issue",
        details: args.notes,
        status: "open",
        createdAt: now,
        updatedAt: now,
      });
      ticketId = String(id);
    }

    // An opportunity is a claim that a named person said they want to buy
    // again, so it is only created when the call recorded that. It used to
    // fire on a client-side default of "yes", which manufactured a pipeline
    // entry for every call including ones nobody answered.
    let opportunityId: string | undefined;
    const shouldCreateOpportunity =
      args.outcome !== "no_answer" &&
      (args.createOpportunity === true ||
        args.outcome === "wants_more" ||
        repurchaseIntent === "yes");

    if (shouldCreateOpportunity) {
      const id = await ctx.db.insert("crmSalesOpportunities", {
        leadId: args.leadId,
        communityId: lead.communityId,
        openedByAgentId: args.agentId,
        productName: args.opportunityProductName,
        quantity: args.opportunityQuantity,
        expectedPurchaseMonth: args.expectedPurchaseMonth,
        probability: args.probability || "high",
        nextActionAt: args.opportunityNextActionAt,
        stage: "follow_up",
        createdAt: now,
        updatedAt: now,
      });
      opportunityId = String(id);
    }

    return {
      callLogId,
      nextCallAt,
      answersRecorded: resolvedAnswers.length,
      healthScore: health.score,
      healthBand: health.band,
      ticketId,
      opportunityId,
    };
  },
});

export const getCrmAgentQueue = query({
  args: {
    agentId: v.id("users"),
    communityId: v.id("communities"),
    includeUnassigned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireCrmSupervisorOrAgentAccess(ctx, args.agentId, args.communityId);

    const openRows = await ctx.db
      .query("crmLeads")
      .withIndex("by_community_status_nextcall", (q: any) =>
        q.eq("communityId", args.communityId).eq("queueStatus", "open")
      )
      .collect();

    const inProgressRows = await ctx.db
      .query("crmLeads")
      .withIndex("by_community_status_nextcall", (q: any) =>
        q.eq("communityId", args.communityId).eq("queueStatus", "in_progress")
      )
      .collect();

    const rows = [...openRows, ...inProgressRows];

    const filtered = rows.filter((row: any) => {
      if (String(row.assignedAgentId || "") === String(args.agentId)) return true;
      return args.includeUnassigned === true && !row.assignedAgentId;
    });

    // Fetched once per call, not per lead, so the queue can be grouped by
    // which intake form (e.g. a region-specific campaign) each lead came from.
    const forms = await ctx.db
      .query("crmForms")
      .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
      .collect();
    const formById = new Map(forms.map((f: any) => [String(f._id), f]));

    const enriched = await Promise.all(
      filtered.map(async (lead: any) => {
        const member = (await ctx.db.get(lead.memberId)) as any;
        const response = (await ctx.db.get(lead.sourceCrmResponseId)) as any;
        const form = formById.get(String(lead.sourceCrmFormId));
        return {
          ...lead,
          memberAlias: member?.verifiedName || response?.clientName || member?.alias,
          isNameVerified: Boolean(member?.verifiedName),
          memberPhone: member?.phoneNumber,
          district: response?.district,
          subCounty: response?.subCounty,
          parish: response?.parish,
          cropGrown: response?.cropGrown,
          monthOfPlanting: response?.monthOfPlanting,
          pastSprayDates: response?.pastSprayDates,
          upcomingSprayScheduleAt: response?.upcomingSprayScheduleAt,
          productName: response?.productName,
          purchaseQuantity: response?.purchaseQuantity,
          purchaseDate: response?.purchaseDate,
          formId: lead.sourceCrmFormId,
          formName: form?.name || "Unassigned Form",
          isDueToday: new Date(lead.nextCallAt).toDateString() === new Date().toDateString(),
          isOverdue: lead.nextCallAt < getUgandaTime(),
        };
      })
    );

    return enriched.sort((a: any, b: any) => Number(a.nextCallAt) - Number(b.nextCallAt));
  },
});

export const getCrmAgentTodaySummary = query({
  args: {
    agentId: v.id("users"),
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    await requireCrmSupervisorOrAgentAccess(ctx, args.agentId, args.communityId);

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayStartTs = dayStart.getTime();
    const now = getUgandaTime();

    const logs = await ctx.db
      .query("crmCallLogs")
      .withIndex("by_agent_created", (q: any) => q.eq("agentId", args.agentId))
      .collect();

    const todayLogs = logs.filter(
      (row: any) =>
        row.communityId === args.communityId && Number(row.createdAt || 0) >= dayStartTs
    );

    const openLeads = await ctx.db
      .query("crmLeads")
      .withIndex("by_community_status_nextcall", (q: any) =>
        q.eq("communityId", args.communityId).eq("queueStatus", "open")
      )
      .collect();

    const inProgressLeads = await ctx.db
      .query("crmLeads")
      .withIndex("by_community_status_nextcall", (q: any) =>
        q.eq("communityId", args.communityId).eq("queueStatus", "in_progress")
      )
      .collect();

    const myOpenLeads = [...openLeads, ...inProgressLeads].filter(
      (row: any) => String(row.assignedAgentId || "") === String(args.agentId)
    );

    const dueToday = myOpenLeads.filter((lead: any) => {
      const d = new Date(lead.nextCallAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === dayStartTs;
    }).length;

    const overdue = myOpenLeads.filter((lead: any) => Number(lead.nextCallAt || 0) < now).length;

    return {
      agentDisplayName: await resolveCrmAgentDisplayName(
        ctx,
        args.agentId,
        args.communityId
      ),
      callsToday: todayLogs.length,
      completedToday: todayLogs.filter((l: any) => l.outcome !== "no_answer").length,
      remainingOpen: myOpenLeads.length,
      dueToday,
      overdue,
    };
  },
});

export const setCrmMemberVerifiedName = mutation({
  args: {
    leadId: v.id("crmLeads"),
    agentId: v.id("users"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("CRM lead not found");

    await requireCrmSupervisorOrAgentAccess(ctx, args.agentId, lead.communityId);

    const name = args.name.trim();
    if (!name) throw new Error("Name cannot be empty");

    await ctx.db.patch(lead.memberId, { verifiedName: name });

    return { success: true };
  },
});

export const claimCrmLead = mutation({
  args: {
    leadId: v.id("crmLeads"),
    agentId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("CRM lead not found");

    await requireCrmSupervisorOrAgentAccess(ctx, args.agentId, lead.communityId);

    if (lead.assignedAgentId && String(lead.assignedAgentId) !== String(args.agentId)) {
      throw new Error("Lead already assigned to another agent");
    }

    await ctx.db.patch(args.leadId, {
      assignedAgentId: args.agentId,
      claimedAt: getUgandaTime(),
      queueStatus: "in_progress",
      updatedAt: getUgandaTime(),
    });

    return { success: true };
  },
});

/**
 * Permanently remove a lead and everything recorded against it.
 *
 * Supervisor-only, and deliberately a hard delete: the leads this exists for
 * are duplicates and mis-captures that should not keep appearing in an agent's
 * queue or skewing the community's counters, and a soft-deleted row would have
 * to be filtered out of every existing query to achieve that.
 *
 * Every child row is removed explicitly. Convex has no cascading delete, so a
 * missed table would leave call answers and sales opportunities pointing at a
 * lead id that no longer resolves, which is exactly the kind of orphan the
 * analytics queries silently count.
 */
export const deleteCrmLead = mutation({
  args: {
    leadId: v.id("crmLeads"),
    requesterId: v.id("users"),
    /**
     * Also delete the intake submission the lead came from. Off by default so
     * a supervisor can clear a bad call cycle while keeping the record that
     * the purchase was captured.
     */
    deleteSubmission: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.leadId);
    if (!lead) throw new Error("CRM lead not found");

    // Supervisors only. An agent working the queue must not be able to delete
    // a lead they simply do not want to call.
    await requireCrmSupervisorAccess(ctx, args.requesterId, lead.communityId);

    const callLogs = await ctx.db
      .query("crmCallLogs")
      .withIndex("by_lead", (q: any) => q.eq("leadId", args.leadId))
      .collect();

    const callAnswers = await ctx.db
      .query("crmCallAnswers")
      .withIndex("by_lead", (q: any) => q.eq("leadId", args.leadId))
      .collect();

    const tickets = await ctx.db
      .query("crmTickets")
      .withIndex("by_lead", (q: any) => q.eq("leadId", args.leadId))
      .collect();

    const opportunities = await ctx.db
      .query("crmSalesOpportunities")
      .withIndex("by_lead", (q: any) => q.eq("leadId", args.leadId))
      .collect();

    for (const row of callAnswers) await ctx.db.delete(row._id);
    for (const row of callLogs) await ctx.db.delete(row._id);
    for (const row of tickets) await ctx.db.delete(row._id);
    for (const row of opportunities) await ctx.db.delete(row._id);

    let deletedSubmission = false;
    if (args.deleteSubmission) {
      const responseId = lead.sourceCrmResponseId;

      // Another lead may still point at this submission, so it is only removed
      // once nothing else references it.
      const otherLeads = await ctx.db
        .query("crmLeads")
        .withIndex("by_source_response", (q: any) =>
          q.eq("sourceCrmResponseId", responseId)
        )
        .collect();
      const stillReferenced = otherLeads.some(
        (row: any) => String(row._id) !== String(args.leadId)
      );

      if (!stillReferenced) {
        const values = await ctx.db
          .query("crmFormResponseValues")
          .withIndex("by_response", (q: any) => q.eq("crmResponseId", responseId))
          .collect();
        for (const row of values) await ctx.db.delete(row._id);
        await ctx.db.delete(responseId);
        deletedSubmission = true;
      }
    }

    await ctx.db.delete(args.leadId);

    // The member account is intentionally left in place. It may be a real
    // farmer who belongs to the community for reasons that have nothing to do
    // with this lead, and deleting it here would take their memberships and
    // any other community data with it.
    return {
      success: true,
      deletedCalls: callLogs.length,
      deletedAnswers: callAnswers.length,
      deletedTickets: tickets.length,
      deletedOpportunities: opportunities.length,
      deletedSubmission,
    };
  },
});

/**
 * Delete a submission from the CRM archive together with the lead it created.
 *
 * The supervisor dashboard lists submissions rather than leads, so this is the
 * shape the "Delete" button there needs; it resolves the lead itself instead of
 * asking the UI to know about both ids.
 */
export const deleteCrmSubmission = mutation({
  args: {
    responseId: v.id("crmFormResponses"),
    requesterId: v.id("users"),
  },
  handler: async (ctx, args): Promise<any> => {
    const response = await ctx.db.get(args.responseId);
    if (!response) throw new Error("CRM submission not found");

    await requireCrmSupervisorAccess(ctx, args.requesterId, response.communityId);

    const leads = await ctx.db
      .query("crmLeads")
      .withIndex("by_source_response", (q: any) =>
        q.eq("sourceCrmResponseId", args.responseId)
      )
      .collect();

    let deletedCalls = 0;
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

      deletedCalls += callLogs.length;
    }

    const values = await ctx.db
      .query("crmFormResponseValues")
      .withIndex("by_response", (q: any) => q.eq("crmResponseId", args.responseId))
      .collect();
    for (const row of values) await ctx.db.delete(row._id);

    await ctx.db.delete(args.responseId);

    return {
      success: true,
      deletedLeads: leads.length,
      deletedCalls,
    };
  },
});
