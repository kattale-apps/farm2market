"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { Id } from "../../convex/_generated/dataModel";
import { useStoredUser } from "../hooks/useStoredUser";
import { TraceRecords } from "../components/records/TraceRecords";
import { TransporterRecords } from "../components/records/TransporterRecords";

/**
 * Records and Reports for roles whose dashboard has no records screen of its
 * own: transporters see their trips; vendors and others see the trace of
 * every lot they bought, sold or hold, back to the farms.
 */
export default function RecordsPage() {
  const { user, status } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  if (status === "loading") return <div style={{ padding: "2rem" }}>Loading...</div>;
  if (!userId) return <div style={{ padding: "2rem" }}>Please log in again.</div>;
  const card: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: "1rem", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "1rem" };
  return (
    <div style={{ minHeight: "100vh", fontFamily: '"Montserrat", sans-serif' }}>
      <div style={{ background: "#37474f", color: "#fff", padding: "0.75rem 1rem", display: "flex", gap: "0.75rem", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.3rem" }} aria-label="Back">
          ←
        </Link>
        <h1 style={{ margin: 0, fontSize: "clamp(1rem, 4vw, 1.2rem)", color: "#fff" }}>📊 Records and Reports</h1>
      </div>
      <div style={{ padding: "1rem", maxWidth: 820, margin: "0 auto" }}>
        {user?.role === "transporter" ? (
          <div style={card}>
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>🚚 My Trips</h2>
            <TransporterRecords userId={userId} />
          </div>
        ) : (
          <div style={card}>
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>🌱 Trace Records</h2>
            <p style={{ marginTop: 0, fontSize: "0.85rem", color: "#607d8b" }}>Every lot you bought, sold or hold in the app, traced back to the farms it came from.</p>
            <TraceRecords userId={userId} />
          </div>
        )}
      </div>
    </div>
  );
}
