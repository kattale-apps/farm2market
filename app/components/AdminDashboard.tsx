// AdminDashboard.tsx
import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatUgandaDate } from "../utils/dateUtils";

interface AdminDashboardProps {
  userId: string;
}

function SuperAdminOnly({
  show,
  children,
}: {
  show: boolean;
  children: React.ReactNode;
}) {
  return show ? <>{children}</> : null;
}

export function AdminDashboard({ userId }: AdminDashboardProps) {
  const adminId = userId as Id<"users">;
  const [selectedCommunityId, setSelectedCommunityId] = useState<Id<"communities"> | null>(null);

  const communities = useQuery(
    api.introspection.getCommunitiesForAdmin,
    { adminId }
  );

  const communityMembers = useQuery(
    api.introspection.getCommunityMembers,
    selectedCommunityId ? { adminId, communityId: selectedCommunityId } : "skip"
  );

  const logExport = useMutation(api.communities.logExport);

  const handleExport = async (type: "excel" | "pdf") => {
    if (!communityMembers || !selectedCommunityId) return;

    const selectedCommunity = communities?.find(c => c._id === selectedCommunityId);
    const communityName = selectedCommunity?.name || "Community";

    // Log the export
    try {
      await logExport({
        userId: adminId,
        exportType: type,
        dataCount: communityMembers.length,
      });
    } catch (err: any) {
      alert("Export failed: " + err.message);
      return;
    }

    const data = communityMembers.map(m => ({
      Alias: m?.alias || "Unknown",
      Role: m?.role || "N/A",
      "Phone Number": m?.phoneNumber || "N/A",
      Email: m?.email || "N/A",
      "Joined At": m?.joinedAt ? formatUgandaDate(m.joinedAt) : "-",
    }));

    if (type === "excel") {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Members");
      XLSX.writeFile(wb, `${communityName}_Members.xlsx`);
    } else {
      const doc = new jsPDF();
      doc.text(`${communityName} Members`, 14, 15);
      
      const tableColumn = ["Alias", "Role", "Phone", "Email", "Joined"];
      const tableRows = data.map(item => [
        item.Alias,
        item.Role,
        item["Phone Number"],
        item.Email,
        item["Joined At"]
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 20,
      });

      doc.save(`${communityName}_Members.pdf`);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h3>Community Management</h3>

      {selectedCommunityId ? (
        <div style={{ background: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid #eee" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <button onClick={() => setSelectedCommunityId(null)} style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>
              ← Back to Communities
            </button>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={() => handleExport("excel")} style={{ padding: "0.5rem 1rem", background: "#2e7d32", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                Export Excel
              </button>
              <button onClick={() => handleExport("pdf")} style={{ padding: "0.5rem 1rem", background: "#d32f2f", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                Export PDF
              </button>
            </div>
          </div>
          
          <h4>Members List ({communityMembers?.length || 0})</h4>
          {!communityMembers ? (
            <p>Loading members...</p>
          ) : communityMembers.length === 0 ? (
            <p>No members in this community.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
                    <th style={{ padding: "0.5rem", borderBottom: "1px solid #ddd" }}>Alias</th>
                    <th style={{ padding: "0.5rem", borderBottom: "1px solid #ddd" }}>Role</th>
                    <th style={{ padding: "0.5rem", borderBottom: "1px solid #ddd" }}>Phone</th>
                    <th style={{ padding: "0.5rem", borderBottom: "1px solid #ddd" }}>Email</th>
                    <th style={{ padding: "0.5rem", borderBottom: "1px solid #ddd" }}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {communityMembers.map((m: any) => (
                    <tr key={m._id || Math.random()}>
                      <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{m?.alias}</td>
                      <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{m?.role}</td>
                      <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{m?.phoneNumber || "-"}</td>
                      <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{m?.email || "-"}</td>
                      <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{m?.joinedAt ? formatUgandaDate(m.joinedAt) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>

      {communities === undefined && (
        <p style={{ color: "#999" }}>Loading…</p>
      )}

      {communities === null && (
        <p style={{ color: "red" }}>Failed to load communities.</p>
      )}

      {Array.isArray(communities) && communities.length === 0 && (
        <p>No communities assigned.</p>
      )}

      {Array.isArray(communities) && communities.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: "1rem",
          }}
        >
          {communities.map((comm: any) => (
            <div
              key={comm._id}
              style={{
                border: "1px solid #eee",
                padding: "1rem",
                borderRadius: "8px",
              }}
            >
              <h4>{comm.name}</h4>
              <p>{comm.description}</p>
              <p>
                Type: {comm.isGlobal ? "Global" : "Geo-Locked"}
              </p>
              <p>
                <strong>Members: {comm.memberCount || 0}</strong>
              </p>
              <button 
                onClick={() => setSelectedCommunityId(comm._id)}
                style={{ marginTop: "0.5rem", padding: "0.5rem", width: "100%", background: "#1976d2", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
              >
                Manage & View Members
              </button>
            </div>
          ))}
        </div>
      )}
        </>
      )}

      {/* Example usage of SuperAdminOnly (with children, so no error) */}
      <SuperAdminOnly show={false}>
        <div />
      </SuperAdminOnly>
    </div>
  );
}
