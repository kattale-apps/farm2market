"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";

export default function FixAdminPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const fixAdminLevel = useMutation(api.pilotSetup.fixAdminLevel);

  const handleFix = async () => {
    setLoading(true);
    try {
      const res = await fixAdminLevel();
      setResult(res);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Fix Admin Level</h1>
      <p>Click the button below to update admin@pilot.farm2market to superadmin level.</p>
      
      <button
        onClick={handleFix}
        disabled={loading}
        style={{
          padding: "0.75rem 1.5rem",
          background: "#2e7d32",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          fontSize: "1rem",
          fontWeight: "600",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "Updating..." : "Fix Admin Level"}
      </button>

      {result && (
        <div
          style={{
            marginTop: "1.5rem",
            padding: "1rem",
            background: result.error ? "#ffebee" : "#e8f5e9",
            border: `1px solid ${result.error ? "#ef5350" : "#4caf50"}`,
            borderRadius: "6px",
          }}
        >
          <pre style={{ margin: 0, fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: "2rem" }}>
        <a
          href="/"
          style={{
            color: "#1976d2",
            textDecoration: "none",
            fontSize: "0.95rem",
          }}
        >
          ← Back to Dashboard
        </a>
      </div>
    </div>
  );
}
