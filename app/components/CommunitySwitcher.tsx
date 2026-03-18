"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface CommunitySwitcherProps {
  currentCommunityId?: Id<"communities">;
  variant?: "dropdown" | "tabs";
}

export default function CommunitySwitcher({ currentCommunityId, variant = "dropdown" }: CommunitySwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const navContext = useQuery(api.communities.getMyNavigationContext);

  if (!navContext) {
    return null;
  }

  const { adminCommunities, joinedCommunities } = navContext;
  const allCommunities = Array.isArray(adminCommunities) && Array.isArray(joinedCommunities)
    ? [...adminCommunities, ...joinedCommunities]
    : [];

  if (allCommunities.length <= 1) {
    return null;
  }

  const handleSelectCommunity = (communityId: Id<"communities">, isAdmin: boolean) => {
    if (isAdmin) {
      router.push(`/community-admin/${communityId}/dashboard`);
    } else {
      router.push(`/community/${communityId}/messaging`);
    }
    setIsOpen(false);
  };

  const currentCommunity = allCommunities.find((c) => c.communityId === currentCommunityId);

  if (variant === "tabs") {
    return (
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {allCommunities.map((community) => {
          const isAdmin = Array.isArray(adminCommunities) && adminCommunities.some((c) => c.communityId === community.communityId);
          const isActive = currentCommunityId === community.communityId;
          return (
            <button
              key={community.communityId}
              onClick={() => handleSelectCommunity(community.communityId, isAdmin)}
              className={`px-4 py-2 font-medium whitespace-nowrap transition ${
                isActive ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {community.logo && <img src={community.logo} alt="" className="w-4 h-4 inline mr-2 rounded-full" />}
              {community.name}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2"
      >
        {currentCommunity?.logo && <img src={currentCommunity.logo} alt="" className="w-4 h-4 rounded-full" />}
        {currentCommunity?.name || "Select Community"}
        <svg className={`w-4 h-4 transition ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {Array.isArray(adminCommunities) && adminCommunities.length > 0
              ? adminCommunities.map((community) => (
                  <button
                    key={community.communityId}
                    onClick={() => handleSelectCommunity(community.communityId, true)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition ${
                      currentCommunityId === community.communityId ? "bg-blue-100 text-blue-600 font-semibold" : ""
                    }`}
                  >
                    {community.logo && <img src={community.logo} alt="" className="w-4 h-4 inline mr-2 rounded-full" />}
                    {community.name}
                  </button>
                ))
              : null}
            {Array.isArray(joinedCommunities) && joinedCommunities.length > 0
              ? joinedCommunities.map((community) => (
                  <button
                    key={community.communityId}
                    onClick={() => handleSelectCommunity(community.communityId, false)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition ${
                      currentCommunityId === community.communityId ? "bg-blue-100 text-blue-600 font-semibold" : ""
                    }`}
                  >
                    {community.logo && <img src={community.logo} alt="" className="w-4 h-4 inline mr-2 rounded-full" />}
                    {community.name}
                  </button>
                ))
              : null}
          </div>
        </div>
      )}
    </div>
  );
}
