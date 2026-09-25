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

export type HostGroup = "crop" | "livestock";

/**
 * Crops and animals the library covers. More can be added here without a
 * schema change because hosts are stored as plain text. Keys are stored, so
 * never rename one.
 */
export const DIAGNOSTIC_HOSTS = [
  { key: "maize", label: "Maize", emoji: "🌽", group: "crop" },
  { key: "cassava", label: "Cassava", emoji: "🌿", group: "crop" },
  { key: "banana", label: "Banana", emoji: "🍌", group: "crop" },
  { key: "coffee", label: "Coffee", emoji: "☕", group: "crop" },
  { key: "beans", label: "Beans", emoji: "🫘", group: "crop" },
  { key: "cattle", label: "Cattle", emoji: "🐄", group: "livestock" },
  { key: "goats", label: "Goats", emoji: "🐐", group: "livestock" },
  { key: "sheep", label: "Sheep", emoji: "🐑", group: "livestock" },
  { key: "pigs", label: "Pigs", emoji: "🐖", group: "livestock" },
  { key: "chickens", label: "Chickens", emoji: "🐔", group: "livestock" },
] as const;

export const DIAGNOSTIC_HOST_KEYS: string[] = DIAGNOSTIC_HOSTS.map((h) => h.key);

export function hostsInGroup(group: HostGroup) {
  return DIAGNOSTIC_HOSTS.filter((h) => h.group === group);
}

export function hostGroup(key: string): HostGroup | undefined {
  return DIAGNOSTIC_HOSTS.find((h) => h.key === key)?.group;
}

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

// ─── Farmer check (free, symptom based) ─────────────────────────────────────

/**
 * Picture-first symptom list. Admins tag each pest/disease with the symptoms
 * it causes; a farmer taps what they see; the phone ranks the library by how
 * well the two lists overlap. This works offline and costs nothing to run.
 * Keys are stored, so never rename one - add a new key instead.
 */
export const SYMPTOMS = [
  { key: "leaf_yellow", label: "Yellow leaves", emoji: "🟡", group: "crop" },
  { key: "leaf_spots", label: "Spots on leaves", emoji: "🟤", group: "crop" },
  { key: "leaf_holes", label: "Holes in leaves", emoji: "🕳️", group: "crop" },
  { key: "leaf_curl", label: "Curled leaves", emoji: "🌀", group: "crop" },
  { key: "leaf_mosaic", label: "Patchy light & dark leaves", emoji: "🧩", group: "crop" },
  { key: "leaf_streaks", label: "Lines or streaks on leaves", emoji: "〰️", group: "crop" },
  { key: "white_powder", label: "White powder or mould", emoji: "⚪", group: "crop" },
  { key: "dry_leaves", label: "Dry or burnt leaves", emoji: "🍂", group: "crop" },
  { key: "wilting", label: "Plant drooping / wilting", emoji: "🥀", group: "crop" },
  { key: "stunted", label: "Plant small / not growing", emoji: "📏", group: "crop" },
  { key: "stem_damage", label: "Stem damaged or rotting", emoji: "🪵", group: "crop" },
  { key: "root_rot", label: "Roots or tubers rotting", emoji: "🟫", group: "crop" },
  { key: "fruit_damage", label: "Cobs, fruit or pods damaged", emoji: "🌽", group: "crop" },
  { key: "insects_seen", label: "Insects or worms seen", emoji: "🐛", group: "crop" },
  // Added for nutrient deficiencies.
  { key: "leaf_pale", label: "Pale, light green leaves", emoji: "🟩", group: "crop" },
  { key: "veins_green", label: "Yellow leaf with green veins", emoji: "🥬", group: "crop" },
  { key: "leaf_purple", label: "Purple, bronze or very dark leaves", emoji: "🟣", group: "crop" },
  { key: "edges_brown", label: "Brown, burnt leaf edges or tips", emoji: "🤎", group: "crop" },
  { key: "buds_dying", label: "Buds or new shoots dying", emoji: "🔻", group: "crop" },
  // Livestock (the "Check my animals" flow).
  { key: "not_eating", label: "Not eating", emoji: "🍽️", group: "livestock" },
  { key: "weak_lying", label: "Weak or lying down", emoji: "🛌", group: "livestock" },
  { key: "fever", label: "Hot body / fever", emoji: "🌡️", group: "livestock" },
  { key: "diarrhoea", label: "Diarrhoea", emoji: "💩", group: "livestock" },
  { key: "coughing", label: "Coughing or hard breathing", emoji: "😮‍💨", group: "livestock" },
  { key: "discharge", label: "Discharge from nose or eyes", emoji: "💧", group: "livestock" },
  { key: "skin_sores", label: "Sores, wounds or lumps on skin", emoji: "🩹", group: "livestock" },
  { key: "hair_feather_loss", label: "Hair or feathers falling out", emoji: "🪶", group: "livestock" },
  { key: "ticks_lice", label: "Ticks, lice or mites seen", emoji: "🕷️", group: "livestock" },
  { key: "limping", label: "Limping or swollen feet", emoji: "🦶", group: "livestock" },
  { key: "swelling", label: "Swelling on body or neck", emoji: "🔴", group: "livestock" },
  { key: "mouth_sores", label: "Mouth sores or drooling", emoji: "👄", group: "livestock" },
  { key: "less_milk_eggs", label: "Less milk or fewer eggs", emoji: "🥛", group: "livestock" },
  { key: "weight_loss", label: "Thin / losing weight", emoji: "📉", group: "livestock" },
  { key: "sudden_deaths", label: "Sudden deaths in herd or flock", emoji: "⚠️", group: "livestock" },
] as const;

export const SYMPTOM_KEYS: string[] = SYMPTOMS.map((s) => s.key);

export function symptomsInGroup(group: HostGroup) {
  return SYMPTOMS.filter((sym) => sym.group === group);
}

export function isValidSymptom(key: string): boolean {
  return SYMPTOM_KEYS.includes(key);
}

/** Farmer checks saved per person per Uganda day, to keep storage and writes light. */
export const DAILY_REPORT_LIMIT = 20;

/** Below this, the result says "Not sure - show your agent" instead of naming a match. */
export const CONFIDENT_MATCH_PERCENT = 35;
export const STRONG_MATCH_PERCENT = 60;

export type MatchCandidate = { id: string; symptomTags?: string[] };
export type MatchResult = { id: string; percent: number };
export type HealthLevel = "healthy" | "possible" | "likely" | "unsure";

/**
 * Overlap between what the farmer saw and what an entry causes, as a
 * percentage (the F1 score of the two tag lists). It is a match strength,
 * not a medical probability, and the screens say so.
 */
export function symptomMatchPercent(selected: string[], conditionTags: string[] | undefined): number {
  const tags = new Set(conditionTags ?? []);
  const picked = new Set(selected);
  if (tags.size === 0 || picked.size === 0) return 0;
  let shared = 0;
  picked.forEach((key) => {
    if (tags.has(key)) shared++;
  });
  if (shared === 0) return 0;
  const precision = shared / picked.size;
  const recall = shared / tags.size;
  return Math.round((200 * precision * recall) / (precision + recall));
}

/** Top matches, strongest first. Entries with no overlap are left out. */
export function rankMatches(candidates: MatchCandidate[], selected: string[], limit = 3): MatchResult[] {
  return candidates
    .map((c) => ({ id: c.id, percent: symptomMatchPercent(selected, c.symptomTags) }))
    .filter((r) => r.percent > 0)
    .sort((a, b) => b.percent - a.percent || a.id.localeCompare(b.id))
    .slice(0, limit);
}

/**
 * The scorecard colour. Tapping no symptoms means the farmer says the crop
 * looks fine. A weak best match is reported as "unsure" rather than guessing.
 */
export function healthLevel(selected: string[], results: MatchResult[]): HealthLevel {
  if (selected.length === 0) return "healthy";
  const best = results[0]?.percent ?? 0;
  if (best >= STRONG_MATCH_PERCENT) return "likely";
  if (best >= CONFIDENT_MATCH_PERCENT) return "possible";
  return "unsure";
}

// ─── Paid AI photo check (community opt-in) ────────────────────────────────

/** Default monthly AI photo checks per community until a super admin changes it. */
export const DEFAULT_AI_MONTHLY_CAP = 100;

/**
 * Scorecard colour for an AI photo check. A photo the model could not use is
 * "unsure" whatever it matched; otherwise the same thresholds as the symptom
 * check apply, and "healthy" needs the model to say so with no real match.
 */
export function aiHealthLevel(ai: { photoUsable: boolean; looksHealthy: boolean; matches: MatchResult[] }): HealthLevel {
  if (!ai.photoUsable) return "unsure";
  const best = ai.matches[0]?.percent ?? 0;
  if (best >= STRONG_MATCH_PERCENT) return "likely";
  if (best >= CONFIDENT_MATCH_PERCENT) return "possible";
  return ai.looksHealthy ? "healthy" : "unsure";
}

/**
 * Keep only matches the model was allowed to pick (library ids for this
 * crop), clamp the percentages, drop duplicates and rank them. The model can
 * never introduce a pest, disease or treatment that is not in the library.
 */
export function cleanAiMatches(raw: { id: string; percent: number }[], allowedIds: string[], limit = 3): MatchResult[] {
  const allowed = new Set(allowedIds);
  const seen = new Set<string>();
  const out: MatchResult[] = [];
  for (const m of raw) {
    if (!allowed.has(m.id) || seen.has(m.id)) continue;
    const percent = Math.max(0, Math.min(100, Math.round(Number(m.percent) || 0)));
    if (percent <= 0) continue;
    seen.add(m.id);
    out.push({ id: m.id, percent });
  }
  return out.sort((a, b) => b.percent - a.percent).slice(0, limit);
}

/** Uganda calendar month key ("2026-09") for a getUgandaTime() value. */
export function ugandaMonthKey(ugandaTime: number): string {
  const d = new Date(ugandaTime);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
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
