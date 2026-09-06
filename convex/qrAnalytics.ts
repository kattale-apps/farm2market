import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireQrAdmin } from "./qrAuth";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

interface DateRangeArgs {
  startDate?: number; // ms epoch, inclusive
  endDate?: number; // ms epoch, inclusive
  campaignId?: any;
  qrCodeId?: any;
}

async function collectInRange(
  ctx: any,
  table: "qrScanEvents" | "qrRedirectEvents" | "qrFormSubmissions",
  args: DateRangeArgs
) {
  let rows;
  if (args.qrCodeId) {
    rows = await ctx.db
      .query(table)
      .withIndex("by_qrCode_createdAt", (q: any) => q.eq("qrCodeId", args.qrCodeId))
      .collect();
  } else if (args.campaignId && table !== "qrFormSubmissions") {
    rows = await ctx.db
      .query(table)
      .withIndex("by_campaign_createdAt", (q: any) => q.eq("campaignId", args.campaignId))
      .collect();
  } else {
    rows = await ctx.db.query(table).collect();
  }

  return rows.filter(
    (r: any) =>
      (args.startDate === undefined || r.createdAt >= args.startDate) &&
      (args.endDate === undefined || r.createdAt <= args.endDate)
  );
}

/**
 * Analytics overview — scan/redirect/submission counts, conversion rate,
 * daily breakdown, top QR codes/campaigns/destinations, recent activity.
 * All queries are index-scoped `.collect()` + in-memory grouping, matching
 * the pattern used in convex/crmAnalytics.ts and convex/usageEvents.ts
 * (no precomputed counters anywhere in this codebase).
 */
export const getOverview = query({
  args: {
    adminId: v.id("users"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    campaignId: v.optional(v.id("campaigns")),
    qrCodeId: v.optional(v.id("qrCodes")),
  },
  handler: async (ctx, args) => {
    await requireQrAdmin(ctx, args.adminId, "analytics.view");

    const [scans, redirects, submissions, qrCodes, campaigns] = await Promise.all([
      collectInRange(ctx, "qrScanEvents", args),
      collectInRange(ctx, "qrRedirectEvents", args),
      collectInRange(ctx, "qrFormSubmissions", args),
      ctx.db.query("qrCodes").collect(),
      ctx.db.query("campaigns").collect(),
    ]);

    const qrCodeById = new Map(qrCodes.map((qr: any) => [qr._id, qr]));
    const campaignById = new Map(campaigns.map((c: any) => [c._id, c]));

    const totalScans = scans.length;
    const totalRedirects = redirects.length;
    const totalSubmissions = submissions.length;
    const conversionRate = totalScans > 0 ? totalRedirects / totalScans : 0;

    const scansByDate = new Map<string, number>();
    for (const s of scans) scansByDate.set(dayKey(s.createdAt), (scansByDate.get(dayKey(s.createdAt)) ?? 0) + 1);
    const redirectsByDate = new Map<string, number>();
    for (const r of redirects) redirectsByDate.set(dayKey(r.createdAt), (redirectsByDate.get(dayKey(r.createdAt)) ?? 0) + 1);

    const allDates = new Set([...scansByDate.keys(), ...redirectsByDate.keys()]);
    const dailySeries = [...allDates]
      .sort()
      .map((date) => ({ date, scans: scansByDate.get(date) ?? 0, redirects: redirectsByDate.get(date) ?? 0 }));

    const scansByQrCode = new Map<string, number>();
    for (const s of scans) scansByQrCode.set(s.qrCodeId, (scansByQrCode.get(s.qrCodeId) ?? 0) + 1);
    const topQrCodes = [...scansByQrCode.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([qrCodeId, count]) => {
        const qr: any = qrCodeById.get(qrCodeId as any);
        return { qrCodeId, code: qr?.code ?? "(deleted)", title: qr?.title, scans: count };
      });

    const scansByCampaign = new Map<string, number>();
    for (const s of scans) {
      if (!s.campaignId) continue;
      scansByCampaign.set(s.campaignId, (scansByCampaign.get(s.campaignId) ?? 0) + 1);
    }
    const topCampaigns = [...scansByCampaign.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([campaignId, count]) => {
        const campaign: any = campaignById.get(campaignId as any);
        return { campaignId, name: campaign?.name ?? "(deleted)", scans: count };
      });

    const redirectsByDestination = new Map<string, number>();
    for (const r of redirects) redirectsByDestination.set(r.destinationUrl, (redirectsByDestination.get(r.destinationUrl) ?? 0) + 1);
    const topDestinations = [...redirectsByDestination.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([destinationUrl, count]) => ({ destinationUrl, redirects: count }));

    const recentActivity = [
      ...scans.map((s: any) => ({ type: "scan" as const, createdAt: s.createdAt, qrCodeId: s.qrCodeId })),
      ...redirects.map((r: any) => ({ type: "redirect" as const, createdAt: r.createdAt, qrCodeId: r.qrCodeId })),
      ...submissions.map((sub: any) => ({ type: "submission" as const, createdAt: sub.createdAt, qrCodeId: sub.qrCodeId })),
    ]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30)
      .map((event) => ({ ...event, code: (qrCodeById.get(event.qrCodeId as any) as any)?.code ?? "(deleted)" }));

    return {
      totalScans,
      totalRedirects,
      totalSubmissions,
      conversionRate,
      dailySeries,
      topQrCodes,
      topCampaigns,
      topDestinations,
      recentActivity,
    };
  },
});

export const getQrPerformanceReport = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    await requireQrAdmin(ctx, args.adminId, "reports.export");

    const [qrCodes, scans, redirects] = await Promise.all([
      ctx.db.query("qrCodes").collect(),
      ctx.db.query("qrScanEvents").collect(),
      ctx.db.query("qrRedirectEvents").collect(),
    ]);

    const scanCountByQr = new Map<string, number>();
    for (const s of scans) scanCountByQr.set(s.qrCodeId, (scanCountByQr.get(s.qrCodeId) ?? 0) + 1);
    const redirectCountByQr = new Map<string, number>();
    for (const r of redirects) redirectCountByQr.set(r.qrCodeId, (redirectCountByQr.get(r.qrCodeId) ?? 0) + 1);

    return qrCodes
      .filter((qr) => !qr.isDeleted)
      .map((qr) => {
        const qrScans = scanCountByQr.get(qr._id) ?? 0;
        const qrRedirects = redirectCountByQr.get(qr._id) ?? 0;
        return {
          code: qr.code,
          title: qr.title ?? "",
          destinationUrl: qr.destinationUrl,
          isActive: qr.isActive,
          scans: qrScans,
          redirects: qrRedirects,
          conversionRate: qrScans > 0 ? qrRedirects / qrScans : 0,
        };
      });
  },
});

export const getCampaignPerformanceReport = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    await requireQrAdmin(ctx, args.adminId, "reports.export");

    const [campaigns, scans, redirects] = await Promise.all([
      ctx.db.query("campaigns").collect(),
      ctx.db.query("qrScanEvents").collect(),
      ctx.db.query("qrRedirectEvents").collect(),
    ]);

    const scanCountByCampaign = new Map<string, number>();
    for (const s of scans) {
      if (!s.campaignId) continue;
      scanCountByCampaign.set(s.campaignId, (scanCountByCampaign.get(s.campaignId) ?? 0) + 1);
    }
    const redirectCountByCampaign = new Map<string, number>();
    for (const r of redirects) {
      if (!r.campaignId) continue;
      redirectCountByCampaign.set(r.campaignId, (redirectCountByCampaign.get(r.campaignId) ?? 0) + 1);
    }

    return campaigns
      .filter((c) => !c.isDeleted)
      .map((c) => {
        const campaignScans = scanCountByCampaign.get(c._id) ?? 0;
        const campaignRedirects = redirectCountByCampaign.get(c._id) ?? 0;
        return {
          name: c.name,
          isActive: c.isActive ?? true,
          startDate: c.startDate ?? "",
          endDate: c.endDate ?? "",
          scans: campaignScans,
          redirects: campaignRedirects,
          conversionRate: campaignScans > 0 ? campaignRedirects / campaignScans : 0,
        };
      });
  },
});

export const getRedirectPerformanceReport = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    await requireQrAdmin(ctx, args.adminId, "reports.export");

    const [redirects, qrCodes] = await Promise.all([
      ctx.db.query("qrRedirectEvents").collect(),
      ctx.db.query("qrCodes").collect(),
    ]);
    const qrCodeById = new Map(qrCodes.map((qr) => [qr._id, qr]));

    return redirects
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 500)
      .map((r) => ({
        code: (qrCodeById.get(r.qrCodeId) as any)?.code ?? "(deleted)",
        destinationUrl: r.destinationUrl,
        deviceCategory: r.deviceCategory ?? "",
        browser: r.browser ?? "",
        os: r.os ?? "",
        timestamp: new Date(r.createdAt).toISOString(),
      }));
  },
});
