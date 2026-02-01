// convex/introspection.ts
import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Get communities visible to an admin
 *
 * - Super admin: all communities
 * - Community admin: only assigned communities
 * - Others: none
 */
export const getCommunitiesForAdmin = query({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.adminId);

    if (!user || user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const isSuperAdmin =
      user.adminLevel === "super" || user.adminLevel === undefined;

    // Super admin sees all communities
    if (isSuperAdmin) {
      return ctx.db.query("communities").collect();
    }

    // Community admin sees only assigned communities
    if (
      user.adminCategory === "community" &&
      Array.isArray(user.assignedCommunityIds)
    ) {
      const communities = await Promise.all(
        user.assignedCommunityIds.map(
          (id: Id<"communities">) => ctx.db.get(id)
        )
      );

      return communities.filter(
        (community): community is NonNullable<typeof community> =>
          community !== null
      );
    }

    // All other admins see nothing
    return [];
  },
});
