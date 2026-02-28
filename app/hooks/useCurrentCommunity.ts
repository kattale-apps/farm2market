"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

/**
 * Fetches community data from the database.
 * This is the single source of truth for community information including logos.
 * 
 * @param communityId - The ID of the community to fetch. If not provided, returns null.
 * @returns Community data with logo URL, or null if not found
 */
export function useCurrentCommunity(communityId: Id<"communities"> | null | undefined) {
  const community = useQuery(
    api.communities.getCommunityById,
    communityId ? { communityId } : "skip"
  );

  // Return null safely if not found or not authenticated
  if (!community || community === null) {
    return null;
  }

  return {
    communityId: community._id,
    name: community.name,
    logoUrl: community.qrLogoUrl || community.logoPath || null,
    description: community.description || undefined,
    qrSlug: community.qrSlug,
  };
}
