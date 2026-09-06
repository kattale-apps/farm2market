import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Public QR functions — no admin/auth argument, callable anonymously.
 * Kept in a separate file from qrCodes.ts so the no-auth surface is obvious.
 * Never expose administrative fields (createdBy, internal title, etc) here.
 */

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

/**
 * SCAN -> RESOLUTION -> TRACK SCAN.
 * For QR codes without a landing page, this also records the redirect
 * immediately (the "redirect" is automatic for a plain scan-and-go QR),
 * so the caller can issue a server-side redirect in the same request.
 */
export const resolveAndTrackScan = mutation({
  args: {
    code: v.string(),
    referrer: v.optional(v.string()),
    deviceCategory: v.optional(v.string()),
    browser: v.optional(v.string()),
    os: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const qrCode = await ctx.db
      .query("qrCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!qrCode || qrCode.isDeleted) {
      return { status: "not_found" as const };
    }
    const now = Date.now();
    const withinSchedule =
      (qrCode.activeFrom === undefined || now >= qrCode.activeFrom) &&
      (qrCode.activeUntil === undefined || now <= qrCode.activeUntil);
    if (!qrCode.isActive || !withinSchedule) {
      return { status: "inactive" as const };
    }

    const scanEventId = await ctx.db.insert("qrScanEvents", {
      qrCodeId: qrCode._id,
      campaignId: qrCode.campaignId,
      createdAt: now,
      deviceCategory: args.deviceCategory,
      browser: args.browser,
      os: args.os,
      referrer: args.referrer,
    });

    const landingEnabled = !!qrCode.landingEnabled;

    if (!landingEnabled) {
      await ctx.db.insert("qrRedirectEvents", {
        qrCodeId: qrCode._id,
        campaignId: qrCode.campaignId,
        scanEventId,
        destinationUrl: qrCode.destinationUrl,
        createdAt: now,
        deviceCategory: args.deviceCategory,
        browser: args.browser,
        os: args.os,
        referrer: args.referrer,
      });

      return { status: "ok" as const, landingEnabled: false, destinationUrl: qrCode.destinationUrl };
    }

    const [landingLogoUrl, landingHeroImageUrl] = await Promise.all([
      resolveStorageUrl(ctx, qrCode.landingLogoStorageId),
      resolveStorageUrl(ctx, qrCode.landingHeroImageStorageId),
    ]);

    let form: { formId: string; title: string; fields: any[] } | null = null;
    if (qrCode.formId) {
      const formDoc = await ctx.db.get(qrCode.formId);
      if (formDoc && formDoc.isActive) {
        const fields = await ctx.db
          .query("qrFormFields")
          .withIndex("by_form", (q) => q.eq("formId", qrCode.formId!))
          .collect();
        fields.sort((a, b) => a.order - b.order);
        form = {
          formId: formDoc._id,
          title: formDoc.title,
          fields: fields.map((f) => ({
            _id: f._id,
            fieldType: f.fieldType,
            label: f.label,
            required: f.required,
            helpText: f.helpText,
            options: f.options,
          })),
        };
      }
    }

    return {
      status: "ok" as const,
      landingEnabled: true,
      destinationUrl: qrCode.destinationUrl,
      qrCodeId: qrCode._id,
      landingHeading: qrCode.landingHeading,
      landingDescription: qrCode.landingDescription,
      landingBackgroundColor: qrCode.landingBackgroundColor,
      landingLogoUrl,
      landingHeroImageUrl,
      landingButtons: qrCode.landingButtons ?? [],
      landingSocialLinks: qrCode.landingSocialLinks ?? [],
      form,
    };
  },
});

/** TRACK REDIRECT — called client-side when a landing-page visitor clicks a CTA/destination button. */
export const trackRedirect = mutation({
  args: {
    code: v.string(),
    destinationUrl: v.string(),
    referrer: v.optional(v.string()),
    deviceCategory: v.optional(v.string()),
    browser: v.optional(v.string()),
    os: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const qrCode = await ctx.db
      .query("qrCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
    if (!qrCode || qrCode.isDeleted) return { success: false };

    await ctx.db.insert("qrRedirectEvents", {
      qrCodeId: qrCode._id,
      campaignId: qrCode.campaignId,
      destinationUrl: args.destinationUrl,
      createdAt: Date.now(),
      deviceCategory: args.deviceCategory,
      browser: args.browser,
      os: args.os,
      referrer: args.referrer,
    });

    return { success: true };
  },
});
