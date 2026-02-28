"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { CommunityLogoButton } from "@/app/components/community/CommunityLogoButton";
import { CommunityDiscoveryCard } from "@/app/components/community/CommunityDiscoveryCard";

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-in slide-in-from-bottom">
      <span>✓</span>
      <span>{message}</span>
    </div>
  );
}

function SkeletonLogo() {
  return (
    <div className="aspect-square rounded-xl bg-gray-200 animate-pulse" />
  );
}

export default function MyCommunitiesPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Get joined communities
  const joinedCommunities = useQuery(
    api.communities.getUserCommunities,
    userId ? { userId } : "skip"
  );

  // Get suggested communities (exclude already joined)
  const suggestedCommunities = useQuery(
    api.communities.getSuggestedCommunities,
    userId ? { userId, limit: 20 } : "skip"
  );

  // Join mutation
  const joinCommunity = useMutation(api.communities.joinCommunity);

  // Get userId from localStorage
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
      router.push("/login");
    }
  }, [router]);

  const handleJoinCommunity = async (communityId: Id<"communities">) => {
    if (!userId) return;

    try {
      await joinCommunity({
        farmerId: userId,
        communityId,
      });
      setToastMessage("Successfully joined community!");
      setRefreshKey((prev) => prev + 1);
    } catch (error: any) {
      console.error("Join error:", error);
      setToastMessage(error.message || "Failed to join community");
    }
  };

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const isLoading = joinedCommunities === undefined || suggestedCommunities === undefined;
  const hasJoinedCommunities = (joinedCommunities || []).length > 0;
  const hasSuggestions = (suggestedCommunities || []).length > 0;

  // Build set of joined community IDs for quick lookup
  const joinedIds = new Set(
    (joinedCommunities || []).map((c) => String(c._id))
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">My Communities</h1>
          <p className="text-sm text-gray-600 mt-1">
            {hasJoinedCommunities && joinedCommunities
              ? `You're a member of ${joinedCommunities.length} ${
                  joinedCommunities.length === 1 ? "community" : "communities"
                }`
              : "Discover and join communities"}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <SkeletonLogo key={i} />
            ))}
          </div>
        ) : hasJoinedCommunities ? (
          <>
            {/* Your Communities - Logo Grid */}
            <section className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Your Communities</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {joinedCommunities!.map((community) => (
                  <CommunityLogoButton
                    key={community._id}
                    communityId={community._id}
                    isActive={true}
                  />
                ))}
              </div>
            </section>

            {/* Suggested Communities */}
            {hasSuggestions && (
              <section>
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  Suggested Communities
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {suggestedCommunities!.map((community) => (
                    <CommunityDiscoveryCard
                      key={community._id}
                      community={community}
                      isMember={joinedIds.has(String(community._id))}
                      onJoin={handleJoinCommunity}
                      onOpen={() => {
                        router.push(
                          `/community-only/noticeboard?communityId=${community._id}`
                        );
                      }}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <>
            {/* Empty State - Discover Communities */}
            <section>
              <div className="text-center mb-8">
                <div className="text-6xl mb-4">🌱</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Discover Communities
                </h2>
                <p className="text-gray-600">
                  Join communities to connect with farmers, traders, and buyers
                </p>
              </div>

              {hasSuggestions ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {suggestedCommunities!.map((community) => (
                    <CommunityDiscoveryCard
                      key={community._id}
                      community={community}
                      isMember={false}
                      onJoin={handleJoinCommunity}
                      onOpen={() => {
                        router.push(
                          `/community-only/noticeboard?communityId=${community._id}`
                        );
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">
                    No communities available at this time
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
    </div>
  );
}
