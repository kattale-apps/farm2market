"use client";

import { useState } from "react";
import { Id } from "../../convex/_generated/dataModel";

interface DeliveryConfirmationFormProps {
  allUTIDs: any;
  confirmDelivery: any;
  adminId: Id<"users">;
  isSuperAdmin?: boolean;
}

export function DeliveryConfirmationForm({
  allUTIDs,
  confirmDelivery,
  adminId,
  isSuperAdmin = true,
}: DeliveryConfirmationFormProps) {
  const [selectedUtid, setSelectedUtid] = useState<string>("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filter UTIDs to only show unit_lock type UTIDs with deliveryStatus === "farmer_confirmed"
  // These are deliveries that farmers have self-confirmed and are awaiting admin confirmation
  const lockUtids = allUTIDs?.utids?.filter((utid: any) => {
    if (utid.type !== "unit_lock") return false;
    // Check if any entity has deliveryStatus === "farmer_confirmed"
    return utid.entities?.some((entity: any) => entity.deliveryStatus === "farmer_confirmed");
  }) || [];
  
  // For junior admins, check which UTIDs they can access
  const getUtidAccess = (utid: any) => {
    if (isSuperAdmin) return true;
    return utid.canAccess !== false; // Default to true if not set
  };
  
  // For junior admins, check which UTIDs they can access
  const getUtidAccess = (utid: any) => {
    if (isSuperAdmin) return true;
    return utid.canAccess !== false; // Default to true if not set
  };

  const handleConfirm = async () => {
    if (!selectedUtid) {
      setMessage({ type: "error", text: "Please select a UTID" });
      return;
    }
    if (!reason.trim()) {
      setMessage({ type: "error", text: "Please provide a reason for confirmation" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await confirmDelivery({
        adminId,
        lockUtid: selectedUtid,
        reason: reason.trim(),
      });

      setMessage({
        type: "success",
        text: `Delivery confirmed successfully! ${result.inventoryCreated.length} inventory item(s) created.`,
      });

      // Reset form
      setSelectedUtid("");
      setReason("");
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: `Failed to confirm delivery: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: "600" }}>
          Select Farmer-Confirmed Delivery UTID:
        </label>
        <p style={{ fontSize: "0.8rem", color: "#666", marginBottom: "0.5rem" }}>
          Only deliveries that farmers have self-confirmed are shown here. Location information is displayed for each UTID.
          {!isSuperAdmin && " Only UTIDs from your assigned storage locations are visible."}
        </p>
        {lockUtids.length === 0 ? (
          <p style={{ color: "#666", fontSize: "0.85rem" }}>No deliveries available for confirmation. Farmers must self-confirm deliveries first.</p>
        ) : (
          <select
            value={selectedUtid}
            onChange={(e) => setSelectedUtid(e.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: "0.9rem",
              background: "#fff",
            }}
          >
            <option value="">-- Select a lock UTID --</option>
            {lockUtids.map((utid: any) => {
              const entity = utid.entities?.find((e: any) => e.deliveryStatus === "farmer_confirmed") || utid.entities?.[0];
              const location = entity?.storageLocation;
              const locationText = location ? ` - ${location.districtName} (${location.code})` : "";
              return (
                <option key={utid.utid} value={utid.utid}>
                  {utid.utid} - {entity?.produceType || "Produce"} ({entity?.quantity || "10"}kg){locationText}
                </option>
              );
            })}
          </select>
        )}
        {selectedUtid && (() => {
          const selectedUtidData = lockUtids.find((u: any) => u.utid === selectedUtid);
          const entity = selectedUtidData?.entities?.find((e: any) => e.deliveryStatus === "farmer_confirmed") || selectedUtidData?.entities?.[0];
          const location = entity?.storageLocation;
          return location ? (
            <div style={{
              marginTop: "0.75rem",
              padding: "0.75rem",
              background: "#e3f2fd",
              borderRadius: "6px",
              border: "1px solid #90caf9",
            }}>
              <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#1565c0", marginBottom: "0.25rem" }}>
                Delivery Location:
              </div>
              <div style={{ fontSize: "0.9rem", color: "#1976d2" }}>
                {location.districtName} ({location.code})
              </div>
            </div>
          ) : null;
        })()}
      </div>

      <div>
        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: "600" }}>
          Reason (required):
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason for confirming delivery..."
          rows={3}
          style={{
            width: "100%",
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "0.9rem",
            fontFamily: "inherit",
          }}
        />
      </div>

      {message && (
        <div
          style={{
            padding: "0.75rem",
            background: message.type === "success" ? "#e8f5e9" : "#ffebee",
            borderRadius: "6px",
            border: `1px solid ${message.type === "success" ? "#4caf50" : "#ef5350"}`,
            color: message.type === "success" ? "#2e7d32" : "#c62828",
            fontSize: "0.85rem",
          }}
        >
          {message.text}
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={loading || !selectedUtid || !reason.trim() || lockUtids.length === 0}
        style={{
          padding: "0.75rem 1.5rem",
          background: loading || !selectedUtid || !reason.trim() || lockUtids.length === 0 ? "#ccc" : "#4caf50",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          fontSize: "1rem",
          fontWeight: "600",
          cursor: loading || !selectedUtid || !reason.trim() || lockUtids.length === 0 ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Confirming..." : "Confirm Delivery to Storage"}
      </button>
    </div>
  );
}
