"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

/* ───────────────── Types ───────────────── */

type AnyUser = {
  userId: Id<"users">;
  alias: string;
  email?: string;
  phoneNumber?: string;
  role: "farmer" | "trader" | "buyer" | "admin" | "vendor" | "transporter" | "store";
  adminLevel?: "super" | "junior";
  adminCategory?: "community" | "store" | "message" | "finance";
  assignedCommunityIds?: Id<"communities">[];
};

type AdminLevel = "super" | "junior" | "";
type AdminCategory = "community" | "store" | "message" | "finance" | "";

type EditAdminState = {
  adminLevel: AdminLevel;
  adminCategory: AdminCategory;
  assignedCommunityIds: string[];
};

type CreateAdminState = {
  email: string;
  adminLevel: "junior";
  adminCategory: AdminCategory;
  assignedCommunityIds: string[];
};

/* ───────────────── Styles ───────────────── */

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "clamp(1rem, 5vw, 2rem)",
  background: "linear-gradient(135deg, #f3f6f4 0%, #e8f5e9 100%)",
  boxSizing: "border-box",
};

const farmCardStyle: React.CSSProperties = {
  backgroundImage: "url('/backgrounds/farm-bg.jpg')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  borderRadius: "22px",
  padding: "clamp(1rem, 3vw, 2rem)",
  boxShadow: "0 14px 36px rgba(0,0,0,0.12)",
  boxSizing: "border-box",
};

const glassPanelStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.82)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  borderRadius: "16px",
  padding: "clamp(1rem, 3vw, 1.75rem)",
  boxSizing: "border-box",
};

/* ───────────────── Page ───────────────── */

export default function AdminRoleManagementPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<AnyUser | null>(null);
  const [editData, setEditData] = useState<EditAdminState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createData, setCreateData] = useState<CreateAdminState>({
    email: "",
    adminLevel: "junior",
    adminCategory: "community",
    assignedCommunityIds: [],
  });
  const [createMessage, setCreateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  /* Load pilot user */
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pilot_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        setUserId(parsed.userId as Id<"users">);
      }
    } catch (err) {
      console.error("Failed to load pilot user", err);
    }
  }, []);

  const allUsers = useQuery(
    api.introspection.getAllUsers,
    userId ? { adminId: userId } : "skip"
  );

  const communities = useQuery(
    api.communities.getActiveCommunities,
    userId ? { userId } : "skip"
  );

  const updateUser = useMutation(api.auth.updateUserRoleAndAssignment);
  const createUser = useMutation(api.auth.createUser);
  const deleteAdmin = useMutation(api.adminRoleManagement.deleteAdmin);

  /* ✅ Filter admins WITHOUT retyping */
  const admins = useMemo(
    () => (allUsers ?? []).filter((u) => u.role === "admin"),
    [allUsers]
  );

  /* ───────────── Handlers ───────────── */

  const handleEdit = (admin: AnyUser) => {
    if (admin.role !== "admin") return;

    setSelectedAdmin(admin);
    setEditData({
      adminLevel: admin.adminLevel ?? "",
      adminCategory: admin.adminCategory ?? "",
      assignedCommunityIds:
        admin.assignedCommunityIds?.map((id) => id.toString()) ?? [],
    });
  };

  const handleSave = async () => {
    if (!selectedAdmin || !editData || selectedAdmin.role !== "admin") return;

    try {
      await updateUser({
        userId: selectedAdmin.userId,
        adminLevel: editData.adminLevel || undefined,
        adminCategory: editData.adminCategory || undefined,
        assignedCommunityIds: editData.assignedCommunityIds.map(
          (id) => id as Id<"communities">
        ),
      });

      setMessage("Admin updated successfully");
      setSelectedAdmin(null);
      setEditData(null);
    } catch (err: any) {
      setMessage(err?.message ?? "Failed to update admin");
    }
  };

  const handleCreateAdmin = async () => {
    if (!userId || !createData.email.trim()) {
      setCreateMessage({ type: "error", text: "Email is required" });
      return;
    }

    if (!createData.adminCategory) {
      setCreateMessage({ type: "error", text: "Admin category is required" });
      return;
    }

    setIsCreating(true);
    try {
      await createUser({
        email: createData.email.trim(),
        role: "admin",
        adminLevel: "junior",
        adminCategory: createData.adminCategory || undefined,
        creatorAdminId: userId,
      });

      setCreateMessage({ type: "success", text: "Junior admin created successfully!" });
      setCreateData({
        email: "",
        adminLevel: "junior",
        adminCategory: "community",
        assignedCommunityIds: [],
      });
      setShowCreateForm(false);
    } catch (err: any) {
      setCreateMessage({ type: "error", text: err.message || "Failed to create admin" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!selectedAdmin || !userId) return;
    
    // Prevent deletion of superadmin
    if (selectedAdmin.adminLevel === "super") {
      setMessage("Cannot delete a superadmin");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedAdmin.alias} (${selectedAdmin.email})? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteAdmin({
        adminId: userId,
        targetAdminId: selectedAdmin.userId,
      });

      setMessage("Admin deleted successfully");
      setSelectedAdmin(null);
      setEditData(null);
    } catch (err: any) {
      setMessage(err?.message ?? "Failed to delete admin");
    }
  };

  /* ───────────────── UI ───────────────── */

  return (
    <div style={containerStyle}>
      <div style={farmCardStyle}>
        <div style={glassPanelStyle}>
          {/* Header with Back Button */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div style={{ flex: 1 }}>
              <h1
                style={{
                  margin: "0 0 0.5rem 0",
                  fontSize: "clamp(1.5rem, 5vw, 2rem)",
                  fontWeight: "700",
                  color: "#1a1a1a",
                }}
              >
                Admin Role Management
              </h1>
              <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>
                Manage admin roles and permissions
              </p>
            </div>
            <button
              onClick={() => router.push("/")}
              style={{
                padding: "0.6rem 1.2rem",
                background: "#f5f5f5",
                border: "1px solid #ccc",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "0.9rem",
                transition: "background 0.2s",
                whiteSpace: "nowrap",
                minHeight: "44px",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#e0e0e0")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#f5f5f5")
              }
            >
              ← Back to Dashboard
            </button>
          </div>

          {/* Message Alert */}
          {message && (
            <div
              style={{
                margin: "1rem 0",
                padding: "0.75rem 1rem",
                background: "#e8f5e9",
                color: "#2e7d32",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: "0.95rem",
              }}
            >
              ✓ {message}
            </div>
          )}

          {/* Create New Admin Section */}
          <div style={{ marginBottom: "1.5rem" }}>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              style={{
                padding: "0.75rem 1.5rem",
                background: showCreateForm ? "#ff9800" : "#4caf50",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "0.95rem",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = showCreateForm ? "#f57c00" : "#388e3c")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = showCreateForm ? "#ff9800" : "#4caf50")
              }
            >
              {showCreateForm ? "✕ Cancel" : "+ Create Junior Admin"}
            </button>
          </div>

          {/* Create Admin Form */}
          {showCreateForm && !selectedAdmin && (
            <div
              style={{
                marginBottom: "1.5rem",
                background: "#fafafa",
                padding: "1.5rem",
                borderRadius: "12px",
                border: "1px solid #e0e0e0",
              }}
            >
              <h2 style={{ margin: "0 0 1rem 0", color: "#1a1a1a" }}>
                Create New Junior Admin
              </h2>

              {createMessage && (
                <div
                  style={{
                    marginBottom: "1rem",
                    padding: "0.75rem 1rem",
                    background: createMessage.type === "success" ? "#e8f5e9" : "#ffebee",
                    color: createMessage.type === "success" ? "#2e7d32" : "#c62828",
                    borderRadius: "8px",
                    fontSize: "0.9rem",
                  }}
                >
                  {createMessage.text}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                {/* Email */}
                <div style={{ gridColumn: isMobile ? "1" : "1 / 3" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    placeholder="admin@example.com"
                    value={createData.email}
                    onChange={(e) => setCreateData({ ...createData, email: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "0.6rem",
                      border: "1px solid #ccc",
                      borderRadius: "6px",
                      fontSize: "0.9rem",
                      boxSizing: "border-box",
                      minHeight: "44px",
                    }}
                  />
                </div>

                {/* Category */}
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                    Admin Category *
                  </label>
                  <select
                    value={createData.adminCategory}
                    onChange={(e) => setCreateData({ ...createData, adminCategory: e.target.value as AdminCategory })}
                    style={{
                      width: "100%",
                      padding: "0.6rem",
                      border: "1px solid #ccc",
                      borderRadius: "6px",
                      fontSize: "0.9rem",
                      boxSizing: "border-box",
                      minHeight: "44px",
                    }}
                  >
                    <option value="">Select category...</option>
                    <option value="community">Community Admin</option>
                    <option value="store">Store Admin</option>
                    <option value="message">Message Admin</option>
                    <option value="finance">Finance Admin</option>
                  </select>
                </div>
              </div>

              {/* Communities - Only show for Community Admins */}
              {createData.adminCategory === "community" && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.75rem",
                      fontWeight: "600",
                      color: "#333",
                      fontSize: "0.95rem",
                    }}
                  >
                    Assign Communities (Optional)
                  </label>
                  {communities && communities.length > 0 ? (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(250px, 1fr))",
                      gap: "0.75rem",
                    }}>
                      {communities.map((community) => (
                        <div
                          key={community.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            padding: "0.75rem",
                            background: "#f9f9f9",
                            border: "1px solid #e0e0e0",
                            borderRadius: "8px",
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                          onClick={() => {
                            const assigned = createData.assignedCommunityIds;
                            const isSelected = assigned.includes(community.id.toString());
                            setCreateData({
                              ...createData,
                              assignedCommunityIds: isSelected
                                ? assigned.filter((id) => id !== community.id.toString())
                                : [...assigned, community.id.toString()],
                            });
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#f0f7ff";
                            e.currentTarget.style.borderColor = "#2196f3";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#f9f9f9";
                            e.currentTarget.style.borderColor = "#e0e0e0";
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={createData.assignedCommunityIds.includes(community.id.toString())}
                            onChange={() => {}} // Handled by parent click
                            style={{
                              width: "18px",
                              height: "18px",
                              marginRight: "0.75rem",
                              cursor: "pointer",
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: "600", color: "#1a1a1a", fontSize: "0.9rem" }}>
                              {community.name}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "#999", fontFamily: "monospace" }}>
                              {community.id}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      padding: "1rem",
                      background: "#fafafa",
                      borderRadius: "8px",
                      color: "#999",
                      fontSize: "0.9rem",
                    }}>
                      No communities available
                    </div>
                  )}
                  {createData.assignedCommunityIds.length > 0 && (
                    <div style={{
                      marginTop: "0.75rem",
                      padding: "0.75rem",
                      background: "#e8f5e9",
                      borderRadius: "6px",
                      fontSize: "0.85rem",
                      color: "#2e7d32",
                    }}>
                      <strong>{createData.assignedCommunityIds.length}</strong> community/communities will be assigned
                    </div>
                  )}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <button
                  onClick={handleCreateAdmin}
                  disabled={isCreating}
                  style={{
                    padding: "0.75rem 1.5rem",
                    background: "#4caf50",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: isCreating ? "not-allowed" : "pointer",
                    fontWeight: "600",
                    fontSize: "0.9rem",
                    opacity: isCreating ? 0.6 : 1,
                  }}
                >
                  {isCreating ? "Creating..." : "Create Admin"}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreateData({
                      email: "",
                      adminLevel: "junior",
                      adminCategory: "community",
                      assignedCommunityIds: [],
                    });
                    setCreateMessage(null);
                  }}
                  style={{
                    padding: "0.75rem 1.5rem",
                    background: "#e0e0e0",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "0.9rem",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Admin List or Edit Form */}
          {!selectedAdmin ? (
            /* Admin Table - Responsive */
            <div style={{ overflowX: "auto", marginTop: "1.5rem" }}>
              {isMobile ? (
                /* Mobile Card View */
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: "1rem",
                  }}
                >
                  {admins.map((admin) => (
                    <div
                      key={admin.userId}
                      style={{
                        background: "#fff",
                        border: "1px solid #e0e0e0",
                        borderRadius: "10px",
                        padding: "1rem",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      }}
                    >
                      <div
                        style={{
                          marginBottom: "0.75rem",
                          paddingBottom: "0.75rem",
                          borderBottom: "1px solid #f0f0f0",
                        }}
                      >
                        <h3
                          style={{
                            margin: "0 0 0.25rem 0",
                            color: "#1a1a1a",
                            fontSize: "1rem",
                            fontWeight: "600",
                          }}
                        >
                          {admin.alias}
                        </h3>
                        <p
                          style={{
                            margin: "0.25rem 0",
                            color: "#666",
                            fontSize: "0.85rem",
                            wordBreak: "break-all",
                          }}
                        >
                          {admin.email ?? "-"}
                        </p>
                        <p
                          style={{
                            margin: "0.25rem 0",
                            color: "#888",
                            fontSize: "0.8rem",
                            wordBreak: "break-all",
                          }}
                        >
                          User ID: {admin.userId}
                        </p>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "0.75rem",
                          marginBottom: "1rem",
                          fontSize: "0.85rem",
                        }}
                      >
                        <div>
                          <span style={{ color: "#999", fontWeight: "600" }}>
                            Level:
                          </span>
                          <div style={{ color: "#1a1a1a" }}>
                            {admin.adminLevel ?? "-"}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: "#999", fontWeight: "600" }}>
                            Category:
                          </span>
                          <div style={{ color: "#1a1a1a" }}>
                            {admin.adminCategory ?? "-"}
                          </div>
                        </div>
                      </div>

                      {admin.assignedCommunityIds?.length ? (
                        <div
                          style={{
                            marginBottom: "1rem",
                            fontSize: "0.85rem",
                          }}
                        >
                          <span style={{ color: "#999", fontWeight: "600" }}>
                            Communities:
                          </span>
                          <div style={{ color: "#1a1a1a", marginTop: "0.25rem" }}>
                            {admin.assignedCommunityIds.map((communityId: any) => {
                              const communityIdStr = String(communityId);
                              const community = communities?.find((c) => c.id === communityId);
                              return (
                                <div
                                  key={communityIdStr}
                                  style={{
                                    padding: "0.5rem",
                                    marginTop: "0.5rem",
                                    background: "#e3f2fd",
                                    borderRadius: "4px",
                                    fontSize: "0.8rem",
                                  }}
                                >
                                  <strong>{community?.name || "Unknown Community"}</strong>
                                  <div style={{ fontSize: "0.7rem", color: "#666", marginTop: "0.25rem", fontFamily: "monospace" }}>
                                    ID: {communityIdStr}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <button
                        onClick={() => handleEdit(admin)}
                        style={{
                          width: "100%",
                          padding: "0.6rem",
                          background: "#1976d2",
                          color: "#fff",
                          borderRadius: 6,
                          border: "none",
                          cursor: "pointer",
                          fontWeight: "600",
                          fontSize: "0.9rem",
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                /* Desktop Table View */
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    background: "#fff",
                    borderRadius: "10px",
                    overflow: "hidden",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      <th
                        style={{
                          padding: "0.75rem",
                          textAlign: "left",
                          fontWeight: "600",
                          borderBottom: "2px solid #e0e0e0",
                          fontSize: "0.9rem",
                        }}
                      >
                        Alias
                      </th>
                      <th
                        style={{
                          padding: "0.75rem",
                          textAlign: "left",
                          fontWeight: "600",
                          borderBottom: "2px solid #e0e0e0",
                          fontSize: "0.9rem",
                        }}
                      >
                        Email
                      </th>
                      <th
                        style={{
                          padding: "0.75rem",
                          textAlign: "left",
                          fontWeight: "600",
                          borderBottom: "2px solid #e0e0e0",
                          fontSize: "0.9rem",
                        }}
                      >
                        User ID
                      </th>
                      <th
                        style={{
                          padding: "0.75rem",
                          textAlign: "left",
                          fontWeight: "600",
                          borderBottom: "2px solid #e0e0e0",
                          fontSize: "0.9rem",
                        }}
                      >
                        Level
                      </th>
                      <th
                        style={{
                          padding: "0.75rem",
                          textAlign: "left",
                          fontWeight: "600",
                          borderBottom: "2px solid #e0e0e0",
                          fontSize: "0.9rem",
                        }}
                      >
                        Category
                      </th>
                      <th
                        style={{
                          padding: "0.75rem",
                          textAlign: "left",
                          fontWeight: "600",
                          borderBottom: "2px solid #e0e0e0",
                          fontSize: "0.9rem",
                        }}
                      >
                        Communities
                      </th>
                      <th
                        style={{
                          padding: "0.75rem",
                          textAlign: "center",
                          fontWeight: "600",
                          borderBottom: "2px solid #e0e0e0",
                          fontSize: "0.9rem",
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((admin) => (
                      <tr
                        key={admin.userId}
                        style={{
                          borderBottom: "1px solid #f0f0f0",
                          transition: "background 0.2s",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#f9f9f9")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <td style={{ padding: "0.75rem", fontSize: "0.9rem" }}>
                          {admin.alias}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            fontSize: "0.9rem",
                            wordBreak: "break-word",
                            maxWidth: "200px",
                          }}
                        >
                          {admin.email ?? "-"}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            fontSize: "0.85rem",
                            wordBreak: "break-all",
                            maxWidth: "220px",
                            color: "#555",
                          }}
                        >
                          {admin.userId}
                        </td>
                        <td style={{ padding: "0.75rem", fontSize: "0.9rem" }}>
                          {admin.adminLevel ?? "-"}
                        </td>
                        <td style={{ padding: "0.75rem", fontSize: "0.9rem" }}>
                          {admin.adminCategory ?? "-"}
                        </td>
                        <td style={{ padding: "0.75rem", fontSize: "0.9rem" }}>
                          {admin.assignedCommunityIds?.length
                            ? admin.assignedCommunityIds.map((communityId: any) => {
                                const community = communities?.find((c) => c.id === communityId);
                                return community?.name || "Unknown";
                              }).join(", ")
                            : "-"}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem",
                            textAlign: "center",
                          }}
                        >
                          <button
                            onClick={() => handleEdit(admin)}
                            style={{
                              padding: "0.4rem 0.75rem",
                              background: "#1976d2",
                              color: "#fff",
                              borderRadius: 6,
                              border: "none",
                              cursor: "pointer",
                              fontWeight: "600",
                              fontSize: "0.85rem",
                            }}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            /* Edit Form */
            <div
              style={{
                marginTop: "1.5rem",
                background: "#fafafa",
                padding: "clamp(1rem, 3vw, 1.5rem)",
                borderRadius: 12,
                border: "1px solid #e0e0e0",
              }}
            >
              <h2
                style={{
                  margin: "0 0 1.5rem 0",
                  fontSize: "1.5rem",
                  fontWeight: "700",
                  color: "#1a1a1a",
                }}
              >
                Edit Admin: {selectedAdmin.alias}
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                  gap: "1.5rem",
                  marginBottom: "1.5rem",
                }}
              >
                {/* Admin Level */}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontWeight: "600",
                      color: "#333",
                      fontSize: "0.9rem",
                    }}
                  >
                    Admin Level
                  </label>
                  <select
                    value={editData?.adminLevel ?? ""}
                    onChange={(e) =>
                      setEditData({
                        ...(editData || {
                          adminLevel: "",
                          adminCategory: "",
                          assignedCommunityIds: [],
                        }),
                        adminLevel: e.target.value as AdminLevel,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "0.6rem",
                      borderRadius: "6px",
                      border: "1px solid #ccc",
                      fontSize: "0.9rem",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">None</option>
                    <option value="super">Super</option>
                    <option value="junior">Junior</option>
                  </select>
                </div>

                {/* Admin Category */}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "0.5rem",
                      fontWeight: "600",
                      color: "#333",
                      fontSize: "0.9rem",
                    }}
                  >
                    Admin Category
                  </label>
                  <select
                    value={editData?.adminCategory ?? ""}
                    onChange={(e) =>
                      setEditData({
                        ...(editData || {
                          adminLevel: "",
                          adminCategory: "",
                          assignedCommunityIds: [],
                        }),
                        adminCategory: e.target.value as AdminCategory,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "0.6rem",
                      borderRadius: "6px",
                      border: "1px solid #ccc",
                      fontSize: "0.9rem",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">None</option>
                    <option value="community">Community</option>
                    <option value="store">Store</option>
                    <option value="message">Message</option>
                    <option value="finance">Finance</option>
                  </select>
                </div>
              </div>

              {/* Assigned Communities */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.75rem",
                    fontWeight: "600",
                    color: "#333",
                    fontSize: "0.95rem",
                  }}
                >
                  Assign Communities
                </label>
                {communities && communities.length > 0 ? (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(250px, 1fr))",
                    gap: "0.75rem",
                  }}>
                    {communities.map((community) => (
                      <div
                        key={community.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "0.75rem",
                          background: "#f9f9f9",
                          border: "1px solid #e0e0e0",
                          borderRadius: "8px",
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                        onClick={() => {
                          const assigned = editData?.assignedCommunityIds ?? [];
                          const isSelected = assigned.includes(community.id.toString());
                          setEditData({
                            ...(editData || {
                              adminLevel: "",
                              adminCategory: "",
                              assignedCommunityIds: [],
                            }),
                            assignedCommunityIds: isSelected
                              ? assigned.filter((id) => id !== community.id.toString())
                              : [...assigned, community.id.toString()],
                          });
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#f0f7ff";
                          e.currentTarget.style.borderColor = "#2196f3";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#f9f9f9";
                          e.currentTarget.style.borderColor = "#e0e0e0";
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={editData?.assignedCommunityIds?.includes(community.id.toString()) ?? false}
                          onChange={() => {}} // Handled by parent click
                          style={{
                            width: "18px",
                            height: "18px",
                            marginRight: "0.75rem",
                            cursor: "pointer",
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: "600", color: "#1a1a1a", fontSize: "0.9rem" }}>
                            {community.name}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#999", fontFamily: "monospace" }}>
                            {community.id}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: "1rem",
                    background: "#fafafa",
                    borderRadius: "8px",
                    color: "#999",
                    fontSize: "0.9rem",
                  }}>
                    No communities available
                  </div>
                )}
                {editData?.assignedCommunityIds && editData.assignedCommunityIds.length > 0 && (
                  <div style={{
                    marginTop: "0.75rem",
                    padding: "0.75rem",
                    background: "#e8f5e9",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    color: "#2e7d32",
                  }}>
                    <strong>{editData.assignedCommunityIds.length}</strong> community/communities assigned
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={handleSave}
                  style={{
                    flex: isMobile ? "1 1 100%" : "0 1 auto",
                    padding: "0.75rem 1.5rem",
                    background: "#4caf50",
                    color: "#fff",
                    borderRadius: 6,
                    border: "none",
                    fontWeight: "600",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setSelectedAdmin(null);
                    setEditData(null);
                    setMessage(null);
                  }}
                  style={{
                    flex: isMobile ? "1 1 100%" : "0 1 auto",
                    padding: "0.75rem 1.5rem",
                    background: "#e0e0e0",
                    borderRadius: 6,
                    border: "none",
                    fontWeight: "600",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  Cancel
                </button>
                {selectedAdmin?.adminLevel !== "super" && (
                  <button
                    onClick={handleDeleteAdmin}
                    style={{
                      flex: isMobile ? "1 1 100%" : "0 1 auto",
                      padding: "0.75rem 1.5rem",
                      background: "#d32f2f",
                      color: "#fff",
                      borderRadius: 6,
                      border: "none",
                      fontWeight: "600",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#c62828")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#d32f2f")}
                  >
                    🗑️ Delete Admin
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
