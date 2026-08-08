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

    return {
      agents: agents.filter((a: any) => a.isActive).length,
      callsAttempted: todayLogs.length,
      answered: answeredCount,
      completedFollowUps: followupsCompleted,
      salesOpportunities: todayOpportunities.length,
      orders: opportunities.filter((o: any) => o.stage === "order" || o.stage === "completed").length,
      productIssues: todayTickets.length,
    };
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
      const user = await ctx.db.get(agentId as any);
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
        const lead = await ctx.db.get(opp.leadId);
        const member = lead ? await ctx.db.get(lead.memberId) : null;
        const openedBy = await ctx.db.get(opp.openedByAgentId);
        const assignedSales = opp.assignedSalesAgentId
          ? await ctx.db.get(opp.assignedSalesAgentId)
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
