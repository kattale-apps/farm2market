"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { centsPerLbToUsdPerKg } from "../../../convex/exportMarketsShared";
import { FONT, EXPORT_HEADING, EXPORT_SKY_BORDER, COFFEE_BEAN_ICON } from "./ui";

/**
 * International coffee reference prices. Free sources only: the ICO monthly
 * composite average (fetched daily) plus Arabica and Robusta figures entered
 * by super admins. Each value shows its date and source; none is a live
 * exchange feed.
 */
export function PriceTicker() {
  const prices = useQuery(api.exportPrices.getReferencePrices, {});
  if (!prices || prices.length === 0) return null;
  return (
    <section
      aria-label="Coffee reference prices"
      style={{
        background: "linear-gradient(135deg, #e1f5fe 0%, #b3e5fc 100%)",
        border: `1px solid ${EXPORT_SKY_BORDER}`,
        borderRadius: 16,
        padding: "0.9rem 1rem",
        marginBottom: "1.25rem",
        fontFamily: FONT,
        color: EXPORT_HEADING,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 800, marginBottom: "0.6rem" }}>
        <img src={COFFEE_BEAN_ICON} alt="" width={26} height={26} />
        Coffee reference prices
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.6rem" }}>
        {prices.map((p) => {
          const usdKg = p.unit === "US cents/lb" ? centsPerLbToUsdPerKg(p.value) : p.value;
          return (
            <div key={p._id} style={{ background: "#ffffff", borderRadius: 12, padding: "0.7rem 0.85rem", boxShadow: "0 2px 8px rgba(1,87,155,0.08)" }}>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#37474f" }}>{p.label}</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: EXPORT_HEADING, margin: "0.15rem 0" }}>USD {usdKg.toFixed(2)}/kg</div>
              {p.unit === "US cents/lb" && <div style={{ fontSize: "0.82rem", color: "#455a64" }}>{p.value.toFixed(2)} US cents per lb</div>}
              <div style={{ fontSize: "0.78rem", color: "#546e7a", marginTop: "0.2rem" }}>
                {p.asOf} ·{" "}
                {p.sourceUrl ? (
                  <a href={p.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "#0277bd", fontWeight: 600 }}>
                    {p.source}
                  </a>
                ) : (
                  p.source
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
