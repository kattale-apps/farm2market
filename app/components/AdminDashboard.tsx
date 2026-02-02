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

/* ───────────────── Styles ───────────────── */

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "clamp(1rem, 5vw, 2rem)",
  background: "#f3f6f4",
  boxSizing: "border-box",
  maxWidth: "100vw",
  overflowX: "hidden",
};

const farmCardStyle: React.CSSProperties = {
  backgroundImage: "url('/backgrounds/farm-bg.jpg')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  borderRadius: "22px",
  padding: "clamp(1rem, 3vw, 2rem)",
  boxShadow: "0 14px 36px rgba(0,0,0,0.12)",
  boxSizing: "border-box",
};

const glassPanelStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.82)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  borderRadius: "16px",
  padding: "clamp(1rem, 3vw, 1.75rem)",
  boxSizing: "border-box",
};

const utilityCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e0e0e0",
  borderRadius: "12px",
  padding: "1rem 1.25rem",
  boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
  boxSizing: "border-box",
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

  /* ───────────────── UI ───────────────── */

  return (
    <div style={containerStyle}>
      <h2 style={{ marginBottom: "1rem" }}>Community Management</h2>

      {/* Premium Notice */}
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

      {/* Notifications / Inbox */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1.75rem",
          flexWrap: "wrap",
        }}
      >
        <div style={utilityCardStyle}>🔔 Notifications (Premium)</div>
        <div style={utilityCardStyle}>📥 Inbox (Premium)</div>
      </div>

      {/* FARM BACKGROUND CARD */}
      <div style={farmCardStyle}>
        <div style={glassPanelStyle}>
          {selectedCommunityId ? (
            <>
              {/* Back + Export */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                  marginBottom: "1.25rem",
                }}
              >
                <button
                  onClick={() => setSelectedCommunityId(null)}
                  style={{
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

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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
              </div>

              {/* Members Table */}
              <h4 style={{ marginBottom: "0.75rem" }}>
                Members ({communityMembers?.length ?? 0})
              </h4>

              {!communityMembers ? (
                <p>Loading members…</p>
              ) : (
                <div style={{ overflowX: "auto", maxWidth: "100%" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      background: "#ffffff",
                      borderRadius: "10px",
                      overflow: "hidden",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f5f5f5" }}>
                        {["Alias", "Role", "Phone", "Email", "Joined"].map(
                          (h) => (
                            <th
                              key={h}
                              style={{
                                padding: "0.75rem",
                                textAlign: "left",
                                borderBottom: "1px solid #ddd",
                                fontWeight: 700,
                              }}
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {communityMembers.map((m) => (
                        <tr key={m._id}>
                          <td style={{ padding: "0.75rem" }}>{m.alias}</td>
                          <td style={{ padding: "0.75rem" }}>{m.role}</td>
                          <td style={{ padding: "0.75rem" }}>
                            {m.phoneNumber ?? "-"}
                          </td>
                          <td style={{ padding: "0.75rem" }}>
                            {m.email ?? "-"}
                          </td>
                          <td style={{ padding: "0.75rem" }}>
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
            /* COMMUNITY LIST */
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
                gap: "1rem",
              }}
            >
              {communities?.map((c) => (
                <div
                  key={c._id}
                  style={{
                    background: "#ffffff",
                    borderRadius: "12px",
                    padding: "1rem",
                    border: "1px solid #e0e0e0",
                  }}
                >
                  <h4>{c.name}</h4>
                  <p>{c.description}</p>
                  <p>
                    <strong>Members:</strong> {c.memberCount ?? 0}
                  </p>
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
                      width: "100%",
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
    </div>
  );
}
