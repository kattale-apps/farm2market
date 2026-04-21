"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { TraderDashboard } from "./TraderDashboard";
import { resolveCommunityLogo } from "../lib/communityLogos";

interface TransporterDashboardProps {
  userId: Id<"users">;
}

/**
 * Transporter Dashboard — thin wrapper around TraderDashboard
 * Transporters see the same trade/inventory/wallet UX as traders,
 * plus a community section so they can join and access communities.
 */
export function TransporterDashboard({ userId }: TransporterDashboardProps) {
  const communities = useQuery(api.communities.getActiveCommunities, { userId });
  const memberCommunities = Array.isArray(communities) ? communities.filter((c: any) => c.isMember) : [];

  return (
    <div>
      <div
        style={{
          marginBottom: "1.5rem",
          padding: "clamp(1rem, 3vw, 1.5rem)",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          border: "1px solid #e0e0e0",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3
            style={{
              margin: 0,
              fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)",
              color: "#2c2c2c",
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: "600",
              letterSpacing: "-0.01em",
            }}
          >
            🚛 My Communities
          </h3>
          <Link
            href="/farmer/communities"
            style={{
              padding: "0.4rem 0.8rem",
              background: "#1976d2",
              color: "#fff",
              textDecoration: "none",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: "600",
            }}
          >
            Browse All
          </Link>
        </div>
        {communities === undefined ? (
          <p style={{ color: "#999", fontSize: "0.9rem" }}>Loading communities...</p>
        ) : memberCommunities.length === 0 ? (
          <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
            You have not joined any communities yet. <Link href="/farmer/communities" style={{ color: "#1976d2", fontWeight: 600 }}>Browse communities</Link>
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
            {memberCommunities.map((community: any) => {
              const logo = resolveCommunityLogo(community);
              return (
                <Link
                  key={community.id}
                  href={`/community-only/noticeboard?communityId=${community.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div
                    style={{
                      borderRadius: "14px",
                      overflow: "hidden",
                      border: "1px solid #c8e6c9",
                      boxShadow: "0 2px 10px rgba(46,125,50,0.08)",
                      background: logo
                        ? `linear-gradient(rgba(255,255,255,0.92),rgba(255,255,255,0.92)), url('${logo}')`
                        : "#fff",
                      backgroundRepeat: "repeat",
                      backgroundSize: "120px",
                    }}
                  >
                    <div
                      style={{
                        padding: "1rem 1.25rem",
                        background: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)",
                        borderBottom: "2px solid #a5d6a7",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                      }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          background: "#fff",
                          border: "2px solid #43a047",
                          boxShadow: "0 2px 8px rgba(67,160,71,0.25)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          flexShrink: 0,
                        }}
                      >
                        {logo ? (
                          <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        ) : (
                          <span style={{ fontSize: "1.3rem", fontWeight: 800, color: "#43a047" }}>
                            {community.name?.charAt(0)?.toUpperCase() || "?"}
                          </span>
                        )}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h4
                          style={{
                            margin: 0,
                            fontSize: "0.95rem",
                            fontWeight: 700,
                            color: "#1b5e20",
                            textTransform: "uppercase",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {community.name}
                        </h4>
                      </div>
                    </div>
                    <div style={{ padding: "0.75rem 1.25rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span
                        style={{
                          padding: "0.2rem 0.6rem",
                          borderRadius: "999px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: "#e8f5e9",
                          color: "#2e7d32",
                          border: "1px solid #c8e6c9",
                        }}
                      >
                        ✅ Member
                      </span>
                      {community.isGlobal && (
                        <span
                          style={{
                            padding: "0.2rem 0.6rem",
                            borderRadius: "999px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            background: "#e3f2fd",
                            color: "#1565c0",
                            border: "1px solid #90caf9",
                          }}
                        >
                          Global
                        </span>
                      )}
                      {community.showMemberCount !== false && community.memberCount !== undefined && (
                        <span
                          style={{
                            padding: "0.2rem 0.6rem",
                            borderRadius: "999px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            background: "#f5f5f5",
                            color: "#666",
                            border: "1px solid #e0e0e0",
                          }}
                        >
                          {community.memberCount} members
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <TraderDashboard userId={userId} userRole="transporter" />
    </div>
  );
}
