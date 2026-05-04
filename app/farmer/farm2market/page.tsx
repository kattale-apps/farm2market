"use client";

import { useEffect, useState } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { Farm2MarketContent } from "../../components/Farm2MarketContent";
import Link from "next/link";

const BRAND = "#2e7d32";
const FONT = '"Montserrat", sans-serif';

export default function Farm2MarketPage() {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("pilot_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUserId(parsed.userId);
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!userId) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ color: "#666" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", fontFamily: FONT }}>
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
