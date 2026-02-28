"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface CommunityInfo {
  _id: string;
  name: string;
  qrLogoUrl?: string;
  qrEnabled?: boolean;
}

export default function JoinCommunityPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");

  // Fetch community by QR slug
  const community = useQuery(api.communities.getCommunityByQrSlug, {
    slug: params.slug,
  }) as CommunityInfo | null | undefined;

  // Join community mutation
  const joinCommunityByQr = useMutation(api.communities.joinCommunityByQr);

  // Get userId from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("pilot_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.userId) {
            setUserId(parsed.userId);
          }
        }
      } catch (error) {
        console.error("Failed to parse stored user:", error);
      }
    }
  }, []);

  const handleJoin = async () => {
    if (!community) return;

    if (!userId) {
      const redirectTarget = encodeURIComponent(`/join/community/${params.slug}`);
      router.push(`/login?redirect=${redirectTarget}`);
      return;
    }

    setIsJoining(true);
    setJoinMessage("");
    try {
      const result = await joinCommunityByQr({
        slug: params.slug,
        userId,
      });

      setJoinMessage(result.message || "Joined successfully");
      router.push("/my-communities");
    } catch (error: any) {
      setJoinMessage(`Error joining community: ${error.message}`);
      setIsJoining(false);
    }
  };

  // Loading state
  if (community === undefined) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          flexDirection: "column",
          backgroundColor: "#f5f5f5",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Loading community...</p>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid #ddd",
              borderTop: "4px solid #2196f3",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto",
            }}
          />
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm text-center max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Community Not Found</h1>
          <p className="text-gray-600 mb-6">This join link is invalid or the community is no longer available.</p>
          <button
            onClick={() => router.push("/")}
            className="px-5 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Joining state
  if (isJoining) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          flexDirection: "column",
          backgroundColor: "#f5f5f5",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>
            {joinMessage || "Joining community..."}
          </p>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid #ddd",
              borderTop: "4px solid #4CAF50",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto",
            }}
          />
        </div>
      </div>
    );
  }

  // Community info display (shouldn't reach here, but just in case)
  return (
    <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 max-w-md w-full text-center">
        {community.qrLogoUrl && (
          <img
            src={community.qrLogoUrl}
            alt={community.name}
            className="w-28 h-28 object-cover rounded-xl mx-auto mb-5 border border-gray-200"
          />
        )}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{community.name}</h1>
        <p className="text-gray-600 mb-6">Join this community to access updates, messaging, and member features.</p>
        <button
          onClick={handleJoin}
          disabled={isJoining}
          className="w-full px-5 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          Join this community
        </button>
        {joinMessage && (
          <p className={`mt-4 text-sm ${joinMessage.includes("Error") ? "text-red-600" : "text-green-600"}`}>
            {joinMessage}
          </p>
        )}
      </div>
    </div>
  );
}
