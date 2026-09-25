/**
 * Diagnostics library - admin side (phase 0).
 *
 * A shared pest & disease library for the communities a super admin has
 * switched Diagnostics on for. Community admins in those communities add
 * entries, review each other's entries and flag problems; super admins can do
 * all of that and are the only ones who can remove or restore an entry.
 * Every change is written to diagnosticAuditLog.
 *
 * Farmers do not read this library yet. The rules that decide who may do what
 * live in ./diagnosticsRules so they can be unit tested.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getUgandaTime } from "./utils";
import { isDiagnosticsEnabled } from "./communityModules";
import {
  canFlag,
  canRemove,
  canReview,
  flagKey,
  isValidHost,
  isValidSymptom,
  MAX_DIAGNOSTIC_IMAGE_BYTES,
  normalizeSourceUrl,
  type DiagnosticActor,
} from "./diagnosticsRules";

const itemTypeValidator = v.union(v.literal("condition"), v.literal("image"), v.literal("treatment"));
type ItemType = "condition" | "image" | "treatment";
type ItemDoc = Doc<"diagnosticConditions"> | Doc<"diagnosticImages"> | Doc<"diagnosticTreatments">;

// Mirrors isSuperAdmin() in convex/communities.ts.
function isSuperAdminUser(user: Doc<"users">): boolean {
  const u = user as any;
  return u.adminLevel === "super" || (u.adminLevel === undefined && !u.adminCategory);
}

function isCommunityAdminUser(user: Doc<"users">): boolean {
  const u = user as any;
  return u.adminCategory === "community" && (u.adminLevel === "junior" || u.adminLevel === undefined);
}

type Access = DiagnosticActor & {
  admin: Doc<"users">;
  communityId: Id<"communities"> | undefined;
};

/**
 * Super admins always get in. A community admin gets in only through a
 * community they administer that has Diagnostics switched on, and everything
 * they do is recorded against that community.
 */
export async function requireLibraryAccess(
  ctx: QueryCtx | MutationCtx,
  adminId: Id<"users">,
  communityId: Id<"communities"> | undefined
): Promise<Access> {
  const admin = await ctx.db.get(adminId);
  if (!admin || admin.role !== "admin") {
    throw new Error("Not authorized");
  }
  if (isSuperAdminUser(admin)) {
    return { admin, isSuperAdmin: true, userId: String(adminId), communityId };
  }
  if (!isCommunityAdminUser(admin) || !communityId) {
    throw new Error("Only community admins of a community with Diagnostics can use the library");
  }
  const community = await ctx.db.get(communityId);
  if (!community) throw new Error("Community not found");

  const assigned = ((admin as any).assignedCommunityIds || []).map((id: unknown) => String(id));
  const isAdminOfCommunity =
    assigned.includes(String(communityId)) || String((community as any).communityAdminId || "") === String(adminId);
  if (!isAdminOfCommunity) {
    throw new Error("You are not an admin of this community");
  }
  if (!isDiagnosticsEnabled(community as any)) {
    throw new Error("Diagnostics is not enabled for this community");
  }
  return { admin, isSuperAdmin: false, userId: String(adminId), communityId };
}

async function log(
  ctx: MutationCtx,
  access: Access,
  entry: { action: string; itemType?: ItemType; itemId?: string; conditionId?: Id<"diagnosticConditions">; note?: string }
) {
  await ctx.db.insert("diagnosticAuditLog", {
    ...entry,
    actorId: access.admin._id,
    actorCommunityId: access.communityId,
    at: getUgandaTime(),
  });
}

function tableFor(itemType: ItemType) {
  return itemType === "condition"
    ? "diagnosticConditions"
    : itemType === "image"
      ? "diagnosticImages"
      : "diagnosticTreatments";
}

async function getItem(ctx: QueryCtx | MutationCtx, itemType: ItemType, itemId: string): Promise<ItemDoc> {
  const id = ctx.db.normalizeId(tableFor(itemType), itemId);
  const item = id ? await ctx.db.get(id) : null;
  if (!item) throw new Error("Entry not found");
  return item as ItemDoc;
}

function conditionIdOf(itemType: ItemType, item: ItemDoc): Id<"diagnosticConditions"> {
  return itemType === "condition"
    ? (item._id as Id<"diagnosticConditions">)
    : (item as Doc<"diagnosticImages"> | Doc<"diagnosticTreatments">).conditionId;
}

function requireText(value: string, label: string, max = 2000): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  if (trimmed.length > max) throw new Error(`${label} is too long (max ${max} characters)`);
  return trimmed;
}

function optionalText(value: string | undefined, max = 500): string | undefined {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

function cleanSymptomTags(tags: string[]): string[] {
  const unique = Array.from(new Set(tags));
  if (!unique.every(isValidSymptom)) throw new Error("Unknown symptom");
  return unique;
}

function contributionFields(access: Access) {
  return {
    status: "pending_review" as const,
    addedBy: access.admin._id,
    addedByCommunityId: access.isSuperAdmin ? undefined : access.communityId,
    addedAt: getUgandaTime(),
    openFlagCount: 0,
  };
}

async function describeActors(ctx: QueryCtx, userIds: Id<"users">[], communityIds: Id<"communities">[]) {
  const users = new Map<string, string>();
  for (const id of Array.from(new Set(userIds.map(String)))) {
    const u = (await ctx.db.get(id as Id<"users">)) as any;
    users.set(id, u?.verifiedName || u?.alias || u?.email || "Admin");
  }
  const communities = new Map<string, string>();
  for (const id of Array.from(new Set(communityIds.map(String)))) {
    const c = await ctx.db.get(id as Id<"communities">);
    communities.set(id, c?.name || "Community");
  }
  return {
    userName: (id: Id<"users"> | undefined) => (id ? users.get(String(id)) : undefined),
    communityName: (id: Id<"communities"> | undefined) => (id ? communities.get(String(id)) : "Platform"),
  };
}

// ─── Queries ────────────────────────────────────────────────────────────────

/** Lightweight library list. Filtering by crop and text happens here on a bounded read. */
export const listConditions = query({
  args: {
    adminId: v.id("users"),
    communityId: v.optional(v.id("communities")),
    status: v.optional(
      v.union(v.literal("pending_review"), v.literal("active"), v.literal("rejected"), v.literal("removed"))
    ),
    host: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireLibraryAccess(ctx, args.adminId, args.communityId);
    const status = args.status ?? "active";
    if (status === "removed" && !access.isSuperAdmin) return [];

    const rows = await ctx.db
      .query("diagnosticConditions")
      .withIndex("by_status", (q) => q.eq("status", status))
      .take(300);
    const search = (args.search ?? "").trim().toLowerCase();
    return rows
      .filter((c) => !args.host || c.hosts.includes(args.host))
      .filter(
        (c) =>
          !search ||
          c.name.toLowerCase().includes(search) ||
          (c.scientificName ?? "").toLowerCase().includes(search)
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({
        _id: c._id,
        name: c.name,
        scientificName: c.scientificName,
        kind: c.kind,
        hosts: c.hosts,
        status: c.status,
        openFlagCount: c.openFlagCount ?? 0,
        symptomTagCount: c.symptomTags?.length ?? 0,
      }));
  },
});

/** One entry with its photos, treatments and open flags. */
export const getCondition = query({
  args: {
    adminId: v.id("users"),
    communityId: v.optional(v.id("communities")),
    conditionId: v.id("diagnosticConditions"),
  },
  handler: async (ctx, args) => {
    const access = await requireLibraryAccess(ctx, args.adminId, args.communityId);
    const condition = await ctx.db.get(args.conditionId);
    if (!condition) return null;
    if (condition.status === "removed" && !access.isSuperAdmin) return null;

    const hideRemoved = <T extends { status: string }>(rows: T[]) =>
      access.isSuperAdmin ? rows : rows.filter((r) => r.status !== "removed");

    const images = hideRemoved(
      await ctx.db
        .query("diagnosticImages")
        .withIndex("by_condition", (q) => q.eq("conditionId", args.conditionId))
        .take(50)
    );
    const treatments = hideRemoved(
      await ctx.db
        .query("diagnosticTreatments")
        .withIndex("by_condition", (q) => q.eq("conditionId", args.conditionId))
        .take(50)
    );

    const itemIds = [String(condition._id), ...images.map((i) => String(i._id)), ...treatments.map((t) => String(t._id))];
    const flags = (
      await Promise.all(
        itemIds.map((itemId) =>
          ctx.db
            .query("diagnosticFlags")
            .withIndex("by_item_status", (q) => q.eq("itemId", itemId).eq("status", "open"))
            .take(20)
        )
      )
    ).flat();

    const names = await describeActors(
      ctx,
      [condition.addedBy, ...images.map((i) => i.addedBy), ...treatments.map((t) => t.addedBy), ...flags.map((f) => f.flaggedBy)],
      [condition, ...images, ...treatments]
        .map((r) => r.addedByCommunityId)
        .concat(flags.map((f) => f.flaggedByCommunityId))
        .filter((id): id is Id<"communities"> => !!id)
    );
    const attribution = (r: { addedBy: Id<"users">; addedByCommunityId?: Id<"communities"> }) => ({
      addedByName: names.userName(r.addedBy),
      addedByCommunityName: names.communityName(r.addedByCommunityId),
      isMine: String(r.addedBy) === access.userId,
    });

    return {
      condition: { ...condition, ...attribution(condition) },
      images: await Promise.all(
        images.map(async (img) => ({
          ...img,
          ...attribution(img),
          thumbUrl: await ctx.storage.getUrl(img.thumbStorageId ?? img.storageId),
          url: await ctx.storage.getUrl(img.storageId),
        }))
      ),
      treatments: treatments.map((t) => ({ ...t, ...attribution(t) })),
      flags: flags.map((f) => ({
        ...f,
        flaggedByName: names.userName(f.flaggedBy),
        flaggedByCommunityName: names.communityName(f.flaggedByCommunityId),
      })),
      viewer: { isSuperAdmin: access.isSuperAdmin, userId: access.userId },
    };
  },
});

/** Everything waiting for a second pair of eyes, across all three kinds of entry. */
export const listReviewQueue = query({
  args: { adminId: v.id("users"), communityId: v.optional(v.id("communities")) },
  handler: async (ctx, args) => {
    const access = await requireLibraryAccess(ctx, args.adminId, args.communityId);
    const [conditions, images, treatments] = await Promise.all([
      ctx.db
        .query("diagnosticConditions")
        .withIndex("by_status", (q) => q.eq("status", "pending_review"))
        .take(100),
      ctx.db
        .query("diagnosticImages")
        .withIndex("by_status", (q) => q.eq("status", "pending_review"))
        .take(100),
      ctx.db
        .query("diagnosticTreatments")
        .withIndex("by_status", (q) => q.eq("status", "pending_review"))
        .take(100),
    ]);

    const conditionNames = new Map<string, string>();
    for (const c of conditions) conditionNames.set(String(c._id), c.name);
    for (const row of [...images, ...treatments]) {
      const key = String(row.conditionId);
      if (!conditionNames.has(key)) {
        const c = await ctx.db.get(row.conditionId);
        conditionNames.set(key, c?.name ?? "Unknown");
      }
    }
    const names = await describeActors(
      ctx,
      [...conditions, ...images, ...treatments].map((r) => r.addedBy),
      [...conditions, ...images, ...treatments]
        .map((r) => r.addedByCommunityId)
        .filter((id): id is Id<"communities"> => !!id)
    );

    const rows = [
      ...conditions.map((c) => ({ itemType: "condition" as const, row: c, conditionId: c._id, summary: c.name })),
      ...images.map((i) => ({ itemType: "image" as const, row: i, conditionId: i.conditionId, summary: i.caption || "Photo" })),
      ...treatments.map((t) => ({ itemType: "treatment" as const, row: t, conditionId: t.conditionId, summary: t.text })),
    ];
    return rows
      .sort((a, b) => a.row.addedAt - b.row.addedAt)
      .map(({ itemType, row, conditionId, summary }) => ({
        itemType,
        itemId: String(row._id),
        conditionId,
        conditionName: conditionNames.get(String(conditionId)) ?? "Unknown",
        summary: summary.slice(0, 160),
        addedAt: row.addedAt,
        addedByName: names.userName(row.addedBy),
        addedByCommunityName: names.communityName(row.addedByCommunityId),
        canReview: canReview(access, { status: row.status, addedBy: String(row.addedBy) }).ok,
      }));
  },
});

export const listOpenFlags = query({
  args: { adminId: v.id("users"), communityId: v.optional(v.id("communities")) },
  handler: async (ctx, args) => {
    await requireLibraryAccess(ctx, args.adminId, args.communityId);
    const flags = await ctx.db
      .query("diagnosticFlags")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .take(100);
    const names = await describeActors(
      ctx,
      flags.map((f) => f.flaggedBy),
      flags.map((f) => f.flaggedByCommunityId).filter((id): id is Id<"communities"> => !!id)
    );
    const conditionNames = new Map<string, string>();
    for (const f of flags) {
      const key = String(f.conditionId);
      if (!conditionNames.has(key)) conditionNames.set(key, (await ctx.db.get(f.conditionId))?.name ?? "Unknown");
    }
    return flags.map((f) => ({
      ...f,
      conditionName: conditionNames.get(String(f.conditionId)),
      flaggedByName: names.userName(f.flaggedBy),
      flaggedByCommunityName: names.communityName(f.flaggedByCommunityId),
    }));
  },
});

export const listAuditLog = query({
  args: {
    adminId: v.id("users"),
    communityId: v.optional(v.id("communities")),
    conditionId: v.optional(v.id("diagnosticConditions")),
  },
  handler: async (ctx, args) => {
    await requireLibraryAccess(ctx, args.adminId, args.communityId);
    const conditionId = args.conditionId;
    const rows = conditionId
      ? await ctx.db
          .query("diagnosticAuditLog")
          .withIndex("by_condition", (q) => q.eq("conditionId", conditionId))
          .order("desc")
          .take(50)
      : await ctx.db.query("diagnosticAuditLog").withIndex("by_at").order("desc").take(50);
    const names = await describeActors(
      ctx,
      rows.map((r) => r.actorId),
      rows.map((r) => r.actorCommunityId).filter((id): id is Id<"communities"> => !!id)
    );
    return rows.map((r) => ({
      ...r,
      actorName: names.userName(r.actorId),
      actorCommunityName: names.communityName(r.actorCommunityId),
    }));
  },
});

// ─── Contributions ──────────────────────────────────────────────────────────

export const addCondition = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.optional(v.id("communities")),
    name: v.string(),
    scientificName: v.optional(v.string()),
    kind: v.union(v.literal("pest"), v.literal("disease"), v.literal("deficiency"), v.literal("other")),
    hosts: v.array(v.string()),
    symptoms: v.string(),
    symptomTags: v.optional(v.array(v.string())),
    sourceName: v.string(),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireLibraryAccess(ctx, args.adminId, args.communityId);
    const symptomTags = cleanSymptomTags(args.symptomTags ?? []);
    const hosts = Array.from(new Set(args.hosts));
    if (hosts.length === 0) throw new Error("Pick at least one crop");
    if (!hosts.every(isValidHost)) throw new Error("Unknown crop");

    const conditionId = await ctx.db.insert("diagnosticConditions", {
      name: requireText(args.name, "Name", 120),
      scientificName: optionalText(args.scientificName, 120),
      kind: args.kind,
      hosts,
      symptoms: requireText(args.symptoms, "Symptoms"),
      symptomTags,
      sourceName: requireText(args.sourceName, "Source", 200),
      sourceUrl: normalizeSourceUrl(args.sourceUrl),
      ...contributionFields(access),
    });
    await log(ctx, access, { action: "added", itemType: "condition", itemId: String(conditionId), conditionId });
    return conditionId;
  },
});

export const addImage = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.optional(v.id("communities")),
    conditionId: v.id("diagnosticConditions"),
    storageId: v.id("_storage"),
    thumbStorageId: v.optional(v.id("_storage")),
    caption: v.optional(v.string()),
    sourceName: v.string(),
    sourceUrl: v.optional(v.string()),
    licence: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireLibraryAccess(ctx, args.adminId, args.communityId);
    const condition = await ctx.db.get(args.conditionId);
    if (!condition || condition.status === "removed" || condition.status === "rejected") {
      throw new Error("This pest/disease is no longer in the library");
    }
    for (const id of [args.storageId, args.thumbStorageId]) {
      if (!id) continue;
      const file = await ctx.db.system.get(id);
      if (!file) throw new Error("Photo upload not found");
      if (!(file.contentType ?? "").startsWith("image/")) throw new Error("Only photos can be added");
      if (file.size > MAX_DIAGNOSTIC_IMAGE_BYTES) throw new Error("Photo is too large");
    }

    const imageId = await ctx.db.insert("diagnosticImages", {
      conditionId: args.conditionId,
      storageId: args.storageId,
      thumbStorageId: args.thumbStorageId,
      caption: optionalText(args.caption, 200),
      sourceName: requireText(args.sourceName, "Source", 200),
      sourceUrl: normalizeSourceUrl(args.sourceUrl),
      licence: requireText(args.licence, "Licence", 100),
      ...contributionFields(access),
    });
    await log(ctx, access, { action: "added", itemType: "image", itemId: String(imageId), conditionId: args.conditionId });
    return imageId;
  },
});

export const addTreatment = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.optional(v.id("communities")),
    conditionId: v.id("diagnosticConditions"),
    kind: v.union(v.literal("cultural"), v.literal("organic"), v.literal("chemical")),
    text: v.string(),
    sourceName: v.string(),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireLibraryAccess(ctx, args.adminId, args.communityId);
    const condition = await ctx.db.get(args.conditionId);
    if (!condition || condition.status === "removed" || condition.status === "rejected") {
      throw new Error("This pest/disease is no longer in the library");
    }
    const treatmentId = await ctx.db.insert("diagnosticTreatments", {
      conditionId: args.conditionId,
      kind: args.kind,
      text: requireText(args.text, "Treatment", 1000),
      sourceName: requireText(args.sourceName, "Source", 200),
      sourceUrl: normalizeSourceUrl(args.sourceUrl),
      ...contributionFields(access),
    });
    await log(ctx, access, {
      action: "added",
      itemType: "treatment",
      itemId: String(treatmentId),
      conditionId: args.conditionId,
    });
    return treatmentId;
  },
});

// ─── Review, flags and removal ──────────────────────────────────────────────

export const reviewItem = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.optional(v.id("communities")),
    itemType: itemTypeValidator,
    itemId: v.string(),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireLibraryAccess(ctx, args.adminId, args.communityId);
    const item = await getItem(ctx, args.itemType, args.itemId);
    const check = canReview(access, { status: item.status, addedBy: String(item.addedBy) });
    if (!check.ok) throw new Error(check.reason);

    const note = optionalText(args.note);
    await ctx.db.patch(item._id, {
      status: args.decision === "approve" ? "active" : "rejected",
      reviewedBy: access.admin._id,
      reviewedAt: getUgandaTime(),
      reviewNote: note,
    });
    await log(ctx, access, {
      action: args.decision === "approve" ? "approved" : "rejected",
      itemType: args.itemType,
      itemId: args.itemId,
      conditionId: conditionIdOf(args.itemType, item),
      note,
    });
    return { success: true };
  },
});

export const flagItem = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.optional(v.id("communities")),
    itemType: itemTypeValidator,
    itemId: v.string(),
    reason: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireLibraryAccess(ctx, args.adminId, args.communityId);
    const item = await getItem(ctx, args.itemType, args.itemId);
    const check = canFlag(item);
    if (!check.ok) throw new Error(check.reason);

    const key = flagKey(access, access.communityId ? String(access.communityId) : undefined);
    const open = await ctx.db
      .query("diagnosticFlags")
      .withIndex("by_item_status", (q) => q.eq("itemId", args.itemId).eq("status", "open"))
      .take(50);
    if (open.some((f) => f.flagKey === key)) {
      throw new Error(access.isSuperAdmin ? "You already flagged this" : "Your community already flagged this");
    }

    const conditionId = conditionIdOf(args.itemType, item);
    const note = optionalText(args.note);
    await ctx.db.insert("diagnosticFlags", {
      itemType: args.itemType,
      itemId: args.itemId,
      conditionId,
      flagKey: key,
      reason: requireText(args.reason, "Reason", 40),
      note,
      flaggedBy: access.admin._id,
      flaggedByCommunityId: access.isSuperAdmin ? undefined : access.communityId,
      createdAt: getUgandaTime(),
      status: "open",
    });
    await ctx.db.patch(item._id, { openFlagCount: open.length + 1 });
    await log(ctx, access, {
      action: "flagged",
      itemType: args.itemType,
      itemId: args.itemId,
      conditionId,
      note: [args.reason, note].filter(Boolean).join(": "),
    });
    return { success: true };
  },
});

async function closeOpenFlags(
  ctx: MutationCtx,
  access: Access,
  itemId: string,
  status: "dismissed" | "actioned",
  note: string | undefined
) {
  const open = await ctx.db
    .query("diagnosticFlags")
    .withIndex("by_item_status", (q) => q.eq("itemId", itemId).eq("status", "open"))
    .take(50);
  for (const f of open) {
    await ctx.db.patch(f._id, {
      status,
      resolvedBy: access.admin._id,
      resolvedAt: getUgandaTime(),
      resolutionNote: note,
    });
  }
}

/** Super admin only: keep the entry and close every open flag on it. */
export const dismissFlags = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.optional(v.id("communities")),
    itemType: itemTypeValidator,
    itemId: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireLibraryAccess(ctx, args.adminId, args.communityId);
    if (!access.isSuperAdmin) throw new Error("Only a super admin can dismiss flags");
    const item = await getItem(ctx, args.itemType, args.itemId);
    const note = optionalText(args.note);
    await closeOpenFlags(ctx, access, args.itemId, "dismissed", note);
    await ctx.db.patch(item._id, { openFlagCount: 0 });
    await log(ctx, access, {
      action: "flag_dismissed",
      itemType: args.itemType,
      itemId: args.itemId,
      conditionId: conditionIdOf(args.itemType, item),
      note,
    });
    return { success: true };
  },
});

/** Super admin only. Removal is a status change; nothing is hard-deleted. */
export const removeItem = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.optional(v.id("communities")),
    itemType: itemTypeValidator,
    itemId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireLibraryAccess(ctx, args.adminId, args.communityId);
    const item = await getItem(ctx, args.itemType, args.itemId);
    const check = canRemove(access, item);
    if (!check.ok) throw new Error(check.reason);

    const reason = requireText(args.reason, "Reason", 500);
    await ctx.db.patch(item._id, {
      status: "removed",
      removedBy: access.admin._id,
      removedAt: getUgandaTime(),
      removalReason: reason,
      openFlagCount: 0,
    });
    await closeOpenFlags(ctx, access, args.itemId, "actioned", reason);
    await log(ctx, access, {
      action: "removed",
      itemType: args.itemType,
      itemId: args.itemId,
      conditionId: conditionIdOf(args.itemType, item),
      note: reason,
    });
    return { success: true };
  },
});

/** Super admin only: undo a removal. The entry goes back through review. */
export const restoreItem = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.optional(v.id("communities")),
    itemType: itemTypeValidator,
    itemId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireLibraryAccess(ctx, args.adminId, args.communityId);
    if (!access.isSuperAdmin) throw new Error("Only a super admin can restore entries");
    const item = await getItem(ctx, args.itemType, args.itemId);
    if (item.status !== "removed") throw new Error("This entry is not removed");
    await ctx.db.patch(item._id, { status: "pending_review" });
    await log(ctx, access, {
      action: "restored",
      itemType: args.itemType,
      itemId: args.itemId,
      conditionId: conditionIdOf(args.itemType, item),
    });
    return { success: true };
  },
});

/**
 * Set the symptoms the farmer check matches an entry on. A super admin can do
 * this at any time (entries added before tags existed need it); a community
 * admin only while the entry is still waiting for review, after which they
 * flag it instead. Every change is logged with the old and new lists.
 */
export const setSymptomTags = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.optional(v.id("communities")),
    conditionId: v.id("diagnosticConditions"),
    symptomTags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireLibraryAccess(ctx, args.adminId, args.communityId);
    const condition = await ctx.db.get(args.conditionId);
    if (!condition || condition.status === "removed" || condition.status === "rejected") {
      throw new Error("This pest/disease is no longer in the library");
    }
    if (!access.isSuperAdmin && condition.status !== "pending_review") {
      throw new Error("Approved entries can only be changed by a super admin. Flag it instead.");
    }
    const symptomTags = cleanSymptomTags(args.symptomTags);
    await ctx.db.patch(args.conditionId, { symptomTags });
    await log(ctx, access, {
      action: "symptoms_changed",
      itemType: "condition",
      itemId: String(args.conditionId),
      conditionId: args.conditionId,
      note: `${(condition.symptomTags ?? []).join(", ") || "none"} → ${symptomTags.join(", ") || "none"}`,
    });
    return { success: true };
  },
});

/**
 * Farmer crop checks in one community: counts for the chosen period and the
 * latest checks. A community admin only reaches their own community through
 * requireLibraryAccess; a super admin sees whichever community they open.
 */
export const listCommunityChecks = query({
  args: {
    adminId: v.id("users"),
    communityId: v.id("communities"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireLibraryAccess(ctx, args.adminId, args.communityId);
    const days = Math.min(Math.max(Math.round(args.days ?? 30), 1), 365);
    const since = getUgandaTime() - days * 24 * 60 * 60 * 1000;

    const reports = await ctx.db
      .query("diagnosticReports")
      .withIndex("by_community_saved", (q) => q.eq("communityId", args.communityId).gte("savedAt", since))
      .order("desc")
      .take(1000);

    const conditionNames = new Map<string, string>();
    const nameOf = async (id: Id<"diagnosticConditions">) => {
      const key = String(id);
      if (!conditionNames.has(key)) conditionNames.set(key, (await ctx.db.get(id))?.name ?? "Unknown");
      return conditionNames.get(key)!;
    };

    const byLevel: Record<string, number> = { healthy: 0, possible: 0, likely: 0, unsure: 0 };
    const byHost: Record<string, number> = {};
    const feedback: Record<string, number> = { right: 0, wrong: 0, unsure: 0 };
    const problemCounts = new Map<string, number>();
    const farmers = new Set<string>();
    for (const r of reports) {
      byLevel[r.healthLevel] = (byLevel[r.healthLevel] ?? 0) + 1;
      byHost[r.host] = (byHost[r.host] ?? 0) + 1;
      if (r.feedback) feedback[r.feedback] = (feedback[r.feedback] ?? 0) + 1;
      farmers.add(String(r.farmerId));
      // Only count a problem when the check named one with some confidence.
      if ((r.healthLevel === "likely" || r.healthLevel === "possible") && r.results[0]) {
        const key = String(r.results[0].conditionId);
        problemCounts.set(key, (problemCounts.get(key) ?? 0) + 1);
      }
    }
    const topProblems = await Promise.all(
      Array.from(problemCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(async ([id, count]) => ({ name: await nameOf(id as Id<"diagnosticConditions">), count }))
    );

    const latest = await Promise.all(
      reports.slice(0, 20).map(async (r) => {
        const farmer = (await ctx.db.get(r.farmerId)) as any;
        return {
          _id: r._id,
          farmerName: farmer?.verifiedName || farmer?.alias || "Farmer",
          host: r.host,
          healthLevel: r.healthLevel,
          symptomTags: r.symptomTags,
          topMatch: r.results[0]
            ? { name: await nameOf(r.results[0].conditionId), percent: r.results[0].percent }
            : null,
          feedback: r.feedback,
          ai:
            r.aiStatus === "done" && r.aiResults?.[0]
              ? { name: await nameOf(r.aiResults[0].conditionId), percent: r.aiResults[0].percent, note: r.aiNote }
              : r.aiStatus === "done" && r.aiPhotoUsable === false
                ? { name: null, percent: 0, note: r.aiNote }
                : null,
          checkedAt: r.checkedAt,
          photoUrl: r.photoStorageId ? await ctx.storage.getUrl(r.photoStorageId) : null,
        };
      })
    );

    return {
      days,
      total: reports.length,
      capped: reports.length >= 1000,
      farmerCount: farmers.size,
      byLevel,
      byHost,
      feedback,
      topProblems,
      latest,
    };
  },
});
