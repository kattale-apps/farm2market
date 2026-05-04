"use client";

export const dynamic = "force-dynamic";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect, useMemo } from "react";
import { NegotiationPanel } from "../../components/NegotiationPanel";
import { useStoredUser } from "../../hooks/useStoredUser";

export default function TraderMarketplacePage() {
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  const [expandedUtids, setExpandedUtids] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    traderAlias: "",
    produceType: "",
  });

  const listings = useQuery(api.listings.getActiveListings, {});
  const negotiations = useQuery(
    api.negotiations.getTraderNegotiations,
    userId ? { traderId: userId } : "skip"
  );
  const cancelNegotiation = useMutation(api.negotiations.cancelNegotiation);

  const formatUGX = (amount: number) => {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(amount);
  };

  const handleCancel = async (negotiationId: string) => {
    if (!userId) return;
    if (!window.confirm("Cancel this negotiation? This cannot be undone.")) return;
    try {
      await cancelNegotiation({
        traderId: userId,
        negotiationId: negotiationId as Id<"negotiations">,
      });
    } catch (error: any) {
      console.error("Failed to cancel negotiation:", error);
      alert(error.message || "Failed to cancel negotiation.");
    }
  };

  const formatCountdown = (deadline?: number) => {
    if (!deadline) return "Delivery deadline not set";
    const remaining = deadline - Date.now();
    if (remaining <= 0) return "Delivery overdue";
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return `Due in ${hours}h ${minutes}m`;
  };

  // Filter and group transactions
  const filteredTransactions = useMemo(() => {
    if (!listings) return [];

    let filtered = listings.filter((listing: any) => {
      if (filters.produceType && listing.produceType !== filters.produceType) return false;
      if (filters.dateFrom && listing.createdAt < new Date(filters.dateFrom).getTime()) return false;
      if (filters.dateTo && listing.createdAt > new Date(filters.dateTo).getTime() + 86400000) return false;
      return true;
    });

    // Group by UTID (for pay-to-lock section)
    const grouped = new Map<string, any[]>();
    filtered.forEach((listing: any) => {
      if (!grouped.has(listing.utid)) {
        grouped.set(listing.utid, []);
      }
      grouped.get(listing.utid)!.push(listing);
    });

    return Array.from(grouped.entries()).map(([utid, items]) => ({
      utid,
      items,
      createdAt: items[0].createdAt,
    }));
  }, [listings, filters]);

  const toggleExpand = (utid: string) => {
    const newExpanded = new Set(expandedUtids);
    if (newExpanded.has(utid)) {
      newExpanded.delete(utid);
    } else {
      newExpanded.add(utid);
    }
    setExpandedUtids(newExpanded);
  };

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
        <p>Please log in to access the marketplace.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "clamp(1rem, 4vw, 2rem)", maxWidth: "1400px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", marginBottom: "1.5rem" }}>
        Marketplace
      </h1>

      {/* Filters */}
      <div
        style={{
          padding: "1.5rem",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          marginBottom: "2rem",
        }}
      >
        <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Filters</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: "600" }}>
              Produce Type
            </label>
            <input
              type="text"
              value={filters.produceType}
              onChange={(e) => setFilters({ ...filters, produceType: e.target.value })}
              placeholder="Filter by produce..."
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: "600" }}>
              Date From
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: "600" }}>
              Date To
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            />
          </div>
        </div>
      </div>

      {/* Active Negotiations */}
      <div
        style={{
          padding: "1.5rem",
          background: "#fff",
          borderRadius: "12px",
          marginBottom: "2rem",
          border: "2px solid #e0e0e0",
        }}
      >
        <h2 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>Active Negotiations</h2>
        {negotiations === undefined ? (
          <p>Loading...</p>
        ) : negotiations.negotiations.filter((n: any) => n.status === "pending" || n.status === "countered").length === 0 ? (
          <p style={{ color: "#666" }}>No active negotiations.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {negotiations.negotiations
              .filter((n: any) => n.status === "pending" || n.status === "countered")
              .map((negotiation: any) => (
                <NegotiationPanel
                  key={negotiation.negotiationId}
                  negotiation={negotiation}
                  userId={userId}
                  userRole="trader"
                />
              ))}
          </div>
        )}
      </div>

      {/* Locked Payments (Paid & Locked) */}
      <div
        style={{
          padding: "1.5rem",
          background: "#e8f5e9",
          borderRadius: "12px",
          marginBottom: "2rem",
          border: "2px solid #4caf50",
        }}
      >
        <h2 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>Locked Payments</h2>
        <p style={{ color: "#666", marginBottom: "1rem" }}>
          Payments that have been successfully locked
        </p>
        {negotiations === undefined ? (
          <p>Loading...</p>
        ) : negotiations.negotiations.filter((n: any) => n.status === "accepted" && n.unitStatus === "locked").length === 0 ? (
          <p style={{ color: "#666" }}>No locked payments yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {negotiations.negotiations
              .filter((n: any) => n.status === "accepted" && n.unitStatus === "locked")
              .map((negotiation: any) => (
                <div
                  key={negotiation.negotiationId}
                  style={{
                    padding: "1rem",
                    background: "#fff",
                    borderRadius: "8px",
                    border: "1px solid #4caf50",
                  }}
                >
                  <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
                    {negotiation.produceType} - Unit #{negotiation.unitNumber}
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#666" }}>
                    UTID: {negotiation.negotiationUtid}
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#666", marginTop: "0.25rem" }}>
                    Delivery: {negotiation.deliveryStatus || "Pending"}
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#666" }}>
                    {formatCountdown(negotiation.deliveryDeadline)}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Pay-to-Lock Section */}
      <div
        style={{
          padding: "1.5rem",
          background: "#fff3cd",
          borderRadius: "12px",
          marginBottom: "2rem",
          border: "2px solid #ffc107",
        }}
      >
        <h2 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>Pay-to-Lock</h2>
        <p style={{ color: "#666", marginBottom: "1rem" }}>
          Transactions ready for payment after accepted negotiations
        </p>
        {negotiations === undefined ? (
          <p>Loading...</p>
        ) : negotiations.negotiations.filter((n: any) => n.status === "accepted").length === 0 ? (
          <p style={{ color: "#666" }}>No accepted negotiations ready for payment.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {negotiations.negotiations
              .filter((n: any) => n.status === "accepted")
              .map((negotiation: any) => (
                <div
                  key={negotiation.negotiationId}
                  style={{
                    padding: "1rem",
                    background: "#fff",
                    borderRadius: "8px",
                    border: "1px solid #ffc107",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                    <div>
                      <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
                        {negotiation.produceType} - Unit #{negotiation.unitNumber}
                      </div>
                      <div style={{ fontSize: "0.9rem", color: "#666" }}>
                        UTID: {negotiation.negotiationUtid}
                      </div>
                      <div style={{ fontSize: "1.1rem", fontWeight: "600", color: "#4caf50", marginTop: "0.5rem" }}>
                        {formatUGX(negotiation.currentPricePerKilo)}/kg
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button
                        style={{
                          padding: "0.75rem 1.5rem",
                          background: "#4caf50",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: "600",
                        }}
                        onClick={() => {
                          // Navigate to payment or trigger pay-to-lock
                          alert("Pay-to-lock functionality - integrate with payments.ts lockUnit mutation");
                        }}
                      >
                        Pay to Lock
                      </button>
                      <button
                        style={{
                          padding: "0.75rem 1.5rem",
                          background: "#dc3545",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: "600",
                        }}
                        onClick={() => handleCancel(negotiation.negotiationId)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Concluded Negotiations */}
      <div
        style={{
          padding: "1.5rem",
          background: "#f8f9fa",
          borderRadius: "12px",
          marginBottom: "2rem",
          border: "2px solid #e0e0e0",
        }}
      >
        <h2 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>Concluded Negotiations</h2>
        {negotiations === undefined ? (
          <p>Loading...</p>
        ) : negotiations.negotiations.filter((n: any) => n.status === "accepted" || n.status === "rejected" || n.status === "cancelled").length === 0 ? (
          <p style={{ color: "#666" }}>No concluded negotiations.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {negotiations.negotiations
              .filter((n: any) => n.status === "accepted" || n.status === "rejected" || n.status === "cancelled")
              .map((negotiation: any) => (
                <div
                  key={negotiation.negotiationId}
                  style={{
                    padding: "1rem",
                    background: "#fff",
                    borderRadius: "8px",
                    border: "1px solid #e0e0e0",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
                        {negotiation.produceType} - Unit #{negotiation.unitNumber}
                      </div>
                      <div style={{ fontSize: "0.9rem", color: "#666" }}>
                        UTID: {negotiation.negotiationUtid}
                      </div>
                    </div>
                    <span style={{
                      padding: "0.25rem 0.75rem",
                      borderRadius: "12px",
                      fontSize: "0.8rem",
                      fontWeight: "600",
                      background: negotiation.status === "accepted" ? "#4caf50" : "#9e9e9e",
                      color: "white",
                    }}>
                      {negotiation.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#666", marginTop: "0.5rem" }}>
                    Delivery: {negotiation.deliveryStatus || "Pending"}
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#666" }}>
                    {formatCountdown(negotiation.deliveryDeadline)}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* All Listings (Collapsible Cards) */}
      <div>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>All Listings</h2>
        {filteredTransactions.length === 0 ? (
          <p style={{ color: "#666", padding: "2rem", textAlign: "center" }}>
            No listings match your filters.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {filteredTransactions.map((transaction: any) => (
              <div
                key={transaction.utid}
                style={{
                  background: "#fff",
                  borderRadius: "12px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "1rem 1.5rem",
                    background: "#f5f5f5",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                  onClick={() => toggleExpand(transaction.utid)}
                >
                  <div>
                    <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
                      {transaction.items[0].produceType} - {transaction.items.length} item(s)
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "#666", fontFamily: "monospace" }}>
                      UTID: {transaction.utid}
                    </div>
                  </div>
                  <div style={{ fontSize: "1.5rem" }}>
                    {expandedUtids.has(transaction.utid) ? "−" : "+"}
                  </div>
                </div>
                {expandedUtids.has(transaction.utid) && (
                  <div style={{ padding: "1.5rem" }}>
                    {transaction.items.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          padding: "1rem",
                          background: "#fafafa",
                          borderRadius: "8px",
                          marginBottom: idx < transaction.items.length - 1 ? "1rem" : 0,
                        }}
                      >
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                          <div>
                            <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.25rem" }}>Price</div>
                            <div style={{ fontSize: "1.2rem", fontWeight: "600" }}>
                              {formatUGX(item.pricePerKilo)}/kg
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.25rem" }}>Total Kilos</div>
                            <div style={{ fontSize: "1.2rem", fontWeight: "600" }}>{item.totalKilos} kg</div>
                          </div>
                          <div>
                            <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.25rem" }}>Available Units</div>
                            <div style={{ fontSize: "1.2rem", fontWeight: "600" }}>{item.availableUnits}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.25rem" }}>Farmer</div>
                            <div style={{ fontSize: "1rem", fontWeight: "600" }}>{item.farmerAlias || "N/A"}</div>
                          </div>
                        </div>
                      </div>
                    ))}
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
