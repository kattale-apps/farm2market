"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { Id } from "../../convex/_generated/dataModel";
import { useStoredUser } from "../hooks/useStoredUser";
import { LotMarket } from "../components/lots/LotMarket";

/** Lots for sale from farmers, vendors and processors, for verified buyers of every kind. */
export default function LotsPage() {
  const { user, status } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  if (status === "loading") return <div style={{ padding: "2rem" }}>Loading...</div>;
  if (!userId) {
    return (
      <div style={{ padding: "2rem" }}>
        Please <Link href="/login">log in</Link> to buy lots.
      </div>
    );
  }
  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", fontFamily: '"Montserrat", sans-serif' }}>
      <div style={{ background: "#2e7d32", color: "#fff", padding: "0.75rem 1rem", display: "flex", gap: "0.75rem", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.3rem" }} aria-label="Back">
          ←
        </Link>
        <h1 style={{ margin: 0, fontSize: "clamp(1rem, 4vw, 1.2rem)" }}>🛒 Lots for sale</h1>
      </div>
      <div style={{ padding: "1rem", maxWidth: 760, margin: "0 auto" }}>
        <LotMarket userId={userId} />
      </div>
    </div>
  );
}
