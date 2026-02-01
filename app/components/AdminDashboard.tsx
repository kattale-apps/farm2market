// AdminDashboard.tsx
import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

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

  const communities = useQuery(
    api.introspection.getCommunitiesForAdmin,
    { adminId }
  );

  return (
    <div style={{ padding: "2rem" }}>
      <h3>Community Management</h3>

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
          {communities.map((comm) => (
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
            </div>
          ))}
        </div>
      )}

      {/* Example usage of SuperAdminOnly (with children, so no error) */}
      <SuperAdminOnly show={false}>
        <div />
      </SuperAdminOnly>
    </div>
  );
}
