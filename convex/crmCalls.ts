import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUgandaTime } from "./utils";
import { requireCrmSupervisorOrAgentAccess } from "./crmAuth";

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
    score: normalized,
    band,
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

    const health = computeHealthScore({
      usageStatus: args.usageStatus,
      resultRating: args.resultRating,
      issueType: args.issueType,
      repurchaseIntent: args.repurchaseIntent,
    });

    const callLogId = await ctx.db.insert("crmCallLogs", {
      leadId: args.leadId,
      communityId: lead.communityId,
      agentId: args.agentId,
      outcome: args.outcome,
      usageStatus: args.usageStatus,
      resultRating: args.resultRating,
      issueType: args.issueType,
      repurchaseIntent: args.repurchaseIntent,
      notes: args.notes,
      callbackDaysOverride: args.callbackDaysOverride,
      callbackDateOverride: args.callbackDateOverride,
      computedNextCallAt: nextCallAt,
      healthScore: health.score,
      healthBand: health.band,
      createdAt: now,
    });

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
      latestHealthScore: health.score,
      latestHealthBand: health.band,
      updatedAt: now,
    });

    let ticketId: string | undefined;
    if (args.outcome === "problem" || (args.issueType && args.issueType !== "none")) {
      const id = await ctx.db.insert("crmTickets", {
        leadId: args.leadId,
        communityId: lead.communityId,
        openedByAgentId: args.agentId,
        title: "Farmer follow-up issue",
        details: args.notes,
        status: "open",
        createdAt: now,
        updatedAt: now,
      });
      ticketId = String(id);
    }

    let opportunityId: string | undefined;
    const shouldCreateOpportunity =
      args.createOpportunity === true ||
      args.outcome === "wants_more" ||
      args.repurchaseIntent === "yes";

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

    const enriched = await Promise.all(
      filtered.map(async (lead: any) => {
        const member = (await ctx.db.get(lead.memberId)) as any;
        const response = (await ctx.db.get(lead.sourceCrmResponseId)) as any;
        return {
          ...lead,
          memberAlias: response?.clientName || member?.alias,
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
      callsToday: todayLogs.length,
      completedToday: todayLogs.filter((l: any) => l.outcome !== "no_answer").length,
      remainingOpen: myOpenLeads.length,
      dueToday,
      overdue,
    };
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
