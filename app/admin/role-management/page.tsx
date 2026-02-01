"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

/* ───────────────── Types ───────────────── */

type AnyUser = {
  userId: Id<"users">;
  alias: string;
  email?: string;
  phoneNumber?: string;
  role: "farmer" | "trader" | "buyer" | "admin";
  adminLevel?: "super" | "junior";
  adminCategory?: "community" | "store" | "message";
  assignedCommunityIds?: Id<"communities">[];
};

type AdminLevel = "super" | "junior" | "";
type AdminCategory = "community" | "store" | "message" | "";

type EditAdminState = {
  adminLevel: AdminLevel;
  adminCategory: AdminCategory;
  assignedCommunityIds: string[];
};

/* ───────────────── Page ───────────────── */

export default function AdminRoleManagementPage() {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<AnyUser | null>(null);
  const [editData, setEditData] = useState<EditAdminState | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  /* Load pilot user */
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

  const updateUser = useMutation(api.auth.updateUserRoleAndAssignment);

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

  /* ───────────────── UI ───────────────── */

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7f6", padding: "2rem" }}>
      <div
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          background: "#fff",
          padding: "2rem",
          borderRadius: 14,
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
        }}
      >
        <h1>Admin Role Management (Super Admin)</h1>

        {message && (
          <div
            style={{
              margin: "1rem 0",
              padding: "0.75rem 1rem",
              background: "#e8f5e9",
              color: "#2e7d32",
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            {message}
          </div>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f0f0f0" }}>
              <th>Alias</th>
              <th>Email</th>
              <th>Admin Level</th>
              <th>Admin Category</th>
              <th>Assigned Communities</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin.userId}>
                <td>{admin.alias}</td>
                <td>{admin.email ?? "-"}</td>
                <td>{admin.adminLevel ?? "-"}</td>
                <td>{admin.adminCategory ?? "-"}</td>
                <td>
                  {admin.assignedCommunityIds?.length
                    ? admin.assignedCommunityIds.join(", ")
                    : "-"}
                </td>
                <td>
                  <button
                    onClick={() => handleEdit(admin)}
                    style={{
                      padding: "0.4rem 0.75rem",
                      background: "#1976d2",
                      color: "#fff",
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {selectedAdmin && editData && (
          <div
            style={{
              marginTop: "2rem",
              background: "#fafafa",
              padding: "1.5rem",
              borderRadius: 12,
              border: "1px solid #ddd",
            }}
          >
            <h2>Edit Admin: {selectedAdmin.alias}</h2>

            <label>Admin Level</label>
            <select
              value={editData.adminLevel}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  adminLevel: e.target.value as AdminLevel,
                })
              }
            >
              <option value="">None</option>
              <option value="super">Super</option>
              <option value="junior">Junior</option>
            </select>

            <label style={{ marginTop: 12 }}>Admin Category</label>
            <select
              value={editData.adminCategory}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  adminCategory: e.target.value as AdminCategory,
                })
              }
            >
              <option value="">None</option>
              <option value="community">Community</option>
              <option value="store">Store</option>
              <option value="message">Message</option>
            </select>

            <label style={{ marginTop: 12 }}>Assigned Community IDs</label>
            <input
              type="text"
              value={editData.assignedCommunityIds.join(",")}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  assignedCommunityIds: e.target.value
                    .split(",")
                    .map((id) => id.trim())
                    .filter(Boolean),
                })
              }
              style={{ width: "100%" }}
            />

            <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
              <button
                onClick={handleSave}
                style={{
                  background: "#4caf50",
                  color: "#fff",
                  padding: "0.6rem 1.2rem",
                  borderRadius: 6,
                  border: "none",
                  fontWeight: 600,
                }}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setSelectedAdmin(null);
                  setEditData(null);
                }}
                style={{
                  background: "#e0e0e0",
                  padding: "0.6rem 1.2rem",
                  borderRadius: 6,
                  border: "none",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
