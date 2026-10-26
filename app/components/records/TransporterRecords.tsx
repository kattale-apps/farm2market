"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import * as XLSX from "xlsx";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ugandaDateFromInstant } from "../../../convex/exportMarketsShared";

const FONT = '"Montserrat", sans-serif';
const STATUS: Record<string, string> = { requested: "Waiting for you", accepted: "Accepted", declined: "Declined", cancelled: "Cancelled", completed: "Completed" };

/** A transporter's records: trips, kilos moved and FarmCoin ratings, with a spreadsheet. */
export function TransporterRecords({ userId }: { userId: Id<"users"> }) {
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));
  const ws = useQuery(api.transport.getMyTransportWorkspace, { userId, today });
  if (ws === undefined) return <div style={{ fontFamily: FONT, color: "#777" }}>Loading your records...</div>;
  const done = ws.trips.filter((t) => t.status === "completed");
  const kgMoved = done.reduce((a, t) => a + (t.weightKg ?? 0), 0);
  const coins = done.reduce((a, t) => a + (t.farmcoinRating ?? 0), 0);
  const totals = [
    { label: "Trips completed", value: String(ws.completedTrips), note: `${ws.trips.length} booking(s) in all` },
    { label: "Kilos moved", value: `${kgMoved.toLocaleString()} kg`, note: "On completed trips with a weight" },
    { label: "FarmCoin from ratings", value: coins.toLocaleString(), note: ws.averageFarmcoins !== null ? `Average ${ws.averageFarmcoins} a trip (${ws.ratings} rated)` : "No ratings yet" },
  ];
  const download = () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(
        ws.trips.map((t) => ({ Pickup: t.pickupDate, From: t.fromDistrict, To: t.toDistrict, Load: t.load, Kilos: t.weightKg ?? "", Customer: t.requesterAlias, Status: STATUS[t.status] ?? t.status, "FarmCoin rating": t.farmcoinRating ?? "" }))
      ),
      "Trips"
    );
    XLSX.writeFile(book, "farm2market-transport-records.xlsx");
  };
  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.6rem", marginBottom: "0.75rem" }}>
        {totals.map((t) => (
          <div key={t.label} style={{ background: "#ffebee", border: "1px solid #ef9a9a", borderRadius: 12, padding: "0.7rem" }}>
            <div style={{ fontSize: "0.8rem", color: "#8e0000" }}>{t.label}</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>{t.value}</div>
            <div style={{ fontSize: "0.78rem", color: "#607d8b" }}>{t.note}</div>
          </div>
        ))}
      </div>
      <button type="button" onClick={download} style={{ minHeight: 40, padding: "0 0.9rem", borderRadius: 999, border: "2px solid #c62828", background: "#fff", color: "#c62828", fontWeight: 700, fontFamily: FONT, cursor: "pointer", marginBottom: "0.6rem" }}>
        ⬇️ Download trips (Excel)
      </button>
      {ws.trips.length === 0 ? (
        <div style={{ fontSize: "0.9rem", color: "#666" }}>No trips yet. Bookings show here once customers book you.</div>
      ) : (
        ws.trips.slice(0, 30).map((t) => (
          <div key={t._id} style={{ borderTop: "1px solid #eee", padding: "0.5rem 0", fontSize: "0.86rem" }}>
            <b>
              {t.fromDistrict} → {t.toDistrict}
            </b>{" "}
            · {t.pickupDate} · {t.load}
            {t.weightKg ? ` · ${t.weightKg.toLocaleString()} kg` : ""}
            <div style={{ color: "#607d8b" }}>
              {t.requesterAlias} · {STATUS[t.status] ?? t.status}
              {t.farmcoinRating !== undefined ? ` · rated ${t.farmcoinRating} FarmCoin` : ""}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
