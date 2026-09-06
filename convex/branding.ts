import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireQrAdmin } from "./qrAuth";

async function resolveStorageUrl(
  ctx: { storage: { getUrl: (id: any) => Promise<string | null> } },
  storageId: any
): Promise<string | undefined> {
  if (!storageId) return undefined;
  try {
    const url = await ctx.storage.getUrl(storageId);
    return url ?? undefined;
  } catch {
    return undefined;
  }
}

export const getBranding = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    await requireQrAdmin(ctx, args.adminId, "branding.manage");
    const settings = await ctx.db.query("brandingSettings").first();
    if (!settings) return null;
    const logoUrl = await resolveStorageUrl(ctx, settings.logoStorageId);
    return { ...settings, logoUrl };
  },
});

export const updateBranding = mutation({
  args: {
    adminId: v.id("users"),
    orgName: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    primaryColor: v.optional(v.string()),
    secondaryColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireQrAdmin(ctx, args.adminId, "branding.manage");
    const existing = await ctx.db.query("brandingSettings").first();
    const now = Date.now();

    if (existing) {
      const patch: Record<string, unknown> = { updatedBy: args.adminId, updatedAt: now };
      for (const key of ["orgName", "logoStorageId", "primaryColor", "secondaryColor"] as const) {
        const value = args[key];
        if (value !== undefined) patch[key] = value;
      }
      await ctx.db.patch(existing._id, patch);
      return { success: true };
    }

    await ctx.db.insert("brandingSettings", {
      orgName: args.orgName,
      logoStorageId: args.logoStorageId,
      primaryColor: args.primaryColor,
      secondaryColor: args.secondaryColor,
      updatedBy: args.adminId,
      updatedAt: now,
    });
    return { success: true };
  },
});
