"use client";

import { useState } from "react";
import { roleLabel } from "../../../convex/roleLabels";
import { SafetyNotice } from "./Sheets";
import { FONT, adLink, formatDate, formatIsoDate, postedAgo, priceLine, tint, whatsappLink, type AdCardData } from "./shared";

/** Full ad: every photo, all details, Call / WhatsApp, share and report. */
export function AdDetail({ ad, now, onReport }: { ad: AdCardData; now: number; onReport?: () => void }) {
  const wanted = ad.kind === "wanted";
  const [copied, setCopied] = useState(false);
  const price = priceLine(ad);

  const share = async () => {
    const url = adLink(ad._id);
    const title = `${wanted ? "Wanted: " : ""}${ad.title}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${title} on Farm2Market Marketspace`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the user closed the share sheet */
    }
  };

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.9rem", padding: "0.35rem 0", borderBottom: "1px solid #f0f0f0" }}>
      <span style={{ color: "#777", minWidth: 110 }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#222" }}>{value}</span>
    </div>
  );

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center", padding: "0.25rem 0.6rem", borderRadius: 999, background: wanted ? "#fff3c4" : tint(ad.groupColor, 0.14), color: wanted ? "#6d4c00" : ad.groupColor, fontWeight: 800, fontSize: "0.75rem" }}>
        {wanted ? "WANTED" : "OFFER"} · {ad.categoryIcon} {ad.groupName} · {ad.categoryName}
      </div>
      <h1 style={{ margin: "0.5rem 0 0.25rem", fontSize: "1.35rem", fontWeight: 800, lineHeight: 1.25 }}>
        {wanted && <span style={{ color: ad.groupColor }}>Looking for: </span>}
        {ad.title}
      </h1>
      {price && <div style={{ fontSize: "1.15rem", fontWeight: 800, color: wanted ? "#6d4c00" : "#1b5e20" }}>{price}</div>}

      {ad.photoUrls.length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", scrollSnapType: "x mandatory", margin: "0.75rem 0", paddingBottom: 4 }}>
          {ad.photoUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={`${ad.title} photo ${i + 1}`}
              style={{ flex: "0 0 88%", maxWidth: 420, height: 260, objectFit: "cover", borderRadius: 12, scrollSnapAlign: "center", background: "#f3f3f3" }}
            />
          ))}
        </div>
      )}

      {ad.description && <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, color: "#333", margin: "0.5rem 0 0.75rem" }}>{ad.description}</p>}

      <div style={{ margin: "0.5rem 0 1rem" }}>
        {ad.quantity && row(wanted ? "Quantity needed" : "Quantity", ad.quantity)}
        {wanted && ad.neededBy && row("Needed by", formatIsoDate(ad.neededBy))}
        {row("District", `📍 ${ad.district}`)}
        {ad.locationDetail && row("Location", ad.locationDetail)}
        {ad.posterRole && row("Posted by", roleLabel(ad.posterRole))}
        {row("Posted", `${postedAgo(ad.createdAt, now)} (${formatDate(ad.createdAt)})`)}
        {row("Ad reference", ad.utid)}
      </div>

      <SafetyNotice />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginTop: "0.8rem" }}>
        <a href={`tel:${ad.contactPhone}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 52, borderRadius: 12, background: "#2e7d32", color: "#fff", fontWeight: 800, textDecoration: "none" }}>
          📞 Call
        </a>
        <a href={whatsappLink(ad)} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 52, borderRadius: 12, background: "#25d366", color: "#fff", fontWeight: 800, textDecoration: "none" }}>
          💬 WhatsApp
        </a>
      </div>
      <div style={{ textAlign: "center", marginTop: "0.4rem", color: "#555", fontSize: "0.85rem" }}>{ad.contactPhone}</div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", marginTop: "1rem" }}>
        <button type="button" onClick={share} style={{ flex: 1, minHeight: 42, borderRadius: 10, border: "1.5px solid #2e7d32", background: "#fff", color: "#1b5e20", fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}>
          {copied ? "✓ Link copied" : "🔗 Share ad"}
        </button>
        {onReport && (
          <button type="button" onClick={onReport} style={{ flex: 1, minHeight: 42, borderRadius: 10, border: "1.5px solid #e0a0a0", background: "#fff", color: "#c62828", fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}>
            🚩 Report
          </button>
        )}
      </div>
    </div>
  );
}
