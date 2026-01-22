"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";

export default function StoreAdminAuditPage() {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [selectedStoreAdminId, setSelectedStoreAdminId] = useState<Id<"users"> | null>(null);

  const storeAdmins = useQuery(api.adminAudit.getStoreAdmins, userId ? { adminId: userId } : "skip");
  const auditData = useQuery(
    api.adminAudit.getStoreAdminUTIDs,
    userId && selectedStoreAdminId
      ? { adminId: userId, storeAdminId: selectedStoreAdminId }
      : "skip"
  );

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

  if (!userId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Please log in to access StoreAdmin audit.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "clamp(1rem, 4vw, 2rem)", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", marginBottom: "1.5rem" }}>
        StoreAdmin Oversight Panel
      </h1>
      <p style={{ marginBottom: "2rem", color: "#666" }}>
        Select a StoreAdmin to view their delivery verification activity. No personal identities are exposed.
      </p>

      <div style={{ marginBottom: "2rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
          Select StoreAdmin
        </label>
        {storeAdmins === undefined ? (
          <p>Loading StoreAdmins...</p>
        ) : storeAdmins.length === 0 ? (
          <p style={{ color: "#666", padding: "1rem", background: "#fff3cd", borderRadius: "6px" }}>
            No StoreAdmins found.
          </p>
        ) : (
          <select
            value={selectedStoreAdminId || ""}
            onChange={(e) => setSelectedStoreAdminId(e.target.value as Id<"users"> | null)}
            style={{
              width: "100%",
              padding: "0.75rem",
              fontSize: "1rem",
              border: "1px solid #ddd",
              borderRadius: "4px",
            }}
          >
            <option value="">-- Select StoreAdmin --</option>
            {storeAdmins.map((admin: any) => (
              <option key={admin.id} value={admin.id}>
                {admin.alias} ({admin.allowedStorageLocationIds.length} location(s))
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedStoreAdminId && auditData && (
        <div
          style={{
            padding: "1.5rem",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <h2 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>
            Activity for {auditData.storeAdminAlias}
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
            <div style={{ padding: "1rem", background: "#f5f5f5", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.25rem" }}>Total Actions</div>
              <div style={{ fontSize: "1.5rem", fontWeight: "700" }}>{auditData.totalActions}</div>
            </div>
            <div style={{ padding: "1rem", background: "#e8f5e9", borderRadius: "8px" }}>
              <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.25rem" }}>Delivery Verifications</div>
              <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#2e7d32" }}>
                {auditData.deliveryVerifications}
              </div>
            </div>
          </div>

          {auditData.utids.length === 0 ? (
            <p style={{ color: "#666" }}>No delivery verifications yet.</p>
          ) : (
            <div>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Delivery Verifications</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #ddd" }}>
                      <th style={{ padding: "0.75rem", textAlign: "left" }}>UTID</th>
                      <th style={{ padding: "0.75rem", textAlign: "left" }}>Target UTID</th>
                      <th style={{ padding: "0.75rem", textAlign: "left" }}>Reason</th>
                      <th style={{ padding: "0.75rem", textAlign: "left" }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditData.utids.map((entry: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "0.75rem", fontFamily: "monospace", fontSize: "0.9rem" }}>
                          {entry.utid}
                        </td>
                        <td style={{ padding: "0.75rem", fontFamily: "monospace", fontSize: "0.9rem" }}>
                          {entry.targetUtid || "-"}
                        </td>
                        <td style={{ padding: "0.75rem", color: "#666" }}>{entry.reason}</td>
                        <td style={{ padding: "0.75rem", color: "#666" }}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
