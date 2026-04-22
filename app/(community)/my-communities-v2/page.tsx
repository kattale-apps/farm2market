"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import CommunitySwitcher from "@/app/components/CommunitySwitcher";

export default function MyCommunitiesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const navContext = useQuery(api.communities.getMyNavigationContext);
  const searchResults = useQuery(api.communities.searchQrCommunities, {
    searchText: searchQuery.trim().substring(0, 50),
  });

  const joinCommunity = useMutation(api.communities.joinCommunity);
  const [joiningCommunityId, setJoiningCommunityId] = useState<string | null>(null);

  useEffect(() => {
    if (navContext) {
      setIsLoading(false);

      // Auto-redirect superadmin
      if (navContext.isSuperadmin && navContext.joinedCommunities.length === 0) {
        router.push("/superadmin/dashboard");
      }
      // Auto-redirect community admin with no joined communities
      else if (navContext.adminCommunities.length > 0 && navContext.joinedCommunities.length === 0) {
        const firstAdmin = navContext.adminCommunities[0];
        router.push(`/community-admin/${firstAdmin.communityId}/dashboard`);
      }
    }
  }, [navContext, router]);

  if (isLoading || !navContext) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading communities...</p>
        </div>
      </div>
    );
  }

  const { joinedCommunities, adminCommunities } = navContext;
  const allCommunities = [...joinedCommunities];

  // Don't show search/discover if user is admin-only
  const showDiscoverSection = joinedCommunities.length > 0 || searchQuery.trim().length > 0;

  const handleJoinCommunity = async (communityId: string) => {
    try {
      setJoiningCommunityId(communityId);
      await joinCommunity({
        farmerId: navContext!.userId as any,
        communityId: communityId as any,
      });
      // Refresh the page to show updated communities
      window.location.reload();
    } catch (error) {
      console.error("Error joining community:", error);
      alert(`Error joining community: ${(error as Error).message}`);
      setJoiningCommunityId(null);
    }
  };

  const handleNavigateToCommunity = (communityId: string) => {
    router.push(`/community-only/messages?communityId=${communityId}`);
  };

  return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header with Community Switcher */}
      <div className="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Communities</h1>
            <p className="text-gray-600 text-sm">Connect with farming communities</p>
          </div>
          {allCommunities.length > 1 && <CommunitySwitcher variant="tabs" />}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Admin Communities Notice */}
        {adminCommunities.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <p className="text-sm text-blue-900">
              You are an admin of {adminCommunities.length} communit{adminCommunities.length === 1 ? 'y' : 'ies'}.{" "}
              <a href="/community-admin/dashboard" className="font-bold underline hover:text-blue-700">
                Go to admin dashboard
              </a>
            </p>
          </div>
        )}

        {/* Joined Communities Section */}
        {allCommunities.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Your Communities ({allCommunities.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allCommunities.map((community) => (
                <div
                  key={community.communityId}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition border border-gray-200 overflow-hidden"
                >
                  {community.logo && (
                    <img
                      src={community.logo}
                      alt={community.name}
                      className="w-full h-32 object-cover"
                    />
                  )}
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 text-lg mb-1">{community.name}</h3>
                    <p className="text-gray-500 text-sm mb-4">
                      Posts, messages, trackers &amp; more
                    </p>
                    <button
                      onClick={() => handleNavigateToCommunity(community.communityId)}
                      className="w-full px-4 py-3 bg-green-700 text-white rounded-lg hover:bg-green-800 transition font-bold text-sm min-h-[44px] flex items-center justify-center gap-2"
                    >
                      🌾 View Community
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {allCommunities.length === 0 && searchQuery.trim().length === 0 && (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Communities Yet</h2>
            <p className="text-gray-600 mb-6">Search and join a community to get started!</p>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search communities..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              className="absolute right-3 top-3 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Search Results / Available Communities */}
        {searchQuery.trim().length > 0 && searchResults && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Available Communities</h2>
            {searchResults.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No communities found matching {searchQuery}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((community) => {
                  const isAlreadyJoined = allCommunities.some(
                    (c) => c.communityId === community._id
                  );

                  if (isAlreadyJoined) return null;

                  const isJoining = joiningCommunityId === community._id;

                  return (
                    <div
                      key={community._id}
                      className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition"
                    >
                      {community.qrLogoUrl && (
                        <img
                          src={community.qrLogoUrl}
                          alt={community.name}
                          className="w-full h-32 object-cover rounded-lg mb-4"
                        />
                      )}
                      <h3 className="font-bold text-gray-900 text-lg mb-2">{community.name}</h3>
                      {community.description && (
                        <p className="text-gray-600 text-sm mb-4">{community.description}</p>
                      )}
                      <button
                        onClick={() => handleJoinCommunity(community._id)}
                        disabled={isJoining}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
                      >
                        {isJoining ? "Joining..." : "Join Community"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
