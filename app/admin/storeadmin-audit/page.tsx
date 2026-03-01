"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type ViewMode = "actions" | "deliveries" | "inventory";

export default function StoreAdminAuditPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [selectedStoreAdminId, setSelectedStoreAdminId] = useState<Id<"users"> | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<Id<"storageLocations"> | null>(null);

  const storeAdmins = useQuery(api.adminAudit.getStoreAdmins, userId ? { adminId: userId } : "skip");
  const auditData = useQuery(
    api.adminAudit.getStoreAdminUTIDs,
    userId && selectedStoreAdminId
      ? { adminId: userId, storeAdminId: selectedStoreAdminId }
      : "skip"
  );
  const inventoryData = useQuery(
    api.adminAudit.getStoreAdminInventory,
    userId && selectedStoreAdminId
      ? { adminId: userId, storeAdminId: selectedStoreAdminId, locationId: selectedLocationId || undefined }
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "clamp(1.75rem, 5vw, 2.25rem)", fontWeight: "700", color: "#1a1a1a" }}>
          StoreAdmin Oversight Panel
        </h1>
        <button
          onClick={() => router.push("/")}
          style={{
            padding: "0.6rem 1.2rem",
            background: "#f5f5f5",
            border: "1px solid #ddd",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "0.95rem",
            fontWeight: "500",
            color: "#333",
            transition: "all 0.2s",
            minHeight: "44px",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "#e8e8e8";
            e.currentTarget.style.borderColor = "#ccc";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "#f5f5f5";
            e.currentTarget.style.borderColor = "#ddd";
          }}
        >
          ← Back to Dashboard
        </button>
      </div>
      <p style={{ marginBottom: "2rem", color: "#333", fontSize: "1rem" }}>
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
            onChange={(e) => {
              setSelectedStoreAdminId(e.target.value as Id<"users"> | null);
              setViewMode(null); // Reset view mode when changing admin
              setSelectedLocationId(null);
            }}
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
                {admin.alias} ({admin.email}) - {admin.locations.map((l: any) => l.name).join(", ")}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedStoreAdminId && auditData && (
        <div>
          <div
            style={{
              padding: "1.5rem",
              background: "#ffffff",
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              marginBottom: "1.5rem",
              border: "1px solid #e0e0e0",
            }}
          >
            <h2 style={{ fontSize: "1.3rem", marginBottom: "0.5rem", color: "#1a1a1a", fontWeight: "700" }}>
              {auditData.storeAdminAlias} ({auditData.storeAdminEmail})
            </h2>
            <p style={{ color: "#333", fontSize: "0.95rem", margin: "0.5rem 0 0 0" }}>
              <strong>Locations:</strong> {auditData.locations && auditData.locations.length > 0 ? auditData.locations.map((l: any) => `${l.name} (${l.code})`).join(", ") : "No locations assigned"}
            </p>
          </div>

          {/* Clickable Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))", gap: "1rem", marginBottom: "2rem" }}>
            {/* Total Actions Card */}
            <div
              onClick={() => setViewMode("actions")}
              style={{
                padding: "1.5rem",
                background: viewMode === "actions" ? "#e3f2fd" : "#ffffff",
                borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                cursor: "pointer",
                transition: "all 0.2s",
                border: viewMode === "actions" ? "2px solid #2196f3" : "1px solid #e0e0e0",
              }}
              onMouseOver={(e) => {
                if (viewMode !== "actions") e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
              }}
            >
              <div style={{ fontSize: "0.9rem", color: "#333", marginBottom: "0.5rem", fontWeight: "600" }}>
                📊 Total Actions
              </div>
              <div style={{ fontSize: "2rem", fontWeight: "700", color: "#1a1a1a" }}>{auditData.totalActions}</div>
              <div style={{ fontSize: "0.85rem", color: "#999", marginTop: "0.5rem" }}>Click to view logs</div>
            </div>

            {/* Delivery Verifications Card */}
            <div
              onClick={() => setViewMode("deliveries")}
              style={{
                padding: "1.5rem",
                background: viewMode === "deliveries" ? "#e8f5e9" : "#ffffff",
                borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                cursor: "pointer",
                transition: "all 0.2s",
                border: viewMode === "deliveries" ? "2px solid #4caf50" : "1px solid #e0e0e0",
              }}
              onMouseOver={(e) => {
                if (viewMode !== "deliveries") e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
              }}
            >
              <div style={{ fontSize: "0.9rem", color: "#333", marginBottom: "0.5rem", fontWeight: "600" }}>
                ✅ Deliveries Confirmed
              </div>
              <div style={{ fontSize: "2rem", fontWeight: "700", color: "#2e7d32" }}>
                {auditData.deliveryVerifications}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#999", marginTop: "0.5rem" }}>Click to view details</div>
            </div>

            {/* Inventory Card */}
            <div
              onClick={() => setViewMode("inventory")}
              style={{
                padding: "1.5rem",
                background: viewMode === "inventory" ? "#fff3e0" : "#ffffff",
                borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                cursor: "pointer",
                transition: "all 0.2s",
                border: viewMode === "inventory" ? "2px solid #ff9800" : "1px solid #e0e0e0",
              }}
              onMouseOver={(e) => {
                if (viewMode !== "inventory") e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
              }}
            >
              <div style={{ fontSize: "0.9rem", color: "#333", marginBottom: "0.5rem", fontWeight: "600" }}>
                📦 Total Inventory
              </div>
              <div style={{ fontSize: "2rem", fontWeight: "700", color: "#e65100" }}>
                {inventoryData ? `${inventoryData.totalKilos.toLocaleString()} kg` : "..."}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#999", marginTop: "0.5rem" }}>Click to view breakdown</div>
            </div>
          </div>

          {/* Detailed Views */}
          {viewMode === "actions" && (
            <div
              style={{
                padding: "1.5rem",
                background: "#ffffff",
                borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                border: "1px solid #e0e0e0",
              }}
            >
              <h3 style={{ fontSize: "1.2rem", marginBottom: "1rem", color: "#1a1a1a", fontWeight: "700" }}>📊 All Actions Log</h3>
              <p style={{ color: "#333", marginBottom: "1rem" }}>
                Total actions performed: <strong>{auditData.totalActions}</strong>
              </p>
              <p style={{ color: "#666", fontSize: "0.9rem" }}>
                This includes all delivery verifications, inventory updates, and other administrative actions.
              </p>
            </div>
          )}

          {viewMode === "deliveries" && auditData.utids.length === 0 ? (
            <div
              style={{
                padding: "1.5rem",
                background: "#ffffff",
                borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                border: "1px solid #e0e0e0",
              }}
            >
              <p style={{ color: "#666" }}>No delivery verifications yet.</p>
            </div>
          ) : viewMode === "deliveries" && (
            <div
              style={{
                padding: "1.5rem",
                background: "#ffffff",
                borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                border: "1px solid #e0e0e0",
              }}
            >
              <h3 style={{ fontSize: "1.2rem", marginBottom: "1rem", color: "#1a1a1a", fontWeight: "700" }}>✅ Delivery Verifications</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #ddd", background: "#f5f5f5" }}>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>UTID</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Target UTID</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Reason</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditData.utids.map((entry: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "0.75rem", fontFamily: "monospace", fontSize: "0.9rem", color: "#333" }}>
                          {entry.utid}
                        </td>
                        <td style={{ padding: "0.75rem", fontFamily: "monospace", fontSize: "0.9rem", color: "#333" }}>
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

          {viewMode === "inventory" && inventoryData && (
            <div
              style={{
                padding: "1.5rem",
                background: "#ffffff",
                borderRadius: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                border: "1px solid #e0e0e0",
              }}
            >
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "1rem", color: "#1a1a1a", fontWeight: "700" }}>📦 Inventory Summary</h3>
                
                {/* Location Filter */}
                {auditData.locations && auditData.locations.length > 1 && (
                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                      Filter by Location:
                    </label>
                    <select
                      value={selectedLocationId || ""}
                      onChange={(e) => setSelectedLocationId(e.target.value ? e.target.value as Id<"storageLocations"> : null)}
                      style={{
                        padding: "0.5rem",
                        fontSize: "0.95rem",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        minWidth: "200px",
                        minHeight: "44px",
                        color: "#333",
                      }}
                    >
                      <option value="">All Locations</option>
                      {auditData.locations.map((loc: any) => (
                        <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                  <div style={{ padding: "1rem", background: "#f5f5f5", borderRadius: "8px" }}>
                    <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>Total Kilos</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#1a1a1a" }}>
                      {inventoryData.totalKilos.toLocaleString()} kg
                    </div>
                  </div>
                  <div style={{ padding: "1rem", background: "#e8f5e9", borderRadius: "8px" }}>
                    <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>Total Value</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#2e7d32" }}>
                      UGX {inventoryData.totalValue.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ padding: "1rem", background: "#fff3e0", borderRadius: "8px" }}>
                    <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>Inventory Blocks</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#e65100" }}>
                      {inventoryData.totalBlocks}
                    </div>
                  </div>
                </div>

                {/* By Produce Type */}
                {Object.keys(inventoryData.byProduce).length > 0 && (
                  <div>
                    <h4 style={{ fontSize: "1rem", marginBottom: "0.75rem", color: "#333", fontWeight: "600" }}>By Produce Type:</h4>
                    <div style={{ display: "grid", gap: "0.5rem" }}>
                      {Object.entries(inventoryData.byProduce).map(([produce, data]: [string, any]) => (
                        <div
                          key={produce}
                          style={{
                            padding: "0.75rem",
                            background: "#fafafa",
                            borderRadius: "6px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            border: "1px solid #f0f0f0",
                          }}
                        >
                          <span style={{ fontWeight: "600", color: "#333" }}>{produce}</span>
                          <span style={{ color: "#666" }}>
                            {data.kilos.toLocaleString()} kg ({data.blocks} blocks)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
