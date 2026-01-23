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
  const [photoBefore, setPhotoBefore] = useState("");
  const [photoDuring, setPhotoDuring] = useState("");
  const [photoInStorage, setPhotoInStorage] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filter UTIDs to show delivery-eligible unit_lock UTIDs.
  // SuperAdmin can view all farmer UTIDs, but only farmer-confirmed deliveries can be confirmed.
  const lockUtids = allUTIDs?.utids?.filter((utid: any) => {
    if (utid.type !== "unit_lock") return false;
    if (isSuperAdmin) {
      return utid.entities?.some((entity: any) => entity.deliveryStatus !== "delivered");
    }
    return utid.entities?.some((entity: any) => entity.deliveryStatus === "farmer_confirmed");
  }) || [];

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
      const deliveryPhotos = [photoBefore, photoDuring, photoInStorage].map((v) => v.trim()).filter(Boolean);
      const result = await confirmDelivery({
        adminId,
        lockUtid: selectedUtid,
        reason: reason.trim(),
        deliveryPhotos: deliveryPhotos.length > 0 ? deliveryPhotos : undefined,
      });

      setMessage({
        type: "success",
        text: `Delivery confirmed successfully! ${result.inventoryCreated.length} inventory item(s) created.`,
      });

      // Reset form
      setSelectedUtid("");
      setReason("");
      setPhotoBefore("");
      setPhotoDuring("");
      setPhotoInStorage("");
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

  const selectedUtidData = selectedUtid
    ? lockUtids.find((u: any) => u.utid === selectedUtid)
    : null;
  const selectedEntity =
    selectedUtidData?.entities?.find((e: any) => e.deliveryStatus === "farmer_confirmed") ||
    selectedUtidData?.entities?.[0];
  const isConfirmable = selectedEntity?.deliveryStatus === "farmer_confirmed";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: "600" }}>
          Select Delivery UTID:
        </label>
        <p style={{ fontSize: "0.8rem", color: "#666", marginBottom: "0.5rem" }}>
          {isSuperAdmin
            ? "SuperAdmin can view all farmer UTIDs. Only farmer-confirmed deliveries can be confirmed here."
            : "Only deliveries that farmers have self-confirmed are shown here. Location information is displayed for each UTID."}
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
              const statusText = entity?.deliveryStatus ? ` [${entity.deliveryStatus}]` : "";
              return (
                <option key={utid.utid} value={utid.utid}>
                  {utid.utid} - {entity?.produceType || "Produce"} ({entity?.quantity || "10"}kg){locationText}{statusText}
                </option>
              );
            })}
          </select>
        )}
        {selectedUtid && (() => {
          const entity = selectedEntity;
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
        {selectedUtid && !isConfirmable && (
          <div style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            background: "#fff3cd",
            borderRadius: "6px",
            border: "1px solid #ffeeba",
            fontSize: "0.85rem",
            color: "#856404",
          }}>
            This UTID is not yet farmer-confirmed. SuperAdmin can view it, but confirmation requires farmer confirmation.
          </div>
        )}
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

      {isSuperAdmin && (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#1a1a1a" }}>
            Optional Delivery Photos (URLs)
          </div>
          <input
            type="text"
            value={photoBefore}
            onChange={(e) => setPhotoBefore(e.target.value)}
            placeholder="Before delivery (optional)"
            style={{
              width: "100%",
              padding: "0.75rem",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: "0.9rem",
            }}
          />
          <input
            type="text"
            value={photoDuring}
            onChange={(e) => setPhotoDuring(e.target.value)}
            placeholder="During delivery (optional)"
            style={{
              width: "100%",
              padding: "0.75rem",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: "0.9rem",
            }}
          />
          <input
            type="text"
            value={photoInStorage}
            onChange={(e) => setPhotoInStorage(e.target.value)}
            placeholder="In storage (optional)"
            style={{
              width: "100%",
              padding: "0.75rem",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: "0.9rem",
            }}
          />
        </div>
      )}

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
        disabled={loading || !selectedUtid || !reason.trim() || lockUtids.length === 0 || !isConfirmable}
        style={{
          padding: "0.75rem 1.5rem",
          background: loading || !selectedUtid || !reason.trim() || lockUtids.length === 0 || !isConfirmable ? "#ccc" : "#4caf50",
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
