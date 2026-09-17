import { ConvexError } from "convex/values";
import { Id } from "./_generated/dataModel";

export async function requireCrmSupervisorAccess(
  ctx: any,
  adminId: Id<"users">,
  communityId: Id<"communities">
) {
  const admin = await ctx.db.get(adminId);
  if (!admin || admin.role !== "admin") {
    throw new ConvexError("Unauthorized");
  }

  const isSuperAdmin =
    admin.adminLevel === "super" || admin.adminLevel === undefined;

  if (isSuperAdmin) {
    return { admin, accessRole: "supervisor" as const };
  }

  if (admin.adminCategory !== "community") {
    throw new ConvexError("Forbidden");
  }

  const community = await ctx.db.get(communityId);
  if (!community) {
    throw new ConvexError("Community not found");
  }

  const assignedIds = Array.isArray(admin.assignedCommunityIds)
    ? admin.assignedCommunityIds
    : [];
  const isDirectAdmin = String(community.communityAdminId || "") === String(adminId);
  const isAssigned = assignedIds.some((id: any) => String(id) === String(communityId));

  if (!isDirectAdmin && !isAssigned) {
    throw new ConvexError("Forbidden");
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
    throw new ConvexError("Community not found");
  }

  try {
    const supervisor = await requireCrmSupervisorAccess(ctx, userId, communityId);
    return supervisor;
  } catch {
    // Continue to CRM agent check.
  }

  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") {
    throw new ConvexError("Unauthorized");
  }

  if (user.adminLevel !== "junior" || user.adminCategory !== "community_crm") {
    throw new ConvexError("Forbidden");
  }

  const assignedIds = Array.isArray(user.assignedCommunityIds)
    ? user.assignedCommunityIds
    : [];
  const isAssignedToCommunity = assignedIds.some((id: any) => String(id) === String(communityId));

  if (!isAssignedToCommunity) {
    throw new ConvexError("Forbidden");
  }

  const crmAgent = await ctx.db
    .query("crmAgents")
    .withIndex("by_community_agent", (q: any) =>
      q.eq("communityId", communityId).eq("agentUserId", userId)
    )
    .first();

  if (!crmAgent || crmAgent.isActive !== true) {
    throw new ConvexError("Forbidden");
  }

  return { user, accessRole: "agent" as const };
}

export async function isCrmAgentInCommunity(
  ctx: any,
  agentId: Id<"users">,
  communityId: Id<"communities">
) {
  const user = await ctx.db.get(agentId);
  if (!user || user.role !== "admin" || user.adminLevel !== "junior" || user.adminCategory !== "community_crm") {
    return false;
  }

  const assignedIds = Array.isArray(user.assignedCommunityIds)
    ? user.assignedCommunityIds
    : [];
  if (!assignedIds.some((id: any) => String(id) === String(communityId))) {
    return false;
  }

  const row = await ctx.db
    .query("crmAgents")
    .withIndex("by_community_agent", (q: any) =>
      q.eq("communityId", communityId).eq("agentUserId", agentId)
    )
    .first();

  return Boolean(row?.isActive);
}

/**
 * The name a CRM agent should be shown under, everywhere the community sees
 * them: the display name their supervisor typed when assigning them, falling
 * back to the account identifiers only when no display name was captured.
 */
export async function resolveCrmAgentDisplayName(
  ctx: any,
  agentUserId: Id<"users">,
  communityId: Id<"communities">
) {
  const assignment = await ctx.db
    .query("crmAgents")
    .withIndex("by_community_agent", (q: any) =>
      q.eq("communityId", communityId).eq("agentUserId", agentUserId)
    )
    .first();

  const displayName = String(assignment?.displayName || "").trim();
  if (displayName) return displayName;

  const user = await ctx.db.get(agentUserId);
  return user?.alias || user?.email || user?.phoneNumber || "Agent";
}
