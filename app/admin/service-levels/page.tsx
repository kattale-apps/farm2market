"use client";

export const dynamic = "force-dynamic";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStoredUser } from "../../hooks/useStoredUser";

export default function ManageServiceLevelsPage() {
  const router = useRouter();
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  const userRole = user?.role ?? "";
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  // Get current user
  // (replaced by useStoredUser above)

  // Query all users (filtered to show only community admins)
  const allUsers = useQuery(api.introspection.getAllUsers, userId ? { adminId: userId } : "skip");

  // Mutation for setting service level
  const setServiceLevel = useMutation(api.communities.setUserServiceLevel);

  // Filter to show only community admins
  const communityAdmins = allUsers?.filter(
    (u) => u.role === "admin" && u.adminLevel === "junior" && u.adminCategory === "community"
  ) || [];

  // Filter based on search query
  const filteredAdmins = communityAdmins.filter((admin) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      admin.alias.toLowerCase().includes(query) ||
      admin.email?.toLowerCase().includes(query) ||
      admin.phoneNumber?.toLowerCase().includes(query)
    );
  });

  if (!userId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
        <p>Loading...</p>
      </div>
    );
  }

  // Only superadmins can access this page
  if (userRole !== "admin") {
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
        <p>Only superadmins can manage service levels.</p>
        <Link href="/" style={{
          color: "#1976d2",
          textDecoration: "none",
        }}>
          Go back to dashboard
        </Link>
      </div>
    );
  }

  const handleSetServiceLevel = async (adminId: Id<"users">, level: "Standard" | "Premium") => {
    if (!userId) return;

    setLoadingUserId(`${adminId}-${level}`);
    setMessage(null);

    try {
      await setServiceLevel({
        adminId: userId,
        userId: adminId,
        serviceLevel: level,
      });
      setMessage({ type: "success", text: "Service level updated successfully!" });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to update service level" });
    } finally {
      setLoadingUserId(null);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#fafafa",
      padding: "2rem",
    }}>
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
      }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <Link href="/" style={{
            fontSize: "0.9rem",
            color: "#1976d2",
            textDecoration: "none",
            marginBottom: "1rem",
            display: "inline-block",
          }}>
            ← Back to Admin Dashboard
          </Link>
          <h1 style={{
            fontSize: "clamp(1.8rem, 5vw, 2.2rem)",
            marginTop: "0.5rem",
            color: "#2c2c2c",
            fontFamily: '"Montserrat", sans-serif',
            fontWeight: "700",
            letterSpacing: "-0.02em",
          }}>
            ⚙️ Manage Service Levels
          </h1>
          <p style={{
            fontSize: "0.95rem",
            color: "#666",
            marginTop: "0.5rem",
          }}>
            Configure export quotas for community admins. Standard tier: 5 exports/month, Premium tier: unlimited.
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

        {/* Search */}
        <div style={{
          marginBottom: "2rem",
          display: "flex",
          gap: "1rem",
        }}>
          <input
            type="text"
            placeholder="Search community admins by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              border: "1px solid #ddd",
              fontSize: "0.95rem",
            }}
          />
        </div>

        {/* Community Admins Table */}
        {allUsers === undefined ? (
          <div style={{ textAlign: "center", color: "#999", padding: "2rem" }}>
            <p>Loading community admins...</p>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div style={{
            background: "#fff",
            padding: "2rem",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            textAlign: "center",
          }}>
            <p style={{ color: "#999" }}>
              {searchQuery ? "No community admins match your search." : "No community admins found."}
            </p>
          </div>
        ) : (
          <div style={{
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            overflow: "auto",
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
                    padding: "1rem",
                    textAlign: "left",
                    fontWeight: "600",
                    color: "#2c2c2c",
                  }}>
                    Admin Name
                  </th>
                  <th style={{
                    padding: "1rem",
                    textAlign: "left",
                    fontWeight: "600",
                    color: "#2c2c2c",
                  }}>
                    Contact
                  </th>
                  <th style={{
                    padding: "1rem",
                    textAlign: "center",
                    fontWeight: "600",
                    color: "#2c2c2c",
                  }}>
                    Current Service Level
                  </th>
                  <th style={{
                    padding: "1rem",
                    textAlign: "center",
                    fontWeight: "600",
                    color: "#2c2c2c",
                  }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.map((admin: any, idx) => (
                  <tr
                    key={admin.userId}
                    style={{
                      background: idx % 2 === 0 ? "#fff" : "#fafafa",
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    <td style={{
                      padding: "1rem",
                      color: "#2c2c2c",
                      fontWeight: "500",
                    }}>
                      {admin.alias}
                    </td>
                    <td style={{
                      padding: "1rem",
                      color: "#666",
                    }}>
                      <div style={{ fontSize: "0.85rem" }}>
                        {admin.email && <div>📧 {admin.email}</div>}
                        {admin.phoneNumber && <div>📱 {admin.phoneNumber}</div>}
                      </div>
                    </td>
                    <td style={{
                      padding: "1rem",
                      textAlign: "center",
                      color: "#2c2c2c",
                      fontWeight: "600",
                    }}>
                      <span style={{
                        padding: "0.35rem 0.75rem",
                        borderRadius: "6px",
                        background: (admin as any).serviceLevel === "Premium" ? "#e8f5e9" : "#fff3e0",
                        color: (admin as any).serviceLevel === "Premium" ? "#2e7d32" : "#e65100",
                        fontSize: "0.85rem",
                      }}>
                        {(admin as any).serviceLevel || "Standard"}
                      </span>
                    </td>
                    <td style={{
                      padding: "1rem",
                      textAlign: "center",
                    }}>
                      <div style={{
                        display: "flex",
                        gap: "0.5rem",
                        justifyContent: "center",
                      }}>
                        <button
                          onClick={() => handleSetServiceLevel(admin.userId, "Standard")}
                          disabled={loadingUserId === `${admin.userId}-Standard` || (admin as any).serviceLevel === "Standard"}
                          style={{
                            padding: "0.5rem 1rem",
                            background: (admin as any).serviceLevel === "Standard" ? "#c8e6c9" : "#f5f5f5",
                            color: (admin as any).serviceLevel === "Standard" ? "#2e7d32" : "#666",
                            border: (admin as any).serviceLevel === "Standard" ? "1px solid #81c784" : "1px solid #ddd",
                            borderRadius: "6px",
                            fontSize: "0.8rem",
                            fontWeight: "600",
                            cursor: loadingUserId === `${admin.userId}-Standard` || (admin as any).serviceLevel === "Standard" ? "not-allowed" : "pointer",
                            opacity: loadingUserId === `${admin.userId}-Standard` || (admin as any).serviceLevel === "Standard" ? 0.6 : 1,
                            transition: "all 0.3s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (loadingUserId !== `${admin.userId}-Standard` && (admin as any).serviceLevel !== "Standard") {
                              (e.target as HTMLButtonElement).style.background = "#e0e0e0";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (loadingUserId !== `${admin.userId}-Standard` && (admin as any).serviceLevel !== "Standard") {
                              (e.target as HTMLButtonElement).style.background = "#f5f5f5";
                            }
                          }}
                        >
                          {loadingUserId === `${admin.userId}-Standard` ? "..." : "Standard"}
                        </button>
                        <button
                          onClick={() => handleSetServiceLevel(admin.userId, "Premium")}
                          disabled={loadingUserId === `${admin.userId}-Premium` || (admin as any).serviceLevel === "Premium"}
                          style={{
                            padding: "0.5rem 1rem",
                            background: (admin as any).serviceLevel === "Premium" ? "#c8e6c9" : "#f5f5f5",
                            color: (admin as any).serviceLevel === "Premium" ? "#2e7d32" : "#666",
                            border: (admin as any).serviceLevel === "Premium" ? "1px solid #81c784" : "1px solid #ddd",
                            borderRadius: "6px",
                            fontSize: "0.8rem",
                            fontWeight: "600",
                            cursor: loadingUserId === `${admin.userId}-Premium` || (admin as any).serviceLevel === "Premium" ? "not-allowed" : "pointer",
                            opacity: loadingUserId === `${admin.userId}-Premium` || (admin as any).serviceLevel === "Premium" ? 0.6 : 1,
                            transition: "all 0.3s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (loadingUserId !== `${admin.userId}-Premium` && (admin as any).serviceLevel !== "Premium") {
                              (e.target as HTMLButtonElement).style.background = "#e0e0e0";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (loadingUserId !== `${admin.userId}-Premium` && (admin as any).serviceLevel !== "Premium") {
                              (e.target as HTMLButtonElement).style.background = "#f5f5f5";
                            }
                          }}
                        >
                          {loadingUserId === `${admin.userId}-Premium` ? "..." : "Premium"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
