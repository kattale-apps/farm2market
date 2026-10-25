"use client";

import { roleLabel } from "../../../convex/roleLabels";
import { FONT, formatIsoDate, postedAgo, priceLine, tint, type AdCardData } from "./shared";

/**
 * One ad. Offer ads use the group colour with a solid border; Wanted ads get
 * a dashed border and a WANTED ribbon, so the two read differently at a glance.
 */
export function AdCard({
  ad,
  now,
  variant,
  onOpen,
  onContact,
}: {
  ad: AdCardData;
  now: number;
  variant: "deck" | "grid";
  onOpen?: () => void;
  onContact?: () => void;
}) {
  const wanted = ad.kind === "wanted";
  const color = ad.groupColor;
  const photoHeight = variant === "deck" ? 200 : 130;
  const price = priceLine(ad);

  return (
    <article
      onClick={onOpen}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
        background: "#fff",
        borderRadius: 18,
        border: `${wanted ? "2.5px dashed" : "2px solid"} ${color}`,
        boxShadow: variant === "deck" ? "0 10px 28px rgba(0,0,0,0.16)" : "0 2px 8px rgba(0,0,0,0.08)",
        overflow: "hidden",
        fontFamily: FONT,
        cursor: onOpen ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: variant === "deck" ? "0.5rem 0.85rem" : "0.35rem 0.6rem",
          background: wanted ? tint(color, 0.14) : color,
          color: wanted ? color : "#fff",
          fontWeight: 700,
          fontSize: variant === "deck" ? "0.82rem" : "0.7rem",
        }}
      >
        <span>{ad.categoryIcon}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ad.groupName} · {ad.categoryName}
        </span>
        <span style={{ marginLeft: "auto", flexShrink: 0, fontWeight: 800, letterSpacing: "0.04em" }}>{wanted ? "WANTED" : "OFFER"}</span>
      </div>

      <div style={{ position: "relative", height: photoHeight, background: tint(color, 0.08), flexShrink: 0 }}>
        {ad.photoUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.photoUrls[0]} alt={ad.title} draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: variant === "deck" ? "4.5rem" : "2.6rem", opacity: 0.7 }}>
            {ad.categoryIcon || ad.groupIcon}
          </div>
        )}
        {wanted && (
          <div
            style={{
              position: "absolute",
              top: variant === "deck" ? 18 : 12,
              right: variant === "deck" ? -38 : -44,
              transform: "rotate(35deg)",
              background: "#f6bf26",
              color: "#1a1a1a",
              fontWeight: 900,
              fontSize: variant === "deck" ? "0.85rem" : "0.62rem",
              letterSpacing: "0.12em",
              padding: variant === "deck" ? "0.3rem 3rem" : "0.2rem 3rem",
              boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            }}
          >
            WANTED
          </div>
        )}
        {ad.photoCount > 1 && (
          <span style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 999, padding: "0.15rem 0.5rem", fontSize: "0.72rem", fontWeight: 700 }}>
            📷 {ad.photoCount}
          </span>
        )}
      </div>

      <div style={{ padding: variant === "deck" ? "0.8rem 0.95rem" : "0.55rem 0.65rem", display: "flex", flexDirection: "column", gap: variant === "deck" ? "0.3rem" : "0.2rem", flex: 1, minHeight: 0 }}>
        <h3
          style={{
            margin: 0,
            fontSize: variant === "deck" ? "1.15rem" : "0.88rem",
            fontWeight: 800,
            color: "#1a1a1a",
            lineHeight: 1.25,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {wanted && <span style={{ color }}>Looking for: </span>}
          {ad.title}
        </h3>
        {price && <div style={{ fontWeight: 800, color: wanted ? "#6d4c00" : "#1b5e20", fontSize: variant === "deck" ? "1.05rem" : "0.82rem" }}>{price}</div>}
        {ad.quantity && (
          <div style={{ fontSize: variant === "deck" ? "0.88rem" : "0.74rem", color: "#444" }}>
            {wanted ? "Needed" : "Available"}: <strong>{ad.quantity}</strong>
          </div>
        )}
        {wanted && ad.neededBy && (
          <div style={{ fontSize: variant === "deck" ? "0.88rem" : "0.74rem", color: "#444" }}>
            Needed by <strong>{formatIsoDate(ad.neededBy)}</strong>
          </div>
        )}
        {variant === "deck" && ad.description && (
          <p style={{ margin: "0.1rem 0 0", fontSize: "0.86rem", color: "#555", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {ad.description}
          </p>
        )}
        <div style={{ marginTop: "auto", paddingTop: "0.25rem", fontSize: variant === "deck" ? "0.78rem" : "0.68rem", color: "#777", display: "flex", flexWrap: "wrap", gap: "0.2rem 0.6rem" }}>
          <span>📍 {ad.district}</span>
          <span>🕒 {postedAgo(ad.createdAt, now)}</span>
          {variant === "deck" && ad.posterRole && <span>👤 {roleLabel(ad.posterRole)}</span>}
        </div>
      </div>

      {onContact && (
        <div style={{ padding: variant === "deck" ? "0 0.95rem 0.95rem" : "0 0.6rem 0.6rem" }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onContact();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              minHeight: variant === "deck" ? 48 : 36,
              borderRadius: 12,
              border: "none",
              background: wanted ? "#f6bf26" : color,
              color: wanted ? "#1a1a1a" : "#fff",
              fontWeight: 800,
              fontSize: variant === "deck" ? "1rem" : "0.8rem",
              fontFamily: FONT,
              cursor: "pointer",
            }}
          >
            📞 {wanted ? "I can supply this" : "Contact"}
          </button>
        </div>
      )}
    </article>
  );
}
