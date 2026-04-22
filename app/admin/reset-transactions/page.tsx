"use client";

export const dynamic = "force-dynamic";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetTransactionsPage() {
  const router = useRouter();
  const resetTransactions = useMutation(api.admin.resetAllTransactions);
  const [status, setStatus] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");

  const handleReset = async () => {
    if (confirmText !== "RESET") {
      setStatus("Please type 'RESET' to confirm");
      return;
    }

    if (!reason.trim()) {
      setStatus("Please provide a reason for resetting transactions");
      return;
    }

    setLoading(true);
    setStatus("Resetting all transactions...");
    
    try {
      // Get admin user from localStorage
      const userStr = localStorage.getItem("pilot_user");
      if (!userStr) {
        throw new Error("Not logged in");
      }
      const user = JSON.parse(userStr);
      if (user.role !== "admin") {
        throw new Error("Only admins can reset transactions");
      }

      const res = await resetTransactions({
        adminId: user.userId,
        reason: reason.trim(),
      });
      
      setResults(res);
      if (res.success) {
        setStatus("✅ All transactions reset successfully!");
      } else {
        setStatus(`❌ Error: ${res.error}`);
      }
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <button
          onClick={() => router.push("/")}
          style={{
            padding: "0.5rem 1rem",
            background: "#f5f5f5",
            border: "1px solid #ddd",
            borderRadius: "6px",
            cursor: "pointer",
            marginBottom: "1rem",
          }}
        >
          ← Back to Dashboard
        </button>
        <h1>Admin: Reset All Transactions</h1>
        <div style={{
          padding: "1rem",
          background: "#fff3cd",
          borderRadius: "8px",
          border: "1px solid #ffc107",
          marginTop: "1rem",
        }}>
          <p style={{ margin: 0, fontWeight: "600", color: "#856404" }}>
            ⚠️ DANGEROUS OPERATION
          </p>
          <p style={{ margin: "0.5rem 0 0 0", color: "#666", fontSize: "0.9rem" }}>
            This will permanently delete all wallet transactions, unlock all units, delete all inventory, and reset all listings. This action cannot be undone.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
          Reason for Reset (Required):
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., 'Pilot testing complete, resetting for fresh start'"
          style={{
            width: "100%",
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            minHeight: "80px",
            fontSize: "0.9rem",
          }}
        />
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
          Type &quot;RESET&quot; to confirm:
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="RESET"
          style={{
            width: "100%",
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "0.9rem",
          }}
        />
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <button
          onClick={handleReset}
          disabled={loading || confirmText !== "RESET" || !reason.trim()}
          style={{
            padding: "1rem 2rem",
            background: loading || confirmText !== "RESET" || !reason.trim() ? "#ccc" : "#d32f2f",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: loading || confirmText !== "RESET" || !reason.trim() ? "not-allowed" : "pointer",
            fontSize: "1rem",
            fontWeight: "600",
          }}
        >
          {loading ? "Resetting..." : "Reset All Transactions"}
        </button>
      </div>

      {status && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1rem",
            background: status.includes("✅") ? "#e8f5e9" : "#ffebee",
            borderRadius: "8px",
            border: `1px solid ${status.includes("✅") ? "#4caf50" : "#ef5350"}`,
          }}
        >
          <p style={{ margin: 0, fontWeight: "600" }}>{status}</p>
        </div>
      )}

      {results && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Results</h2>
          <div style={{ background: "#f5f5f5", padding: "1.5rem", borderRadius: "8px" }}>
            <h3>Summary</h3>
            {results.summary && (
              <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem" }}>
                <li>Wallet Entries Deleted: {results.summary.totalWalletEntriesDeleted || 0}</li>
                <li style={{ color: "#2e7d32", fontWeight: "600" }}>
                  ✅ Traders Restored: {results.summary.tradersRestored || 0} (each with 1,000,000 UGX)
                </li>
                <li>Units Unlocked: {results.summary.totalUnitsUnlocked || 0}</li>
                <li>Inventory Deleted: {results.summary.totalInventoryDeleted || 0}</li>
                <li>Purchases Deleted: {results.summary.totalPurchasesDeleted || 0}</li>
                <li>Listings Reset: {results.summary.totalListingsReset || 0}</li>
                <li>Errors: {results.summary.totalErrors || 0}</li>
              </ul>
            )}
            {results.utid && (
              <p style={{ marginTop: "1rem", fontSize: "0.85rem", color: "#666", fontFamily: "monospace" }}>
                UTID: {results.utid}
              </p>
            )}
            {results.results?.errors && results.results.errors.length > 0 && (
              <div style={{ marginTop: "1rem" }}>
                <h4 style={{ color: "#c62828" }}>Errors:</h4>
                <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem", color: "#c62828" }}>
                  {results.results.errors.map((error: string, idx: number) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ marginTop: "2rem" }}>
              <h4>Full Results (JSON):</h4>
              <pre
                style={{
                  background: "#fff",
                  padding: "1rem",
                  borderRadius: "6px",
                  overflow: "auto",
                  fontSize: "0.85rem",
                }}
              >
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
