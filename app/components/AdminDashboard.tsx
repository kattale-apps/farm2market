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
  const [selectedCommunityId, setSelectedCommunityId] =
    useState<Id<"communities"> | null>(null);

  const communities = useQuery(
    api.introspection.getCommunitiesForAdmin,
    { adminId }
  );

  const communityMembers = useQuery(
    api.introspection.getCommunityMembers,
    selectedCommunityId
      ? { adminId, communityId: selectedCommunityId }
      : "skip"
  );

  const logExport = useMutation(api.communities.logExport);

  return (
    <div style={{ padding: "2rem", background: "#f5f7f6", minHeight: "100vh" }}>
      <h3>Community Management</h3>

      {selectedCommunityId ? (
        <div
          style={{
            background: "#ffffff",
            padding: "1.5rem",
            borderRadius: "10px",
            border: "1px solid #e0e0e0",
            boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
          }}
        >
          {/* content unchanged */}
        </div>
      ) : (
        <>
          {Array.isArray(communities) && communities.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: "1.25rem",
                marginTop: "1.5rem",
              }}
            >
              {communities.map((comm: any) => (
                <div
                  key={comm._id}
                  style={{
                    background: "#ffffff",               // ✅ FIX
                    border: "1px solid #e0e0e0",
                    padding: "1.25rem",
                    borderRadius: "12px",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 10px 28px rgba(0,0,0,0.12)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 6px 18px rgba(0,0,0,0.08)";
                  }}
                >
                  <div>
                    <h4 style={{ marginTop: 0 }}>{comm.name}</h4>
                    <p style={{ color: "#555" }}>
                      {comm.description || "No description"}
                    </p>
                    <p>
                      <strong>
                        {comm.isGlobal ? "Global" : "Geo-Locked"}
                      </strong>
                    </p>
                    <p>Members: {comm.memberCount || 0}</p>
                  </div>

                  <button
                    onClick={() => setSelectedCommunityId(comm._id)}
                    style={{
                      marginTop: "1rem",
                      padding: "0.6rem",
                      width: "100%",
                      background: "#1976d2",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Manage & View Members
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <SuperAdminOnly show={false}>
        <div />
      </SuperAdminOnly>
    </div>
  );
}
