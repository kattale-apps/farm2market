"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { formatUgandaDate } from "../../../utils/timeUtils";
import { useStoredUser } from "@/app/hooks/useStoredUser";

const formatUGX = (amount: number) =>
  `UGX ${amount.toLocaleString("en-UG")}`;

export default function SuperadminListingsLogPage() {
  const { user, status: authStatus } = useStoredUser();
  const adminId = (user?.userId as Id<"users"> | undefined) ?? null;
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const data = useQuery(
    (api as any).adminListings.getAllListingsLog,
    adminId
      ? { adminId, page, pageSize: 50, roleFilter, statusFilter }
      : "skip"
  );

  if (authStatus === "loading") {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
        Loading user information...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", padding: "clamp(1rem, 3vw, 2rem)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <a
            href="/farmer/dashboard"
            style={{
              padding: "0.5rem 1rem",
              background: "#2e7d32",
              color: "#fff",
              borderRadius: "10px",
              textDecoration: "none",
              fontSize: "0.9rem",
              fontWeight: "600",
            }}
          >
            🏠 Back to Home
          </a>
          <h1 style={{ margin: 0, fontSize: "clamp(1.3rem, 4vw, 1.8rem)", color: "#1a1a1a" }}>
            📋 All Listings Log
          </h1>
        </div>

        {/* Filters */}
        <div style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}>
          <label style={{ fontSize: "0.9rem", color: "#333" }}>
            Role:
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              style={{
                marginLeft: "0.5rem",
                padding: "0.4rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #ccc",
                fontSize: "0.9rem",
              }}
            >
              <option value="all">All Roles</option>
              <option value="farmer">Farmer</option>
              <option value="trader">Trader</option>
              <option value="vendor">Vendor</option>
              <option value="store">Store</option>
            </select>
          </label>

          <label style={{ fontSize: "0.9rem", color: "#333" }}>
            Status:
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              style={{
                marginLeft: "0.5rem",
                padding: "0.4rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #ccc",
                fontSize: "0.9rem",
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="partially_locked">Partially Locked</option>
              <option value="fully_locked">Fully Locked</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>

          {data && (
            <span style={{ fontSize: "0.85rem", color: "#666" }}>
              Showing {data.items.length} listings (Page {data.currentPage})
            </span>
          )}
        </div>

        {/* Table */}
        <div style={{
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          border: "1px solid #e0e0e0",
          overflowX: "auto",
        }}>
          {data === undefined ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#999" }}>Loading listings...</div>
          ) : !data.items || !data.items.length ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>No listings found for the selected filters.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e0e0e0", background: "#f9f9f9" }}>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>UTID</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Product</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Seller</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Role</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Mode</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Status</th>
                  <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600", color: "#333" }}>Units</th>
                  <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600", color: "#333" }}>Price</th>
                  <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600", color: "#333" }}>Purchases</th>
                  <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600", color: "#333" }}>Revenue</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item: any) => {
                  const roleBadge: Record<string, { bg: string; color: string }> = {
                    farmer: { bg: "#e8f5e9", color: "#2e7d32" },
                    trader: { bg: "#e3f2fd", color: "#1565c0" },
                    vendor: { bg: "#fff3e0", color: "#e65100" },
                    store: { bg: "#fce4ec", color: "#c62828" },
                  };
                  const badge = roleBadge[item.sellerRole] || { bg: "#f5f5f5", color: "#666" };
                  const statusColors: Record<string, string> = {
                    active: "#2e7d32",
                    partially_locked: "#e65100",
                    fully_locked: "#1565c0",
                    delivered: "#00695c",
                    cancelled: "#c62828",
                  };

                  return (
                    <tr key={item.listingId} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "0.75rem", fontFamily: "monospace", fontWeight: 700, fontSize: "0.8rem" }}>
                        {item.utid}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {item.productName || item.produceType}
                        {item.packagingTypeEnum && (
                          <div style={{ fontSize: "0.75rem", color: "#888" }}>
                            {item.packagingTypeEnum.replace(/_/g, " ")}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem" }}>{item.sellerAlias}</td>
                      <td style={{ padding: "0.75rem" }}>
                        <span style={{
                          padding: "0.15rem 0.4rem",
                          background: badge.bg,
                          color: badge.color,
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          textTransform: "capitalize",
                        }}>
                          {item.sellerRole}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem", textTransform: "capitalize" }}>
                        {item.listingMode}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        <span style={{
                          color: statusColors[item.status] || "#666",
                          fontWeight: "600",
                          fontSize: "0.8rem",
                          textTransform: "capitalize",
                        }}>
                          {item.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "right" }}>
                        {item.availableUnits} / {item.totalUnits}
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "right" }}>
                        {item.pricePerUnit
                          ? formatUGX(item.pricePerUnit)
                          : formatUGX(item.pricePerKilo) + "/kg"}
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600" }}>
                        {item.purchaseCount}
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "right" }}>
                        {formatUGX(item.totalRevenue)}
                      </td>
                      <td style={{ padding: "0.75rem", fontSize: "0.8rem", color: "#666" }}>
                        {formatUgandaDate(item.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {data && (data.currentPage > 1 || data.hasMore) && (
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "0.5rem",
            marginTop: "1.5rem",
          }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                padding: "0.5rem 1rem",
                background: page <= 1 ? "#e0e0e0" : "#1976d2",
                color: page <= 1 ? "#999" : "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: page <= 1 ? "not-allowed" : "pointer",
                fontWeight: "600",
              }}
            >
              ← Previous
            </button>

            <span style={{ fontSize: "0.9rem", color: "#333", fontWeight: "600" }}>
              Page {data.currentPage}
            </span>

            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.hasMore}
              style={{
                padding: "0.5rem 1rem",
                background: !data.hasMore ? "#e0e0e0" : "#1976d2",
                color: !data.hasMore ? "#999" : "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: !data.hasMore ? "not-allowed" : "pointer",
                fontWeight: "600",
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
