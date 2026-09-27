"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { Id } from "../../../convex/_generated/dataModel";
import { useStoredUser } from "../../hooks/useStoredUser";
import { BuyerOffersPanel } from "../../components/market/BuyerOffersPanel";

/** Vendors: buying offers for foodstuffs, farmers' bookings and cash receipts. */
export default function VendorBuyingPage() {
  const { user, status } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  if (status === "loading") return <div style={{ padding: "2rem" }}>Loading...</div>;
  if (!userId || user?.role !== "vendor") return <div style={{ padding: "2rem" }}>This page is for vendor accounts.</div>;
  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", fontFamily: '"Montserrat", sans-serif' }}>
      <div style={{ background: "#ef6c00", color: "#fff", padding: "0.75rem 1rem", display: "flex", gap: "0.75rem", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.3rem" }} aria-label="Back">
          ←
        </Link>
        <h1 style={{ margin: 0, fontSize: "clamp(1rem, 4vw, 1.2rem)" }}>🧺 Buying from farmers</h1>
      </div>
      <div style={{ padding: "1rem", maxWidth: 760, margin: "0 auto" }}>
        <BuyerOffersPanel userId={userId} />
      </div>
    </div>
  );
}
