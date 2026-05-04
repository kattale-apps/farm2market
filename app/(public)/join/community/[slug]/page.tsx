"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useStoredUser } from "../../../../hooks/useStoredUser";

interface CommunityInfo {
  _id: string;
  name: string;
  description?: string;
  logoPath?: string;
  qrLogoUrl?: string;
  qrEnabled?: boolean;
}

export default function JoinCommunityPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  const [isJoining, setIsJoining] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");
  const [joinSuccess, setJoinSuccess] = useState(false);

  // Fetch community by QR slug
  const community = useQuery(api.communities.getCommunityByQrSlug, {
    slug: params.slug,
  }) as CommunityInfo | null | undefined;

  // Join community mutation
  const joinCommunityByQr = useMutation(api.communities.joinCommunityByQr);

  // Handle auto-join after signup/login redirect
  useEffect(() => {
    if (!userId) return;
    if (!community) return;

    const fromSignup = searchParams.get("from_signup");
    if (!fromSignup) return;

    // Clear the pending join intent from localStorage
    localStorage.removeItem("pending_community_join");

    setIsJoining(true);
    (async () => {
      try {
        const result = await joinCommunityByQr({
          slug: params.slug,
          userId: userId as any,
        });

        setJoinMessage(result.message);
        setJoinSuccess(true);

        // Redirect to my-communities after showing success
        setTimeout(() => {
          router.push("/my-communities");
        }, 2000);
      } catch (error: any) {
        setJoinMessage(`Error joining community: ${error.message}`);
        setIsJoining(false);
      }
    })();
  }, [userId, community, params.slug, searchParams, joinCommunityByQr, router]);

  // Handle "Join Community" button click
  const handleJoinClick = async () => {
    if (!community) return;

    if (userId) {
      // Already logged in — join directly
      setIsJoining(true);
      try {
        const result = await joinCommunityByQr({
          slug: params.slug,
          userId: userId as any,
        });
        setJoinMessage(result.message);
        setJoinSuccess(true);
        setTimeout(() => {
          router.push("/my-communities");
        }, 2000);
      } catch (error: any) {
        setJoinMessage(`Error: ${error.message}`);
        setIsJoining(false);
      }
    } else {
      // Not logged in — store intent and redirect to login/signup
      localStorage.setItem("pending_community_join", params.slug);
      router.push(`/login?qrCommunityId=${params.slug}`);
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
          background: "linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "1.1rem", marginBottom: "1rem", color: "#555" }}>
            Loading community...
          </p>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid #ddd",
              borderTop: "4px solid #2e7d32",
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

  // Community not found
  if (community === null) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          flexDirection: "column",
          background: "linear-gradient(135deg, #fce4ec 0%, #fff3e0 100%)",
          padding: "1rem",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "2.5rem 2rem",
            maxWidth: "400px",
            textAlign: "center",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>😕</div>
          <h2 style={{ fontSize: "1.3rem", color: "#d32f2f", marginBottom: "0.5rem" }}>
            Community Not Found
          </h2>
          <p style={{ color: "#666", fontSize: "0.95rem", marginBottom: "1.5rem" }}>
            This QR code may be invalid or the community no longer exists.
          </p>
          <button
            onClick={() => router.push("/")}
            style={{
              padding: "0.75rem 2rem",
              background: "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Joining / success state
  if (isJoining || joinSuccess) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          flexDirection: "column",
          background: "linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)",
          padding: "1rem",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "2.5rem 2rem",
            maxWidth: "400px",
            textAlign: "center",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}
        >
          {joinSuccess ? (
            <>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎉</div>
              <h2
                style={{
                  fontSize: "1.4rem",
                  color: "#2e7d32",
                  marginBottom: "0.5rem",
                }}
              >
                {joinMessage || "Successfully joined!"}
              </h2>
              <p style={{ color: "#666", fontSize: "0.9rem" }}>
                Redirecting to your communities...
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: "1.1rem", marginBottom: "1rem", color: "#555" }}>
                Joining community...
              </p>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  border: "4px solid #ddd",
                  borderTop: "4px solid #2e7d32",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto",
                }}
              />
              {joinMessage && (
                <p
                  style={{
                    color: joinMessage.includes("Error") ? "#d32f2f" : "#4CAF50",
                    fontSize: "0.9rem",
                    marginTop: "1rem",
                  }}
                >
                  {joinMessage}
                </p>
              )}
            </>
          )}
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Main confirmation UI — community info + "Join Community" button
  const logoUrl = community.logoPath || community.qrLogoUrl;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        flexDirection: "column",
        background: "linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "2.5rem 2rem",
          maxWidth: "420px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        }}
      >
        {/* Community Logo */}
        {logoUrl ? (
          <div
            style={{
              width: "100px",
              height: "100px",
              borderRadius: "50%",
              overflow: "hidden",
              margin: "0 auto 1.5rem auto",
              border: "3px solid #e8f5e9",
              background: "#f5f5f5",
            }}
          >
            <img
              src={logoUrl}
              alt={community.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
        ) : (
          <div
            style={{
              width: "100px",
              height: "100px",
              borderRadius: "50%",
              margin: "0 auto 1.5rem auto",
              background: "linear-gradient(135deg, #66bb6a, #43a047)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2.5rem",
              color: "#fff",
              fontWeight: "bold",
            }}
          >
            {community.name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Invite label */}
        <p
          style={{
            color: "#2e7d32",
            fontSize: "0.8rem",
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: "0.5rem",
          }}
        >
          You&apos;ve been invited to join
        </p>

        {/* Community Name */}
        <h1
          style={{
            fontSize: "1.6rem",
            fontWeight: "700",
            color: "#1a1a1a",
            margin: "0 0 0.75rem 0",
          }}
        >
          {community.name}
        </h1>

        {/* Description */}
        {community.description && (
          <p
            style={{
              color: "#666",
              fontSize: "0.95rem",
              lineHeight: "1.5",
              marginBottom: "1.5rem",
              padding: "0 0.5rem",
            }}
          >
            {community.description}
          </p>
        )}

        {!community.description && <div style={{ marginBottom: "1.5rem" }} />}

        {/* Join button */}
        <button
          onClick={handleJoinClick}
          style={{
            width: "100%",
            padding: "0.9rem 1.5rem",
            background: "linear-gradient(135deg, #2e7d32, #43a047)",
            color: "#fff",
            border: "none",
            borderRadius: "12px",
            fontSize: "1.1rem",
            fontWeight: "600",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(46,125,50,0.3)",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          onMouseDown={(e) => {
            (e.target as HTMLElement).style.transform = "scale(0.97)";
          }}
          onMouseUp={(e) => {
            (e.target as HTMLElement).style.transform = "scale(1)";
          }}
        >
          Join Community
        </button>

        {/* Info text */}
        <p
          style={{
            color: "#999",
            fontSize: "0.8rem",
            marginTop: "1rem",
          }}
        >
          {userId
            ? "You will be added as a member"
            : "You\u2019ll be asked to sign up or log in first"}
        </p>
      </div>

      {/* Branding */}
      <p
        style={{
          color: "#aaa",
          fontSize: "0.75rem",
          marginTop: "2rem",
          fontWeight: "500",
        }}
      >
        Farm2Market Uganda
      </p>
    </div>
  );
}
