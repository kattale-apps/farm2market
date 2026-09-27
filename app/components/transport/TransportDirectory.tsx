"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ugandaDateFromInstant } from "../../../convex/exportMarketsShared";

const GREEN = "#2e7d32";
const FONT = '"Montserrat", sans-serif';
export const VEHICLE_LABEL: Record<string, string> = {
  open_pickup: "Open pickup",
  box_body: "Box body",
  cold_storage: "Cold truck",
  lorry: "Lorry",
  tipper: "Tipper",
  motorcycle: "Motorcycle",
  other: "Other",
};
const field: React.CSSProperties = { minHeight: 44, borderRadius: 8, border: "1px solid #ccc", padding: "0 0.5rem", fontFamily: FONT, width: "100%", boxSizing: "border-box" };
const btn = (bg: string, outline = false): React.CSSProperties => ({
  minHeight: 40,
  padding: "0.4rem 0.9rem",
  borderRadius: 8,
  border: outline ? `1px solid ${bg}` : "none",
  background: outline ? "#fff" : bg,
  color: outline ? bg : "#fff",
  fontWeight: 700,
  cursor: "pointer",
});

function errorText(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  return m.match(/Uncaught Error: (.*?)(\n|$| at )/)?.[1] ?? m;
}

/**
 * Find verified transporters, book a trip in the app and rate it in
 * FarmCoins afterwards. Payment is agreed with the transporter off the app.
 */
export function TransportDirectory({ userId }: { userId: Id<"users"> }) {
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));
  const [district, setDistrict] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const list = useQuery(api.transport.listTransporters, { userId, today, district: district || undefined, vehicleType: vehicleType || undefined });
  const [booking, setBooking] = useState<Id<"users"> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 12, padding: "0.65rem 0.8rem", fontSize: "0.8rem", marginBottom: 10 }}>
        Transporters here have verified vehicles, insurance, drivers and licences. Book and give feedback in the app; agree the price and pay
        the transporter directly.
      </div>
      {msg && <div style={{ background: "#e8f5e9", borderRadius: 8, padding: "0.5rem 0.7rem", fontSize: "0.85rem", marginBottom: 8 }}>{msg}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 10 }}>
        <input style={field} placeholder="District (e.g. Masaka)" value={district} onChange={(e) => setDistrict(e.target.value)} />
        <select style={field} value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
          <option value="">Any vehicle</option>
          {Object.entries(VEHICLE_LABEL).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </div>
      {list === undefined ? (
        <div>Loading transporters...</div>
      ) : list.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 12, padding: "0.9rem", fontSize: "0.88rem" }}>No available transporters match. Try another district.</div>
      ) : (
        list.map((t) => (
          <div key={t.transporterId} style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: "0.75rem 0.85rem", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <b>🚚 {t.alias} ✔</b>
              <span style={{ fontSize: "0.8rem", color: "#6d4c00" }}>
                {t.averageFarmcoins !== null ? `🪙 ${t.averageFarmcoins}/10 per trip (${t.ratings})` : "No ratings yet"} · {t.completedTrips} trips
              </span>
            </div>
            <div style={{ fontSize: "0.82rem", color: "#455a64" }}>
              {t.vehicles.map((x) => `${VEHICLE_LABEL[x.vehicleType] ?? x.vehicleType} ${x.capacityTonnes} t`).join(", ")}
              <div>Serves: {t.districtsServed.join(", ")}</div>
              {t.availableFrom && <div>Available from {t.availableFrom}</div>}
              {t.priceGuide && <div>Price guide: {t.priceGuide}</div>}
            </div>
            {booking === t.transporterId ? (
              <BookTripForm userId={userId} transporterId={t.transporterId} today={today} onDone={(ok) => { setBooking(null); if (ok) setMsg("Trip requested. You will be notified when the transporter answers."); }} />
            ) : (
              <button style={{ ...btn(GREEN), marginTop: 8 }} onClick={() => setBooking(t.transporterId)}>
                Book a trip
              </button>
            )}
          </div>
        ))
      )}
      <MyTrips userId={userId} />
    </div>
  );
}

function BookTripForm({ userId, transporterId, today, onDone }: { userId: Id<"users">; transporterId: Id<"users">; today: string; onDone: (ok: boolean) => void }) {
  const book = useMutation(api.transport.bookTransport);
  const [f, setF] = useState({ from: "", to: "", date: today, load: "", weight: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div style={{ marginTop: 8, background: "#f1f8e9", borderRadius: 10, padding: "0.7rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        <input style={field} placeholder="From district" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        <input style={field} placeholder="To district" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        <input style={field} type="date" min={today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} aria-label="Pickup date" />
        <input style={field} placeholder="Weight (kg)" inputMode="decimal" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} />
      </div>
      <input style={{ ...field, marginTop: 8 }} placeholder="What is being moved (e.g. 20 bags of kiboko)" value={f.load} onChange={(e) => setF({ ...f, load: e.target.value })} />
      <input style={{ ...field, marginTop: 8 }} placeholder="Message (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      {error && <div style={{ color: "#c62828", fontSize: "0.82rem", marginTop: 6 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          style={btn(GREEN)}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await book({ userId, transporterId, fromDistrict: f.from, toDistrict: f.to, pickupDate: f.date, load: f.load, weightKg: f.weight.trim() ? Number(f.weight) : undefined, note: f.note || undefined });
              onDone(true);
            } catch (e) {
              setError(errorText(e));
              setBusy(false);
            }
          }}
        >
          {busy ? "Booking..." : "Request trip"}
        </button>
        <button style={btn("#757575", true)} onClick={() => onDone(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const TRIP_TEXT: Record<string, string> = {
  requested: "waiting for the transporter",
  accepted: "accepted",
  declined: "declined",
  cancelled: "cancelled",
  completed: "done",
};

function MyTrips({ userId }: { userId: Id<"users"> }) {
  const trips = useQuery(api.transport.listMyTransportBookings, { userId });
  const cancel = useMutation(api.transport.cancelTransportBooking);
  const complete = useMutation(api.transport.completeTrip);
  const rate = useMutation(api.transport.rateTrip);
  const [coins, setCoins] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  if (!trips || trips.length === 0) return null;
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: "1rem", margin: "0 0 8px" }}>My trips</h3>
      {error && <div style={{ color: "#c62828", fontSize: "0.82rem" }}>{error}</div>}
      {trips.map((t) => (
        <div key={t._id} style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: "0.7rem 0.85rem", marginBottom: 8, fontSize: "0.86rem" }}>
          <b>
            {t.fromDistrict} → {t.toDistrict} · {t.pickupDate}
          </b>
          <div style={{ color: "#455a64" }}>
            {t.transporterAlias} · {t.load} · <b>{TRIP_TEXT[t.status]}</b>
          </div>
          {t.transporterNote && <div style={{ color: "#607d8b" }}>Transporter: {t.transporterNote}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            {(t.status === "requested" || t.status === "accepted") && (
              <button style={btn("#c62828", true)} onClick={() => run(() => cancel({ userId, bookingId: t._id }))}>
                Cancel
              </button>
            )}
            {t.status === "accepted" && (
              <button style={btn(GREEN)} onClick={() => run(() => complete({ userId, bookingId: t._id }))}>
                Trip done
              </button>
            )}
          </div>
          {t.status === "completed" &&
            (t.farmcoinRating !== undefined ? (
              <div style={{ marginTop: 6, color: "#6d4c00" }}>You gave 🪙 {t.farmcoinRating} FarmCoins{t.feedback ? ` · "${t.feedback}"` : ""}</div>
            ) : (
              <div style={{ marginTop: 8, background: "#fff8e1", borderRadius: 10, padding: "0.6rem" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 700 }}>
                  Rate this trip: 🪙 {coins[t._id] ?? 5} of 10 FarmCoins (they go to the transporter)
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={1}
                    value={coins[t._id] ?? 5}
                    onChange={(e) => setCoins({ ...coins, [t._id]: Number(e.target.value) })}
                    style={{ width: "100%", marginTop: 6 }}
                  />
                </label>
                <input style={{ ...field, marginTop: 6 }} placeholder="Feedback (optional)" value={feedback[t._id] ?? ""} onChange={(e) => setFeedback({ ...feedback, [t._id]: e.target.value })} />
                <button style={{ ...btn("#f9a825"), color: "#3e2723", marginTop: 6 }} onClick={() => run(() => rate({ userId, bookingId: t._id, farmcoins: coins[t._id] ?? 5, feedback: feedback[t._id] || undefined }))}>
                  Send rating
                </button>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
