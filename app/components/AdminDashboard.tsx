"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatUgandaDateTime, formatUgandaTimeOnly, getUgandaTime } from "../utils/timeUtils";
import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { exportToExcel, exportToPDF, formatUTIDDataForExport } from "../utils/exportUtils";
import { StorageLocationsManager } from "./StorageLocationsManager";
import { DeliveryConfirmationForm } from "./DeliveryConfirmationForm";
import { ThreadView } from "./messages/ThreadView";
import { ContactUs } from "./ContactUs";

interface AdminDashboardProps {
  userId: Id<"users">;
}

export function AdminDashboard({ userId }: AdminDashboardProps) {
  const redFlags = useQuery(api.adminRedFlags.getRedFlagsSummary, { adminId: userId });
  const [utidPageOffset, setUtidPageOffset] = useState(0);
  const [utidPageSize, setUtidPageSize] = useState(200);
  const [timelineOffset, setTimelineOffset] = useState(0);
  const timelinePageSize = 10;
  const allUTIDs = useQuery(api.introspection.getAllActiveUTIDs, {
    adminId: userId,
    limit: utidPageSize,
    offset: utidPageOffset,
  });
  const pendingDeliveryUTIDs = useQuery(api.introspection.getPendingDeliveryUTIDs, {
    adminId: userId,
  });
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
  const communitySummaries = useQuery(
    api.communities.getActiveCommunities,
    userId ? { userId } : "skip"
  );
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
  const isCommunityAdmin = currentUser?.role === "admin" && currentUser?.adminLevel === "junior" && currentUser?.adminCategory === "community";
  const canViewCommunityDatabase = isSuperAdmin || isCommunityAdmin;
  const storeAdmins = useQuery(
    api.adminAudit.getStoreAdmins,
    isSuperAdmin ? { adminId: userId } : "skip"
  );
  const [selectedStoreAdminId, setSelectedStoreAdminId] = useState<Id<"users"> | null>(null);
  const [selectedDeliveryUtid, setSelectedDeliveryUtid] = useState<string | null>(null);
  const storeAdminAudit = useQuery(
    api.adminAudit.getStoreAdminUTIDs,
    isSuperAdmin && selectedStoreAdminId
      ? { adminId: userId, storeAdminId: selectedStoreAdminId }
      : "skip"
  );
  const deliveryProof = useQuery(
    api.adminAudit.getDeliveryPDF,
    isSuperAdmin && selectedDeliveryUtid
      ? { adminId: userId, lockUtid: selectedDeliveryUtid }
      : "skip"
  );
  const adminMessageThreads = useQuery(
    api.messages.getAdminMessageThreads,
    isSuperAdmin ? { adminId: userId } : "skip"
  );
  const userMessageThreads = useQuery(
    api.messages.getUserMessageThreads,
    userId ? { userId } : "skip"
  );
  const [selectedMessageUtid, setSelectedMessageUtid] = useState<string | null>(null);
  const SUPPORT_THREAD = "SUPPORT";
  const inboxThreads = isSuperAdmin ? adminMessageThreads : userMessageThreads;
  const inboxUnreadCount = inboxThreads
    ? inboxThreads.reduce((sum: number, thread: any) => sum + (thread.unreadCount || 0), 0)
    : 0;
  
  const [reason, setReason] = useState("");
  const [windowActionLoading, setWindowActionLoading] = useState(false);
  const [windowActionMessage, setWindowActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pilotModeReason, setPilotModeReason] = useState("");
  const [pilotModeLoading, setPilotModeLoading] = useState(false);
  const [pilotModeMessage, setPilotModeMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null); // Track which metric card is expanded
  const [isMobile, setIsMobile] = useState(false);
  const [adminInboxOpen, setAdminInboxOpen] = useState(true);
  const inboxRef = useRef<HTMLDivElement>(null);
  const [isInboxNarrow, setIsInboxNarrow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!inboxRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width || 0;
      setIsInboxNarrow(width <= 720);
    });
    observer.observe(inboxRef.current);
    return () => observer.disconnect();
  }, []);

  const storageLocationsById = new Map<string, any>();
  if (storageLocations) {
    storageLocations.forEach((location: any) => {
      storageLocationsById.set(location._id, location);
    });
  }
  const formatStoreAdminLocations = (admin: any) => {
    if (admin?.storageLocationNames?.length) {
      return admin.storageLocationNames.join(", ");
    }
    if (admin?.allowedStorageLocationIds?.length) {
      const names = admin.allowedStorageLocationIds
        .map((id: string) => storageLocationsById.get(id)?.districtName)
        .filter(Boolean);
      return names.length > 0 ? names.join(", ") : "No locations";
    }
    return "No locations";
  };

  const totalUtidCount = allUTIDs?.totalUTIDs || 0;
  const utidRangeOptions = Array.from(
    { length: Math.ceil(totalUtidCount / utidPageSize) || 0 },
    (_, index) => {
      const start = index * utidPageSize + 1;
      const end = Math.min((index + 1) * utidPageSize, totalUtidCount);
      return { start, end, offset: (index * utidPageSize) };
    }
  );

  const timelineTotal = allUTIDs?.utids?.length || 0;
  const timelineRangeOptions = Array.from(
    { length: Math.ceil(timelineTotal / timelinePageSize) || 0 },
    (_, index) => {
      const start = index * timelinePageSize + 1;
      const end = Math.min((index + 1) * timelinePageSize, timelineTotal);
      return { start, end, offset: (index * timelinePageSize) };
    }
  );

  const getSortTimestamp = (item: any) => {
    const raw =
      item?.timestamp ??
      item?.updatedAt ??
      item?.createdAt ??
      item?.purchasedAt ??
      item?._creationTime ??
      0;
    if (typeof raw === "number") {
      return raw;
    }
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const sortedAllUtids = useMemo(() => {
    if (!allUTIDs?.utids) return [];
    return [...allUTIDs.utids].sort((a: any, b: any) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [allUTIDs]);

  const sortedStoreAdminUtids = useMemo(() => {
    if (!storeAdminAudit?.utids) return [];
    return [...storeAdminAudit.utids].sort((a: any, b: any) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [storeAdminAudit]);

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
        <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setAdminInboxOpen(true);
              const inbox = document.getElementById("admin-inbox");
              if (inbox) {
                inbox.scrollIntoView({ behavior: "smooth" });
              }
            }}
            style={{
              padding: "0.6rem 1rem",
              background: "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "0.9rem",
            }}
          >
            📬 Inbox {inboxUnreadCount > 0 ? `(${inboxUnreadCount})` : ""}
          </button>
          <span style={{ fontSize: "0.85rem", color: "#2e7d32", fontWeight: "600" }}>
            ● Live
          </span>
        </div>
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
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                {utidRangeOptions.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.85rem", color: "#666" }}>Range:</span>
                    <select
                      value={utidPageOffset}
                      onChange={(e) => setUtidPageOffset(Number(e.target.value))}
                      style={{
                        padding: "0.35rem 0.5rem",
                        border: "1px solid #ddd",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                        background: "#fff",
                      }}
                    >
                      {utidRangeOptions.map((range) => (
                        <option key={range.offset} value={range.offset}>
                          {range.start}-{range.end}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.85rem", color: "#666" }}>Page size:</span>
                  <select
                    value={utidPageSize}
                    onChange={(e) => {
                      setUtidPageSize(Number(e.target.value));
                      setUtidPageOffset(0);
                    }}
                    style={{
                      padding: "0.35rem 0.5rem",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "0.85rem",
                      background: "#fff",
                    }}
                  >
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                </div>
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
              {sortedAllUtids.map((utidData: any, index: number) => (
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <p style={{ color: "#666", fontSize: "0.85rem", margin: 0 }}>
                  Showing {allUTIDs.utids.length === 0 ? 0 : utidPageOffset + 1}-{utidPageOffset + allUTIDs.utids.length} of {allUTIDs.totalUTIDs || 0}
                </p>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => setUtidPageOffset(Math.max(0, utidPageOffset - utidPageSize))}
                    disabled={utidPageOffset === 0}
                    style={{
                      padding: "0.4rem 0.75rem",
                      background: utidPageOffset === 0 ? "#e0e0e0" : "#f5f5f5",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      cursor: utidPageOffset === 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => {
                      if (allUTIDs.nextOffset !== null && allUTIDs.nextOffset !== undefined) {
                        setUtidPageOffset(allUTIDs.nextOffset);
                      }
                    }}
                    disabled={allUTIDs.nextOffset === null || allUTIDs.nextOffset === undefined}
                    style={{
                      padding: "0.4rem 0.75rem",
                      background: allUTIDs.nextOffset === null || allUTIDs.nextOffset === undefined ? "#e0e0e0" : "#f5f5f5",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      cursor: allUTIDs.nextOffset === null || allUTIDs.nextOffset === undefined ? "not-allowed" : "pointer",
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delivery Confirmations (SuperAdmin only) */}
      {isSuperAdmin && (
        <div
          id="superadmin-inbox"
          style={{
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
            Delivery Confirmations (StoreAdmin)
          </h3>

          {storeAdmins === undefined ? (
            <p style={{ color: "#999" }}>Loading StoreAdmins...</p>
          ) : storeAdmins.length === 0 ? (
            <p style={{ color: "#666" }}>No StoreAdmins found.</p>
          ) : (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                Select StoreAdmin
              </label>
              <select
                value={selectedStoreAdminId || ""}
                onChange={(e) => {
                  const next = e.target.value || "";
                  setSelectedStoreAdminId(next ? (next as Id<"users">) : null);
                  setSelectedDeliveryUtid(null);
                }}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "0.95rem",
                  background: "#fff",
                }}
              >
                <option value="">-- Select StoreAdmin --</option>
                {storeAdmins.map((admin: any) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.alias} — {formatStoreAdminLocations(admin)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {storeAdminAudit === undefined ? (
            <p style={{ color: "#999" }}>Select a StoreAdmin to view confirmations.</p>
          ) : storeAdminAudit.utids.length === 0 ? (
            <p style={{ color: "#666" }}>No delivery confirmations recorded yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {sortedStoreAdminUtids.map((item: any) => (
                <div
                  key={item.utid}
                  style={{
                    padding: "1rem",
                    background: "#f8f9fa",
                    borderRadius: "8px",
                    border: "1px solid #e0e0e0",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <div style={{ fontWeight: "600" }}>UTID: {item.targetUtid}</div>
                    <span style={{
                      padding: "0.25rem 0.75rem",
                      borderRadius: "12px",
                      fontSize: "0.8rem",
                      fontWeight: "600",
                      background: "#4caf50",
                      color: "white",
                    }}>
                      DELIVERED
                    </span>
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>
                    Verified by: {storeAdminAudit.storeAdminAlias}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>
                    Verified at: {formatUgandaDateTime(item.timestamp)}
                  </div>
                  {item.metadata?.comment && (
                    <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>
                      Comment: {item.metadata.comment}
                    </div>
                  )}
                  <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
                    Photos: {item.metadata?.photoCount || 0}
                  </div>
                  {item.metadata?.photoCount > 0 && (
                    <button
                      onClick={() => setSelectedDeliveryUtid(item.targetUtid)}
                      style={{
                        padding: "0.5rem 1rem",
                        background: "#1976d2",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                      }}
                    >
                      View Photos
                    </button>
                  )}
                  {selectedDeliveryUtid === item.targetUtid && deliveryProof && (
                    <div style={{ marginTop: "0.75rem" }}>
                      {deliveryProof.deliveryPhotos && deliveryProof.deliveryPhotos.length > 0 ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.5rem" }}>
                          {deliveryProof.deliveryPhotos.map((photo: string, idx: number) => (
                            <Image
                              key={`${item.targetUtid}-${idx}`}
                              src={photo}
                              alt={`Delivery photo ${idx + 1}`}
                              width={400}
                              height={300}
                              unoptimized
                              style={{ width: "100%", height: "auto", borderRadius: "6px", border: "1px solid #ddd" }}
                            />
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: "0.85rem", color: "#666" }}>No photos provided.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admin Inbox */}
      {adminInboxOpen && (
        <div
          id="admin-inbox"
          ref={inboxRef}
          style={{
            marginBottom: "2rem",
            padding: "clamp(1rem, 3vw, 1.5rem)",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            overflowX: "hidden"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "clamp(0.5rem, 2vw, 1rem)", flexWrap: "wrap", gap: "0.5rem" }}>
              <h3 style={{
                marginTop: 0,
                marginBottom: 0,
                fontSize: "clamp(1.1rem, 3vw, 1.3rem)",
                wordWrap: "break-word",
                color: "#2c2c2c",
                fontFamily: '"Montserrat", sans-serif',
                fontWeight: "600",
                letterSpacing: "-0.01em"
              }}>
                Admin Inbox
              </h3>
              <button
                type="button"
                onClick={() => setAdminInboxOpen(false)}
                style={{
                  padding: "0.25rem 0.6rem",
                  background: "#f5f5f5",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  fontWeight: "600",
                }}
              >
                x
              </button>
            </div>
            {inboxThreads === undefined ? (
              <p style={{ color: "#999" }}>Loading message threads...</p>
            ) : inboxThreads.length === 0 ? (
              <p style={{ color: "#666" }}>No messages yet.</p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isInboxNarrow ? "1fr" : "minmax(220px, 1fr) 2fr",
                  gap: "1rem",
                  width: "100%",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                  overflowX: "hidden",
                }}
              >
                <div style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  overflow: "hidden",
                  maxHeight: isInboxNarrow ? "260px" : "500px",
                  overflowY: "auto",
                  width: "100%",
                  minWidth: 0,
                }}>
                  {inboxThreads.map((thread: any) => {
                    const isSelected = selectedMessageUtid === thread.utid;
                    const contact = thread.otherUserEmail || thread.otherUserPhoneNumber;
                    const isSupport = thread.utid === SUPPORT_THREAD;
                    const title = isSupport
                      ? `Support Inbox${isSuperAdmin ? ` — ${thread.otherUserAlias}${contact ? ` (${contact})` : ""}` : ""}`
                      : isSuperAdmin
                        ? `${thread.otherUserAlias}${contact ? ` (${contact})` : ""}`
                        : "Conversation";
                    return (
                      <button
                        key={thread.utid}
                        onClick={() => setSelectedMessageUtid(thread.utid)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "0.75rem",
                          border: "none",
                          borderBottom: "1px solid #e0e0e0",
                          background: isSelected ? "#e3f2fd" : "#fff",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: "600", color: "#2c2c2c" }}>
                          {title}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.25rem" }}>
                          {isSupport ? "Thread: Support" : `UTID: ${thread.utid}`}
                        </div>
                        {thread.lastMessage && (
                          <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.25rem" }}>
                            {thread.lastMessage}
                          </div>
                        )}
                        {thread.unreadCount > 0 && (
                          <div style={{ marginTop: "0.35rem", fontSize: "0.75rem", color: "#d32f2f", fontWeight: "600" }}>
                            {thread.unreadCount} unread
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div style={{ width: "100%", minWidth: 0 }}>
                  {selectedMessageUtid ? (
                    <ThreadView userId={userId} utid={selectedMessageUtid} />
                  ) : (
                    <div style={{
                      padding: "2rem",
                      border: "1px dashed #ddd",
                      borderRadius: "8px",
                      textAlign: "center",
                      color: "#666"
                    }}>
                      Select a thread to view messages.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      {canViewCommunityDatabase && (
        <div
          style={{
            marginBottom: "2rem",
            padding: "clamp(1rem, 3vw, 1.5rem)",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            overflowX: "hidden",
          }}
        >
          <h3 style={{
            marginTop: 0,
            marginBottom: "1rem",
            fontSize: "clamp(1.1rem, 3vw, 1.3rem)",
            color: "#2c2c2c",
            fontFamily: '"Montserrat", sans-serif',
            fontWeight: "600",
            letterSpacing: "-0.01em",
          }}>
            Community Members Database
          </h3>
          {communitySummaries === undefined ? (
            <p style={{ color: "#999" }}>Loading communities...</p>
          ) : communitySummaries.length === 0 ? (
            <p style={{ color: "#666" }}>No communities yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "1rem" }}>
              {communitySummaries.map((community: any) => {
                const members = community.members || [];
                const nonMembers = community.nonMembers || [];
                const formatContact = (person: any) => {
                  const contact = person?.email || person?.phoneNumber;
                  return contact ? `${person.alias} (${contact})` : person.alias;
                };
                return (
                  <div
                    key={community.id}
                    style={{
                      padding: "1rem",
                      borderRadius: "10px",
                      border: "1px solid #e0e0e0",
                      background: "#fafafa",
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", marginBottom: "0.75rem" }}>
                      <div style={{ fontWeight: "700", color: "#2c2c2c" }}>{community.name}</div>
                      <div style={{ fontSize: "0.85rem", color: "#666" }}>{community.memberCount} member(s)</div>
                      <div style={{ fontSize: "0.85rem", color: "#666" }}>{nonMembers.length} not yet joined</div>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: isInboxNarrow ? "1fr" : "1fr 1fr",
                        gap: "1rem",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#2c2c2c", marginBottom: "0.4rem" }}>
                          Members
                        </div>
                        <div style={{
                          maxHeight: "180px",
                          overflowY: "auto",
                          border: "1px solid #e0e0e0",
                          borderRadius: "8px",
                          padding: "0.5rem",
                          background: "#fff",
                        }}>
                          {members.length === 0 ? (
                            <div style={{ fontSize: "0.85rem", color: "#777" }}>No members yet.</div>
                          ) : (
                            members.map((member: any) => (
                              <div
                                key={member.userId}
                                style={{ padding: "0.35rem 0.5rem", borderRadius: "6px", fontSize: "0.85rem", color: "#444" }}
                              >
                                {formatContact(member)}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#2c2c2c", marginBottom: "0.4rem" }}>
                          Not Yet Joined
                        </div>
                        <div style={{
                          maxHeight: "180px",
                          overflowY: "auto",
                          border: "1px solid #e0e0e0",
                          borderRadius: "8px",
                          padding: "0.5rem",
                          background: "#fff",
                        }}>
                          {nonMembers.length === 0 ? (
                            <div style={{ fontSize: "0.85rem", color: "#777" }}>All farmers are members.</div>
                          ) : (
                            nonMembers.map((person: any) => (
                              <div
                                key={person.userId}
                                style={{ padding: "0.35rem 0.5rem", borderRadius: "6px", fontSize: "0.85rem", color: "#444" }}
                              >
                                {formatContact(person)}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
            {timelineRangeOptions.length > 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
                <label style={{ fontSize: "0.85rem", color: "#666", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  Range:
                  <select
                    value={timelineOffset}
                    onChange={(e) => setTimelineOffset(Number(e.target.value))}
                    style={{
                      padding: "0.35rem 0.5rem",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "0.85rem",
                      background: "#fff",
                    }}
                  >
                    {timelineRangeOptions.map((range) => (
                      <option key={range.offset} value={range.offset}>
                        {range.start}-{range.end}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {sortedAllUtids.slice(timelineOffset, timelineOffset + timelinePageSize).map((utidData: any, index: number) => {
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
            {timelineTotal > 0 && (
              <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.5rem" }}>
                Showing {timelineTotal === 0 ? 0 : timelineOffset + 1}-{Math.min(timelineOffset + timelinePageSize, timelineTotal)} of {timelineTotal}
              </div>
            )}
          </div>
        )}
        <div style={{ marginTop: "1.5rem", paddingTop: "1.5rem", borderTop: "2px solid #e0e0e0" }}>
          <h4 style={{ marginBottom: "1rem", fontSize: "1.1rem", color: "#1a1a1a" }}>
            Confirm Delivery to Storage by UTID
          </h4>
          {pendingDeliveryUTIDs === undefined ? (
            <p style={{ color: "#999" }}>Loading UTIDs...</p>
          ) : (
          <DeliveryConfirmationForm
            deliveryUTIDs={pendingDeliveryUTIDs}
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
            storageLocations={storageLocations}
            adminId={userId}
            isSuperAdmin={isSuperAdmin}
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
            isSuperAdmin={isSuperAdmin}
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
            isSuperAdmin={isSuperAdmin}
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
            isSuperAdmin={isSuperAdmin}
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
              marginRight: "0.5rem",
            }}
          >
            Seed Demo Data →
          </a>
          <a
            href="/admin/seed-locations"
            style={{
              display: "inline-block",
              marginTop: "0.5rem",
              padding: "0.5rem 1rem",
              background: "#4CAF50",
              color: "#fff",
              textDecoration: "none",
              borderRadius: "6px",
              fontSize: "0.9rem",
              fontWeight: "600",
            }}
          >
            Seed Uganda Locations →
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
  const [adminCategory, setAdminCategory] = useState<"store" | "message" | "community" | "">("");
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
    if (adminLevel === "junior" && !adminCategory) {
      setMessage({ type: "error", text: "Please select admin category for junior admin" });
      return;
    }
    if (adminLevel === "junior" && adminCategory === "store" && selectedLocationIds.length === 0) {
      setMessage({ type: "error", text: "Store admins must have at least one assigned storage location" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await createUser({
        email: email.trim(),
        role: "admin",
        adminLevel: adminLevel,
        adminCategory: adminLevel === "junior" ? adminCategory : undefined,
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
      setAdminCategory("");
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
              setAdminCategory("");
            }
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

      {adminLevel === "junior" && (
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
            Admin Category:
          </label>
          <select
            value={adminCategory}
            onChange={(e) => setAdminCategory(e.target.value as "store" | "message" | "community" | "")}
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
            <option value="">Select admin category...</option>
            <option value="store">Store Admin (Delivery Confirmations)</option>
            <option value="message">Message Admin (Inbox Support)</option>
            <option value="community">Community Admin (Members Database)</option>
          </select>
        </div>
      )}

      {adminLevel === "junior" && adminCategory === "store" && storageLocations && (
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
function NotificationForm({
  allUsers,
  sendNotification,
  sendRoleBasedNotification,
  adminId,
  isSuperAdmin,
}: {
  allUsers: any[];
  sendNotification: any;
  sendRoleBasedNotification: any;
  adminId: Id<"users">;
  isSuperAdmin: boolean;
}) {
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
                {users.map((user: any) => {
                  const contact = user.email || user.phoneNumber;
                  const label = isSuperAdmin && contact ? `${user.alias} (${contact})` : user.alias;
                  return (
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
                    <span>{label}</span>
                  </label>
                );
                })}
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
  adminId,
  isSuperAdmin,
}: { 
  allUsers: any[]; 
  adminDepositDemoFunds: any; 
  adminId: Id<"users">;
  isSuperAdmin: boolean;
}) {
  const [selectedUserIds, setSelectedUserIds] = useState<Id<"users">[]>([]);
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [depositResults, setDepositResults] = useState<Array<{userId: Id<"users">, success: boolean, message: string}>>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<"traders" | "buyers" | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "firstTimers">("firstTimers"); // Default to first-timers only
  const formatContactLabel = (user?: { alias?: string; email?: string; phoneNumber?: string }) => {
    const contact = user?.email || user?.phoneNumber;
    if (isSuperAdmin && contact) {
      return `${user?.alias || "Unknown"} (${contact})`;
    }
    return user?.alias || "Unknown";
  };

  // Query users with demo fund status
  const usersWithStatus = useQuery(api.admin.getUsersWithDemoFundStatus, { adminId });

  // Separate traders and buyers
  const allTraders = usersWithStatus?.traders || [];
  const allBuyers = usersWithStatus?.buyers || [];

  // Filter based on mode
  const traders = filterMode === "firstTimers" 
    ? allTraders.filter(t => !t.demoFundStatus?.hasDemoFunds)
    : allTraders;
  
  const buyers = filterMode === "firstTimers"
    ? allBuyers.filter(b => !b.demoFundStatus?.hasDemoFunds)
    : allBuyers;

  const handleDeposit = async () => {
    if (selectedUserIds.length === 0) {
      setMessage({ type: "error", text: "Please select at least one user" });
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
    setDepositResults([]);

    const results: Array<{userId: Id<"users">, success: boolean, message: string}> = [];
    const depositAmount = parseFloat(amount);

    // Process deposits for each selected user
    for (const userId of selectedUserIds) {
      try {
        const result = await adminDepositDemoFunds({
          adminId,
          targetUserId: userId,
          amount: depositAmount,
          reason: reason.trim(),
        });

        const allUsersList = [...allTraders, ...allBuyers];
        const user = allUsersList.find(u => u._id === userId);
        results.push({
          userId,
          success: true,
          message: `✓ ${formatContactLabel(user)}: Deposited ${depositAmount.toLocaleString()} UGX. New balance: ${result.newBalance.toLocaleString()} UGX. UTID: ${result.utid}`
        });
      } catch (error: any) {
        const allUsersList = [...allTraders, ...allBuyers];
        const user = allUsersList.find(u => u._id === userId);
        results.push({
          userId,
          success: false,
          message: `✗ ${formatContactLabel(user)}: ${error.message || "Failed to deposit funds"}`
        });
      }
    }

    setDepositResults(results);
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    if (failCount === 0) {
      setMessage({ 
        type: "success", 
        text: `Successfully deposited ${depositAmount.toLocaleString()} UGX to ${successCount} user(s).` 
      });
      
      // Auto-deselect successful deposits and refresh filter
      setSelectedUserIds([]);
      setAmount("");
      setReason("");
    } else {
      setMessage({ 
        type: "error", 
        text: `Deposited to ${successCount} user(s), failed for ${failCount} user(s). See details below.` 
      });
    }
    
    setLoading(false);
  };

  const handleUserSelection = (userId: Id<"users">, checked: boolean) => {
    if (checked) {
      setSelectedUserIds(prev => [...prev, userId]);
    } else {
      setSelectedUserIds(prev => prev.filter(id => id !== userId));
    }
  };

  const selectAllFirstTimers = () => {
    const firstTimerIds = [...traders.map(t => t._id), ...buyers.map(b => b._id)];
    setSelectedUserIds(firstTimerIds);
  };

  const selectAllTraders = () => {
    const traderIds = traders.map(t => t._id);
    setSelectedUserIds(prev => {
      const newIds = [...prev];
      traderIds.forEach(id => {
        if (!newIds.includes(id)) newIds.push(id);
      });
      return newIds;
    });
  };

  const deselectAllTraders = () => {
    const traderIds = traders.map(t => t._id);
    setSelectedUserIds(prev => prev.filter(id => !traderIds.includes(id)));
  };

  const selectAllBuyers = () => {
    const buyerIds = buyers.map(b => b._id);
    setSelectedUserIds(prev => {
      const newIds = [...prev];
      buyerIds.forEach(id => {
        if (!newIds.includes(id)) newIds.push(id);
      });
      return newIds;
    });
  };

  const deselectAllBuyers = () => {
    const buyerIds = buyers.map(b => b._id);
    setSelectedUserIds(prev => prev.filter(id => !buyerIds.includes(id)));
  };

  const deselectAll = () => {
    setSelectedUserIds([]);
  };

  const getSelectedUsersText = () => {
    if (selectedUserIds.length === 0) return "Select users...";
    const traderCount = selectedUserIds.filter(id => allTraders.some(t => t._id === id)).length;
    const buyerCount = selectedUserIds.filter(id => allBuyers.some(b => b._id === id)).length;
    
    const parts = [];
    if (traderCount > 0) parts.push(`${traderCount} trader${traderCount > 1 ? 's' : ''}`);
    if (buyerCount > 0) parts.push(`${buyerCount} buyer${buyerCount > 1 ? 's' : ''}`);
    
    return parts.join(", ") || `${selectedUserIds.length} user(s) selected`;
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleDateString();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (dropdownOpen && !target.closest('[data-dropdown-container]')) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  if (!usersWithStatus) {
    return <div style={{ padding: "1rem", color: "#666" }}>Loading users...</div>;
  }

  const firstTimerTradersCount = allTraders.filter(t => !t.demoFundStatus?.hasDemoFunds).length;
  const firstTimerBuyersCount = allBuyers.filter(b => !b.demoFundStatus?.hasDemoFunds).length;

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

      {/* Filter Toggle */}
      <div style={{ 
        marginBottom: "1rem", 
        padding: "0.75rem",
        backgroundColor: "#f8f9fa",
        borderRadius: "6px",
        border: "1px solid #dee2e6"
      }}>
        <label style={{ 
          display: "block", 
          marginBottom: "0.5rem", 
          fontWeight: "600",
          color: "#444",
          fontSize: "0.9rem"
        }}>
          Filter Users:
        </label>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <label style={{ 
            display: "flex", 
            alignItems: "center", 
            cursor: "pointer",
            fontSize: "0.9rem"
          }}>
            <input
              type="radio"
              name="filterMode"
              value="firstTimers"
              checked={filterMode === "firstTimers"}
              onChange={(e) => {
                setFilterMode("firstTimers");
                setSelectedUserIds([]); // Clear selection when changing filter
              }}
              style={{ marginRight: "0.5rem" }}
            />
            <span>
              First-Timers Only 
              <span style={{ 
                marginLeft: "0.5rem",
                padding: "0.15rem 0.4rem",
                backgroundColor: "#fff3cd",
                color: "#856404",
                borderRadius: "12px",
                fontSize: "0.75rem",
                fontWeight: "600"
              }}>
                {firstTimerTradersCount + firstTimerBuyersCount} users
              </span>
            </span>
          </label>
          <label style={{ 
            display: "flex", 
            alignItems: "center", 
            cursor: "pointer",
            fontSize: "0.9rem"
          }}>
            <input
              type="radio"
              name="filterMode"
              value="all"
              checked={filterMode === "all"}
              onChange={(e) => {
                setFilterMode("all");
                setSelectedUserIds([]); // Clear selection when changing filter
              }}
              style={{ marginRight: "0.5rem" }}
            />
            <span>All Users ({allTraders.length + allBuyers.length})</span>
          </label>
        </div>
        {filterMode === "firstTimers" && (
          <div style={{ 
            marginTop: "0.5rem", 
            padding: "0.5rem",
            backgroundColor: "#fff3cd",
            borderRadius: "4px",
            fontSize: "0.85rem",
            color: "#856404"
          }}>
            💡 Showing only users who have <strong>never received demo funds</strong>. Perfect for onboarding new signups!
          </div>
        )}
      </div>

      <div style={{ marginBottom: "1rem", position: "relative" }} data-dropdown-container>
        <label style={{ 
          display: "block", 
          marginBottom: "0.5rem", 
          fontWeight: "500",
          color: "#444" 
        }}>
          Select Users:
        </label>
        
        {/* Dropdown Button */}
        <div
          onClick={() => !loading && setDropdownOpen(!dropdownOpen)}
          style={{
            width: "100%",
            padding: "0.5rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "0.9rem",
            backgroundColor: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            minHeight: "38px",
            boxSizing: "border-box"
          }}
        >
          <span style={{ 
            color: selectedUserIds.length === 0 ? "#999" : "#333",
            flex: 1,
            textAlign: "left"
          }}>
            {getSelectedUsersText()}
          </span>
          <span style={{ 
            fontSize: "0.8rem",
            color: "#666",
            marginLeft: "0.5rem"
          }}>
            {dropdownOpen ? "▲" : "▼"}
          </span>
        </div>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "0.25rem",
            backgroundColor: "#fff",
            border: "1px solid #ddd",
            borderRadius: "6px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            zIndex: 1000,
            maxHeight: "400px",
            overflowY: "auto"
          }}>
            {/* Quick Select First-Timers Button */}
            {filterMode === "firstTimers" && traders.length + buyers.length > 0 && (
              <div style={{
                padding: "0.75rem",
                borderBottom: "2px solid #ffc107",
                backgroundColor: "#fff3cd",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div>
                  <strong style={{ fontSize: "0.9rem", color: "#856404" }}>
                    🎯 Quick Batch: Select All First-Timers
                  </strong>
                  <div style={{ fontSize: "0.75rem", color: "#856404", marginTop: "0.25rem" }}>
                    {traders.length} traders + {buyers.length} buyers = {traders.length + buyers.length} total
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectAllFirstTimers();
                  }}
                  style={{
                    padding: "0.5rem 1rem",
                    background: "#ffc107",
                    color: "#000",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    fontWeight: "600"
                  }}
                >
                  Select All
                </button>
              </div>
            )}

            {/* Global Deselect All */}
            {selectedUserIds.length > 0 && (
              <div style={{
                padding: "0.5rem",
                borderBottom: "1px solid #eee",
                display: "flex",
                justifyContent: "flex-end",
                backgroundColor: "#f8f9fa"
              }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deselectAll();
                  }}
                  style={{
                    padding: "0.25rem 0.5rem",
                    background: "#6c757d",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    fontWeight: "500"
                  }}
                >
                  Deselect All
                </button>
              </div>
            )}

            {/* TRADERS SECTION */}
            {traders.length > 0 && (
              <div style={{
                borderBottom: "2px solid #e0e0e0",
                backgroundColor: "#f0f7ff"
              }}>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedCategory(expandedCategory === "traders" ? null : "traders");
                  }}
                  style={{
                    padding: "0.75rem",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontWeight: "600",
                    color: "#1976d2",
                    borderBottom: expandedCategory === "traders" ? "1px solid #e0e0e0" : "none"
                  }}
                >
                  <span>
                    👔 Traders ({traders.length}) - {selectedUserIds.filter(id => traders.some(t => t._id === id)).length} selected
                  </span>
                  <span style={{ fontSize: "0.8rem" }}>
                    {expandedCategory === "traders" ? "▼" : "▶"}
                  </span>
                </div>
                
                {expandedCategory === "traders" && (
                  <>
                    <div style={{
                      padding: "0.5rem",
                      display: "flex",
                      gap: "0.5rem",
                      backgroundColor: "#e3f2fd",
                      borderBottom: "1px solid #ddd"
                    }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectAllTraders();
                        }}
                        style={{
                          padding: "0.25rem 0.5rem",
                          background: "#1976d2",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          cursor: "pointer"
                        }}
                      >
                        Select All Traders
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deselectAllTraders();
                        }}
                        style={{
                          padding: "0.25rem 0.5rem",
                          background: "#6c757d",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          cursor: "pointer"
                        }}
                      >
                        Deselect All Traders
                      </button>
                    </div>
                    
                    {traders.map((trader) => {
                      const hasDemoFunds = trader.demoFundStatus?.hasDemoFunds || false;
                      const isSelected = selectedUserIds.includes(trader._id);
                      const isFirstTimer = !hasDemoFunds;
                      
                      return (
                        <label
                          key={trader._id}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            padding: "0.75rem",
                            cursor: "pointer",
                            borderBottom: "1px solid #f0f0f0",
                            backgroundColor: isSelected ? "#e3f2fd" : "transparent",
                            transition: "background-color 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = "#f5f5f5";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleUserSelection(trader._id, e.target.checked)}
                            disabled={loading}
                            style={{
                              marginRight: "0.75rem",
                              cursor: loading ? "not-allowed" : "pointer",
                              width: "18px",
                              height: "18px"
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "0.9rem", fontWeight: "500", color: "#333" }}>
                                {formatContactLabel(trader)}
                              </span>
                              {isFirstTimer ? (
                                <span style={{
                                  fontSize: "0.7rem",
                                  padding: "0.15rem 0.4rem",
                                  backgroundColor: "#fff3cd",
                                  color: "#856404",
                                  borderRadius: "12px",
                                  fontWeight: "600"
                                }}>
                                  🆕 First-Timer
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: "0.7rem",
                                  padding: "0.15rem 0.4rem",
                                  backgroundColor: "#d4edda",
                                  color: "#155724",
                                  borderRadius: "12px",
                                  fontWeight: "600"
                                }}>
                                  ✓ Has Demo Funds
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.25rem" }}>
                              {trader.alias} • Balance: {trader.demoFundStatus?.currentBalance?.toLocaleString() || 0} UGX
                              {!isFirstTimer && trader.demoFundStatus?.lastDemoDepositDate && (
                                <span> • Last: {formatDate(trader.demoFundStatus.lastDemoDepositDate)}</span>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {/* BUYERS SECTION */}
            {buyers.length > 0 && (
              <div style={{
                backgroundColor: "#fff5f0"
              }}>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedCategory(expandedCategory === "buyers" ? null : "buyers");
                  }}
                  style={{
                    padding: "0.75rem",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontWeight: "600",
                    color: "#d32f2f",
                    borderTop: traders.length > 0 ? "2px solid #e0e0e0" : "none"
                  }}
                >
                  <span>
                    🛒 Buyers ({buyers.length}) - {selectedUserIds.filter(id => buyers.some(b => b._id === id)).length} selected
                  </span>
                  <span style={{ fontSize: "0.8rem" }}>
                    {expandedCategory === "buyers" ? "▼" : "▶"}
                  </span>
                </div>
                
                {expandedCategory === "buyers" && (
                  <>
                    <div style={{
                      padding: "0.5rem",
                      display: "flex",
                      gap: "0.5rem",
                      backgroundColor: "#ffe0e0",
                      borderBottom: "1px solid #ddd"
                    }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectAllBuyers();
                        }}
                        style={{
                          padding: "0.25rem 0.5rem",
                          background: "#d32f2f",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          cursor: "pointer"
                        }}
                      >
                        Select All Buyers
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deselectAllBuyers();
                        }}
                        style={{
                          padding: "0.25rem 0.5rem",
                          background: "#6c757d",
                          color: "#fff",
                          border: "none",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          cursor: "pointer"
                        }}
                      >
                        Deselect All Buyers
                      </button>
                    </div>
                    
                    {buyers.map((buyer) => {
                      const hasDemoFunds = buyer.demoFundStatus?.hasDemoFunds || false;
                      const isSelected = selectedUserIds.includes(buyer._id);
                      const isFirstTimer = !hasDemoFunds;
                      
                      return (
                        <label
                          key={buyer._id}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            padding: "0.75rem",
                            cursor: "pointer",
                            borderBottom: "1px solid #f0f0f0",
                            backgroundColor: isSelected ? "#ffe0e0" : "transparent",
                            transition: "background-color 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = "#f5f5f5";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleUserSelection(buyer._id, e.target.checked)}
                            disabled={loading}
                            style={{
                              marginRight: "0.75rem",
                              cursor: loading ? "not-allowed" : "pointer",
                              width: "18px",
                              height: "18px"
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "0.9rem", fontWeight: "500", color: "#333" }}>
                                {formatContactLabel(buyer)}
                              </span>
                              {isFirstTimer ? (
                                <span style={{
                                  fontSize: "0.7rem",
                                  padding: "0.15rem 0.4rem",
                                  backgroundColor: "#fff3cd",
                                  color: "#856404",
                                  borderRadius: "12px",
                                  fontWeight: "600"
                                }}>
                                  🆕 First-Timer
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: "0.7rem",
                                  padding: "0.15rem 0.4rem",
                                  backgroundColor: "#d4edda",
                                  color: "#155724",
                                  borderRadius: "12px",
                                  fontWeight: "600"
                                }}>
                                  ✓ Has Demo Funds
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.25rem" }}>
                              {buyer.alias} • Balance: {buyer.demoFundStatus?.currentBalance?.toLocaleString() || 0} UGX
                              {!isFirstTimer && buyer.demoFundStatus?.lastDemoDepositDate && (
                                <span> • Last: {formatDate(buyer.demoFundStatus.lastDemoDepositDate)}</span>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {/* Empty State */}
            {traders.length === 0 && buyers.length === 0 && (
              <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
                {filterMode === "firstTimers" 
                  ? "🎉 All users have received demo funds! No first-timers remaining."
                  : "No users available"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Users Summary */}
      {!dropdownOpen && selectedUserIds.length > 0 && (
        <div style={{
          marginBottom: "1rem",
          padding: "0.5rem",
          backgroundColor: "#e3f2fd",
          borderRadius: "6px",
          fontSize: "0.85rem",
          color: "#1565c0"
        }}>
          <strong>Selected:</strong> {getSelectedUsersText()}
        </div>
      )}

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
          placeholder="Enter reason (e.g., 'Welcome demo funds for new signups')"
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

      {depositResults.length > 0 && (
        <div style={{
          marginBottom: "1rem",
          padding: "0.75rem",
          backgroundColor: "#f8f9fa",
          borderRadius: "6px",
          border: "1px solid #dee2e6",
          maxHeight: "200px",
          overflowY: "auto"
        }}>
          <strong style={{ fontSize: "0.9rem", marginBottom: "0.5rem", display: "block" }}>Deposit Results:</strong>
          {depositResults.map((result, index) => (
            <div
              key={index}
              style={{
                padding: "0.5rem",
                marginBottom: "0.25rem",
                fontSize: "0.85rem",
                color: result.success ? "#155724" : "#721c24",
                backgroundColor: result.success ? "#d4edda" : "#f8d7da",
                borderRadius: "4px"
              }}
            >
              {result.message}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleDeposit}
        disabled={loading || selectedUserIds.length === 0 || !amount || !reason.trim()}
        style={{
          backgroundColor: loading || selectedUserIds.length === 0 || !amount || !reason.trim() ? "#ccc" : "#007bff",
          color: "#fff",
          padding: "0.75rem 1.5rem",
          border: "none",
          borderRadius: "6px",
          fontSize: "0.9rem",
          fontWeight: "600",
          cursor: loading || selectedUserIds.length === 0 || !amount || !reason.trim() ? "not-allowed" : "pointer"
        }}
      >
        {loading ? `Depositing to ${selectedUserIds.length} user(s)...` : `Deposit Demo Funds to ${selectedUserIds.length} User(s)`}
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
  adminId,
  isSuperAdmin
}: { 
  qualityOptions: any[]; 
  addQualityOption: any; 
  updateQualityOption: any; 
  deleteQualityOption: any; 
  adminId: Id<"users">;
  isSuperAdmin: boolean;
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
  const [deletedOptionIds, setDeletedOptionIds] = useState<Set<string>>(new Set());

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

    // Optimistically remove from UI
    setDeletedOptionIds(prev => new Set(prev).add(optionId));
    setDeletingId(null);
    setDeleteReason("");

    try {
      const result = await deleteQualityOption({
        adminId,
        optionId: optionId as Id<"qualityOptions">,
        reason: deleteReason.trim(),
      });
      alert(`Quality option deleted successfully! UTID: ${result.utid}`);
      // Keep it removed - query will refetch and confirm
    } catch (error: any) {
      // Revert optimistic update on error
      setDeletedOptionIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(optionId);
        return newSet;
      });
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
            {qualityOptions.filter((option) => !deletedOptionIds.has(option.optionId)).map((option) => (
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

      {/* Contact Us Section - Hidden for super admin */}
      {!isSuperAdmin && (
        <div style={{ marginTop: "2rem" }}>
          <ContactUs isMobile={false} />
        </div>
      )}
    </div>
  );
}

// Produce Options Manager Component
function ProduceOptionsManager({ 
  produceOptions, 
  addProduceOption, 
  updateProduceOption, 
  deleteProduceOption, 
  storageLocations,
  adminId,
  isSuperAdmin
}: { 
  produceOptions: any[]; 
  addProduceOption: any; 
  updateProduceOption: any; 
  deleteProduceOption: any; 
  storageLocations: any;
  adminId: Id<"users">;
  isSuperAdmin: boolean;
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
  const [deletedProduceOptionIds, setDeletedProduceOptionIds] = useState<Set<string>>(new Set());
  const [newAllowedLocations, setNewAllowedLocations] = useState<string[]>([]);
  const [editingAllowedLocations, setEditingAllowedLocations] = useState<string[]>([]);

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
        allowedStorageLocationIds: newAllowedLocations.length > 0 
          ? newAllowedLocations.map(id => id as Id<"storageLocations">)
          : undefined,
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
        allowedStorageLocationIds: editingAllowedLocations.length > 0 
          ? editingAllowedLocations.map(id => id as Id<"storageLocations">)
          : undefined,
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

    // Optimistically remove from UI
    setDeletedProduceOptionIds(prev => new Set(prev).add(optionId));
    setDeletingId(null);
    setDeleteReason("");

    try {
      const result = await deleteProduceOption({
        adminId,
        optionId: optionId as Id<"produceOptions">,
        reason: deleteReason.trim(),
      });
      alert(`Produce option deleted successfully! UTID: ${result.utid}`);
      // Keep it removed - query will refetch and confirm
    } catch (error: any) {
      // Revert optimistic update on error
      setDeletedProduceOptionIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(optionId);
        return newSet;
      });
      alert(`Failed to delete option: ${error.message}`);
    }
  };

  const startEdit = (option: any) => {
    setEditingId(option.optionId);
    setEditLabel(option.label);
    setEditIcon(option.icon);
    setEditOrder(option.order.toString());
    setEditActive(option.active);
    setEditingAllowedLocations(option.allowedStorageLocationIds || []);
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
            {storageLocations && storageLocations.length > 0 && (
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: "600" }}>
                  Allowed Storage Locations (optional):
                </label>
                <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
                  Select which storage locations can accept this produce type. Leave empty to allow all locations.
                </p>
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", 
                  gap: "0.5rem",
                  maxHeight: "200px",
                  overflowY: "auto",
                  padding: "0.5rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  background: "#fff"
                }}>
                  {storageLocations.filter((loc: any) => loc.active).map((loc: any) => (
                    <label key={loc._id} style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "0.5rem",
                      cursor: "pointer",
                      fontSize: "0.9rem"
                    }}>
                      <input
                        type="checkbox"
                        checked={newAllowedLocations.includes(loc._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewAllowedLocations([...newAllowedLocations, loc._id]);
                          } else {
                            setNewAllowedLocations(newAllowedLocations.filter(id => id !== loc._id));
                          }
                        }}
                      />
                      <span>{loc.districtName} ({loc.code})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
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
                  setNewAllowedLocations([]);
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
            {produceOptions.filter((option) => !deletedProduceOptionIds.has(option.optionId)).map((option) => (
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
                    {storageLocations && storageLocations.length > 0 && (
                      <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: "600" }}>
                          Allowed Storage Locations:
                        </label>
                        <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
                          Select which storage locations can accept this produce type. Leave empty to allow all locations.
                        </p>
                        <div style={{ 
                          display: "grid", 
                          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", 
                          gap: "0.5rem",
                          maxHeight: "200px",
                          overflowY: "auto",
                          padding: "0.5rem",
                          border: "1px solid #ddd",
                          borderRadius: "6px",
                          background: "#fff"
                        }}>
                          {storageLocations.filter((loc: any) => loc.active).map((loc: any) => (
                            <label key={loc._id} style={{ 
                              display: "flex", 
                              alignItems: "center", 
                              gap: "0.5rem",
                              cursor: "pointer",
                              fontSize: "0.9rem"
                            }}>
                              <input
                                type="checkbox"
                                checked={editingAllowedLocations.includes(loc._id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditingAllowedLocations([...editingAllowedLocations, loc._id]);
                                  } else {
                                    setEditingAllowedLocations(editingAllowedLocations.filter(id => id !== loc._id));
                                  }
                                }}
                              />
                              <span>{loc.districtName} ({loc.code})</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
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
                          setEditingAllowedLocations([]);
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

      {/* Contact Us Section - Hidden for super admin */}
      {!isSuperAdmin && (
        <div style={{ marginTop: "2rem" }}>
          <ContactUs isMobile={false} />
        </div>
      )}
    </div>
  );
}
