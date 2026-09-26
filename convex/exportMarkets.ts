/**
 * Export Markets - Phase 1: exporter gating, profile, document vault,
 * verification fee and fee settings.
 *
 * Who is an exporter:
 *   1. a trader a super admin has verified (users.isVerifiedTrader), who
 *   2. an admin has added to a community with exportMarketsEnabled, and
 *   3. whose exporter profile an admin approved once every required vault
 *      document was verified and the verification fee was paid.
 *
 * The local trader flow (traderInventory, 100kg blocks, purchase windows,
 * storage fees) is untouched; nothing here reads or writes it.
 *
 * Auth follows the project convention: the caller's user id is an argument
 * and is checked against the users table (see advancePurchase.ts).
 *
 * Time: timestamps are getUgandaTime(); document expiry and fee validity are
 * YYYY-MM-DD Uganda dates. Queries take `today` from the client because a
 * query must not read the clock.
 */

import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { generateUTID, getUgandaTime } from "./utils";
import { checkPilotMode } from "./pilotMode";
import {
  DEFAULT_EXPORT_DOCUMENT_TYPES,
  DEFAULT_EXPORT_FEE_SETTINGS,
  EXPIRY_WARNING_DAYS,
  PRODUCT_FORM_KEYS,
  docTypeAppliesTo,
  addDaysToIsoDate,
  daysBetweenIsoDates,
  expiryState,
  isIsoDate,
  ugandaDateFromStored,
} from "./exportMarketsShared";

type Ctx = QueryCtx | MutationCtx;

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

export function isSuperAdmin(user: { adminLevel?: "super" | "junior"; adminCategory?: string }): boolean {
  return user.adminLevel === "super" || (user.adminLevel === undefined && !user.adminCategory);
}

export function todayUganda(): string {
  return ugandaDateFromStored(getUgandaTime());
}

export async function requireAdmin(ctx: Ctx, adminId: Id<"users">): Promise<Doc<"users">> {
  const admin = await ctx.db.get(adminId);
  if (!admin || admin.role !== "admin" || admin.state !== "active") {
    throw new Error("Not authorized: admin account required");
  }
  return admin;
}

export async function requireSuperAdmin(ctx: Ctx, adminId: Id<"users">): Promise<Doc<"users">> {
  const admin = await requireAdmin(ctx, adminId);
  if (!isSuperAdmin(admin)) throw new Error("Only super admins can do this");
  return admin;
}

/** Community admins may act on the export communities they administer. */
export function adminManagesCommunity(admin: Doc<"users">, community: Doc<"communities">): boolean {
  if (isSuperAdmin(admin)) return true;
  if (String(community.communityAdminId ?? "") === String(admin._id)) return true;
  return (admin.assignedCommunityIds ?? []).some((id) => String(id) === String(community._id));
}

export async function requireExportCommunityAdmin(
  ctx: Ctx,
  adminId: Id<"users">,
  communityId: Id<"communities">
): Promise<{ admin: Doc<"users">; community: Doc<"communities"> }> {
  const admin = await requireAdmin(ctx, adminId);
  const community = await ctx.db.get(communityId);
  if (!community) throw new Error("Community not found");
  if (community.exportMarketsEnabled !== true) {
    throw new Error("Export Markets is not switched on for this community");
  }
  if (!adminManagesCommunity(admin, community)) {
    throw new Error("Not authorized to manage this exporter community");
  }
  return { admin, community };
}

/** Export communities an admin can manage. Communities are few, so a bounded scan is fine. */
export async function exportCommunitiesForAdmin(ctx: Ctx, admin: Doc<"users">): Promise<Doc<"communities">[]> {
  const all = await ctx.db.query("communities").take(1000);
  return all.filter((c) => c.exportMarketsEnabled === true && adminManagesCommunity(admin, c));
}

/** Export communities a user belongs to. */
/**
 * Admitted as an exporter in this membership. Memberships created by the
 * older "add trader" flow carry communityRole "Exporter" and count too.
 */
export function isAdmittedExporter(m: Doc<"communityMemberships">): boolean {
  return m.exportAdmitted === true || (m.exportAdmitted === undefined && m.communityRole === "Exporter");
}

/**
 * Exporter communities a user belongs to. By default only those where the
 * community admin has admitted them as an exporter; with `admittedOnly:
 * false`, every exporter community they have joined.
 */
export async function exportCommunitiesForMember(
  ctx: Ctx,
  userId: Id<"users">,
  opts: { admittedOnly?: boolean } = {}
): Promise<Doc<"communities">[]> {
  const admittedOnly = opts.admittedOnly ?? true;
  const memberships = await ctx.db
    .query("communityMemberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(200);
  const result: Doc<"communities">[] = [];
  for (const m of memberships) {
    if (admittedOnly && !isAdmittedExporter(m)) continue;
    const c = await ctx.db.get(m.communityId);
    if (c && c.exportMarketsEnabled === true) result.push(c);
  }
  return result;
}

export function isVerifiedTrader(user: Doc<"users">): boolean {
  return user.role === "trader" && user.isVerifiedTrader === true && user.verificationStatus === "verified";
}

export async function getFeeSettings(ctx: Ctx) {
  const row = await ctx.db.query("exportFeeSettings").first();
  if (!row) return { ...DEFAULT_EXPORT_FEE_SETTINGS, isDefault: true as const, updatedAt: null as number | null };
  return {
    exporterVerificationFeeUgx: row.exporterVerificationFeeUgx,
    verificationFeeValidityDays: row.verificationFeeValidityDays,
    creditVerificationFeeAgainstSuccessFee: row.creditVerificationFeeAgainstSuccessFee,
    successFeeMode: row.successFeeMode,
    successFeePercent: row.successFeePercent,
    successFeePerBagUsd: row.successFeePerBagUsd,
    buyerFeePercent: row.buyerFeePercent,
    sampleHandlingFeeUgx: row.sampleHandlingFeeUgx,
    isDefault: false as const,
    updatedAt: row.updatedAt,
  };
}

type EffectiveDocType = {
  key: string;
  label: string;
  description?: string;
  appliesTo: "exporter" | "buyer";
  required: boolean;
  hasExpiry: boolean;
  productForms?: string[];
  isActive: boolean;
  order: number;
  _id?: Id<"exportDocumentTypes">;
};

/**
 * The admin-managed list, or the built-in defaults until a super admin has
 * saved one for that audience.
 */
export async function getDocumentTypes(ctx: Ctx, appliesTo: "exporter" | "buyer"): Promise<EffectiveDocType[]> {
  const rows = await ctx.db
    .query("exportDocumentTypes")
    .withIndex("by_appliesTo_and_order", (q) => q.eq("appliesTo", appliesTo))
    .take(100);
  if (rows.length > 0) {
    // Types are never deleted, only switched off, so a built-in type missing
    // from the saved list is one added after the list was customised (for
    // example the UNBS certification). Show it, after the saved ones.
    const saved = new Set(rows.map((r) => r.key));
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.order), 0);
    const added = DEFAULT_EXPORT_DOCUMENT_TYPES.filter((d) => d.appliesTo === appliesTo && !saved.has(d.key)).map((d, i) => ({
      ...d,
      isActive: true,
      order: maxOrder + 1 + i,
    }));
    return [...rows.map((r) => ({
      _id: r._id,
      key: r.key,
      label: r.label,
      description: r.description,
      appliesTo: r.appliesTo,
      required: r.required,
      hasExpiry: r.hasExpiry,
      productForms: r.productForms,
      isActive: r.isActive,
      order: r.order,
    })), ...added];
  }
  return DEFAULT_EXPORT_DOCUMENT_TYPES.filter((d) => d.appliesTo === appliesTo).map((d, i) => ({
    ...d,
    isActive: true,
    order: i,
  }));
}

export async function walletBalance(ctx: Ctx, userId: Id<"users">): Promise<number> {
  const last = await ctx.db
    .query("walletLedger")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .first();
  return last?.balanceAfter ?? 0;
}

/**
 * Charge an Export Markets fee from a user's wallet: pilot-mode guard,
 * balance check, wallet ledger debit and a Finance record, in one place.
 */
export async function chargeExportFee(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    role: string;
    amountUgx: number;
    kind: "verification" | "success" | "buyer" | "sample";
    note: string;
    creditAppliedUgx?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<{ utid: string | null }> {
  const amount = Math.round(args.amountUgx);
  if (amount <= 0) {
    if (args.creditAppliedUgx && args.creditAppliedUgx > 0) {
      const utid = generateUTID(args.role);
      await ctx.db.insert("exportFeeCharges", {
        userId: args.userId,
        kind: args.kind,
        amountUgx: 0,
        creditAppliedUgx: args.creditAppliedUgx,
        utid,
        note: args.note,
        chargedAt: getUgandaTime(),
      });
      return { utid };
    }
    return { utid: null };
  }
  await checkPilotMode(ctx);
  const balance = await walletBalance(ctx, args.userId);
  if (balance < amount) {
    throw new Error(
      `Your wallet has UGX ${balance.toLocaleString()}. Top up UGX ${(amount - balance).toLocaleString()} to pay UGX ${amount.toLocaleString()}.`
    );
  }
  const utid = generateUTID(args.role);
  const now = getUgandaTime();
  await ctx.db.insert("walletLedger", {
    userId: args.userId,
    utid,
    type: "export_fee_payment",
    amount,
    balanceAfter: balance - amount,
    timestamp: now,
    metadata: { feeKind: args.kind, ...(args.metadata ?? {}) },
  });
  await ctx.db.insert("exportFeeCharges", {
    userId: args.userId,
    kind: args.kind,
    amountUgx: amount,
    creditAppliedUgx: args.creditAppliedUgx,
    utid,
    note: args.note,
    chargedAt: now,
  });
  return { utid };
}

export async function notify(ctx: MutationCtx, userId: Id<"users">, title: string, message: string) {
  await ctx.db.insert("notifications", {
    userId,
    type: "system",
    category: "export_markets",
    title,
    message,
    read: false,
    createdAt: getUgandaTime(),
  });
}

export async function audit(
  ctx: MutationCtx,
  action: string,
  actorId: Id<"users">,
  extra: { targetUserId?: Id<"users">; targetId?: string; note?: string } = {}
) {
  await ctx.db.insert("exportAuditLog", { action, actorId, ...extra, at: getUgandaTime() });
}

type DocSlot = {
  type: EffectiveDocType;
  /** Newest document of this type that is not superseded. */
  current: Doc<"exportDocuments"> | null;
  /** Newest verified one, which stays in force while a renewal is pending. */
  verified: Doc<"exportDocuments"> | null;
  state: "missing" | "pending" | "rejected" | "verified" | "expiring" | "expired";
};

export async function documentSlots(
  ctx: Ctx,
  ownerId: Id<"users">,
  appliesTo: "exporter" | "buyer",
  today: string,
  productForms?: string[]
): Promise<DocSlot[]> {
  // Exporters only see the documents that apply to what they sell.
  const types = (await getDocumentTypes(ctx, appliesTo)).filter(
    (t) => t.isActive && (appliesTo === "buyer" || docTypeAppliesTo(t, productForms))
  );
  const slots: DocSlot[] = [];
  for (const type of types) {
    const docs = await ctx.db
      .query("exportDocuments")
      .withIndex("by_ownerId_and_documentTypeKey", (q) => q.eq("ownerId", ownerId).eq("documentTypeKey", type.key))
      .order("desc")
      .take(20);
    const live = docs.filter((d) => d.status !== "replaced");
    const current = live[0] ?? null;
    const verified = live.find((d) => d.status === "verified") ?? null;
    let state: DocSlot["state"] = "missing";
    if (verified) {
      const e = expiryState(verified.expiryDate, today);
      state = e === "expired" ? "expired" : e === "expiring" ? "expiring" : "verified";
    }
    // A newer upload awaiting review is what the owner is waiting on, unless
    // the verified copy is still perfectly valid.
    if (current && current.status !== "verified" && (state === "missing" || state === "expired")) {
      state = current.status === "pending" ? "pending" : "rejected";
    }
    slots.push({ type, current, verified, state });
  }
  return slots;
}

export function feeState(profile: Doc<"exporterProfiles"> | null, today: string) {
  if (!profile) return { ok: false, state: "unpaid" as const, daysLeft: null as number | null };
  // A waiver (fee set to 0 when the exporter confirmed) lapses on the same
  // yearly cycle as a paid fee, so a fee a super admin introduces later is
  // charged at the next renewal instead of never.
  if (
    (profile.verificationFeeStatus === "paid" || profile.verificationFeeStatus === "waived") &&
    profile.verificationFeeValidUntil
  ) {
    const daysLeft = daysBetweenIsoDates(today, profile.verificationFeeValidUntil);
    if (daysLeft < 0) return { ok: false, state: "expired" as const, daysLeft };
    if (daysLeft <= EXPIRY_WARNING_DAYS) return { ok: true, state: "expiring" as const, daysLeft };
    return {
      ok: true,
      state: profile.verificationFeeStatus === "waived" ? ("waived" as const) : ("paid" as const),
      daysLeft,
    };
  }
  return { ok: false, state: "unpaid" as const, daysLeft: null };
}

/**
 * Everything that decides whether a trader is a live exporter. Used by the
 * trader workspace, the admin review screen and (in later phases) to hide an
 * exporter's lots the moment a licence or the fee lapses.
 */
export async function exporterReadiness(ctx: Ctx, user: Doc<"users">, today: string) {
  const communities = await exportCommunitiesForMember(ctx, user._id);
  const joined = await exportCommunitiesForMember(ctx, user._id, { admittedOnly: false });
  const profile = await ctx.db
    .query("exporterProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .first();
  const slots = await documentSlots(ctx, user._id, "exporter", today, profile?.productForms);
  const required = slots.filter((s) => s.type.required);
  const requiredDocsVerified = required.every((s) => s.state === "verified" || s.state === "expiring");
  const requiredDocsUploaded = required.every((s) => s.state !== "missing" && s.state !== "rejected" && s.state !== "expired");
  const fee = feeState(profile, today);
  // Two separate gates: a super admin verifies the trader (platform-wide),
  // and the community admin activates Export Markets for them (admission).
  const platformVerified = isVerifiedTrader(user);
  const joinedExportCommunity = joined.length > 0;
  const admittedAsExporter = user.role === "trader" && communities.length > 0;
  const approved = profile?.status === "approved";
  return {
    communities,
    profile,
    slots,
    fee,
    checks: {
      platformVerified,
      joinedExportCommunity,
      admittedAsExporter,
      profileSaved: !!profile,
      requiredDocsUploaded,
      requiredDocsVerified,
      feeOk: fee.ok,
      approved,
    },
    isActiveExporter:
      platformVerified && admittedAsExporter && approved && requiredDocsVerified && fee.ok,
    // Joined an exporter community but not yet admitted as an exporter.
    pendingCommunities: joined.filter((c) => !communities.some((a) => a._id === c._id)),
  };
}

/** Other modules (lots, catalogue) use this to decide whether an exporter is live. */
export async function isActiveExporter(ctx: Ctx, userId: Id<"users">, today: string): Promise<boolean> {
  const user = await ctx.db.get(userId);
  if (!user) return false;
  return (await exporterReadiness(ctx, user, today)).isActiveExporter;
}

export async function withUrl(ctx: Ctx, d: Doc<"exportDocuments">) {
  return { ...d, url: await ctx.storage.getUrl(d.storageId) };
}

// ------------------------------------------------------------------
// Trader (exporter) workspace
// ------------------------------------------------------------------

/** Lightweight check for the trader dashboard: show the Export Markets card? */
export const getMyExportAccess = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "trader") return { hasModule: false, pending: false, awaiting: null, communityNames: [] as string[] };
    const admitted = await exportCommunitiesForMember(ctx, user._id);
    const joined = await exportCommunitiesForMember(ctx, user._id, { admittedOnly: false });
    const verified = isVerifiedTrader(user);
    const hasModule = verified && admitted.length > 0;
    return {
      hasModule,
      // Joined an exporter community but not live yet: say what it waits for.
      pending: !hasModule && joined.length > 0,
      awaiting: hasModule ? null : !verified ? ("verification" as const) : admitted.length === 0 ? ("admission" as const) : null,
      communityNames: (admitted.length ? admitted : joined).map((c) => c.name),
    };
  },
});

export const getMyExporterWorkspace = query({
  args: { userId: v.id("users"), today: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "trader") throw new Error("Only trader accounts can use Export Markets");
    const today = isIsoDate(args.today) ? args.today : todayUganda();
    const r = await exporterReadiness(ctx, user, today);
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
        history: history.map((h) => ({
          _id: h._id,
          status: h.status,
          fileName: h.fileName,
          uploadedAt: h.uploadedAt,
          expiryDate: h.expiryDate,
          reviewNotes: h.reviewNotes,
        })),
      });
    }

    return {
      today,
      alias: user.alias,
      checks: r.checks,
      isActiveExporter: r.isActiveExporter,
      communities: r.communities.map((c) => ({ _id: c._id, name: c.name })),
      pendingCommunities: r.pendingCommunities.map((c) => ({ _id: c._id, name: c.name })),
      profile: r.profile,
      fee: {
        ...r.fee,
        amountUgx: fees.exporterVerificationFeeUgx,
        validityDays: fees.verificationFeeValidityDays,
        creditsAgainstSuccessFee: fees.creditVerificationFeeAgainstSuccessFee,
        renewalOpen:
          r.fee.state === "unpaid" ||
          r.fee.state === "expired" ||
          r.fee.state === "expiring",
      },
      walletBalanceUgx: await walletBalance(ctx, user._id),
      slots,
      // Every exporter document type, with the product forms it applies to,
      // so the trader can see all requirements while exploring.
      allDocumentTypes: (await getDocumentTypes(ctx, "exporter")).filter((t) => t.isActive),
    };
  },
});

export const saveExporterProfile = mutation({
  args: {
    userId: v.id("users"),
    communityId: v.id("communities"),
    legalName: v.string(),
    tradingName: v.optional(v.string()),
    tin: v.string(),
    exporterLicenceNumber: v.optional(v.string()),
    physicalAddress: v.string(),
    preferredPorts: v.array(v.string()),
    contactPerson: v.string(),
    contactPhone: v.string(),
    contactEmail: v.optional(v.string()),
    productForms: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "trader") throw new Error("Only trader accounts can become exporters");
    if (!isVerifiedTrader(user)) throw new Error("A super admin must verify your trader account first");
    const communities = await exportCommunitiesForMember(ctx, user._id);
    if (!communities.some((c) => c._id === args.communityId)) {
      throw new Error("Your community admin must activate Export Markets for you first");
    }

    const clean = (s: string | undefined) => (s ?? "").trim();
    const required: [string, string][] = [
      [clean(args.legalName), "Legal company name"],
      [clean(args.tin), "TIN"],
      [clean(args.physicalAddress), "Physical address"],
      [clean(args.contactPerson), "Contact person"],
      [clean(args.contactPhone), "Contact phone"],
    ];
    for (const [value, label] of required) {
      if (!value) throw new Error(`${label} is required`);
    }
    const ports = args.preferredPorts.map((p) => p.trim()).filter(Boolean).slice(0, 10);
    const forms = [...new Set(args.productForms ?? ["green"])].filter((f) => (PRODUCT_FORM_KEYS as string[]).includes(f));
    if (forms.length === 0) throw new Error("Choose at least one product you export");

    const fields = {
      communityId: args.communityId,
      legalName: clean(args.legalName),
      tradingName: clean(args.tradingName) || undefined,
      tin: clean(args.tin),
      exporterLicenceNumber: clean(args.exporterLicenceNumber) || undefined,
      physicalAddress: clean(args.physicalAddress),
      preferredPorts: ports,
      contactPerson: clean(args.contactPerson),
      contactPhone: clean(args.contactPhone),
      contactEmail: clean(args.contactEmail) || undefined,
      productForms: forms,
      updatedAt: getUgandaTime(),
    };

    const existing = await ctx.db
      .query("exporterProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (existing) {
      if (existing.status === "suspended") throw new Error("Your exporter profile is suspended. Contact an admin.");
      // Changing the legal identity of an approved exporter needs a fresh review.
      const identityChanged =
        existing.legalName !== fields.legalName ||
        existing.tin !== fields.tin ||
        existing.exporterLicenceNumber !== fields.exporterLicenceNumber;
      const status = existing.status === "approved" && identityChanged ? "submitted" : existing.status;
      await ctx.db.patch(existing._id, { ...fields, status });
      return { profileId: existing._id, status };
    }
    const profileId = await ctx.db.insert("exporterProfiles", {
      userId: user._id,
      ...fields,
      status: "draft",
      verificationFeeStatus: "unpaid",
      successFeeCreditUgx: 0,
      createdAt: getUgandaTime(),
    });
    return { profileId, status: "draft" as const };
  },
});

export const generateExportDocumentUploadUrl = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || (user.role !== "trader" && user.role !== "buyer")) throw new Error("Not authorized");
    return await ctx.storage.generateUploadUrl();
  },
});

export const uploadExporterDocument = mutation({
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
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "trader") throw new Error("Only trader accounts can upload exporter documents");
    const profile = await ctx.db
      .query("exporterProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    // Documents can be uploaded before the profile is saved; they are
    // reviewed by the admins of the exporter community the trader is in.
    const communityId = profile?.communityId ?? (await exportCommunitiesForMember(ctx, user._id))[0]?._id;
    if (!communityId) throw new Error("You must be a member of an exporter community");

    const type = (await getDocumentTypes(ctx, "exporter")).find((t) => t.key === args.documentTypeKey && t.isActive);
    if (!type) throw new Error("Unknown document type");

    const today = todayUganda();
    if (args.issueDate && !isIsoDate(args.issueDate)) throw new Error("Issue date is not a valid date");
    if (type.hasExpiry) {
      if (!isIsoDate(args.expiryDate)) throw new Error(`${type.label} needs an expiry date`);
      if (args.expiryDate < today) throw new Error("This document has already expired");
    } else if (args.expiryDate && !isIsoDate(args.expiryDate)) {
      throw new Error("Expiry date is not a valid date");
    }

    // Older uploads still waiting (or rejected) are superseded by this one.
    // A verified copy stays in force until this upload is verified.
    const older = await ctx.db
      .query("exportDocuments")
      .withIndex("by_ownerId_and_documentTypeKey", (q) => q.eq("ownerId", user._id).eq("documentTypeKey", type.key))
      .take(50);
    for (const d of older) {
      if (d.status === "pending" || d.status === "rejected") await ctx.db.patch(d._id, { status: "replaced" });
    }

    const documentId = await ctx.db.insert("exportDocuments", {
      ownerId: user._id,
      ownerKind: "exporter",
      communityId,
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

export const removeMyPendingDocument = mutation({
  args: { userId: v.id("users"), documentId: v.id("exportDocuments") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.ownerId !== args.userId) throw new Error("Document not found");
    if (doc.status !== "pending" && doc.status !== "rejected") {
      throw new Error("Only documents that are not yet verified can be removed");
    }
    await ctx.db.delete(doc._id);
    await ctx.storage.delete(doc.storageId);
    return { success: true };
  },
});

/**
 * Pay (or renew) the exporter verification fee from the wallet. Top-ups go
 * through the existing Pesapal wallet deposit, so no new payment path exists.
 */
export const payExporterVerificationFee = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "trader") throw new Error("Only trader accounts can pay this fee");
    const profile = await ctx.db
      .query("exporterProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!profile) throw new Error("Save your exporter profile first");

    const today = todayUganda();
    const current = feeState(profile, today);
    if (current.state === "waived" || current.state === "paid") {
      throw new Error("Your verification fee is up to date. Renewal opens 30 days before it expires.");
    }

    const fees = await getFeeSettings(ctx);
    const amount = Math.round(fees.exporterVerificationFeeUgx);
    // A renewal paid early extends from the current expiry, not from today.
    const base =
      current.state === "expiring" && profile.verificationFeeValidUntil ? profile.verificationFeeValidUntil : today;
    const validUntil = addDaysToIsoDate(base, fees.verificationFeeValidityDays);

    if (amount <= 0) {
      await ctx.db.patch(profile._id, {
        verificationFeeStatus: "waived",
        verificationFeeValidUntil: validUntil,
        updatedAt: getUgandaTime(),
      });
      await audit(ctx, "fee_waived", user._id, { targetUserId: user._id, note: `No fee set; valid until ${validUntil}` });
      return { waived: true, amountUgx: 0 };
    }

    await checkPilotMode(ctx);
    const balance = await walletBalance(ctx, user._id);
    if (balance < amount) {
      throw new Error(
        `Your wallet has UGX ${balance.toLocaleString()}. Top up UGX ${(amount - balance).toLocaleString()} to pay the UGX ${amount.toLocaleString()} verification fee.`
      );
    }

    const utid = generateUTID("trader");
    const now = getUgandaTime();
    await ctx.db.insert("walletLedger", {
      userId: user._id,
      utid,
      type: "export_fee_payment",
      amount,
      balanceAfter: balance - amount,
      timestamp: now,
      metadata: { feeKind: "verification", validUntil },
    });
    await ctx.db.insert("exportFeeCharges", {
      userId: user._id,
      kind: "verification",
      amountUgx: amount,
      utid,
      note: `Valid until ${validUntil}`,
      chargedAt: now,
    });
    await ctx.db.patch(profile._id, {
      verificationFeeStatus: "paid",
      verificationFeePaidUgx: amount,
      verificationFeePaidAt: now,
      verificationFeeUtid: utid,
      verificationFeeValidUntil: validUntil,
      successFeeCreditUgx: fees.creditVerificationFeeAgainstSuccessFee
        ? profile.successFeeCreditUgx + amount
        : profile.successFeeCreditUgx,
      updatedAt: now,
    });
    await audit(ctx, "fee_paid", user._id, { targetUserId: user._id, targetId: utid, note: `UGX ${amount}` });
    return { waived: false, amountUgx: amount, utid, validUntil };
  },
});

export const submitExporterProfile = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "trader") throw new Error("Only trader accounts can submit");
    const r = await exporterReadiness(ctx, user, todayUganda());
    if (!r.profile) throw new Error("Save your exporter profile first");
    if (r.profile.status === "approved") throw new Error("Your exporter profile is already approved");
    if (r.profile.status === "suspended") throw new Error("Your exporter profile is suspended. Contact an admin.");
    if (!r.checks.platformVerified) throw new Error("A super admin must verify your trader account first");
    if (!r.checks.admittedAsExporter) throw new Error("Your community admin must activate Export Markets for you first");
    // Submission is ongoing: the exporter can submit early and keep adding
    // documents; admins review each one as it arrives. Approval still needs
    // every required document verified and the fee paid.

    await ctx.db.patch(r.profile._id, { status: "submitted", submittedAt: getUgandaTime(), updatedAt: getUgandaTime() });

    const community = await ctx.db.get(r.profile.communityId);
    if (community?.communityAdminId) {
      await notify(
        ctx,
        community.communityAdminId,
        "Exporter application to review",
        `${user.alias} submitted an exporter profile and documents in ${community.name}.`
      );
    }
    return { success: true };
  },
});

// ------------------------------------------------------------------
// Admin: communities and members
// ------------------------------------------------------------------

export const listMyExportCommunities = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.adminId);
    const communities = await exportCommunitiesForAdmin(ctx, admin);
    return {
      isSuperAdmin: isSuperAdmin(admin),
      communities: communities.map((c) => ({ _id: c._id, name: c.name })),
    };
  },
});

export const listExportCommunityMembers = query({
  args: { adminId: v.id("users"), communityId: v.id("communities"), today: v.string() },
  handler: async (ctx, args) => {
    const { admin } = await requireExportCommunityAdmin(ctx, args.adminId, args.communityId);
    const today = isIsoDate(args.today) ? args.today : todayUganda();
    const memberships = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .take(500);
    const members = [];
    for (const m of memberships) {
      const u = await ctx.db.get(m.userId);
      if (!u || u.role !== "trader") continue;
      const r = await exporterReadiness(ctx, u, today);
      members.push({
        userId: u._id,
        alias: u.alias,
        admitted: isAdmittedExporter(m),
        platformVerified: isVerifiedTrader(u),
        phoneNumber: u.phoneNumber ?? null,
        email: u.email ?? null,
        joinedAt: m.joinedAt,
        profileStatus: r.profile?.status ?? null,
        legalName: r.profile?.legalName ?? null,
        feeState: r.fee.state,
        isActiveExporter: r.isActiveExporter,
      });
    }
    return { canVerify: isSuperAdmin(admin), members };
  },
});

/** Super-admin-verified traders who are not yet members of this exporter community. */
export const listVerifiedTradersToAdd = query({
  args: { adminId: v.id("users"), communityId: v.id("communities"), search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireExportCommunityAdmin(ctx, args.adminId, args.communityId);
    const traders = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "trader"))
      .take(1000);
    const term = (args.search ?? "").trim().toLowerCase();
    const result = [];
    for (const t of traders) {
      if (t.state !== "active" || !isVerifiedTrader(t)) continue;
      const membership = await ctx.db
        .query("communityMemberships")
        .withIndex("by_community_user", (q) => q.eq("communityId", args.communityId).eq("userId", t._id))
        .first();
      if (membership) continue;
      const tp = await ctx.db
        .query("traderProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", t._id))
        .first();
      const haystack = `${t.alias} ${tp?.businessName ?? ""} ${t.phoneNumber ?? ""} ${t.email ?? ""}`.toLowerCase();
      if (term && !haystack.includes(term)) continue;
      result.push({
        userId: t._id,
        alias: t.alias,
        businessName: tp?.businessName ?? null,
        phoneNumber: t.phoneNumber ?? null,
        email: t.email ?? null,
      });
      if (result.length >= 50) break;
    }
    return result;
  },
});

export const addTraderToExportCommunity = mutation({
  args: { adminId: v.id("users"), communityId: v.id("communities"), traderId: v.id("users") },
  handler: async (ctx, args) => {
    const { community } = await requireExportCommunityAdmin(ctx, args.adminId, args.communityId);
    const trader = await ctx.db.get(args.traderId);
    if (!trader || trader.role !== "trader" || trader.state !== "active") {
      throw new Error("Only active trader accounts can be admitted as exporters");
    }
    // The community admin only activates the export dashboard; verifying
    // the trader is for super admins.
    if (!isVerifiedTrader(trader)) throw new Error("A super admin must verify this trader first (Finance: Trader Verification Status)");
    // Admit a trader who already joined, or add and admit one in a single step.
    const now = getUgandaTime();
    const existing = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community_user", (q) => q.eq("communityId", args.communityId).eq("userId", args.traderId))
      .first();
    if (existing) {
      if (isAdmittedExporter(existing)) throw new Error("This trader is already admitted as an exporter");
      await ctx.db.patch(existing._id, { exportAdmitted: true, exportAdmittedBy: args.adminId, exportAdmittedAt: now });
    } else {
      await ctx.db.insert("communityMemberships", {
        communityId: args.communityId,
        userId: args.traderId,
        joinedAt: now,
        exportAdmitted: true,
        exportAdmittedBy: args.adminId,
        exportAdmittedAt: now,
      });
    }
    await notify(
      ctx,
      args.traderId,
      "Export Markets unlocked",
      `You were admitted as an exporter in ${community.name}. Open Export Markets on your dashboard to set up your exporter profile and documents.`
    );
    await audit(ctx, "member_added", args.adminId, { targetUserId: args.traderId, targetId: String(args.communityId) });
    return { success: true };
  },
});

export const removeTraderFromExportCommunity = mutation({
  args: { adminId: v.id("users"), communityId: v.id("communities"), traderId: v.id("users"), reason: v.string() },
  handler: async (ctx, args) => {
    const { community } = await requireExportCommunityAdmin(ctx, args.adminId, args.communityId);
    const membership = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community_user", (q) => q.eq("communityId", args.communityId).eq("userId", args.traderId))
      .first();
    if (!membership || !isAdmittedExporter(membership)) throw new Error("This trader is not admitted as an exporter");
    // Revoking export access keeps the trader a member of the community.
    await ctx.db.patch(membership._id, {
      exportAdmitted: false,
      communityRole: membership.communityRole === "Exporter" ? undefined : membership.communityRole,
    });
    const profile = await ctx.db
      .query("exporterProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.traderId))
      .first();
    if (profile && profile.communityId === args.communityId && profile.status === "approved") {
      await ctx.db.patch(profile._id, { status: "suspended", reviewNotes: args.reason, updatedAt: getUgandaTime() });
    }
    await notify(ctx, args.traderId, "Export access removed", `Your exporter access in ${community.name} was removed. ${args.reason}`);
    await audit(ctx, "member_removed", args.adminId, { targetUserId: args.traderId, note: args.reason });
    return { success: true };
  },
});

// ------------------------------------------------------------------
// Admin: review
// ------------------------------------------------------------------

export const listExporterProfilesForReview = query({
  args: {
    adminId: v.id("users"),
    status: v.union(
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("suspended"),
      v.literal("draft")
    ),
    today: v.string(),
    communityId: v.optional(v.id("communities")),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.adminId);
    const today = isIsoDate(args.today) ? args.today : todayUganda();
    let profiles: Doc<"exporterProfiles">[] = [];
    if (isSuperAdmin(admin)) {
      profiles = await ctx.db
        .query("exporterProfiles")
        .withIndex("by_status", (q) => q.eq("status", args.status))
        .take(200);
    } else {
      for (const c of await exportCommunitiesForAdmin(ctx, admin)) {
        const rows = await ctx.db
          .query("exporterProfiles")
          .withIndex("by_communityId_and_status", (q) => q.eq("communityId", c._id).eq("status", args.status))
          .take(200);
        profiles.push(...rows);
      }
    }
    if (args.communityId) profiles = profiles.filter((p) => p.communityId === args.communityId);
    const result = [];
    for (const p of profiles) {
      const u = await ctx.db.get(p.userId);
      if (!u) continue;
      const r = await exporterReadiness(ctx, u, today);
      const community = await ctx.db.get(p.communityId);
      result.push({
        profile: p,
        alias: u.alias,
        communityName: community?.name ?? "",
        checks: r.checks,
        fee: r.fee,
        documents: r.slots.map((s) => ({ label: s.type.label, required: s.type.required, state: s.state })),
      });
    }
    return result;
  },
});

export const listDocumentsForReview = query({
  args: { adminId: v.id("users"), communityId: v.optional(v.id("communities")) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.adminId);
    let docs: Doc<"exportDocuments">[] = [];
    if (isSuperAdmin(admin)) {
      docs = await ctx.db
        .query("exportDocuments")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .take(200);
    } else {
      for (const c of await exportCommunitiesForAdmin(ctx, admin)) {
        const rows = await ctx.db
          .query("exportDocuments")
          .withIndex("by_communityId_and_status", (q) => q.eq("communityId", c._id).eq("status", "pending"))
          .take(200);
        docs.push(...rows);
      }
    }
    if (args.communityId) docs = docs.filter((d) => d.communityId === args.communityId);
    const result = [];
    for (const d of docs) {
      const owner = await ctx.db.get(d.ownerId);
      const profile =
        d.ownerKind === "exporter"
          ? await ctx.db
              .query("exporterProfiles")
              .withIndex("by_userId", (q) => q.eq("userId", d.ownerId))
              .first()
          : null;
      const buyer =
        d.ownerKind === "buyer"
          ? await ctx.db
              .query("buyerProfiles")
              .withIndex("by_userId", (q) => q.eq("userId", d.ownerId))
              .first()
          : null;
      result.push({
        ...(await withUrl(ctx, d)),
        ownerAlias: owner?.alias ?? "",
        ownerLegalName: profile?.legalName ?? (buyer ? `${buyer.businessName}${buyer.countryName ? `, ${buyer.countryName}` : ""}` : null),
      });
    }
    return result;
  },
});

async function assertCanReviewDocument(ctx: Ctx, admin: Doc<"users">, doc: Doc<"exportDocuments">) {
  if (isSuperAdmin(admin)) return;
  if (!doc.communityId) throw new Error("Only super admins can review this document");
  const community = await ctx.db.get(doc.communityId);
  if (!community || !adminManagesCommunity(admin, community)) {
    throw new Error("Not authorized to review this document");
  }
}

export const reviewExportDocument = mutation({
  args: {
    adminId: v.id("users"),
    documentId: v.id("exportDocuments"),
    decision: v.union(v.literal("verify"), v.literal("reject")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx, args.adminId);
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new Error("Document not found");
    await assertCanReviewDocument(ctx, admin, doc);
    if (doc.status !== "pending") throw new Error("This document has already been reviewed");
    const notes = args.notes?.trim() || undefined;
    if (args.decision === "reject" && !notes) throw new Error("Give a reason so the owner knows what to fix");

    const now = getUgandaTime();
    if (args.decision === "verify") {
      // The newly verified copy supersedes any older verified one.
      const siblings = await ctx.db
        .query("exportDocuments")
        .withIndex("by_ownerId_and_documentTypeKey", (q) => q.eq("ownerId", doc.ownerId).eq("documentTypeKey", doc.documentTypeKey))
        .take(50);
      for (const s of siblings) {
        if (s._id !== doc._id && s.status === "verified") await ctx.db.patch(s._id, { status: "replaced" });
      }
    }
    await ctx.db.patch(doc._id, {
      status: args.decision === "verify" ? "verified" : "rejected",
      reviewedBy: admin._id,
      reviewedAt: now,
      reviewNotes: notes,
    });
    await notify(
      ctx,
      doc.ownerId,
      args.decision === "verify" ? "Document verified" : "Document rejected",
      args.decision === "verify"
        ? `Your ${doc.documentTypeLabel} was verified.`
        : `Your ${doc.documentTypeLabel} was rejected: ${notes}`
    );
    await audit(ctx, args.decision === "verify" ? "document_verified" : "document_rejected", admin._id, {
      targetUserId: doc.ownerId,
      targetId: String(doc._id),
      note: notes,
    });
    return { success: true };
  },
});

export const reviewExporterProfile = mutation({
  args: {
    adminId: v.id("users"),
    profileId: v.id("exporterProfiles"),
    decision: v.union(v.literal("approve"), v.literal("reject"), v.literal("suspend"), v.literal("reinstate")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Exporter profile not found");
    const admin = await requireAdmin(ctx, args.adminId);
    // Super admins can always act (e.g. suspend after the module is switched
    // off); community admins only inside a live exporter community they run.
    if (!isSuperAdmin(admin)) await requireExportCommunityAdmin(ctx, args.adminId, profile.communityId);
    const user = await ctx.db.get(profile.userId);
    if (!user) throw new Error("User not found");
    const notes = args.notes?.trim() || undefined;

    let status: Doc<"exporterProfiles">["status"];
    if (args.decision === "approve" || args.decision === "reinstate") {
      const r = await exporterReadiness(ctx, user, todayUganda());
      if (!r.checks.platformVerified) throw new Error("A super admin must verify this trader first (Finance: Trader Verification Status)");
      if (!r.checks.admittedAsExporter) throw new Error("Activate Export Markets for the trader first");
      if (!r.checks.requiredDocsVerified) throw new Error("Verify every required document first");
      if (!r.checks.feeOk) throw new Error("The verification fee is not paid");
      if (args.decision === "reinstate" && profile.status !== "suspended") throw new Error("Only a suspended exporter can be reinstated");
      status = "approved";
    } else {
      if (!notes) throw new Error("Give a reason");
      if (args.decision === "suspend" && profile.status !== "approved") throw new Error("Only an approved exporter can be suspended");
      status = args.decision === "reject" ? "rejected" : "suspended";
    }

    await ctx.db.patch(profile._id, {
      status,
      reviewedBy: admin._id,
      reviewedAt: getUgandaTime(),
      reviewNotes: notes,
      updatedAt: getUgandaTime(),
    });
    const messages: Record<string, [string, string]> = {
      approve: ["You are now a verified exporter", "Your exporter profile was approved."],
      reinstate: ["Exporter profile reinstated", "Your exporter profile is active again."],
      reject: ["Exporter profile needs changes", `Your exporter profile was not approved: ${notes}`],
      suspend: ["Exporter profile suspended", `Your exporter profile was suspended: ${notes}`],
    };
    const [title, message] = messages[args.decision];
    await notify(ctx, user._id, title, message);
    await audit(ctx, `exporter_${args.decision}`, admin._id, { targetUserId: user._id, note: notes });
    return { success: true, status };
  },
});

// ------------------------------------------------------------------
// Document types (super admin)
// ------------------------------------------------------------------

export const listDocumentTypes = query({
  args: { appliesTo: v.union(v.literal("exporter"), v.literal("buyer")) },
  handler: async (ctx, args) => {
    const types = await getDocumentTypes(ctx, args.appliesTo);
    const customised = types.some((t) => t._id !== undefined);
    return { customised, types };
  },
});

export const saveDocumentType = mutation({
  args: {
    adminId: v.id("users"),
    appliesTo: v.union(v.literal("exporter"), v.literal("buyer")),
    key: v.optional(v.string()), // omitted = new type
    label: v.string(),
    description: v.optional(v.string()),
    required: v.boolean(),
    hasExpiry: v.boolean(),
    isActive: v.boolean(),
    productForms: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx, args.adminId);
    const label = args.label.trim();
    const productForms =
      args.appliesTo === "exporter"
        ? (args.productForms ?? []).filter((f) => (PRODUCT_FORM_KEYS as string[]).includes(f))
        : [];
    if (!label) throw new Error("Label is required");
    const now = getUgandaTime();

    // The first edit copies the built-in defaults into the table, so the
    // list becomes fully admin-managed from then on.
    const existing = await ctx.db
      .query("exportDocumentTypes")
      .withIndex("by_appliesTo_and_order", (q) => q.eq("appliesTo", args.appliesTo))
      .take(100);
    let maxOrder = existing.reduce((m, r) => Math.max(m, r.order), -1);
    if (existing.length === 0) {
      for (const d of DEFAULT_EXPORT_DOCUMENT_TYPES.filter((t) => t.appliesTo === args.appliesTo)) {
        maxOrder += 1;
        await ctx.db.insert("exportDocumentTypes", { ...d, isActive: true, order: maxOrder, createdAt: now, updatedAt: now });
      }
    }

    if (args.key) {
      let row = await ctx.db
        .query("exportDocumentTypes")
        .withIndex("by_key", (q) => q.eq("key", args.key!))
        .first();
      if (!row) {
        // A built-in type added after this list was customised: save it first.
        const d = DEFAULT_EXPORT_DOCUMENT_TYPES.find((x) => x.key === args.key && x.appliesTo === args.appliesTo);
        if (d) {
          maxOrder += 1;
          const id = await ctx.db.insert("exportDocumentTypes", { ...d, isActive: true, order: maxOrder, createdAt: now, updatedAt: now });
          row = await ctx.db.get(id);
        }
      }
      if (!row || row.appliesTo !== args.appliesTo) throw new Error("Document type not found");
      await ctx.db.patch(row._id, {
        label,
        description: args.description?.trim() || undefined,
        required: args.required,
        hasExpiry: args.hasExpiry,
        isActive: args.isActive,
        productForms: args.productForms === undefined ? row.productForms : productForms.length ? productForms : undefined,
        updatedAt: now,
      });
      await audit(ctx, "doc_type_saved", args.adminId, { targetId: row.key });
      return { key: row.key };
    }

    const base = `${args.appliesTo === "buyer" ? "buyer_" : ""}${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`.slice(0, 60) || "document";
    let key = base;
    for (let i = 2; await ctx.db.query("exportDocumentTypes").withIndex("by_key", (q) => q.eq("key", key)).first(); i++) {
      key = `${base}_${i}`;
    }
    await ctx.db.insert("exportDocumentTypes", {
      key,
      label,
      description: args.description?.trim() || undefined,
      appliesTo: args.appliesTo,
      required: args.required,
      hasExpiry: args.hasExpiry,
      productForms: productForms.length ? productForms : undefined,
      isActive: args.isActive,
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    });
    await audit(ctx, "doc_type_saved", args.adminId, { targetId: key });
    return { key };
  },
});

// ------------------------------------------------------------------
// Fees (super admin, Finance tab)
// ------------------------------------------------------------------

export const getExportFeeSettings = query({
  args: {},
  handler: async (ctx) => {
    return await getFeeSettings(ctx);
  },
});

export const updateExportFeeSettings = mutation({
  args: {
    adminId: v.id("users"),
    exporterVerificationFeeUgx: v.number(),
    verificationFeeValidityDays: v.number(),
    creditVerificationFeeAgainstSuccessFee: v.boolean(),
    successFeeMode: v.union(v.literal("percent"), v.literal("per_bag")),
    successFeePercent: v.number(),
    successFeePerBagUsd: v.number(),
    buyerFeePercent: v.number(),
    sampleHandlingFeeUgx: v.number(),
  },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx, args.adminId);
    const nonNegative: [number, string][] = [
      [args.exporterVerificationFeeUgx, "Verification fee"],
      [args.successFeePerBagUsd, "Success fee per bag"],
      [args.sampleHandlingFeeUgx, "Sample handling fee"],
    ];
    for (const [n, label] of nonNegative) {
      if (!Number.isFinite(n) || n < 0) throw new Error(`${label} cannot be negative`);
    }
    for (const [n, label] of [
      [args.successFeePercent, "Success fee %"],
      [args.buyerFeePercent, "Buyer fee %"],
    ] as [number, string][]) {
      if (!Number.isFinite(n) || n < 0 || n > 20) throw new Error(`${label} must be between 0 and 20`);
    }
    if (!Number.isInteger(args.verificationFeeValidityDays) || args.verificationFeeValidityDays < 30 || args.verificationFeeValidityDays > 1095) {
      throw new Error("Validity must be between 30 and 1095 days");
    }
    const { adminId, ...values } = args;
    const row = { ...values, updatedBy: adminId, updatedAt: getUgandaTime() };
    const existing = await ctx.db.query("exportFeeSettings").first();
    if (existing) await ctx.db.replace(existing._id, row);
    else await ctx.db.insert("exportFeeSettings", row);
    await audit(ctx, "fees_updated", adminId, { note: JSON.stringify(values) });
    return { success: true };
  },
});

export const getExportFeeLedger = query({
  args: { adminId: v.id("users") },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx, args.adminId);
    const charges = await ctx.db.query("exportFeeCharges").withIndex("by_chargedAt").order("desc").take(500);
    const totals = { verification: 0, success: 0, buyer: 0, sample: 0 };
    for (const c of charges) totals[c.kind] += c.amountUgx;
    const recent = [];
    for (const c of charges.slice(0, 50)) {
      const u = await ctx.db.get(c.userId);
      recent.push({ ...c, alias: u?.alias ?? "" });
    }
    return { totals, count: charges.length, capped: charges.length === 500, recent };
  },
});
