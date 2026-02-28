"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { JoinCommunityCard } from "@/app/components/community/JoinCommunityCard";

export default function TraderDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("pilot_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.userId) {
            setUserId(parsed.userId as Id<"users">);
          } else {
            router.push("/login");
          }
        } else {
          router.push("/login");
        }
      } catch (error) {
        console.error("Failed to parse user:", error);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
  }, [router]);

  const communities = useQuery(
    api.communities.getUserCommunities,
    userId ? { userId } : "skip"
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-lg text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!userId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Trader Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Welcome! Join communities to access trading, updates, and messaging.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Join Community CTA */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Get Started</h2>
          <JoinCommunityCard />
        </section>

        {/* My Communities Section */}
        {communities && communities.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">My Communities ({communities.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {communities.map((community) => (
                <div
                  key={community._id}
                  onClick={() => router.push("/my-communities")}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 hover:shadow-md transition cursor-pointer"
                >
                  {(community.qrLogoUrl || community.logoPath) && (
                    <img
                      src={community.qrLogoUrl || community.logoPath}
                      alt={community.name}
                      className="w-full h-32 object-cover rounded-lg mb-4"
                    />
                  )}
                  <h3 className="font-bold text-gray-900 mb-2">{community.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {community.description || "No description"}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push("/my-communities");
                    }}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {!communities || communities.length === 0 ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
            <p className="text-blue-900 font-semibold">
              You haven&apos;t joined any communities yet. Use the card above to get started!
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
