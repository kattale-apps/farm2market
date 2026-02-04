"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CommunitiesPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] =
    useState<{ type: "success" | "error"; text: string } | null>(null);

  const [editingCommunityId, setEditingCommunityId] = useState<string | null>(
    null
  );

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isGlobal: false,
    geoLocked: false,
    regionKey: "",
    communityType: "farmer" as "farmer" | "trader" | "buyer",
    assignAdminId: "",
  });

  const [editData, setEditData] = useState({
    name: "",
    description: "",
    isGlobal: false,
    geoLocked: false,
    regionKey: "",
  });

  // ✅ Queries
  const user = useQuery(api.auth.getUser, userId ? { userId } : "skip");

  // ✅ Role logic (must be before queries that use it)
  const adminLevel = (user as any)?.adminLevel;

  const isSuperAdmin =
    user?.role === "admin" &&
    (adminLevel === "super" ||
      (adminLevel === undefined && !(user as any)?.adminCategory));

  const isCommunityAdmin =
    user?.role === "admin" &&
    (user as any)?.adminCategory === "community";

  const canViewCommunityMembers = isSuperAdmin || isCommunityAdmin;

  const communities = useQuery(
    api.communities.getActiveCommunities,
    userId ? { userId } : "skip"
  );

  // Get all admins to show assigned admin names
  const allAdmins = useQuery(
    api.introspection.getAllUsers,
    userId && isSuperAdmin ? { adminId: userId } : "skip"
  );

  const createCommunity = useMutation(api.communities.createCommunity);
  const updateCommunity = useMutation(api.communities.updateCommunity);
  const deleteCommunity = useMutation(api.communities.deleteCommunity);

  // Get assigned admin name by finding which admin has this community in assignedCommunityIds
  const getAssignedAdminInfo = (communityId: string) => {
    if (!allAdmins || !communityId) return { alias: "Unassigned", email: "" };
    const admin = allAdmins.find((a: any) => 
      a.role === "admin" && 
      Array.isArray(a.assignedCommunityIds) && 
      a.assignedCommunityIds.some((id: any) => id === communityId)
    );
    return admin ? { alias: admin.alias, email: admin.email } : { alias: "Unassigned", email: "" };
  };

  // ✅ Filter communities for community admins (defensive)
  let filteredCommunities = communities;

  if (
    isCommunityAdmin &&
    user &&
    Array.isArray((user as any).assignedCommunityIds)
  ) {
    const assignedIds = (user as any).assignedCommunityIds.map(String);
    filteredCommunities = (communities || []).filter((c: any) =>
      assignedIds.includes(String(c.id))
    );
  }

  // ✅ Load userId from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("pilot_user");
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);
      if (parsed.userId) {
        setUserId(parsed.userId as Id<"users">);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // 🚫 Block unauthenticated access
  if (!userId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Please log in to access communities management.</p>
      </div>
    );
  }

  // ✅ UI
  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
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
        <h1 style={{ margin: 0, fontSize: "clamp(1.75rem, 5vw, 2.25rem)", fontWeight: "700" }}>
          Grower Communities
        </h1>
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

      {filteredCommunities === undefined ? (
        <p>Loading communities...</p>
      ) : filteredCommunities.length === 0 ? (
        <p>No communities available.</p>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {filteredCommunities.map((community: any) => (
            <div
              key={community.id}
              style={{
                padding: "1.25rem",
                border: "1px solid #e0e0e0",
                borderRadius: "10px",
                background: "#ffffff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                transition: "box-shadow 0.2s, transform 0.2s",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.1)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <h3 style={{ margin: "0 0 0.5rem 0", color: "#1a1a1a" }}>
                {community.name}
              </h3>
              {community.description && (
                <p style={{ margin: "0.5rem 0", color: "#666", fontSize: "0.95rem" }}>
                  {community.description}
                </p>
              )}

              <p style={{ margin: "0.75rem 0", color: "#333", fontSize: "0.9rem" }}>
                Type:{" "}
                <strong style={{ color: "#2e7d32" }}>
                  {community.isGlobal ? "Global" : "Geo-Locked"}
                </strong>
              </p>

              {/* ✅ Assigned admin shown */}
              {isSuperAdmin && (
                <p style={{ fontSize: "0.85rem", color: "#666", margin: "0.5rem 0" }}>
                  Assigned Community Admin:{" "}
                  <strong>
                    {(() => {
                      const adminInfo = getAssignedAdminInfo(community.id);
                      return adminInfo.alias === "Unassigned" 
                        ? "Unassigned" 
                        : `${adminInfo.alias} (${adminInfo.email})`;
                    })()}
                  </strong>
                </p>
              )}

              {isSuperAdmin && (
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
                  <button
                    onClick={() => {
                      setEditingCommunityId(community.id);
                      setEditData({
                        name: community.name || "",
                        description: community.description || "",
                        isGlobal: community.isGlobal || false,
                        geoLocked: community.geoLocked || false,
                        regionKey: community.regionKey || "",
                      });
                      setFormData({
                        ...formData,
                        assignAdminId: community.assignAdminId || "",
                      });
                    }}
                    style={{
                      padding: "0.5rem 1rem",
                      background: "#1976d2",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "600",
                      fontSize: "0.9rem",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#1565c0")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "#1976d2")
                    }
                  >
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Are you sure you want to delete this community?"
                        )
                      )
                        return;
                      await deleteCommunity({
                        adminId: userId,
                        communityId: community.id,
                      });
                    }}
                    style={{
                      padding: "0.5rem 1rem",
                      background: "#d32f2f",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "600",
                      fontSize: "0.9rem",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#c62828")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "#d32f2f")
                    }
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Form */}
      {editingCommunityId && isSuperAdmin && (
        <div
          style={{
            marginTop: "2rem",
            padding: "1.5rem",
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: "10px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <h2 style={{ margin: "0 0 1rem 0", color: "#1a1a1a" }}>
            Edit Community
          </h2>

          {message && (
            <div
              style={{
                margin: "0 0 1rem 0",
                padding: "0.75rem 1rem",
                background: message.type === "success" ? "#e8f5e9" : "#ffebee",
                color: message.type === "success" ? "#2e7d32" : "#c62828",
                borderRadius: "6px",
                fontSize: "0.9rem",
              }}
            >
              {message.text}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                Name
              </label>
              <input
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                style={{
                  width: "100%",
                  padding: "0.6rem",
                  border: "1px solid #ccc",
                  borderRadius: "6px",
                  fontSize: "0.9rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                Description
              </label>
              <textarea
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                style={{
                  width: "100%",
                  padding: "0.6rem",
                  border: "1px solid #ccc",
                  borderRadius: "6px",
                  fontSize: "0.9rem",
                  minHeight: "80px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Show current assigned admin as read-only */}
            <div style={{ padding: "1rem", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: "6px" }}>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "#555" }}>
                <strong>Currently Assigned Admin:</strong>{" "}
                {(() => {
                  const adminInfo = getAssignedAdminInfo(editingCommunityId);
                  return adminInfo.alias === "Unassigned" 
                    ? "Unassigned" 
                    : `${adminInfo.alias} (${adminInfo.email})`;
                })()}
              </p>
              <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#999" }}>
                Admin assignment cannot be changed after community creation.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  const community = communities?.find((c: any) => c.id === editingCommunityId);
                  if (community) {
                    await updateCommunity({
                      adminId: userId,
                      communityId: editingCommunityId as Id<"communities">,
                      name: editData.name || community.name,
                      description: editData.description || community.description,
                      isGlobal: editData.isGlobal !== undefined ? editData.isGlobal : community.isGlobal,
                      geoLocked: editData.geoLocked !== undefined ? editData.geoLocked : community.geoLocked,
                      regionKey: editData.regionKey || community.regionKey,
                    });
                    setMessage({ type: "success", text: "Community updated successfully!" });
                    setEditingCommunityId(null);
                    setEditData({ name: "", description: "", isGlobal: false, geoLocked: false, regionKey: "" });
                  }
                } catch (err: any) {
                  setMessage({ type: "error", text: err.message || "Failed to update community" });
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              style={{
                padding: "0.75rem 1.5rem",
                background: "#4caf50",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: "600",
                fontSize: "0.9rem",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={() => {
                setEditingCommunityId(null);
                setEditData({ name: "", description: "", isGlobal: false, geoLocked: false, regionKey: "" });
                setMessage(null);
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
    </div>
  );
}
