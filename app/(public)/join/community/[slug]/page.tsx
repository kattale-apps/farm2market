"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface CommunityInfo {
  _id: string;
  name: string;
  qrLogoUrl?: string;
  qrEnabled?: boolean;
}

export default function JoinCommunityPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // Handle after signup - check for joining intent
  useEffect(() => {
    if (!userId) return;
    if (!community) return;

    // Check if this is a post-signup redirect
    const fromSignup = searchParams.get("from_signup");
    if (!fromSignup) return;

    setIsJoining(true);
    (async () => {
      try {
        const result = await joinCommunityByQr({
          slug: params.slug,
          userId: userId as any,
        });

        setJoinMessage(result.message);

        // Redirect to my-communities after successful join
        setTimeout(() => {
          router.push("/my-communities");
        }, 1500);
      } catch (error: any) {
        setJoinMessage(`Error joining community: ${error.message}`);
        setIsJoining(false);
      }
    })();
  }, [userId, community, params.slug, searchParams, joinCommunityByQr, router]);

  // Handle redirect to signup if not authenticated
  useEffect(() => {
    if (!community) return;

    // If not logged in and not already redirecting, go to signup
    if (!userId) {
      const redirectUrl = `/login?qrCommunityId=${params.slug}`;
      router.push(redirectUrl);
    }
  }, [userId, community, params.slug, router]);

  // Loading state
  if (!community) {
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
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        flexDirection: "column",
        backgroundColor: "#f5f5f5",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "2rem",
          maxWidth: "400px",
          textAlign: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        {community.qrLogoUrl && (
          <img
            src={community.qrLogoUrl}
            alt={community.name}
            style={{
              maxWidth: "150px",
              height: "auto",
              marginBottom: "1.5rem",
              borderRadius: "8px",
            }}
          />
        )}
        <h1 style={{ fontSize: "1.8rem", marginBottom: "1rem", margin: "0 0 1rem 0" }}>
          {community.name}
        </h1>
        <p style={{ color: "#666", marginBottom: "2rem" }}>
          Welcome! You are being redirected to join this community.
        </p>
        {joinMessage && (
          <p
            style={{
              color: joinMessage.includes("Error") ? "#d32f2f" : "#4CAF50",
              fontSize: "0.9rem",
            }}
          >
            {joinMessage}
          </p>
        )}
      </div>
    </div>
  );
}
