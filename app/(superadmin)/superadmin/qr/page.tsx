"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useStoredUser } from "@/app/hooks/useStoredUser";
import { QrNav } from "./QrNav";

export default function QrCodesListPage() {
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;

  const qrCodes = useQuery(
    api.qrCodes.listQrCodes,
    userId ? { adminId: userId } : "skip"
  );

  if (authStatus === "loading") {
    return <main style={{ padding: "2rem" }}>Loading...</main>;
  }

  if (authStatus === "unauthenticated" || user?.role !== "admin") {
    return (
      <main style={{ padding: "2rem" }}>
        <p>You must be an admin to view this page.</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
      <QrNav />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0 }}>QR Codes</h1>
        <Link
          href="/superadmin/qr/create"
          style={{
            padding: "0.7rem 1.3rem",
            background: "#1976d2",
            color: "#fff",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.95rem",
          }}
        >
          + New QR Code
        </Link>
      </div>

      {qrCodes === undefined ? (
        <p>Loading QR codes...</p>
      ) : qrCodes.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "#666", background: "#f9f9f9", borderRadius: 12 }}>
          No QR codes yet. Create your first one.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {qrCodes.map((qr) => (
            <Link
              key={qr._id}
              href={`/superadmin/qr/${qr._id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "1rem 1.25rem",
                background: "#fff",
                border: "1px solid #eee",
                borderRadius: 12,
                textDecoration: "none",
                color: "inherit",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: "1rem" }}>
                  {qr.title || qr.code}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#666", wordBreak: "break-all" }}>
                  /q/{qr.code} → {qr.destinationUrl}
                </div>
              </div>
              <span
                style={{
                  padding: "0.25rem 0.6rem",
                  borderRadius: 999,
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  background: qr.isActive ? "#e8f5e9" : "#fce4ec",
                  color: qr.isActive ? "#2e7d32" : "#c62828",
                }}
              >
                {qr.isActive ? "Active" : "Inactive"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
