/**
 * Community module feature flags.
 *
 * Optional modules ("Advanced Markets", "Fertilizer") are hidden from a
 * community dashboard unless a super admin has switched them on for that
 * community. The stored fields are optional so existing community documents
 * keep working untouched; these helpers resolve the stored value (or its
 * default) into a plain boolean so every surface gates the same way.
 */

const BIOFARM_COMMUNITY_ID = "ms72de3njrrc9k43cf9h3yq70181ncp0";

export type CommunityModule = "advancedMarkets" | "fertilizer" | "costTemplates" | "activeFarms" | "diagnostics" | "exportMarkets";

type CommunityLike = {
  _id?: unknown;
  id?: unknown;
  name?: string;
  advancedMarketsEnabled?: boolean;
  fertilizerEnabled?: boolean;
  costTemplatesEnabled?: boolean;
  activeFarmsEnabled?: boolean;
  diagnosticsEnabled?: boolean;
  exportMarketsEnabled?: boolean;
};

/**
 * "Bio Farm", "Bio-Farm" and "BIOFARM" are one community written three ways.
 *
 * Comparing the text as typed missed the real registration, "BIO-FARM PURELY
 * ORGANIC FERTILIZER", on its hyphen. Every check for this community now goes
 * through the same keyword test: case, spaces and punctuation are dropped and
 * what remains has to begin with "biofarm".
 */
export function isBioFarmName(value: string | undefined | null): boolean {
  return normalizeCommunityKey(value).startsWith("biofarm");
}

export function normalizeCommunityKey(value: string | undefined | null): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Bio Farm is the only community that had Advanced Markets in active use
 * before these flags existed, so it stays switched on by default. Matching on
 * the name as well as the id keeps that true on deployments where the
 * community document has a different id.
 */
export function isBioFarmCommunity(community: CommunityLike): boolean {
  const id = String(community?._id ?? community?.id ?? "");
  if (id === BIOFARM_COMMUNITY_ID) return true;
  return isBioFarmName(community?.name);
}

/**
 * The mandatory Bio Farm coffee tagging form, under any of the names it has
 * carried: "Bio Farm Coffee Tag", the older "Bio Farm Coffee Tree Tag Form"
 * and "Default Bio Farm Coffee Tree Tag Form", and any of those written with
 * a hyphen or different casing.
 */
export function isBioFarmCoffeeTagName(templateName: string | undefined | null): boolean {
  const key = normalizeCommunityKey(templateName);
  return key.includes("biofarm") && key.includes("coffee") && key.includes("tag");
}

export function isAdvancedMarketsEnabled(community: CommunityLike | null | undefined): boolean {
  if (!community) return false;
  if (typeof community.advancedMarketsEnabled === "boolean") {
    return community.advancedMarketsEnabled;
  }
  return isBioFarmCommunity(community);
}

export function isFertilizerModuleEnabled(community: CommunityLike | null | undefined): boolean {
  if (!community) return false;
  // Off everywhere until a super admin turns it on for a specific community.
  return community.fertilizerEnabled === true;
}

export function isCostTemplatesEnabled(community: CommunityLike | null | undefined): boolean {
  if (!community) return false;
  // Off everywhere until a super admin turns it on for a specific community.
  return community.costTemplatesEnabled === true;
}

/**
 * Active Farms - the list of a community's members who have logged Farm Record
 * Book entries, with their submission counts and latest photos.
 *
 * It was readable only by Bio Farm, not because the data is theirs but because
 * their community id was compared against a literal in every function that
 * served it. Nothing in that data path is specific to one community: it reads
 * the community's own approved members and the entries those members logged.
 * The flag follows Advanced Markets - Bio Farm keeps it by default so their
 * dashboard is unchanged, and any other community gets it when a super admin
 * switches it on.
 */
export function isActiveFarmsEnabled(community: CommunityLike | null | undefined): boolean {
  if (!community) return false;
  if (typeof community.activeFarmsEnabled === "boolean") {
    return community.activeFarmsEnabled;
  }
  return isBioFarmCommunity(community);
}

/**
 * Diagnostics - the shared pest & disease library. Off everywhere until a
 * super admin turns it on for a specific community.
 */
export function isDiagnosticsEnabled(community: CommunityLike | null | undefined): boolean {
  if (!community) return false;
  return community.diagnosticsEnabled === true;
}

/**
 * Export Markets - marks an exporter community. Its verified-trader members
 * get the exporter module. Off everywhere until a super admin turns it on.
 */
export function isExportMarketsEnabled(community: CommunityLike | null | undefined): boolean {
  if (!community) return false;
  return community.exportMarketsEnabled === true;
}

export function resolveCommunityModules(community: CommunityLike | null | undefined) {
  return {
    advancedMarketsEnabled: isAdvancedMarketsEnabled(community),
    fertilizerEnabled: isFertilizerModuleEnabled(community),
    costTemplatesEnabled: isCostTemplatesEnabled(community),
    activeFarmsEnabled: isActiveFarmsEnabled(community),
    diagnosticsEnabled: isDiagnosticsEnabled(community),
    exportMarketsEnabled: isExportMarketsEnabled(community),
  };
}
