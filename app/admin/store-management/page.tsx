"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStoredUser } from "../../hooks/useStoredUser";
import { fromStoredUgandaTime, inUgandaTime } from "../../utils/timeUtils";

type Tab = "stores" | "audit";
type ViewMode = "actions" | "deliveries" | "inventory";

/* ─────────────── Store Management Page ─────────────── */
export default function StoreManagementPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("stores");
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;

  if (authStatus === "loading") {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading your session...</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Please log in to access Storage and Transport Officer Management.</p>
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
            Storage and Transport Officer audit
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

        <AuditTab userId={userId} />
      </div>
    </div>
  );
}

/* ═══════════════════════ Audit Tab ═══════════════════════ */
function AuditTab({ userId }: { userId: Id<"users"> }) {
  const [selectedStoreAdminId, setSelectedStoreAdminId] = useState<Id<"users"> | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);

  const storeAdmins = useQuery(api.adminAudit.getStoreAdmins, { adminId: userId });
  const auditData = useQuery(
    api.adminAudit.getStoreAdminUTIDs,
    selectedStoreAdminId ? { adminId: userId, storeAdminId: selectedStoreAdminId } : "skip"
  );
  const inventoryData = useQuery(
    api.adminAudit.getStoreAdminInventory,
    selectedStoreAdminId ? { adminId: userId, storeAdminId: selectedStoreAdminId } : "skip"
  );

  if (!storeAdmins) {
    return <p style={{ color: "#999", textAlign: "center", padding: "2rem" }}>Loading store admins...</p>;
  }

  return (
    <div>
      {/* StoreAdmin Selector */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label style={{ display: "block", fontWeight: 700, marginBottom: "0.5rem", color: "#333" }}>Select Storage and Transport Officer</label>
        <select
          value={selectedStoreAdminId || ""}
          onChange={(e) => {
            setSelectedStoreAdminId(e.target.value ? (e.target.value as Id<"users">) : null);
            setViewMode(null);
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
          <option value="">-- Choose a Storage and Transport Officer --</option>
          {storeAdmins.map((admin: any) => (
            <option key={admin._id} value={admin._id}>
              {admin.fullName || admin.email} ({admin.adminCategory || "store"})
            </option>
          ))}
        </select>
      </div>

      {!selectedStoreAdminId && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#999" }}>
          <p style={{ fontSize: "1.1rem" }}>Select a Storage and Transport Officer above to view their activity.</p>
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
                          <td style={{ padding: "0.6rem", whiteSpace: "nowrap" }}>{new Date(fromStoredUgandaTime(u.timestamp)).toLocaleString(undefined, inUgandaTime())}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {viewMode === "inventory" && inventoryData && (
            <div style={{ background: "#fff", borderRadius: "12px", padding: "1.5rem", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin: "0 0 1rem 0", fontWeight: 700 }}>Exporter inventory at processor facilities</h3>

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
