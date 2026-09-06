"use client";

export const dynamic = "force-dynamic";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useStoredUser } from "@/app/hooks/useStoredUser";

type RoleCategory = "farmer" | "trader" | "buyer" | "admin" | "all";

const ROLE_LABELS: Record<RoleCategory, string> = {
  farmer: "Farmer",
  trader: "Trader",
  buyer: "Buyer",
  admin: "Admin",
  all: "Everyone",
};

const ROLE_TABS: RoleCategory[] = ["all", "farmer", "trader", "buyer", "admin"];

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed",
      bottom: "1rem",
      right: "1rem",
      background: "#2e7d32",
      color: "#fff",
      padding: "0.75rem 1.5rem",
      borderRadius: "8px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      zIndex: 1000,
      fontFamily: "'Montserrat', sans-serif",
    }}>
      <span>✓</span>
      <span>{message}</span>
    </div>
  );
}

function TutorialManagementContent() {
  const { user, status: authStatus } = useStoredUser();
  const adminId = (user?.userId as Id<"users"> | undefined) ?? null;
  const [activeTab, setActiveTab] = useState<RoleCategory>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"tutorialVideos"> | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [description, setDescription] = useState("");
  const [roleCategory, setRoleCategory] = useState<RoleCategory>("all");

  // Load admin ID from localStorage
  // (replaced by useStoredUser above)

  const tutorials = useQuery(
    api.tutorials.getAllTutorials,
    adminId ? { adminId } : "skip"
  );

  const addTutorial = useMutation(api.tutorials.addTutorial);
  const updateTutorial = useMutation(api.tutorials.updateTutorial);
  const deleteTutorial = useMutation(api.tutorials.deleteTutorial);

  const resetForm = () => {
    setTitle("");
    setYoutubeUrl("");
    setDescription("");
    setRoleCategory("all");
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!adminId || !title.trim() || !youtubeUrl.trim()) return;

    try {
      if (editingId) {
        await updateTutorial({
          adminId,
          videoId: editingId,
          title: title.trim(),
          youtubeUrl: youtubeUrl.trim(),
          description: description.trim() || undefined,
        });
        setToast("Tutorial updated!");
      } else {
        await addTutorial({
          adminId,
          roleCategory,
          title: title.trim(),
          youtubeUrl: youtubeUrl.trim(),
          description: description.trim() || undefined,
        });
        setToast("Tutorial added!");
      }
      resetForm();
    } catch (e: any) {
      alert(e?.message || "Failed to save tutorial");
    }
  };

  const handleEdit = (video: any) => {
    setTitle(video.title);
    setYoutubeUrl(video.youtubeUrl);
    setDescription(video.description || "");
    setRoleCategory(video.roleCategory);
    setEditingId(video._id);
    setShowForm(true);
  };

  const handleDelete = async (videoId: Id<"tutorialVideos">) => {
    if (!adminId) return;
    if (!confirm("Delete this tutorial video?")) return;

    try {
      await deleteTutorial({ adminId, videoId });
      setToast("Tutorial deleted");
    } catch (e: any) {
      alert(e?.message || "Failed to delete tutorial");
    }
  };

  const handleToggleActive = async (video: any) => {
    if (!adminId) return;
    try {
      await updateTutorial({
        adminId,
        videoId: video._id,
        active: !video.active,
      });
      setToast(video.active ? "Tutorial hidden" : "Tutorial published");
    } catch (e: any) {
      alert(e?.message || "Failed to update tutorial");
    }
  };

  const currentVideos = tutorials ? (tutorials as any)[activeTab] || [] : [];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f5f5f5",
      fontFamily: "'Montserrat', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        background: "#2e7d32",
        color: "#fff",
        padding: "1.5rem 2rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>Tutorial Videos</h1>
          <p style={{ margin: "0.25rem 0 0 0", opacity: 0.85, fontSize: "0.9rem" }}>
            Manage training videos for all user roles
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          style={{
            background: "#fff",
            color: "#2e7d32",
            border: "none",
            padding: "0.6rem 1.25rem",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.9rem",
            fontFamily: "inherit",
          }}
        >
          + Add Tutorial
        </button>
      </div>

      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "1.5rem" }}>
        {/* Add/Edit form */}
        {showForm && (
          <div style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "1.5rem",
            marginBottom: "1.5rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e0e0e0",
          }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", color: "#333" }}>
              {editingId ? "Edit Tutorial" : "Add New Tutorial"}
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem", color: "#555" }}>
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. How to Create a Listing"
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #ccc",
                    fontSize: "0.9rem",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem", color: "#555" }}>
                  YouTube URL *
                </label>
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #ccc",
                    fontSize: "0.9rem",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem", color: "#555" }}>
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the tutorial..."
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #ccc",
                    fontSize: "0.9rem",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {!editingId && (
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem", color: "#555" }}>
                    Target Audience
                  </label>
                  <select
                    value={roleCategory}
                    onChange={(e) => setRoleCategory(e.target.value as RoleCategory)}
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.75rem",
                      borderRadius: "8px",
                      border: "1px solid #ccc",
                      fontSize: "0.9rem",
                      fontFamily: "inherit",
                      background: "#fff",
                    }}
                  >
                    {ROLE_TABS.map((role) => (
                      <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                <button
                  onClick={resetForm}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "8px",
                    border: "1px solid #ccc",
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!title.trim() || !youtubeUrl.trim()}
                  style={{
                    padding: "0.5rem 1.25rem",
                    borderRadius: "8px",
                    border: "none",
                    background: title.trim() && youtubeUrl.trim() ? "#2e7d32" : "#ccc",
                    color: "#fff",
                    cursor: title.trim() && youtubeUrl.trim() ? "pointer" : "not-allowed",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    fontFamily: "inherit",
                  }}
                >
                  {editingId ? "Save Changes" : "Add Tutorial"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Role tabs */}
        <div style={{
          display: "flex",
          gap: "0.25rem",
          marginBottom: "1.25rem",
          borderBottom: "2px solid #e0e0e0",
          overflowX: "auto",
        }}>
          {ROLE_TABS.map((role) => {
            const count = tutorials ? ((tutorials as any)[role] || []).length : 0;
            return (
              <button
                key={role}
                onClick={() => setActiveTab(role)}
                style={{
                  padding: "0.6rem 1rem",
                  border: "none",
                  borderBottom: activeTab === role ? "3px solid #2e7d32" : "3px solid transparent",
                  background: "transparent",
                  color: activeTab === role ? "#2e7d32" : "#888",
                  fontWeight: activeTab === role ? 700 : 500,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                {ROLE_LABELS[role]} ({count})
              </button>
            );
          })}
        </div>

        {/* Tutorial list */}
        {!tutorials ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#999" }}>Loading...</div>
        ) : currentVideos.length === 0 ? (
          <div style={{
            padding: "3rem",
            textAlign: "center",
            color: "#999",
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid #e0e0e0",
          }}>
            <p style={{ fontSize: "1.1rem", margin: "0 0 0.5rem 0" }}>No tutorials for {ROLE_LABELS[activeTab]}</p>
            <p style={{ fontSize: "0.85rem", margin: 0 }}>Click &quot;+ Add Tutorial&quot; to create one</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {currentVideos.map((video: any) => (
              <div
                key={video._id}
                style={{
                  display: "flex",
                  gap: "1rem",
                  background: "#fff",
                  borderRadius: "12px",
                  padding: "1rem",
                  border: `1px solid ${video.active ? "#e0e0e0" : "#ffd54f"}`,
                  opacity: video.active ? 1 : 0.7,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  alignItems: "flex-start",
                }}
              >
                {/* Thumbnail */}
                <div style={{
                  width: "160px",
                  minWidth: "160px",
                  height: "90px",
                  borderRadius: "8px",
                  overflow: "hidden",
                  background: "#eee",
                  flexShrink: 0,
                }}>
                  {video.thumbnailUrl && (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1rem", fontWeight: 600, color: "#333" }}>
                      {video.title}
                    </h4>
                    {!video.active && (
                      <span style={{
                        fontSize: "0.7rem",
                        background: "#fff3e0",
                        color: "#e65100",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "4px",
                        fontWeight: 600,
                        flexShrink: 0,
                      }}>
                        HIDDEN
                      </span>
                    )}
                  </div>

                  {video.description && (
                    <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.8rem", color: "#777", lineHeight: 1.4 }}>
                      {video.description}
                    </p>
                  )}

                  <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.75rem", color: "#999" }}>
                    <span>👁 {video.viewCount || 0} views</span>
                    <span>·</span>
                    <span>Order #{video.order}</span>
                    <span>·</span>
                    <span>{ROLE_LABELS[video.roleCategory as RoleCategory]}</span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                    <button
                      onClick={() => handleEdit(video)}
                      style={{
                        padding: "0.3rem 0.75rem",
                        borderRadius: "6px",
                        border: "1px solid #2e7d32",
                        background: "#fff",
                        color: "#2e7d32",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontFamily: "inherit",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(video)}
                      style={{
                        padding: "0.3rem 0.75rem",
                        borderRadius: "6px",
                        border: "1px solid #ff9800",
                        background: "#fff",
                        color: "#ff9800",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontFamily: "inherit",
                      }}
                    >
                      {video.active ? "Hide" : "Publish"}
                    </button>
                    <button
                      onClick={() => handleDelete(video._id)}
                      style={{
                        padding: "0.3rem 0.75rem",
                        borderRadius: "6px",
                        border: "1px solid #d32f2f",
                        background: "#fff",
                        color: "#d32f2f",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontFamily: "inherit",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

export default function TutorialManagementPage() {
  return (
      <TutorialManagementContent />
  );
}
