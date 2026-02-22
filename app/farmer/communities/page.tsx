"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function FarmerCommunitiesPage() {
  // Inject responsive styles for farmer communities (client-side only)
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @media (max-width: 700px) {
        .farmer-communities-grid {
          grid-template-columns: 1fr !important;
          gap: 1rem !important;
        }
        .farmer-communities-header {
          padding: 1rem !important;
          font-size: 1.2rem !important;
        }
      }
      @media (min-width: 701px) {
        .farmer-communities-grid {
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)) !important;
          gap: 2rem !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const router = useRouter();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState<Id<"communities"> | null>(null);
  const agroFreshCommunityId = process.env.NEXT_PUBLIC_AGROFRESH_COMMUNITY_ID;
  const bioFarmCommunityId = "ms72de3njrrc9k43cf9h3yq70181ncp0";
  const deiAgroCommunityId = "ms7d11zfqswjbcvqer43pdzf6x80aate";
  const communities = useQuery(api.communities.getActiveCommunities, userId ? { userId } : "skip");
  const myDrafts = useQuery(api.farmValidation.getMyDrafts, userId ? { farmerId: userId } : "skip");
  const latestForm = useQuery(api.farmValidation.getLatestFormForFarmer, userId ? { farmerId: userId } : "skip");
  const latestApplicationStatus = useQuery(
    (api as any).communityApplications.getMyApplicationStatus,
    latestForm?._id && userId
      ? { farmerId: userId, formId: latestForm._id }
      : "skip"
  );
  const joinCommunity = useMutation(api.communities.joinCommunity);
  const leaveCommunity = useMutation(api.communities.leaveCommunity);
  const createNewValidation = useMutation(api.farmValidation.createNewDraft) as (
    args: { farmerId: Id<"users"> }
  ) => Promise<Id<"agroFreshUGFarmValidations">>;
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

  useEffect(() => {
    if (!communities || !agroFreshCommunityId) return;
    const found = communities.some((c) => c.id === agroFreshCommunityId);
    if (!found) {
      console.warn("[DEBUG] AgroFresh community ID not found in list:", agroFreshCommunityId, communities);
    }
  }, [communities, agroFreshCommunityId]);

  const normalizeCommunityKey = (value?: string) => (value || "").toLowerCase();

  const isAgroFreshCommunity = (community: { id: Id<"communities">; name?: string; description?: string }) => {
    if (agroFreshCommunityId && community.id === agroFreshCommunityId) return true;
    const nameKey = normalizeCommunityKey(community.name);
    const descriptionKey = normalizeCommunityKey(community.description);
    return nameKey.includes("agrofresh") || descriptionKey.includes("agrofresh");
  };

  const isBioFarmCommunity = (community: { id: Id<"communities">; name?: string; description?: string }) => {
    return community.id === bioFarmCommunityId;
  };

  const isDeiAgroCommunity = (community: { id: Id<"communities">; name?: string; description?: string }) => {
    return community.id === deiAgroCommunityId;
  };

  const getCommunityLogo = (community: { id: Id<"communities">; name?: string; description?: string; logoPath?: string }) => {
    if (community.logoPath) return community.logoPath;
    if (isAgroFreshCommunity(community)) return "/agrofreshlogo.png";
    if (isBioFarmCommunity(community)) return "/biofarmlogo.jpeg";
    if (isDeiAgroCommunity(community)) return "/deilogo.png";
    return undefined;
  };

  const getCommunityStatus = (community: { id: Id<"communities">; name?: string; description?: string; isMember?: boolean }) => {
    if (isAgroFreshCommunity(community)) {
      return latestApplicationStatus?.status || (latestForm?.status === "SUBMITTED" ? "PENDING" : "DRAFT");
    }
    return community.isMember ? "APPROVED" : "NOT_MEMBER";
  };

  const getLatestDraftId = () => {
    if (!myDrafts || myDrafts.length === 0) return null;
    const sorted = [...myDrafts].sort((a: any, b: any) => {
      const aTime = a.updatedAt ?? a.createdAt ?? a._creationTime ?? 0;
      const bTime = b.updatedAt ?? b.createdAt ?? b._creationTime ?? 0;
      return bTime - aTime;
    });
    return sorted[0]?._id ?? null;
  };

  const handleJoinCommunity = async (community: { id: Id<"communities">; name: string; description?: string }) => {
    if (!userId) return;
    console.log("[DEBUG] join community click:", community);
    setLoadingAction(`join-${community.id}`);
    setMessage(null);
    try {
      if (isAgroFreshCommunity(community)) {
        const latestDraftId = getLatestDraftId();
        if (latestDraftId) {
          router.push(`/farm-validation/${latestDraftId}`);
        } else {
          const newFormId = await createNewValidation({ farmerId: userId });
          router.push(`/farm-validation/${newFormId}`);
        }
        setMessage({ type: "success", text: "Please complete the AGROFRESH UG validation form to finish joining." });
        return;
      }

      await joinCommunity({ farmerId: userId, communityId: community.id });
      setMessage({ type: "success", text: "Successfully joined the community!" });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to join community" });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleLeaveCommunity = async (communityId: Id<"communities">) => {
    if (!userId) return;
    console.log("[DEBUG] leave community click:", communityId);
    setLoadingAction(`leave-${communityId}`);
    setMessage(null);
    try {
      await leaveCommunity({ farmerId: userId, communityId });
      setMessage({ type: "success", text: "Successfully left the community" });
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
        width: "100vw",
        background: `linear-gradient(180deg, #f5fbe7 0%, #e8f5e9 100%), url('/backgrounds/farm-bg.jpg') center center/cover no-repeat`,
        backgroundBlendMode: "multiply",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
          padding: "clamp(1rem, 4vw, 2rem)",
        }}
      >
        {/* Header */}
        <div
          style={{
            marginBottom: "2rem",
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            padding: "1.5rem 1.2rem 1.2rem 1.2rem",
            maxWidth: 700,
            marginLeft: "auto",
            marginRight: "auto",
            marginTop: 24,
          }}
        >
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.65rem 1.1rem",
              borderRadius: "999px",
              background: "#ffffff",
              color: "#1b5e20",
              textDecoration: "none",
              fontWeight: 700,
              border: "1px solid #e0e0e0",
              boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
              marginBottom: "1rem",
            }}
          >
            ← Back to Home
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "1.5rem",
              marginBottom: "2rem",
            }}
            className="farmer-communities-grid"
          >
            {communities.map((community) => {
              const headerLogo = getCommunityLogo(community);

              return (
                <div
                  key={community.id}
                  style={{
                    background: community.isGlobal
                      ? "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)"
                      : community.geoLocked
                      ? "linear-gradient(135deg, #fffde7 0%, #f9fbe7 100%)"
                      : "linear-gradient(135deg, #f1f8e9 0%, #dcedc8 100%)",
                    borderRadius: "18px",
                    overflow: "hidden",
                    transition: "all 0.3s ease",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    position: "relative",
                    borderTop: community.isMember ? "2.5px solid #388e3c" : "2px solid #c5e1a5",
                    borderLeft: community.isMember ? "2.5px solid #388e3c" : "2px solid #c5e1a5",
                    borderRight: community.isMember ? "2.5px solid #388e3c" : "2px solid #c5e1a5",
                    borderBottom: community.isGlobal ? "4px solid #43a047" : community.geoLocked ? "4px solid #fbc02d" : "4px solid #8bc34a",
                    boxShadow: community.isMember
                      ? "0 0 16px 4px #43a04799, 0 6px 24px rgba(76,175,80,0.10)"
                      : community.isGlobal
                      ? "0 0 16px 4px #43a04755, 0 6px 24px rgba(76,175,80,0.10)"
                      : community.geoLocked
                      ? "0 0 16px 4px #fbc02d55, 0 6px 24px rgba(76,175,80,0.10)"
                      : "0 0 16px 4px #8bc34a55, 0 6px 24px rgba(76,175,80,0.10)",
                    cursor: "pointer",
                    outline: selectedCommunityId === community.id ? "3px solid #1976d2" : "none",
                  }}
                  onClick={() => {
                    setSelectedCommunityId((prev) => (prev === community.id ? null : community.id));
                  }}
                >
                <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
                  {/* Card Header */}
                  <div style={{
                    padding: "1.5rem",
                    background: community.isMember ? "#e8f5e9" : community.isGlobal ? "#f1f8e9" : community.geoLocked ? "#fffde7" : "#f9fbe7",
                    borderBottom: `2.5px solid ${community.isMember ? "#388e3c" : community.isGlobal ? "#43a047" : community.geoLocked ? "#fbc02d" : "#8bc34a"}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      {headerLogo && (
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: "50%",
                            background: "#ffffff",
                            border: "2px solid #43a047",
                            boxShadow: "0 0 0 4px rgba(67,160,71,0.25), 0 10px 18px rgba(67,160,71,0.35)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                            flexShrink: 0,
                          }}
                        >
                          <Image
                            src={headerLogo}
                            alt={`${community.name} logo`}
                            width={52}
                            height={52}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </div>
                      )}
                      <div>
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
                    </div>
                  </div>

                  {/* Card Body */}
                  <div style={{
                    padding: "1.5rem",
                    flex: "1",
                    position: "relative",
                  }}>
                    {headerLogo && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          backgroundImage: `url('${headerLogo}')`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          backgroundRepeat: "no-repeat",
                          opacity: 0.08,
                          pointerEvents: "none",
                        }}
                      />
                    )}
                    <div style={{ marginBottom: "1rem" }}>
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
                    {isAgroFreshCommunity(community) && latestForm && (
                      <div style={{
                        marginTop: "0.75rem",
                        padding: "0.75rem",
                        borderRadius: 10,
                        background: "#ffffff",
                        border: "1px solid #e0e0e0",
                      }}>
                        <div style={{ fontWeight: 700, color: "#2e7d32" }}>AGROFRESH UG Form</div>
                        <div style={{ fontSize: "0.9rem", color: "#555", marginTop: 4 }}>
                          Status: {latestApplicationStatus?.status || "DRAFT"}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#777", marginTop: 4 }}>
                          Last updated: {latestForm.updatedAt ? new Date(latestForm.updatedAt).toLocaleString() : "-"}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/farm-validation/${latestForm._id}`);
                          }}
                          style={{
                            marginTop: "0.5rem",
                            padding: "0.5rem 0.8rem",
                            borderRadius: 8,
                            background: "#1976d2",
                            color: "#fff",
                            border: "none",
                            fontSize: "0.85rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          View Form
                        </button>
                      </div>
                    )}
                  </div>

                  {selectedCommunityId === community.id && (
                    <div style={{
                      marginTop: "1rem",
                      padding: "1rem",
                      borderRadius: 12,
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                    }}>
                      <div style={{ fontWeight: 700, color: "#1b5e20", marginBottom: "0.5rem" }}>
                        Community View
                      </div>
                      {getCommunityStatus(community) === "PENDING" && isAgroFreshCommunity(community) && latestForm ? (
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Pending — Your Submitted Profile</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.5rem" }}>
                            <div><strong>Name:</strong> {latestForm.section1?.farmerFullName || "-"}</div>
                            <div><strong>Farm:</strong> {latestForm.section1?.farmName || "-"}</div>
                            <div><strong>Phone:</strong> {latestForm.section1?.phoneNumber || "-"}</div>
                            <div><strong>District:</strong> {latestForm.section1?.districtSubCounty || "-"}</div>
                            <div><strong>Village:</strong> {latestForm.section1?.village || "-"}</div>
                            </div>
                          </div>
                      ) : getCommunityStatus(community) === "APPROVED" ? (
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Admin Posts</div>
                          <div style={{ color: "#6b7280" }}>No posts yet. Community updates will appear here.</div>
                        </div>
                      ) : (
                        <div style={{ color: "#6b7280" }}>Join this community to view member content.</div>
                      )}
                    </div>
                  )}
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
                        getCommunityStatus(community) === "PENDING" && isAgroFreshCommunity(community) ? (
                          <div style={{ color: "#b45309", fontWeight: 600 }}>Pending approval</div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleJoinCommunity({ id: community.id, name: community.name });
                            }}
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
                        )
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLeaveCommunity(community.id);
                          }}
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
                          onClick={() => handleJoinCommunity({ id: community.id, name: community.name })}
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
              </div>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
