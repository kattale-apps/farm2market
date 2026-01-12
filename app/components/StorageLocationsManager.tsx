"use client";

import { useState } from "react";
import { Id } from "../../convex/_generated/dataModel";

interface StorageLocationsManagerProps {
  storageLocations: any[];
  addStorageLocation: any;
  updateStorageLocation: any;
  deleteStorageLocation: any;
  adminId: Id<"users">;
}

export function StorageLocationsManager({
  storageLocations,
  addStorageLocation,
  updateStorageLocation,
  deleteStorageLocation,
  adminId,
}: StorageLocationsManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDistrictName, setNewDistrictName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newOrder, setNewOrder] = useState<string>("0");
  const [addReason, setAddReason] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addMessage, setAddMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDistrictName, setEditDistrictName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editOrder, setEditOrder] = useState<string>("");
  const [editActive, setEditActive] = useState(true);
  const [editReason, setEditReason] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newDistrictName.trim() || !newCode.trim()) {
      setAddMessage({ type: "error", text: "District name and code are required" });
      return;
    }
    if (!addReason.trim()) {
      setAddMessage({ type: "error", text: "Reason is required" });
      return;
    }

    setAddLoading(true);
    setAddMessage(null);
    try {
      const result = await addStorageLocation({
        adminId,
        districtName: newDistrictName.trim(),
        code: newCode.trim().toUpperCase(),
        order: parseInt(newOrder) || 0,
        reason: addReason.trim(),
      });
      setAddMessage({
        type: "success",
        text: `Storage location added successfully! UTID: ${result.utid}`
      });
      setNewDistrictName("");
      setNewCode("");
      setNewOrder("0");
      setAddReason("");
      setShowAddForm(false);
    } catch (error: any) {
      setAddMessage({ type: "error", text: `Failed to add location: ${error.message}` });
    } finally {
      setAddLoading(false);
    }
  };

  const handleEdit = async (locationId: string) => {
    if (!editReason.trim()) {
      setEditMessage({ type: "error", text: "Reason is required" });
      return;
    }

    setEditLoading(true);
    setEditMessage(null);
    try {
      const result = await updateStorageLocation({
        adminId,
        locationId: locationId as Id<"storageLocations">,
        districtName: editDistrictName.trim(),
        code: editCode.trim().toUpperCase(),
        order: parseInt(editOrder) || 0,
        active: editActive,
        reason: editReason.trim(),
      });
      setEditMessage({
        type: "success",
        text: `Storage location updated successfully! UTID: ${result.utid}`
      });
      setEditingId(null);
      setEditReason("");
      setTimeout(() => setEditMessage(null), 3000);
    } catch (error: any) {
      setEditMessage({ type: "error", text: `Failed to update location: ${error.message}` });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (locationId: string) => {
    if (!deleteReason.trim()) {
      return;
    }

    try {
      const result = await deleteStorageLocation({
        adminId,
        locationId: locationId as Id<"storageLocations">,
        reason: deleteReason.trim(),
      });
      setDeletingId(null);
      setDeleteReason("");
    } catch (error: any) {
      alert(`Failed to delete location: ${error.message}`);
    }
  };

  const startEdit = (location: any) => {
    setEditingId(location._id);
    setEditDistrictName(location.districtName);
    setEditCode(location.code);
    setEditOrder(String(location.order));
    setEditActive(location.active);
    setEditReason("");
    setEditMessage(null);
  };

  return (
    <div>
      {/* Add New Location Form */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#4caf50",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "1rem",
            fontWeight: "600",
            marginBottom: "1rem"
          }}
        >
          + Add Storage Location
        </button>
      ) : (
        <div style={{
          padding: "1rem",
          background: "#f9f9f9",
          borderRadius: "8px",
          marginBottom: "1rem",
          border: "1px solid #e0e0e0"
        }}>
          <h4 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Add New Storage Location</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", fontWeight: "600" }}>
                District Name *:
              </label>
              <input
                type="text"
                value={newDistrictName}
                onChange={(e) => setNewDistrictName(e.target.value)}
                placeholder="e.g., Kampala, Wakiso, Mukono"
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "0.9rem"
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", fontWeight: "600" }}>
                Code *:
              </label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="e.g., KLA, WKS, MKN"
                maxLength={10}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "0.9rem"
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", fontWeight: "600" }}>
                Order:
              </label>
              <input
                type="number"
                value={newOrder}
                onChange={(e) => setNewOrder(e.target.value)}
                min="0"
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "0.9rem"
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", fontWeight: "600" }}>
                Reason (required):
              </label>
              <textarea
                value={addReason}
                onChange={(e) => setAddReason(e.target.value)}
                placeholder="Enter reason for adding this location..."
                rows={2}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "0.9rem"
                }}
              />
            </div>
            {addMessage && (
              <div style={{
                padding: "0.5rem",
                background: addMessage.type === "success" ? "#e8f5e9" : "#ffebee",
                borderRadius: "4px",
                color: addMessage.type === "success" ? "#2e7d32" : "#c62828",
                fontSize: "0.85rem"
              }}>
                {addMessage.text}
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={handleAdd}
                disabled={addLoading}
                style={{
                  padding: "0.5rem 1rem",
                  background: addLoading ? "#ccc" : "#4caf50",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "0.9rem",
                  cursor: addLoading ? "not-allowed" : "pointer"
                }}
              >
                {addLoading ? "Adding..." : "Add Location"}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewDistrictName("");
                  setNewCode("");
                  setNewOrder("0");
                  setAddReason("");
                  setAddMessage(null);
                }}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#f5f5f5",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "0.9rem",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Locations List */}
      <div style={{ marginTop: "1.5rem" }}>
        <h4 style={{ marginBottom: "0.75rem", fontSize: "1.1rem" }}>Existing Storage Locations</h4>
        {storageLocations.length === 0 ? (
          <p style={{ color: "#666", fontSize: "0.9rem" }}>No storage locations defined yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {storageLocations.map((location) => (
              <div
                key={location._id}
                style={{
                  padding: "1rem",
                  background: location.active ? "#fff" : "#f5f5f5",
                  borderRadius: "6px",
                  border: `1px solid ${location.active ? "#e0e0e0" : "#ccc"}`,
                  opacity: location.active ? 1 : 0.6
                }}
              >
                {editingId === location._id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div>
                      <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", fontWeight: "600" }}>
                        District Name:
                      </label>
                      <input
                        type="text"
                        value={editDistrictName}
                        onChange={(e) => setEditDistrictName(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          fontSize: "0.9rem"
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", fontWeight: "600" }}>
                        Code:
                      </label>
                      <input
                        type="text"
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                        maxLength={10}
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          fontSize: "0.9rem"
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", fontWeight: "600" }}>
                        Order:
                      </label>
                      <input
                        type="number"
                        value={editOrder}
                        onChange={(e) => setEditOrder(e.target.value)}
                        min="0"
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          fontSize: "0.9rem"
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
                        <input
                          type="checkbox"
                          checked={editActive}
                          onChange={(e) => setEditActive(e.target.checked)}
                        />
                        Active (available to farmers)
                      </label>
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", fontWeight: "600" }}>
                        Reason (required):
                      </label>
                      <textarea
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        placeholder="Enter reason for updating..."
                        rows={2}
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          fontSize: "0.9rem"
                        }}
                      />
                    </div>
                    {editMessage && (
                      <div style={{
                        padding: "0.5rem",
                        background: editMessage.type === "success" ? "#e8f5e9" : "#ffebee",
                        borderRadius: "4px",
                        color: editMessage.type === "success" ? "#2e7d32" : "#c62828",
                        fontSize: "0.85rem"
                      }}>
                        {editMessage.text}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={() => handleEdit(location._id)}
                        disabled={editLoading}
                        style={{
                          padding: "0.5rem 1rem",
                          background: editLoading ? "#ccc" : "#1976d2",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          fontSize: "0.9rem",
                          cursor: editLoading ? "not-allowed" : "pointer"
                        }}
                      >
                        {editLoading ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditReason("");
                          setEditMessage(null);
                        }}
                        style={{
                          padding: "0.5rem 1rem",
                          background: "#f5f5f5",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          fontSize: "0.9rem",
                          cursor: "pointer"
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
                        {location.districtName} ({location.code}) {!location.active && <span style={{ color: "#999", fontSize: "0.85rem" }}>(Inactive)</span>}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#666" }}>
                        Order: {location.order}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button
                        onClick={() => startEdit(location)}
                        style={{
                          padding: "0.5rem",
                          background: "#1976d2",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          fontSize: "1.2rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: "36px",
                          height: "36px"
                        }}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      {deletingId === location._id ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "min(200px, 100%)", width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
                          <input
                            type="text"
                            value={deleteReason}
                            onChange={(e) => setDeleteReason(e.target.value)}
                            placeholder="Reason for deletion..."
                            style={{
                              padding: "0.25rem 0.5rem",
                              border: "1px solid #ddd",
                              borderRadius: "4px",
                              fontSize: "0.85rem"
                            }}
                          />
                          <div style={{ display: "flex", gap: "0.25rem" }}>
                            <button
                              onClick={() => handleDelete(location._id)}
                              style={{
                                padding: "0.25rem 0.5rem",
                                background: "#d32f2f",
                                color: "#fff",
                                border: "none",
                                borderRadius: "4px",
                                fontSize: "0.8rem",
                                cursor: "pointer"
                              }}
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => {
                                setDeletingId(null);
                                setDeleteReason("");
                              }}
                              style={{
                                padding: "0.25rem 0.5rem",
                                background: "#f5f5f5",
                                border: "1px solid #ddd",
                                borderRadius: "4px",
                                fontSize: "0.8rem",
                                cursor: "pointer"
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(location._id)}
                          style={{
                            padding: "0.5rem",
                            background: "#d32f2f",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            fontSize: "1.2rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minWidth: "36px",
                            height: "36px"
                          }}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
