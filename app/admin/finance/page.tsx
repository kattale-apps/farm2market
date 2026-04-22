"use client";

export const dynamic = "force-dynamic";

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
  const [selectedSentifyBatches, setSelectedSentifyBatches] = useState<Set<string>>(new Set());
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
  const sentifyBatches = useQuery(
    (api as any).buyers.getSentifyDeliveryBatches,
    userId && (isSuperAdmin || isFinanceAdmin) ? { adminId: userId } : "skip"
  );
  const farmerFormRewards = useQuery(
    (api as any).farmcoin.getFarmerFormRewards,
    userId && (isSuperAdmin || isFinanceAdmin) ? {} : "skip"
  );
  const paginationPreferences = useQuery(
    (api as any).userSettings.getPaginationPreferences,
    userId ? { userId } : "skip"
  );
  const updatePaginationPreferences = useMutation(
    (api as any).userSettings.updatePaginationPreferences
  );

  const updateFarmcoinPricing = useMutation((api as any).farmcoin.updateFarmcoinPricing);
  const grantFarmcoinTokens = useMutation((api as any).farmcoin.grantFarmcoinTokens);
  const setTraderVerificationStatus = useMutation((api as any).farmcoin.setTraderVerificationStatus);
  const superadminConfirmListingDelivery = useMutation((api as any).buyers.superadminConfirmListingDelivery);

  const [sentifyPage, setSentifyPage] = useState(1);
  const [sentifyPageSize, setSentifyPageSize] = useState(20);
  const [grantsPage, setGrantsPage] = useState(1);
  const [grantsPageSize, setGrantsPageSize] = useState(20);
  const [returnsPage, setReturnsPage] = useState(1);
  const [returnsPageSize, setReturnsPageSize] = useState(20);
  const [farmerRewardsExpanded, setFarmerRewardsExpanded] = useState(false);
  const sentifyPageKey = "finance_sentify_batches";
  const grantsPageKey = "finance_token_grants";
  const returnsPageKey = "finance_token_returns";

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

  useEffect(() => {
    if (!paginationPreferences) return;
    const defaultSize = paginationPreferences.defaultPageSize ?? 20;
    const nextSentify = paginationPreferences.list?.[sentifyPageKey] ?? defaultSize;
    const nextGrants = paginationPreferences.list?.[grantsPageKey] ?? defaultSize;
    const nextReturns = paginationPreferences.list?.[returnsPageKey] ?? defaultSize;
    if (nextSentify !== sentifyPageSize) {
      setSentifyPageSize(nextSentify);
      setSentifyPage(1);
    }
    if (nextGrants !== grantsPageSize) {
      setGrantsPageSize(nextGrants);
      setGrantsPage(1);
    }
    if (nextReturns !== returnsPageSize) {
      setReturnsPageSize(nextReturns);
      setReturnsPage(1);
    }
  }, [paginationPreferences, sentifyPageKey, grantsPageKey, returnsPageKey, sentifyPageSize, grantsPageSize, returnsPageSize]);

  const formatUGX = (amount: number) => {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(amount);
  };

  const sentifyTotal = sentifyBatches?.length ?? 0;
  const sentifyTotalPages = Math.max(1, Math.ceil(sentifyTotal / sentifyPageSize));
  const sentifyStart = sentifyTotal === 0 ? 0 : (sentifyPage - 1) * sentifyPageSize + 1;
  const sentifyEnd = Math.min(sentifyPage * sentifyPageSize, sentifyTotal);
  const pagedSentifyBatches = (sentifyBatches || []).slice(
    (sentifyPage - 1) * sentifyPageSize,
    sentifyPage * sentifyPageSize
  );
  const grantsTotal = superadminFarmcoinActivity?.grants?.length ?? 0;
  const grantsTotalPages = Math.max(1, Math.ceil(grantsTotal / grantsPageSize));
  const grantsStart = grantsTotal === 0 ? 0 : (grantsPage - 1) * grantsPageSize + 1;
  const grantsEnd = Math.min(grantsPage * grantsPageSize, grantsTotal);
  const pagedGrants = (superadminFarmcoinActivity?.grants || []).slice(
    (grantsPage - 1) * grantsPageSize,
    grantsPage * grantsPageSize
  );
  const returnsTotal = superadminFarmcoinActivity?.returns?.length ?? 0;
  const returnsTotalPages = Math.max(1, Math.ceil(returnsTotal / returnsPageSize));
  const returnsStart = returnsTotal === 0 ? 0 : (returnsPage - 1) * returnsPageSize + 1;
  const returnsEnd = Math.min(returnsPage * returnsPageSize, returnsTotal);
  const pagedReturns = (superadminFarmcoinActivity?.returns || []).slice(
    (returnsPage - 1) * returnsPageSize,
    returnsPage * returnsPageSize
  );

  useEffect(() => {
    if (sentifyPage > sentifyTotalPages) {
      setSentifyPage(sentifyTotalPages);
    }
  }, [sentifyPage, sentifyTotalPages]);

  useEffect(() => {
    if (grantsPage > grantsTotalPages) {
      setGrantsPage(grantsTotalPages);
    }
  }, [grantsPage, grantsTotalPages]);

  useEffect(() => {
    if (returnsPage > returnsTotalPages) {
      setReturnsPage(returnsTotalPages);
    }
  }, [returnsPage, returnsTotalPages]);

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

  const handleToggleSentifyBatch = (batchUtid: string) => {
    const updated = new Set(selectedSentifyBatches);
    if (updated.has(batchUtid)) {
      updated.delete(batchUtid);
    } else {
      updated.add(batchUtid);
    }
    setSelectedSentifyBatches(updated);
  };

  const handleSelectAllSentify = () => {
    if (!sentifyBatches || sentifyBatches.length === 0) return;
    if (selectedSentifyBatches.size === sentifyBatches.length) {
      setSelectedSentifyBatches(new Set());
      return;
    }
    setSelectedSentifyBatches(new Set(sentifyBatches.map((batch: any) => batch.batchUtid)));
  };

  const handleConfirmSentifyBatches = async () => {
    if (!userId || selectedSentifyBatches.size === 0) return;
    try {
      await superadminConfirmListingDelivery({
        adminId: userId as any,
        batchUtids: Array.from(selectedSentifyBatches),
      });
      setMessage({ type: "success", text: "Sentify delivery confirmations processed." });
      setSelectedSentifyBatches(new Set());
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message || "Failed to confirm deliveries" });
    }
  };

  

  const handleExportFarmcoinLedger = () => {
    if (!farmcoinLedger || !farmcoinHistory) return;

    const ledgerRows = farmcoinLedger.map((entry: any) => ({
      AccountType: entry.accountType,
      TraderId: entry.traderId || "",
      UserId: entry.userId || "",
      Delta: entry.delta,
      BalanceAfter: entry.balanceAfter,
      Source: entry.source,
      ListingId: entry.listingId || "",
      BatchUTID: entry.batchUtid || "",
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
    const sentifyRows = farmcoinLedger
      .filter((entry: any) => entry.accountType === "sentify")
      .map((entry: any) => ({
        AccountType: entry.accountType,
        UserId: entry.userId || entry.traderId || "",
        Delta: entry.delta,
        BalanceAfter: entry.balanceAfter,
        Source: entry.source,
        ListingId: entry.listingId || "",
        BatchUTID: entry.batchUtid || "",
        UTID: entry.utid,
        CreatedAt: entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "",
      }));
    const sentifyWs = XLSX.utils.json_to_sheet(sentifyRows);
    XLSX.utils.book_append_sheet(wb, ledgerWs, "FarmCoin Ledger");
    XLSX.utils.book_append_sheet(wb, pricingWs, "Token Pricing History");
    XLSX.utils.book_append_sheet(wb, sentifyWs, "Sentify Wallet");
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
          <div style={{ marginTop: "1.5rem", display: "grid", gap: "0.75rem", maxWidth: 520, width: "100%" }}>
            <div style={{ fontWeight: 600 }}>Grant FarmCoin Tokens</div>
            <select
              value={grantTraderId}
              onChange={(e) => setGrantTraderId(e.target.value)}
              style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ddd", width: "100%", minWidth: 0 }}
            >
              <option value="">Select trader</option>
              {traderOptions.map((trader: any) => (
                <option key={trader._id} value={trader._id}>
                  {trader.alias || "Trader"} • {trader._id?.slice(0, 6)}…{trader._id?.slice(-4)}
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
              style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ddd", width: "100%", minWidth: 0 }}
            />
            <input
              type="text"
              placeholder="Reason"
              value={grantReason}
              onChange={(e) => setGrantReason(e.target.value)}
              style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ddd", width: "100%", minWidth: 0 }}
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
                width: "100%",
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

        {isSuperAdmin && (
          <div style={{ marginTop: "2rem" }}>
            <div style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Pending Delivery Confirmations (Sentify)</div>
            {sentifyBatches === undefined ? (
              <p style={{ color: "#999" }}>Loading delivery batches...</p>
            ) : !sentifyBatches || sentifyBatches.length === 0 ? (
              <p style={{ color: "#666" }}>No delivery batches available.</p>
            ) : (
              <>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={handleSelectAllSentify}
                    style={{
                      padding: "0.5rem 0.9rem",
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      background: "#f5f5f5",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                    }}
                  >
                    {selectedSentifyBatches.size === sentifyBatches.length ? "Clear Selection" : "Select All"}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSentifyBatches}
                    disabled={selectedSentifyBatches.size === 0}
                    style={{
                      padding: "0.5rem 0.9rem",
                      borderRadius: 8,
                      border: "none",
                      background: selectedSentifyBatches.size === 0 ? "#ccc" : "#1976d2",
                      color: "#fff",
                      cursor: selectedSentifyBatches.size === 0 ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                    }}
                  >
                    Confirm Delivery (Release Escrow)
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.85rem", color: "#666" }}>Per page:</span>
                    <select
                      value={sentifyPageSize}
                      onChange={(e) => {
                        const nextSize = Number(e.target.value);
                        setSentifyPageSize(nextSize);
                        setSentifyPage(1);
                        updatePaginationPreferences({
                          userId: userId as any,
                          listKey: sentifyPageKey,
                          pageSize: nextSize,
                        } as any);
                      }}
                      style={{ padding: "0.35rem 0.6rem", borderRadius: 6, border: "1px solid #ddd", fontSize: "0.85rem" }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e0e0e0", background: "#f9f9f9" }}>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>
                          <input
                            type="checkbox"
                            checked={selectedSentifyBatches.size === sentifyBatches.length}
                            onChange={handleSelectAllSentify}
                          />
                        </th>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Batch UTID</th>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Product</th>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Total Cost (UGX)</th>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Buyer Confirms</th>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Trader Confirmed</th>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Sentify Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedSentifyBatches.map((batch: any) => (
                        <tr key={batch.batchUtid} style={{ borderBottom: "1px solid #f0f0f0" }}>
                          <td style={{ padding: "0.6rem" }}>
                            <input
                              type="checkbox"
                              checked={selectedSentifyBatches.has(batch.batchUtid)}
                              onChange={() => handleToggleSentifyBatch(batch.batchUtid)}
                            />
                          </td>
                          <td style={{ padding: "0.6rem", fontFamily: "monospace" }}>{batch.batchUtid}</td>
                          <td style={{ padding: "0.6rem" }}>{batch.productName}</td>
                          <td style={{ padding: "0.6rem" }}>{formatUGX(batch.totalCost)}</td>
                          <td style={{ padding: "0.6rem" }}>{batch.buyerConfirmedCount}/{batch.purchaseCount}</td>
                          <td style={{ padding: "0.6rem" }}>{batch.traderConfirmedAt ? "Yes" : "No"}</td>
                          <td style={{ padding: "0.6rem" }}>{batch.sentifyUtid || "Pending"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sentifyTotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div style={{ fontSize: "0.85rem", color: "#666" }}>
                      Showing {sentifyStart}-{sentifyEnd} of {sentifyTotal}
                    </div>
                    {sentifyTotalPages > 1 && (
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          type="button"
                          onClick={() => setSentifyPage((p) => Math.max(1, p - 1))}
                          disabled={sentifyPage === 1}
                          style={{
                            padding: "0.35rem 0.7rem",
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: sentifyPage === 1 ? "#f1f5f9" : "#fff",
                            cursor: sentifyPage === 1 ? "not-allowed" : "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Prev
                        </button>
                        <button
                          type="button"
                          onClick={() => setSentifyPage((p) => Math.min(sentifyTotalPages, p + 1))}
                          disabled={sentifyPage >= sentifyTotalPages}
                          style={{
                            padding: "0.35rem 0.7rem",
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: sentifyPage >= sentifyTotalPages ? "#f1f5f9" : "#fff",
                            cursor: sentifyPage >= sentifyTotalPages ? "not-allowed" : "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
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

        {isSuperAdmin && (
          <div style={{ marginTop: "2rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Sentify Delivery Confirmations</h3>
            {sentifyBatches === undefined ? (
              <p style={{ color: "#999" }}>Loading batches...</p>
            ) : sentifyBatches.length === 0 ? (
              <p style={{ color: "#666" }}>No delivery batches found</p>
            ) : (
              <>
                <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" }}>
                    <input
                      type="checkbox"
                      checked={selectedSentifyBatches.size === sentifyBatches.length && sentifyBatches.length > 0}
                      onChange={handleSelectAllSentify}
                    />
                    Select all
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.85rem", color: "#666" }}>Per page:</span>
                    <select
                      value={sentifyPageSize}
                      onChange={(e) => {
                        const nextSize = Number(e.target.value);
                        setSentifyPageSize(nextSize);
                        setSentifyPage(1);
                        updatePaginationPreferences({
                          userId: userId as any,
                          listKey: sentifyPageKey,
                          pageSize: nextSize,
                        } as any);
                      }}
                      style={{ padding: "0.35rem 0.6rem", borderRadius: 6, border: "1px solid #ddd", fontSize: "0.85rem" }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirmSentifyBatches}
                    disabled={selectedSentifyBatches.size === 0}
                    style={{
                      padding: "0.5rem 0.9rem",
                      background: selectedSentifyBatches.size === 0 ? "#ccc" : "#2e7d32",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      fontWeight: 600,
                      cursor: selectedSentifyBatches.size === 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    Confirm Selected Deliveries
                  </button>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e0e0e0", background: "#f9f9f9" }}>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Select</th>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Batch UTID</th>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Product</th>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Purchases</th>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Total Cost (UGX)</th>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Trader Confirmed</th>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Buyer Confirmed</th>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Superadmin Confirmed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedSentifyBatches.map((batch: any) => (
                        <tr key={batch.batchUtid} style={{ borderBottom: "1px solid #f0f0f0" }}>
                          <td style={{ padding: "0.6rem" }}>
                            <input
                              type="checkbox"
                              checked={selectedSentifyBatches.has(batch.batchUtid)}
                              onChange={() => handleToggleSentifyBatch(batch.batchUtid)}
                            />
                          </td>
                          <td style={{ padding: "0.6rem", fontFamily: "monospace" }}>{batch.batchUtid}</td>
                          <td style={{ padding: "0.6rem" }}>{batch.productName || batch.produceType}</td>
                          <td style={{ padding: "0.6rem" }}>{batch.purchaseCount}</td>
                          <td style={{ padding: "0.6rem" }}>{formatUGX(batch.totalCost)}</td>
                          <td style={{ padding: "0.6rem" }}>{batch.traderConfirmedAt ? "Yes" : "No"}</td>
                          <td style={{ padding: "0.6rem" }}>{batch.buyerConfirmedCount || 0} / {batch.purchaseCount}</td>
                          <td style={{ padding: "0.6rem" }}>{batch.superadminConfirmedAt ? "Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sentifyTotal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div style={{ fontSize: "0.85rem", color: "#666" }}>
                      Showing {sentifyStart}-{sentifyEnd} of {sentifyTotal}
                    </div>
                    {sentifyTotalPages > 1 && (
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          type="button"
                          onClick={() => setSentifyPage((p) => Math.max(1, p - 1))}
                          disabled={sentifyPage === 1}
                          style={{
                            padding: "0.35rem 0.7rem",
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: sentifyPage === 1 ? "#f1f5f9" : "#fff",
                            cursor: sentifyPage === 1 ? "not-allowed" : "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Prev
                        </button>
                        <button
                          type="button"
                          onClick={() => setSentifyPage((p) => Math.min(sentifyTotalPages, p + 1))}
                          disabled={sentifyPage >= sentifyTotalPages}
                          style={{
                            padding: "0.35rem 0.7rem",
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            background: sentifyPage >= sentifyTotalPages ? "#f1f5f9" : "#fff",
                            cursor: sentifyPage >= sentifyTotalPages ? "not-allowed" : "pointer",
                            fontWeight: 600,
                          }}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
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
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.85rem", color: "#666" }}>Per page:</span>
                      <select
                        value={grantsPageSize}
                        onChange={(e) => {
                          const nextSize = Number(e.target.value);
                          setGrantsPageSize(nextSize);
                          setGrantsPage(1);
                          updatePaginationPreferences({
                            userId: userId as any,
                            listKey: grantsPageKey,
                            pageSize: nextSize,
                          } as any);
                        }}
                        style={{ padding: "0.35rem 0.6rem", borderRadius: 6, border: "1px solid #ddd", fontSize: "0.85rem" }}
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
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
                          {pagedGrants.map((entry: any, idx: number) => (
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
                    {grantsTotal > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                        <div style={{ fontSize: "0.85rem", color: "#666" }}>
                          Showing {grantsStart}-{grantsEnd} of {grantsTotal}
                        </div>
                        {grantsTotalPages > 1 && (
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                              type="button"
                              onClick={() => setGrantsPage((p) => Math.max(1, p - 1))}
                              disabled={grantsPage === 1}
                              style={{
                                padding: "0.35rem 0.7rem",
                                borderRadius: 6,
                                border: "1px solid #ddd",
                                background: grantsPage === 1 ? "#f1f5f9" : "#fff",
                                cursor: grantsPage === 1 ? "not-allowed" : "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Prev
                            </button>
                            <button
                              type="button"
                              onClick={() => setGrantsPage((p) => Math.min(grantsTotalPages, p + 1))}
                              disabled={grantsPage >= grantsTotalPages}
                              style={{
                                padding: "0.35rem 0.7rem",
                                borderRadius: 6,
                                border: "1px solid #ddd",
                                background: grantsPage >= grantsTotalPages ? "#f1f5f9" : "#fff",
                                cursor: grantsPage >= grantsTotalPages ? "not-allowed" : "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <h3 style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>Tokens Returned to Central Pool</h3>
                {superadminFarmcoinActivity.returns.length === 0 ? (
                  <p style={{ color: "#666" }}>No returns recorded yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div style={{ marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.85rem", color: "#666" }}>Per page:</span>
                      <select
                        value={returnsPageSize}
                        onChange={(e) => {
                          const nextSize = Number(e.target.value);
                          setReturnsPageSize(nextSize);
                          setReturnsPage(1);
                          updatePaginationPreferences({
                            userId: userId as any,
                            listKey: returnsPageKey,
                            pageSize: nextSize,
                          } as any);
                        }}
                        style={{ padding: "0.35rem 0.6rem", borderRadius: 6, border: "1px solid #ddd", fontSize: "0.85rem" }}
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
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
                          {pagedReturns.map((entry: any, idx: number) => (
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
                    {returnsTotal > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                        <div style={{ fontSize: "0.85rem", color: "#666" }}>
                          Showing {returnsStart}-{returnsEnd} of {returnsTotal}
                        </div>
                        {returnsTotalPages > 1 && (
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button
                              type="button"
                              onClick={() => setReturnsPage((p) => Math.max(1, p - 1))}
                              disabled={returnsPage === 1}
                              style={{
                                padding: "0.35rem 0.7rem",
                                borderRadius: 6,
                                border: "1px solid #ddd",
                                background: returnsPage === 1 ? "#f1f5f9" : "#fff",
                                cursor: returnsPage === 1 ? "not-allowed" : "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Prev
                            </button>
                            <button
                              type="button"
                              onClick={() => setReturnsPage((p) => Math.min(returnsTotalPages, p + 1))}
                              disabled={returnsPage >= returnsTotalPages}
                              style={{
                                padding: "0.35rem 0.7rem",
                                borderRadius: 6,
                                border: "1px solid #ddd",
                                background: returnsPage >= returnsTotalPages ? "#f1f5f9" : "#fff",
                                cursor: returnsPage >= returnsTotalPages ? "not-allowed" : "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </div>
                    )}
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

      {/* ─── Farmer Form Rewards Section ─── */}
      {(isSuperAdmin || isFinanceAdmin) && (
        <div style={{
          background: "#fff", borderRadius: 14, padding: "1.25rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)", marginTop: "1.5rem",
          border: "1px solid #e0e0e0",
        }}>
          <div
            onClick={() => setFarmerRewardsExpanded(!farmerRewardsExpanded)}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.3rem" }}>🌱</span>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#1b5e20" }}>
                Farmer Form Entry Rewards
              </h3>
              {farmerFormRewards && (
                <span style={{
                  fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px",
                  borderRadius: 999, background: "#fff8e1", color: "#f57f17",
                  border: "1px solid #f9a825"
                }}>
                  🪙 {farmerFormRewards.reduce((sum: number, e: any) => sum + (e.delta || 0), 0)} total issued
                </span>
              )}
            </div>
            <span style={{ fontSize: "1rem", color: "#888" }}>
              {farmerRewardsExpanded ? "▲" : "▼"}
            </span>
          </div>

          {farmerRewardsExpanded && (
            <div style={{ marginTop: "1rem" }}>
              {!farmerFormRewards ? (
                <p style={{ color: "#999", fontSize: "0.85rem" }}>Loading...</p>
              ) : farmerFormRewards.length === 0 ? (
                <p style={{ color: "#999", fontSize: "0.85rem" }}>
                  No farmer form rewards issued yet. Farmers earn FarmCoins by completing tracker and profile forms.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e0e0e0", background: "#f5f5f5" }}>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Farmer</th>
                        <th style={{ padding: "0.6rem", textAlign: "right" }}>Coins</th>
                        <th style={{ padding: "0.6rem", textAlign: "right" }}>Fields</th>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>UTID</th>
                        <th style={{ padding: "0.6rem", textAlign: "left" }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {farmerFormRewards.slice(0, 50).map((entry: any) => (
                        <tr key={entry._id} style={{ borderBottom: "1px solid #eee" }}>
                          <td style={{ padding: "0.6rem", fontWeight: 500 }}>
                            {entry.farmerName}
                          </td>
                          <td style={{ padding: "0.6rem", textAlign: "right", fontWeight: 700, color: "#f57f17" }}>
                            🪙 {entry.delta}
                          </td>
                          <td style={{ padding: "0.6rem", textAlign: "right", color: "#666" }}>
                            {entry.fieldCount || entry.delta}
                          </td>
                          <td style={{ padding: "0.6rem", fontFamily: "monospace", fontSize: "0.72rem", color: "#888" }}>
                            {entry.utid}
                          </td>
                          <td style={{ padding: "0.6rem", color: "#888", fontSize: "0.75rem" }}>
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {farmerFormRewards.length > 50 && (
                    <p style={{ color: "#999", fontSize: "0.75rem", textAlign: "center", marginTop: 8 }}>
                      Showing 50 of {farmerFormRewards.length} entries
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
