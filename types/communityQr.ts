export type AccountScope = "full" | "community_only";

export interface CommunityCardData {
  _id: string;
  name: string;
  logoUrl?: string;
}

export interface SupplyChainRole {
  roleKey: string;
  roleLabel: string;
}

export interface UsageEvent {
  communityId: string;
  userId: string;
  eventType:
    | "COMMUNITY_NOTICEBOARD_IMAGE_POST"
    | "COMMUNITY_MESSAGE_IMAGE";
  isBillable: boolean;
  createdAt: number;
}