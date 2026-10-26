"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatUgandaDateTime } from "../../utils/timeUtils";

/**
 * Stock a processor or vendor holds. Lots bought in the app are traced back
 * to the sellers they came from; list them with "From my stock" on the
 * listing form so buyers see the trace.
 */
export function MyStock({ userId }: { userId: Id<"users"> }) {
  const stock = useQuery(api.lotOrders.myStock, { userId });
  if (stock === undefined) return <p style={{ color: "#999" }}>Loading your stock...</p>;
  if (stock.length === 0) {
    return <p style={{ color: "#666", margin: 0 }}>No stock yet. Lots you buy and collect in the app appear here.</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {stock.map((s) => (
        <div key={s.inventoryId} style={{ padding: "0.7rem 0.85rem", borderRadius: 10, border: "1px solid #e0e0e0", background: "#fff", display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700 }}>{s.produceType} · {s.totalKilos.toLocaleString()} kg</div>
            <div style={{ fontSize: "0.8rem", color: "#666" }}>
              Bought at UGX {Math.round(s.pricePerKilo).toLocaleString()}/kg · {formatUgandaDateTime(s.acquiredAt)}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <span style={{ padding: "0.2rem 0.6rem", borderRadius: 999, fontSize: "0.75rem", fontWeight: 700, background: s.source === "in_app" ? "#e8f5e9" : "#fff3e0", color: s.source === "in_app" ? "#1b5e20" : "#e65100" }}>
              {s.source === "in_app" ? `Traced to ${s.sellerCount} seller${s.sellerCount === 1 ? "" : "s"}` : "Off-app stock"}
            </span>
            {s.listed && <span style={{ padding: "0.2rem 0.6rem", borderRadius: 999, fontSize: "0.75rem", fontWeight: 700, background: "#e3f2fd", color: "#1565c0" }}>Listed</span>}
          </div>
        </div>
      ))}
      <p style={{ margin: 0, fontSize: "0.8rem", color: "#666" }}>
        To sell stock, create a listing above and choose &ldquo;From my stock&rdquo;.
      </p>
    </div>
  );
}
