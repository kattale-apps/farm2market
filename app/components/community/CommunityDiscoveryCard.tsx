"use client";

import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";

interface CommunityDiscoveryCardProps {
  community: {
    _id: Id<"communities">;
    name: string;
    description?: string;
    logoPath?: string;
    qrLogoUrl?: string;
    memberCount: number;
  };
  isMember: boolean;
  onJoin: (communityId: Id<"communities">) => Promise<void>;
  onOpen: (communityId: Id<"communities">) => void;
}

/**
 * Mobile-first community card for discovery
 * 2-column grid on mobile, expands on larger screens
 */
export function CommunityDiscoveryCard({
  community,
  isMember,
  onJoin,
  onOpen,
}: CommunityDiscoveryCardProps) {
  const [isJoining, setIsJoining] = useState(false);

  const handleAction = async () => {
    if (isMember) {
      onOpen(community._id);
    } else {
      setIsJoining(true);
      try {
        await onJoin(community._id);
      } finally {
        setIsJoining(false);
      }
    }
  };

  const logoUrl = community.qrLogoUrl || community.logoPath;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition p-3 flex flex-col h-full">
      {/* Logo */}
      <div className="flex justify-center mb-3">
        {logoUrl ? (
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br from-blue-100 to-gray-100">
            <img
              src={logoUrl}
              alt={community.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-100 to-gray-100 flex items-center justify-center text-2xl font-bold text-gray-400">
            {community.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 text-center mb-3">
        <h3 className="font-bold text-sm text-gray-900 mb-1 line-clamp-2">
          {community.name}
        </h3>
        {community.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-2">
            {community.description}
          </p>
        )}
        <p className="text-xs text-gray-400">
          {community.memberCount} {community.memberCount === 1 ? "member" : "members"}
        </p>
      </div>

      {/* Action Button */}
      <button
        onClick={handleAction}
        disabled={isJoining}
        className={`w-full py-2.5 rounded-lg font-medium text-sm transition min-h-[44px] ${
          isMember
            ? "bg-green-600 text-white hover:bg-green-700"
            : "bg-blue-600 text-white hover:bg-blue-700"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isJoining ? "Joining..." : isMember ? "Open" : "Join"}
      </button>
    </div>
  );
}
