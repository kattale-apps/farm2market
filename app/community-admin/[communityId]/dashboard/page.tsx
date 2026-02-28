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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8 overflow-x-hidden">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Community Header with Logo */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Logo Section */}
              <div className="w-full sm:w-auto flex-shrink-0">
                {summary?.logoPath || summary?.qrLogoUrl ? (
                  <img
                    src={summary.qrLogoUrl || summary.logoPath}
                    alt={summary?.communityName || "Community Logo"}
                    className="h-24 w-24 sm:h-32 sm:w-32 object-cover rounded-lg border border-gray-200"
                  />
                ) : (
                  <div className="h-24 w-24 sm:h-32 sm:w-32 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center text-white">
                    <span className="text-4xl font-bold">
                      {(summary?.communityName ?? "?")[0].toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Community Info Section */}
              <div className="flex-1 w-full">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                  {summary?.communityName || "Loading community..."}
                </h1>
                {summary?.description && (
                  <p className="text-gray-600 mt-2">{summary.description}</p>
                )}
                <div className="flex flex-wrap gap-4 mt-4 text-sm">
                  {summary?.communityType && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-semibold text-blue-600 capitalize">
                        {summary.communityType}
                      </span>
                    </div>
                  )}
                  {summary?.memberCount !== undefined && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600">Members:</span>
                      <span className="font-semibold text-blue-600">
                        {summary.memberCount}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Free Image Quota Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Monthly Image Quota
              </h2>
              <div className="mt-4">
                {summary ? (
                  <>
                    <div className="text-3xl font-bold text-blue-600">
                      {summary.freeImageQuotaPerMonth - summary.used}
                      <span className="text-lg text-gray-600 ml-2">
                        / {summary.freeImageQuotaPerMonth}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      {summary.used} posts used this month
                    </p>
                    {/* Progress Bar */}
                    <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${((summary.used / summary.freeImageQuotaPerMonth) * 100) || 0}%`,
                        }}
                      ></div>
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500">Loading quota...</p>
                )}
              </div>
            </div>

            {/* Community Since Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Community Since
              </h2>
              <div className="mt-4">
                {summary?.createdAt ? (
                  <>
                    <div className="text-3xl font-bold text-green-600">
                      {new Date(summary.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      {Math.floor(
                        (Date.now() - summary.createdAt) / (1000 * 60 * 60 * 24)
                      )}{" "}
                      days active
                    </p>
                  </>
                ) : (
                  <p className="text-gray-500">Loading...</p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() =>
                router.push(
                  `/community-only/noticeboard?communityId=${communityId}`
                )
              }
              className="w-full px-5 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              Create Noticeboard Post
            </button>
            <button
              onClick={() =>
                router.push(
                  `/community-only/messages?communityId=${communityId}`
                )
              }
              className="w-full px-5 py-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-sm"
            >
              Open Messaging
            </button>
          </div>

          {/* Additional Info Section */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Community Dashboard
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="py-4 px-2 bg-slate-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Active Members</div>
                <div className="text-2xl font-bold text-gray-900">
                  {summary?.memberCount ?? 0}
                </div>
              </div>
              <div className="py-4 px-2 bg-slate-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Monthly Posts</div>
                <div className="text-2xl font-bold text-gray-900">
                  {summary?.used ?? 0}
                </div>
              </div>
              <div className="py-4 px-2 bg-slate-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Community Type</div>
                <div className="text-lg font-bold text-gray-900 capitalize">
                  {summary?.communityType ?? "General"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
