// AdminDashboard.tsx
import React, { useState, useMemo, useEffect } from "react";
import { formatUgandaDate, formatUgandaDateTime, getUgandaTime } from "../utils/dateUtils";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { CreateAdminAccountForm } from "./CreateAdminAccountForm";

interface SuperAdminOnlyProps {
  show: boolean;
  children: React.ReactNode;
}

function SuperAdminOnly({ show, children }: SuperAdminOnlyProps) {
  if (!show) return null;
  return <>{children}</>;
}

interface AdminDashboardProps {
  userId: string;
}

const getSortTimestamp = (item: any) => {
  if (!item?.createdAt) return 0;
  const parsed = Date.parse(item.createdAt);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export function AdminDashboard({ userId }: AdminDashboardProps) {
  const [adminInboxOpen, setAdminInboxOpen] = useState(false);
  const [windowActionLoading, setWindowActionLoading] = useState(false);
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null); // Track which metric card is expanded

  const adminId = userId as Id<"users">;

  const user = useQuery(api.introspection.getUserById, { userId: adminId });
  const allUsers = useQuery(api.introspection.getAllUsers, { adminId });
  const purchaseWindowStatus = useQuery(api.admin.getPurchaseWindowStatus, { adminId });
  const allActiveUTIDs = useQuery(api.introspection.getAllActiveUTIDs, { adminId });
  const redFlagsData = useQuery(api.adminRedFlags.getDeliveriesPastSLA, { adminId }); // Using deliveries past SLA as red flags list
  const systemMetrics = useQuery(api.admin.getTodaySystemMetrics, { adminId });
  const deliveryConfirmationsData = useQuery(api.introspection.getPendingDeliveryUTIDs, { adminId });
  const storageLocations = useQuery(api.admin.getStorageLocations, { adminId });
  const communities = useQuery(api.introspection.getCommunities, { adminId });

  const openPurchaseWindow = useMutation(api.admin.openPurchaseWindow);
  const closePurchaseWindow = useMutation(api.admin.closePurchaseWindow);

  const isSuperAdmin = user?.role === "admin" && (user?.adminLevel === "super" || user?.adminLevel === undefined);
  const isCommunityAdmin = user?.role === "admin" && user?.adminLevel === "junior" && user?.adminCategory === "community";
  const canViewCommunities = isSuperAdmin || isCommunityAdmin;

  useEffect(() => {
    if (user?.role === "admin" && user?.adminLevel !== "super") {
      setAdminInboxOpen(false);
    }
  }, [user]);

  const toggleAdminInbox = () => {
    setAdminInboxOpen(!adminInboxOpen);
  };

  const usersByRole = useMemo(() =>
    allUsers
      ? {
          farmer: allUsers.filter((u: any) => u.role === "farmer"),
          trader: allUsers.filter((u: any) => u.role === "trader"),
          buyer: allUsers.filter((u: any) => u.role === "buyer"),
          admin: allUsers.filter((u: any) => u.role === "admin"),
        }
      : { farmer: [], trader: [], buyer: [], admin: [] },
    [allUsers],
  );

  const storageLocationsById = useMemo(() => {
    const map = new Map<string, any>();
    if (storageLocations) {
      storageLocations.forEach((location: any) => {
        map.set(location._id, location);
      });
    }
    return map;
  }, [storageLocations]);

  const sortedStoreAdminUtids = useMemo(() => {
    if (!allActiveUTIDs?.utids) return [];
    return [...allActiveUTIDs.utids].sort((a: any, b: any) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [allActiveUTIDs]);

  const handleExportFarmers = (format: "excel" | "pdf", type: "list" | "profiles" | "activities") => {
    const farmers = usersByRole.farmer;
    if (!farmers || farmers.length === 0) {
      alert("No farmer data available to export");
      return;
    }
    let data: any[] = [];
    if (type === "list") {
      data = farmers.map((f: any) => ({
        "Farmer ID": f._id,
        "Alias": f.alias,
        "Role": f.role,
        "Phone Number": f.phoneNumber,
        Email: f.email,
        "Date Joined": formatUgandaDate(f.createdAt),
      }));
    } else if (type === "profiles") {
      data = farmers.map((f: any) => ({
        "Farmer ID": f._id,
        "Alias": f.alias,
        "Role": f.role,
        "Phone Number": f.phoneNumber,
        Email: f.email,
        "Date Joined": formatUgandaDate(f.createdAt),
        "Last Updated": formatUgandaDateTime(f.updatedAt),
        "Account Status": f.accountStatus,
        "Verification Status": f.verificationStatus,
      }));
    } else if (type === "activities") {
      data = farmers.map((f: any) => ({
        "Farmer ID": f._id,
        "Alias": f.alias,
        "Role": f.role,
        "Phone Number": f.phoneNumber,
        Email: f.email,
        "Last Updated": formatUgandaDateTime(f.updatedAt),
        "Activities": "Placeholder", // TODO: Implement activities
      }));
    }
    const filename = `farmers_${type}_${formatUgandaDate(Date.now())}`;
    if (format === "excel") {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(data);
      worksheet["!cols"] = Object.keys(data[0] || {}).map(() => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(workbook, worksheet, "Farmers");
      XLSX.writeFile(workbook, `${filename}.xlsx`);
    } else {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("Farmer Members Report", doc.internal.pageSize.getWidth() / 2, 20, { align: "center" });
      doc.setFontSize(12);
      doc.text(`Type: ${type}`, doc.internal.pageSize.getWidth() / 2, 30, { align: "center" });
      doc.text(`Generated: ${formatUgandaDateTime(getUgandaTime())}`, doc.internal.pageSize.getWidth() / 2, 37, { align: "center" });
      doc.text(`Total Farmers: ${farmers.length}`, doc.internal.pageSize.getWidth() / 2, 44, { align: "center" });
      const tableData = data.map((row) => Object.values(row).map((v) => String(v)));
      autoTable(doc, {
        head: [Object.keys(data[0] || {})],
        body: tableData,
        startY: 50,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [25, 118, 210] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });
      doc.save(`${filename}.pdf`);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      {/* Community Dashboard - Community Admin & Super Admin */}
      {canViewCommunities && (
        <div style={{ marginBottom: "2rem", border: "1px solid #ccc", padding: "1rem" }}>
          <h3>Community Management</h3>
          {communities === undefined ? (
            <p style={{ color: "#999" }}>Loading...</p>
          ) : communities.length === 0 ? (
             <p>No communities found.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "1rem" }}>
              {communities.map((comm: any) => (
                <div key={comm._id} style={{ border: "1px solid #eee", padding: "1rem", borderRadius: "8px" }}>
                  <h4>{comm.name}</h4>
                  <p>{comm.description}</p>
                  <p>Type: {comm.isGlobal ? "Global" : "Geo-Locked"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admin Account Creation - Super Admin Only */}
      {isSuperAdmin && (
        <CreateAdminAccountForm adminId={adminId} />
      )}

      {/* Red Flags Summary - Superadmin Only */}
      <SuperAdminOnly show={isSuperAdmin}>
        <div style={{ marginBottom: "2rem" }}>
          <h3>Red Flags Summary</h3>
          {redFlagsData === undefined ? (
            <p style={{ color: "#999" }}>Loading...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {redFlagsData.deliveries.map((flag: any) => (
                <div key={flag.unitId} style={{ border: "1px solid #ccc", padding: "1rem" }}>
                  <p>
                    <b>Lock UTID:</b> {flag.lockUtid}
                  </p>
                  <p>
                    <b>Status:</b> {flag.deliveryStatus} (Overdue by {flag.hoursOverdue} hrs)
                  </p>
                  <p>
                    <b>Locked At:</b> {formatUgandaDateTime(flag.lockedAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </SuperAdminOnly>

      {/* System Metrics - Today's Listings - Superadmin Only */}
      <SuperAdminOnly show={isSuperAdmin}>
        <div style={{ marginBottom: "2rem" }}>
          <h3>System Metrics - Today's Listings</h3>
          {systemMetrics === undefined ? (
            <p style={{ color: "#999" }}>Loading...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <p>Open Listings: {systemMetrics.open.count}</p>
              <p>Locked Listings: {systemMetrics.locked.count}</p>
            </div>
          )}
        </div>
      </SuperAdminOnly>

      {/* System UTIDs - Superadmin Only */}
      <SuperAdminOnly show={isSuperAdmin}>
        <div style={{ marginBottom: "2rem" }}>
          <h3>System UTIDs</h3>
          {allActiveUTIDs === undefined ? (
            <p style={{ color: "#999" }}>Loading...</p>
          ) : (
            <div>
              {sortedStoreAdminUtids.map((audit: any) => (
                <div key={audit.utid} style={{ border: "1px solid #ccc", padding: "1rem", marginBottom: "1rem" }}>
                  <p>UTID: {audit.utid}</p>
                  <p>Timestamp: {formatUgandaDateTime(audit.timestamp)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </SuperAdminOnly>

      {/* Delivery Confirmations (SuperAdmin only) */}
      <SuperAdminOnly show={isSuperAdmin}>
        <div
          id="superadmin-inbox"
          style={{
            marginBottom: "2rem",
            border: "1px solid #ccc",
            padding: "1rem",
          }}
        >
          <h3>Delivery Confirmations</h3>
          {deliveryConfirmationsData === undefined ? (
            <p style={{ color: "#999" }}>Loading...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {deliveryConfirmationsData.utids.map((confirmation: any) => (
                <div key={confirmation.utid} style={{ border: "1px solid #ccc", padding: "1rem" }}>
                  <p>
                    <b>UTID:</b> {confirmation.utid}
                  </p>
                  <p>
                    <b>Items:</b> {confirmation.totalUnits} units ({confirmation.totalKilos} kg)
                  </p>
                  <p>
                    <b>Earliest Deadline:</b> {formatUgandaDateTime(confirmation.earliestDeliveryDeadline)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </SuperAdminOnly>

      {/* Admin Inbox - Superadmin Only */}
      <SuperAdminOnly show={isSuperAdmin}>
        {adminInboxOpen && (
          <div
            id="admin-inbox"
            style={{
              marginBottom: "2rem",
              border: "1px solid #ccc",
              padding: "1rem",
            }}
          >
            <h3>Admin Inbox</h3>
            {/* Add your inbox content here */}
            <button onClick={toggleAdminInbox}>Close Inbox</button>
          </div>
        )}
        {!adminInboxOpen && (
          <button onClick={toggleAdminInbox}>Open Admin Inbox</button>
        )}
      </SuperAdminOnly>

      {/* Purchase Window Control - Super Admin Only */}
      <SuperAdminOnly show={isSuperAdmin}>
        <div style={{ marginBottom: "2rem", border: "1px solid #ccc", padding: "1rem" }}>
          <h3>Purchase Window Control</h3>
          {purchaseWindowStatus === undefined ? (
            <p style={{ color: "#999" }}>Loading...</p>
          ) : (
            <div>
              <p>Status: {purchaseWindowStatus.isOpen ? "Open" : "Closed"}</p>
              <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                {!purchaseWindowStatus.isOpen ? (
                  <button
                    onClick={async () => {
                      setWindowActionLoading(true);
                      await openPurchaseWindow({ adminId, reason: "Admin opened window" });
                      setWindowActionLoading(false);
                    }}
                    disabled={windowActionLoading}
                  >
                    {windowActionLoading ? "Opening..." : "Open Purchase Window"}
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      setWindowActionLoading(true);
                      await closePurchaseWindow({ adminId, reason: "Admin closed window" });
                      setWindowActionLoading(false);
                    }}
                    disabled={windowActionLoading}
                  >
                    {windowActionLoading ? "Closing ..." : "Close Purchase Window"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </SuperAdminOnly>

      {/* System Metrics (second card) - Superadmin Only */}
      <SuperAdminOnly show={isSuperAdmin}>
        <div style={{ marginBottom: "2rem", border: "1px solid #ccc", padding: "1rem" }}>
          <h3>System Metrics (Second Card)</h3>
          {systemMetrics === undefined ? (
            <p style={{ color: "#999" }}>Loading...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <p>
                Total Users: {allUsers?.length || 0}
              </p>
            </div>
          )}
        </div>
      </SuperAdminOnly>

      {/* Live Timeline - Superadmin Only */}
      <SuperAdminOnly show={isSuperAdmin}>
        <div style={{ marginBottom: "2rem", border: "1px solid #ccc", padding: "1rem" }}>
          <h3>Live Timeline</h3>
          {/* Add your Live Timeline content here */}
          <p>Live Timeline Placeholder</p>
        </div>
      </SuperAdminOnly>

      {/* System Controls - Maintenance Mode - Superadmin Only */}
      <SuperAdminOnly show={isSuperAdmin}>
        <div style={{ marginBottom: "2rem", border: "1px solid #ccc", padding: "1rem" }}>
          <h3>System Controls - Maintenance Mode</h3>
          {/* Add your Maintenance Mode content here */}
          <p>Maintenance Mode Placeholder</p>
        </div>
      </SuperAdminOnly>

      {/* Kilo-Shaving Rate Management - Superadmin Only */}
      <SuperAdminOnly show={isSuperAdmin}>
        <div style={{ marginBottom: "2rem", border: "1px solid #ccc", padding: "1rem" }}>
          <h3>Kilo-Shaving Rate Management</h3>
          {/* Add your Kilo-Shaving Rate Management content here */}
          <p>Kilo-Shaving Rate Management Placeholder</p>
        </div>
      </SuperAdminOnly>

      {/* Buyer Service Fee Management - Superadmin Only */}
      <SuperAdminOnly show={isSuperAdmin}>
        <div style={{ marginBottom: "2rem", border: "1px solid #ccc", padding: "1rem" }}>
          <h3>Buyer Service Fee Management</h3>
          {/* Add your Buyer Service Fee Management content here */}
          <p>Buyer Service Fee Management Placeholder</p>
        </div>
      </SuperAdminOnly>

      {/* Trader Spend Cap Management - Superadmin Only */}
      <SuperAdminOnly show={isSuperAdmin}>
        <div style={{ marginBottom: "2rem", border: "1px solid #ccc", padding: "1rem" }}>
          <h3>Trader Spend Cap Management</h3>
          {/* Add your Trader Spend Cap Management content here */}
          <p>Trader Spend Cap Management Placeholder</p>
        </div>
      </SuperAdminOnly>

      {/* Produce Options Management - Superadmin Only */}
      <SuperAdminOnly show={isSuperAdmin}>
        <div style={{ marginBottom: "2rem", border: "1px solid #ccc", padding: "1rem" }}>
          <h3>Produce Options Management</h3>
          {/* Add your Produce Options Management content here */}
          <p>Produce Options Management Placeholder</p>
        </div>
      </SuperAdminOnly>

      {/* Quality Options Management */}
      <SuperAdminOnly show={isSuperAdmin}>
      <div style={{ marginBottom: "2rem", border: "1px solid #ccc", padding: "1rem" }}>
        <h3>Quality Options Management</h3>
        {/* Add your Quality Options Management content here */}
        <p>Quality Options Management Placeholder</p>
      </div>
      </SuperAdminOnly>

      {/* Storage Locations Management - Superadmin Only */}
      <SuperAdminOnly show={isSuperAdmin}>
        <div style={{ marginBottom: "2rem", border: "1px solid #ccc", padding: "1rem" }}>
          <h3>Storage Locations Management</h3>
          {/* Add your Storage Locations Management content here */}
          <p>Storage Locations Management Placeholder</p>
        </div>

        {/* Send Notifications */}
        <div style={{ marginBottom: "2rem", border: "1px solid #ccc", padding: "1rem" }}>
          <h3>Send Notifications</h3>
          {/* Add your Send Notifications content here */}
          <p>Send Notifications Placeholder</p>
        </div>
      </SuperAdminOnly>

      {/* Demo Funds Deposit - Superadmin Only */}
      <SuperAdminOnly show={isSuperAdmin}>
        <div style={{ marginBottom: "2rem", border: "1px solid #ccc", padding: "1rem" }}>
          <h3>Demo Funds Deposit</h3>
          {/* Add your Demo Funds Deposit content here */}
          <p>Demo Funds Deposit Placeholder</p>
        </div>
      </SuperAdminOnly>

      <button onClick={() => handleExportFarmers("excel", "list")}>Export Farmers (Excel - List)</button>
      <button onClick={() => handleExportFarmers("pdf", "list")}>Export Farmers (PDF - List)</button>
      <button onClick={() => handleExportFarmers("excel", "profiles")}>Export Farmers (Excel - Profiles)</button>
      <button onClick={() => handleExportFarmers("pdf", "profiles")}>Export Farmers (PDF - Profiles)</button>
      <button onClick={() => handleExportFarmers("excel", "activities")}>Export Farmers (Excel - Activities)</button>
      <button onClick={() => handleExportFarmers("pdf", "activities")}>Export Farmers (PDF - Activities)</button>
    </div>
  );
}