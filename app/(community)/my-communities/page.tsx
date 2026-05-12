"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useStoredUser } from "../../hooks/useStoredUser";
import { CommunityQRCode } from "@/app/components/CommunityQRCode";

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

function SearchBar({
  userId,
  onCommunityJoined,
  enabled,
}: {
  userId: Id<"users">;
  onCommunityJoined: () => void;
  enabled: boolean;
}) {
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
    ? searchResults?.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase())) || []
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

  if (!enabled) {
    return null;
  }

  return (
    <>
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="px-4 py-4">
          <div className="max-w-xl mx-auto relative">
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
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[44px]"
            />

            {showDropdown && searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-xl shadow-lg mt-1 max-h-80 overflow-y-auto z-50">
                {filteredResults.length > 0 ? (
                  <div className="space-y-1 p-2">
                    {filteredResults.map((community) => (
                      <button
                        key={community._id}
                        onClick={() => handleJoin(community._id)}
                        disabled={isJoining}
                        className="w-full text-left p-3 hover:bg-gray-100 rounded-lg transition flex items-center gap-3 disabled:opacity-50"
                      >
                        {community.logoPath ? (
                          <img
                            src={community.logoPath}
                            alt={community.name}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-700">
                            {community.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{community.name}</div>
                          <div className="text-xs text-gray-500">
                            {community.qrSlug || community.name.toLowerCase().replace(/\s+/g, "-")}
                          </div>
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

      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
    </>
  );
}

function JoinedCommunityCard({
  community,
  onOpenCommunity,
  focused,
}: {
  community: any;
  onOpenCommunity: (communityId: Id<"communities">) => void;
  focused: boolean;
}) {
  return (
    <div
      onClick={() => onOpenCommunity(community._id)}
      className={
        focused
          ? "bg-white rounded-2xl shadow-sm border border-green-100 p-4"
          : "bg-white rounded-2xl shadow-sm hover:shadow-md transition cursor-pointer p-3 flex items-center gap-3"
      }
    >
      {focused ? (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br from-green-100 to-gray-100 flex items-center justify-center overflow-hidden">
              {community.logoPath ? (
                <img src={community.logoPath} alt={community.name} className="w-full h-full object-cover" />
              ) : (
                <div className="text-2xl font-bold text-gray-400">{community.name.charAt(0).toUpperCase()}</div>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{community.name}</h2>
              <p className="text-xs text-gray-600 mt-1">Your linked community</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-4">Access updates, messages, and member tools from one place.</p>

          <div className="flex flex-col gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenCommunity(community._id);
              }}
              className="w-full px-4 py-3 bg-green-700 text-white text-sm font-semibold rounded-xl hover:bg-green-800 transition min-h-[44px]"
            >
              Open Community Dashboard
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br from-blue-100 to-gray-100 flex items-center justify-center overflow-hidden">
            {community.logoPath ? (
              <img src={community.logoPath} alt={community.name} className="w-full h-full object-cover" />
            ) : (
              <div className="text-2xl font-bold text-gray-400">{community.name.charAt(0).toUpperCase()}</div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate">{community.name}</h3>
            {(community as any).showMemberCount !== false && (
              <p className="text-xs text-gray-500 mt-0.5">{(community as any).memberCount || 0} members</p>
            )}
          </div>

          <div className="flex-shrink-0 flex gap-2 items-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenCommunity(community._id);
              }}
              className="px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition whitespace-nowrap min-h-[44px]"
            >
              Open
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function JoinedCommunitiesList({
  userId,
  isCommunityOnly,
  linkedCommunityId,
}: {
  userId: Id<"users">;
  isCommunityOnly: boolean;
  linkedCommunityId: string | null;
}) {
  const router = useRouter();
  const joinedCommunities = useQuery(api.communities.getUserCommunities, { userId });

  const sortedCommunities = (joinedCommunities || []).slice().sort((a, b) => {
    const dateA = (a as any).joinedAt || 0;
    const dateB = (b as any).joinedAt || 0;
    return dateB - dateA;
  });

  const communitiesToShow = sortedCommunities;

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

  if (communitiesToShow.length === 0) {
    if (isCommunityOnly) {
      return (
        <div className="max-w-md mx-auto px-4 py-10">
          <div className="bg-white rounded-2xl p-5 border border-gray-200 text-center">
            <h2 className="text-lg font-bold text-gray-900">No linked community yet</h2>
            <p className="text-sm text-gray-600 mt-2">Use your community QR link to complete joining and unlock your dashboard.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="text-6xl mb-4">🔍</div>
        <p className="text-gray-600 font-medium">Search to join a community</p>
        <p className="text-sm text-gray-500 mt-2 text-center">Use the search bar above to find and join communities</p>
      </div>
    );
  }

  if (isCommunityOnly) {
    const primaryCommunity = communitiesToShow[0];
    return (
      <div className="max-w-md mx-auto px-4 py-5">
        <JoinedCommunityCard
          community={primaryCommunity}
          focused={true}
          onOpenCommunity={(communityId) => {
            router.push(`/community-only/noticeboard?communityId=${communityId}`);
          }}
        />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:p-8">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Your Communities</h2>
      <div className="space-y-2">
        {communitiesToShow.map((community) => (
          <JoinedCommunityCard
            key={community._id}
            community={community}
            focused={false}
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
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;

  const communityScope = useQuery(
    api.communities.getUserCommunityScope,
    userId ? { userId } : "skip"
  );

  const isCommunityOnly = communityScope?.accountScope === "community_only";
  const linkedCommunityId = (communityScope?.onboardedViaCommunityId as string | null | undefined) ?? null;

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/join/community");
    }
  }, [authStatus, router]);

  if (authStatus === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500">Loading your session...</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-5 pb-3 max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-900">My Communities</h1>
        <p className="text-sm text-gray-600 mt-1">
          {isCommunityOnly
            ? "You are connected to your linked community."
            : "Join and manage your communities from one place."}
        </p>
      </div>

      <SearchBar
        userId={userId}
        enabled={true}
        onCommunityJoined={() => undefined}
      />

      <div className="pb-safe">
        <div className="max-w-md mx-auto md:max-w-none">
          <JoinedCommunitiesList
            userId={userId}
            isCommunityOnly={isCommunityOnly}
            linkedCommunityId={linkedCommunityId}
          />
        </div>
      </div>
    </div>
  );
}
