import { Id } from "./_generated/dataModel";

/**
 * QR platform admin gate.
 *
 * Any user with role "admin" reaches the QR area. Super admins (adminLevel
 * "super", or unset for backward-compat — mirrors the convention used
 * throughout the rest of the app, e.g. convex/crmAuth.ts) bypass all
 * granular checks. Junior admins must have the requested permission string
 * in their `qrPermissions` array, when one is requested.
 */
export async function requireQrAdmin(
  ctx: any,
  userId: Id<"users">,
  permission?: string
) {
  const admin = await ctx.db.get(userId);
  if (!admin || admin.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const isSuperAdmin = admin.adminLevel === "super" || admin.adminLevel === undefined;
  if (isSuperAdmin) {
    return admin;
  }

  if (permission && !(admin.qrPermissions ?? []).includes(permission)) {
    throw new Error(`You don't have permission to do this (missing "${permission}").`);
  }

  return admin;
}

export const QR_PERMISSIONS = [
  "qr.view",
  "qr.create",
  "qr.edit",
  "qr.delete",
  "qr.download",
  "campaigns.manage",
  "forms.view",
  "forms.create",
  "forms.edit",
  "analytics.view",
  "reports.export",
  "branding.manage",
  "admins.manage",
] as const;
