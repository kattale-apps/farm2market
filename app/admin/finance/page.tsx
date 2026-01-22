"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";

export default function FinanceDashboardPage() {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const earnings = useQuery(
    api.adminFinance.getCommissionEarnings,
    userId ? { adminId: userId } : "skip"
  );

  // Get current user from localStorage (pilot mode)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("pilot_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.userId) {
            setUserId(parsed.userId as Id<"users">);
          }
        }
      } catch (e) {
        console.error("Error reading user from localStorage:", e);
      }
    }
  }, []);

  const formatUGX = (amount: number) => {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(amount);
  };

  if (!userId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Please log in to access the finance dashboard.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "clamp(1rem, 4vw, 2rem)", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", marginBottom: "1.5rem" }}>
        Commission Earnings Dashboard
      </h1>
      <p style={{ marginBottom: "2rem", color: "#666" }}>
        View trader commission earnings aggregated by UTID, day, and month. No trader identities are exposed.
      </p>

      {earnings === undefined ? (
        <p>Loading earnings data...</p>
      ) : (
        <>
          {/* Summary Card */}
          <div
            style={{
              padding: "2rem",
              background: "#4caf50",
              color: "white",
              borderRadius: "12px",
              marginBottom: "2rem",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.9rem", marginBottom: "0.5rem", opacity: 0.9 }}>
              Total Commission Earnings
            </div>
            <div style={{ fontSize: "2.5rem", fontWeight: "700", marginBottom: "0.5rem" }}>
              {formatUGX(earnings.totalCommission)}
            </div>
            <div style={{ fontSize: "0.9rem", opacity: 0.9 }}>
              From {earnings.totalTransactions} transaction(s)
            </div>
          </div>

          {/* By UTID */}
          <div
            style={{
              padding: "1.5rem",
              background: "#fff",
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              marginBottom: "2rem",
            }}
          >
            <h2 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>Earnings by UTID</h2>
            {earnings.byUtid.length === 0 ? (
              <p style={{ color: "#666" }}>No commission earnings yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #ddd" }}>
                      <th style={{ padding: "0.75rem", textAlign: "left" }}>UTID</th>
                      <th style={{ padding: "0.75rem", textAlign: "right" }}>Commission</th>
                      <th style={{ padding: "0.75rem", textAlign: "left" }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earnings.byUtid.map((entry: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "0.75rem", fontFamily: "monospace" }}>{entry.utid}</td>
                        <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600" }}>
                          {formatUGX(entry.commission)}
                        </td>
                        <td style={{ padding: "0.75rem", color: "#666" }}>
                          {new Date(entry.timestamp).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* By Day */}
          <div
            style={{
              padding: "1.5rem",
              background: "#fff",
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              marginBottom: "2rem",
            }}
          >
            <h2 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>Earnings by Day</h2>
            {earnings.byDay.length === 0 ? (
              <p style={{ color: "#666" }}>No daily earnings yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #ddd" }}>
                      <th style={{ padding: "0.75rem", textAlign: "left" }}>Date</th>
                      <th style={{ padding: "0.75rem", textAlign: "right" }}>Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earnings.byDay.map((entry: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "0.75rem" }}>{entry.day}</td>
                        <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600" }}>
                          {formatUGX(entry.commission)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* By Month */}
          <div
            style={{
              padding: "1.5rem",
              background: "#fff",
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          >
            <h2 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>Earnings by Month</h2>
            {earnings.byMonth.length === 0 ? (
              <p style={{ color: "#666" }}>No monthly earnings yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #ddd" }}>
                      <th style={{ padding: "0.75rem", textAlign: "left" }}>Month</th>
                      <th style={{ padding: "0.75rem", textAlign: "right" }}>Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earnings.byMonth.map((entry: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "0.75rem" }}>{entry.month}</td>
                        <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600" }}>
                          {formatUGX(entry.commission)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
