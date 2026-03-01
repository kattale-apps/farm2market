"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Tab = "stores" | "audit";
type ViewMode = "actions" | "deliveries" | "inventory";

/* ─────────────── Store Management Page ─────────────── */
export default function StoreManagementPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("stores");
  const [userId, setUserId] = useState<Id<"users"> | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("pilot_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.userId) setUserId(parsed.userId as Id<"users">);
        }
      } catch (e) {
        console.error("Error reading user from localStorage:", e);
      }
    }
  }, []);

  if (!userId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Please log in to access Store Management.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "clamp(0.75rem, 3vw, 2rem)",
        background: "#f5f5f5",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <h1 style={{ margin: 0, fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 700 }}>
            Store Management
          </h1>
          <button
            onClick={() => router.push("/")}
            style={{
              padding: "0.6rem 1.2rem",
              background: "#f5f5f5",
              border: "1px solid #ddd",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.9rem",
              minHeight: "44px",
            }}
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Tab Bar */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "2px solid #e0e0e0", paddingBottom: "0" }}>
          {(["stores", "audit"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "0.75rem 1.5rem",
                border: "none",
                borderBottom: activeTab === tab ? "3px solid #1976d2" : "3px solid transparent",
                background: "transparent",
                cursor: "pointer",
                fontWeight: activeTab === tab ? 700 : 500,
                color: activeTab === tab ? "#1976d2" : "#666",
                fontSize: "0.95rem",
                minHeight: "44px",
                transition: "all 0.2s",
              }}
            >
              {tab === "stores" ? "📦 Storage Locations" : "🔍 StoreAdmin Audit"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "stores" ? (
          <StoresTab userId={userId} />
        ) : (
          <AuditTab userId={userId} />
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════ Stores CRUD Tab ═══════════════════════ */
function StoresTab({ userId }: { userId: Id<"users"> }) {
  const locations = useQuery(api.admin.getStorageLocations, { adminId: userId });
  const addLocation = useMutation(api.admin.addStorageLocation);
  const updateLocation = useMutation(api.admin.updateStorageLocation);
  const deleteLocation = useMutation(api.admin.deleteStorageLocation);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"storageLocations"> | null>(null);
  const [form, setForm] = useState({ districtName: "", code: "", order: 0 });
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setForm({ districtName: "", code: "", order: 0 });
    setReason("");
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!form.districtName.trim() || !form.code.trim() || !reason.trim()) {
      setMessage({ type: "error", text: "All fields are required." });
      return;
    }
    setLoading(true);
    try {
      if (editingId) {
        await updateLocation({
          adminId: userId,
          locationId: editingId,
          districtName: form.districtName,
          code: form.code,
          order: form.order,
          reason,
        });
        setMessage({ type: "success", text: "Location updated successfully." });
      } else {
        await addLocation({
          adminId: userId,
          districtName: form.districtName,
          code: form.code,
          order: form.order,
          reason,
        });
        setMessage({ type: "success", text: "Location added successfully." });
      }
      resetForm();
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Operation failed." });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (locationId: Id<"storageLocations">, name: string) => {
    const deleteReason = prompt(`Reason for deleting "${name}":`);
    if (!deleteReason?.trim()) return;
    try {
      await deleteLocation({ adminId: userId, locationId, reason: deleteReason });
      setMessage({ type: "success", text: `"${name}" deleted.` });
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Delete failed." });
    }
  };

  const handleEdit = (loc: any) => {
    setEditingId(loc._id);
    setForm({ districtName: loc.districtName, code: loc.code, order: loc.order });
    setReason("");
    setShowForm(true);
  };

  const handleToggleActive = async (loc: any) => {
    const toggleReason = prompt(`Reason for ${loc.active ? "deactivating" : "activating"} "${loc.districtName}":`);
    if (!toggleReason?.trim()) return;
    try {
      await updateLocation({
        adminId: userId,
        locationId: loc._id,
        active: !loc.active,
        reason: toggleReason,
      });
      setMessage({ type: "success", text: `"${loc.districtName}" ${loc.active ? "deactivated" : "activated"}.` });
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Update failed." });
    }
  };

  return (
    <div>
      {/* Message Toast */}
      {message && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            borderRadius: "8px",
            background: message.type === "success" ? "#e8f5e9" : "#fce4ec",
            color: message.type === "success" ? "#2e7d32" : "#c62828",
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Add Button */}
      {!showForm && (
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#1976d2",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.95rem",
            marginBottom: "1.5rem",
            minHeight: "44px",
          }}
        >
          + Add Storage Location
        </button>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "1.5rem",
            marginBottom: "1.5rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid #e0e0e0",
          }}
        >
          <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: 700 }}>
            {editingId ? "Edit Location" : "Add New Location"}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.3rem" }}>District Name *</label>
              <input
                value={form.districtName}
                onChange={(e) => setForm({ ...form, districtName: e.target.value })}
                placeholder="e.g. Kamuli"
                style={{ width: "100%", padding: "0.6rem", border: "1px solid #ccc", borderRadius: "6px", fontSize: "0.9rem", minHeight: "44px", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.3rem" }}>Code *</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. KML"
                style={{ width: "100%", padding: "0.6rem", border: "1px solid #ccc", borderRadius: "6px", fontSize: "0.9rem", minHeight: "44px", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.3rem" }}>Sort Order</label>
              <input
                type="number"
                value={form.order}
                onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                style={{ width: "100%", padding: "0.6rem", border: "1px solid #ccc", borderRadius: "6px", fontSize: "0.9rem", minHeight: "44px", boxSizing: "border-box" }}
              />
            </div>
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.3rem" }}>Reason *</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Audit reason for this change"
              style={{ width: "100%", padding: "0.6rem", border: "1px solid #ccc", borderRadius: "6px", fontSize: "0.9rem", minHeight: "44px", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                padding: "0.75rem 1.5rem",
                background: "#1976d2",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 600,
                minHeight: "44px",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Saving..." : editingId ? "Update Location" : "Add Location"}
            </button>
            <button
              onClick={resetForm}
              style={{
                padding: "0.75rem 1.5rem",
                background: "#f5f5f5",
                border: "1px solid #ddd",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
                minHeight: "44px",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Locations Table */}
      {!locations ? (
        <p style={{ color: "#999" }}>Loading storage locations...</p>
      ) : locations.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#999" }}>
          <p style={{ fontSize: "1.1rem", fontWeight: 600 }}>No storage locations yet.</p>
          <p>Click &quot;Add Storage Location&quot; to create your first one.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "#fff",
              borderRadius: "12px",
              overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <thead>
              <tr style={{ background: "#f5f5f5" }}>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 700, fontSize: "0.85rem", color: "#333" }}>District Name</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 700, fontSize: "0.85rem", color: "#333" }}>Code</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 700, fontSize: "0.85rem", color: "#333" }}>Order</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 700, fontSize: "0.85rem", color: "#333" }}>Status</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 700, fontSize: "0.85rem", color: "#333" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc: any) => (
                <tr key={loc._id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>{loc.districtName}</td>
                  <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: "#555" }}>{loc.code}</td>
                  <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>{loc.order}</td>
                  <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>
                    <span
                      style={{
                        padding: "0.25rem 0.75rem",
                        borderRadius: "12px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        background: loc.active !== false ? "#e8f5e9" : "#fce4ec",
                        color: loc.active !== false ? "#2e7d32" : "#c62828",
                      }}
                    >
                      {loc.active !== false ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button
                        onClick={() => handleEdit(loc)}
                        style={{
                          padding: "0.4rem 0.75rem",
                          background: "#e3f2fd",
                          color: "#1565c0",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: "0.82rem",
                          minHeight: "36px",
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(loc)}
                        style={{
                          padding: "0.4rem 0.75rem",
                          background: loc.active !== false ? "#fff3e0" : "#e8f5e9",
                          color: loc.active !== false ? "#e65100" : "#2e7d32",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: "0.82rem",
                          minHeight: "36px",
                        }}
                      >
                        {loc.active !== false ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDelete(loc._id, loc.districtName)}
                        style={{
                          padding: "0.4rem 0.75rem",
                          background: "#fce4ec",
                          color: "#c62828",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: "0.82rem",
                          minHeight: "36px",
                        }}
                      >
                        Delete
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
  );
}

/* ═══════════════════════ Audit Tab ═══════════════════════ */
function AuditTab({ userId }: { userId: Id<"users"> }) {
  const [selectedStoreAdminId, setSelectedStoreAdminId] = useState<Id<"users"> | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<Id<"storageLocations"> | null>(null);

  const storeAdmins = useQuery(api.adminAudit.getStoreAdmins, { adminId: userId });
  const auditData = useQuery(
    api.adminAudit.getStoreAdminUTIDs,
    selectedStoreAdminId ? { adminId: userId, storeAdminId: selectedStoreAdminId } : "skip"
  );
  const inventoryData = useQuery(
    api.adminAudit.getStoreAdminInventory,
    selectedStoreAdminId ? { adminId: userId, storeAdminId: selectedStoreAdminId, locationId: selectedLocationId || undefined } : "skip"
  );

  if (!storeAdmins) {
    return <p style={{ color: "#999", textAlign: "center", padding: "2rem" }}>Loading store admins...</p>;
  }

  return (
    <div>
      {/* StoreAdmin Selector */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label style={{ display: "block", fontWeight: 700, marginBottom: "0.5rem", color: "#333" }}>Select Store Admin</label>
        <select
          value={selectedStoreAdminId || ""}
          onChange={(e) => {
            setSelectedStoreAdminId(e.target.value ? (e.target.value as Id<"users">) : null);
            setViewMode(null);
            setSelectedLocationId(null);
          }}
          style={{
            width: "100%",
            maxWidth: "400px",
            padding: "0.6rem",
            border: "1px solid #ccc",
            borderRadius: "6px",
            fontSize: "0.95rem",
            minHeight: "44px",
          }}
        >
          <option value="">-- Choose a Store Admin --</option>
          {storeAdmins.map((admin: any) => (
            <option key={admin._id} value={admin._id}>
              {admin.fullName || admin.email} ({admin.adminCategory || "store"})
            </option>
          ))}
        </select>
      </div>

      {!selectedStoreAdminId && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#999" }}>
          <p style={{ fontSize: "1.1rem" }}>Select a store admin above to view their activity.</p>
        </div>
      )}

      {selectedStoreAdminId && auditData && (
        <>
          {/* Summary Text */}
          <div style={{ marginBottom: "1rem", padding: "1rem", background: "#e3f2fd", borderRadius: "8px" }}>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#1565c0" }}>
              <strong>{auditData.storeAdminAlias || auditData.storeAdminEmail}</strong> — {auditData.totalActions} actions,{" "}
              {auditData.deliveryVerifications} delivery verifications
            </p>
          </div>

          {/* Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            <div
              onClick={() => setViewMode("actions")}
              style={{
                padding: "1.5rem",
                background: viewMode === "actions" ? "#e3f2fd" : "#fff",
                borderRadius: "12px",
                border: viewMode === "actions" ? "2px solid #1976d2" : "1px solid #e0e0e0",
                cursor: "pointer",
                transition: "all 0.2s",
                minHeight: "44px",
              }}
            >
              <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1976d2" }}>{auditData.totalActions}</div>
              <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>Admin Actions</div>
            </div>
            <div
              onClick={() => setViewMode("deliveries")}
              style={{
                padding: "1.5rem",
                background: viewMode === "deliveries" ? "#e8f5e9" : "#fff",
                borderRadius: "12px",
                border: viewMode === "deliveries" ? "2px solid #43a047" : "1px solid #e0e0e0",
                cursor: "pointer",
                transition: "all 0.2s",
                minHeight: "44px",
              }}
            >
              <div style={{ fontSize: "2rem", fontWeight: 700, color: "#43a047" }}>{auditData.deliveryVerifications}</div>
              <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>Delivery Verifications</div>
            </div>
            <div
              onClick={() => setViewMode("inventory")}
              style={{
                padding: "1.5rem",
                background: viewMode === "inventory" ? "#fff3e0" : "#fff",
                borderRadius: "12px",
                border: viewMode === "inventory" ? "2px solid #ef6c00" : "1px solid #e0e0e0",
                cursor: "pointer",
                transition: "all 0.2s",
                minHeight: "44px",
              }}
            >
              <div style={{ fontSize: "2rem", fontWeight: 700, color: "#ef6c00" }}>
                {inventoryData ? `${inventoryData.totalKilos.toLocaleString()} kg` : "..."}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.25rem" }}>Inventory</div>
            </div>
          </div>

          {/* Detail Panels */}
          {viewMode === "actions" && auditData.utids && (
            <div style={{ background: "#fff", borderRadius: "12px", padding: "1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin: "0 0 1rem 0", fontWeight: 700 }}>Delivery Verification UTIDs</h3>
              {auditData.utids.length === 0 ? (
                <p style={{ color: "#999" }}>No delivery verifications recorded.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                    <thead>
                      <tr style={{ background: "#f5f5f5" }}>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>UTID</th>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Target UTID</th>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Reason</th>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditData.utids.map((u: any, idx: number) => (
                        <tr key={idx} style={{ borderTop: "1px solid #eee" }}>
                          <td style={{ padding: "0.6rem", fontFamily: "monospace", fontSize: "0.78rem" }}>{u.utid || "—"}</td>
                          <td style={{ padding: "0.6rem", fontFamily: "monospace", fontSize: "0.78rem" }}>{u.targetUtid || "—"}</td>
                          <td style={{ padding: "0.6rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>{u.reason || "—"}</td>
                          <td style={{ padding: "0.6rem", whiteSpace: "nowrap" }}>{new Date(u.timestamp).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {viewMode === "deliveries" && auditData.locations && (
            <div style={{ background: "#fff", borderRadius: "12px", padding: "1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin: "0 0 1rem 0", fontWeight: 700 }}>Assigned Locations</h3>
              {auditData.locations.length === 0 ? (
                <p style={{ color: "#999" }}>No locations assigned.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: "0.75rem" }}>
                  {auditData.locations.map((loc: any) => (
                    <div key={loc.id} style={{ padding: "1rem", background: "#f5f5f5", borderRadius: "8px" }}>
                      <div style={{ fontWeight: 700 }}>{loc.name}</div>
                      <div style={{ fontSize: "0.82rem", color: "#888", fontFamily: "monospace" }}>{loc.code}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode === "inventory" && inventoryData && (
            <div style={{ background: "#fff", borderRadius: "12px", padding: "1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin: "0 0 1rem 0", fontWeight: 700 }}>Inventory Summary</h3>

              {/* Location Filter */}
              {auditData.locations && auditData.locations.length > 0 && (
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", marginBottom: "0.3rem", fontWeight: 600, fontSize: "0.85rem" }}>Filter by Location:</label>
                  <select
                    value={selectedLocationId || ""}
                    onChange={(e) => setSelectedLocationId(e.target.value ? (e.target.value as Id<"storageLocations">) : null)}
                    style={{ padding: "0.5rem", fontSize: "0.9rem", border: "1px solid #ccc", borderRadius: "6px", minHeight: "44px", minWidth: "200px" }}
                  >
                    <option value="">All Locations</option>
                    {auditData.locations.map((loc: any) => (
                      <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Inventory Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: "1rem", marginBottom: "1rem" }}>
                <div style={{ padding: "1rem", background: "#f5f5f5", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.82rem", color: "#666" }}>Total Kilos</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{inventoryData.totalKilos.toLocaleString()} kg</div>
                </div>
                <div style={{ padding: "1rem", background: "#e8f5e9", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.82rem", color: "#666" }}>Total Value</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#2e7d32" }}>UGX {inventoryData.totalValue.toLocaleString()}</div>
                </div>
                <div style={{ padding: "1rem", background: "#fff3e0", borderRadius: "8px" }}>
                  <div style={{ fontSize: "0.82rem", color: "#666" }}>Inventory Blocks</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#ef6c00" }}>{inventoryData.totalBlocks}</div>
                </div>
              </div>

              {/* By Produce Type */}
              {inventoryData.byProduce && Object.keys(inventoryData.byProduce).length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", fontWeight: 700 }}>By Produce Type</h4>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                    <thead>
                      <tr style={{ background: "#f5f5f5" }}>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Produce</th>
                        <th style={{ padding: "0.6rem", textAlign: "right" }}>Kilos</th>
                        <th style={{ padding: "0.6rem", textAlign: "right" }}>Blocks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(inventoryData.byProduce).map(([produce, data]: [string, any]) => (
                        <tr key={produce} style={{ borderTop: "1px solid #eee" }}>
                          <td style={{ padding: "0.6rem", fontWeight: 600 }}>{produce}</td>
                          <td style={{ padding: "0.6rem", textAlign: "right" }}>{data.kilos?.toLocaleString() || 0} kg</td>
                          <td style={{ padding: "0.6rem", textAlign: "right" }}>{data.blocks || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
