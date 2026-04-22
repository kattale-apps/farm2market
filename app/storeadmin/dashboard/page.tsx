"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function StoreAdminDashboardPage() {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const utids = useQuery(
    api.storeAdmin.getStoreAdminUTIDs,
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

  if (!userId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Please log in to access the StoreAdmin dashboard.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "clamp(1rem, 4vw, 2rem)", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", marginBottom: "1.5rem" }}>
        StoreAdmin Dashboard
      </h1>
      <p style={{ marginBottom: "2rem", color: "#666" }}>
        Manage deliveries for your assigned storage locations. You can only verify deliveries for UTIDs from your assigned locations.
      </p>

      {/* Quick Actions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <Link
          href="/storeadmin/delivery-verification"
          style={{
            padding: "1.5rem",
            background: "#4caf50",
            color: "white",
            borderRadius: "12px",
            textDecoration: "none",
            textAlign: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            transition: "transform 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✓</div>
          <div style={{ fontSize: "1.2rem", fontWeight: "600", marginBottom: "0.25rem" }}>
            Verify Delivery
          </div>
          <div style={{ fontSize: "0.9rem", opacity: 0.9 }}>
            Confirm deliveries with photos and PDF
          </div>
        </Link>
      </div>

      {/* Pending Verifications */}
      <div
        style={{
          padding: "1.5rem",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        <h2 style={{ fontSize: "1.3rem", marginBottom: "1rem" }}>Pending Delivery Verifications</h2>
        {utids === undefined ? (
          <p>Loading UTIDs...</p>
        ) : utids.length === 0 ? (
          <p style={{ color: "#666", padding: "2rem", textAlign: "center" }}>
            No pending deliveries for verification. All deliveries may have been verified.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {utids.map((utid: any) => (
              <div
                key={utid.utid}
                style={{
                  padding: "1rem",
                  background: "#f5f5f5",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
                      {utid.produceType} - {utid.units.length} unit(s)
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "#666", fontFamily: "monospace" }}>
                      UTID: {utid.utid}
                    </div>
                  </div>
                  <Link
                    href="/storeadmin/delivery-verification"
                    style={{
                      padding: "0.75rem 1.5rem",
                      background: "#4caf50",
                      color: "white",
                      textDecoration: "none",
                      borderRadius: "6px",
                      fontWeight: "600",
                      fontSize: "0.9rem",
                    }}
                  >
                    Verify
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
