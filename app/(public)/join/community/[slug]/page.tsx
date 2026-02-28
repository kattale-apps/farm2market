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
  termsContent?: string;
  privacyContent?: string;
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
  const [showTermsModal, setShowTermsModal] = useState(false);

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
        <div className="text-center">
          <div className="inline-block">
            <div className="w-12 h-12 border-4 border-gray-300 border-t-green-600 rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600 mt-4 font-medium">Loading community...</p>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-md text-center max-w-md w-full">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Community Not Found</h1>
          <p className="text-gray-600 mb-6">This join link is invalid or the community is no longer available.</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition min-h-12"
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
        <div className="text-center">
          <div className="inline-block">
            <div className="w-12 h-12 border-4 border-gray-300 border-t-green-600 rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600 mt-4 font-medium">
            {joinMessage || "Joining community..."}
          </p>
        </div>
      </div>
    );
  }

  // Terms Modal
  if (showTermsModal) {
    return (
      <div className="min-h-screen bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 fixed inset-0 z-50">
        <div className="bg-white rounded-2xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Modal Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Terms & Privacy</h2>
            <button
              onClick={() => setShowTermsModal(false)}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ✕
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 text-gray-700 space-y-4">
            <div className="prose prose-sm max-w-none">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Community Terms & Conditions</h3>
              <p>
                By joining this community, you agree to our terms of service and privacy policy. 
                This community is designed to facilitate agricultural commerce and knowledge sharing.
              </p>
              <p>
                All members are expected to conduct themselves professionally and respectfully.
                Any violations of community guidelines may result in removal.
              </p>
              <h3 className="text-lg font-bold text-gray-900 mt-4 mb-2">Privacy Policy</h3>
              <p>
                Your information is kept secure and will not be shared with third parties without your consent.
                We use your data to improve our services and connect you with relevant opportunities.
              </p>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex gap-3">
            <button
              onClick={() => setShowTermsModal(false)}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-900 rounded-xl font-semibold hover:bg-gray-300 transition min-h-12"
            >
              Back
            </button>
            <button
              onClick={() => {
                setShowTermsModal(false);
                handleJoin();
              }}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition min-h-12"
            >
              I Agree & Join Community
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Community info display - Centered, mobile-optimized
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 max-w-sm w-full">
        {/* 1. Community Logo (centered, large) */}
        <div className="flex justify-center mb-6">
          {community.qrLogoUrl ? (
            <img
              src={community.qrLogoUrl}
              alt={community.name}
              className="w-24 h-24 object-cover rounded-xl border-4 border-green-100 shadow-sm"
              loading="lazy"
            />
          ) : (
            <div className="w-24 h-24 bg-green-100 rounded-xl border-4 border-green-200 flex items-center justify-center text-3xl font-bold text-green-600">
              {community.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* 2. Community Name */}
        <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center line-clamp-2">
          {community.name}
        </h1>

        {/* 3. Short Welcome Text */}
        {community.description && (
          <p className="text-gray-600 text-center mb-2 text-sm line-clamp-3">
            {community.description}
          </p>
        )}

        {/* Welcome message */}
        <p className="text-gray-500 text-center text-sm mb-6">
          Join the community to start connecting and trading
        </p>

        {/* Already member state */}
        {alreadyMember && (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-6 text-center">
            <p className="text-sm text-green-900 font-semibold">
              ✓ You are already a member
            </p>
          </div>
        )}

        {/* 4. PRIMARY BUTTON: Join Community */}
        <button
          onClick={() => {
            if (alreadyMember) {
              router.push(`/community-only/noticeboard?communityId=${community._id}`);
            } else {
              handleJoin();
            }
          }}
          disabled={isJoining}
          className="w-full px-6 py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition min-h-12 mb-4 text-lg active:scale-95"
        >
          {alreadyMember ? "Open Community" : isJoining ? "Joining..." : "Join Community"}
        </button>

        {/* 5. SECONDARY TEXT BUTTON: View Privacy & Terms */}
        <button
          onClick={() => setShowTermsModal(true)}
          className="w-full text-center text-sm text-green-600 hover:text-green-700 font-medium py-2 transition active:scale-95"
        >
          View Privacy & Terms
        </button>

        {/* Joining as badge */}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mt-6 pt-6 border-t border-gray-200">
          <span>Joining as:</span>
          <span className="font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
            {getRoleBadgeText(userRole)}
          </span>
        </div>

        {/* Error message */}
        {joinMessage && !alreadyMember && (
          <p
            className={`mt-4 text-center text-sm font-medium ${
              joinMessage.includes("Error") ? "text-red-600" : "text-green-600"
            }`}
          >
            {joinMessage}
          </p>
        )}
      </div>
    </div>
  );
}
