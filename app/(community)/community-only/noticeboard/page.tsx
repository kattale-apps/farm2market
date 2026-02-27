"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "@/convex/_generated/dataModel";
import RoleGuard from "@/app/components/RoleGuard";
import { useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

function QuotaWidget({ communityId }: { communityId: Id<"communities"> }) {
  const quotaStatus = useQuery(api.noticeboard.getAdminNoticeboardQuotaStatus, {
    communityId,
  });

  if (!quotaStatus) {
    return (
      <div className="mobile-sticky p-3 bg-gray-100 animate-pulse">
        <div className="h-20"></div>
      </div>
    );
  }

  const percentageUsed = quotaStatus.quota > 0 ? (quotaStatus.used / quotaStatus.quota) * 100 : 0;
  const isQuotaFull = quotaStatus.remaining === 0;
  
  // Color theme based on remaining quota
  const bgColor = isQuotaFull ? "bg-orange-50" : "bg-green-50";
  const borderColor = isQuotaFull ? "border-orange-200" : "border-green-200";
  const titleColor = isQuotaFull ? "text-orange-900" : "text-green-900";
  const barColor = isQuotaFull ? "bg-orange-500" : "bg-green-500";
  const textColor = isQuotaFull ? "text-orange-700" : "text-green-700";

  return (
    <div className="mobile-sticky p-3 md:p-4 mb-6 md:mb-8">
      <div className={`rounded-lg border-2 ${borderColor} ${bgColor} shadow-sm`}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-opacity-30">
          <h3 className={`text-sm font-bold ${titleColor} uppercase tracking-wide`}>
            Monthly Free Image Posts
          </h3>
        </div>

        {/* Progress Bar */}
        <div className="px-4 py-3">
          <div className="mb-3">
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 ${barColor} transition-all duration-300`}
                style={{ width: `${Math.min(percentageUsed, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className={`text-xs font-semibold ${textColor} mb-0.5`}>Used</p>
              <p className={`text-lg font-bold ${titleColor}`}>
                {quotaStatus.used} <span className="text-xs opacity-70">of {quotaStatus.quota}</span>
              </p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-semibold ${textColor} mb-0.5`}>Remaining</p>
              <p className={`text-lg font-bold ${titleColor}`}>{quotaStatus.remaining}</p>
            </div>
          </div>

          {/* Status Message */}
          {isQuotaFull ? (
            <div className="bg-orange-100 border border-orange-300 rounded px-3 py-2">
              <p className="text-xs text-orange-900 font-medium">
                ⚠️ New image posts will be billable
              </p>
            </div>
          ) : (
            <div className="bg-green-100 border border-green-300 rounded px-3 py-2">
              <p className="text-xs text-green-900 font-medium">
                ✓ {quotaStatus.remaining} free posts remaining
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CommunityNoticeboardPage() {
  const searchParams = useSearchParams();
  const communityIdParam = searchParams.get("communityId") || "";
  
  const [communityId, setCommunityId] = useState<Id<"communities"> | null>(null);
  const [userId, setUserId] = useState<Id<"users"> | null>(null);

  useEffect(() => {
    // Get community ID from URL params
    if (communityIdParam) {
      setCommunityId(communityIdParam as Id<"communities">);
    }

    // Get user ID from localStorage
    const userIdFromStorage = localStorage.getItem("pilot_user");
    if (userIdFromStorage) {
      setUserId(userIdFromStorage as Id<"users">);
    }
  }, [communityIdParam]);

  if (!communityId || !userId) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="text-center text-gray-500 p-8">
          Loading noticeboard...
        </div>
      </div>
    );
  }

  return (
    <RoleGuard
      allowedRoles={["member", "communityAdmin"]}
      communityId={communityId || undefined}
    >
      <div className="min-h-screen bg-gray-50 pb-safe">
        <div className="max-w-md mx-auto md:max-w-none md:p-8">
          <h1 className="text-3xl font-bold mb-8 px-4 md:px-0 pt-4 md:pt-0">Community Noticeboard</h1>

          <QuotaWidget communityId={communityId} />

          <div className="bg-white rounded-lg shadow-lg p-6 mx-4 md:mx-0">
            <h2 className="text-xl font-semibold mb-4">Create a new post</h2>
            <div className="text-gray-500 p-8 text-center">
              Post creation form coming soon
            </div>
          </div>
        </div>

        <style>{`
          .mobile-sticky {
            position: sticky;
            top: 0;
            z-index: 10;
          }
          
          @media (min-width: 768px) {
            .mobile-sticky {
              position: static;
              z-index: auto;
            }
          }
        `}</style>
      </div>
    </RoleGuard>
  );
}
