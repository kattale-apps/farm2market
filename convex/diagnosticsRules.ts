/**
 * Diagnostics library rules.
 *
 * The pest and disease library is shared by every community a super admin has
 * switched Diagnostics on for. Community admins in those communities can add
 * entries, review each other's entries and flag anything they think is wrong,
 * but only a super admin can remove something. Removal is a status change, so
 * the entry, its sources and its history stay on record.
 *
 * This file has no Convex server imports so the decisions below can be unit
 * tested and shared with the client.
 */

export type DiagnosticStatus = "pending_review" | "active" | "rejected" | "removed";
export type DiagnosticItemType = "condition" | "image" | "treatment";

/**
 * Crops the library starts with. Livestock comes later, and more crops can be
 * added here without a schema change because hosts are stored as plain text.
 */
export const DIAGNOSTIC_HOSTS = [
  { key: "maize", label: "Maize", emoji: "🌽" },
  { key: "cassava", label: "Cassava", emoji: "🌿" },
  { key: "banana", label: "Banana", emoji: "🍌" },
  { key: "coffee", label: "Coffee", emoji: "☕" },
  { key: "beans", label: "Beans", emoji: "🫘" },
] as const;

export const DIAGNOSTIC_HOST_KEYS: string[] = DIAGNOSTIC_HOSTS.map((h) => h.key);

export const FLAG_REASONS = [
  { key: "wrong_match", label: "Wrong pest/disease" },
  { key: "wrong_treatment", label: "Treatment does not work" },
  { key: "unsafe", label: "Unsafe advice" },
  { key: "poor_photo", label: "Poor or misleading photo" },
  { key: "duplicate", label: "Duplicate" },
  { key: "other", label: "Other" },
] as const;

/** Open flags from this many different communities mark an entry "being reviewed". */
export const UNDER_REVIEW_FLAG_THRESHOLD = 3;

/** Largest photo the library accepts. The client shrinks photos well below this. */
export const MAX_DIAGNOSTIC_IMAGE_BYTES = 600 * 1024;

export type DiagnosticActor = {
  isSuperAdmin: boolean;
  userId: string;
};

export function isValidHost(host: string): boolean {
  return DIAGNOSTIC_HOST_KEYS.includes(host);
}

/**
 * Anyone allowed into the library (a super admin, or a community admin of an
 * enabled community) can approve or reject pending entries. A community admin
 * cannot pass their own entry: a second person has to look at it before
 * farmers can see it. Super admins can, so they can seed the library.
 */
export function canReview(
  actor: DiagnosticActor,
  item: { status: DiagnosticStatus; addedBy: string }
): { ok: true } | { ok: false; reason: string } {
  if (item.status !== "pending_review") {
    return { ok: false, reason: "Only entries waiting for review can be approved or rejected" };
  }
  if (!actor.isSuperAdmin && item.addedBy === actor.userId) {
    return { ok: false, reason: "Another admin must review your own entry" };
  }
  return { ok: true };
}

/** Only super admins remove entries, and only entries that are not already removed. */
export function canRemove(
  actor: DiagnosticActor,
  item: { status: DiagnosticStatus }
): { ok: true } | { ok: false; reason: string } {
  if (!actor.isSuperAdmin) {
    return { ok: false, reason: "Only a super admin can remove library entries" };
  }
  if (item.status === "removed") {
    return { ok: false, reason: "This entry is already removed" };
  }
  return { ok: true };
}

export function canFlag(item: { status: DiagnosticStatus }): { ok: true } | { ok: false; reason: string } {
  if (item.status === "removed" || item.status === "rejected") {
    return { ok: false, reason: "This entry is no longer in the library" };
  }
  return { ok: true };
}

/**
 * Farmers only ever see an image or treatment when it and its pest/disease
 * entry have both been approved.
 */
export function isFarmerVisible(
  item: { status: DiagnosticStatus },
  condition: { status: DiagnosticStatus }
): boolean {
  return item.status === "active" && condition.status === "active";
}

export function isUnderReview(openFlagCount: number | undefined): boolean {
  return (openFlagCount ?? 0) >= UNDER_REVIEW_FLAG_THRESHOLD;
}

/**
 * One open flag per community per entry, so a single community cannot push an
 * entry into "being reviewed" on its own. Super admins flag as themselves.
 */
export function flagKey(actor: DiagnosticActor, communityId: string | undefined): string {
  return actor.isSuperAdmin || !communityId ? `user:${actor.userId}` : `community:${communityId}`;
}

/** Sources are shown to farmers, so only real web links are accepted. */
export function normalizeSourceUrl(url: string | undefined): string | undefined {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return undefined;
  if (!/^https?:\/\/[^\s]+$/i.test(trimmed)) {
    throw new Error("Source link must start with http:// or https://");
  }
  return trimmed;
}
