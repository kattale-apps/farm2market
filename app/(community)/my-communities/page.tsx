"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50">
      <span>✓</span>
      <span>{message}</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-3 flex items-center gap-3 animate-pulse">
      <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-gray-200" />
      <div className="flex-1">
        <div className="h-4 bg-gray-200 rounded w-24" />
        <div className="h-3 bg-gray-200 rounded w-16 mt-2" />
      </div>
      <div className="flex-shrink-0 h-8 bg-gray-200 rounded w-12" />
    </div>
  );
}

function SearchBar({ userId, onCommunityJoined }: { userId: Id<"users">; onCommunityJoined: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchResults = useQuery(api.communities.searchQrCommunities, {
    searchText: searchQuery.trim(),
  });

  const joinCommunity = useMutation(api.communities.joinCommunity);

  const filteredResults = searchQuery.trim()
    ? searchResults?.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) || []
    : [];

  const handleJoin = async (communityId: Id<"communities">) => {
    const community = filteredResults.find((c) => c._id === communityId);
    if (!community) return;

    setIsJoining(true);
    try {
      await joinCommunity({
        communityId,
        farmerId: userId,
      });
      setSearchQuery("");
      setShowDropdown(false);
      setToastMessage(`You joined ${community.name}`);
      onCommunityJoined();
    } catch (error) {
      console.error("Failed to join community:", error);
      alert("Failed to join community. You may already be a member.");
    } finally {
      setIsJoining(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="px-4 py-4 md:p-8">
          <div className="max-w-md mx-auto md:max-w-none">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search communities..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[44px]"
            />

      {showDropdown && searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-80 overflow-y-auto z-50">
                {filteredResults.length > 0 ? (
                  <div className="space-y-1 p-2">
                    {filteredResults.map((community) => (
                      <button
                        key={community._id}
                        onClick={() => handleJoin(community._id)}
                        disabled={isJoining}
                        className="w-full text-left p-3 hover:bg-gray-100 rounded-lg transition flex items-center gap-3 disabled:opacity-50"
                      >
                        {(community.qrLogoUrl || community.logoPath) && (
                          <img
                            src={community.qrLogoUrl || community.logoPath}
                            alt={community.name}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                        )}
                        {!(community.qrLogoUrl || community.logoPath) && (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-700">
                            {community.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{community.name}</div>
                          <div className="text-xs text-gray-500">{community.qrSlug || community.name.toLowerCase().replace(/\s+/g, "-")}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500 text-sm">No communities found</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}
    </>
  );
}

function JoinedCommunityCard({
  community,
  onOpenCommunity,
}: {
  community: any;
  onOpenCommunity: (communityId: Id<"communities">) => void;
}) {
  return (
    <div
      onClick={() => onOpenCommunity(community._id)}
      className="bg-white rounded-2xl shadow-sm hover:shadow-md transition cursor-pointer p-3 flex items-center gap-3"
    >
      {/* Logo */}
      <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br from-blue-100 to-gray-100 flex items-center justify-center overflow-hidden">
        {(community.qrLogoUrl || community.logoPath) ? (
          <img
            src={community.qrLogoUrl || community.logoPath}
            alt={community.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-2xl font-bold text-gray-400">
            {community.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-gray-900 truncate">{community.name}</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          {(community as any).memberCount || 0} members
        </p>
      </div>

      {/* Open Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpenCommunity(community._id);
        }}
        className="flex-shrink-0 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition whitespace-nowrap min-h-[44px] flex items-center"
      >
        Open
      </button>
    </div>
  );
}

function JoinedCommunitiesList({ userId, refreshKey }: { userId: Id<"users">; refreshKey: number }) {
  const router = useRouter();
  const joinedCommunities = useQuery(api.communities.getUserCommunities, { userId });

  // Sort by newest join first (reverse order)
  const sortedCommunities = (joinedCommunities || []).sort((a, b) => {
    const dateA = (a as any).joinedAt || 0;
    const dateB = (b as any).joinedAt || 0;
    return dateB - dateA;
  });

  if (!joinedCommunities) {
    return (
      <div className="px-4 py-6 space-y-2">
        <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (joinedCommunities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="text-6xl mb-4">🔍</div>
        <p className="text-gray-600 font-medium">Search to join a community</p>
        <p className="text-sm text-gray-500 mt-2 text-center">
          Use the search bar above to find and join communities
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:p-8">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Your Communities</h2>
      <div className="space-y-2">
        {sortedCommunities.map((community) => (
          <JoinedCommunityCard
            key={community._id}
            community={community}
            onOpenCommunity={(communityId) => {
              router.push(`/community-only/noticeboard?communityId=${communityId}`);
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function MyCommunities() {
  const router = useRouter();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const storedUser = localStorage.getItem("pilot_user");
    if (storedUser) {
      try {
        const userObj = JSON.parse(storedUser);
        if (userObj.userId) {
          setUserId(userObj.userId as Id<"users">);
        }
      } catch {
        setUserId(storedUser as Id<"users">);
      }
    } else {
      router.push("/join/community");
    }
  }, [router]);

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Search Bar */}
      <SearchBar
        userId={userId}
        onCommunityJoined={() => setRefreshKey((prev) => prev + 1)}
      />

      {/* Joined Communities */}
      <div className="pb-safe">
        <div className="max-w-md mx-auto md:max-w-none">
          <JoinedCommunitiesList userId={userId} refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}
