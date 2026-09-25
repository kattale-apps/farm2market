"use client";

/**
 * Farm Needs (farmer dashboard).
 *
 * For now this page is only the two Diagnostics checks - "Check my crops" and
 * "Check my animals" - which any farmer can use. The Farm Needs forms that used to be listed here
 * were removed from this page at the owner's request (2026-09-25; no
 * community had any); their backend and admin page are unchanged.
 */

import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useOfflineQuery } from "../../hooks/useOfflineQuery";
import { useStoredUser } from "../../hooks/useStoredUser";

const BRAND = "#2e7d32";
const BRAND_BG = "#e8f5e9";
const FONT = '"Montserrat", sans-serif';

const CHECKS = [
  { kind: "crops", emoji: "🌱", title: "Check my crops", hint: "Find pests, diseases and missing nutrients" },
  { kind: "animals", emoji: "🐄", title: "Check my animals", hint: "Find animal diseases and pests" },
] as const;

export default function FarmNeedsPage() {
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) || null;

  const checkCommunities = useOfflineQuery(
    api.diagnosticsFarmer.listMyCheckCommunities,
    userId ? { userId } : "skip"
  );

  // Checks from here are recorded in the farmer's Diagnostics community when
  // they have one (so its admins see them and its AI photo check can run);
  // otherwise they are the farmer's own.
  const recordIn = Array.isArray(checkCommunities) && checkCommunities.length > 0 ? checkCommunities[0].communityId : null;

  if (authStatus === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ color: "#666" }}>Loading user session...</p>
      </div>
    );
  }

  if (authStatus === "unauthenticated" || !userId) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", flexDirection: "column", gap: "0.6rem" }}>
        <p style={{ color: "#666", margin: 0 }}>Your session expired. Please log in again.</p>
        <Link href="/login" style={{ color: BRAND, textDecoration: "none", fontWeight: 700 }}>Go to Login</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", fontFamily: FONT, width: "100%", overflowX: "hidden", boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{
        background: BRAND,
        color: "#fff",
        padding: "0.75rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }}>
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.3rem", lineHeight: 1 }}>←</Link>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.4rem" }}>🌱</span>
          <h1 style={{ margin: 0, fontSize: "clamp(1rem, 4vw, 1.2rem)", fontWeight: 700, fontFamily: FONT }}>
            Farm Needs
          </h1>
        </div>
      </div>

      <div style={{ padding: "1rem", maxWidth: "640px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {user?.role !== "farmer" ? (
          <div style={{ padding: "1.5rem", background: "#fff", borderRadius: "12px", textAlign: "center", border: "1px solid #e0e0e0" }}>
            <p style={{ fontSize: "2rem", margin: "0 0 0.5rem" }}>🔬</p>
            <p style={{ margin: 0, fontSize: "1rem", color: "#333" }}>Crop and animal checks are for farmer accounts.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {CHECKS.map((check) => (
              <Link
                key={check.kind}
                href={`/farmer/diagnose?kind=${check.kind}${recordIn ? `&communityId=${recordIn}` : ""}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.9rem",
                  padding: "1.1rem 1rem",
                  background: "#fff",
                  borderRadius: "14px",
                  border: `2px solid ${BRAND}`,
                  minHeight: 76,
                }}>
                  <div style={{
                    width: 58,
                    height: 58,
                    borderRadius: 14,
                    background: BRAND_BG,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "2rem",
                    flexShrink: 0,
                  }}>
                    {check.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a1a1a" }}>{check.title}</div>
                    <div style={{ fontSize: "0.82rem", color: "#666" }}>{check.hint}</div>
                  </div>
                  <span style={{ fontSize: "1.3rem", color: "#bbb" }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
