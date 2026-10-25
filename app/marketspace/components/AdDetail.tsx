"use client";

import { useState } from "react";
import { roleLabel } from "../../../convex/roleLabels";
import { PhotoGallery } from "./PhotoGallery";
import { SafetyNotice } from "./Sheets";
import { FONT, adLink, formatDate, formatIsoDate, postedAgo, priceLine, tint, whatsappLink, type AdCardData } from "./shared";

/** Full ad: every photo, all details, Call / WhatsApp, share and report. */
export function AdDetail({ ad, now, onReport }: { ad: AdCardData; now: number; onReport?: () => void }) {
  const wanted = ad.kind === "wanted";
  const [copied, setCopied] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [fullScreen, setFullScreen] = useState(false);
  const price = priceLine(ad);

  const share = async () => {
    const url = adLink(ad._id);
    const title = `${wanted ? "Wanted: " : ""}${ad.title}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${title} on Farm2Market MarketSpace`, url });
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
        <div style={{ margin: "0.75rem 0" }}>
          <PhotoGallery key={ad.photoUrls.join("|")} urls={ad.photoUrls} title={ad.title} height={280} startIndex={photoIndex} onIndexChange={setPhotoIndex} onTap={(i) => { setPhotoIndex(i); setFullScreen(true); }} />
          <div style={{ textAlign: "center", color: "#888", fontSize: "0.75rem", marginTop: 4 }}>
            {ad.photoUrls.length > 1 ? "Swipe for more photos · tap to enlarge and zoom" : "Tap to enlarge and zoom"}
          </div>
        </div>
      )}
      {fullScreen && (
        <div role="dialog" aria-modal="true" aria-label="Photos" style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.94)", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0.75rem" }}>
          <button type="button" aria-label="Close photos" onClick={() => setFullScreen(false)} style={{ position: "absolute", top: 12, right: 12, zIndex: 5, width: 44, height: 44, borderRadius: 999, border: "none", background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: "1.3rem", cursor: "pointer" }}>
            ✕
          </button>
          <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
            <PhotoGallery urls={ad.photoUrls} title={ad.title} height="72vh" fit="contain" dark zoomable startIndex={photoIndex} onIndexChange={setPhotoIndex} />
            <div style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: "0.75rem", marginTop: 6 }}>Pinch or double-tap to zoom · drag to look around</div>
          </div>
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
