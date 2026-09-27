"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { Id } from "../../convex/_generated/dataModel";
import { useStoredUser } from "../hooks/useStoredUser";
import { TransportDirectory } from "../components/transport/TransportDirectory";

/** Find transport: the transporter directory, open to every role. */
export default function TransportPage() {
  const { user, status } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  if (status === "loading") return <div style={{ padding: "2rem" }}>Loading...</div>;
  if (!userId) return <div style={{ padding: "2rem" }}>Please log in again.</div>;
  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", fontFamily: '"Montserrat", sans-serif' }}>
      <div style={{ background: "#c62828", color: "#fff", padding: "0.75rem 1rem", display: "flex", gap: "0.75rem", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.3rem" }} aria-label="Back">
          ←
        </Link>
        <h1 style={{ margin: 0, fontSize: "clamp(1rem, 4vw, 1.2rem)" }}>🚚 Find transport</h1>
      </div>
      <div style={{ padding: "1rem", maxWidth: 760, margin: "0 auto" }}>
        <TransportDirectory userId={userId} />
      </div>
    </div>
  );
}
