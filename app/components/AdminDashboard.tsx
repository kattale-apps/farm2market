"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatUgandaDate } from "../utils/dateUtils";

/* ───────────────── Types ───────────────── */

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

/* ───────────────── Styles ───────────────── */

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "2rem",
  background: "#f3f6f4",
};

const farmBackgroundWrapper: React.CSSProperties = {
  backgroundImage: "url('/backgrounds/farm-bg.jpg')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  borderRadius: "20px",
  padding: "2rem",
};

const glassPanel: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.78)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  borderRadius: "16px",
  padding: "1.75rem",
  boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e0e0e0",
  borderRadius: "12px",
  padding: "1rem",
  boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const disabledButtonStyle: React.CSSProperties = {
  padding: "0.6rem 1rem",
  background: "#cfd8dc",
  color: "#546e7a",
  borderRadius: "8px",
  border: "1px dashed #b0bec5",
  cursor: "not-allowed",
  fontWeight: 600,
  opacity: 0.85,
};

/* ───────────────── Component ───────────────── */

export function AdminDashboard({ userId }: AdminDashboardProps) {
  const adminId = userId as Id<"users">;
  const [selectedCommunityId, setSelectedCommunityId] =
    useState<Id<"communities"> | null>(null);

  const communities = useQuery(api.introspection.getCommunitiesForAdmin, {
    adminId,
  });

  const communityMembers = useQuery(
    api.introspection.getCommunityMembers,
    selectedCommunityId
      ? { adminId, communityId: selectedCommunityId }
      : "skip"
  );

  const logExport = useMutation(api.communities.logExport);

  /* ───────────── Export Logic ───────────── */

  const handleExport = async (type: "excel" | "pdf") => {
    if (!communityMembers || !selectedCommunityId) return;

    const community = communities?.find(
      (c) => c._id === selectedCommunityId
    );
    const name = community?.name ?? "Community";

    await logExport({
      userId: adminId,
      exportType: type,
      dataCount: communityMembers.length,
    });

    const rows = communityMembers.map((m) => ({
      Alias: m.alias ?? "-",
      Role: m.role ?? "-",
      Phone: m.phoneNumber ?? "-",
      Email: m.email ?? "-",
      Joined: m.joinedAt ? formatUgandaDate(m.joinedAt) : "-",
    }));

    if (type === "excel") {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Members");
      XLSX.writeFile(wb, `${name}_Members.xlsx`);
    } else {
      const doc = new jsPDF();
      doc.text(`${name} Members`, 14, 15);
      autoTable(doc, {
        head: [["Alias", "Role", "Phone", "Email", "Joined"]],
        body: rows.map((r) => Object.values(r)),
        startY: 20,
      });
      doc.save(`${name}_Members.pdf`);
    }
  };

  /* ───────────── Premium Notice Handler ───────────── */

  const handlePremiumClick = () => {
    alert(
      "🚀 Creating a community is a Premium feature.\n\nPlease contact Farm2Market support to upgrade your account."
    );
  };

  /* ───────────────── UI ───────────────── */

  return (
    <div style={containerStyle}>
      <h2 style={{ marginBottom: "1rem" }}>Community Management</h2>

      {/* Premium Banner */}
      <div
        style={{
          background: "#fff3cd",
          border: "1px solid #ffeeba",
          padding: "1rem",
          borderRadius: "10px",
          marginBottom: "1.25rem",
          color: "#856404",
          fontWeight: 600,
        }}
      >
        🚀 Creating communities is a <strong>Premium Feature</strong>. Contact
        support for access.
      </div>

      {/* Notifications / Inbox / Create */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <div style={cardStyle}>🔔 Notifications (Premium)</div>
        <div style={cardStyle}>📥 Inbox (Premium)</div>

        <button
          onClick={handlePremiumClick}
          style={disabledButtonStyle}
          title="Premium Feature"
        >
          ➕ Create Community (Premium)
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div style={farmBackgroundWrapper}>
        <div style={glassPanel}>
          {selectedCommunityId ? (
            <>
              <button
                onClick={() => setSelectedCommunityId(null)}
                style={{
                  marginBottom: "1rem",
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  background: "#ffffff",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                ← Back to Communities
              </button>

              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => handleExport("excel")}
                  style={{
                    background: "#2e7d32",
                    color: "#fff",
                    padding: "0.5rem 1rem",
                    borderRadius: 6,
                    border: "none",
                    fontWeight: 600,
                  }}
                >
                  Export Excel
                </button>
                <button
                  onClick={() => handleExport("pdf")}
                  style={{
                    background: "#d32f2f",
                    color: "#fff",
                    padding: "0.5rem 1rem",
                    borderRadius: 6,
                    border: "none",
                    fontWeight: 600,
                  }}
                >
                  Export PDF
                </button>
              </div>

              <h4>Members ({communityMembers?.length ?? 0})</h4>

              {!communityMembers ? (
                <p>Loading members…</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f5f5f5" }}>
                        <th>Alias</th>
                        <th>Role</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {communityMembers.map((m) => (
                        <tr key={m._id}>
                          <td>{m.alias}</td>
                          <td>{m.role}</td>
                          <td>{m.phoneNumber ?? "-"}</td>
                          <td>{m.email ?? "-"}</td>
                          <td>
                            {m.joinedAt
                              ? formatUgandaDate(m.joinedAt)
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: "1rem",
              }}
            >
              {communities?.map((c) => (
                <div key={c._id} style={cardStyle}>
                  <div>
                    <h4>{c.name}</h4>
                    <p>{c.description}</p>
                    <p>
                      <strong>Members:</strong> {c.memberCount ?? 0}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedCommunityId(c._id)}
                    style={{
                      marginTop: "0.75rem",
                      padding: "0.6rem",
                      background: "#1976d2",
                      color: "#fff",
                      borderRadius: 6,
                      border: "none",
                      fontWeight: 600,
                    }}
                  >
                    Manage & View Members
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <SuperAdminOnly show={false}>
        <div />
      </SuperAdminOnly>
    </div>
  );
}
