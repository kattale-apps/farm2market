"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";

export default function CommunityDashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [userAdminCategory, setUserAdminCategory] = useState<string>("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [filterType, setFilterType] = useState<"all" | "phone" | "email" | "location">( "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState<"all" | "district" | "subcounty" | "parish">("all");

  // Get current user
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("pilot_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          setUserId(parsed.userId);
          setUserRole(parsed.role || "");
          setUserAdminCategory(parsed.adminCategory || "");
        } else {
          router.push("/login");
        }
      } catch (error) {
        router.push("/login");
      }
    }
  }, [router]);

  // Query communities (filtered to show only the user's community if they're a community admin)
  const communities = useQuery(api.communities.getActiveCommunities, userId ? { userId } : "skip");

  // Query export quota
  const exportQuota = useQuery(api.communities.getExportQuota, userId ? { userId } : "skip");

  // Mutation for logging exports
  const logExport = useMutation(api.communities.logExport);

  // For community admin: get their managed community
  const userCommunities = useMemo(() => {
    if (!communities || userAdminCategory !== "community") return [];
    // In a real app, we'd have a way to get the specific community managed by this admin
    // For now, we'll show all communities they're associated with
    return communities;
  }, [communities, userAdminCategory]);

  if (!userId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
        <p>Loading...</p>
      </div>
    );
  }

  // Only community admins can access this page
  if (userRole !== "admin" || userAdminCategory !== "community") {
    return (
      <div style={{
        padding: "2rem",
        textAlign: "center",
        color: "#c62828",
        background: "#ffebee",
        borderRadius: "8px",
        marginTop: "2rem",
        marginBottom: "2rem",
      }}>
        <h2>Access Denied</h2>
        <p>Only community admins can access this page.</p>
        <Link href="/" style={{
          color: "#1976d2",
          textDecoration: "none",
        }}>
          Go back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#fafafa",
      padding: "2rem",
    }}>
      <div style={{
        maxWidth: "1400px",
        margin: "0 auto",
      }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/" style={{
              fontSize: "0.9rem",
              color: "#1976d2",
              textDecoration: "none",
              marginBottom: "1rem",
              display: "inline-block",
            }}>
              ← Back
            </Link>
            <h1 style={{
              fontSize: "clamp(1.8rem, 5vw, 2.2rem)",
              marginTop: "0.5rem",
              color: "#2c2c2c",
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: "700",
              letterSpacing: "-0.02em",
            }}>
              🌾 Community Dashboard
            </h1>
          </div>
          <Link href="/admin/change-password" style={{
            padding: "0.75rem 1.5rem",
            background: "#ff9800",
            color: "#fff",
            borderRadius: "8px",
            textDecoration: "none",
            fontSize: "0.9rem",
            fontWeight: "600",
            whiteSpace: "nowrap",
          }}>
            🔒 Change Password
          </Link>
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

        {/* Communities */}
        {communities === undefined ? (
          <div style={{ textAlign: "center", color: "#999", padding: "2rem" }}>
            <p>Loading communities...</p>
          </div>
        ) : userCommunities.length === 0 ? (
          <div style={{
            background: "#fff",
            padding: "2rem",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            textAlign: "center",
          }}>
            <p style={{ color: "#999" }}>No communities found.</p>
          </div>
        ) : (
          userCommunities.map((community) => (
            <div
              key={community.id}
              style={{
                background: "#fff",
                borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                marginBottom: "2rem",
                overflow: "hidden",
              }}
            >
              {/* Community Header */}
              <div style={{
                padding: "1.5rem",
                background: "#f5f5f5",
                borderBottom: "2px solid #e0e0e0",
              }}>
                <h2 style={{
                  margin: "0 0 0.5rem 0",
                  fontSize: "1.5rem",
                  fontFamily: '"Montserrat", sans-serif',
                  fontWeight: "700",
                  color: "#2c2c2c",
                }}>
                  {community.name}
                </h2>
                {community.description && (
                  <p style={{
                    margin: "0",
                    color: "#666",
                    fontSize: "0.95rem",
                  }}>
                    {community.description}
                  </p>
                )}
                <div style={{
                  marginTop: "1rem",
                  display: "flex",
                  gap: "2rem",
                  fontSize: "0.9rem",
                  color: "#666",
                }}>
                  <div>
                    <strong>Members:</strong> {community.memberCount}
                  </div>
                  {community.isGlobal && <div>🌍 Global Community</div>}
                  {community.geoLocked && <div>📍 Geo-locked</div>}
                </div>
              </div>

              {/* Members Section */}
              {community.members && community.members.length > 0 ? (
                <div style={{ padding: "1.5rem" }}>
                  <h3 style={{
                    margin: "0 0 1rem 0",
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    color: "#2c2c2c",
                  }}>
                    👥 Members ({community.members.length})
                  </h3>

                  {/* Member List */}
                  <div style={{
                    overflowX: "auto",
                    marginTop: "1rem",
                  }}>
                    <table style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.9rem",
                    }}>
                      <thead>
                        <tr style={{
                          background: "#f5f5f5",
                          borderBottom: "2px solid #e0e0e0",
                        }}>
                          <th style={{
                            padding: "0.75rem",
                            textAlign: "left",
                            fontWeight: "600",
                            color: "#2c2c2c",
                          }}>
                            Farmer Name
                          </th>
                          <th style={{
                            padding: "0.75rem",
                            textAlign: "left",
                            fontWeight: "600",
                            color: "#2c2c2c",
                          }}>
                            Phone
                          </th>
                          <th style={{
                            padding: "0.75rem",
                            textAlign: "left",
                            fontWeight: "600",
                            color: "#2c2c2c",
                          }}>
                            Email
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {community.members.map((member, idx) => (
                          <tr
                            key={member.userId}
                            style={{
                              background: idx % 2 === 0 ? "#fff" : "#fafafa",
                              borderBottom: "1px solid #eee",
                            }}
                          >
                            <td style={{ padding: "0.75rem", color: "#2c2c2c" }}>
                              {member.alias}
                            </td>
                            <td style={{ padding: "0.75rem", color: "#666" }}>
                              {member.phoneNumber || "—"}
                            </td>
                            <td style={{ padding: "0.75rem", color: "#666" }}>
                              {member.email || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Export Quota Info */}
                  {exportQuota && (
                    <div style={{
                      marginTop: "1rem",
                      padding: "1rem",
                      background: exportQuota.remaining === 0 && exportQuota.serviceLevel === "Standard" ? "#ffebee" : "#e3f2fd",
                      borderRadius: "8px",
                      border: `1px solid ${exportQuota.remaining === 0 && exportQuota.serviceLevel === "Standard" ? "#ffcdd2" : "#bbdefb"}`,
                    }}>
                      <p style={{
                        margin: "0 0 0.5rem 0",
                        fontSize: "0.9rem",
                        color: "#1565c0",
                        fontWeight: "600",
                      }}>
                        📊 Service Level: {exportQuota.serviceLevel}
                      </p>
                      {exportQuota.serviceLevel === "Standard" ? (
                        <p style={{
                          margin: "0",
                          fontSize: "0.85rem",
                          color: exportQuota.remaining === 0 ? "#c62828" : "#666",
                        }}>
                          Exports used this month: {exportQuota.used}/{exportQuota.limit} | Remaining: <strong>{exportQuota.remaining}</strong>
                        </p>
                      ) : (
                        <p style={{
                          margin: "0",
                          fontSize: "0.85rem",
                          color: "#2e7d32",
                        }}>
                          ✓ Unlimited exports
                        </p>
                      )}
                    </div>
                  )}

                  {/* Export Button */}
                  <div style={{ marginTop: "1.5rem" }}>
                    <button
                      onClick={async () => {
                        if (!userId || !community.members) return;

                        setLoading(true);
                        setMessage(null);

                        try {
                          // Check quota and log export
                          await logExport({
                            userId,
                            exportType: "community_members",
                            dataCount: community.members.length,
                          });

                          // Export data
                          const exportData = community.members.map(m => ({
                            "Farmer Name": m.alias,
                            "Phone": m.phoneNumber || "",
                            "Email": m.email || "",
                          }));
                          const ws = XLSX.utils.json_to_sheet(exportData);
                          const wb = XLSX.utils.book_new();
                          XLSX.utils.book_append_sheet(wb, ws, "Members");
                          XLSX.writeFile(wb, `${community.name}-members.xlsx`);
                          setMessage({ type: "success", text: "Members exported successfully!" });
                        } catch (error: any) {
                          setMessage({ type: "error", text: error.message || "Failed to export members" });
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading || (exportQuota?.remaining === 0 && exportQuota?.serviceLevel === "Standard")}
                      style={{
                        padding: "0.75rem 1.5rem",
                        background: (exportQuota?.remaining === 0 && exportQuota?.serviceLevel === "Standard") || loading ? "#ccc" : "#2196f3",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "0.95rem",
                        fontWeight: "600",
                        cursor: (exportQuota?.remaining === 0 && exportQuota?.serviceLevel === "Standard") || loading ? "not-allowed" : "pointer",
                        opacity: (exportQuota?.remaining === 0 && exportQuota?.serviceLevel === "Standard") || loading ? 0.6 : 1,
                        transition: "all 0.3s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!loading && !(exportQuota?.remaining === 0 && exportQuota?.serviceLevel === "Standard")) {
                          (e.target as HTMLButtonElement).style.background = "#1976d2";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!loading && !(exportQuota?.remaining === 0 && exportQuota?.serviceLevel === "Standard")) {
                          (e.target as HTMLButtonElement).style.background = "#2196f3";
                        }
                      }}
                    >
                      {loading ? "Exporting..." : "📥 Export Members (Excel)"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: "1.5rem",
                  textAlign: "center",
                  color: "#999",
                }}>
                  <p>No members in this community yet.</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
