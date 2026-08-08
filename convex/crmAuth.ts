import { Id } from "./_generated/dataModel";

export async function requireCrmSupervisorAccess(
  ctx: any,
  adminId: Id<"users">,
  communityId: Id<"communities">
) {
  const admin = await ctx.db.get(adminId);
  if (!admin || admin.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const isSuperAdmin =
    admin.adminLevel === "super" || admin.adminLevel === undefined;

  if (isSuperAdmin) {
    return { admin, accessRole: "supervisor" as const };
  }

  if (admin.adminCategory !== "community") {
    throw new Error("Forbidden");
  }

  const community = await ctx.db.get(communityId);
  if (!community) {
    throw new Error("Community not found");
  }

  if ((community as any).crmEnabled !== true) {
    throw new Error("Community CRM is not enabled for this community");
  }

  const assignedIds = Array.isArray(admin.assignedCommunityIds)
    ? admin.assignedCommunityIds
    : [];
  const isDirectAdmin = String(community.communityAdminId || "") === String(adminId);
  const isAssigned = assignedIds.some((id: any) => String(id) === String(communityId));

  if (!isDirectAdmin && !isAssigned) {
    throw new Error("Forbidden");
  }

  return { admin, accessRole: "supervisor" as const };
}

export async function requireCrmSupervisorOrAgentAccess(
  ctx: any,
  userId: Id<"users">,
  communityId: Id<"communities">
) {
  const community = await ctx.db.get(communityId);
  if (!community) {
    throw new Error("Community not found");
  }

  if ((community as any).crmEnabled !== true) {
    throw new Error("Community CRM is not enabled for this community");
  }

  try {
    const supervisor = await requireCrmSupervisorAccess(ctx, userId, communityId);
    return supervisor;
  } catch {
    // Continue to CRM agent check.
  }

  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const crmAgent = await ctx.db
    .query("crmAgents")
    .withIndex("by_community_agent", (q: any) =>
      q.eq("communityId", communityId).eq("agentUserId", userId)
    )
    .first();

  if (!crmAgent || crmAgent.isActive !== true) {
    throw new Error("Forbidden");
  }

  return { user, accessRole: "agent" as const };
}

export async function isCrmAgentInCommunity(
  ctx: any,
  agentId: Id<"users">,
  communityId: Id<"communities">
) {
  const row = await ctx.db
    .query("crmAgents")
    .withIndex("by_community_agent", (q: any) =>
      q.eq("communityId", communityId).eq("agentUserId", agentId)
    )
    .first();

  return Boolean(row?.isActive);
}
