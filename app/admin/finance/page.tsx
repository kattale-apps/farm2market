"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";

export default function FinanceDashboardPage() {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [pricingReason, setPricingReason] = useState("");
  const [postingCost, setPostingCost] = useState<string>("");
  const [etaCost, setEtaCost] = useState<string>("");
  const [grantTraderId, setGrantTraderId] = useState<string>("");
  const [grantAmount, setGrantAmount] = useState<string>("");
  const [grantReason, setGrantReason] = useState("");
  const [verificationFilter, setVerificationFilter] = useState<"all" | "verified" | "unverified">("all");
  const [verificationTraderId, setVerificationTraderId] = useState<string>("");
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
  const superadminFarmcoinActivity = useQuery(
    (api as any).farmcoin.getSuperadminFarmcoinActivity,
    userId && isSuperAdmin ? { adminId: userId } : "skip"
  );
  const traderBalances = useQuery(
    (api as any).farmcoin.getFarmcoinTraderBalances,
    userId ? { adminId: userId } : "skip"
  );
  const traderVerificationList = useQuery(
    (api as any).farmcoin.getTraderVerificationList,
    userId ? { adminId: userId } : "skip"
  );

  const updateFarmcoinPricing = useMutation((api as any).farmcoin.updateFarmcoinPricing);
  const grantFarmcoinTokens = useMutation((api as any).farmcoin.grantFarmcoinTokens);
  const setTraderVerificationStatus = useMutation((api as any).farmcoin.setTraderVerificationStatus);

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

  const traderOptions = useMemo(() => {
    const traders = traderBalances?.traders ? [...traderBalances.traders] : [];
    return traders.sort((a, b) => (a.alias || "").localeCompare(b.alias || ""));
  }, [traderBalances]);

  const verificationOptions = useMemo(() => {
    const traders = traderVerificationList ? [...traderVerificationList] : [];
    const filtered = traders.filter((trader: any) => {
      if (verificationFilter === "verified") {
        return trader.verificationStatus === "verified";
      }
      if (verificationFilter === "unverified") {
        return trader.verificationStatus !== "verified";
      }
      return true;
    });
    return filtered.sort((a, b) => (a.alias || "").localeCompare(b.alias || ""));
  }, [traderVerificationList, verificationFilter]);

  

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <h2 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>FarmCoin Tokens</h2>
          <Link
            href="/"
            style={{
              padding: "0.5rem 0.9rem",
              background: "#f5f5f5",
              borderRadius: 8,
              border: "1px solid #ddd",
              textDecoration: "none",
              color: "#333",
              fontWeight: 600,
              fontSize: "0.85rem",
            }}
          >
            ← Back to Home
          </Link>
        </div>
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
            <select
              value={grantTraderId}
              onChange={(e) => setGrantTraderId(e.target.value)}
              style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ddd" }}
            >
              <option value="">Select trader</option>
              {traderOptions.map((trader: any) => (
                <option key={trader._id} value={trader._id}>
                  {trader.alias || "Trader"} • {trader._id}
                </option>
              ))}
            </select>
            {grantTraderId && (
              <div style={{ fontSize: "0.85rem", color: "#666" }}>
                Selected trader ID: <strong>{grantTraderId}</strong>
              </div>
            )}
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

        {isSuperAdmin && (
          <div style={{ marginTop: "1.5rem", display: "grid", gap: "0.75rem", maxWidth: 640 }}>
            <div style={{ fontWeight: 600 }}>Trader Verification Status</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
              <select
                value={verificationFilter}
                onChange={(e) => {
                  setVerificationFilter(e.target.value as any);
                  setVerificationTraderId("");
                }}
                style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ddd" }}
              >
                <option value="all">All traders</option>
                <option value="verified">Verified only</option>
                <option value="unverified">Not verified only</option>
              </select>
              <select
                value={verificationTraderId}
                onChange={(e) => setVerificationTraderId(e.target.value)}
                style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ddd" }}
              >
                <option value="">Select trader</option>
                {verificationOptions.map((trader: any) => (
                  <option key={trader._id} value={trader._id}>
                    {trader.alias || "Trader"} • {trader.verificationStatus}
                  </option>
                ))}
              </select>
            </div>
            {verificationTraderId && (
              <div style={{ fontSize: "0.85rem", color: "#666" }}>
                Selected trader ID: <strong>{verificationTraderId}</strong>
              </div>
            )}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={async () => {
                  if (!userId || !verificationTraderId) return;
                  try {
                    await setTraderVerificationStatus({
                      adminId: userId as any,
                      traderId: verificationTraderId as any,
                      status: "verified",
                    });
                    setMessage({ type: "success", text: "Trader verified." });
                  } catch (error: any) {
                    setMessage({ type: "error", text: error.message || "Failed to verify trader" });
                  }
                }}
                style={{
                  padding: "0.6rem 1rem",
                  borderRadius: 8,
                  border: "none",
                  background: "#2e7d32",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Mark Verified
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!userId || !verificationTraderId) return;
                  try {
                    await setTraderVerificationStatus({
                      adminId: userId as any,
                      traderId: verificationTraderId as any,
                      status: "pending",
                    });
                    setMessage({ type: "success", text: "Trader set to not verified." });
                  } catch (error: any) {
                    setMessage({ type: "error", text: error.message || "Failed to update trader" });
                  }
                }}
                style={{
                  padding: "0.6rem 1rem",
                  borderRadius: 8,
                  border: "none",
                  background: "#d32f2f",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Mark Not Verified
              </button>
            </div>
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
          <h2 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>FarmCoin Distribution & Returns</h2>
          {superadminFarmcoinActivity === undefined ? (
            <p>Loading FarmCoin activity...</p>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", marginBottom: "1.25rem" }}>
                <div style={{ minWidth: "240px" }}>
                  <div style={{ fontWeight: 600, marginBottom: "0.35rem" }}>Central Pool Balance</div>
                  <div style={{ fontSize: "1.3rem", color: "#2e7d32" }}>
                    {superadminFarmcoinActivity.centralBalance} Token(s)
                  </div>
                </div>
                <div style={{ minWidth: "240px" }}>
                  <div style={{ fontWeight: 600, marginBottom: "0.35rem" }}>Recent Returns to Central Pool</div>
                  <div style={{ fontSize: "0.95rem", color: "#666" }}>
                    {superadminFarmcoinActivity.returns.length} entry(ies)
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>Tokens Granted By You</h3>
                {superadminFarmcoinActivity.grants.length === 0 ? (
                  <p style={{ color: "#666" }}>No token grants found.</p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #ddd" }}>
                          <th style={{ padding: "0.75rem", textAlign: "left" }}>Trader</th>
                          <th style={{ padding: "0.75rem", textAlign: "right" }}>Amount</th>
                          <th style={{ padding: "0.75rem", textAlign: "left" }}>Reason</th>
                          <th style={{ padding: "0.75rem", textAlign: "left" }}>UTID</th>
                          <th style={{ padding: "0.75rem", textAlign: "left" }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {superadminFarmcoinActivity.grants.slice(0, 50).map((entry: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                            <td style={{ padding: "0.75rem" }}>
                              {entry.traderAlias || "Trader"}
                              <div style={{ fontSize: "0.8rem", color: "#666" }}>{entry.traderId}</div>
                            </td>
                            <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: 600 }}>
                              +{entry.delta}
                            </td>
                            <td style={{ padding: "0.75rem", color: "#666" }}>{entry.reason || "-"}</td>
                            <td style={{ padding: "0.75rem", fontFamily: "monospace" }}>{entry.utid}</td>
                            <td style={{ padding: "0.75rem", color: "#666" }}>
                              {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h3 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>Tokens Returned to Central Pool</h3>
                {superadminFarmcoinActivity.returns.length === 0 ? (
                  <p style={{ color: "#666" }}>No returns recorded yet.</p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #ddd" }}>
                          <th style={{ padding: "0.75rem", textAlign: "left" }}>Source</th>
                          <th style={{ padding: "0.75rem", textAlign: "right" }}>Amount</th>
                          <th style={{ padding: "0.75rem", textAlign: "left" }}>UTID</th>
                          <th style={{ padding: "0.75rem", textAlign: "left" }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {superadminFarmcoinActivity.returns.map((entry: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                            <td style={{ padding: "0.75rem" }}>{entry.source?.replace("_", " ")}</td>
                            <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: 600 }}>
                              +{entry.delta}
                            </td>
                            <td style={{ padding: "0.75rem", fontFamily: "monospace" }}>{entry.utid}</td>
                            <td style={{ padding: "0.75rem", color: "#666" }}>
                              {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}
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
