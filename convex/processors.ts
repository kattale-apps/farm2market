/**
 * Processors - onboarding and verification.
 *
 * A processor is a user with role "store" (shown as "Processor"). Verification
 * has three steps:
 *   1. the admin of a community the processor joined accepts them, which opens
 *      the processor dashboard;
 *   2. a Storage and Transport Officer (junior admin, category "store") approves the
 *      facility location, storage and documents;
 *   3. a super admin fully verifies the processor, which gives the badge.
 * A processor is live once all three are done, every required document is
 * verified and the verification fee (0 until a super admin sets one) is paid.
 *
 * Intake, processing and sales live in processorOperations.ts.
 *
 * Auth follows the project convention: the caller's user id is an argument
 * and is checked against the users table (see exportMarkets.ts).
 */

import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import { EXPORT_CROPS, addDaysToIsoDate, isIsoDate } from "./exportMarketsShared";
import { CAPABILITY_KEYS } from "./processorShared";
import { assertEvidencePhotos, evidencePhotoValidator } from "./evidencePhotos";
import {
  adminManagesCommunity,
  applyDocumentReview,
  audit,
  chargeExportFee,
  documentSlots,
  feeState,
  getDocumentTypes,
  getFeeSettings,
  isStorageOfficer,
  isSuperAdmin,
  notify,
  requireAdmin,
  requireSuperAdmin,
  todayUganda,
  walletBalance,
  withUrl,
} from "./exportMarkets";
import { confirmDeliveryCore } from "./admin";

type Ctx = QueryCtx | MutationCtx;

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

export async function requireProcessorUser(ctx: Ctx, userId: Id<"users">): Promise<Doc<"users">> {
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "store") throw new Error("Only processor accounts can do this");
  return user;
}

export async function requireStorageOfficer(ctx: Ctx, adminId: Id<"users">): Promise<Doc<"users">> {
  const admin = await requireAdmin(ctx, adminId);
  if (!isStorageOfficer(admin)) throw new Error("Only a Storage and Transport Officer or super admin can do this");
  return admin;
}

export async function getProcessorProfile(ctx: Ctx, userId: Id<"users">) {
  return await ctx.db
    .query("processorProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
}

/** Communities a processor belongs to; by default only where they were accepted. */
export async function processorCommunities(ctx: Ctx, userId: Id<"users">, opts: { admittedOnly?: boolean } = {}) {
  const admittedOnly = opts.admittedOnly ?? true;
  const memberships = await ctx.db
    .query("communityMemberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(200);
  const result: Doc<"communities">[] = [];
  for (const m of memberships) {
    if (admittedOnly && m.processorAdmitted !== true) continue;
    const c = await ctx.db.get(m.communityId);
    if (c) result.push(c);
  }
  return result;
}

/** Everything that decides whether a processor is live. */
export async function processorReadiness(ctx: Ctx, user: Doc<"users">, today: string) {
  const communities = await processorCommunities(ctx, user._id);
  const joined = await processorCommunities(ctx, user._id, { admittedOnly: false });
  const profile = await getProcessorProfile(ctx, user._id);
  const slots = await documentSlots(ctx, user._id, "processor", today);
  const required = slots.filter((s) => s.type.required);
  const requiredDocsVerified = required.every((s) => s.state === "verified" || s.state === "expiring");
  const requiredDocsUploaded = required.every((s) => s.state !== "missing" && s.state !== "rejected" && s.state !== "expired");
  const fee = feeState(profile, today);
  const admitted = user.role === "store" && communities.length > 0;
  const approved = profile?.status === "approved";
  const platformVerified = profile?.platformVerified === true;
  const facilityLocated =
    !!profile && profile.facilityLat !== undefined && profile.facilityLng !== undefined && profile.facilityPhotos.length > 0;
  return {
    communities,
    profile,
    slots,
    fee,
    checks: {
      joinedCommunity: joined.length > 0,
      admitted,
      profileSaved: !!profile,
      facilityLocated,
      requiredDocsUploaded,
      requiredDocsVerified,
      feeOk: fee.ok,
      approved,
      platformVerified,
    },
    isActiveProcessor: admitted && approved && requiredDocsVerified && fee.ok && platformVerified,
    pendingCommunities: joined.filter((c) => !communities.some((a) => a._id === c._id)),
  };
}

export async function isActiveProcessor(ctx: Ctx, userId: Id<"users">, today: string): Promise<boolean> {
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "store") return false;
  return (await processorReadiness(ctx, user, today)).isActiveProcessor;
}

/** What other users see of a processor before any deal: alias, district and badge. */
export async function processorPublic(ctx: Ctx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  const profile = await getProcessorProfile(ctx, userId);
  return {
    userId,
    alias: `Processor ${user?.alias ?? ""}`.trim(),
    facilityName: profile?.facilityName ?? null,
    district: profile?.district ?? null,
    verified: profile?.platformVerified === true && profile?.status === "approved",
  };
}

async function storageOfficerIds(ctx: Ctx): Promise<Id<"users">[]> {
  const admins = await ctx.db
    .query("users")
    .withIndex("by_role", (q) => q.eq("role", "admin"))
    .take(500);
  return admins.filter((a) => a.state === "active" && a.adminCategory === "store").map((a) => a._id);
}

async function photoRows(ctx: Ctx, photos: Doc<"processorProfiles">["facilityPhotos"]) {
  return await Promise.all(photos.map(async (p) => ({ ...p, url: await ctx.storage.getUrl(p.storageId) })));
}

// ------------------------------------------------------------------
// Processor workspace
// ------------------------------------------------------------------

export const getMyProcessorWorkspace = query({
  args: { userId: v.id("users"), today: v.string() },
  handler: async (ctx, args) => {
    const user = await requireProcessorUser(ctx, args.userId);
    const today = isIsoDate(args.today) ? args.today : todayUganda();
    const r = await processorReadiness(ctx, user, today);
    const fees = await getFeeSettings(ctx);

    const slots = [];
    for (const s of r.slots) {
      const history = await ctx.db
        .query("exportDocuments")
        .withIndex("by_ownerId_and_documentTypeKey", (q) => q.eq("ownerId", user._id).eq("documentTypeKey", s.type.key))
        .order("desc")
        .take(5);
      slots.push({
        type: s.type,
        state: s.state,
        current: s.current ? await withUrl(ctx, s.current) : null,
        verified: s.verified ? await withUrl(ctx, s.verified) : null,
        history: history.map((h) => ({ _id: h._id, status: h.status, fileName: h.fileName, uploadedAt: h.uploadedAt, expiryDate: h.expiryDate, reviewNotes: h.reviewNotes })),
      });
    }

    return {
      today,
      alias: user.alias,
      checks: r.checks,
      isActiveProcessor: r.isActiveProcessor,
      communities: r.communities.map((c) => ({ _id: c._id, name: c.name })),
      pendingCommunities: r.pendingCommunities.map((c) => ({ _id: c._id, name: c.name })),
      profile: r.profile,
      facilityPhotos: r.profile ? await photoRows(ctx, r.profile.facilityPhotos) : [],
      fee: {
        ...r.fee,
        amountUgx: fees.processorVerificationFeeUgx,
        validityDays: fees.verificationFeeValidityDays,
        renewalOpen: r.fee.state === "unpaid" || r.fee.state === "expired" || r.fee.state === "expiring",
      },
      successFeePercent: fees.processorSuccessFeePercent,
      walletBalanceUgx: await walletBalance(ctx, user._id),
      slots,
      crops: EXPORT_CROPS.map((c) => ({ key: c.key, label: c.label, active: c.active })),
    };
  },
});

const profileFields = {
  communityId: v.id("communities"),
  legalName: v.string(),
  tradingName: v.optional(v.string()),
  tin: v.string(),
  processingLicenceNumber: v.optional(v.string()),
  facilityName: v.string(),
  facilityAddress: v.string(),
  district: v.string(),
  facilityLat: v.optional(v.number()),
  facilityLng: v.optional(v.number()),
  capabilities: v.array(v.string()),
  crops: v.array(v.string()),
  processingCapacityTonnesPerMonth: v.number(),
  storageCapacityTonnes: v.number(),
  storageType: v.union(v.literal("dry"), v.literal("cold"), v.literal("both")),
  contactPerson: v.string(),
  contactPhone: v.string(),
  contactEmail: v.optional(v.string()),
};

export const saveProcessorProfile = mutation({
  args: { userId: v.id("users"), ...profileFields },
  handler: async (ctx, args) => {
    const user = await requireProcessorUser(ctx, args.userId);
    const communities = await processorCommunities(ctx, user._id);
    if (!communities.some((c) => c._id === args.communityId)) {
      throw new Error("A community admin must accept you as a processor first");
    }
    const clean = (s: string | undefined) => (s ?? "").trim();
    const required: [string, string][] = [
      [clean(args.legalName), "Legal business name"],
      [clean(args.tin), "TIN"],
      [clean(args.facilityName), "Facility name"],
      [clean(args.facilityAddress), "Facility address"],
      [clean(args.district), "District"],
      [clean(args.contactPerson), "Contact person"],
      [clean(args.contactPhone), "Contact phone"],
    ];
    for (const [value, label] of required) if (!value) throw new Error(`${label} is required`);
    if ((args.facilityLat === undefined) !== (args.facilityLng === undefined)) throw new Error("Give both latitude and longitude");
    if (args.facilityLat !== undefined && !(Math.abs(args.facilityLat) <= 90 && Math.abs(args.facilityLng!) <= 180)) {
      throw new Error("The facility GPS location is out of range");
    }
    const capabilities = [...new Set(args.capabilities)].filter((c) => CAPABILITY_KEYS.includes(c));
    if (capabilities.length === 0) throw new Error("Choose at least one thing your facility does");
    const crops = [...new Set(args.crops)].filter((c) => EXPORT_CROPS.some((x) => x.key === c && x.active));
    if (crops.length === 0) throw new Error("Choose at least one crop you process");
    for (const [n, label] of [
      [args.processingCapacityTonnesPerMonth, "Processing capacity"],
      [args.storageCapacityTonnes, "Storage capacity"],
    ] as [number, string][]) {
      if (!(Number.isFinite(n) && n >= 0 && n < 1_000_000)) throw new Error(`${label} looks wrong`);
    }

    const fields = {
      communityId: args.communityId,
      legalName: clean(args.legalName),
      tradingName: clean(args.tradingName) || undefined,
      tin: clean(args.tin),
      processingLicenceNumber: clean(args.processingLicenceNumber) || undefined,
      facilityName: clean(args.facilityName),
      facilityAddress: clean(args.facilityAddress),
      district: clean(args.district),
      facilityLat: args.facilityLat,
      facilityLng: args.facilityLng,
      capabilities,
      crops,
      processingCapacityTonnesPerMonth: args.processingCapacityTonnesPerMonth,
      storageCapacityTonnes: args.storageCapacityTonnes,
      storageType: args.storageType,
      contactPerson: clean(args.contactPerson),
      contactPhone: clean(args.contactPhone),
      contactEmail: clean(args.contactEmail) || undefined,
      updatedAt: getUgandaTime(),
    };

    const existing = await getProcessorProfile(ctx, user._id);
    if (existing) {
      if (existing.status === "suspended") throw new Error("Your processor profile is suspended. Contact a Storage and Transport Officer.");
      // A new legal identity or facility location needs a fresh Storage and Transport Officer review.
      const reviewChanged =
        existing.legalName !== fields.legalName ||
        existing.tin !== fields.tin ||
        existing.processingLicenceNumber !== fields.processingLicenceNumber ||
        existing.facilityLat !== fields.facilityLat ||
        existing.facilityLng !== fields.facilityLng;
      const status = existing.status === "approved" && reviewChanged ? "submitted" : existing.status;
      await ctx.db.patch(existing._id, { ...fields, status });
      return { profileId: existing._id, status };
    }
    const profileId = await ctx.db.insert("processorProfiles", {
      userId: user._id,
      ...fields,
      facilityPhotos: [],
      status: "draft",
      verificationFeeStatus: "unpaid",
      createdAt: getUgandaTime(),
    });
    return { profileId, status: "draft" as const };
  },
});

export const generateProcessorUploadUrl = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireProcessorUser(ctx, args.userId);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Facility and storage photos (camera or gallery, Rule 9), replacing the previous set. */
export const setFacilityPhotos = mutation({
  args: { userId: v.id("users"), photos: v.array(evidencePhotoValidator) },
  handler: async (ctx, args) => {
    const user = await requireProcessorUser(ctx, args.userId);
    const profile = await getProcessorProfile(ctx, user._id);
    if (!profile) throw new Error("Save your facility profile first");
    assertEvidencePhotos(args.photos, 6, 0);
    const keep = new Set(args.photos.map((p) => p.storageId));
    for (const old of profile.facilityPhotos) {
      if (!keep.has(old.storageId)) await ctx.storage.delete(old.storageId);
    }
    await ctx.db.patch(profile._id, { facilityPhotos: args.photos, updatedAt: getUgandaTime() });
    return { success: true };
  },
});

export const uploadProcessorDocument = mutation({
  args: {
    userId: v.id("users"),
    documentTypeKey: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    documentNumber: v.optional(v.string()),
    issueDate: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireProcessorUser(ctx, args.userId);
    const communities = await processorCommunities(ctx, user._id);
    if (communities.length === 0) throw new Error("A community admin must accept you as a processor first");
    const profile = await getProcessorProfile(ctx, user._id);
    const type = (await getDocumentTypes(ctx, "processor")).find((t) => t.key === args.documentTypeKey && t.isActive);
    if (!type) throw new Error("Unknown document type");
    const today = todayUganda();
    if (args.issueDate && !isIsoDate(args.issueDate)) throw new Error("Issue date is not a valid date");
    if (type.hasExpiry) {
      if (!isIsoDate(args.expiryDate)) throw new Error(`${type.label} needs an expiry date`);
      if (args.expiryDate < today) throw new Error("This document has already expired");
    } else if (args.expiryDate && !isIsoDate(args.expiryDate)) {
      throw new Error("Expiry date is not a valid date");
    }
    const older = await ctx.db
      .query("exportDocuments")
      .withIndex("by_ownerId_and_documentTypeKey", (q) => q.eq("ownerId", user._id).eq("documentTypeKey", type.key))
      .take(50);
    for (const d of older) {
      if (d.status === "pending" || d.status === "rejected") await ctx.db.patch(d._id, { status: "replaced" });
    }
    const documentId = await ctx.db.insert("exportDocuments", {
      ownerId: user._id,
      ownerKind: "processor",
      communityId: profile?.communityId ?? communities[0]._id,
      documentTypeKey: type.key,
      documentTypeLabel: type.label,
      documentNumber: args.documentNumber?.trim() || undefined,
      issueDate: args.issueDate || undefined,
      expiryDate: args.expiryDate || undefined,
      storageId: args.storageId,
      fileName: args.fileName.slice(0, 200),
      contentType: args.contentType,
      status: "pending",
      uploadedAt: getUgandaTime(),
    });
    return { documentId };
  },
});

export const payProcessorVerificationFee = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await requireProcessorUser(ctx, args.userId);
    const profile = await getProcessorProfile(ctx, user._id);
    if (!profile) throw new Error("Save your facility profile first");
    const today = todayUganda();
    const current = feeState(profile, today);
    if (current.state === "waived" || current.state === "paid") {
      throw new Error("Your verification fee is up to date. Renewal opens 30 days before it expires.");
    }
    const fees = await getFeeSettings(ctx);
    const amount = Math.round(fees.processorVerificationFeeUgx);
    const base = current.state === "expiring" && profile.verificationFeeValidUntil ? profile.verificationFeeValidUntil : today;
    const validUntil = addDaysToIsoDate(base, fees.verificationFeeValidityDays);
    if (amount <= 0) {
      await ctx.db.patch(profile._id, { verificationFeeStatus: "waived", verificationFeeValidUntil: validUntil, updatedAt: getUgandaTime() });
      await audit(ctx, "processor_fee_waived", user._id, { targetUserId: user._id, note: `No fee set; valid until ${validUntil}` });
      return { waived: true, amountUgx: 0 };
    }
    const { utid } = await chargeExportFee(ctx, {
      userId: user._id,
      role: "store",
      amountUgx: amount,
      kind: "verification",
      note: `Processor verification, valid until ${validUntil}`,
      metadata: { payer: "processor", validUntil },
    });
    const now = getUgandaTime();
    await ctx.db.patch(profile._id, {
      verificationFeeStatus: "paid",
      verificationFeePaidUgx: amount,
      verificationFeePaidAt: now,
      verificationFeeUtid: utid ?? undefined,
      verificationFeeValidUntil: validUntil,
      updatedAt: now,
    });
    await audit(ctx, "processor_fee_paid", user._id, { targetUserId: user._id, targetId: utid ?? undefined, note: `UGX ${amount}` });
    return { waived: false, amountUgx: amount, utid, validUntil };
  },
});

export const submitProcessorProfile = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await requireProcessorUser(ctx, args.userId);
    const r = await processorReadiness(ctx, user, todayUganda());
    if (!r.profile) throw new Error("Save your facility profile first");
    if (r.profile.status === "approved") throw new Error("Your processor profile is already approved");
    if (r.profile.status === "suspended") throw new Error("Your processor profile is suspended. Contact a Storage and Transport Officer.");
    if (!r.checks.admitted) throw new Error("A community admin must accept you as a processor first");
    if (!r.checks.facilityLocated) throw new Error("Add the facility GPS location and at least one facility photo first");
    await ctx.db.patch(r.profile._id, { status: "submitted", submittedAt: getUgandaTime(), updatedAt: getUgandaTime() });
    for (const officerId of await storageOfficerIds(ctx)) {
      await notify(ctx, officerId, "Processor to review", `${user.alias} (${r.profile.facilityName}, ${r.profile.district}) submitted a processor profile.`);
    }
    return { success: true };
  },
});

// ------------------------------------------------------------------
// Step 1: community admin accepts processors
// ------------------------------------------------------------------

async function requireCommunityAdmin(ctx: Ctx, adminId: Id<"users">, communityId: Id<"communities">) {
  const admin = await requireAdmin(ctx, adminId);
  const community = await ctx.db.get(communityId);
  if (!community) throw new Error("Community not found");
  if (!adminManagesCommunity(admin, community)) throw new Error("Not authorized to manage this community");
  return { admin, community };
}

export const listCommunityProcessors = query({
  args: { adminId: v.id("users"), communityId: v.id("communities"), today: v.string() },
  handler: async (ctx, args) => {
    await requireCommunityAdmin(ctx, args.adminId, args.communityId);
    const today = isIsoDate(args.today) ? args.today : todayUganda();
    const memberships = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .take(2000);
    const rows = [];
    for (const m of memberships) {
      const u = await ctx.db.get(m.userId);
      if (!u || u.role !== "store") continue;
      const r = await processorReadiness(ctx, u, today);
      rows.push({
        userId: u._id,
        alias: u.alias,
        phoneNumber: u.phoneNumber ?? null,
        joinedAt: m.joinedAt,
        admitted: m.processorAdmitted === true,
        facilityName: r.profile?.facilityName ?? null,
        district: r.profile?.district ?? null,
        profileStatus: r.profile?.status ?? null,
        platformVerified: r.checks.platformVerified,
        isActiveProcessor: r.isActiveProcessor,
      });
    }
    return rows;
  },
});

export const admitProcessor = mutation({
  args: { adminId: v.id("users"), communityId: v.id("communities"), processorId: v.id("users") },
  handler: async (ctx, args) => {
    const { community } = await requireCommunityAdmin(ctx, args.adminId, args.communityId);
    const processor = await ctx.db.get(args.processorId);
    if (!processor || processor.role !== "store" || processor.state !== "active") throw new Error("Only active processor accounts can be accepted");
    const membership = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community_user", (q) => q.eq("communityId", args.communityId).eq("userId", args.processorId))
      .first();
    if (!membership) throw new Error("This processor has not joined the community");
    if (membership.processorAdmitted === true) throw new Error("This processor is already accepted");
    await ctx.db.patch(membership._id, { processorAdmitted: true, processorAdmittedBy: args.adminId, processorAdmittedAt: getUgandaTime() });
    await notify(
      ctx,
      args.processorId,
      "Processor dashboard unlocked",
      `${community.name} accepted you as a processor. Set up your facility profile and documents; a Storage and Transport Officer then checks your facility.`
    );
    await audit(ctx, "processor_admitted", args.adminId, { targetUserId: args.processorId, targetId: String(args.communityId) });
    return { success: true };
  },
});

export const revokeProcessor = mutation({
  args: { adminId: v.id("users"), communityId: v.id("communities"), processorId: v.id("users"), reason: v.string() },
  handler: async (ctx, args) => {
    const { community } = await requireCommunityAdmin(ctx, args.adminId, args.communityId);
    const reason = args.reason.trim();
    if (!reason) throw new Error("Give a reason");
    const membership = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community_user", (q) => q.eq("communityId", args.communityId).eq("userId", args.processorId))
      .first();
    if (!membership || membership.processorAdmitted !== true) throw new Error("This processor is not accepted here");
    await ctx.db.patch(membership._id, { processorAdmitted: false });
    await notify(ctx, args.processorId, "Processor access removed", `${community.name} removed your processor access. ${reason}`);
    await audit(ctx, "processor_revoked", args.adminId, { targetUserId: args.processorId, note: reason });
    return { success: true };
  },
});

// ------------------------------------------------------------------
// Step 2: Storage and Transport Officer. Step 3: super admin.
// ------------------------------------------------------------------

/** Every processor, filtered; Storage and Transport Officers see all of them. */
export const listProcessorsForOfficer = query({
  args: {
    adminId: v.id("users"),
    today: v.string(),
    status: v.optional(v.string()), // profile status, "no_profile", or omitted for all
    communityId: v.optional(v.id("communities")),
    district: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireStorageOfficer(ctx, args.adminId);
    const today = isIsoDate(args.today) ? args.today : todayUganda();
    const processors = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "store"))
      .take(1000);
    const term = (args.search ?? "").trim().toLowerCase();
    const district = (args.district ?? "").trim().toLowerCase();
    const rows = [];
    const districts = new Set<string>();
    const communities = new Map<string, string>();
    for (const u of processors) {
      const r = await processorReadiness(ctx, u, today);
      if (r.profile?.district) districts.add(r.profile.district);
      for (const c of [...r.communities, ...r.pendingCommunities]) communities.set(String(c._id), c.name);
      if (args.status === "no_profile" ? !!r.profile : args.status && r.profile?.status !== args.status) continue;
      if (args.communityId && ![...r.communities, ...r.pendingCommunities].some((c) => c._id === args.communityId)) continue;
      if (district && (r.profile?.district ?? "").toLowerCase() !== district) continue;
      const haystack = `${u.alias} ${r.profile?.legalName ?? ""} ${r.profile?.facilityName ?? ""} ${u.phoneNumber ?? ""}`.toLowerCase();
      if (term && !haystack.includes(term)) continue;
      rows.push({
        userId: u._id,
        alias: u.alias,
        profile: r.profile
          ? {
              _id: r.profile._id,
              legalName: r.profile.legalName,
              facilityName: r.profile.facilityName,
              district: r.profile.district,
              status: r.profile.status,
              submittedAt: r.profile.submittedAt ?? null,
            }
          : null,
        checks: r.checks,
        isActiveProcessor: r.isActiveProcessor,
        pendingDocuments: r.slots.filter((s) => s.state === "pending").length,
        communities: r.communities.map((c) => c.name),
      });
    }
    return {
      canVerifyPlatform: isSuperAdmin(admin),
      rows,
      districts: [...districts].sort(),
      communities: [...communities.entries()].map(([id, name]) => ({ _id: id as Id<"communities">, name })),
    };
  },
});

export const getProcessorForReview = query({
  args: { adminId: v.id("users"), processorId: v.id("users"), today: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireStorageOfficer(ctx, args.adminId);
    const user = await ctx.db.get(args.processorId);
    if (!user || user.role !== "store") return null;
    const today = isIsoDate(args.today) ? args.today : todayUganda();
    const r = await processorReadiness(ctx, user, today);
    const documents = [];
    for (const s of r.slots) {
      documents.push({
        type: s.type,
        state: s.state,
        current: s.current ? await withUrl(ctx, s.current) : null,
        verified: s.verified ? await withUrl(ctx, s.verified) : null,
      });
    }
    return {
      canVerifyPlatform: isSuperAdmin(admin),
      alias: user.alias,
      phoneNumber: user.phoneNumber ?? null,
      email: user.email ?? null,
      profile: r.profile,
      facilityPhotos: r.profile ? await photoRows(ctx, r.profile.facilityPhotos) : [],
      checks: r.checks,
      fee: r.fee,
      isActiveProcessor: r.isActiveProcessor,
      communities: r.communities.map((c) => c.name),
      documents,
    };
  },
});

export const reviewProcessorDocument = mutation({
  args: {
    adminId: v.id("users"),
    documentId: v.id("exportDocuments"),
    decision: v.union(v.literal("verify"), v.literal("reject")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireStorageOfficer(ctx, args.adminId);
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.ownerKind !== "processor") throw new Error("Document not found");
    return await applyDocumentReview(ctx, admin, doc, args.decision, args.notes);
  },
});

export const reviewProcessorProfile = mutation({
  args: {
    adminId: v.id("users"),
    profileId: v.id("processorProfiles"),
    decision: v.union(v.literal("approve"), v.literal("reject"), v.literal("suspend"), v.literal("reinstate")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireStorageOfficer(ctx, args.adminId);
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Processor profile not found");
    const user = await ctx.db.get(profile.userId);
    if (!user) throw new Error("User not found");
    const notes = args.notes?.trim() || undefined;
    let status: Doc<"processorProfiles">["status"];
    if (args.decision === "approve" || args.decision === "reinstate") {
      const r = await processorReadiness(ctx, user, todayUganda());
      if (!r.checks.admitted) throw new Error("A community admin must accept the processor first");
      if (!r.checks.facilityLocated) throw new Error("The facility has no GPS location or photos yet");
      if (!r.checks.requiredDocsVerified) throw new Error("Verify every required document first");
      if (!r.checks.feeOk) throw new Error("The verification fee is not paid");
      if (args.decision === "reinstate" && profile.status !== "suspended") throw new Error("Only a suspended processor can be reinstated");
      status = "approved";
    } else {
      if (!notes) throw new Error("Give a reason");
      if (args.decision === "suspend" && profile.status !== "approved") throw new Error("Only an approved processor can be suspended");
      status = args.decision === "reject" ? "rejected" : "suspended";
    }
    await ctx.db.patch(profile._id, { status, reviewedBy: admin._id, reviewedAt: getUgandaTime(), reviewNotes: notes, updatedAt: getUgandaTime() });
    const messages: Record<string, [string, string]> = {
      approve: ["Facility approved", "A Storage and Transport Officer approved your facility, storage and documents. A super admin completes full verification."],
      reinstate: ["Processor profile reinstated", "Your processor profile is active again."],
      reject: ["Processor profile needs changes", `Your processor profile was not approved: ${notes}`],
      suspend: ["Processor profile suspended", `Your processor profile was suspended: ${notes}`],
    };
    const [title, message] = messages[args.decision];
    await notify(ctx, user._id, title, message);
    await audit(ctx, `processor_${args.decision}`, admin._id, { targetUserId: user._id, note: notes });
    return { success: true, status };
  },
});

export const setProcessorPlatformVerified = mutation({
  args: { adminId: v.id("users"), processorId: v.id("users"), verified: v.boolean(), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireSuperAdmin(ctx, args.adminId);
    const profile = await getProcessorProfile(ctx, args.processorId);
    if (!profile) throw new Error("This processor has no profile yet");
    const notes = args.notes?.trim() || undefined;
    if (!args.verified && !notes) throw new Error("Give a reason");
    await ctx.db.patch(profile._id, {
      platformVerified: args.verified,
      platformVerifiedBy: admin._id,
      platformVerifiedAt: getUgandaTime(),
      updatedAt: getUgandaTime(),
    });
    await notify(
      ctx,
      args.processorId,
      args.verified ? "You are a verified processor" : "Processor verification removed",
      args.verified ? "A super admin fully verified your processor account. Your badge is now shown to exporters." : `Your processor verification was removed: ${notes}`
    );
    await audit(ctx, args.verified ? "processor_platform_verified" : "processor_platform_unverified", admin._id, { targetUserId: args.processorId, note: notes });
    return { success: true };
  },
});

// ------------------------------------------------------------------
// Delivery points: processor facilities farmers deliver to
// ------------------------------------------------------------------

/** A listing's or inventory's delivery point, as shown to users. */
export async function deliveryPointOf(ctx: Ctx, processorId: Id<"users"> | undefined) {
  if (!processorId) return null;
  const p = await getProcessorProfile(ctx, processorId);
  return p ? { processorId, name: p.facilityName, district: p.district } : null;
}

/** Live, verified processors a farmer can name as the delivery point; their own district first. */
export const listDeliveryProcessors = query({
  args: { userId: v.id("users"), today: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];
    const today = isIsoDate(args.today) ? args.today : todayUganda();
    const home = (user.districtText ?? "").trim().toLowerCase();
    const profiles = await ctx.db.query("processorProfiles").withIndex("by_status", (q) => q.eq("status", "approved")).take(500);
    const rows = [];
    for (const p of profiles) {
      if (!(await isActiveProcessor(ctx, p.userId, today))) continue;
      rows.push({ processorId: p.userId, name: p.facilityName, district: p.district, crops: p.crops, sameDistrict: p.district.trim().toLowerCase() === home });
    }
    rows.sort((a, b) => Number(b.sameDistrict) - Number(a.sameDistrict) || a.district.localeCompare(b.district) || a.name.localeCompare(b.name));
    return rows;
  },
});

/** Farmer deliveries booked to this processor's facility, waiting for arrival to be confirmed. */
export const listDeliveriesToMyFacility = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireProcessorUser(ctx, args.userId);
    const units = await ctx.db
      .query("listingUnits")
      .withIndex("by_delivery_status", (q) => q.eq("deliveryStatus", "farmer_confirmed"))
      .take(2000);
    const byUtid = new Map<string, { lockUtid: string; produceType: string; kilos: number; units: number; farmerAlias: string; exporterAlias: string }>();
    for (const u of units) {
      if (u.status !== "locked" || !u.lockUtid) continue;
      const listing = await ctx.db.get(u.listingId);
      if (!listing || listing.deliveryProcessorId !== args.userId) continue;
      const row = byUtid.get(u.lockUtid);
      if (row) {
        row.kilos += listing.unitSize || 10;
        row.units += 1;
        continue;
      }
      const farmer = listing.farmerId ? await ctx.db.get(listing.farmerId) : null;
      const exporter = u.lockedBy ? await ctx.db.get(u.lockedBy) : null;
      byUtid.set(u.lockUtid, {
        lockUtid: u.lockUtid,
        produceType: listing.produceType,
        kilos: listing.unitSize || 10,
        units: 1,
        farmerAlias: farmer?.alias ?? "",
        exporterAlias: exporter?.alias ?? "",
      });
    }
    return [...byUtid.values()];
  },
});

/** The processor confirms a farmer's delivery arrived at its facility. */
export const confirmDeliveryAtFacility = mutation({
  args: { userId: v.id("users"), lockUtid: v.string() },
  handler: async (ctx, args) => {
    await requireProcessorUser(ctx, args.userId);
    const units = await ctx.db.query("listingUnits").withIndex("by_lock_utid", (q) => q.eq("lockUtid", args.lockUtid)).take(2000);
    if (units.length === 0) throw new Error("Delivery not found");
    for (const u of units) {
      const listing = await ctx.db.get(u.listingId);
      if (!listing || listing.deliveryProcessorId !== args.userId) throw new Error("This delivery is not to your facility");
    }
    const { results } = await confirmDeliveryCore(ctx, { lockUtid: args.lockUtid });
    await audit(ctx, "processor_confirmed_delivery", args.userId, { targetId: args.lockUtid, note: `${results.unitsUpdated} units` });
    return { unitsUpdated: results.unitsUpdated, errors: results.errors };
  },
});
