import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { QR_PERMISSIONS } from "./qrAuth";

/**
 * QR platform permission management.
 * Assigning permissions is sensitive, so — like adminRoleManagement.ts's
 * deleteAdmin — it requires an actual super admin, not just "admins.manage"
 * (a junior admin holding that permission still can't grant others more
 * access than they themselves have).
 */
async function requireSuperAdmin(ctx: any, userId: any) {
  const admin = await ctx.db.get(userId);
  if (!admin || admin.role !== "admin") throw new Error("Unauthorized");
  const isSuperAdmin = admin.adminLevel === "super" || admin.adminLevel === undefined;
  if (!isSuperAdmin) throw new Error("Only a super admin can manage QR permissions.");
  return admin;
}

export const listQrAdmins = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx, args.adminId);
    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();

    return admins
      .filter((a) => a.state !== "deleted")
      .map((a) => ({
        _id: a._id,
        alias: a.alias,
        email: a.email,
        adminLevel: a.adminLevel,
        adminCategory: a.adminCategory,
        qrPermissions: a.qrPermissions ?? [],
      }));
  },
});

export const setQrPermissions = mutation({
  args: {
    adminId: v.id("users"),
    targetUserId: v.id("users"),
    qrPermissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx, args.adminId);

    const target = await ctx.db.get(args.targetUserId);
    if (!target || target.role !== "admin") throw new Error("Target user is not an admin.");

    const valid = args.qrPermissions.filter((p) => (QR_PERMISSIONS as readonly string[]).includes(p));

    await ctx.db.patch(args.targetUserId, { qrPermissions: valid });

    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      actionType: "qr_permissions_update",
      targetUserId: args.targetUserId,
      details: `Set QR permissions for ${target.alias}: ${valid.join(", ") || "(none)"}`,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

export const listQrPermissionOptions = query({
  args: {},
  handler: async () => QR_PERMISSIONS,
});
