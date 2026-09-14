import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireCrmSupervisorAccess } from "./crmAuth";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDayTs(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const getCallCenterPerformanceToday = query({
  args: {
    communityId: v.id("communities"),
    requesterId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireCrmSupervisorAccess(ctx, args.requesterId, args.communityId);

    const now = Date.now();
    const dayStart = startOfDayTs(now);

    const logs = await ctx.db
      .query("crmCallLogs")
      .withIndex("by_community_created", (q: any) =>
        q.eq("communityId", args.communityId)
      )
      .collect();

    const todayLogs = logs.filter((row: any) => row.createdAt >= dayStart);

    const opportunities = await ctx.db
      .query("crmSalesOpportunities")
      .withIndex("by_community_stage", (q: any) =>
        q.eq("communityId", args.communityId)
      )
      .collect();

    const todayOpportunities = opportunities.filter((row: any) => row.createdAt >= dayStart);

    const tickets = await ctx.db
      .query("crmTickets")
      .withIndex("by_community_status", (q: any) =>
        q.eq("communityId", args.communityId)
      )
      .collect();

    const todayTickets = tickets.filter((row: any) => row.createdAt >= dayStart);

    const agents = await ctx.db
      .query("crmAgents")
      .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
      .collect();

    const answeredCount = todayLogs.filter((l: any) => l.outcome !== "no_answer").length;
    const followupsCompleted = todayLogs.filter((l: any) =>
      l.outcome === "good_result" || l.outcome === "problem" || l.outcome === "wants_more"
    ).length;

    const allStatuses: Array<"open" | "in_progress" | "called" | "overdue" | "closed"> = [
      "open",
      "in_progress",
      "called",
      "overdue",
      "closed",
    ];
    const leadsByStatus = await Promise.all(
      allStatuses.map((status) =>
        ctx.db
          .query("crmLeads")
          .withIndex("by_community_status_nextcall", (q: any) =>
            q.eq("communityId", args.communityId).eq("queueStatus", status)
          )
          .collect()
      )
    );
    const allLeads = leadsByStatus.flat();
    const claimedToday = allLeads.filter(
      (lead: any) => Number(lead.claimedAt || 0) >= dayStart
    ).length;

    return {
      agents: agents.filter((a: any) => a.isActive).length,
      callsAttempted: todayLogs.length,
      answered: answeredCount,
      claimedToday,
      completedFollowUps: followupsCompleted,
      salesOpportunities: todayOpportunities.length,
      orders: opportunities.filter((o: any) => o.stage === "order" || o.stage === "completed").length,
      productIssues: todayTickets.length,
    };
  },
});

export const getTodaysSubmittedForms = query({
  args: {
    communityId: v.id("communities"),
    requesterId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireCrmSupervisorAccess(ctx, args.requesterId, args.communityId);

    const dayStart = startOfDayTs(Date.now());

    const responses = await ctx.db
      .query("crmFormResponses")
      .withIndex("by_community_submitted", (q: any) =>
        q.eq("communityId", args.communityId).gte("submittedAt", dayStart)
      )
      .collect();

    const rows = await Promise.all(
      responses.map(async (response: any) => {
        const form = (await ctx.db.get(response.crmFormId)) as any;
        const member = (await ctx.db.get(response.memberId)) as any;
        return {
          responseId: String(response._id),
          formName: form?.name || "Unknown form",
          clientName: response.clientName || member?.alias || "Unknown",
          phoneNumber: member?.phoneNumber || "-",
          district: response.district || "-",
          subCounty: response.subCounty || "-",
          submittedAt: response.submittedAt,
        };
      })
    );

    return rows.sort((a, b) => Number(b.submittedAt || 0) - Number(a.submittedAt || 0));
  },
});

export const getFollowUpsDueDetails = query({
  args: {
    communityId: v.id("communities"),
    requesterId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireCrmSupervisorAccess(ctx, args.requesterId, args.communityId);

    const leadsOpen = await ctx.db
      .query("crmLeads")
      .withIndex("by_community_status_nextcall", (q: any) =>
        q.eq("communityId", args.communityId).eq("queueStatus", "open")
      )
      .collect();

    const now = Date.now();
    const dayStart = startOfDayTs(now);
    const dayEnd = dayStart + DAY_MS;

    const due = leadsOpen.filter((l: any) => l.nextCallAt < dayEnd);

    const rows = await Promise.all(
      due.map(async (lead: any) => {
        const member = (await ctx.db.get(lead.memberId)) as any;
        const response = (await ctx.db.get(lead.sourceCrmResponseId)) as any;
        const form = (await ctx.db.get(lead.sourceCrmFormId)) as any;
        return {
          leadId: String(lead._id),
          clientName: response?.clientName || member?.alias || "Unknown",
          phoneNumber: member?.phoneNumber || "-",
          formName: form?.name || "Unknown form",
          nextCallAt: lead.nextCallAt,
          isOverdue: lead.nextCallAt < now,
          confirmedVisitAt: response?.upcomingSprayScheduleAt || null,
        };
      })
    );

    return rows.sort((a, b) => Number(a.nextCallAt || 0) - Number(b.nextCallAt || 0));
  },
});

export const getAgentPerformanceToday = query({
  args: {
    communityId: v.id("communities"),
    requesterId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireCrmSupervisorAccess(ctx, args.requesterId, args.communityId);

    const now = Date.now();
    const dayStart = startOfDayTs(now);

    const logs = await ctx.db
      .query("crmCallLogs")
      .withIndex("by_community_created", (q: any) =>
        q.eq("communityId", args.communityId)
      )
      .collect();

    const todayLogs = logs.filter((row: any) => row.createdAt >= dayStart);

    const opportunities = await ctx.db
      .query("crmSalesOpportunities")
      .withIndex("by_community_stage", (q: any) =>
        q.eq("communityId", args.communityId)
      )
      .collect();

    const opportunitiesByAgent = new Map<string, number>();
    for (const opp of opportunities) {
      const key = String(opp.openedByAgentId || "");
      opportunitiesByAgent.set(key, Number(opportunitiesByAgent.get(key) || 0) + 1);
    }

    const callsByAgent = new Map<string, number>();
    for (const log of todayLogs) {
      const key = String(log.agentId || "");
      callsByAgent.set(key, Number(callsByAgent.get(key) || 0) + 1);
    }

    const rows: Array<any> = [];
    for (const [agentId, callCount] of callsByAgent.entries()) {
      const user = (await ctx.db.get(agentId as any)) as any;
      rows.push({
        agentId,
        agentName: user?.alias || user?.email || "Unknown",
        calls: callCount,
        opportunities: Number(opportunitiesByAgent.get(agentId) || 0),
      });
    }

    rows.sort((a, b) => b.calls - a.calls);

    return rows;
  },
});

export const getCrmHomeSummary = query({
  args: {
    communityId: v.id("communities"),
    requesterId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireCrmSupervisorAccess(ctx, args.requesterId, args.communityId);

    const leadsOpen = await ctx.db
      .query("crmLeads")
      .withIndex("by_community_status_nextcall", (q: any) =>
        q.eq("communityId", args.communityId).eq("queueStatus", "open")
      )
      .collect();

    const now = Date.now();
    const dayStart = startOfDayTs(now);
    const dayEnd = dayStart + DAY_MS;

    const dueToday = leadsOpen.filter((l: any) => l.nextCallAt >= dayStart && l.nextCallAt < dayEnd).length;
    const overdue = leadsOpen.filter((l: any) => l.nextCallAt < now).length;

    const members = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
      .collect();

    const opportunities = await ctx.db
      .query("crmSalesOpportunities")
      .withIndex("by_community_stage", (q: any) => q.eq("communityId", args.communityId))
      .collect();

    const highPotential = opportunities.filter((o: any) => o.probability === "high" && o.stage !== "completed").length;

    return {
      totalFarmers: members.length,
      activeCustomers: members.length,
      needsFollowUp: leadsOpen.length,
      highSalesPotential: highPotential,
      followUpsDueToday: dueToday,
      overdue,
      salesOpportunities: opportunities.filter((o: any) => o.stage !== "completed" && o.stage !== "lost").length,
    };
  },
});

export const getOpportunityExportRows = query({
  args: {
    communityId: v.id("communities"),
    requesterId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireCrmSupervisorAccess(ctx, args.requesterId, args.communityId);

    const stages: Array<"new" | "follow_up" | "order" | "completed" | "lost"> = [
      "new",
      "follow_up",
      "order",
      "completed",
      "lost",
    ];

    const byStage = await Promise.all(
      stages.map((stage) =>
        ctx.db
          .query("crmSalesOpportunities")
          .withIndex("by_community_stage", (q: any) =>
            q.eq("communityId", args.communityId).eq("stage", stage)
          )
          .collect()
      )
    );

    const opportunities = byStage.flat();

    const rows = await Promise.all(
      opportunities.map(async (opp: any) => {
        const lead = (await ctx.db.get(opp.leadId)) as any;
        const member = lead ? ((await ctx.db.get(lead.memberId)) as any) : null;
        const openedBy = (await ctx.db.get(opp.openedByAgentId)) as any;
        const assignedSales = opp.assignedSalesAgentId
          ? ((await ctx.db.get(opp.assignedSalesAgentId)) as any)
          : null;

        return {
          opportunityId: String(opp._id),
          stage: opp.stage,
          probability: opp.probability || "",
          productName: opp.productName || "",
          quantity: opp.quantity || "",
          expectedPurchaseMonth: opp.expectedPurchaseMonth || "",
          nextActionAt: opp.nextActionAt || null,
          openedBy: openedBy?.alias || openedBy?.email || "Unknown",
          assignedSales: assignedSales?.alias || assignedSales?.email || "",
          farmer: member?.alias || member?.email || member?.phoneNumber || "Unknown",
          createdAt: opp.createdAt,
          updatedAt: opp.updatedAt,
        };
      })
    );

    return rows.sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  },
});

/**
 * Full CRM submission history: every intake form with the answers that were
 * recorded on it, plus the calls that followed.
 *
 * getTodaysSubmittedForms deliberately stays as it is — it backs the "what
 * happened today" card on the CRM home. This is the reviewable archive: the
 * answers agents captured, and what each follow-up call found, which is the
 * part that was previously only in the database.
 */
export const getCrmSubmissions = query({
  args: {
    communityId: v.id("communities"),
    requesterId: v.id("users"),
    /** Inclusive lower bound on submittedAt. Omit for all time. */
    fromTs: v.optional(v.number()),
    /** Exclusive upper bound on submittedAt. */
    toTs: v.optional(v.number()),
    crmFormId: v.optional(v.id("crmForms")),
    /** Keep only submissions whose most recent call had this outcome. */
    outcome: v.optional(
      v.union(
        v.literal("good_result"),
        v.literal("problem"),
        v.literal("wants_more"),
        v.literal("no_answer"),
        v.literal("never_called")
      )
    ),
    /** Matches client name, phone number or district, case-insensitively. */
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireCrmSupervisorAccess(ctx, args.requesterId, args.communityId);

    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);

    const responses = await ctx.db
      .query("crmFormResponses")
      .withIndex("by_community_submitted", (q: any) => {
        let range = q.eq("communityId", args.communityId);
        if (args.fromTs != null) range = range.gte("submittedAt", args.fromTs);
        if (args.toTs != null) range = range.lt("submittedAt", args.toTs);
        return range;
      })
      .collect();

    const byForm = args.crmFormId
      ? responses.filter((r: any) => String(r.crmFormId) === String(args.crmFormId))
      : responses;

    const newestFirst = byForm.sort(
      (a: any, b: any) => Number(b.submittedAt || 0) - Number(a.submittedAt || 0)
    );

    // Field definitions are per form and shared by every response to it, so
    // they are fetched once rather than per row.
    const fieldsByForm = new Map<string, any[]>();
    const formById = new Map<string, any>();
    const userById = new Map<string, any>();

    const loadUser = async (id: any) => {
      if (!id) return null;
      const key = String(id);
      if (userById.has(key)) return userById.get(key);
      const user = await ctx.db.get(id);
      userById.set(key, user);
      return user;
    };

    const rows: any[] = [];

    for (const response of newestFirst) {
      const formKey = String(response.crmFormId);
      if (!formById.has(formKey)) {
        formById.set(formKey, await ctx.db.get(response.crmFormId));
        const fields = await ctx.db
          .query("crmFormFields")
          .withIndex("by_form", (q: any) => q.eq("crmFormId", response.crmFormId))
          .collect();
        fieldsByForm.set(
          formKey,
          fields.sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0))
        );
      }
      const form = formById.get(formKey);
      const fields = fieldsByForm.get(formKey) || [];

      const member = await loadUser(response.memberId);
      const submittedBy = await loadUser(response.submittedByUserId);

      const values = await ctx.db
        .query("crmFormResponseValues")
        .withIndex("by_response", (q: any) => q.eq("crmResponseId", response._id))
        .collect();
      const valueByField = new Map(values.map((v2: any) => [String(v2.crmFieldId), v2.value]));

      const answers = fields.map((field: any) => ({
        fieldId: String(field._id),
        label: field.label,
        fieldType: field.fieldType,
        value: valueByField.get(String(field._id)) ?? "",
      }));

      // Calls are hung off the lead this submission created.
      const lead = await ctx.db
        .query("crmLeads")
        .withIndex("by_source_response", (q: any) => q.eq("sourceCrmResponseId", response._id))
        .first();

      let calls: any[] = [];
      if (lead) {
        const logs = await ctx.db
          .query("crmCallLogs")
          .withIndex("by_lead", (q: any) => q.eq("leadId", lead._id))
          .collect();
        logs.sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
        calls = await Promise.all(
          logs.map(async (log: any) => {
            const agent = await loadUser(log.agentId);
            return {
              callId: String(log._id),
              createdAt: log.createdAt,
              agentName: agent?.alias || "Unknown agent",
              outcome: log.outcome,
              usageStatus: log.usageStatus ?? null,
              resultRating: log.resultRating ?? null,
              issueType: log.issueType ?? null,
              repurchaseIntent: log.repurchaseIntent ?? null,
              notes: log.notes ?? "",
              healthScore: log.healthScore ?? null,
              healthBand: log.healthBand ?? null,
            };
          })
        );
      }

      rows.push({
        responseId: String(response._id),
        crmFormId: formKey,
        formName: form?.name || "Unknown form",
        clientName: response.clientName || member?.alias || "Unknown",
        phoneNumber: member?.phoneNumber || "-",
        district: response.district || "-",
        subCounty: response.subCounty || "-",
        parish: response.parish || "-",
        submittedAt: response.submittedAt,
        submittedByName: submittedBy?.alias || "Unknown",
        sourceEventType: response.sourceEventType,
        wasNewClientAtIntake: response.wasNewClientAtIntake ?? false,
        // Structured intake fields live on the response itself rather than in
        // the custom-field table, so they are surfaced alongside the answers.
        purchase: {
          productName: response.productName ?? null,
          purchaseQuantity: response.purchaseQuantity ?? null,
          purchaseDate: response.purchaseDate ?? null,
          cropGrown: response.cropGrown ?? null,
          monthOfPlanting: response.monthOfPlanting ?? null,
          pastSprayDates: response.pastSprayDates ?? [],
          upcomingSprayScheduleAt: response.upcomingSprayScheduleAt ?? null,
        },
        answers,
        calls,
        callCount: calls.length,
        latestOutcome: calls[0]?.outcome ?? null,
        latestHealthBand: lead?.latestHealthBand ?? null,
        latestHealthScore: lead?.latestHealthScore ?? null,
        queueStatus: lead?.queueStatus ?? null,
        nextCallAt: lead?.nextCallAt ?? null,
      });
    }

    const needle = String(args.search || "").trim().toLowerCase();
    const searched = needle
      ? rows.filter((r) =>
          [r.clientName, r.phoneNumber, r.district, r.subCounty, r.formName]
            .join(" ")
            .toLowerCase()
            .includes(needle)
        )
      : rows;

    const filtered = args.outcome
      ? searched.filter((r) =>
          args.outcome === "never_called"
            ? r.callCount === 0
            : r.latestOutcome === args.outcome
        )
      : searched;

    return {
      rows: filtered.slice(0, limit),
      totalMatching: filtered.length,
      totalCalls: filtered.reduce((sum, r) => sum + r.callCount, 0),
      truncated: filtered.length > limit,
    };
  },
});

/**
 * Aggregated CRM outcomes for the community insights dashboard: what agents
 * are finding on the phone, rolled up for charting.
 */
export const getCrmInsights = query({
  args: {
    communityId: v.id("communities"),
    requesterId: v.id("users"),
    fromTs: v.optional(v.number()),
    toTs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireCrmSupervisorAccess(ctx, args.requesterId, args.communityId);

    const responses = await ctx.db
      .query("crmFormResponses")
      .withIndex("by_community_submitted", (q: any) => {
        let range = q.eq("communityId", args.communityId);
        if (args.fromTs != null) range = range.gte("submittedAt", args.fromTs);
        if (args.toTs != null) range = range.lt("submittedAt", args.toTs);
        return range;
      })
      .collect();

    const logs = await ctx.db
      .query("crmCallLogs")
      .withIndex("by_community_created", (q: any) => q.eq("communityId", args.communityId))
      .collect();
    const callsInRange = logs.filter((l: any) => {
      if (args.fromTs != null && Number(l.createdAt) < args.fromTs) return false;
      if (args.toTs != null && Number(l.createdAt) >= args.toTs) return false;
      return true;
    });

    const tally = (items: any[], pick: (item: any) => string | null | undefined) => {
      const freq: Record<string, number> = {};
      for (const item of items) {
        const key = pick(item);
        if (!key) continue;
        freq[key] = (freq[key] || 0) + 1;
      }
      return Object.entries(freq)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    };

    // Submissions per day, oldest first, for the trend line.
    const perDay: Record<string, number> = {};
    for (const r of responses) {
      const key = new Date(Number(r.submittedAt)).toISOString().slice(0, 10);
      perDay[key] = (perDay[key] || 0) + 1;
    }
    const submissionsOverTime = Object.entries(perDay)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const healthScores = callsInRange
      .map((l: any) => Number(l.healthScore))
      .filter((n: number) => Number.isFinite(n));

    return {
      totalSubmissions: responses.length,
      totalCalls: callsInRange.length,
      newClients: responses.filter((r: any) => r.wasNewClientAtIntake).length,
      averageHealthScore: healthScores.length
        ? Math.round((healthScores.reduce((a: number, b: number) => a + b, 0) / healthScores.length) * 10) / 10
        : null,
      outcomeData: tally(callsInRange, (l) => l.outcome),
      usageData: tally(callsInRange, (l) => l.usageStatus),
      resultRatingData: tally(callsInRange, (l) => l.resultRating),
      issueTypeData: tally(callsInRange, (l) => l.issueType),
      repurchaseData: tally(callsInRange, (l) => l.repurchaseIntent),
      healthBandData: tally(callsInRange, (l) => l.healthBand),
      cropData: tally(responses, (r) => r.cropGrown),
      productData: tally(responses, (r) => r.productName),
      submissionsOverTime,
    };
  },
});
