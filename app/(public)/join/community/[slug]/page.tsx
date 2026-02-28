"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface CommunityInfo {
  _id: string;
  name: string;
  description?: string;
  qrLogoUrl?: string;
  qrEnabled?: boolean;
}

const getRoleBadgeText = (role?: string): string => {
  switch (role) {
    case "trader":
      return "Trader";
    case "buyer":
      return "Buyer";
    default:
      return "Farmer";
  }
};

export default function JoinCommunityPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [userRole, setUserRole] = useState<string | undefined>();
  const [isJoining, setIsJoining] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");
  const [alreadyMember, setAlreadyMember] = useState(false);

  // Fetch community by QR slug
  const community = useQuery(api.communities.getCommunityByQrSlug, {
    slug: params.slug,
  }) as CommunityInfo | null | undefined;

  // Join community mutation
  const joinCommunityByQr = useMutation(api.communities.joinCommunityByQr);

  // Get userId and role from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("pilot_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.userId) {
            setUserId(parsed.userId);
            setUserRole(parsed.role);
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
        role: (userRole as "farmer" | "trader" | "buyer" | undefined),
      });

      if (result.alreadyMember) {
        setAlreadyMember(true);
        setJoinMessage(result.message || "You are already a member");
      } else {
        setJoinMessage(result.message || "Joined successfully");
        setTimeout(() => {
          router.push("/my-communities");
        }, 1500);
      }
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

  // Community info display
  return (
    <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 max-w-md w-full">
        {/* 1. Community Logo (centered, large, 96-128px) */}
        {community.qrLogoUrl && (
          <div className="flex justify-center mb-6">
            <img
              src={community.qrLogoUrl}
              alt={community.name}
              className="w-28 h-28 object-cover rounded-xl border border-gray-200"
            />
          </div>
        )}

        {/* 2. Community Name */}
        <h1 className="text-3xl font-bold text-gray-900 mb-3 text-center">{community.name}</h1>

        {/* 3. Short Description */}
        {community.description && (
          <p className="text-gray-600 text-center mb-6 text-sm">{community.description}</p>
        )}

        {/* 4. Join Button (primary, full-width) */}
        <button
          onClick={handleJoin}
          disabled={isJoining || alreadyMember}
          className="w-full px-5 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition mb-6"
        >
          {alreadyMember ? "Open Community" : isJoining ? "Joining..." : "Join Community"}
        </button>

        {/* 5. Secondary Text: Role badge */}
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-4">
          <span>Joining as:</span>
          <span className="font-semibold text-gray-900">{getRoleBadgeText(userRole)}</span>
        </div>

        {/* 6. Already a member state */}
        {alreadyMember && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <p className="text-sm text-blue-900 font-semibold">
              ✓ You are already a member of this community
            </p>
          </div>
        )}

        {/* Error or success message */}
        {joinMessage && !alreadyMember && (
          <p className={`mt-4 text-center text-sm ${joinMessage.includes("Error") ? "text-red-600" : "text-green-600"}`}>
            {joinMessage}
          </p>
        )}
      </div>
    </div>
  );
}
