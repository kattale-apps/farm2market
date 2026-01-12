"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatUgandaDateTime, formatUgandaTimeOnly, getUgandaTime } from "../utils/timeUtils";
import { useState } from "react";
import { exportToExcel, exportToPDF, formatUTIDDataForExport } from "../utils/exportUtils";
import { StorageLocationsManager } from "./StorageLocationsManager";
import { DeliveryConfirmationForm } from "./DeliveryConfirmationForm";

interface AdminDashboardProps {
  userId: Id<"users">;
}

export function AdminDashboard({ userId }: AdminDashboardProps) {
  const redFlags = useQuery(api.adminRedFlags.getRedFlagsSummary, { adminId: userId });
  const allUTIDs = useQuery(api.introspection.getAllActiveUTIDs, { adminId: userId });
  const pilotMode = useQuery(api.pilotMode.getPilotMode);
  const purchaseWindowStatus = useQuery(api.admin.getPurchaseWindowStatus, { adminId: userId });
  
  const openPurchaseWindow = useMutation(api.admin.openPurchaseWindow);
  const closePurchaseWindow = useMutation(api.admin.closePurchaseWindow);
  const setPilotMode = useMutation(api.pilotMode.setPilotMode);
  const updateKiloShavingRate = useMutation(api.admin.updateKiloShavingRate);
  const getKiloShavingRate = useQuery(api.admin.getKiloShavingRate, { adminId: userId });
  const updateBuyerServiceFeePercentage = useMutation(api.admin.updateBuyerServiceFeePercentage);
  const getBuyerServiceFeePercentage = useQuery(api.admin.getBuyerServiceFeePercentageQuery, { adminId: userId });
  const updateTraderSpendCap = useMutation(api.admin.updateTraderSpendCap);
  const updateAllTradersSpendCap = useMutation(api.admin.updateAllTradersSpendCap);
  const sendNotificationToSelectedUsers = useMutation(api.notifications.sendNotificationToSelectedUsers);
  const sendRoleBasedNotification = useMutation(api.notifications.sendRoleBasedNotification);
  const confirmDeliveryToStorageByUTID = useMutation(api.admin.confirmDeliveryToStorageByUTID);
  const adminDepositDemoFunds = useMutation(api.admin.adminDepositDemoFunds);
  const allUsers = useQuery(api.introspection.getAllUsers, { adminId: userId });
  const qualityOptions = useQuery(api.admin.getQualityOptions, { adminId: userId, activeOnly: false });
  const addQualityOption = useMutation(api.admin.addQualityOption);
  const updateQualityOption = useMutation(api.admin.updateQualityOption);
  const deleteQualityOption = useMutation(api.admin.deleteQualityOption);
  const produceOptions = useQuery(api.admin.getProduceOptions, { adminId: userId, activeOnly: false });
  const addProduceOption = useMutation(api.admin.addProduceOption);
  const updateProduceOption = useMutation(api.admin.updateProduceOption);
  const deleteProduceOption = useMutation(api.admin.deleteProduceOption);
  const storageLocations = useQuery(api.admin.getStorageLocations, { adminId: userId });
  const addStorageLocation = useMutation(api.admin.addStorageLocation);
  const updateStorageLocation = useMutation(api.admin.updateStorageLocation);
  const deleteStorageLocation = useMutation(api.admin.deleteStorageLocation);
  const todayMetrics = useQuery(api.admin.getTodaySystemMetrics, { adminId: userId });
  const createUser = useMutation(api.auth.createUser);
  const currentUser = allUsers?.find((u: any) => u.userId === userId);
  const isSuperAdmin = currentUser?.role === "admin" && (currentUser?.adminLevel === "super" || currentUser?.adminLevel === undefined);
  
  const [reason, setReason] = useState("");
  const [windowActionLoading, setWindowActionLoading] = useState(false);
  const [windowActionMessage, setWindowActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pilotModeReason, setPilotModeReason] = useState("");
  const [pilotModeLoading, setPilotModeLoading] = useState(false);
  const [pilotModeMessage, setPilotModeMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null); // Track which metric card is expanded

  const handleExportUTIDs = (format: "excel" | "pdf") => {
    if (!allUTIDs || !allUTIDs.utids || allUTIDs.utids.length === 0) {
      alert("No UTID data available to export");
      return;
    }

    const formattedData = formatUTIDDataForExport(allUTIDs.utids);
    const ugandaDate = new Date(getUgandaTime() - 3 * 60 * 60 * 1000); // Convert back to UTC for ISO string
    const filename = `admin_all_utid_report_${ugandaDate.toISOString().split("T")[0]}`;

    if (format === "excel") {
      exportToExcel(formattedData, filename, "Admin");
    } else {
      exportToPDF(formattedData, filename, "Admin");
    }
  };

  return (
    <div style={{ 
      width: "100%", 
      maxWidth: "100%", 
      boxSizing: "border-box",
      overflowX: "hidden",
      padding: "clamp(0.5rem, 2vw, 1rem)"
    }}>
      <div style={{ marginBottom: "1.5rem", width: "100%", boxSizing: "border-box" }}>
        <h2 style={{ 
          fontSize: "clamp(1.4rem, 4vw, 1.8rem)", 
          marginBottom: "0.5rem", 
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "700",
          letterSpacing: "-0.02em",
          wordWrap: "break-word"
        }}>
          Admin Console 🛡️
        </h2>
        <p style={{ 
          color: "#3d3d3d", 
          fontSize: "0.9rem",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "500"
        }}>
          System Status: {pilotMode === undefined ? "Connecting..." : pilotMode.pilotMode ? "MAINTENANCE" : "LIVE"}
        </p>
      </div>

      {/* Red Flags Summary */}
      <div style={{
        marginBottom: "2rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "auto"
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: "1rem", 
          fontSize: "clamp(1.1rem, 3vw, 1.3rem)",
          wordWrap: "break-word", 
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "600",
          letterSpacing: "-0.01em"
        }}>
          Red Flags (High-Risk Signals)
        </h3>
        {redFlags === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : (
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", 
            gap: "1rem",
            width: "100%",
            boxSizing: "border-box"
          }}>
            <div style={{ padding: "1rem", background: "#ffebee", borderRadius: "8px", border: "1px solid #ef5350" }}>
              <div style={{ fontSize: "2rem", fontWeight: "600", color: "#c62828" }}>
                {redFlags?.deliveriesPastSLA || 0}
              </div>
              <div style={{ color: "#666", fontSize: "0.9rem" }}>Deliveries Past SLA</div>
            </div>
            <div style={{ padding: "1rem", background: "#fff3cd", borderRadius: "8px", border: "1px solid #ffc107" }}>
              <div style={{ fontSize: "2rem", fontWeight: "600", color: "#856404" }}>
                {redFlags?.tradersNearSpendCap || 0}
              </div>
              <div style={{ color: "#666", fontSize: "0.9rem" }}>Traders Near Cap</div>
            </div>
            <div style={{ padding: "1rem", background: "#e3f2fd", borderRadius: "8px", border: "1px solid #2196f3" }}>
              <div style={{ fontSize: "2rem", fontWeight: "600", color: "#1565c0" }}>
                {redFlags?.highStorageLossInventory || 0}
              </div>
              <div style={{ color: "#666", fontSize: "0.9rem" }}>High Storage Loss</div>
            </div>
            <div style={{ padding: "1rem", background: "#f3e5f5", borderRadius: "8px", border: "1px solid #9c27b0" }}>
              <div style={{ fontSize: "2rem", fontWeight: "600", color: "#6a1b9a" }}>
                {redFlags?.buyersApproachingPickupSLA || 0}
              </div>
              <div style={{ color: "#666", fontSize: "0.9rem" }}>Buyers Near Pickup SLA</div>
            </div>
          </div>
        )}
      </div>

      {/* System Metrics - Today's Listings */}
      <div style={{
        marginBottom: "2rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "auto"
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: "1rem", 
          fontSize: "clamp(1.1rem, 3vw, 1.3rem)", 
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "600",
          letterSpacing: "-0.01em",
          wordWrap: "break-word"
        }}>
          System Metrics - Today&apos;s Activity
        </h3>
        {todayMetrics === undefined ? (
          <p style={{ color: "#999" }}>Loading metrics...</p>
        ) : !todayMetrics ? (
          <p style={{ color: "#666" }}>No metrics available</p>
        ) : (
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(min(250px, 100%), 1fr))", 
            gap: "1rem",
            width: "100%",
            boxSizing: "border-box"
          }}>
            {/* Open Listings */}
            <div 
              style={{ 
                padding: "1.5rem", 
                background: "#e3f2fd", 
                borderRadius: "8px", 
                border: "1px solid #2196f3",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: expandedMetric === "open" ? "0 4px 12px rgba(33, 150, 243, 0.3)" : "none"
              }}
              onClick={() => setExpandedMetric(expandedMetric === "open" ? null : "open")}
            >
              <div style={{ fontSize: "1.1rem", fontWeight: "600", color: "#1976d2", marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Open Listings</span>
                <span style={{ fontSize: "0.8rem" }}>{expandedMetric === "open" ? "▼" : "▶"}</span>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: "700", color: "#1565c0", marginBottom: "0.25rem" }}>
                {todayMetrics?.open?.count || 0}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
                {todayMetrics?.open?.uniqueUTIDs || 0} unique UTID(s)
              </div>
              <div style={{ fontSize: "0.9rem", color: "#424242", marginBottom: "0.25rem" }}>
                <strong>{(todayMetrics?.open?.totalKilos || 0).toFixed(2)} kg</strong>
              </div>
              <div style={{ fontSize: "0.9rem", color: "#424242" }}>
                <strong>UGX {(todayMetrics?.open?.totalMoney || 0).toLocaleString()}</strong>
              </div>
              {expandedMetric === "open" && todayMetrics?.open?.listings && todayMetrics.open.listings.length > 0 && (
                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #90caf9" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#1976d2", marginBottom: "0.5rem" }}>UTID Details:</div>
                  {todayMetrics.open.listings.map((item: any, idx: number) => (
                    <div key={idx} style={{ fontSize: "0.75rem", color: "#424242", marginBottom: "0.5rem", padding: "0.5rem", background: "#fff", borderRadius: "4px" }}>
                      <div><strong>UTID:</strong> {item.utid}</div>
                      <div><strong>Kilos:</strong> {item.kilos.toFixed(2)} kg</div>
                      <div><strong>Value:</strong> UGX {item.money.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Locked Listings */}
            <div 
              style={{ 
                padding: "1.5rem", 
                background: "#fff3cd", 
                borderRadius: "8px", 
                border: "1px solid #ffc107",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: expandedMetric === "locked" ? "0 4px 12px rgba(255, 193, 7, 0.3)" : "none"
              }}
              onClick={() => setExpandedMetric(expandedMetric === "locked" ? null : "locked")}
            >
              <div style={{ fontSize: "1.1rem", fontWeight: "600", color: "#f57c00", marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Locked Listings</span>
                <span style={{ fontSize: "0.8rem" }}>{expandedMetric === "locked" ? "▼" : "▶"}</span>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: "700", color: "#e65100", marginBottom: "0.25rem" }}>
                {todayMetrics?.locked?.count || 0}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
                {todayMetrics?.locked?.uniqueUTIDs || 0} unique UTID(s)
              </div>
              <div style={{ fontSize: "0.9rem", color: "#424242", marginBottom: "0.25rem" }}>
                <strong>{(todayMetrics?.locked?.totalKilos || 0).toFixed(2)} kg</strong>
              </div>
              <div style={{ fontSize: "0.9rem", color: "#424242" }}>
                <strong>UGX {(todayMetrics?.locked?.totalMoney || 0).toLocaleString()}</strong>
              </div>
              {expandedMetric === "locked" && todayMetrics?.locked?.listings && todayMetrics.locked.listings.length > 0 && (
                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #ffd54f" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#f57c00", marginBottom: "0.5rem" }}>UTID Details:</div>
                  {todayMetrics.locked.listings.map((item: any, idx: number) => (
                    <div key={idx} style={{ fontSize: "0.75rem", color: "#424242", marginBottom: "0.5rem", padding: "0.5rem", background: "#fff", borderRadius: "4px" }}>
                      <div><strong>UTID:</strong> {item.utid}</div>
                      <div><strong>Kilos:</strong> {item.kilos.toFixed(2)} kg</div>
                      <div><strong>Value:</strong> UGX {item.money.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Delivered Listings */}
            <div 
              style={{ 
                padding: "1.5rem", 
                background: "#e8f5e9", 
                borderRadius: "8px", 
                border: "1px solid #4caf50",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: expandedMetric === "delivered" ? "0 4px 12px rgba(76, 175, 80, 0.3)" : "none"
              }}
              onClick={() => setExpandedMetric(expandedMetric === "delivered" ? null : "delivered")}
            >
              <div style={{ fontSize: "1.1rem", fontWeight: "600", color: "#2e7d32", marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Delivered Listings</span>
                <span style={{ fontSize: "0.8rem" }}>{expandedMetric === "delivered" ? "▼" : "▶"}</span>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: "700", color: "#1b5e20", marginBottom: "0.25rem" }}>
                {todayMetrics?.delivered?.count || 0}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
                {todayMetrics?.delivered?.uniqueUTIDs || 0} unique UTID(s)
              </div>
              <div style={{ fontSize: "0.9rem", color: "#424242", marginBottom: "0.25rem" }}>
                <strong>{(todayMetrics?.delivered?.totalKilos || 0).toFixed(2)} kg</strong>
              </div>
              <div style={{ fontSize: "0.9rem", color: "#424242" }}>
                <strong>UGX {(todayMetrics?.delivered?.totalMoney || 0).toLocaleString()}</strong>
              </div>
              {expandedMetric === "delivered" && todayMetrics?.delivered?.listings && todayMetrics.delivered.listings.length > 0 && (
                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #81c784" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#2e7d32", marginBottom: "0.5rem" }}>UTID Details:</div>
                  {todayMetrics.delivered.listings.map((item: any, idx: number) => (
                    <div key={idx} style={{ fontSize: "0.75rem", color: "#424242", marginBottom: "0.5rem", padding: "0.5rem", background: "#fff", borderRadius: "4px" }}>
                      <div><strong>UTID:</strong> {item.utid}</div>
                      <div><strong>Kilos:</strong> {item.kilos.toFixed(2)} kg</div>
                      <div><strong>Value:</strong> UGX {item.money.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Collectable Listings */}
            <div 
              style={{ 
                padding: "1.5rem", 
                background: "#f3e5f5", 
                borderRadius: "8px", 
                border: "1px solid #9c27b0",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: expandedMetric === "collectable" ? "0 4px 12px rgba(156, 39, 176, 0.3)" : "none"
              }}
              onClick={() => setExpandedMetric(expandedMetric === "collectable" ? null : "collectable")}
            >
              <div style={{ fontSize: "1.1rem", fontWeight: "600", color: "#7b1fa2", marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Collectable Listings</span>
                <span style={{ fontSize: "0.8rem" }}>{expandedMetric === "collectable" ? "▼" : "▶"}</span>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: "700", color: "#4a148c", marginBottom: "0.25rem" }}>
                {todayMetrics?.collectable?.count || 0}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
                {todayMetrics?.collectable?.uniqueUTIDs || 0} unique UTID(s)
              </div>
              <div style={{ fontSize: "0.9rem", color: "#424242", marginBottom: "0.25rem" }}>
                <strong>{(todayMetrics?.collectable?.totalKilos || 0).toFixed(2)} kg</strong>
              </div>
              <div style={{ fontSize: "0.9rem", color: "#424242" }}>
                <strong>UGX {(todayMetrics?.collectable?.totalMoney || 0).toLocaleString()}</strong>
              </div>
              {expandedMetric === "collectable" && todayMetrics?.collectable?.listings && todayMetrics.collectable.listings.length > 0 && (
                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #ba68c8" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#7b1fa2", marginBottom: "0.5rem" }}>UTID Details:</div>
                  {todayMetrics.collectable.listings.map((item: any, idx: number) => (
                    <div key={idx} style={{ fontSize: "0.75rem", color: "#424242", marginBottom: "0.5rem", padding: "0.5rem", background: "#fff", borderRadius: "4px" }}>
                      <div><strong>UTID:</strong> {item.utid}</div>
                      <div><strong>Kilos:</strong> {item.kilos.toFixed(2)} kg</div>
                      <div><strong>Value:</strong> UGX {item.money.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Picked Up Listings */}
            <div 
              style={{ 
                padding: "1.5rem", 
                background: "#e0f2f1", 
                borderRadius: "8px", 
                border: "1px solid #009688",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: expandedMetric === "pickedUp" ? "0 4px 12px rgba(0, 150, 136, 0.3)" : "none"
              }}
              onClick={() => setExpandedMetric(expandedMetric === "pickedUp" ? null : "pickedUp")}
            >
              <div style={{ fontSize: "1.1rem", fontWeight: "600", color: "#00695c", marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Picked Up Listings</span>
                <span style={{ fontSize: "0.8rem" }}>{expandedMetric === "pickedUp" ? "▼" : "▶"}</span>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: "700", color: "#004d40", marginBottom: "0.25rem" }}>
                {todayMetrics?.pickedUp?.count || 0}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
                {todayMetrics?.pickedUp?.uniqueUTIDs || 0} unique UTID(s)
              </div>
              <div style={{ fontSize: "0.9rem", color: "#424242", marginBottom: "0.25rem" }}>
                <strong>{(todayMetrics?.pickedUp?.totalKilos || 0).toFixed(2)} kg</strong>
              </div>
              <div style={{ fontSize: "0.9rem", color: "#424242" }}>
                <strong>UGX {(todayMetrics?.pickedUp?.totalMoney || 0).toLocaleString()}</strong>
              </div>
              {expandedMetric === "pickedUp" && todayMetrics?.pickedUp?.listings && todayMetrics.pickedUp.listings.length > 0 && (
                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #4db6ac" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#00695c", marginBottom: "0.5rem" }}>UTID Details:</div>
                  {todayMetrics.pickedUp.listings.map((item: any, idx: number) => (
                    <div key={idx} style={{ fontSize: "0.75rem", color: "#424242", marginBottom: "0.5rem", padding: "0.5rem", background: "#fff", borderRadius: "4px" }}>
                      <div><strong>UTID:</strong> {item.utid}</div>
                      <div><strong>Kilos:</strong> {item.kilos.toFixed(2)} kg</div>
                      <div><strong>Value:</strong> UGX {item.money.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {todayMetrics && todayMetrics.date && (
          <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#f5f5f5", borderRadius: "6px", fontSize: "0.85rem", color: "#666" }}>
            📅 Date: {todayMetrics.date.today} ({todayMetrics.date.timezone}) | Current Time: {new Date(todayMetrics.date.currentTime).toLocaleString("en-US", { timeZone: "Africa/Kampala", dateStyle: "short", timeStyle: "medium" })}
          </div>
        )}
      </div>

      {/* System UTIDs */}
      <div style={{
        marginBottom: "2rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "auto"
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: "1rem", 
          fontSize: "clamp(1.1rem, 3vw, 1.3rem)",
          wordWrap: "break-word", 
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "600",
          letterSpacing: "-0.01em"
        }}>
          System UTIDs
        </h3>
        {allUTIDs === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : !allUTIDs || !allUTIDs.utids ? (
          <p style={{ color: "#666" }}>No UTIDs available</p>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <p style={{ color: "#666", margin: 0 }}>
                Total active UTIDs: <strong>{allUTIDs.totalUTIDs || 0}</strong>
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => handleExportUTIDs("excel")}
                  style={{
                    padding: "clamp(0.5rem, 2vw, 0.75rem) clamp(0.75rem, 3vw, 1rem)",
                    background: "#000000",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "clamp(0.8rem, 2.5vw, 0.9rem)",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                  }}
                  title="Export to Excel"
                >
                  📊 Excel
                </button>
                <button
                  onClick={() => handleExportUTIDs("pdf")}
                  style={{
                    padding: "clamp(0.5rem, 2vw, 0.75rem) clamp(0.75rem, 3vw, 1rem)",
                    background: "#ffc107",
                    color: "#000",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "clamp(0.8rem, 2.5vw, 0.9rem)",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                  }}
                  title="Export to PDF"
                >
                  📄 PDF
                </button>
              </div>
            </div>
            <div style={{ marginTop: "1rem", maxHeight: "400px", overflowY: "auto", overflowX: "hidden" }}>
              {allUTIDs.utids.slice(0, 20).map((utidData: any, index: number) => (
                <div key={index} style={{
                  padding: "0.75rem",
                  marginBottom: "0.5rem",
                  background: "#f5f5f5",
                  borderRadius: "6px",
                  fontSize: "0.85rem"
                }}>
                  <div style={{ fontFamily: "monospace", fontWeight: "600", marginBottom: "0.25rem" }}>
                    {utidData.utid}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#666" }}>
                    Type: {utidData.type} | Status: {utidData.status || "active"}
                  </div>
                </div>
              ))}
              {allUTIDs.utids.length > 20 && (
                <p style={{ color: "#999", fontSize: "0.85rem", marginTop: "0.5rem" }}>
                  ... and {allUTIDs.utids.length - 20} more
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Purchase Window Control - Super Admin Only */}
      {isSuperAdmin && (
      <div style={{
        marginBottom: "2rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "auto"
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: "1rem", 
          fontSize: "clamp(1.1rem, 3vw, 1.3rem)", 
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "600",
          letterSpacing: "-0.01em",
          wordWrap: "break-word"
        }}>
          Purchase Window Control
        </h3>
        {purchaseWindowStatus === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : (
          <div>
            <div style={{
              padding: "1rem",
              background: purchaseWindowStatus.isOpen ? "#e8f5e9" : "#ffebee",
              borderRadius: "6px",
              border: `1px solid ${purchaseWindowStatus.isOpen ? "#4caf50" : "#ef5350"}`,
              marginBottom: "1rem"
            }}>
              <div style={{
                fontSize: "1.1rem",
                fontWeight: "600",
                color: purchaseWindowStatus.isOpen ? "#2e7d32" : "#c62828",
                marginBottom: "0.5rem"
              }}>
                Status: {purchaseWindowStatus.isOpen ? "✅ OPEN" : "❌ CLOSED"}
              </div>
              {purchaseWindowStatus.isOpen && purchaseWindowStatus.openedAt && (
                <p style={{ color: "#666", fontSize: "0.9rem", margin: 0 }}>
                  Opened at: {formatUgandaDateTime(purchaseWindowStatus.openedAt)}
                </p>
              )}
            </div>
            
            <div style={{ marginTop: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
                Reason (required):
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for opening/closing purchase window..."
                style={{
                  width: "100%",
                  minHeight: "80px",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "0.9rem",
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
              
              {windowActionMessage && (
                <div style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem",
                  background: windowActionMessage.type === "success" ? "#e8f5e9" : "#ffebee",
                  border: `1px solid ${windowActionMessage.type === "success" ? "#4caf50" : "#ef5350"}`,
                  borderRadius: "6px",
                  color: windowActionMessage.type === "success" ? "#2e7d32" : "#c62828",
                  fontSize: "0.9rem"
                }}>
                  {windowActionMessage.text}
                </div>
              )}
              
              <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                {!purchaseWindowStatus.isOpen ? (
                  <button
                    onClick={async () => {
                      if (!reason.trim()) {
                        setWindowActionMessage({ type: "error", text: "Please provide a reason" });
                        return;
                      }
                      setWindowActionLoading(true);
                      setWindowActionMessage(null);
                      try {
                        const result = await openPurchaseWindow({
                          adminId: userId,
                          reason: reason.trim(),
                        });
                        setWindowActionMessage({
                          type: "success",
                          text: `Purchase window opened successfully! UTID: ${result.utid}`
                        });
                        setReason("");
                      } catch (error: any) {
                        setWindowActionMessage({
                          type: "error",
                          text: `Failed to open purchase window: ${error.message}`
                        });
                      } finally {
                        setWindowActionLoading(false);
                      }
                    }}
                    disabled={windowActionLoading}
                    style={{
                      padding: "clamp(0.6rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)",
                      background: windowActionLoading ? "#ccc" : "#4caf50",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "0.9rem",
                      fontWeight: "600",
                      cursor: windowActionLoading ? "not-allowed" : "pointer"
                    }}
                  >
                    {windowActionLoading ? "Opening..." : "Open Purchase Window"}
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      if (!reason.trim()) {
                        setWindowActionMessage({ type: "error", text: "Please provide a reason" });
                        return;
                      }
                      setWindowActionLoading(true);
                      setWindowActionMessage(null);
                      try {
                        const result = await closePurchaseWindow({
                          adminId: userId,
                          reason: reason.trim(),
                        });
                        setWindowActionMessage({
                          type: "success",
                          text: `Purchase window closed successfully! UTID: ${result.utid}`
                        });
                        setReason("");
                      } catch (error: any) {
                        setWindowActionMessage({
                          type: "error",
                          text: `Failed to close purchase window: ${error.message}`
                        });
                      } finally {
                        setWindowActionLoading(false);
                      }
                    }}
                    disabled={windowActionLoading}
                    style={{
                      padding: "clamp(0.6rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)",
                      background: windowActionLoading ? "#ccc" : "#ef5350",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "0.9rem",
                      fontWeight: "600",
                      cursor: windowActionLoading ? "not-allowed" : "pointer"
                    }}
                  >
                    {windowActionLoading ? "Closing..." : "Close Purchase Window"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* System Metrics */}
      <div style={{
        marginBottom: "2rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "auto"
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: "1rem", 
          fontSize: "clamp(1.1rem, 3vw, 1.3rem)",
          wordWrap: "break-word", 
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "600",
          letterSpacing: "-0.01em"
        }}>
          System Metrics
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <div style={{ padding: "1rem", background: "#f5f5f5", borderRadius: "8px" }}>
            <div style={{ fontSize: "2rem", fontWeight: "600", color: "#1976d2" }}>
              {allUTIDs?.totalUTIDs || 0}
            </div>
            <div style={{ color: "#666", fontSize: "0.9rem" }}>Active Transactions</div>
          </div>
          <div style={{ padding: "1rem", background: "#f5f5f5", borderRadius: "8px" }}>
            <div style={{ fontSize: "2rem", fontWeight: "600", color: "#2e7d32" }}>
              {allUTIDs?.utids.filter((u: any) => u.type === "unit_lock").length || 0}
            </div>
            <div style={{ color: "#666", fontSize: "0.9rem" }}>Locked Units</div>
          </div>
          <div style={{ padding: "1rem", background: "#f5f5f5", borderRadius: "8px" }}>
            <div style={{ fontSize: "2rem", fontWeight: "600", color: "#1a1a1a" }}>
              {allUTIDs?.utids.filter((u: any) => u.type === "listing").length || 0}
            </div>
            <div style={{ color: "#666", fontSize: "0.9rem" }}>Active Listings</div>
          </div>
        </div>
      </div>

      {/* Live Timeline */}
      <div style={{
        marginBottom: "2rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "auto"
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: "1rem", 
          fontSize: "clamp(1.1rem, 3vw, 1.3rem)",
          wordWrap: "break-word", 
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "600",
          letterSpacing: "-0.01em"
        }}>
          Live Timeline
        </h3>
        {allUTIDs === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : !allUTIDs || !allUTIDs.utids || allUTIDs.utids.length === 0 ? (
          <p style={{ color: "#666" }}>No recent activity</p>
        ) : (
          <div style={{ maxHeight: "300px", overflowY: "auto" }}>
            {allUTIDs.utids.slice(0, 10).map((utidData: any, index: number) => {
              const { formatUgandaTimeOnly, getUgandaTime } = require("../utils/timeUtils");
              const timestamp = utidData.timestamp || getUgandaTime();
              const time = formatUgandaTimeOnly(timestamp);
              let activity = "";
              if (utidData.type === "unit_lock") activity = `${utidData.quantity || "10"}kg ${utidData.produceType || "Produce"} Locked`;
              else if (utidData.type === "buyer_purchase") activity = "Buyer Purchase Completed";
              else if (utidData.type === "listing") activity = "Farmer Listing Created";
              else activity = `${utidData.type} - ${utidData.status || "active"}`;

              return (
                <div key={index} style={{
                  padding: "0.75rem",
                  marginBottom: "0.5rem",
                  background: "#f9f9f9",
                  borderRadius: "6px",
                  fontSize: "0.9rem",
                  borderLeft: "3px solid #1976d2"
                }}>
                  <span style={{ color: "#666", fontFamily: "monospace" }}>{time}</span> — {activity}
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "2px solid #e0e0e0" }}>
          <h4 style={{ marginBottom: "1rem", fontSize: "1.1rem", color: "#1a1a1a" }}>
            Confirm Delivery to Storage by UTID
          </h4>
          {allUTIDs === undefined ? (
            <p style={{ color: "#999" }}>Loading UTIDs...</p>
          ) : (
          <DeliveryConfirmationForm
            allUTIDs={allUTIDs}
            confirmDelivery={confirmDeliveryToStorageByUTID}
            adminId={userId}
            isSuperAdmin={isSuperAdmin}
          />
          )}
        </div>
      </div>

      {/* System Controls - Maintenance Mode */}
      <div style={{
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "auto"
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: "1rem", 
          fontSize: "clamp(1.1rem, 3vw, 1.3rem)",
          wordWrap: "break-word", 
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "600",
          letterSpacing: "-0.01em"
        }}>
          System Controls
        </h3>
        {pilotMode === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : (
          <div>
            <div style={{
              padding: "1rem",
              background: pilotMode.pilotMode ? "#ffebee" : "#e8f5e9",
              borderRadius: "6px",
              border: `1px solid ${pilotMode.pilotMode ? "#ef5350" : "#4caf50"}`,
              marginBottom: "1rem"
            }}>
              <div style={{
                fontSize: "1.1rem",
                fontWeight: "600",
                color: pilotMode.pilotMode ? "#c62828" : "#2e7d32",
                marginBottom: "0.5rem"
              }}>
                Status: {pilotMode.pilotMode ? "🔒 ACTIVE (All transactions blocked)" : "✅ INACTIVE (Transactions allowed)"}
              </div>
              {pilotMode.pilotMode && pilotMode.reason && (
                <p style={{ color: "#666", fontSize: "0.9rem", margin: "0.5rem 0 0 0" }}>
                  Reason: {pilotMode.reason}
                </p>
              )}
              {pilotMode.setAt && (
                <p style={{ color: "#666", fontSize: "0.85rem", margin: "0.25rem 0 0 0" }}>
                  Last changed: {formatUgandaDateTime(pilotMode.setAt)}
                </p>
              )}
            </div>
            
            <div style={{ marginTop: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
                Reason (required):
              </label>
              <textarea
                value={pilotModeReason}
                onChange={(e) => setPilotModeReason(e.target.value)}
                placeholder="Enter reason for enabling/disabling pilot mode..."
                style={{
                  width: "100%",
                  minHeight: "80px",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "0.9rem",
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
              
              {pilotModeMessage && (
                <div style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem",
                  background: pilotModeMessage.type === "success" ? "#e8f5e9" : "#ffebee",
                  border: `1px solid ${pilotModeMessage.type === "success" ? "#4caf50" : "#ef5350"}`,
                  borderRadius: "6px",
                  color: pilotModeMessage.type === "success" ? "#2e7d32" : "#c62828",
                  fontSize: "0.9rem"
                }}>
                  {pilotModeMessage.text}
                </div>
              )}
              
              <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem" }}>
                {pilotMode.pilotMode ? (
                  <button
                    onClick={async () => {
                      if (!pilotModeReason.trim()) {
                        setPilotModeMessage({ type: "error", text: "Please provide a reason" });
                        return;
                      }
                      setPilotModeLoading(true);
                      setPilotModeMessage(null);
                      try {
                        const result = await setPilotMode({
                          adminId: userId,
                          pilotMode: false,
                          reason: pilotModeReason.trim(),
                        });
                        setPilotModeMessage({
                          type: "success",
                          text: `Pilot mode disabled successfully! UTID: ${result.utid}. Transactions are now allowed.`
                        });
                        setPilotModeReason("");
                      } catch (error: any) {
                        setPilotModeMessage({
                          type: "error",
                          text: `Failed to disable pilot mode: ${error.message}`
                        });
                      } finally {
                        setPilotModeLoading(false);
                      }
                    }}
                    disabled={pilotModeLoading}
                    style={{
                      padding: "clamp(0.6rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)",
                      background: pilotModeLoading ? "#ccc" : "#4caf50",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "0.9rem",
                      fontWeight: "600",
                      cursor: pilotModeLoading ? "not-allowed" : "pointer"
                    }}
                  >
                    {pilotModeLoading ? "Disabling..." : "Disable Pilot Mode (Allow Transactions)"}
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      if (!pilotModeReason.trim()) {
                        setPilotModeMessage({ type: "error", text: "Please provide a reason" });
                        return;
                      }
                      setPilotModeLoading(true);
                      setPilotModeMessage(null);
                      try {
                        const result = await setPilotMode({
                          adminId: userId,
                          pilotMode: true,
                          reason: pilotModeReason.trim(),
                        });
                        setPilotModeMessage({
                          type: "success",
                          text: `Pilot mode enabled successfully! UTID: ${result.utid}. All transactions are now blocked.`
                        });
                        setPilotModeReason("");
                      } catch (error: any) {
                        setPilotModeMessage({
                          type: "error",
                          text: `Failed to enable pilot mode: ${error.message}`
                        });
                      } finally {
                        setPilotModeLoading(false);
                      }
                    }}
                    disabled={pilotModeLoading}
                    style={{
                      padding: "clamp(0.6rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)",
                      background: pilotModeLoading ? "#ccc" : "#ef5350",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "0.9rem",
                      fontWeight: "600",
                      cursor: pilotModeLoading ? "not-allowed" : "pointer"
                    }}
                  >
                    {pilotModeLoading ? "Enabling..." : "Enable Pilot Mode (Block All Transactions)"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Kilo-Shaving Rate Management */}
      <div style={{
        marginBottom: "2rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "auto"
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: "1rem", 
          fontSize: "clamp(1.1rem, 3vw, 1.3rem)",
          wordWrap: "break-word", 
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "600",
          letterSpacing: "-0.01em"
        }}>
          Kilo-Shaving Rate Management
        </h3>
        {getKiloShavingRate === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : (
          <div>
            <div style={{ marginBottom: "1rem", padding: "1rem", background: "#f5f5f5", borderRadius: "6px" }}>
              <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.5rem" }}>Current Rate</div>
              <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#1976d2" }}>
                {getKiloShavingRate.rateKgPerDay} kg per day per 100kg block
              </div>
            </div>
            <KiloShavingRateForm 
              currentRate={getKiloShavingRate.rateKgPerDay}
              updateKiloShavingRate={updateKiloShavingRate}
              adminId={userId}
            />
          </div>
        )}
      </div>

      {/* Buyer Service Fee Management */}
      <div style={{
        marginBottom: "2rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "auto"
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: "1rem", 
          fontSize: "clamp(1.1rem, 3vw, 1.3rem)",
          wordWrap: "break-word", 
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "600",
          letterSpacing: "-0.01em"
        }}>
          Buyer Service Fee Management
        </h3>
        {getBuyerServiceFeePercentage === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : (
          <div>
            <div style={{ marginBottom: "1rem", padding: "1rem", background: "#f5f5f5", borderRadius: "6px" }}>
              <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.5rem" }}>Current Service Fee</div>
              <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#1976d2" }}>
                {getBuyerServiceFeePercentage.serviceFeePercentage}%
              </div>
              <div style={{ fontSize: "0.85rem", color: "#999", marginTop: "0.25rem" }}>
                This fee is added to the purchase price for all buyer purchases
              </div>
            </div>
            <BuyerServiceFeeForm 
              currentFee={getBuyerServiceFeePercentage.serviceFeePercentage}
              updateBuyerServiceFeePercentage={updateBuyerServiceFeePercentage}
              adminId={userId}
            />
          </div>
        )}
      </div>

      {/* Trader Spend Cap Management */}
      <div style={{
        marginBottom: "2rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "auto"
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: "1rem", 
          fontSize: "clamp(1.1rem, 3vw, 1.3rem)",
          wordWrap: "break-word", 
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "600",
          letterSpacing: "-0.01em"
        }}>
          Trader Spend Cap Management
        </h3>
        {allUsers === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : (
          <>
            <TraderSpendCapForm
              traders={allUsers.filter((u: any) => u.role === "trader")}
              updateTraderSpendCap={updateTraderSpendCap}
              updateAllTradersSpendCap={updateAllTradersSpendCap}
              adminId={userId}
            />
          </>
        )}
      </div>

      {/* Produce Options Management */}
      <div style={{
        marginBottom: "2rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "auto"
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: "1rem", 
          fontSize: "clamp(1.1rem, 3vw, 1.3rem)",
          wordWrap: "break-word", 
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "600",
          letterSpacing: "-0.01em"
        }}>
          Produce Options Management
        </h3>
        <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1rem" }}>
          Manage produce icons/types that farmers can select when creating listings. Only active options will be displayed to farmers.
        </p>
        {produceOptions === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : (
          <ProduceOptionsManager
            produceOptions={produceOptions}
            addProduceOption={addProduceOption}
            updateProduceOption={updateProduceOption}
            deleteProduceOption={deleteProduceOption}
            adminId={userId}
          />
        )}
      </div>

      {/* Quality Options Management */}
      <div style={{
        marginBottom: "2rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "auto"
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: "1rem", 
          fontSize: "clamp(1.1rem, 3vw, 1.3rem)",
          wordWrap: "break-word", 
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "600",
          letterSpacing: "-0.01em"
        }}>
          Produce Quality Options Management
        </h3>
        <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1rem" }}>
          Manage quality rating options that farmers can select when creating listings.
        </p>
        {qualityOptions === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : (
          <QualityOptionsManager
            qualityOptions={qualityOptions}
            addQualityOption={addQualityOption}
            updateQualityOption={updateQualityOption}
            deleteQualityOption={deleteQualityOption}
            adminId={userId}
          />
        )}
      </div>

      {/* Storage Locations Management */}
      <div style={{
        marginBottom: "2rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "auto"
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: "1rem", 
          fontSize: "clamp(1.1rem, 3vw, 1.3rem)",
          wordWrap: "break-word", 
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "600",
          letterSpacing: "-0.01em"
        }}>
          Storage Locations Management
        </h3>
        {storageLocations === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : (
          <StorageLocationsManager
            storageLocations={storageLocations}
            addStorageLocation={addStorageLocation}
            updateStorageLocation={updateStorageLocation}
            deleteStorageLocation={deleteStorageLocation}
            adminId={userId}
          />
        )}
      </div>

      {/* Send Notifications */}
      <div style={{
        marginBottom: "2rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "auto"
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: "1rem", 
          fontSize: "clamp(1.1rem, 3vw, 1.3rem)",
          wordWrap: "break-word", 
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "600",
          letterSpacing: "-0.01em"
        }}>
          Send Notifications
        </h3>
        {allUsers === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : (
          <NotificationForm
            allUsers={allUsers}
            sendNotification={sendNotificationToSelectedUsers}
            sendRoleBasedNotification={sendRoleBasedNotification}
            adminId={userId}
          />
        )}
      </div>

      {/* Demo Funds Deposit */}
      <div style={{
        marginBottom: "2rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "auto"
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: "1rem", 
          fontSize: "clamp(1.1rem, 3vw, 1.3rem)",
          wordWrap: "break-word", 
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "600",
          letterSpacing: "-0.01em"
        }}>
          Deposit Demo Funds
        </h3>
        <p style={{ marginBottom: "1rem", color: "#666" }}>
          Deposit training funds into trader or buyer accounts for demo/learning purposes
        </p>
        {allUsers === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : (
          <DemoFundsForm
            allUsers={allUsers}
            adminDepositDemoFunds={adminDepositDemoFunds}
            adminId={userId}
          />
        )}
      </div>

      {/* Admin Account Creation (Super Admin Only) */}
      {isSuperAdmin && (
        <div style={{
          marginBottom: "2rem",
          padding: "1.5rem",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          border: "1px solid #e0e0e0"
        }}>
          <h3 style={{ 
            marginTop: 0, 
            marginBottom: "1rem", 
            fontSize: "clamp(1.1rem, 3vw, 1.3rem)",
          wordWrap: "break-word", 
            color: "#2c2c2c",
            fontFamily: '"Montserrat", sans-serif',
            fontWeight: "600",
            letterSpacing: "-0.01em"
          }}>
            Create Admin Account
          </h3>
          <CreateAdminAccountForm
            createUser={createUser}
            storageLocations={storageLocations}
            adminId={userId}
          />
        </div>
      )}

      {/* System Controls (Legacy) */}
      <div style={{
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "auto"
      }}>
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: "1rem", 
          fontSize: "clamp(1.1rem, 3vw, 1.3rem)",
          wordWrap: "break-word", 
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "600",
          letterSpacing: "-0.01em"
        }}>
          System Controls
        </h3>
        <p style={{ color: "#666", marginBottom: "1rem" }}>
          Additional system settings can be managed via Convex dashboard.
        </p>
        <div style={{ padding: "1rem", background: "#f5f5f5", borderRadius: "6px", marginBottom: "1rem" }}>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#666" }}>
            <strong>Available Admin Actions:</strong>
          </p>
          <ul style={{ margin: "0.5rem 0 0 0", paddingLeft: "1.5rem", color: "#666", fontSize: "0.85rem" }}>
            <li>Set pilot mode (pilotMode.setPilotMode)</li>
            <li>Verify deliveries (admin.verifyDelivery)</li>
            <li>Reverse failed deliveries (admin.reverseDeliveryFailure)</li>
          </ul>
        </div>
        <div style={{ padding: "1rem", background: "#e3f2fd", borderRadius: "6px", border: "1px solid #2196f3" }}>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#1565c0", fontWeight: "600", marginBottom: "0.5rem" }}>
            🚀 Demo Data Seeding
          </p>
          <p style={{ margin: "0.5rem 0", fontSize: "0.85rem", color: "#666" }}>
            Seed the system with demo data: farmer listings, trader wallets (1M UGX), and buyer wallets (2M UGX).
          </p>
          <a
            href="/admin/seed-demo"
            style={{
              display: "inline-block",
              marginTop: "0.5rem",
              padding: "0.5rem 1rem",
              background: "#1976d2",
              color: "#fff",
              textDecoration: "none",
              borderRadius: "6px",
              fontSize: "0.9rem",
              fontWeight: "600",
            }}
          >
            Seed Demo Data →
          </a>
        </div>
        <div style={{ padding: "1rem", background: "#ffebee", borderRadius: "6px", border: "1px solid #d32f2f", marginTop: "1rem" }}>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#c62828", fontWeight: "600", marginBottom: "0.5rem" }}>
            ⚠️ Reset All Transactions
          </p>
          <p style={{ margin: "0.5rem 0", fontSize: "0.85rem", color: "#666" }}>
            DANGEROUS: This will permanently delete all wallet transactions, unlock all units, delete all inventory, and reset all listings.
          </p>
          <a
            href="/admin/reset-transactions"
            style={{
              display: "inline-block",
              marginTop: "0.5rem",
              padding: "0.5rem 1rem",
              background: "#d32f2f",
              color: "#fff",
              textDecoration: "none",
              borderRadius: "6px",
              fontSize: "0.9rem",
              fontWeight: "600",
            }}
          >
            Reset All Transactions →
          </a>
        </div>
      </div>
    </div>
  );
}

// Create Admin Account Form Component
function CreateAdminAccountForm({ createUser, storageLocations, adminId }: { createUser: any; storageLocations: any; adminId: Id<"users"> }) {
  const [email, setEmail] = useState("");
  const [adminLevel, setAdminLevel] = useState<"super" | "junior" | "">("");
  const [selectedLocationIds, setSelectedLocationIds] = useState<Id<"storageLocations">[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setMessage({ type: "error", text: "Please enter an email address" });
      return;
    }
    if (!adminLevel) {
      setMessage({ type: "error", text: "Please select admin level" });
      return;
    }
    if (adminLevel === "junior" && selectedLocationIds.length === 0) {
      setMessage({ type: "error", text: "Junior admins must have at least one assigned storage location" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await createUser({
        email: email.trim(),
        role: "admin",
        adminLevel: adminLevel,
        allowedStorageLocationIds: adminLevel === "junior" ? selectedLocationIds : undefined,
        creatorAdminId: adminId,
      });

      setMessage({
        type: "success",
        text: `Admin account created successfully! User ID: ${result.userId}, Alias: ${result.alias}`,
      });

      // Reset form
      setEmail("");
      setAdminLevel("");
      setSelectedLocationIds([]);
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: `Failed to create admin account: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleLocation = (locationId: Id<"storageLocations">) => {
    setSelectedLocationIds((prev) =>
      prev.includes(locationId)
        ? prev.filter((id) => id !== locationId)
        : [...prev, locationId]
    );
  };

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
          Email Address:
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@example.com"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "0.9rem",
            fontFamily: "inherit"
          }}
        />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
          Admin Level:
        </label>
        <select
          value={adminLevel}
          onChange={(e) => {
            setAdminLevel(e.target.value as "super" | "junior" | "");
            if (e.target.value !== "junior") {
              setSelectedLocationIds([]);
            }
          }}
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "0.9rem",
            fontFamily: "inherit"
          }}
        >
          <option value="">Select admin level...</option>
          <option value="super">Super Admin (Full Access)</option>
          <option value="junior">Junior Admin (Limited to Assigned Locations)</option>
        </select>
      </div>

      {adminLevel === "junior" && storageLocations && (
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
            Assigned Storage Locations (Select at least one):
          </label>
          <div style={{
            maxHeight: "200px",
            overflowY: "auto",
            border: "1px solid #ddd",
            borderRadius: "6px",
            padding: "0.5rem"
          }}>
            {storageLocations.filter((loc: any) => loc.active).map((location: any) => (
              <label
                key={location._id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0.5rem",
                  cursor: "pointer",
                  borderRadius: "4px",
                  marginBottom: "0.25rem",
                  background: selectedLocationIds.includes(location._id) ? "#e3f2fd" : "transparent"
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedLocationIds.includes(location._id)}
                  onChange={() => toggleLocation(location._id)}
                  disabled={loading}
                  style={{ marginRight: "0.5rem" }}
                />
                <span style={{ fontSize: "0.9rem" }}>
                  {location.districtName} ({location.code})
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {message && (
        <div style={{
          marginBottom: "1rem",
          padding: "0.75rem",
          background: message.type === "success" ? "#e8f5e9" : "#ffebee",
          border: `1px solid ${message.type === "success" ? "#4caf50" : "#ef5350"}`,
          borderRadius: "6px",
          color: message.type === "success" ? "#2e7d32" : "#c62828",
          fontSize: "0.9rem"
        }}>
          {message.text}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          padding: "0.75rem 1.5rem",
          background: loading ? "#ccc" : "#1976d2",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          fontSize: "0.9rem",
          fontWeight: "600",
          cursor: loading ? "not-allowed" : "pointer"
        }}
      >
        {loading ? "Creating..." : "Create Admin Account"}
      </button>
    </div>
  );
}

// Buyer Service Fee Form Component
function BuyerServiceFeeForm({ currentFee, updateBuyerServiceFeePercentage, adminId }: { currentFee: number; updateBuyerServiceFeePercentage: any; adminId: Id<"users"> }) {
  const [fee, setFee] = useState<string>(currentFee.toString());
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async () => {
    const feeValue = parseFloat(fee);
    if (!fee || isNaN(feeValue) || feeValue < 0 || feeValue > 100) {
      setMessage({ type: "error", text: "Please enter a valid percentage (0-100)" });
      return;
    }
    if (!reason.trim()) {
      setMessage({ type: "error", text: "Please provide a reason" });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const result = await updateBuyerServiceFeePercentage({
        adminId,
        serviceFeePercentage: feeValue,
        reason: reason.trim(),
      });
      setMessage({
        type: "success",
        text: `Service fee percentage updated successfully! UTID: ${result.utid}. New fee: ${feeValue}%.`
      });
      setReason("");
    } catch (error: any) {
      setMessage({ type: "error", text: `Failed to update service fee: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
          New Service Fee Percentage (0-100):
        </label>
        <input
          type="number"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          min="0"
          max="100"
          step="0.1"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "0.9rem",
            fontFamily: "inherit"
          }}
        />
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
          Reason (required):
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason for changing service fee percentage..."
          style={{
            width: "100%",
            minHeight: "80px",
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "0.9rem",
            fontFamily: "inherit",
            resize: "vertical"
          }}
        />
      </div>
      {message && (
        <div style={{
          marginBottom: "1rem",
          padding: "0.75rem",
          background: message.type === "success" ? "#e8f5e9" : "#ffebee",
          border: `1px solid ${message.type === "success" ? "#4caf50" : "#ef5350"}`,
          borderRadius: "6px",
          color: message.type === "success" ? "#2e7d32" : "#c62828",
          fontSize: "0.9rem"
        }}>
          {message.text}
        </div>
      )}
      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          padding: "0.75rem 1.5rem",
          background: loading ? "#ccc" : "#1976d2",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          fontSize: "0.9rem",
          fontWeight: "600",
          cursor: loading ? "not-allowed" : "pointer"
        }}
      >
        {loading ? "Updating..." : "Update Service Fee Percentage"}
      </button>
    </div>
  );
}

// Kilo-Shaving Rate Form Component
function KiloShavingRateForm({ currentRate, updateKiloShavingRate, adminId }: { currentRate: number; updateKiloShavingRate: any; adminId: Id<"users"> }) {
  const [rate, setRate] = useState<string>(currentRate.toString());
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async () => {
    const rateValue = parseFloat(rate);
    if (!rate || isNaN(rateValue) || rateValue < 0) {
      setMessage({ type: "error", text: "Please enter a valid rate (must be >= 0)" });
      return;
    }
    if (!reason.trim()) {
      setMessage({ type: "error", text: "Please provide a reason" });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const result = await updateKiloShavingRate({
        adminId,
        rateKgPerDay: rateValue,
        reason: reason.trim(),
      });
      setMessage({
        type: "success",
        text: `Kilo-shaving rate updated successfully! UTID: ${result.utid}. New rate: ${rateValue} kg/day per 100kg block.`
      });
      setReason("");
    } catch (error: any) {
      setMessage({ type: "error", text: `Failed to update rate: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
          New Rate (kg per day per 100kg block):
        </label>
        <input
          type="number"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          min="0"
          step="0.1"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "0.9rem",
            fontFamily: "inherit"
          }}
        />
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
          Reason (required):
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason for changing kilo-shaving rate..."
          style={{
            width: "100%",
            minHeight: "80px",
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "0.9rem",
            fontFamily: "inherit",
            resize: "vertical"
          }}
        />
      </div>
      {message && (
        <div style={{
          marginBottom: "1rem",
          padding: "0.75rem",
          background: message.type === "success" ? "#e8f5e9" : "#ffebee",
          border: `1px solid ${message.type === "success" ? "#4caf50" : "#ef5350"}`,
          borderRadius: "6px",
          color: message.type === "success" ? "#2e7d32" : "#c62828",
          fontSize: "0.9rem"
        }}>
          {message.text}
        </div>
      )}
      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          padding: "0.75rem 1.5rem",
          background: loading ? "#ccc" : "#1976d2",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          fontSize: "0.9rem",
          fontWeight: "600",
          cursor: loading ? "not-allowed" : "pointer"
        }}
      >
        {loading ? "Updating..." : "Update Kilo-Shaving Rate"}
      </button>
    </div>
  );
}

// Trader Spend Cap Form Component
function TraderSpendCapForm({ traders, updateTraderSpendCap, updateAllTradersSpendCap, adminId }: { traders: any[]; updateTraderSpendCap: any; updateAllTradersSpendCap: any; adminId: Id<"users"> }) {
  const [selectedTrader, setSelectedTrader] = useState<string>("");
  const [spendCap, setSpendCap] = useState<string>("");
  const [allTradersSpendCap, setAllTradersSpendCap] = useState<string>("");
  const [reason, setReason] = useState("");
  const [allTradersReason, setAllTradersReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [allTradersLoading, setAllTradersLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [allTradersMessage, setAllTradersMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async () => {
    if (!selectedTrader) {
      setMessage({ type: "error", text: "Please select a trader" });
      return;
    }
    if (!reason.trim()) {
      setMessage({ type: "error", text: "Please provide a reason" });
      return;
    }

    const spendCapValue = spendCap.trim() === "" ? undefined : parseFloat(spendCap);
    if (spendCapValue !== undefined && (isNaN(spendCapValue) || spendCapValue < 0)) {
      setMessage({ type: "error", text: "Please enter a valid spend cap (must be >= 0) or leave empty to reset to default" });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const result = await updateTraderSpendCap({
        adminId,
        traderId: selectedTrader as Id<"users">,
        spendCap: spendCapValue,
        reason: reason.trim(),
      });
      setMessage({
        type: "success",
        text: `Spend cap ${spendCapValue === undefined ? "reset to default" : `set to ${spendCapValue.toLocaleString()} UGX`} for trader ${result.traderAlias}! UTID: ${result.utid}.`
      });
      setSelectedTrader("");
      setSpendCap("");
      setReason("");
    } catch (error: any) {
      setMessage({ type: "error", text: `Failed to update spend cap: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
          Select Trader:
        </label>
        <select
          value={selectedTrader}
          onChange={(e) => setSelectedTrader(e.target.value)}
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "0.9rem",
            fontFamily: "inherit"
          }}
        >
          <option value="">-- Select a trader --</option>
          {traders.map((trader: any) => (
            <option key={trader.userId} value={trader.userId}>
              {trader.alias} {trader.customSpendCap ? `(Current: ${trader.customSpendCap.toLocaleString()} UGX)` : "(Default: 1,000,000 UGX)"}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
          New Spend Cap (UGX) - Leave empty to reset to default:
        </label>
        <input
          type="number"
          value={spendCap}
          onChange={(e) => setSpendCap(e.target.value)}
          min="0"
          step="1000"
          placeholder="e.g., 2000000 (or leave empty for default)"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "0.9rem",
            fontFamily: "inherit"
          }}
        />
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
          Reason (required):
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason for changing spend cap..."
          style={{
            width: "100%",
            minHeight: "80px",
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "0.9rem",
            fontFamily: "inherit",
            resize: "vertical"
          }}
        />
      </div>
      {message && (
        <div style={{
          marginBottom: "1rem",
          padding: "0.75rem",
          background: message.type === "success" ? "#e8f5e9" : "#ffebee",
          border: `1px solid ${message.type === "success" ? "#4caf50" : "#ef5350"}`,
          borderRadius: "6px",
          color: message.type === "success" ? "#2e7d32" : "#c62828",
          fontSize: "0.9rem"
        }}>
          {message.text}
        </div>
      )}
      <button
        onClick={handleSubmit}
        disabled={loading || !selectedTrader}
        style={{
          padding: "0.75rem 1.5rem",
          background: loading || !selectedTrader ? "#ccc" : "#1976d2",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          fontSize: "0.9rem",
          fontWeight: "600",
          cursor: loading || !selectedTrader ? "not-allowed" : "pointer"
        }}
      >
        {loading ? "Updating..." : "Update Trader Spend Cap"}
      </button>

      <div style={{ marginTop: "2rem", paddingTop: "2rem", borderTop: "2px solid #e0e0e0" }}>
        <h4 style={{ marginBottom: "1rem", fontSize: "1.1rem", color: "#1a1a1a" }}>
          Set Spend Cap for All Traders
        </h4>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
            New Spend Cap for All Traders (UGX) - Leave empty to reset all to default:
          </label>
          <input
            type="number"
            value={allTradersSpendCap}
            onChange={(e) => setAllTradersSpendCap(e.target.value)}
            min="0"
            step="1000"
            placeholder="e.g., 2000000 (or leave empty for default)"
            disabled={allTradersLoading}
            style={{
              width: "100%",
              padding: "0.75rem",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: "0.9rem",
              fontFamily: "inherit"
            }}
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
            Reason (required):
          </label>
          <textarea
            value={allTradersReason}
            onChange={(e) => setAllTradersReason(e.target.value)}
            placeholder="Enter reason for changing spend cap for all traders..."
            style={{
              width: "100%",
              minHeight: "80px",
              padding: "0.75rem",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: "0.9rem",
              fontFamily: "inherit",
              resize: "vertical"
            }}
          />
        </div>
        {allTradersMessage && (
          <div style={{
            marginBottom: "1rem",
            padding: "0.75rem",
            background: allTradersMessage.type === "success" ? "#e8f5e9" : "#ffebee",
            border: `1px solid ${allTradersMessage.type === "success" ? "#4caf50" : "#ef5350"}`,
            borderRadius: "6px",
            color: allTradersMessage.type === "success" ? "#2e7d32" : "#c62828",
            fontSize: "0.9rem"
          }}>
            {allTradersMessage.text}
          </div>
        )}
        <button
          onClick={async () => {
            if (!allTradersReason.trim()) {
              setAllTradersMessage({ type: "error", text: "Please provide a reason" });
              return;
            }

            const spendCapValue = allTradersSpendCap.trim() === "" ? undefined : parseFloat(allTradersSpendCap);
            if (spendCapValue !== undefined && (isNaN(spendCapValue) || spendCapValue < 0)) {
              setAllTradersMessage({ type: "error", text: "Please enter a valid spend cap (must be >= 0) or leave empty to reset to default" });
              return;
            }

            setAllTradersLoading(true);
            setAllTradersMessage(null);
            try {
              const result = await updateAllTradersSpendCap({
                adminId,
                spendCap: spendCapValue,
                reason: allTradersReason.trim(),
              });
              setAllTradersMessage({
                type: "success",
                text: `Spend cap ${spendCapValue === undefined ? "reset to default" : `set to ${spendCapValue.toLocaleString()} UGX`} for ${result.updated.length} trader(s)! UTID: ${result.utid}.`
              });
              setAllTradersSpendCap("");
              setAllTradersReason("");
            } catch (error: any) {
              setAllTradersMessage({ type: "error", text: `Failed to update spend cap: ${error.message}` });
            } finally {
              setAllTradersLoading(false);
            }
          }}
          disabled={allTradersLoading}
          style={{
            padding: "0.75rem 1.5rem",
            background: allTradersLoading ? "#ccc" : "#4caf50",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontSize: "0.9rem",
            fontWeight: "600",
            cursor: allTradersLoading ? "not-allowed" : "pointer"
          }}
        >
          {allTradersLoading ? "Updating All Traders..." : "Update All Traders Spend Cap"}
        </button>
      </div>
    </div>
  );
}

// Notification Form Component
function NotificationForm({ allUsers, sendNotification, sendRoleBasedNotification, adminId }: { allUsers: any[]; sendNotification: any; sendRoleBasedNotification: any; adminId: Id<"users"> }) {
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const toggleUser = (userId: string) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUserIds(newSet);
  };

  const selectAll = () => {
    setSelectedUserIds(new Set(allUsers.map((u: any) => u.userId)));
  };

  const selectNone = () => {
    setSelectedUserIds(new Set());
  };

  const handleSubmit = async () => {
    if (selectedUserIds.size === 0) {
      setResultMessage({ type: "error", text: "Please select at least one user" });
      return;
    }
    if (!title.trim()) {
      setResultMessage({ type: "error", text: "Please enter a title" });
      return;
    }
    if (!message.trim()) {
      setResultMessage({ type: "error", text: "Please enter a message" });
      return;
    }
    if (!reason.trim()) {
      setResultMessage({ type: "error", text: "Please provide a reason" });
      return;
    }

    setLoading(true);
    setResultMessage(null);
    try {
      const result = await sendNotification({
        adminId,
        userIds: Array.from(selectedUserIds) as Id<"users">[],
        title: title.trim(),
        message: message.trim(),
        reason: reason.trim(),
      });
      setResultMessage({
        type: "success",
        text: `Notification sent successfully to ${result.recipientsCount} user(s)! UTID: ${result.notificationUtid}.`
      });
      setTitle("");
      setMessage("");
      setReason("");
      setSelectedUserIds(new Set());
    } catch (error: any) {
      setResultMessage({ type: "error", text: `Failed to send notification: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Group users by role
  const usersByRole = {
    farmer: allUsers.filter((u: any) => u.role === "farmer"),
    trader: allUsers.filter((u: any) => u.role === "trader"),
    buyer: allUsers.filter((u: any) => u.role === "buyer"),
    admin: allUsers.filter((u: any) => u.role === "admin"),
  };

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <button
            onClick={selectAll}
            style={{
              padding: "0.5rem 1rem",
              background: "#e3f2fd",
              color: "#1976d2",
              border: "1px solid #2196f3",
              borderRadius: "6px",
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            Select All
          </button>
          <button
            onClick={selectNone}
            style={{
              padding: "0.5rem 1rem",
              background: "#f5f5f5",
              color: "#666",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            Select None
          </button>
        </div>
        <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid #ddd", borderRadius: "6px", padding: "0.75rem" }}>
          {Object.entries(usersByRole).map(([role, users]) => (
            users.length > 0 && (
              <div key={role} style={{ marginBottom: "1rem" }}>
                <div style={{ fontWeight: "600", marginBottom: "0.5rem", textTransform: "capitalize", color: "#666" }}>
                  {role}s ({users.length})
                </div>
                {users.map((user: any) => (
                  <label
                    key={user.userId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "0.5rem",
                      cursor: "pointer",
                      borderRadius: "4px",
                      marginBottom: "0.25rem",
                      background: selectedUserIds.has(user.userId) ? "#e3f2fd" : "transparent"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(user.userId)}
                      onChange={() => toggleUser(user.userId)}
                      style={{ marginRight: "0.5rem" }}
                    />
                    <span>{user.alias} ({user.email})</span>
                  </label>
                ))}
              </div>
            )
          ))}
        </div>
        <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#666" }}>
          Selected: {selectedUserIds.size} user(s)
        </div>
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
          Title:
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Notification title"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "0.9rem",
            fontFamily: "inherit"
          }}
        />
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
          Message:
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Notification message"
          disabled={loading}
          style={{
            width: "100%",
            minHeight: "100px",
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "0.9rem",
            fontFamily: "inherit",
            resize: "vertical"
          }}
        />
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
          Reason (required):
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason for sending notification..."
          disabled={loading}
          style={{
            width: "100%",
            minHeight: "80px",
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "0.9rem",
            fontFamily: "inherit",
            resize: "vertical"
          }}
        />
      </div>
      <div style={{ marginTop: "1.5rem", marginBottom: "1rem", paddingTop: "1.5rem", borderTop: "2px solid #e0e0e0" }}>
        <h4 style={{ marginBottom: "0.75rem", fontSize: "1.1rem", color: "#1a1a1a" }}>
          Or Send to All Users by Role:
        </h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {Object.entries(usersByRole).map(([role, users]) => (
            users.length > 0 && (
              <button
                key={role}
                onClick={async () => {
                  if (!title.trim() || !message.trim() || !reason.trim()) {
                    setResultMessage({ type: "error", text: "Please fill in title, message, and reason first" });
                    return;
                  }
                  setRoleLoading(role);
                  setResultMessage(null);
                  try {
                    const result = await sendRoleBasedNotification({
                      adminId,
                      role: role as "farmer" | "trader" | "buyer" | "admin",
                      title: title.trim(),
                      message: message.trim(),
                      reason: reason.trim(),
                    });
                    setResultMessage({
                      type: "success",
                      text: `Notification sent successfully to all ${role}s (${result.recipientsCount} users)! UTID: ${result.notificationUtid}.`
                    });
                    setTitle("");
                    setMessage("");
                    setReason("");
                  } catch (error: any) {
                    setResultMessage({ type: "error", text: `Failed to send notification: ${error.message}` });
                  } finally {
                    setRoleLoading(null);
                  }
                }}
                disabled={roleLoading !== null || !title.trim() || !message.trim() || !reason.trim()}
                style={{
                  padding: "0.5rem 1rem",
                  background: roleLoading === role ? "#ccc" : "#4caf50",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  cursor: roleLoading !== null || !title.trim() || !message.trim() || !reason.trim() ? "not-allowed" : "pointer"
                }}
              >
                {roleLoading === role ? "Sending..." : `Send to All ${role.charAt(0).toUpperCase() + role.slice(1)}s (${users.length})`}
              </button>
            )
          ))}
        </div>
      </div>
      {resultMessage && (
        <div style={{
          marginBottom: "1rem",
          padding: "0.75rem",
          background: resultMessage.type === "success" ? "#e8f5e9" : "#ffebee",
          border: `1px solid ${resultMessage.type === "success" ? "#4caf50" : "#ef5350"}`,
          borderRadius: "6px",
          color: resultMessage.type === "success" ? "#2e7d32" : "#c62828",
          fontSize: "0.9rem"
        }}>
          {resultMessage.text}
        </div>
      )}
      <button
        onClick={handleSubmit}
        disabled={loading || selectedUserIds.size === 0}
        style={{
          padding: "0.75rem 1.5rem",
          background: loading || selectedUserIds.size === 0 ? "#ccc" : "#1976d2",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          fontSize: "0.9rem",
          fontWeight: "600",
          cursor: loading || selectedUserIds.size === 0 ? "not-allowed" : "pointer"
        }}
      >
        {loading ? "Sending..." : `Send Notification to ${selectedUserIds.size} User(s)`}
      </button>
    </div>
  );
}

// Demo Funds Deposit Form Component
function DemoFundsForm({ 
  allUsers, 
  adminDepositDemoFunds, 
  adminId 
}: { 
  allUsers: any[]; 
  adminDepositDemoFunds: any; 
  adminId: Id<"users"> 
}) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filter for traders and buyers only
  const tradersAndBuyers = allUsers.filter(u => u.role === "trader" || u.role === "buyer");

  const handleDeposit = async () => {
    if (!selectedUserId) {
      setMessage({ type: "error", text: "Please select a user" });
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setMessage({ type: "error", text: "Please enter a valid amount greater than 0" });
      return;
    }
    if (!reason.trim()) {
      setMessage({ type: "error", text: "Please provide a reason for this deposit" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await adminDepositDemoFunds({
        adminId,
        targetUserId: selectedUserId,
        amount: parseFloat(amount),
        reason: reason.trim(),
      });

      setMessage({ 
        type: "success", 
        text: `Successfully deposited ${parseFloat(amount).toLocaleString()} UGX to ${result.targetUserEmail}. New balance: ${result.newBalance.toLocaleString()} UGX. UTID: ${result.utid}` 
      });
      
      // Reset form
      setSelectedUserId("");
      setAmount("");
      setReason("");
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to deposit funds" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {message && (
        <div style={{
          padding: "0.75rem",
          marginBottom: "1rem",
          borderRadius: "6px",
          backgroundColor: message.type === "success" ? "#d4edda" : "#f8d7da",
          color: message.type === "success" ? "#155724" : "#721c24",
          border: `1px solid ${message.type === "success" ? "#c3e6cb" : "#f5c6cb"}`,
          fontSize: "0.9rem"
        }}>
          {message.text}
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <label style={{ 
          display: "block", 
          marginBottom: "0.5rem", 
          fontWeight: "500",
          color: "#444" 
        }}>
          Select Trader or Buyer:
        </label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.5rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "0.9rem"
          }}
        >
          <option value="">-- Select User --</option>
          {tradersAndBuyers.map((user) => (
            <option key={user._id} value={user._id}>
              {user.email} ({user.role}) - {user.alias}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={{ 
          display: "block", 
          marginBottom: "0.5rem", 
          fontWeight: "500",
          color: "#444" 
        }}>
          Amount (UGX):
        </label>
        <input
          type="number"
          min="0"
          step="1000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={loading}
          placeholder="Enter amount in UGX"
          style={{
            width: "100%",
            padding: "0.5rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "0.9rem"
          }}
        />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={{ 
          display: "block", 
          marginBottom: "0.5rem", 
          fontWeight: "500",
          color: "#444" 
        }}>
          Reason:
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={loading}
          placeholder="Enter reason for this demo deposit (e.g., 'Training funds for new user')"
          rows={3}
          style={{
            width: "100%",
            padding: "0.5rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "0.9rem",
            fontFamily: "inherit",
            resize: "vertical"
          }}
        />
      </div>

      <button
        onClick={handleDeposit}
        disabled={loading || !selectedUserId || !amount || !reason.trim()}
        style={{
          backgroundColor: loading || !selectedUserId || !amount || !reason.trim() ? "#ccc" : "#007bff",
          color: "#fff",
          padding: "0.75rem 1.5rem",
          border: "none",
          borderRadius: "6px",
          fontSize: "0.9rem",
          fontWeight: "600",
          cursor: loading || !selectedUserId || !amount || !reason.trim() ? "not-allowed" : "pointer"
        }}
      >
        {loading ? "Depositing..." : "Deposit Demo Funds"}
      </button>
    </div>
  );
}

// Quality Options Manager Component
function QualityOptionsManager({ 
  qualityOptions, 
  addQualityOption, 
  updateQualityOption, 
  deleteQualityOption, 
  adminId 
}: { 
  qualityOptions: any[]; 
  addQualityOption: any; 
  updateQualityOption: any; 
  deleteQualityOption: any; 
  adminId: Id<"users"> 
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newOrder, setNewOrder] = useState<string>("0");
  const [addReason, setAddReason] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addMessage, setAddMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editOrder, setEditOrder] = useState<string>("");
  const [editActive, setEditActive] = useState(true);
  const [editReason, setEditReason] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newLabel.trim() || !newValue.trim()) {
      setAddMessage({ type: "error", text: "Label and value are required" });
      return;
    }
    if (!addReason.trim()) {
      setAddMessage({ type: "error", text: "Reason is required" });
      return;
    }

    setAddLoading(true);
    setAddMessage(null);
    try {
      const result = await addQualityOption({
        adminId,
        label: newLabel.trim(),
        value: newValue.trim(),
        order: parseInt(newOrder) || 0,
        reason: addReason.trim(),
      });
      setAddMessage({
        type: "success",
        text: `Quality option added successfully! UTID: ${result.utid}`
      });
      setNewLabel("");
      setNewValue("");
      setNewOrder("0");
      setAddReason("");
      setShowAddForm(false);
    } catch (error: any) {
      setAddMessage({ type: "error", text: `Failed to add option: ${error.message}` });
    } finally {
      setAddLoading(false);
    }
  };

  const handleEdit = async (optionId: string) => {
    if (!editReason.trim()) {
      setEditMessage({ type: "error", text: "Reason is required" });
      return;
    }

    setEditLoading(true);
    setEditMessage(null);
    try {
      const result = await updateQualityOption({
        adminId,
        optionId: optionId as Id<"qualityOptions">,
        label: editLabel.trim(),
        order: parseInt(editOrder) || 0,
        active: editActive,
        reason: editReason.trim(),
      });
      setEditMessage({
        type: "success",
        text: `Quality option updated successfully! UTID: ${result.utid}`
      });
      setEditingId(null);
      setEditReason("");
    } catch (error: any) {
      setEditMessage({ type: "error", text: `Failed to update option: ${error.message}` });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (optionId: string) => {
    if (!deleteReason.trim()) {
      alert("Please provide a reason for deletion");
      return;
    }

    try {
      const result = await deleteQualityOption({
        adminId,
        optionId: optionId as Id<"qualityOptions">,
        reason: deleteReason.trim(),
      });
      setDeletingId(null);
      setDeleteReason("");
      alert(`Quality option deleted successfully! UTID: ${result.utid}`);
    } catch (error: any) {
      alert(`Failed to delete option: ${error.message}`);
    }
  };

  const startEdit = (option: any) => {
    setEditingId(option.optionId);
    setEditLabel(option.label);
    setEditOrder(option.order.toString());
    setEditActive(option.active);
    setEditReason("");
    setEditMessage(null);
  };

  return (
    <div>
      {/* Add New Option */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1.5rem",
            background: "#4caf50",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontSize: "0.9rem",
            fontWeight: "600",
            cursor: "pointer"
          }}
        >
          + Add Quality Option
        </button>
      ) : (
        <div style={{
          marginBottom: "1rem",
          padding: "1rem",
          background: "#f9f9f9",
          borderRadius: "8px",
          border: "1px solid #e0e0e0"
        }}>
          <h4 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>Add New Quality Option</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", fontWeight: "600" }}>
                Label (Display Text):
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g., Premium, Good, Fair"
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
                Value (Unique Identifier):
              </label>
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="e.g., premium, good, fair"
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
                Display Order:
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
                placeholder="Enter reason for adding this option..."
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
                {addLoading ? "Adding..." : "Add Option"}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewLabel("");
                  setNewValue("");
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

      {/* Existing Options List */}
      <div style={{ marginTop: "1.5rem" }}>
        <h4 style={{ marginBottom: "0.75rem", fontSize: "1.1rem" }}>Existing Quality Options</h4>
        {qualityOptions.length === 0 ? (
          <p style={{ color: "#666", fontSize: "0.9rem" }}>No quality options defined yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {qualityOptions.map((option) => (
              <div
                key={option.optionId}
                style={{
                  padding: "1rem",
                  background: option.active ? "#fff" : "#f5f5f5",
                  borderRadius: "6px",
                  border: `1px solid ${option.active ? "#e0e0e0" : "#ccc"}`,
                  opacity: option.active ? 1 : 0.6
                }}
              >
                {editingId === option.optionId ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div>
                      <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", fontWeight: "600" }}>
                        Label:
                      </label>
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
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
                        onClick={() => handleEdit(option.optionId)}
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
                        {option.label} {!option.active && <span style={{ color: "#999", fontSize: "0.85rem" }}>(Inactive)</span>}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#666" }}>
                        Value: <code>{option.value}</code> | Order: {option.order}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button
                        onClick={() => startEdit(option)}
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
                          width: "36px",
                          height: "36px",
                          boxSizing: "border-box"
                        }}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      {deletingId === option.optionId ? (
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
                              onClick={() => handleDelete(option.optionId)}
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
                          onClick={() => setDeletingId(option.optionId)}
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
                            width: "36px",
                            height: "36px",
                            boxSizing: "border-box"
                          }}
                          title="Delete"
                        >
                          ✕
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

// Produce Options Manager Component
function ProduceOptionsManager({ 
  produceOptions, 
  addProduceOption, 
  updateProduceOption, 
  deleteProduceOption, 
  adminId 
}: { 
  produceOptions: any[]; 
  addProduceOption: any; 
  updateProduceOption: any; 
  deleteProduceOption: any; 
  adminId: Id<"users"> 
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [newOrder, setNewOrder] = useState<string>("0");
  const [addReason, setAddReason] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addMessage, setAddMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editOrder, setEditOrder] = useState<string>("");
  const [editActive, setEditActive] = useState(true);
  const [editReason, setEditReason] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newLabel.trim() || !newValue.trim() || !newIcon.trim()) {
      setAddMessage({ type: "error", text: "Label, value, and icon are required" });
      return;
    }
    if (!addReason.trim()) {
      setAddMessage({ type: "error", text: "Reason is required" });
      return;
    }

    setAddLoading(true);
    setAddMessage(null);
    try {
      const result = await addProduceOption({
        adminId,
        label: newLabel.trim(),
        value: newValue.trim(),
        icon: newIcon.trim(),
        order: parseInt(newOrder) || 0,
        reason: addReason.trim(),
      });
      setAddMessage({
        type: "success",
        text: `Produce option added successfully! UTID: ${result.utid}`
      });
      setNewLabel("");
      setNewValue("");
      setNewIcon("");
      setNewOrder("0");
      setAddReason("");
      setShowAddForm(false);
    } catch (error: any) {
      setAddMessage({ type: "error", text: `Failed to add option: ${error.message}` });
    } finally {
      setAddLoading(false);
    }
  };

  const handleEdit = async (optionId: string) => {
    if (!editReason.trim()) {
      setEditMessage({ type: "error", text: "Reason is required" });
      return;
    }

    setEditLoading(true);
    setEditMessage(null);
    try {
      const result = await updateProduceOption({
        adminId,
        optionId: optionId as Id<"produceOptions">,
        label: editLabel.trim(),
        icon: editIcon.trim(),
        order: parseInt(editOrder) || 0,
        active: editActive,
        reason: editReason.trim(),
      });
      setEditMessage({
        type: "success",
        text: `Produce option updated successfully! UTID: ${result.utid}`
      });
      setEditingId(null);
      setEditReason("");
    } catch (error: any) {
      setEditMessage({ type: "error", text: `Failed to update option: ${error.message}` });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (optionId: string) => {
    if (!deleteReason.trim()) {
      alert("Please provide a reason for deletion");
      return;
    }

    try {
      const result = await deleteProduceOption({
        adminId,
        optionId: optionId as Id<"produceOptions">,
        reason: deleteReason.trim(),
      });
      setDeletingId(null);
      setDeleteReason("");
      alert(`Produce option deleted successfully! UTID: ${result.utid}`);
    } catch (error: any) {
      alert(`Failed to delete option: ${error.message}`);
    }
  };

  const startEdit = (option: any) => {
    setEditingId(option.optionId);
    setEditLabel(option.label);
    setEditIcon(option.icon);
    setEditOrder(option.order.toString());
    setEditActive(option.active);
    setEditReason("");
    setEditMessage(null);
  };

  return (
    <div>
      {/* Add New Option */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1.5rem",
            background: "#4caf50",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontSize: "0.9rem",
            fontWeight: "600",
            cursor: "pointer"
          }}
        >
          + Add Produce Option
        </button>
      ) : (
        <div style={{
          marginBottom: "1rem",
          padding: "1rem",
          background: "#f9f9f9",
          borderRadius: "8px",
          border: "1px solid #e0e0e0"
        }}>
          <h4 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>Add New Produce Option</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", fontWeight: "600" }}>
                Label (Display Text):
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g., Banana, Maize, Beans"
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
                Value (Unique Identifier):
              </label>
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="e.g., Banana, Maize, Beans"
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
                Icon (Emoji):
              </label>
              <select
                value={newIcon}
                onChange={(e) => setNewIcon(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "0.9rem"
                }}
              >
                <option value="">-- Select an emoji --</option>
                <option value="🍌">🍌 Banana</option>
                <option value="🌽">🌽 Maize/Corn</option>
                <option value="🫘">🫘 Beans</option>
                <option value="🍠">🍠 Cassava</option>
                <option value="🍅">🍅 Tomato</option>
                <option value="🌾">🌾 Rice</option>
                <option value="🥔">🥔 Potato</option>
                <option value="🥜">🥜 Groundnut/Peanut</option>
                <option value="🌻">🌻 Sunflower</option>
                <option value="🌶️">🌶️ Pepper</option>
                <option value="🥬">🥬 Cabbage</option>
                <option value="🥕">🥕 Carrot</option>
                <option value="🧅">🧅 Onion</option>
                <option value="🥒">🥒 Cucumber</option>
                <option value="🌿">🌿 Herbs</option>
                <option value="🥑">🥑 Avocado</option>
                <option value="🍊">🍊 Orange</option>
                <option value="🍋">🍋 Lemon</option>
                <option value="🥭">🥭 Mango</option>
                <option value="🍉">🍉 Watermelon</option>
                <option value="🥥">🥥 Coconut</option>
                <option value="🌰">🌰 Cashew</option>
                <option value="☕">☕ Coffee</option>
                <option value="🍵">🍵 Tea</option>
                <option value="🌱">🌱 Seedlings</option>
              </select>
              <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "#666" }}>
                Select an emoji from the agro-commodities icon library
              </p>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", fontWeight: "600" }}>
                Display Order:
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
                placeholder="Enter reason for adding this option..."
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
                {addLoading ? "Adding..." : "Add Option"}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewLabel("");
                  setNewValue("");
                  setNewIcon("");
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

      {/* Existing Options List */}
      <div style={{ marginTop: "1.5rem" }}>
        <h4 style={{ marginBottom: "0.75rem", fontSize: "1.1rem" }}>Existing Produce Options</h4>
        {produceOptions.length === 0 ? (
          <p style={{ color: "#666", fontSize: "0.9rem" }}>No produce options defined yet. Add options to enable farmers to create listings.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {produceOptions.map((option) => (
              <div
                key={option.optionId}
                style={{
                  padding: "1rem",
                  background: option.active ? "#fff" : "#f5f5f5",
                  borderRadius: "6px",
                  border: `1px solid ${option.active ? "#e0e0e0" : "#ccc"}`,
                  opacity: option.active ? 1 : 0.6
                }}
              >
                {editingId === option.optionId ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div>
                      <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.9rem", fontWeight: "600" }}>
                        Label:
                      </label>
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
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
                        Icon (Emoji):
                      </label>
                      <select
                        value={editIcon}
                        onChange={(e) => setEditIcon(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          fontSize: "0.9rem"
                        }}
                      >
                        <option value="">-- Select an emoji --</option>
                        <option value="🍌">🍌 Banana</option>
                        <option value="🌽">🌽 Maize/Corn</option>
                        <option value="🫘">🫘 Beans</option>
                        <option value="🍠">🍠 Cassava</option>
                        <option value="🍅">🍅 Tomato</option>
                        <option value="🌾">🌾 Rice</option>
                        <option value="🥔">🥔 Potato</option>
                        <option value="🥜">🥜 Groundnut/Peanut</option>
                        <option value="🌻">🌻 Sunflower</option>
                        <option value="🌶️">🌶️ Pepper</option>
                        <option value="🥬">🥬 Cabbage</option>
                        <option value="🥕">🥕 Carrot</option>
                        <option value="🧅">🧅 Onion</option>
                        <option value="🥒">🥒 Cucumber</option>
                        <option value="🌿">🌿 Herbs</option>
                        <option value="🥑">🥑 Avocado</option>
                        <option value="🍊">🍊 Orange</option>
                        <option value="🍋">🍋 Lemon</option>
                        <option value="🥭">🥭 Mango</option>
                        <option value="🍉">🍉 Watermelon</option>
                        <option value="🥥">🥥 Coconut</option>
                        <option value="🌰">🌰 Cashew</option>
                        <option value="☕">☕ Coffee</option>
                        <option value="🍵">🍵 Tea</option>
                        <option value="🌱">🌱 Seedlings</option>
                      </select>
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
                        onClick={() => handleEdit(option.optionId)}
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
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <span style={{ fontSize: "2rem" }}>{option.icon}</span>
                      <div>
                        <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
                          {option.label} {!option.active && <span style={{ color: "#999", fontSize: "0.85rem" }}>(Inactive)</span>}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#666" }}>
                          Value: <code>{option.value}</code> | Order: {option.order}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button
                        onClick={() => startEdit(option)}
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
                          width: "36px",
                          height: "36px",
                          boxSizing: "border-box"
                        }}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      {deletingId === option.optionId ? (
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
                              onClick={() => handleDelete(option.optionId)}
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
                          onClick={() => setDeletingId(option.optionId)}
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
                            width: "36px",
                            height: "36px",
                            boxSizing: "border-box"
                          }}
                          title="Delete"
                        >
                          ✕
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
