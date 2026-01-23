"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Id } from "../../../convex/_generated/dataModel";

export default function SeedLocationsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const seedLocations = useMutation(api.seedUgandaLocations.seedUgandaLocations);
  const [status, setStatus] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [skipExisting, setSkipExisting] = useState(true);
  const [batchSize, setBatchSize] = useState(200);

  // Get current user from localStorage (pilot mode)
  useEffect(() => {
    if (typeof window !== "undefined") {
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
          router.push("/login");
        }
      } catch (e) {
        console.error("Error reading user from localStorage:", e);
        router.push("/login");
      }
    }
  }, [router]);

  const runBatchStage = async (stage: "subcounties" | "parishes") => {
    if (!userId) return { created: 0, skipped: 0, errors: [] as string[] };

    let offset: number | null = 0;
    let totalCreated = 0;
    let totalSkipped = 0;
    const totalErrors: string[] = [];
    let total: number | undefined;

    while (offset !== null) {
      setStatus(
        `Seeding ${stage}... ${total ? `${Math.min(offset + batchSize, total)}/${total}` : `batch starting at ${offset}`}`
      );
      const res: any = await seedLocations({
        adminId: userId,
        skipExisting,
        stage,
        offset,
        limit: batchSize,
      });

      totalCreated += res.subcountiesCreated || res.parishesCreated || 0;
      totalSkipped += res.subcountiesSkipped || res.parishesSkipped || 0;
      if (res.errors?.length) {
        totalErrors.push(...res.errors);
      }
      total = res.total ?? total;
      offset = res.nextOffset ?? null;
    }

    return { created: totalCreated, skipped: totalSkipped, errors: totalErrors };
  };

  const handleSeed = async () => {
    if (!userId) return;

    setLoading(true);
    setStatus("Seeding Uganda administrative units...");
    setResults(null);

    try {
      const districtRes = await seedLocations({
        adminId: userId,
        skipExisting,
        stage: "districts",
      });

      const subcountyRes = await runBatchStage("subcounties");
      const parishRes = await runBatchStage("parishes");

      const combinedResults = {
        districtsCreated: districtRes.districtsCreated || 0,
        districtsSkipped: districtRes.districtsSkipped || 0,
        subcountiesCreated: subcountyRes.created,
        subcountiesSkipped: subcountyRes.skipped,
        parishesCreated: parishRes.created,
        parishesSkipped: parishRes.skipped,
        errors: [
          ...(districtRes.errors || []),
          ...subcountyRes.errors,
          ...parishRes.errors,
        ],
        success: true,
      };

      setResults(combinedResults);
      setStatus("✅ Uganda locations seeded successfully!");
    } catch (error: any) {
      setStatus(`❌ Error: ${error.message}`);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "clamp(1rem, 4vw, 2rem)", maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{
        background: "#fff",
        padding: "2rem",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0"
      }}>
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
          <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", marginBottom: "1rem", color: "#2c2c2c" }}>
            Seed Uganda Administrative Units
          </h1>
          <p style={{ color: "#666", marginBottom: "1.5rem", lineHeight: "1.6" }}>
            This will populate the database with Uganda&apos;s official administrative divisions:
            Districts, Subcounties, and Parishes from the latest UBOS data (2024).
          </p>
        </div>

        <div style={{ marginBottom: "2rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <input
              type="checkbox"
              checked={skipExisting}
              onChange={(e) => setSkipExisting(e.target.checked)}
              style={{ width: "18px", height: "18px" }}
            />
            <span style={{ color: "#2c2c2c" }}>
              Skip existing locations (recommended)
            </span>
          </label>
          <p style={{ fontSize: "0.9rem", color: "#666", marginLeft: "1.75rem" }}>
            If checked, locations that already exist will be skipped. If unchecked, the operation will fail if duplicates are found.
          </p>
          <label style={{ display: "block", marginTop: "1rem", fontSize: "0.9rem", color: "#2c2c2c", fontWeight: 600 }}>
            Batch size
          </label>
          <input
            type="number"
            min={50}
            max={500}
            step={50}
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            style={{
              width: "140px",
              marginTop: "0.5rem",
              padding: "0.5rem",
              border: "1px solid #ddd",
              borderRadius: "6px",
            }}
          />
          <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.5rem" }}>
            Recommended: 200. Larger batches may time out.
          </p>
        </div>

        {status && (
          <div
            style={{
              padding: "1rem",
              marginBottom: "1.5rem",
              borderRadius: "8px",
              background: status.includes("✅") ? "#d4edda" : "#f8d7da",
              color: status.includes("✅") ? "#155724" : "#721c24",
              border: `1px solid ${status.includes("✅") ? "#c3e6cb" : "#f5c6cb"}`,
            }}
          >
            {status}
          </div>
        )}

        {results && (
          <div style={{
            padding: "1.5rem",
            marginBottom: "1.5rem",
            background: "#f8f9fa",
            borderRadius: "8px",
            border: "1px solid #e9ecef"
          }}>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem", color: "#2c2c2c" }}>Seeding Results:</h3>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <div><strong>Districts Created:</strong> {results.districtsCreated}</div>
              <div><strong>Districts Skipped:</strong> {results.districtsSkipped}</div>
              <div><strong>Subcounties Created:</strong> {results.subcountiesCreated}</div>
              <div><strong>Subcounties Skipped:</strong> {results.subcountiesSkipped}</div>
              <div><strong>Parishes Created:</strong> {results.parishesCreated}</div>
              <div><strong>Parishes Skipped:</strong> {results.parishesSkipped}</div>
              {results.errors && results.errors.length > 0 && (
                <div style={{ marginTop: "1rem" }}>
                  <strong style={{ color: "#dc3545" }}>Errors:</strong>
                  <ul style={{ marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
                    {results.errors.map((error: string, idx: number) => (
                      <li key={idx} style={{ color: "#721c24", fontSize: "0.9rem" }}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleSeed}
          disabled={loading}
          style={{
            width: "100%",
            padding: "1rem",
            fontSize: "1.1rem",
            fontWeight: "600",
            background: loading ? "#ccc" : "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: loading ? "none" : "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          {loading ? "Seeding..." : "Seed Uganda Locations"}
        </button>

        <div style={{ marginTop: "2rem", padding: "1rem", background: "#fff3cd", borderRadius: "8px", border: "1px solid #ffc107" }}>
          <h4 style={{ fontSize: "1rem", marginBottom: "0.5rem", color: "#856404" }}>Note:</h4>
          <p style={{ fontSize: "0.9rem", color: "#856404", margin: 0, lineHeight: "1.6" }}>
            This uses the full Uganda administrative hierarchy (districts, subcounties, parishes) and runs in batches to avoid timeouts.
          </p>
        </div>
      </div>
    </div>
  );
}
