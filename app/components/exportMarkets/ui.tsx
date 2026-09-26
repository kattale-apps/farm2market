"use client";

import React from "react";
import Link from "next/link";
import { EXPORT_CROPS, MARKETS_HELPER } from "../../../convex/exportMarketsShared";

export const FONT = '"Montserrat", sans-serif';

/** Text sitting directly on the photographic background needs a white halo. */
export const ON_PHOTO_SHADOW = "0 1px 2px rgba(255,255,255,0.95), 0 0 8px rgba(255,255,255,0.9)";

// Export Markets theme: light sky blue, for cargo in the sky and on blue oceans.
export const EXPORT_PRIMARY = "#0288d1";
export const EXPORT_HEADING = "#01579b";
export const EXPORT_SKY = "#e1f5fe";
export const EXPORT_SKY_BORDER = "#81d4fa";

export const SHIP_ICON = "/icons/cargo-ship.svg";
export const COFFEE_BEAN_ICON = "/icons/coffee-bean.svg";

export const card: React.CSSProperties = {
  background: "#fff",
  border: `1px solid ${EXPORT_SKY_BORDER}`,
  borderRadius: 14,
  padding: "1.25rem",
  marginBottom: "1.25rem",
  boxShadow: "0 4px 14px rgba(2,136,209,0.10)",
  fontFamily: FONT,
  lineHeight: 1.55,
};

export const input: React.CSSProperties = {
  width: "100%",
  padding: "0.7rem",
  borderRadius: 8,
  border: "1px solid #b0bec5",
  fontFamily: FONT,
  fontSize: "0.95rem",
  boxSizing: "border-box",
  background: "#fff",
  color: "#222",
};

export const label: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  fontSize: "0.88rem",
  marginBottom: "0.35rem",
  color: "#263238",
};

export function button(kind: "primary" | "secondary" | "danger" = "primary", disabled = false): React.CSSProperties {
  const colours = {
    primary: { bg: EXPORT_PRIMARY, fg: "#fff", border: EXPORT_PRIMARY },
    secondary: { bg: "#fff", fg: EXPORT_HEADING, border: EXPORT_PRIMARY },
    danger: { bg: "#fff", fg: "#c62828", border: "#c62828" },
  }[kind];
  return {
    padding: "0.6rem 1.1rem",
    minHeight: 40,
    borderRadius: 10,
    border: `1.5px solid ${disabled ? "#bbb" : colours.border}`,
    background: disabled ? "#e0e0e0" : colours.bg,
    color: disabled ? "#777" : colours.fg,
    fontWeight: 700,
    fontFamily: FONT,
    fontSize: "0.9rem",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

/**
 * Page header on its own light panel, so the title and intro stay readable
 * over the photographic background.
 */
export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel = "← Back to Dashboard",
  iconSrc = SHIP_ICON,
  right,
}: {
  title: string;
  subtitle?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  iconSrc?: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(225,245,254,0.97), rgba(255,255,255,0.97))",
        border: `1px solid ${EXPORT_SKY_BORDER}`,
        borderRadius: 16,
        padding: "1rem 1.25rem",
        marginBottom: "1.25rem",
        boxShadow: "0 6px 20px rgba(1,87,155,0.12)",
        fontFamily: FONT,
      }}
    >
      {backHref && (
        <Link href={backHref} style={{ color: EXPORT_HEADING, fontWeight: 700, fontSize: "0.9rem", textDecoration: "none" }}>
          {backLabel}
        </Link>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: backHref ? "0.5rem" : 0, flexWrap: "wrap" }}>
        <img src={iconSrc} alt="" width={44} height={44} style={{ flexShrink: 0 }} />
        <h1 style={{ margin: 0, fontSize: "clamp(1.3rem, 4vw, 1.6rem)", fontWeight: 800, color: EXPORT_HEADING, flex: 1, minWidth: 200 }}>{title}</h1>
        {right}
      </div>
      {subtitle && <div style={{ color: "#37474f", fontSize: "0.9rem", marginTop: "0.5rem", lineHeight: 1.55 }}>{subtitle}</div>}
    </div>
  );
}

/** Crop picker: one tab per exportable crop, each with its icon. */
export function CropTabs({ value, onChange }: { value: string; onChange: (crop: string) => void }) {
  return (
    <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1.25rem" }} role="tablist" aria-label="Crop being exported">
      {EXPORT_CROPS.map((c) => {
        const active = c.key === value;
        return (
          <button
            key={c.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(c.key)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem 0.5rem 0.6rem",
              borderRadius: 999,
              border: `2px solid ${active ? EXPORT_PRIMARY : EXPORT_SKY_BORDER}`,
              background: active ? EXPORT_SKY : "#fff",
              color: EXPORT_HEADING,
              fontWeight: 700,
              fontFamily: FONT,
              cursor: "pointer",
              boxShadow: active ? "0 3px 10px rgba(2,136,209,0.25)" : "none",
            }}
          >
            <img src={c.icon} alt="" width={30} height={30} />
            {c.label}
          </button>
        );
      })}
    </div>
  );
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
    { key: "export" as const, emoji: <img src={SHIP_ICON} alt="" width={22} height={22} style={{ verticalAlign: "middle" }} />, colour: EXPORT_HEADING, bg: "#e1f5fe", ...MARKETS_HELPER.export },
    { key: "advanced" as const, emoji: <span>🌱</span>, colour: "#6a1b9a", bg: "#f3e5f5", ...MARKETS_HELPER.advanced },
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

/** Keep the human part of a Convex server error. */
export function errorText(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  const match = m.match(/Uncaught Error: (.*?)(\n|$| at )/);
  return match ? match[1] : m;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
  const bytes = atob(base64);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
  return new Blob([array], { type: mime });
}

export function formatUsd(n: number | undefined | null, digits = 2): string {
  return `USD ${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export const TRACE_LEVEL_TEXT: Record<string, { text: string; bg: string; fg: string }> = {
  platform_traced: { text: "Traced on platform", bg: "#e8f5e9", fg: "#2e7d32" },
  partly_declared: { text: "Partly declared", bg: "#fff8e1", fg: "#ef6c00" },
  declared: { text: "Declared sourcing", bg: "#f5f5f5", fg: "#616161" },
};

export function Badge({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span style={{ display: "inline-block", padding: "0.12rem 0.5rem", borderRadius: 999, background: bg, color: fg, fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}

export function TraceBadges({ traceLevel, eudrReady }: { traceLevel: string; eudrReady: boolean }) {
  const t = TRACE_LEVEL_TEXT[traceLevel] ?? TRACE_LEVEL_TEXT.declared;
  return (
    <span style={{ display: "inline-flex", gap: "0.3rem", flexWrap: "wrap" }}>
      <Badge {...t} />
      {eudrReady && <Badge text="EUDR-ready locations" bg="#e3f2fd" fg="#1565c0" />}
    </span>
  );
}

export function Stars({ value }: { value: number | null | undefined }) {
  if (value == null) return <span style={{ color: "#777", fontSize: "0.8rem" }}>No ratings yet</span>;
  const full = Math.round(value);
  return (
    <span style={{ color: "#f9a825", fontWeight: 700 }} title={`${value} out of 5`}>
      {"★".repeat(full)}
      <span style={{ color: "#ddd" }}>{"★".repeat(5 - full)}</span> <span style={{ color: "#333", fontSize: "0.8rem" }}>{value}</span>
    </span>
  );
}
