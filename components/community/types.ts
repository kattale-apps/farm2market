import { CommunityCardData, SupplyChainRole } from "@/types/communityQr";

export interface CommunityCardProps {
  community: CommunityCardData;
  onOpen: (id: string) => void;
}

export interface NoticeboardProps {
  communityId: string;
  freeQuota: number;
}

export interface CommunityMessengerProps {
  communityId: string;
  userId: string;
}

export interface ProfileRoleSelectorProps {
  roles: SupplyChainRole[];
  currentRole?: string;
  onSave: (role: string, other?: string) => void;
}