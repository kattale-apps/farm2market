"use client";

import { Id } from "@/convex/_generated/dataModel";
import { useCurrentCommunity } from "@/app/hooks/useCurrentCommunity";

type LogoSize = "sm" | "md" | "lg";

interface CommunityLogoProps {
  communityId: Id<"communities"> | null | undefined;
  size?: LogoSize;
  className?: string;
  alt?: string;
}

const sizeMap: Record<LogoSize, { container: string; image: string }> = {
  sm: { container: "w-8 h-8", image: "w-8 h-8" },
  md: { container: "w-12 h-12", image: "w-12 h-12" },
  lg: { container: "w-24 h-24", image: "w-24 h-24" },
};

/**
 * Renders a community logo from the database
 * 
 * Single source of truth: Fetches logo directly from community document
 * - No props-based logo passing
 * - No localStorage caching
 * - Always uses latest logo from database
 * 
 * Displays fallback avatar if no logo found
 */
export function CommunityLogo({
  communityId,
  size = "md",
  className = "",
  alt,
}: CommunityLogoProps) {
  const community = useCurrentCommunity(communityId);
  const sizes = sizeMap[size];

  if (!community) {
    // Return placeholder avatar
    return (
      <div
        className={`${sizes.container} ${className} rounded-lg bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-gray-600 font-semibold text-xs flex-shrink-0`}
      >
        {/* Fallback initial if available */}
      </div>
    );
  }

  // Use qrLogoUrl first, then fallback to logoPath
  const logoUrl = community.logoUrl;

  if (!logoUrl) {
    // Return fallback avatar with community initial
    return (
      <div
        className={`${sizes.container} ${className} rounded-lg bg-gradient-to-br from-blue-300 to-blue-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}
      >
        {community.name?.charAt(0)?.toUpperCase() || "C"}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={alt || `${community.name} logo`}
      className={`${sizes.image} ${className} rounded-lg object-cover flex-shrink-0`}
      onError={(e) => {
        // Fallback to avatar on image load failure
        const target = e.target as HTMLImageElement;
        target.style.display = "none";
        if (target.nextElementSibling) {
          target.nextElementSibling.setAttribute("style", "display: block");
        }
      }}
    />
  );
}
