"use client";

export const dynamic = "force-dynamic";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SeedDemoDataPage() {
  const router = useRouter();
  const seedDemo = useMutation(api.demoData.seedDemoData);
  const [status, setStatus] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    setLoading(true);
    setStatus("Seeding demo data...");
    try {
      const res = await seedDemo();
      setResults(res);
      if (res.success) {
        setStatus("✅ Demo data seeded successfully!");
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
        <h1>Admin: Seed Demo Data</h1>
        <p style={{ color: "#666" }}>
          This will create farmer listings and deposit money into trader and buyer wallets for pilot testing.
        </p>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <button
          onClick={handleSeed}
          disabled={loading}
          style={{
            padding: "1rem 2rem",
            background: loading ? "#ccc" : "#1976d2",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "1rem",
            fontWeight: "600",
          }}
        >
          {loading ? "Seeding..." : "Seed Demo Data"}
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
            <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem" }}>
              <li>Listings Created: {results.summary?.listingsCreated || 0}</li>
              <li>Trader Deposits: {results.summary?.traderDeposits || 0}</li>
              <li>Buyer Deposits: {results.summary?.buyerDeposits || 0}</li>
              <li>Errors: {results.summary?.errors || 0}</li>
            </ul>

            {results.details && (
              <div style={{ marginTop: "2rem" }}>
                {results.details.listings && results.details.listings.length > 0 && (
                  <div style={{ marginBottom: "1.5rem" }}>
                    <h4>Listings Created:</h4>
                    <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem" }}>
                      {results.details.listings.map((listing: any, idx: number) => (
                        <li key={idx}>
                          {listing.produceType} - {listing.totalKilos}kg @ UGX{" "}
                          {listing.pricePerKilo.toLocaleString()}/kg (UTID: {listing.utid})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {results.details.traderDeposits && results.details.traderDeposits.length > 0 && (
                  <div style={{ marginBottom: "1.5rem" }}>
                    <h4>Trader Deposits:</h4>
                    <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem" }}>
                      {results.details.traderDeposits.map((deposit: any, idx: number) => (
                        <li key={idx}>
                          {deposit.traderAlias}: UGX {deposit.amount.toLocaleString()} (UTID: {deposit.utid})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {results.details.buyerDeposits && results.details.buyerDeposits.length > 0 && (
                  <div style={{ marginBottom: "1.5rem" }}>
                    <h4>Buyer Deposits:</h4>
                    <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem" }}>
                      {results.details.buyerDeposits.map((deposit: any, idx: number) => (
                        <li key={idx}>
                          {deposit.buyerAlias}: UGX {deposit.amount.toLocaleString()} (UTID: {deposit.utid})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {results.details.errors && results.details.errors.length > 0 && (
                  <div style={{ marginBottom: "1.5rem" }}>
                    <h4 style={{ color: "#c62828" }}>Errors:</h4>
                    <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem", color: "#c62828" }}>
                      {results.details.errors.map((error: string, idx: number) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
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
