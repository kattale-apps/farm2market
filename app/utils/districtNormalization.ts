/**
 * District name normalisation for community insights.
 *
 * Members carry a free-text `districtText`, so one real district arrives under
 * many spellings: "MUBENDE", "Mubende", "Mubbende", "MUBENDE T/C",
 * "MASAKA-NYENDO". Counting those as separate districts badly overstates a
 * community's geographic reach, so the charts fold them back onto the
 * canonical district list before counting.
 *
 * This only ever changes what is DISPLAYED. Member records keep whatever was
 * typed, and anything this cannot confidently resolve is reported as
 * unrecognised rather than guessed at.
 *
 * The safety rule that matters: several real Ugandan districts are one or two
 * letters apart — Kalungu/Kanungu differ by one character, as do Buyende and
 * Mubende by two. So a near match is accepted only when it is UNAMBIGUOUS:
 * the runner-up must be clearly further away. A typo sitting between two real
 * districts is flagged for a human instead of being silently assigned.
 */

export type DistrictMatchMethod =
  /** Matched a canonical district exactly (after case/punctuation folding). */
  | "exact"
  /** A subcounty or lower place name, resolved to its parent district. */
  | "place"
  /** Resolved a misspelling to a single clearly-closest district. */
  | "spelling"
  /** Pulled a district out of a compound value such as "MASAKA-NYENDO". */
  | "compound"
  /** Could not be resolved confidently — reported, never guessed. */
  | "unrecognised";

/** A subcounty (or other sub-district place) and the district it belongs to. */
export type PlaceInDistrict = { name: string; district: string };

export type DistrictMatch = {
  /** The value exactly as stored on the member record. */
  raw: string;
  /** Canonical district name, or null when unrecognised. */
  canonical: string | null;
  method: DistrictMatchMethod;
};

/** Administrative suffixes that qualify a district rather than name a new one. */
const ADMIN_SUFFIXES = [
  "TOWN COUNCIL",
  "TOWN BOARD",
  "MUNICIPAL COUNCIL",
  "MUNICIPALITY",
  "MUNICIPAL",
  "DISTRICT",
  "COUNCIL",
  "CITY",
  "TOWN",
  "DLG",
  "MC",
  "TC",
  "T C",
  "S C",
  "SC",
];

/** Upper-cases, strips accents, and reduces punctuation to single spaces. */
export function foldDistrictText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Drops a trailing administrative qualifier, e.g. "MUBENDE T C" -> "MUBENDE". */
function stripAdminSuffix(folded: string): string {
  for (const suffix of ADMIN_SUFFIXES) {
    if (folded.endsWith(` ${suffix}`)) {
      return folded.slice(0, -(suffix.length + 1)).trim();
    }
  }
  return folded;
}

/** Levenshtein distance, abandoned early once it exceeds `cap`. */
export function levenshtein(a: string, b: string, cap = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    let rowBest = current[0];
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
      if (current[j] < rowBest) rowBest = current[j];
    }
    if (rowBest > cap) return cap + 1;
    const swap = previous;
    previous = current;
    current = swap;
  }

  return previous[b.length];
}

/**
 * How far a spelling may stray before we stop trusting it. Short names get no
 * leeway at all — at four characters almost everything is "close" to
 * everything else.
 */
function maxEditsFor(length: number): number {
  if (length <= 4) return 0;
  if (length <= 6) return 1;
  return 2;
}

/**
 * The runner-up must be at least this much further away than the winner for a
 * fuzzy match to count as unambiguous. Two keeps Kalungu and Kanungu (distance
 * 1 apart) from ever absorbing each other's typos.
 */
const AMBIGUITY_MARGIN = 2;

type Candidate = { name: string; distance: number };

function closestCanonical(
  folded: string,
  canonicalByFolded: Map<string, string>
): string | null {
  const limit = maxEditsFor(folded.length);
  if (limit === 0) return null;

  let best: Candidate | null = null;
  let runnerUp: Candidate | null = null;

  canonicalByFolded.forEach((canonical, candidateFolded) => {
    const distance = levenshtein(folded, candidateFolded, limit + AMBIGUITY_MARGIN);
    if (!best || distance < best.distance) {
      runnerUp = best;
      best = { name: canonical, distance };
    } else if (!runnerUp || distance < runnerUp.distance) {
      runnerUp = { name: canonical, distance };
    }
  });

  if (!best) return null;
  const winner = best as Candidate;
  if (winner.distance === 0 || winner.distance > limit) return null;

  const second = runnerUp as Candidate | null;
  if (second && second.distance < winner.distance + AMBIGUITY_MARGIN) return null;

  return winner.name;
}

/**
 * Builds a matcher bound to the canonical district list and, when available,
 * the subcounty hierarchy (both normally come from the app's own `districts`
 * and `subcounties` tables).
 *
 * Supplying the hierarchy matters for accuracy, not just coverage. Plenty of
 * subcounty names sit within two edits of an unrelated district — Namayumba
 * in Wakiso is two edits from the district of Namutumba, hundreds of
 * kilometres away. Looking such a value up in the hierarchy FIRST resolves it
 * correctly and stops it ever reaching the fuzzy matcher, which would
 * otherwise file those members under the wrong district with full confidence.
 *
 * Results are memoised because a community can hold thousands of members
 * repeating a few hundred spellings.
 */
export function buildDistrictMatcher(
  canonicalNames: string[],
  places: PlaceInDistrict[] = []
) {
  const canonicalByFolded = new Map<string, string>();
  for (const name of canonicalNames) {
    const folded = foldDistrictText(name);
    if (folded) canonicalByFolded.set(folded, String(name).trim());
  }

  // A place name that occurs in more than one district cannot identify one, so
  // it is dropped rather than resolved arbitrarily.
  const districtByPlace = new Map<string, string | null>();
  for (const place of places) {
    const folded = stripAdminSuffix(foldDistrictText(place.name));
    if (!folded || canonicalByFolded.has(folded)) continue;
    const district = String(place.district || "").trim();
    if (!district) continue;
    if (districtByPlace.has(folded)) {
      if (districtByPlace.get(folded) !== district) districtByPlace.set(folded, null);
    } else {
      districtByPlace.set(folded, district);
    }
  }

  const cache = new Map<string, DistrictMatch>();

  return function matchDistrict(raw: unknown): DistrictMatch {
    const rawText = String(raw ?? "").trim();
    const cached = cache.get(rawText);
    if (cached) return cached;

    const result = resolve(rawText);
    cache.set(rawText, result);
    return result;
  };

  function resolve(rawText: string): DistrictMatch {
    const unresolved: DistrictMatch = { raw: rawText, canonical: null, method: "unrecognised" };
    const folded = foldDistrictText(rawText);
    if (!folded) return unresolved;

    // Without a canonical list to check against, case folding is all we can
    // honestly do — treat the folded value as canonical so at least
    // "MUBENDE" and "Mubende" stop counting twice.
    if (canonicalByFolded.size === 0) {
      return { raw: rawText, canonical: titleCase(folded), method: "exact" };
    }

    const base = stripAdminSuffix(folded);

    // 1. The value already names a district.
    const exact = canonicalByFolded.get(base);
    if (exact) return { raw: rawText, canonical: exact, method: "exact" };

    // 2. The value names a subcounty or similar. This is authoritative, so it
    //    runs before any guessing.
    const place = districtByPlace.get(base);
    if (place) return { raw: rawText, canonical: place, method: "place" };

    // 3. A compound like "MASAKA NYENDO" or "KIKUUYU MITYANA" pairs a district
    //    with a lower-level place. Accept it only when exactly one distinct
    //    district is named, so "LIRA MBALE" stays a question for a human.
    const tokens = base.split(" ").filter((t) => t.length > 2);
    const tokenHits = new Set<string>();
    for (const token of tokens) {
      const hit = canonicalByFolded.get(token);
      if (hit) tokenHits.add(hit);
    }
    if (tokenHits.size > 1) return unresolved;
    if (tokenHits.size === 1) {
      return { raw: rawText, canonical: [...tokenHits][0], method: "compound" };
    }

    // 4. The same, for a subcounty named inside a compound value.
    const placeHits = new Set<string>();
    for (const token of tokens) {
      const hit = districtByPlace.get(token);
      if (hit) placeHits.add(hit);
    }
    if (placeHits.size === 1) {
      return { raw: rawText, canonical: [...placeHits][0], method: "place" };
    }
    if (placeHits.size > 1) return unresolved;

    // 5. Only now, a misspelt district name. Deliberately whole-string only:
    //    matching a single token of a compound against the district list turns
    //    village names into confident nonsense (KISOSSO/KYABAKUZA scoring as
    //    "Kisoro" because one fragment lands two edits away).
    const corrected = closestCanonical(base, canonicalByFolded);
    if (corrected) return { raw: rawText, canonical: corrected, method: "spelling" };

    return unresolved;
  }
}

function titleCase(folded: string): string {
  return folded
    .split(" ")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

export type DistrictTally = {
  /** Counts per canonical district, highest first. */
  districts: Array<{ name: string; value: number }>;
  /** Distinct canonical districts with at least one member. */
  distinctDistricts: number;
  /**
   * Values folded into a canonical district by anything other than an exact
   * match, so an admin can audit what was assumed.
   */
  corrections: Array<{ raw: string; canonical: string; method: DistrictMatchMethod; value: number }>;
  /** Values that could not be resolved, highest count first. */
  unrecognised: Array<{ raw: string; value: number }>;
  /** Members whose district could not be resolved. */
  unrecognisedMembers: number;
  /** Distinct raw spellings seen, for the "358 became 42" message. */
  rawSpellings: number;
};

/**
 * Tallies members by canonical district and reports everything it had to
 * assume, so the UI can show the count and the caveat side by side.
 */
export function tallyDistricts(
  rawValues: Array<string | null | undefined>,
  canonicalNames: string[],
  places: PlaceInDistrict[] = []
): DistrictTally {
  const matchDistrict = buildDistrictMatcher(canonicalNames, places);

  const counts = new Map<string, number>();
  const unresolvedCounts = new Map<string, number>();
  const correctionCounts = new Map<string, { raw: string; canonical: string; method: DistrictMatchMethod; value: number }>();
  const rawSeen = new Set<string>();
  let unrecognisedMembers = 0;

  for (const raw of rawValues) {
    const text = String(raw ?? "").trim();
    if (text) rawSeen.add(text);

    const match = matchDistrict(text);
    if (!match.canonical) {
      unrecognisedMembers += 1;
      const key = text || "(blank)";
      unresolvedCounts.set(key, (unresolvedCounts.get(key) || 0) + 1);
      continue;
    }

    counts.set(match.canonical, (counts.get(match.canonical) || 0) + 1);

    if (match.method !== "exact") {
      const key = `${text}→${match.canonical}`;
      const existing = correctionCounts.get(key);
      if (existing) {
        existing.value += 1;
      } else {
        correctionCounts.set(key, { raw: text, canonical: match.canonical, method: match.method, value: 1 });
      }
    }
  }

  const districts = [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  return {
    districts,
    distinctDistricts: districts.length,
    corrections: [...correctionCounts.values()].sort((a, b) => b.value - a.value),
    unrecognised: [...unresolvedCounts.entries()]
      .map(([raw, value]) => ({ raw, value }))
      .sort((a, b) => b.value - a.value),
    unrecognisedMembers,
    rawSpellings: rawSeen.size,
  };
}
