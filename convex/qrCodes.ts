import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireQrAdmin } from "./qrAuth";

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const CODE_LENGTH = 7;

function generateCandidateCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

async function resolveStorageUrl(
  ctx: { storage: { getUrl: (id: any) => Promise<string | null> } },
  storageId: Id<"_storage"> | undefined
): Promise<string | undefined> {
  if (!storageId) return undefined;
  try {
    const url = await ctx.storage.getUrl(storageId);
    return url ?? undefined;
  } catch {
    return undefined;
  }
}

const landingButtonValidator = v.object({ label: v.string(), url: v.string() });
const landingSocialLinkValidator = v.object({ platform: v.string(), url: v.string() });

const qrCreateEditFields = {
  destinationUrl: v.string(),
  title: v.optional(v.string()),
  campaignId: v.optional(v.id("campaigns")),
  stylePresetId: v.optional(v.string()),
  darkColor: v.optional(v.string()),
  lightColor: v.optional(v.string()),
  logoStorageId: v.optional(v.id("_storage")),
  errorCorrectionLevel: v.optional(v.string()),
  landingEnabled: v.optional(v.boolean()),
  landingLogoStorageId: v.optional(v.id("_storage")),
  landingHeroImageStorageId: v.optional(v.id("_storage")),
  landingHeading: v.optional(v.string()),
  landingDescription: v.optional(v.string()),
  landingButtons: v.optional(v.array(landingButtonValidator)),
  landingSocialLinks: v.optional(v.array(landingSocialLinkValidator)),
  landingBackgroundColor: v.optional(v.string()),
  activeFrom: v.optional(v.number()),
  activeUntil: v.optional(v.number()),
};

function isValidDestinationUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const createQrCode = mutation({
  args: {
    adminId: v.id("users"),
    code: v.optional(v.string()),
    ...qrCreateEditFields,
  },
  handler: async (ctx, args) => {
    await requireQrAdmin(ctx, args.adminId, "qr.create");

    if (!isValidDestinationUrl(args.destinationUrl)) {
      throw new Error("Invalid destination URL.");
    }

    let code = args.code?.trim();
    if (code) {
      const existing = await ctx.db
        .query("qrCodes")
        .withIndex("by_code", (q) => q.eq("code", code!))
        .first();
      if (existing) {
        throw new Error("That QR code is already taken. Choose a different one.");
      }
    } else {
      // Generate a unique random code, retrying on the rare collision.
      for (let attempt = 0; attempt < 8; attempt++) {
        const candidate = generateCandidateCode();
        const existing = await ctx.db
          .query("qrCodes")
          .withIndex("by_code", (q) => q.eq("code", candidate))
          .first();
        if (!existing) {
          code = candidate;
          break;
        }
      }
      if (!code) {
        throw new Error("QR code could not be generated. Please try again.");
      }
    }

    const now = Date.now();
    const errorCorrectionLevel = args.logoStorageId ? "H" : args.errorCorrectionLevel ?? "M";

    const qrCodeId = await ctx.db.insert("qrCodes", {
      code,
      destinationUrl: args.destinationUrl,
      title: args.title,
      campaignId: args.campaignId,
      createdBy: args.adminId,
      createdAt: now,
      updatedAt: now,
      isActive: true,
      stylePresetId: args.stylePresetId,
      darkColor: args.darkColor,
      lightColor: args.lightColor,
      logoStorageId: args.logoStorageId,
      errorCorrectionLevel,
      landingEnabled: args.landingEnabled,
      landingLogoStorageId: args.landingLogoStorageId,
      landingHeroImageStorageId: args.landingHeroImageStorageId,
      landingHeading: args.landingHeading,
      landingDescription: args.landingDescription,
      landingButtons: args.landingButtons,
      landingSocialLinks: args.landingSocialLinks,
      landingBackgroundColor: args.landingBackgroundColor,
      activeFrom: args.activeFrom,
      activeUntil: args.activeUntil,
    });

    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      actionType: "qr_create",
      targetUtid: code,
      details: `Created QR code "${code}" -> ${args.destinationUrl}`,
      timestamp: now,
    });

    return { qrCodeId, code };
  },
});

export const updateQrCode = mutation({
  args: {
    adminId: v.id("users"),
    qrCodeId: v.id("qrCodes"),
    destinationUrl: v.optional(v.string()),
    title: v.optional(v.string()),
    // null clears the campaign; undefined leaves it untouched (see below —
    // undefined is otherwise indistinguishable from "not provided").
    campaignId: v.optional(v.union(v.id("campaigns"), v.null())),
    stylePresetId: v.optional(v.string()),
    darkColor: v.optional(v.string()),
    lightColor: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    errorCorrectionLevel: v.optional(v.string()),
    landingEnabled: v.optional(v.boolean()),
    landingLogoStorageId: v.optional(v.id("_storage")),
    landingHeroImageStorageId: v.optional(v.id("_storage")),
    landingHeading: v.optional(v.string()),
    landingDescription: v.optional(v.string()),
    landingButtons: v.optional(v.array(landingButtonValidator)),
    landingSocialLinks: v.optional(v.array(landingSocialLinkValidator)),
    landingBackgroundColor: v.optional(v.string()),
    activeFrom: v.optional(v.number()),
    activeUntil: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireQrAdmin(ctx, args.adminId, "qr.edit");

    const existing = await ctx.db.get(args.qrCodeId);
    if (!existing || existing.isDeleted) {
      throw new Error("QR code not found.");
    }

    if (args.destinationUrl !== undefined && !isValidDestinationUrl(args.destinationUrl)) {
      throw new Error("Invalid destination URL.");
    }

    const editableKeys = [
      "destinationUrl",
      "title",
      "campaignId",
      "stylePresetId",
      "darkColor",
      "lightColor",
      "logoStorageId",
      "errorCorrectionLevel",
      "landingEnabled",
      "landingLogoStorageId",
      "landingHeroImageStorageId",
      "landingHeading",
      "landingDescription",
      "landingButtons",
      "landingSocialLinks",
      "landingBackgroundColor",
      "activeFrom",
      "activeUntil",
      "isActive",
    ] as const;

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const key of editableKeys) {
      const value = args[key];
      if (value === undefined) continue;
      // null is the "clear this field" sentinel (campaignId only, so far);
      // patch it as undefined, which Convex treats as removing the field.
      patch[key] = value === null ? undefined : value;
    }

    const nextLogoStorageId = args.logoStorageId ?? existing.logoStorageId;
    if (nextLogoStorageId && !args.errorCorrectionLevel) {
      patch.errorCorrectionLevel = "H";
    }

    await ctx.db.patch(args.qrCodeId, patch);

    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      actionType: "qr_update",
      targetUtid: existing.code,
      details:
        args.destinationUrl && args.destinationUrl !== existing.destinationUrl
          ? `Changed destination for "${existing.code}" to ${args.destinationUrl}`
          : `Updated QR code "${existing.code}"`,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

export const archiveQrCode = mutation({
  args: { adminId: v.id("users"), qrCodeId: v.id("qrCodes") },
  handler: async (ctx, args) => {
    await requireQrAdmin(ctx, args.adminId, "qr.delete");
    const existing = await ctx.db.get(args.qrCodeId);
    if (!existing) throw new Error("QR code not found.");

    await ctx.db.patch(args.qrCodeId, {
      isDeleted: true,
      isActive: false,
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.insert("adminActions", {
      adminId: args.adminId,
      actionType: "qr_archive",
      targetUtid: existing.code,
      details: `Archived QR code "${existing.code}"`,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

export const listQrCodes = query({
  args: { adminId: v.id("users"), campaignId: v.optional(v.id("campaigns")) },
  handler: async (ctx, args) => {
    await requireQrAdmin(ctx, args.adminId, "qr.view");

    let codes = args.campaignId
      ? await ctx.db
          .query("qrCodes")
          .withIndex("by_campaignId", (q) => q.eq("campaignId", args.campaignId))
          .collect()
      : await ctx.db.query("qrCodes").collect();

    codes = codes.filter((c) => !c.isDeleted);
    codes.sort((a, b) => b.createdAt - a.createdAt);

    return codes.map((c) => ({
      _id: c._id,
      code: c.code,
      title: c.title,
      destinationUrl: c.destinationUrl,
      isActive: c.isActive,
      landingEnabled: c.landingEnabled,
      createdAt: c.createdAt,
    }));
  },
});

export const getQrCode = query({
  args: { adminId: v.id("users"), qrCodeId: v.id("qrCodes") },
  handler: async (ctx, args) => {
    await requireQrAdmin(ctx, args.adminId, "qr.view");

    const qrCode = await ctx.db.get(args.qrCodeId);
    if (!qrCode || qrCode.isDeleted) return null;

    const [logoUrl, landingLogoUrl, landingHeroImageUrl] = await Promise.all([
      resolveStorageUrl(ctx, qrCode.logoStorageId),
      resolveStorageUrl(ctx, qrCode.landingLogoStorageId),
      resolveStorageUrl(ctx, qrCode.landingHeroImageStorageId),
    ]);

    const recentScans = await ctx.db
      .query("qrScanEvents")
      .withIndex("by_qrCode_createdAt", (q) => q.eq("qrCodeId", args.qrCodeId))
      .order("desc")
      .take(50);
    const recentRedirects = await ctx.db
      .query("qrRedirectEvents")
      .withIndex("by_qrCode_createdAt", (q) => q.eq("qrCodeId", args.qrCodeId))
      .order("desc")
      .take(50);

    const form = qrCode.formId ? await ctx.db.get(qrCode.formId) : null;

    return {
      ...qrCode,
      logoUrl,
      landingLogoUrl,
      landingHeroImageUrl,
      scanCount: recentScans.length,
      redirectCount: recentRedirects.length,
      form,
    };
  },
});
