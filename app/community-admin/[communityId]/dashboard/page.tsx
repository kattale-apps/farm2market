"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import RoleGuard from "@/app/components/RoleGuard";

export default function CommunityAdminDashboardPage() {
  const router = useRouter();
  const params = useParams<{ communityId: string }>();
  const [communityId, setCommunityId] = useState<Id<"communities"> | null>(null);

  useEffect(() => {
    if (params?.communityId) {
      setCommunityId(params.communityId as Id<"communities">);
    }
  }, [params]);

  const summary = useQuery(
    api.communities.getCommunityDashboardSummary,
    communityId ? { communityId } : "skip"
  );

  if (!communityId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={["communityAdmin"]} communityId={communityId}>
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Community Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">{summary?.communityName || "Loading community..."}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Free Image Quota</h2>
            <p className="text-2xl font-bold text-blue-700">
              {summary ? `${summary.used} / ${summary.freeImageQuotaPerMonth} used` : "Loading..."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => router.push(`/community-only/noticeboard?communityId=${communityId}`)}
              className="w-full px-5 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
            >
              Create noticeboard post
            </button>
            <button
              onClick={() => router.push(`/community-only/messages?communityId=${communityId}`)}
              className="w-full px-5 py-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
            >
              Open messaging
            </button>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
