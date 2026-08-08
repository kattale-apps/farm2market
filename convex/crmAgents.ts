import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUgandaTime } from "./utils";
import { requireCrmSupervisorAccess } from "./crmAuth";

export const assignCrmAgent = mutation({
  args: {
    communityId: v.id("communities"),
    supervisorId: v.id("users"),
    agentUserId: v.id("users"),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireCrmSupervisorAccess(ctx, args.supervisorId, args.communityId);

    const user = await ctx.db.get(args.agentUserId);
    if (!user || user.role !== "admin") {
      throw new Error("CRM agents must be admin users");
    }

    const now = getUgandaTime();
    const existing = await ctx.db
      .query("crmAgents")
      .withIndex("by_community_agent", (q: any) =>
        q.eq("communityId", args.communityId).eq("agentUserId", args.agentUserId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        isActive: true,
        displayName: args.displayName,
        updatedAt: now,
      });
      return { agentId: existing._id, reactivated: true };
    }

    const agentId = await ctx.db.insert("crmAgents", {
      communityId: args.communityId,
      agentUserId: args.agentUserId,
      createdByCommunityAdminId: args.supervisorId,
      displayName: args.displayName,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return { agentId, reactivated: false };
  },
});

export const assignCrmAgentByEmail = mutation({
  args: {
    communityId: v.id("communities"),
    supervisorId: v.id("users"),
    agentEmail: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireCrmSupervisorAccess(ctx, args.supervisorId, args.communityId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", args.agentEmail))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("No admin user found with this email");
    }

    const now = getUgandaTime();
    const existing = await ctx.db
      .query("crmAgents")
      .withIndex("by_community_agent", (q: any) =>
        q.eq("communityId", args.communityId).eq("agentUserId", user._id)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        isActive: true,
        displayName: args.displayName,
        updatedAt: now,
      });

      return { agentId: existing._id, userId: user._id, reactivated: true };
    }

    const agentId = await ctx.db.insert("crmAgents", {
      communityId: args.communityId,
      agentUserId: user._id,
      createdByCommunityAdminId: args.supervisorId,
      displayName: args.displayName,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return { agentId, userId: user._id, reactivated: false };
  },
});

export const deactivateCrmAgent = mutation({
  args: {
    communityId: v.id("communities"),
    supervisorId: v.id("users"),
    agentUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireCrmSupervisorAccess(ctx, args.supervisorId, args.communityId);

    const existing = await ctx.db
      .query("crmAgents")
      .withIndex("by_community_agent", (q: any) =>
        q.eq("communityId", args.communityId).eq("agentUserId", args.agentUserId)
      )
      .first();

    if (!existing) {
      return { success: true, found: false };
    }

    await ctx.db.patch(existing._id, {
      isActive: false,
      updatedAt: getUgandaTime(),
    });

    return { success: true, found: true };
  },
});

export const listCrmAgents = query({
  args: {
    communityId: v.id("communities"),
    requesterId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireCrmSupervisorAccess(ctx, args.requesterId, args.communityId);

    const agents = await ctx.db
      .query("crmAgents")
      .withIndex("by_community", (q: any) => q.eq("communityId", args.communityId))
      .collect();

    const enriched = await Promise.all(
      agents.map(async (agent: any) => {
        const user = await ctx.db.get(agent.agentUserId);
        return {
          ...agent,
          userAlias: user?.alias,
          userEmail: user?.email,
          userPhone: user?.phoneNumber,
        };
      })
    );

    return enriched;
  },
});
