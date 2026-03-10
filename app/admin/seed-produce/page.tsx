"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Id } from "../../../convex/_generated/dataModel";

export default function SeedProducePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [results, setResults] = useState<{ created: number; skipped: number; total: number } | null>(null);

  const seedProduce = useMutation((api as any).seedProduce.seedProduce);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pilot_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.userId && parsed.role === "admin") {
          setUserId(parsed.userId as Id<"users">);
        } else {
          router.push("/");
        }
      } else {
        router.push("/");
      }
    } catch {
      router.push("/");
    }
  }, [router]);

  const handleSeed = async () => {
    if (!userId) return;
    setLoading(true);
    setStatus("Seeding produce options...");
    try {
      const res = await seedProduce({ adminId: userId });
      setResults(res);
      setStatus(`✅ Done! Created ${res.created}, skipped ${res.skipped} (already existed).`);
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return <div style={{ padding: "2rem" }}>Checking admin access...</div>;
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <button
        onClick={() => router.push("/")}
        style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", marginBottom: "1rem", fontSize: "1rem" }}
      >
        ← Back to Dashboard
      </button>

      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.5rem" }}>Seed Produce Options</h1>
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>
        Populate the produce list with ~75 Ugandan market items across 10 categories.
        Existing items will be skipped (idempotent).
      </p>

      <button
        onClick={handleSeed}
        disabled={loading}
        style={{
          padding: "0.75rem 1.5rem",
          backgroundColor: loading ? "#ccc" : "#16a34a",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontSize: "1rem",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Seeding..." : "🌱 Seed Produce"}
      </button>

      {status && (
        <div style={{
          marginTop: "1rem",
          padding: "1rem",
          borderRadius: "8px",
          backgroundColor: status.startsWith("✅") ? "#f0fdf4" : status.startsWith("❌") ? "#fef2f2" : "#f0f9ff",
          color: status.startsWith("✅") ? "#166534" : status.startsWith("❌") ? "#991b1b" : "#1e40af",
        }}>
          {status}
        </div>
      )}

      {results && (
        <div style={{ marginTop: "1rem", padding: "1rem", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
          <p><strong>Total items:</strong> {results.total}</p>
          <p><strong>Created:</strong> {results.created}</p>
          <p><strong>Skipped (existing):</strong> {results.skipped}</p>
        </div>
      )}
    </div>
  );
}
