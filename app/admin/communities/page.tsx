"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";

export default function CommunitiesPage() {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isGlobal: false,
    geoLocked: false,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const communities = useQuery(api.communities.getActiveCommunities, userId ? { userId } : "skip");
  const user = useQuery(api.auth.getUser, userId ? { userId } : "skip");
  const createCommunity = useMutation(api.communities.createCommunity);
  const adminLevel = (user as any)?.adminLevel;
  const isSuperAdmin = user?.role === "admin" && (adminLevel === "super" || adminLevel === undefined);

  // Get current user from localStorage (pilot mode)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("pilot_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.userId) {
            setUserId(parsed.userId as Id<"users">);
          }
        }
      } catch (e) {
        console.error("Error reading user from localStorage:", e);
      }
    }
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setLoading(true);
    setMessage(null);

    try {
      await createCommunity({
        adminId: userId,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        isGlobal: formData.isGlobal,
        geoLocked: formData.geoLocked,
      });
      setMessage({ type: "success", text: "Community created successfully!" });
      setFormData({ name: "", description: "", isGlobal: false, geoLocked: false });
      setShowCreateForm(false);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to create community" });
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Please log in to access communities management.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "clamp(1rem, 4vw, 2rem)", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "2rem",
        padding: "1rem",
        background: "#f9f9f9",
        borderRadius: "10px",
        border: "1px solid #e0e0e0",
      }}>
        <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", margin: 0 }}>
          Grower Communities
        </h1>
        {isSuperAdmin && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
            }}
          >
            + Create Community
          </button>
        )}
      </div>

      {message && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            borderRadius: "8px",
            background: message.type === "success" ? "#d4edda" : "#f8d7da",
            color: message.type === "success" ? "#155724" : "#721c24",
          }}
        >
          {message.text}
        </div>
      )}

      {isSuperAdmin && showCreateForm && (
        <div
          style={{
            padding: "1.5rem",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            marginBottom: "2rem",
          }}
        >
          <h2 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>Create New Community</h2>
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                Community Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                }}
              />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                  fontFamily: "inherit",
                }}
              />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={formData.isGlobal}
                  onChange={(e) => setFormData({ ...formData, isGlobal: e.target.checked, geoLocked: e.target.checked ? false : formData.geoLocked })}
                />
                <span>Global Community (accessible to all farmers)</span>
              </label>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={formData.geoLocked}
                  onChange={(e) => setFormData({ ...formData, geoLocked: e.target.checked, isGlobal: e.target.checked ? false : formData.isGlobal })}
                />
                <span>Geo-Locked (restricted to specific locations)</span>
              </label>
            </div>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "0.75rem 1.5rem",
                  background: loading ? "#ccc" : "#4caf50",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: "600",
                }}
              >
                {loading ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setFormData({ name: "", description: "", isGlobal: false, geoLocked: false });
                }}
                style={{
                  padding: "0.75rem 1.5rem",
                  background: "#f5f5f5",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {communities === undefined ? (
        <p>Loading communities...</p>
      ) : communities.length === 0 ? (
        <p style={{ color: "#666", padding: "2rem", textAlign: "center" }}>
          No communities yet. Please check back soon.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "1.5rem" }}>
          {communities.map((community: any) => (
            <div
              key={community.id}
              style={{
                padding: "1.5rem",
                background: "#fff",
                borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
                <h3 style={{ fontSize: "1.2rem", margin: 0 }}>{community.name}</h3>
                <span
                  style={{
                    padding: "0.25rem 0.75rem",
                    borderRadius: "12px",
                    fontSize: "0.85rem",
                    background: community.isGlobal ? "#4caf50" : "#ffc107",
                    color: "white",
                  }}
                >
                  {community.isGlobal ? "Global" : "Geo-Locked"}
                </span>
              </div>
              {community.description && (
                <p style={{ color: "#666", marginBottom: "0.5rem" }}>{community.description}</p>
              )}
              <div style={{ display: "flex", gap: "1rem", fontSize: "0.9rem", color: "#666" }}>
                <span>{community.memberCount} member(s)</span>
                {community.isMember && (
                  <span style={{ color: "#4caf50", fontWeight: "600" }}>✓ You are a member</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
