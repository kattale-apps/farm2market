import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireQrAdmin } from "./qrAuth";

export const createCampaign = mutation({
  args: {
    adminId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireQrAdmin(ctx, args.adminId, "campaigns.manage");
    const now = Date.now();
    const campaignId = await ctx.db.insert("campaigns", {
      name: args.name,
      description: args.description,
      startDate: args.startDate,
      endDate: args.endDate,
      isActive: true,
      createdBy: args.adminId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      actionType: "campaign_create",
      details: `Created campaign "${args.name}"`,
      timestamp: now,
    });

    return { campaignId };
  },
});

export const updateCampaign = mutation({
  args: {
    adminId: v.id("users"),
    campaignId: v.id("campaigns"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireQrAdmin(ctx, args.adminId, "campaigns.manage");
    const existing = await ctx.db.get(args.campaignId);
    if (!existing || existing.isDeleted) throw new Error("Campaign not found.");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const key of ["name", "description", "startDate", "endDate", "isActive"] as const) {
      const value = args[key];
      if (value !== undefined) patch[key] = value;
    }

    await ctx.db.patch(args.campaignId, patch);
    return { success: true };
  },
});

export const deleteCampaign = mutation({
  args: { adminId: v.id("users"), campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    await requireQrAdmin(ctx, args.adminId, "campaigns.manage");
    const existing = await ctx.db.get(args.campaignId);
    if (!existing) throw new Error("Campaign not found.");

    await ctx.db.patch(args.campaignId, { isDeleted: true, isActive: false, updatedAt: Date.now() });

    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      actionType: "campaign_delete",
      details: `Deleted campaign "${existing.name}"`,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

export const listCampaigns = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    await requireQrAdmin(ctx, args.adminId, "qr.view");
    const campaigns = await ctx.db.query("campaigns").collect();
    return campaigns
      .filter((c) => !c.isDeleted)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getCampaignReport = query({
  args: { adminId: v.id("users"), campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    await requireQrAdmin(ctx, args.adminId, "qr.view");
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return null;

    const qrCodes = await ctx.db
      .query("qrCodes")
      .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
      .collect();
    const activeQrCodes = qrCodes.filter((qr) => !qr.isDeleted);

    const [scans, redirects, submissionCounts] = await Promise.all([
      ctx.db
        .query("qrScanEvents")
        .withIndex("by_campaign_createdAt", (q) => q.eq("campaignId", args.campaignId))
        .collect(),
      ctx.db
        .query("qrRedirectEvents")
        .withIndex("by_campaign_createdAt", (q) => q.eq("campaignId", args.campaignId))
        .collect(),
      Promise.all(
        activeQrCodes.map(async (qr) =>
          qr.formId
            ? ctx.db
                .query("qrFormSubmissions")
                .withIndex("by_qrCode_createdAt", (q) => q.eq("qrCodeId", qr._id))
                .collect()
            : []
        )
      ),
    ]);

    const totalScans = scans.length;
    const totalRedirects = redirects.length;
    const totalSubmissions = submissionCounts.reduce((sum, rows) => sum + rows.length, 0);
    const conversionRate = totalScans > 0 ? totalRedirects / totalScans : 0;

    return {
      campaign,
      qrCodeCount: activeQrCodes.length,
      totalScans,
      totalRedirects,
      totalSubmissions,
      conversionRate,
    };
  },
});
