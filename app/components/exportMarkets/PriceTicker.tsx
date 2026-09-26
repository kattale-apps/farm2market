"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { centsPerLbToUsdPerKg } from "../../../convex/exportMarketsShared";
import { FONT } from "./ui";

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
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        overflowX: "auto",
        background: "#3e2723",
        color: "#fff",
        borderRadius: 10,
        padding: "0.6rem 0.75rem",
        marginBottom: "1rem",
        fontFamily: FONT,
      }}
      aria-label="Coffee reference prices"
    >
      <span style={{ fontWeight: 800, fontSize: "0.8rem", whiteSpace: "nowrap", alignSelf: "center" }}>☕ Reference prices</span>
      {prices.map((p) => {
        const usdKg = p.unit === "US cents/lb" ? centsPerLbToUsdPerKg(p.value) : p.value;
        return (
          <div key={p._id} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 8, padding: "0.35rem 0.6rem", whiteSpace: "nowrap", fontSize: "0.78rem" }}>
            <div style={{ fontWeight: 700 }}>{p.label}</div>
            <div>
              {p.unit === "US cents/lb" ? `${p.value.toFixed(2)} US¢/lb · ` : ""}
              <b>USD {usdKg.toFixed(2)}/kg</b>
            </div>
            <div style={{ opacity: 0.75, fontSize: "0.7rem" }}>
              {p.asOf} ·{" "}
              {p.sourceUrl ? (
                <a href={p.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "#ffcc80" }}>
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
  );
}
