"use client";

import React from "react";
import { MARKETS_HELPER } from "../../../convex/exportMarketsShared";

export const FONT = '"Montserrat", sans-serif';

/** Text sitting directly on the photographic background needs a white halo. */
export const ON_PHOTO_SHADOW = "0 1px 2px rgba(255,255,255,0.95), 0 0 8px rgba(255,255,255,0.9)";

export const EXPORT_GREEN = "#1b5e20";
export const EXPORT_BROWN = "#5d4037";

export const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e0e0e0",
  borderRadius: 12,
  padding: "1rem",
  marginBottom: "1rem",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  fontFamily: FONT,
};

export const input: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem",
  borderRadius: 8,
  border: "1px solid #ccc",
  fontFamily: FONT,
  fontSize: "0.95rem",
  boxSizing: "border-box",
  background: "#fff",
  color: "#222",
};

export const label: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  fontSize: "0.85rem",
  marginBottom: "0.3rem",
  color: "#333",
};

export function button(kind: "primary" | "secondary" | "danger" = "primary", disabled = false): React.CSSProperties {
  const colours = {
    primary: { bg: EXPORT_GREEN, fg: "#fff", border: EXPORT_GREEN },
    secondary: { bg: "#fff", fg: EXPORT_GREEN, border: EXPORT_GREEN },
    danger: { bg: "#fff", fg: "#c62828", border: "#c62828" },
  }[kind];
  return {
    padding: "0.55rem 1rem",
    borderRadius: 8,
    border: `1px solid ${disabled ? "#bbb" : colours.border}`,
    background: disabled ? "#e0e0e0" : colours.bg,
    color: disabled ? "#777" : colours.fg,
    fontWeight: 700,
    fontFamily: FONT,
    fontSize: "0.88rem",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

const TONES: Record<string, { bg: string; fg: string; text: string }> = {
  verified: { bg: "#e8f5e9", fg: "#2e7d32", text: "Verified" },
  approved: { bg: "#e8f5e9", fg: "#2e7d32", text: "Approved" },
  paid: { bg: "#e8f5e9", fg: "#2e7d32", text: "Paid" },
  waived: { bg: "#e8f5e9", fg: "#2e7d32", text: "No fee" },
  expiring: { bg: "#fff8e1", fg: "#ef6c00", text: "Expiring soon" },
  pending: { bg: "#e3f2fd", fg: "#1565c0", text: "Awaiting review" },
  submitted: { bg: "#e3f2fd", fg: "#1565c0", text: "Submitted" },
  draft: { bg: "#f5f5f5", fg: "#616161", text: "Draft" },
  missing: { bg: "#f5f5f5", fg: "#616161", text: "Not uploaded" },
  unpaid: { bg: "#f5f5f5", fg: "#616161", text: "Unpaid" },
  rejected: { bg: "#ffebee", fg: "#c62828", text: "Rejected" },
  expired: { bg: "#ffebee", fg: "#c62828", text: "Expired" },
  suspended: { bg: "#ffebee", fg: "#c62828", text: "Suspended" },
  replaced: { bg: "#f5f5f5", fg: "#9e9e9e", text: "Replaced" },
};

export function StatusPill({ state }: { state: string }) {
  const t = TONES[state] ?? { bg: "#f5f5f5", fg: "#616161", text: state };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.15rem 0.55rem",
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        fontSize: "0.75rem",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {t.text}
    </span>
  );
}

export function Notice({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  const c =
    tone === "error"
      ? { bg: "#ffebee", fg: "#b71c1c", b: "#ffcdd2" }
      : tone === "success"
        ? { bg: "#e8f5e9", fg: "#1b5e20", b: "#c8e6c9" }
        : { bg: "#e3f2fd", fg: "#0d47a1", b: "#bbdefb" };
  return (
    <div style={{ background: c.bg, color: c.fg, border: `1px solid ${c.b}`, borderRadius: 8, padding: "0.7rem", marginBottom: "0.8rem", fontSize: "0.9rem" }}>
      {children}
    </div>
  );
}

/**
 * Tells buyers the two markets apart: Export Markets (bean to cup) versus
 * Advanced Markets (seedling to harvest).
 */
export function MarketsHelper({ highlight }: { highlight?: "export" | "advanced" }) {
  const items = [
    { key: "export" as const, emoji: "☕", colour: EXPORT_BROWN, bg: "#efebe9", ...MARKETS_HELPER.export },
    { key: "advanced" as const, emoji: "🌱", colour: "#6a1b9a", bg: "#f3e5f5", ...MARKETS_HELPER.advanced },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
      {items.map((m) => (
        <div
          key={m.key}
          style={{
            background: m.bg,
            border: `2px solid ${highlight === m.key ? m.colour : "transparent"}`,
            borderRadius: 12,
            padding: "0.85rem",
            fontFamily: FONT,
          }}
        >
          <div style={{ fontWeight: 800, color: m.colour }}>
            {m.emoji} {m.title} <span style={{ fontWeight: 600, fontSize: "0.8rem" }}>· {m.tagline}</span>
          </div>
          <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem", color: "#333", lineHeight: 1.5 }}>{m.body}</p>
        </div>
      ))}
    </div>
  );
}

export function formatUgx(n: number | undefined | null): string {
  return `UGX ${Math.round(n ?? 0).toLocaleString("en-UG")}`;
}

/** Upload a file to Convex storage via a generated upload URL. */
export async function uploadToConvex(uploadUrl: string, file: File): Promise<string> {
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error("Upload failed. Please try again.");
  const json = (await res.json()) as { storageId: string };
  return json.storageId;
}
