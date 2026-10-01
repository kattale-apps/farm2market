"use client";

import Link from "next/link";
import { UgandaMapIcon } from "./UgandaMapIcon";

const FONT = '"Montserrat", sans-serif';

/** The public entry to MarketSpace, shown above the login card. */
export function MarketspaceLoginBanner() {
  return (
    <Link
      href="/marketspace"
      aria-label="Check MarketSpace: browse classified ads from across Uganda, no login needed"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.85rem",
        width: "100%",
        boxSizing: "border-box",
        padding: "0.85rem 1rem",
        borderRadius: 14,
        border: "2px solid #f6bf26",
        background: "linear-gradient(135deg, #fffdf3 0%, #fff6d6 100%)",
        boxShadow: "0 2px 10px rgba(246,191,38,0.25)",
        textDecoration: "none",
        color: "#1a1a1a",
        fontFamily: FONT,
      }}
    >
      <span style={{ flexShrink: 0, display: "flex", background: "#fff", borderRadius: 12, padding: 4, border: "1px solid #e8f5e9" }}>
        <UgandaMapIcon size={46} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 800, fontSize: "1.1rem", color: "#1b5e20", letterSpacing: "-0.01em" }}>Check MarketSpace</span>
        <span style={{ display: "block", fontSize: "0.82rem", color: "#4a4a4a", marginTop: 2, lineHeight: 1.35 }}>
          Browse classified ads from across Uganda. No login needed.
        </span>
      </span>
      <span aria-hidden="true" style={{ fontSize: "1.6rem", color: "#1b5e20", fontWeight: 700 }}>
        ›
      </span>
    </Link>
  );
}
