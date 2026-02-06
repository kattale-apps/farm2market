"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

export default function FinanceDashboardPage() {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [pricingReason, setPricingReason] = useState("");
  const [postingCost, setPostingCost] = useState<string>("");
  const [etaCost, setEtaCost] = useState<string>("");
  const [grantTraderId, setGrantTraderId] = useState<string>("");
  const [grantAmount, setGrantAmount] = useState<string>("");
  const [grantReason, setGrantReason] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const currentUser = useQuery(api.auth.getUser, userId ? { userId } : "skip");
  const isSuperAdmin = currentUser?.role === "admin" && (
    currentUser?.adminLevel === "super" || currentUser?.adminLevel === undefined
  );
  const isFinanceAdmin = currentUser?.role === "admin" && currentUser?.adminLevel === "junior" && currentUser?.adminCategory === "finance";
  const earnings = useQuery(
    api.adminFinance.getCommissionEarnings,
    userId && isSuperAdmin ? { adminId: userId } : "skip"
  );
  const farmcoinSettings = useQuery((api as any).farmcoin.getFarmcoinSettings, {} as any);
  const farmcoinHistory = useQuery(
    (api as any).farmcoin.getFarmcoinPricingHistory,
    userId ? { adminId: userId } : "skip"
  );
  const farmcoinLedger = useQuery(
    (api as any).farmcoin.getFarmcoinLedger,
    userId ? { adminId: userId } : "skip"
  );
  const unverifiedTraders = useQuery(
    (api as any).farmcoin.getUnverifiedTraders,
    userId ? { adminId: userId } : "skip"
  );

  const updateFarmcoinPricing = useMutation((api as any).farmcoin.updateFarmcoinPricing);
  const grantFarmcoinTokens = useMutation((api as any).farmcoin.grantFarmcoinTokens);
  const verifyTrader = useMutation((api as any).farmcoin.verifyTrader);
  const rejectTrader = useMutation((api as any).farmcoin.rejectTrader);

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

  

  const handleExportFarmcoinLedger = () => {
    if (!farmcoinLedger || !farmcoinHistory) return;

    const ledgerRows = farmcoinLedger.map((entry: any) => ({
      AccountType: entry.accountType,
      TraderId: entry.traderId || "",
      Delta: entry.delta,
      BalanceAfter: entry.balanceAfter,
      Source: entry.source,
      ListingId: entry.listingId || "",
      Reason: entry.reason || "",
      UTID: entry.utid,
      CreatedAt: entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "",
    }));

    const pricingRows = farmcoinHistory.map((entry: any) => ({
      ChangedByAdminId: entry.changedByAdminId,
      OldValue: entry.oldValue,
      NewValue: entry.newValue,
      Reason: entry.reason,
      UTID: entry.utid,
      CreatedAt: entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "",
    }));

    const wb = XLSX.utils.book_new();
    const ledgerWs = XLSX.utils.json_to_sheet(ledgerRows);
    const pricingWs = XLSX.utils.json_to_sheet(pricingRows);
    XLSX.utils.book_append_sheet(wb, ledgerWs, "FarmCoin Ledger");
    XLSX.utils.book_append_sheet(wb, pricingWs, "Token Pricing History");
    XLSX.writeFile(wb, "farmcoin-ledger-export.xlsx");
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

      {message && (
        <div style={{
          padding: "1rem",
          marginBottom: "1.5rem",
          borderRadius: "8px",
          background: message.type === "success" ? "#e8f5e9" : "#ffebee",
          color: message.type === "success" ? "#2e7d32" : "#c62828",
          border: `1px solid ${message.type === "success" ? "#c8e6c9" : "#ffcdd2"}`,
        }}>
          {message.text}
        </div>
      )}

      <div style={{
        padding: "1.5rem",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        marginBottom: "2rem",
      }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>FarmCoin Tokens</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
          <div style={{ minWidth: "240px" }}>
            <div style={{ fontWeight: 600, marginBottom: "0.35rem" }}>Posting Cost</div>
            <div style={{ fontSize: "1.2rem", color: "#2e7d32" }}>
              {farmcoinSettings?.farmcoinPostingCost ?? 1} Token(s)
            </div>
          </div>
          <div style={{ minWidth: "240px" }}>
            <div style={{ fontWeight: 600, marginBottom: "0.35rem" }}>ETA Change Cost</div>
            <div style={{ fontSize: "1.2rem", color: "#2e7d32" }}>
              {farmcoinSettings?.farmcoinEtaChangeCost ?? 1} Token(s)
            </div>
          </div>
        </div>

        {isSuperAdmin && (
          <div style={{ marginTop: "1.5rem", display: "grid", gap: "0.75rem", maxWidth: 520 }}>
            <div style={{ fontWeight: 600 }}>Update Token Pricing</div>
            <input
              type="number"
              min={0}
              placeholder="Posting cost (tokens)"
              value={postingCost}
              onChange={(e) => setPostingCost(e.target.value)}
              style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ddd" }}
            />
            <input
              type="number"
              min={0}
              placeholder="ETA change cost (tokens)"
              value={etaCost}
              onChange={(e) => setEtaCost(e.target.value)}
              style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ddd" }}
            />
            <input
              type="text"
              placeholder="Reason for change"
              value={pricingReason}
              onChange={(e) => setPricingReason(e.target.value)}
              style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ddd" }}
            />
            <button
              type="button"
              onClick={async () => {
                if (!userId) return;
                try {
                  await updateFarmcoinPricing({
                    adminId: userId,
                    farmcoinPostingCost: postingCost ? Number(postingCost) : undefined,
                    farmcoinEtaChangeCost: etaCost ? Number(etaCost) : undefined,
                    reason: pricingReason || "Pricing update",
                  });
                  setMessage({ type: "success", text: "FarmCoin pricing updated." });
                  setPricingReason("");
                  setPostingCost("");
                  setEtaCost("");
                } catch (error: any) {
                  setMessage({ type: "error", text: error.message || "Failed to update pricing" });
                }
              }}
              style={{
                padding: "0.75rem 1rem",
                background: "#1976d2",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Update Pricing
            </button>
          </div>
        )}

        {isSuperAdmin && (
          <div style={{ marginTop: "1.5rem", display: "grid", gap: "0.75rem", maxWidth: 520 }}>
            <div style={{ fontWeight: 600 }}>Grant FarmCoin Tokens</div>
            <input
              type="text"
              placeholder="Trader ID"
              value={grantTraderId}
              onChange={(e) => setGrantTraderId(e.target.value)}
              style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ddd" }}
            />
            <input
              type="number"
              min={1}
              placeholder="Amount"
              value={grantAmount}
              onChange={(e) => setGrantAmount(e.target.value)}
              style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ddd" }}
            />
            <input
              type="text"
              placeholder="Reason"
              value={grantReason}
              onChange={(e) => setGrantReason(e.target.value)}
              style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ddd" }}
            />
            <button
              type="button"
              onClick={async () => {
                if (!userId) return;
                try {
                  await grantFarmcoinTokens({
                    adminId: userId,
                    traderId: grantTraderId as any,
                    amount: Number(grantAmount),
                    reason: grantReason || "Grant FarmCoin tokens",
                  });
                  setMessage({ type: "success", text: "FarmCoin tokens granted." });
                  setGrantTraderId("");
                  setGrantAmount("");
                  setGrantReason("");
                } catch (error: any) {
                  setMessage({ type: "error", text: error.message || "Failed to grant tokens" });
                }
              }}
              style={{
                padding: "0.75rem 1rem",
                background: "#2e7d32",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Grant Tokens
            </button>
          </div>
        )}

        {(isSuperAdmin || isFinanceAdmin) && (
          <div style={{ marginTop: "1.5rem" }}>
            <button
              type="button"
              onClick={handleExportFarmcoinLedger}
              style={{
                padding: "0.75rem 1rem",
                background: "#111827",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Export FarmCoin Ledger (Excel)
            </button>
          </div>
        )}
      </div>

      {isSuperAdmin && (
        <div style={{
          padding: "1.5rem",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          marginBottom: "2rem",
        }}>
          <h2 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>Trader Verification Queue</h2>
          {unverifiedTraders === undefined ? (
            <p>Loading traders...</p>
          ) : unverifiedTraders.length === 0 ? (
            <p style={{ color: "#666" }}>No pending traders.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #ddd" }}>
                    <th style={{ padding: "0.75rem", textAlign: "left" }}>Trader ID</th>
                    <th style={{ padding: "0.75rem", textAlign: "left" }}>Alias</th>
                    <th style={{ padding: "0.75rem", textAlign: "left" }}>Status</th>
                    <th style={{ padding: "0.75rem", textAlign: "left" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {unverifiedTraders.map((trader: any) => (
                    <tr key={trader._id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "0.75rem", fontFamily: "monospace" }}>{trader._id}</td>
                      <td style={{ padding: "0.75rem" }}>{trader.alias}</td>
                      <td style={{ padding: "0.75rem" }}>{trader.verificationStatus || "pending"}</td>
                      <td style={{ padding: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await verifyTrader({ adminId: userId as any, traderId: trader._id });
                              setMessage({ type: "success", text: "Trader verified." });
                            } catch (error: any) {
                              setMessage({ type: "error", text: error.message || "Failed to verify trader" });
                            }
                          }}
                          style={{
                            padding: "0.4rem 0.8rem",
                            borderRadius: 6,
                            border: "none",
                            background: "#2e7d32",
                            color: "#fff",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await rejectTrader({ adminId: userId as any, traderId: trader._id, reason: "Rejected by Superadmin" });
                              setMessage({ type: "success", text: "Trader rejected." });
                            } catch (error: any) {
                              setMessage({ type: "error", text: error.message || "Failed to reject trader" });
                            }
                          }}
                          style={{
                            padding: "0.4rem 0.8rem",
                            borderRadius: 6,
                            border: "none",
                            background: "#d32f2f",
                            color: "#fff",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {isSuperAdmin && (
        earnings === undefined ? (
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
        )
      )}
    </div>
  );
}
