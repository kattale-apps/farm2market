"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface CommunityLogoButtonProps {
  communityId: Id<"communities">;
  isActive?: boolean;
}

export function CommunityLogoButton({
  communityId,
  isActive = false,
}: CommunityLogoButtonProps) {
  const router = useRouter();

  // Fetch community logo using its own ID (prevents mismatch)
  const community = useQuery(api.communities.getCommunityById, {
    communityId: communityId,
  });

  if (community === undefined) {
    return (
      <button
        className="w-full aspect-square flex items-center justify-center rounded-xl bg-gray-200 animate-pulse cursor-not-allowed"
        disabled
      />
    );
  }

  if (!community) {
    return (
      <button
        className="w-full aspect-square flex items-center justify-center rounded-xl bg-gray-100 border-2 border-gray-300 cursor-not-allowed"
        disabled
      >
        <span className="text-2xl">❌</span>
      </button>
    );
  }

  const logoUrl = community.qrLogoUrl || community.logoPath;
  const initials = community.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      onClick={() => {
        router.push(
          `/community-only/noticeboard?communityId=${communityId}`
        );
      }}
      className={`
        w-full aspect-square flex flex-col items-center justify-center rounded-xl
        border-2 transition-all duration-200 active:scale-95
        ${
          isActive
            ? "border-green-500 bg-green-50 shadow-md"
            : "border-gray-200 bg-white hover:border-green-300 hover:shadow-md"
        }
      `}
      title={community.name}
    >
      <div className="flex flex-col items-center gap-2 w-full px-2">
        {/* Logo Image or Initials */}
        <div
          className={`
            w-12 h-12 rounded-lg flex items-center justify-center
            border overflow-hidden flex-shrink-0
            ${
              logoUrl
                ? "bg-white border-gray-200"
                : "bg-gradient-to-br from-green-100 to-blue-100 border-green-200"
            }
          `}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={community.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-lg font-bold text-gray-600">{initials}</span>
          )}
        </div>

        {/* Community Name */}
        <p className="text-xs font-semibold text-gray-800 text-center line-clamp-2 break-words">
          {community.name}
        </p>

        {/* Active Indicator */}
        {isActive && (
          <p className="text-xs text-green-600 font-bold">Active</p>
        )}
      </div>
    </button>
  );
}
