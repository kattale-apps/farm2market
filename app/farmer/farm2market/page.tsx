"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Farm2MarketContent } from "../../components/Farm2MarketContent";
import Link from "next/link";
import { useStoredUser } from "../../hooks/useStoredUser";

const BRAND = "#2e7d32";
const FONT = '"Montserrat", sans-serif';

export default function Farm2MarketPage() {
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) || null;
  const [isMobile, setIsMobile] = useState(false);

  const farm2MarketAccess = useQuery(
    (api as any).farmcoin.getFarm2MarketAccess,
    userId ? { farmerId: userId } : "skip"
  ) as { allowed: boolean; isPilotExempt: boolean; balance: number; requiredBalance: number; reason: string | null } | undefined;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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

  // FarmCoin gate: wait for access check to resolve, then block if not allowed
  if (farm2MarketAccess === undefined) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ color: "#666" }}>Checking access…</p>
      </div>
    );
  }

  if (!farm2MarketAccess.allowed) {
    const still = farm2MarketAccess.requiredBalance - farm2MarketAccess.balance;
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
            <span style={{ fontSize: "1.4rem" }}>🛒</span>
            <h1 style={{ margin: 0, fontSize: "clamp(1rem, 4vw, 1.2rem)", fontWeight: 700, fontFamily: FONT }}>
              Farm 2 Market
            </h1>
          </div>
        </div>
        {/* Lock screen */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "calc(100vh - 56px)",
          padding: "2rem 1.5rem",
          textAlign: "center",
          gap: "1.25rem",
        }}>
          <div style={{
            background: "#fff",
            borderRadius: "18px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
            border: "1.5px solid #e0e0e0",
            padding: "2rem 1.5rem",
            maxWidth: 360,
            width: "100%",
          }}>
            <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🔒</div>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.2rem", fontWeight: 700, color: "#2c2c2c", fontFamily: FONT }}>
              Farm 2 Market Locked
            </h2>
            <p style={{ margin: "0 0 1rem", color: "#555", fontSize: "0.95rem", lineHeight: 1.5, fontFamily: FONT }}>
              You need <strong>500 FarmCoins</strong> to unlock Farm 2 Market.<br />
              Earn FarmCoins by completing farm data submissions.
            </p>
            {/* Progress bar */}
            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#888", marginBottom: "0.3rem", fontFamily: FONT }}>
                <span>🪙 Your balance</span>
                <span>{farm2MarketAccess.balance} / {farm2MarketAccess.requiredBalance}</span>
              </div>
              <div style={{ height: 10, background: "#f0f0f0", borderRadius: 8, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(100, (farm2MarketAccess.balance / farm2MarketAccess.requiredBalance) * 100)}%`,
                  background: "linear-gradient(90deg, #fbc02d, #f9a825)",
                  borderRadius: 8,
                  transition: "width 0.4s ease",
                }} />
              </div>
            </div>
            <p style={{ margin: 0, color: "#795548", fontSize: "0.82rem", fontWeight: 600, fontFamily: FONT }}>
              {still} more FarmCoin{still === 1 ? "" : "s"} needed to unlock
            </p>
          </div>
          <Link href="/" style={{ color: BRAND, textDecoration: "none", fontWeight: 700, fontFamily: FONT, fontSize: "0.9rem" }}>
            ← Back to Dashboard
          </Link>
        </div>
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
          <span style={{ fontSize: "1.4rem" }}>🛒</span>
          <h1 style={{ margin: 0, fontSize: "clamp(1rem, 4vw, 1.2rem)", fontWeight: 700, fontFamily: FONT }}>
            Farm 2 Market
          </h1>
        </div>
      </div>

      {/* Content */}
      <Farm2MarketContent userId={userId} isMobile={isMobile} />
    </div>
  );
}
