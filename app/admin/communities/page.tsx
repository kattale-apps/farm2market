"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CommunityQRCode } from "../../components/CommunityQRCode";

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
  const [createdCommunityId, setCreatedCommunityId] = useState<Id<"communities"> | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isGlobal: false,
    geoLocked: false,
    regionKey: "",
    communityType: "farmer" as "farmer" | "trader" | "buyer",
    assignAdminId: "",
    // QR & monetisation
    qrSlug: "",
    qrLogoUrl: "",
    juniorAdminFreeMonthlyImageQuota: 2,
    juniorAdminImagePrice: 5000,
    memberImageMessagePrice: 1000,
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
  const getAssignedAdminInfo = (communityId: string, communityAdminId?: string) => {
    if (!allAdmins || !communityId) return { alias: "Unassigned", email: "" };
    if (communityAdminId) {
      const direct = allAdmins.find((a: any) => a._id === communityAdminId || a.userId === communityAdminId);
      if (direct) return { alias: direct.alias, email: direct.email };
    }
    const admin = allAdmins.find((a: any) =>
      a.role === "admin" &&
      Array.isArray(a.assignedCommunityIds) &&
      a.assignedCommunityIds.some((id: any) => String(id) === String(communityId))
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
      {/* Header with Back Button and Create Button */}
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
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {isSuperAdmin && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              style={{
                padding: "0.6rem 1.2rem",
                background: "#4caf50",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "0.9rem",
                transition: "background 0.2s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#388e3c")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#4caf50")
              }
            >
              {showCreateForm ? "Cancel" : "+ Create Community"}
            </button>
          )}
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
      </div>

      {/* Create Community Form */}
      {showCreateForm && isSuperAdmin && (
        <div
          style={{
            marginBottom: "2rem",
            padding: "1.5rem",
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: "10px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <h2 style={{ margin: "0 0 1rem 0", color: "#1a1a1a" }}>
            Create New Community
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

          {/* Show QR after successful creation */}
          {createdCommunityId && (
            <div style={{
              margin: "0 0 1.5rem 0",
              padding: "1.5rem",
              background: "#f1f8e9",
              borderRadius: "10px",
              border: "1px solid #c5e1a5",
              textAlign: "center",
            }}>
              <h3 style={{ margin: "0 0 1rem 0", color: "#2e7d32", fontSize: "1.1rem" }}>
                ✅ Community Created — QR Code Ready
              </h3>
              <CommunityQRCode
                communityId={createdCommunityId}
                mode="inline"
              />
              <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
                <CommunityQRCode
                  communityId={createdCommunityId}
                  mode="button"
                  buttonLabel="Download / Share QR"
                />
                <button
                  onClick={() => {
                    setCreatedCommunityId(null);
                    setShowCreateForm(false);
                  }}
                  style={{
                    padding: "0.5rem 1rem",
                    background: "#e0e0e0",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "0.9rem",
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {!createdCommunityId && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                {/* Community Name */}
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                    Community Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Main Farmers Community"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      width: "100%", padding: "0.6rem", border: "1px solid #ccc",
                      borderRadius: "6px", fontSize: "0.9rem", boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                    Description
                  </label>
                  <textarea
                    placeholder="Describe this community..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    style={{
                      width: "100%", padding: "0.6rem", border: "1px solid #ccc",
                      borderRadius: "6px", fontSize: "0.9rem", minHeight: "80px", boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Community Type */}
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                    Community Type *
                  </label>
                  <select
                    value={formData.communityType}
                    onChange={(e) => setFormData({ ...formData, communityType: e.target.value as "farmer" | "trader" | "buyer" })}
                    style={{
                      width: "100%", padding: "0.6rem", border: "1px solid #ccc",
                      borderRadius: "6px", fontSize: "0.9rem", boxSizing: "border-box",
                    }}
                  >
                    <option value="farmer">Farmer</option>
                    <option value="trader">Trader</option>
                    <option value="buyer">Buyer</option>
                  </select>
                </div>

                {/* Global */}
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "600", color: "#333", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={formData.isGlobal}
                      onChange={(e) => setFormData({ ...formData, isGlobal: e.target.checked, geoLocked: false })}
                      style={{ cursor: "pointer" }}
                    />
                    Global Community
                  </label>
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                    Accessible to all users. Disable to make it geo-locked.
                  </p>
                </div>

                {/* Region */}
                {!formData.isGlobal && (
                  <div>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                      Region (for geo-locked communities)
                    </label>
                    <select
                      value={formData.regionKey}
                      onChange={(e) => setFormData({ ...formData, regionKey: e.target.value })}
                      style={{
                        width: "100%", padding: "0.6rem", border: "1px solid #ccc",
                        borderRadius: "6px", fontSize: "0.9rem", boxSizing: "border-box",
                      }}
                    >
                      <option value="">Select a region...</option>
                      <option value="central_buganda">Central Buganda</option>
                      <option value="eastern_region">Eastern Region</option>
                      <option value="northern_region">Northern Region</option>
                      <option value="western_region">Western Region</option>
                    </select>
                  </div>
                )}

                {/* Assign Admin */}
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                    Assign Junior Community Admin *
                  </label>
                  <select
                    value={formData.assignAdminId}
                    onChange={(e) => setFormData({ ...formData, assignAdminId: e.target.value })}
                    style={{
                      width: "100%", padding: "0.6rem", border: "1px solid #ccc",
                      borderRadius: "6px", fontSize: "0.9rem", boxSizing: "border-box",
                    }}
                  >
                    <option value="">Select an admin...</option>
                    {allAdmins && allAdmins
                      .filter((admin: any) => admin.role === "admin" && admin.adminLevel === "junior" && admin.adminCategory === "community")
                      .map((admin: any) => (
                        <option key={admin._id} value={String(admin._id)}>
                          {admin.alias} ({admin.email})
                        </option>
                      ))}
                  </select>
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                    Select a junior community admin to manage this community.
                  </p>
                </div>

                {/* QR & Monetisation Toggle */}
                <div style={{
                  padding: "1rem",
                  background: showAdvanced ? "#e3f2fd" : "#f5f5f5",
                  borderRadius: "8px",
                  border: `1px solid ${showAdvanced ? "#90caf9" : "#e0e0e0"}`,
                }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "600", color: "#333", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={showAdvanced}
                      onChange={(e) => setShowAdvanced(e.target.checked)}
                      style={{ cursor: "pointer" }}
                    />
                    Enable QR Join Link & Monetisation Settings
                  </label>
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                    Add a URL slug for QR-code joining and set image posting fees.
                  </p>
                </div>

                {/* QR & Monetisation Fields */}
                {showAdvanced && (
                  <>
                    <div>
                      <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                        URL Slug *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., biofarm-ug"
                        value={formData.qrSlug}
                        onChange={(e) => setFormData({ ...formData, qrSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                        style={{
                          width: "100%", padding: "0.6rem", border: "1px solid #ccc",
                          borderRadius: "6px", fontSize: "0.9rem", boxSizing: "border-box",
                        }}
                      />
                      <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "#666", fontFamily: "monospace" }}>
                        Join link: /join/community/{formData.qrSlug || "your-slug"}
                      </p>
                    </div>

                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "1rem",
                      padding: "1rem",
                      background: "#f5f5f5",
                      borderRadius: "8px",
                      border: "1px solid #e0e0e0",
                    }}>
                      <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333", fontSize: "0.85rem" }}>
                          Admin Free Monthly Image Quota
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formData.juniorAdminFreeMonthlyImageQuota}
                          onChange={(e) => setFormData({ ...formData, juniorAdminFreeMonthlyImageQuota: parseInt(e.target.value) || 0 })}
                          style={{
                            width: "100%", padding: "0.6rem", border: "1px solid #ccc",
                            borderRadius: "6px", fontSize: "0.9rem", boxSizing: "border-box",
                          }}
                        />
                        <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.75rem", color: "#888" }}>Free posts per month</p>
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333", fontSize: "0.85rem" }}>
                          Admin Image Post Price (UGX)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formData.juniorAdminImagePrice}
                          onChange={(e) => setFormData({ ...formData, juniorAdminImagePrice: parseInt(e.target.value) || 0 })}
                          style={{
                            width: "100%", padding: "0.6rem", border: "1px solid #ccc",
                            borderRadius: "6px", fontSize: "0.9rem", boxSizing: "border-box",
                          }}
                        />
                        <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.75rem", color: "#888" }}>Price after free quota exceeded</p>
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333", fontSize: "0.85rem" }}>
                          Member Image Message Price (UGX)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formData.memberImageMessagePrice}
                          onChange={(e) => setFormData({ ...formData, memberImageMessagePrice: parseInt(e.target.value) || 0 })}
                          style={{
                            width: "100%", padding: "0.6rem", border: "1px solid #ccc",
                            borderRadius: "6px", fontSize: "0.9rem", boxSizing: "border-box",
                          }}
                        />
                        <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.75rem", color: "#888" }}>Member messaging image fee</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  onClick={async () => {
                    if (!formData.name.trim()) {
                      setMessage({ type: "error", text: "Community name is required" });
                      return;
                    }
                    if (!formData.assignAdminId || !formData.assignAdminId.trim()) {
                      setMessage({ type: "error", text: "You must assign a junior community admin" });
                      return;
                    }
                    if (showAdvanced && !formData.qrSlug.trim()) {
                      setMessage({ type: "error", text: "URL slug is required when QR is enabled" });
                      return;
                    }
                    setLoading(true);
                    try {
                      const adminIdValue = formData.assignAdminId?.trim();
                      const validAdminId = adminIdValue && adminIdValue !== "undefined" ? (adminIdValue as Id<"users">) : undefined;

                      const result = await createCommunity({
                        adminId: userId,
                        name: formData.name,
                        description: formData.description || undefined,
                        isGlobal: formData.isGlobal,
                        geoLocked: !formData.isGlobal,
                        regionKey: formData.regionKey || undefined,
                        communityType: formData.communityType,
                        ...(validAdminId ? { assignAdminId: validAdminId } : {}),
                        // QR & monetisation (only if advanced enabled)
                        ...(showAdvanced ? {
                          qrSlug: formData.qrSlug.trim(),
                          juniorAdminFreeMonthlyImageQuota: formData.juniorAdminFreeMonthlyImageQuota,
                          juniorAdminImagePrice: formData.juniorAdminImagePrice,
                          memberImageMessagePrice: formData.memberImageMessagePrice,
                        } : {}),
                      });

                      setMessage({ type: "success", text: "Community created successfully!" });
                      setCreatedCommunityId(result.communityId as Id<"communities">);
                      setFormData({
                        name: "", description: "", isGlobal: false, geoLocked: false,
                        regionKey: "", communityType: "farmer", assignAdminId: "",
                        qrSlug: "", qrLogoUrl: "",
                        juniorAdminFreeMonthlyImageQuota: 2,
                        juniorAdminImagePrice: 5000,
                        memberImageMessagePrice: 1000,
                      });
                      setShowAdvanced(false);
                    } catch (err: any) {
                      setMessage({ type: "error", text: err.message || "Failed to create community" });
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
                  {loading ? "Creating..." : "Create Community"}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreatedCommunityId(null);
                    setFormData({
                      name: "", description: "", isGlobal: false, geoLocked: false,
                      regionKey: "", communityType: "farmer", assignAdminId: "",
                      qrSlug: "", qrLogoUrl: "",
                      juniorAdminFreeMonthlyImageQuota: 2,
                      juniorAdminImagePrice: 5000,
                      memberImageMessagePrice: 1000,
                    });
                    setShowAdvanced(false);
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
            </>
          )}
        </div>
      )}

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
              <p style={{ margin: "0.25rem 0 0.5rem 0", color: "#999", fontSize: "0.8rem", fontFamily: "monospace" }}>
                ID: {community.id}
              </p>
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
                      const adminInfo = getAssignedAdminInfo(community.id, (community as any).communityAdminId);
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
                  <CommunityQRCode
                    communityId={community.id}
                    mode="button"
                    buttonLabel="QR Code"
                  />
                </div>
              )}
              {/* QR Code for non-superadmin community admins */}
              {!isSuperAdmin && (
                <div style={{ marginTop: "1rem" }}>
                  <CommunityQRCode
                    communityId={community.id}
                    mode="button"
                    buttonLabel="QR Code"
                  />
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
                  const currentCommunity = (communities as any[] | undefined)?.find(
                    (c: any) => c.id === editingCommunityId
                  );
                  const adminInfo = getAssignedAdminInfo(editingCommunityId, currentCommunity?.communityAdminId);
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
                      regionKey: editData.regionKey || "",
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
