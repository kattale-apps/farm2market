"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function FarmerCommunitiesPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Query communities
  const communities = useQuery(api.communities.getActiveCommunities, userId ? { userId } : "skip");

  // Mutations
  const joinCommunity = useMutation(api.communities.joinCommunity);
  const leaveCommunity = useMutation(api.communities.leaveCommunity);

  // Get user ID from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("pilot_user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserId(parsed.userId);
      } catch (e) {
        console.error("Failed to parse stored user:", e);
        router.push("/login");
      }
    } else {
      router.push("/login");
    }
  }, [router]);

  const handleJoinCommunity = async (communityId: Id<"communities">) => {
    if (!userId) return;

    setLoadingAction(`join-${communityId}`);
    setMessage(null);

    try {
      await joinCommunity({ farmerId: userId, communityId });
      setMessage({ type: "success", text: "Successfully joined the community!" });
      // The query will automatically update
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to join community" });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleLeaveCommunity = async (communityId: Id<"communities">) => {
    if (!userId) return;

    setLoadingAction(`leave-${communityId}`);
    setMessage(null);

    try {
      await leaveCommunity({ farmerId: userId, communityId });
      setMessage({ type: "success", text: "Successfully left the community" });
      // The query will automatically update
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to leave community" });
    } finally {
      setLoadingAction(null);
    }
  };

  if (!userId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
        <p>Loading...</p>
      </div>
    );
  }

  // Debug: log userId and communities
  console.log("[DEBUG] userId:", userId, "communities:", communities);
  return (
    <div
      style={{
        minHeight: "100vh",
        background: `url('/backgrounds/farm-bg.jpg') center center/cover no-repeat, linear-gradient(180deg, #f5fbe7 0%, #e8f5e9 100%)`,
        padding: "2rem",
      }}
    >
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
      }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <Link href="/farmer/profile" style={{
            fontSize: "0.9rem",
            color: "#1976d2",
            textDecoration: "none",
            marginBottom: "1rem",
            display: "inline-block",
          }}>
            ← Back to Profile
          </Link>
          <h1 style={{
            fontSize: "clamp(1.8rem, 5vw, 2.2rem)",
            marginBottom: "0.5rem",
            color: "#2c2c2c",
            fontFamily: '"Montserrat", sans-serif',
            fontWeight: "700",
            letterSpacing: "-0.02em",
          }}>
            🌾 Grower Communities
          </h1>
          <p style={{
            fontSize: "1rem",
            color: "#666",
            marginTop: "0.5rem",
          }}>
            Join communities to connect with other farmers, share experiences, and grow together.
          </p>
        </div>

        {/* Message Alert */}
        {message && (
          <div style={{
            padding: "1rem",
            marginBottom: "2rem",
            borderRadius: "8px",
            background: message.type === "success" ? "#e8f5e9" : "#ffebee",
            color: message.type === "success" ? "#2e7d32" : "#c62828",
            border: `1px solid ${message.type === "success" ? "#c8e6c9" : "#ffcdd2"}`,
          }}>
            {message.text}
          </div>
        )}

        {/* Communities Grid */}
        {communities === undefined ? (
          <div style={{ textAlign: "center", color: "#999", padding: "2rem" }}>
            <p>Loading communities...</p>
          </div>
        ) : communities.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "3rem",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}>
            <p style={{ fontSize: "1.1rem", color: "#999" }}>
              No communities available for your location yet.
            </p>
            <p style={{ fontSize: "0.9rem", color: "#ccc", marginTop: "0.5rem" }}>
              Check back soon as more communities are created!
            </p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
            gap: "2rem",
            marginBottom: "2rem",
          }}>
            {communities.map((community) => (
              <div
                key={community.id}
                style={{
                  background: community.isGlobal
                    ? "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)"
                    : community.geoLocked
                    ? "linear-gradient(135deg, #fffde7 0%, #f9fbe7 100%)"
                    : "linear-gradient(135deg, #f1f8e9 0%, #dcedc8 100%)",
                  borderRadius: "18px",
                  boxShadow: "0 0 16px 4px rgba(76, 175, 80, 0.25), 0 6px 24px rgba(76,175,80,0.10)",
                  overflow: "hidden",
                  transition: "all 0.3s ease",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  border: community.isMember ? "2.5px solid #388e3c" : "2px solid #c5e1a5",
                  borderBottom: community.isGlobal ? "4px solid #43a047" : community.geoLocked ? "4px solid #fbc02d" : "4px solid #8bc34a",
                  boxShadow: community.isMember
                    ? "0 0 16px 4px #43a04799, 0 6px 24px rgba(76,175,80,0.10)"
                    : community.isGlobal
                    ? "0 0 16px 4px #43a04755, 0 6px 24px rgba(76,175,80,0.10)"
                    : community.geoLocked
                    ? "0 0 16px 4px #fbc02d55, 0 6px 24px rgba(76,175,80,0.10)"
                    : "0 0 16px 4px #8bc34a55, 0 6px 24px rgba(76,175,80,0.10)",
                }}
              >
                {/* Card Header */}
                <div style={{
                  padding: "1.5rem",
                  background: community.isMember ? "#e8f5e9" : community.isGlobal ? "#f1f8e9" : community.geoLocked ? "#fffde7" : "#f9fbe7",
                  borderBottom: `2.5px solid ${community.isMember ? "#388e3c" : community.isGlobal ? "#43a047" : community.geoLocked ? "#fbc02d" : "#8bc34a"}`,
                }}>
                  <h3 style={{
                    margin: "0 0 0.5rem 0",
                    fontSize: "1.3rem",
                    fontFamily: '"Montserrat", sans-serif',
                    fontWeight: "700",
                    color: "#2c2c2c",
                  }}>
                    {community.name}
                  </h3>
                  {community.description && (
                    <p style={{
                      margin: "0",
                      fontSize: "0.9rem",
                      color: "#666",
                      lineHeight: "1.4",
                    }}>
                      {community.description}
                    </p>
                  )}
                </div>

                {/* Card Body */}
                <div style={{
                  padding: "1.5rem",
                  flex: "1",
                }}>
                  <div style={{ marginBottom: "1rem" }}>
                    <p style={{
                      margin: "0.5rem 0",
                      fontSize: "0.9rem",
                      color: "#666",
                    }}>
                      <strong>Members:</strong> {community.memberCount}
                    </p>
                    {community.geoLocked && (
                      <p style={{
                        margin: "0.5rem 0",
                        fontSize: "0.9rem",
                        color: "#ff9800",
                      }}>
                        📍 Geo-locked (available in your region)
                      </p>
                    )}
                    {community.isGlobal && (
                      <p style={{
                        margin: "0.5rem 0",
                        fontSize: "0.9rem",
                        color: "#2196f3",
                      }}>
                        🌍 Global community
                      </p>
                    )}
                    {community.isMember && (
                      <p style={{
                        margin: "0.5rem 0",
                        fontSize: "0.9rem",
                        color: "#4caf50",
                        fontWeight: "600",
                      }}>
                        ✓ You are a member
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div style={{
                  padding: "1.5rem",
                  borderTop: "1px solid #eee",
                  display: "flex",
                  gap: "1rem",
                }}>
                  {/* Always show buttons for debug if isMember is missing */}
                  {typeof community.isMember === "boolean" ? (
                    !community.isMember ? (
                      <button
                        onClick={() => handleJoinCommunity(community.id)}
                        disabled={loadingAction === `join-${community.id}`}
                        style={{
                          flex: 1,
                          padding: "0.75rem 1.5rem",
                          background: "#4caf50",
                          color: "#fff",
                          border: "none",
                          borderRadius: "8px",
                          fontSize: "0.95rem",
                          fontWeight: "600",
                          cursor: loadingAction === `join-${community.id}` ? "not-allowed" : "pointer",
                          opacity: loadingAction === `join-${community.id}` ? 0.6 : 1,
                          transition: "all 0.3s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (loadingAction !== `join-${community.id}`) {
                            (e.target as HTMLButtonElement).style.background = "#45a049";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (loadingAction !== `join-${community.id}`) {
                            (e.target as HTMLButtonElement).style.background = "#4caf50";
                          }
                        }}
                      >
                        {loadingAction === `join-${community.id}` ? "Joining..." : "Join Community"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleLeaveCommunity(community.id)}
                        disabled={loadingAction === `leave-${community.id}`}
                        style={{
                          flex: 1,
                          padding: "0.75rem 1.5rem",
                          background: "#f44336",
                          color: "#fff",
                          border: "none",
                          borderRadius: "8px",
                          fontSize: "0.95rem",
                          fontWeight: "600",
                          cursor: loadingAction === `leave-${community.id}` ? "not-allowed" : "pointer",
                          opacity: loadingAction === `leave-${community.id}` ? 0.6 : 1,
                          transition: "all 0.3s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (loadingAction !== `leave-${community.id}`) {
                            (e.target as HTMLButtonElement).style.background = "#da190b";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (loadingAction !== `leave-${community.id}`) {
                            (e.target as HTMLButtonElement).style.background = "#f44336";
                          }
                        }}
                      >
                        {loadingAction === `leave-${community.id}` ? "Leaving..." : "Leave Community"}
                      </button>
                    )
                  ) : (
                    <div style={{ color: "#ff9800", fontWeight: 600 }}>
                      [Debug] isMember missing - showing both buttons
                      <button
                        onClick={() => handleJoinCommunity(community.id)}
                        style={{ marginRight: 8, background: "#4caf50", color: "#fff", border: "none", borderRadius: 8, padding: "0.5rem 1rem" }}
                      >Join Community</button>
                      <button
                        onClick={() => handleLeaveCommunity(community.id)}
                        style={{ background: "#f44336", color: "#fff", border: "none", borderRadius: 8, padding: "0.5rem 1rem" }}
                      >Leave Community</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
