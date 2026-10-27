"use client";

import Link from "next/link";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { FONT, formatUGX } from "./shared";

export type MarketCardData = FunctionReturnType<typeof api.marketspace.discover>["page"][number];

/** How Discover lays cards out: one per row, two small side by side, or one big card to swipe. */
export type CardLayout = "list" | "grid" | "swipe";

const SIZES: Record<CardLayout, { photo: number; title: string; text: string }> = {
  list: { photo: 190, title: "1.05rem", text: "0.85rem" },
  grid: { photo: 110, title: "0.88rem", text: "0.76rem" },
  swipe: { photo: 300, title: "1.3rem", text: "0.95rem" },
};

const STOCK: Record<string, { text: string; bg: string; fg: string }> = {
  own_farm: { text: "From the farm", bg: "#e8f5e9", fg: "#1b5e20" },
  in_app: { text: "Traced", bg: "#e3f2fd", fg: "#0d47a1" },
  off_app: { text: "Off-app stock", bg: "#fff3e0", fg: "#e65100" },
};

function ago(createdAt: number, now: number): string {
  const days = Math.floor((now - createdAt) / 86_400_000);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

/** One post on the Discover board. Lite cards show bands and a lock instead of the details. */
export function MarketCard({ card, now, layout = "list" }: { card: MarketCardData; now: number; layout?: CardLayout }) {
  const size = SIZES[layout];
  const stock = card.stockSource ? STOCK[card.stockSource] : null;
  const pill = (text: string, bg: string, fg: string) => (
    <span style={{ padding: "0.12rem 0.5rem", borderRadius: 999, background: bg, color: fg, fontSize: "0.68rem", fontWeight: 800, whiteSpace: "nowrap" }}>{text}</span>
  );
  const isLot = card.view !== "classifieds";
  let price: string | null;
  if (card.lite) price = card.priceBand;
  else if (card.packaged) price = card.priceUGX !== null ? `${formatUGX(card.priceUGX)} ${card.priceUnit ?? "each"}` : null;
  else if (isLot) price = card.pricePerKilo ? `${formatUGX(card.pricePerKilo)}/kg` : null;
  else price = card.priceUGX !== null ? `${formatUGX(card.priceUGX)}${card.priceUnit ? ` ${card.priceUnit}` : ""}` : null;
  const quantity = card.lite
    ? card.quantityBand
    : card.packaged
      ? card.quantityText
      : isLot
        ? `${card.lotsAvailable} lot${card.lotsAvailable === 1 ? "" : "s"} of ${card.lotKg?.toLocaleString()} kg`
        : card.quantityText;

  return (
    <Link
      href={`/marketspace/p/${card.cardId}`}
      style={{ display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box", borderRadius: 14, overflow: "hidden", background: "#fff", border: "1px solid #e3e8e0", textDecoration: "none", color: "#222", fontFamily: FONT, boxShadow: "0 4px 14px rgba(0,0,0,0.14)" }}
    >
      <div style={{ position: "relative", height: size.photo, flexShrink: 0, background: "#eef3ec" }}>
        {card.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.thumbUrl} alt={card.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>{card.categoryIcon ?? "🌾"}</div>
        )}
        {card.kind === "wanted" && (
          <span style={{ position: "absolute", top: 6, left: 6, padding: "0.15rem 0.5rem", borderRadius: 999, background: "#f6bf26", color: "#1a1a1a", fontSize: "0.7rem", fontWeight: 800 }}>WANTED</span>
        )}
        {card.lite && (
          <span style={{ position: "absolute", top: 6, right: 6, padding: "0.15rem 0.5rem", borderRadius: 999, background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: "0.68rem", fontWeight: 800 }}>🔒 Buyers</span>
        )}
      </div>
      <div style={{ padding: "0.55rem 0.65rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        <div style={{ fontWeight: 800, fontSize: size.title, lineHeight: 1.25 }}>{card.title}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
          {pill(card.sellerCategory, "#f1f3f0", "#333")}
          {card.commercialFarmer && pill("✔ Commercial Farmer", "#e3f2fd", "#0d47a1")}
          {card.verifiedVendor && pill("✔ Verified Vendor", "#e3f2fd", "#0d47a1")}
          {card.farmGate && pill("🚜 Farm gate", "#fff3e0", "#8d5300")}
          {card.isBulk && pill(`📦 Bulk${card.bulkLabel ? ` · ${card.bulkLabel}` : ""}`, "#ede7f6", "#4527a0")}
          {stock && pill(stock.text, stock.bg, stock.fg)}
        </div>
        {price && <div style={{ fontWeight: 800, color: "#1b5e20", fontSize: size.text }}>{price}</div>}
        {quantity && <div style={{ fontSize: size.text, color: "#555" }}>{quantity}</div>}
        <div style={{ fontSize: size.text, color: "#777" }}>
          📍 {card.district || "Uganda"} · {ago(card.createdAt, now)}
        </div>
      </div>
    </Link>
  );
}
