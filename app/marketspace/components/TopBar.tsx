"use client";

import Link from "next/link";
import { UgandaMapIcon } from "./UgandaMapIcon";
import { FONT } from "./shared";

/**
 * Marketspace header. Guests always see Log in / Sign up; signed-in users get
 * a way back to their dashboard, and admins a link to moderation.
 */
export function TopBar({ status, showAdmin, backHref }: { status: "loading" | "guest" | "user"; showAdmin?: boolean; backHref?: string }) {
  const pill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 40,
    padding: "0 0.9rem",
    borderRadius: 999,
    fontWeight: 800,
    fontSize: "0.85rem",
    textDecoration: "none",
    fontFamily: FONT,
    whiteSpace: "nowrap",
  };
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        padding: "0.55rem 1rem",
        background: "rgba(255,255,255,0.97)",
        borderBottom: "1px solid #e6e6e6",
        fontFamily: FONT,
      }}
    >
      {backHref && (
        <Link href={backHref} aria-label="Back to all ads" style={{ ...pill, padding: "0 0.7rem", border: "1.5px solid #2e7d32", color: "#1b5e20" }}>
          ←
        </Link>
      )}
      <Link href="/marketspace" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none", minWidth: 0 }}>
        <UgandaMapIcon size={34} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 800, fontSize: "1.05rem", color: "#1b5e20", lineHeight: 1.1 }}>Marketspace</span>
          <span style={{ display: "block", fontSize: "0.66rem", color: "#777", letterSpacing: "0.06em", textTransform: "uppercase" }}>Farm2Market Uganda</span>
        </span>
      </Link>
      <div style={{ marginLeft: "auto", display: "flex", gap: "0.4rem" }}>
        {showAdmin && (
          <Link href="/admin/marketspace" style={{ ...pill, border: "1.5px solid #1565c0", color: "#1565c0" }}>
            Admin
          </Link>
        )}
        {status === "guest" && (
          <Link href="/login" style={{ ...pill, background: "#2e7d32", color: "#fff" }}>
            Log in / Sign up
          </Link>
        )}
        {status === "user" && (
          <Link href="/" style={{ ...pill, border: "1.5px solid #2e7d32", color: "#1b5e20" }}>
            🏠 Home
          </Link>
        )}
      </div>
    </header>
  );
}
