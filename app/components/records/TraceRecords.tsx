"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import * as XLSX from "xlsx";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatUgandaDateTime } from "../../utils/timeUtils";

const FONT = '"Montserrat", sans-serif';
const KIND: Record<string, { text: string; bg: string; fg: string }> = {
  bought: { text: "Bought", bg: "#e3f2fd", fg: "#0d47a1" },
  sold: { text: "Sold", bg: "#e8f5e9", fg: "#1b5e20" },
  stock: { text: "In stock", bg: "#fff8e1", fg: "#6d4c00" },
};

/**
 * Trace records: every lot bought or sold in the app, and every stock row,
 * traced back to the farms. Green kilos trace to farms on the app, amber to
 * farms a processor declared, red to nothing (off-app stock to fix).
 */
export function TraceRecords({ userId }: { userId: Id<"users"> }) {
  const records = useQuery(api.traceRecords.myTraceRecords, { userId });
  const [filter, setFilter] = useState<"all" | "bought" | "sold" | "stock">("all");
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [shown, setShown] = useState(10);
  if (records === undefined) return <div style={{ fontFamily: FONT, color: "#777" }}>Loading trace records...</div>;
  if (records === null || records.length === 0) {
    return <div style={{ fontFamily: FONT, fontSize: "0.9rem", color: "#666" }}>No lots or stock yet. When you buy, sell or hold lots in the app, their trace back to the farms shows here.</div>;
  }
  const list = records.filter((r) => filter === "all" || r.kind === filter);
  const total = (k: "appFarmsKg" | "declaredFarmsKg" | "untracedKg") => Math.round(list.reduce((a, r) => a + r[k], 0) * 10) / 10;

  const download = () => {
    const rows = list.flatMap((r) =>
      r.farms.map((f) => ({
        Record: KIND[r.kind].text,
        Reference: r.ref,
        Date: formatUgandaDateTime(r.at),
        Produce: r.produce,
        "Record kg": r.kilos,
        "Chain of hands": r.chain.join(" ← "),
        Farm: f.label,
        District: f.district ?? "",
        "Farm GPS": f.hasGps ? "yes" : "no",
        "On the app": f.onApp ? "yes" : "no",
        "Farm kg": f.kilos,
      }))
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Trace");
    XLSX.writeFile(book, "farm2market-trace-records.xlsx");
  };

  const chip = (on: boolean): React.CSSProperties => ({ minHeight: 34, padding: "0 0.75rem", borderRadius: 999, border: `2px solid ${on ? "#2e7d32" : "#ddd"}`, background: on ? "#e8f5e9" : "#fff", fontWeight: 700, fontFamily: FONT, cursor: "pointer", fontSize: "0.8rem" });
  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
        {(["all", "bought", "sold", "stock"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setFilter(k)} style={chip(filter === k)}>
            {k === "all" ? "All" : KIND[k].text}
          </button>
        ))}
        <button type="button" onClick={download} style={{ ...chip(false), marginLeft: "auto" }}>⬇️ Download (Excel)</button>
      </div>
      <div style={{ fontSize: "0.85rem", marginBottom: "0.6rem" }}>
        <span style={{ color: "#1b5e20", fontWeight: 700 }}>{total("appFarmsKg").toLocaleString()} kg to farms on the app</span>
        {" · "}
        <span style={{ color: "#8d6e00", fontWeight: 700 }}>{total("declaredFarmsKg").toLocaleString()} kg to declared farms</span>
        {" · "}
        <span style={{ color: "#c62828", fontWeight: 700 }}>{total("untracedKg").toLocaleString()} kg not traced</span>
      </div>
      {list.slice(0, shown).map((r) => {
        const k = KIND[r.kind];
        const open = openRef === `${r.kind}:${r.ref}`;
        const sum = r.appFarmsKg + r.declaredFarmsKg + r.untracedKg || 1;
        return (
          <div key={`${r.kind}:${r.ref}`} style={{ borderTop: "1px solid #eee", padding: "0.55rem 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <span>
                <span style={{ padding: "0.1rem 0.5rem", borderRadius: 999, background: k.bg, color: k.fg, fontWeight: 800, fontSize: "0.72rem" }}>{k.text}</span>{" "}
                <b>{r.produce}</b> · {r.kilos.toLocaleString()} kg
              </span>
              <span style={{ fontSize: "0.75rem", color: "#777" }}>{r.ref} · {formatUgandaDateTime(r.at)}</span>
            </div>
            <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", margin: "0.35rem 0", background: "#eee" }} aria-label="How much traces to farms">
              <div style={{ width: `${(r.appFarmsKg / sum) * 100}%`, background: "#2e7d32" }} />
              <div style={{ width: `${(r.declaredFarmsKg / sum) * 100}%`, background: "#f9a825" }} />
              <div style={{ width: `${(r.untracedKg / sum) * 100}%`, background: "#c62828" }} />
            </div>
            <button type="button" onClick={() => setOpenRef(open ? null : `${r.kind}:${r.ref}`)} style={{ border: "none", background: "none", padding: 0, color: "#1565c0", fontWeight: 700, cursor: "pointer", fontFamily: FONT, fontSize: "0.82rem" }}>
              {open ? "▲ Hide trace" : `▼ Show trace (${r.farms.length} farm${r.farms.length === 1 ? "" : "s"})`}
            </button>
            {open && (
              <div style={{ marginTop: "0.4rem", fontSize: "0.82rem" }}>
                {r.chain.length > 0 && (
                  <ol style={{ margin: "0 0 0.4rem", paddingLeft: "1.2rem", color: "#455a64" }}>
                    {r.chain.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                )}
                {r.farms.map((f, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", padding: "0.2rem 0", color: f.onApp ? "#1b5e20" : f.label.startsWith("Not traced") ? "#c62828" : "#6d4c00" }}>
                    <span>
                      🌱 {f.label}
                      {f.district ? ` · ${f.district}` : ""}
                      {f.label.startsWith("Not traced") ? "" : f.hasGps ? " · 📍 GPS" : " · no GPS"}
                    </span>
                    <b>{f.kilos.toLocaleString()} kg</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {list.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + 10)} style={{ ...chip(false), marginTop: "0.5rem" }}>
          Show more ({list.length - shown} more)
        </button>
      )}
    </div>
  );
}
