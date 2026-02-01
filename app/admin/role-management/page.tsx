"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";

export default function AdminRoleManagementPage() {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
  const [editData, setEditData] = useState<any>(null);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pilot_user");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setUserId(parsed.userId);
        } catch (e) {
          console.error("Failed to parse user", e);
        }
      }
    }
  }, []);

  const allUsers = useQuery(api.introspection.getAllUsers, userId ? { adminId: userId } : "skip");
  const updateUser = useMutation(api.auth.updateUserRoleAndAssignment);
  const [message, setMessage] = useState<string | null>(null);
  
  const handleEdit = (admin: any) => {
    setSelectedAdmin(admin);
    setEditData({
      adminLevel: admin.adminLevel || "",
      adminCategory: admin.adminCategory || "",
      assignedCommunityIds: admin.assignedCommunityIds || [],
    });
  };

  const handleSave = async () => {
    if (!selectedAdmin) return;
    try {
      await updateUser({
        userId: selectedAdmin.userId,
        adminLevel: editData.adminLevel,
        adminCategory: editData.adminCategory,
        assignedCommunityIds: editData.assignedCommunityIds,
      });
      setMessage("Admin updated successfully");
      setSelectedAdmin(null);
    } catch (e: any) {
      setMessage(e.message || "Failed to update admin");
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
      <h1>Admin Role Management (SuperAdmin)</h1>
      {message && <div style={{ color: "green", marginBottom: 16 }}>{message}</div>}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
        <thead>
          <tr>
            <th>Alias</th>
            <th>Email</th>
            <th>Role</th>
            <th>Admin Level</th>
            <th>Admin Category</th>
            <th>Assigned Communities</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(allUsers || []).filter((u: any) => u.role === "admin").map((admin: any) => (
            <tr key={admin.userId}>
              <td>{admin.alias}</td>
              <td>{admin.email}</td>
              <td>{admin.role}</td>
              <td>{admin.adminLevel}</td>
              <td>{admin.adminCategory}</td>
              <td>{(admin.assignedCommunityIds || []).join(", ")}</td>
              <td>
                <button onClick={() => handleEdit(admin)}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {selectedAdmin && (
        <div style={{ background: "#fafafa", padding: 24, borderRadius: 8, marginBottom: 32 }}>
          <h2>Edit Admin: {selectedAdmin.alias}</h2>
          <div style={{ marginBottom: 12 }}>
            <label>Admin Level: </label>
            <select value={editData.adminLevel} onChange={e => setEditData({ ...editData, adminLevel: e.target.value })}>
              <option value="">None</option>
              <option value="super">Super</option>
              <option value="junior">Junior</option>
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Admin Category: </label>
            <select value={editData.adminCategory} onChange={e => setEditData({ ...editData, adminCategory: e.target.value })}>
              <option value="">None</option>
              <option value="community">Community</option>
              <option value="store">Store</option>
              <option value="message">Message</option>
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>Assigned Community IDs (comma separated): </label>
            <input
              type="text"
              value={editData.assignedCommunityIds.join(",")}
              onChange={e => setEditData({ ...editData, assignedCommunityIds: e.target.value.split(",").map((id: string) => id.trim()).filter(Boolean) })}
              style={{ width: 300 }}
            />
          </div>
          <button onClick={handleSave} style={{ marginRight: 8 }}>Save</button>
          <button onClick={() => setSelectedAdmin(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
