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

  const handleSeed = async () => {
    if (!userId) return;

    setLoading(true);
    setStatus("Seeding Uganda administrative units...");
    setResults(null);

    try {
      const res = await seedLocations({
        adminId: userId,
        skipExisting,
      });
      setResults(res);
      if (res.success) {
        setStatus("✅ Uganda locations seeded successfully!");
      } else {
        setStatus(`❌ Error: ${res.message || "Unknown error"}`);
      }
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
            This operation will create all districts in Uganda (135+ districts). 
            Subcounties and parishes are included for major districts as examples. 
            For complete subcounty and parish data, you may need to import additional data from UBOS or other official sources.
          </p>
        </div>
      </div>
    </div>
  );
}
