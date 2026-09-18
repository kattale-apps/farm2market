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

export type CommunityModule = "advancedMarkets" | "fertilizer" | "costTemplates";

type CommunityLike = {
  _id?: unknown;
  id?: unknown;
  name?: string;
  advancedMarketsEnabled?: boolean;
  fertilizerEnabled?: boolean;
  costTemplatesEnabled?: boolean;
};

/**
 * Bio Farm is the only community that had Advanced Markets in active use
 * before these flags existed, so it stays switched on by default. Matching on
 * the name as well as the id keeps that true on deployments where the
 * community document has a different id.
 */
function isBioFarmCommunity(community: CommunityLike): boolean {
  const id = String(community?._id ?? community?.id ?? "");
  if (id === BIOFARM_COMMUNITY_ID) return true;
  return String(community?.name ?? "").trim().toLowerCase().startsWith("bio farm");
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

export function resolveCommunityModules(community: CommunityLike | null | undefined) {
  return {
    advancedMarketsEnabled: isAdvancedMarketsEnabled(community),
    fertilizerEnabled: isFertilizerModuleEnabled(community),
    costTemplatesEnabled: isCostTemplatesEnabled(community),
  };
}
