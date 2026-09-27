"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ugandaDateFromInstant } from "../../../convex/exportMarketsShared";
import { INTAKE_FORMS, formLabel } from "../../../convex/processorShared";
import { ReceiptCard, cropName } from "./ReceiptCard";

const FONT = '"Montserrat", sans-serif';
const ACCENT = "#6d4c00";
const field: React.CSSProperties = { minHeight: 44, borderRadius: 8, border: "1px solid #ccc", padding: "0 0.5rem", fontFamily: FONT, width: "100%", boxSizing: "border-box" };
const box: React.CSSProperties = { background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: "0.85rem 1rem", marginBottom: 12 };
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
 * Processors and vendors: post this week's buying prices, answer farmers'
 * delivery bookings, record the delivery with a cash receipt, and keep every
 * receipt as a transaction record.
 */
export function BuyerOffersPanel({ userId }: { userId: Id<"users"> }) {
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));
  const data = useQuery(api.marketOffers.listMyOffers, { userId, today });
  const bookings = useQuery(api.marketOffers.listIncomingBookings, { userId });
  const receipts = useQuery(api.marketOffers.listMyReceipts, { userId });
  const withdraw = useMutation(api.marketOffers.withdrawOffer);
  const respond = useMutation(api.marketOffers.respondToBooking);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [recording, setRecording] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    }
  };
  if (data === undefined) return <div style={box}>Loading...</div>;
  const open = (bookings ?? []).filter((b) => b.status === "requested" || b.status === "accepted");
  return (
    <div style={{ fontFamily: FONT }}>
      {msg && <div style={{ background: msg.ok ? "#e8f5e9" : "#ffebee", color: msg.ok ? "#1b5e20" : "#c62828", borderRadius: 8, padding: "0.5rem 0.7rem", marginBottom: 10, fontSize: "0.86rem" }}>{msg.text}</div>}

      <div style={box}>
        <h2 style={{ margin: "0 0 4px", fontSize: "1.05rem", color: ACCENT }}>This week&apos;s buying prices</h2>
        <p style={{ fontSize: "0.82rem", color: "#607d8b", marginTop: 0 }}>
          Farmers in {data.district ?? "your district"} see these prices and can book a delivery up to 5 days ahead. Each price is valid for a
          week; post it again weekly to stay on the board.
        </p>
        {!data.canPost ? (
          <div style={{ fontSize: "0.85rem", color: "#e65100" }}>
            {data.kind === "processor" ? "Prices open once you are a verified, live processor." : "Add your district to your profile to post buying offers."}
          </div>
        ) : (
          <PostOfferForm userId={userId} crops={data.crops} kind={data.kind} onPosted={(t) => setMsg({ ok: true, text: t })} onError={(t) => setMsg({ ok: false, text: t })} />
        )}
        {data.live.map((o) => (
          <div key={o._id} style={{ borderTop: "1px solid #eee", padding: "0.5rem 0", fontSize: "0.86rem", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <span>
              <b>
                {cropName(o.crop)}
                {o.form ? ` · ${formLabel(o.form)}` : ""}
              </b>{" "}
              UGX {o.priceUgx.toLocaleString()}/{o.unit} · until {o.validUntil}
              {o.minQuantity ? ` · min ${o.minQuantity}` : ""}
            </span>
            <button style={btn("#c62828", true)} onClick={() => run(() => withdraw({ userId, offerId: o._id }), "Price withdrawn.")}>
              Withdraw
            </button>
          </div>
        ))}
      </div>

      <div style={box}>
        <h2 style={{ margin: "0 0 8px", fontSize: "1.05rem", color: ACCENT }}>Delivery bookings from farmers</h2>
        {open.length === 0 && <div style={{ fontSize: "0.86rem" }}>No open bookings.</div>}
        {open.map((b) => (
          <div key={b._id} style={{ borderTop: "1px solid #eee", padding: "0.55rem 0", fontSize: "0.86rem" }}>
            <b>
              Farmer {b.farmerAlias}
              {b.farmerDistrict ? ` (${b.farmerDistrict})` : ""}: {b.quantity} {b.unit} {cropName(b.crop)}
              {b.form ? ` (${formLabel(b.form)})` : ""}
            </b>
            <div style={{ color: "#455a64" }}>
              {b.deliveryDate} · UGX {b.priceUgx.toLocaleString()}/{b.unit} · {b.status === "requested" ? "waiting for you" : "accepted"}
            </div>
            {b.farmerNote && <div style={{ color: "#607d8b" }}>Farmer: {b.farmerNote}</div>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              {b.status === "requested" && (
                <>
                  <button style={btn("#2e7d32")} onClick={() => run(() => respond({ userId, bookingId: b._id, accept: true }), "Booking accepted.")}>
                    Accept
                  </button>
                  <button style={btn("#c62828", true)} onClick={() => run(() => respond({ userId, bookingId: b._id, accept: false }), "Booking declined.")}>
                    Decline
                  </button>
                </>
              )}
              <button style={btn(ACCENT)} onClick={() => setRecording(recording === b._id ? null : b._id)}>
                Record delivery & pay
              </button>
            </div>
            {recording === b._id && (
              <RecordDeliveryForm
                userId={userId}
                kind={data.kind}
                booking={b}
                today={today}
                onDone={(text) => {
                  setRecording(null);
                  setMsg({ ok: true, text });
                }}
                onError={(t) => setMsg({ ok: false, text: t })}
              />
            )}
          </div>
        ))}
        {data.kind === "vendor" && <WalkInPurchase userId={userId} crops={data.crops} today={today} onDone={(t) => setMsg({ ok: true, text: t })} onError={(t) => setMsg({ ok: false, text: t })} />}
        {data.kind === "processor" && <div style={{ fontSize: "0.8rem", color: "#78909c", marginTop: 8 }}>Farmers who walk in without a booking: record them under Intake and tick &quot;paid in cash&quot; to issue their receipt.</div>}
      </div>

      <div style={box}>
        <h2 style={{ margin: "0 0 8px", fontSize: "1.05rem", color: ACCENT }}>Receipts issued</h2>
        {receipts === undefined ? null : receipts.length === 0 ? <div style={{ fontSize: "0.86rem" }}>No receipts yet.</div> : receipts.map((r) => <ReceiptCard key={r._id} receipt={r} />)}
      </div>
    </div>
  );
}

type CropOption = { key: string; label: string; units: string[] };

function PostOfferForm({ userId, crops, kind, onPosted, onError }: { userId: Id<"users">; crops: CropOption[]; kind: "processor" | "vendor"; onPosted: (t: string) => void; onError: (t: string) => void }) {
  const post = useMutation(api.marketOffers.postOffer);
  const [crop, setCrop] = useState(crops[0]?.key ?? "");
  const cropInfo = crops.find((c) => c.key === crop);
  const [form, setForm] = useState("kiboko");
  const [unit, setUnit] = useState(cropInfo?.units[0] ?? "kg");
  const [price, setPrice] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ background: "#fff8e1", borderRadius: 10, padding: "0.7rem", marginBottom: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        <select style={field} value={crop} onChange={(e) => { setCrop(e.target.value); setUnit(crops.find((c) => c.key === e.target.value)?.units[0] ?? "kg"); }}>
          {crops.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        {kind === "processor" && (
          <select style={field} value={form} onChange={(e) => setForm(e.target.value)} aria-label="Form bought">
            {INTAKE_FORMS.filter((f) => f.key !== "other").map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        )}
        {kind === "vendor" && (
          <select style={field} value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit">
            {(cropInfo?.units ?? ["kg"]).map((u) => (
              <option key={u} value={u}>
                per {u}
              </option>
            ))}
          </select>
        )}
        <input style={field} inputMode="decimal" placeholder={`Price UGX per ${kind === "processor" ? "kg" : unit}`} value={price} onChange={(e) => setPrice(e.target.value)} />
        <input style={field} inputMode="decimal" placeholder="Minimum quantity (optional)" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} />
      </div>
      <input style={{ ...field, marginTop: 8 }} placeholder="Note to farmers (e.g. moisture below 14%)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button
        style={{ ...btn(ACCENT), marginTop: 8 }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await post({ userId, crop, form: kind === "processor" ? form : undefined, unit: kind === "processor" ? "kg" : unit, priceUgx: Number(price), minQuantity: minQuantity.trim() ? Number(minQuantity) : undefined, notes: notes || undefined });
            setPrice("");
            onPosted("Price posted for this week.");
          } catch (e) {
            onError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Post price for this week
      </button>
    </div>
  );
}

type BookingRow = { _id: Id<"deliveryBookings">; farmerId: Id<"users">; crop: string; form?: string; unit: string; quantity: number; priceUgx: number };

function RecordDeliveryForm({ userId, kind, booking, today, onDone, onError }: { userId: Id<"users">; kind: "processor" | "vendor"; booking: BookingRow; today: string; onDone: (t: string) => void; onError: (t: string) => void }) {
  const recordIntake = useMutation(api.processorOperations.recordIntake);
  const recordPurchase = useMutation(api.marketOffers.recordVendorPurchase);
  const [quantity, setQuantity] = useState(String(booking.quantity));
  const [price, setPrice] = useState(String(booking.priceUgx));
  const [busy, setBusy] = useState(false);
  const total = (Number(quantity) || 0) * (Number(price) || 0);
  return (
    <div style={{ marginTop: 8, background: "#f1f8e9", borderRadius: 10, padding: "0.7rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        <label style={{ fontSize: "0.8rem" }}>
          Weighed ({booking.unit})
          <input style={field} inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <label style={{ fontSize: "0.8rem" }}>
          Price paid (UGX per {booking.unit}, after quality check)
          <input style={field} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
      </div>
      <div style={{ fontSize: "0.9rem", margin: "6px 0" }}>
        Cash to pay: <b>UGX {Math.round(total).toLocaleString()}</b>
      </div>
      <button
        style={btn("#2e7d32")}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            if (kind === "processor") {
              const r = await recordIntake({
                userId,
                crop: booking.crop,
                inputForm: booking.form ?? "other",
                kilos: Number(quantity),
                pricePerKgUgx: Number(price),
                intakeDate: today,
                sourceKind: "platform_farmer",
                farmerId: booking.farmerId,
                photos: [],
                bookingId: booking._id,
                paidCash: true,
              });
              onDone(`Delivery recorded as intake ${r.intakeCode}; receipt ${r.receiptNumber} sent to the farmer.`);
            } else {
              const r = await recordPurchase({ userId, bookingId: booking._id, crop: booking.crop, unit: booking.unit, quantity: Number(quantity), priceUgx: Number(price), paidOn: today });
              onDone(`Receipt ${r.receiptNumber} sent to the farmer.`);
            }
          } catch (e) {
            onError(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving..." : "Paid in cash: issue receipt"}
      </button>
    </div>
  );
}

/** Vendors: a farmer who sold without a booking (on the app or not). */
function WalkInPurchase({ userId, crops, today, onDone, onError }: { userId: Id<"users">; crops: CropOption[]; today: string; onDone: (t: string) => void; onError: (t: string) => void }) {
  const record = useMutation(api.marketOffers.recordVendorPurchase);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ farmerName: "", crop: crops[0]?.key ?? "", unit: crops[0]?.units[0] ?? "kg", quantity: "", price: "" });
  const units = crops.find((c) => c.key === f.crop)?.units ?? ["kg"];
  if (!open)
    return (
      <button style={{ ...btn(ACCENT, true), marginTop: 10 }} onClick={() => setOpen(true)}>
        + Record a purchase without a booking
      </button>
    );
  return (
    <div style={{ marginTop: 10, background: "#fff8e1", borderRadius: 10, padding: "0.7rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        <input style={field} placeholder="Farmer's name" value={f.farmerName} onChange={(e) => setF({ ...f, farmerName: e.target.value })} />
        <select style={field} value={f.crop} onChange={(e) => setF({ ...f, crop: e.target.value, unit: crops.find((c) => c.key === e.target.value)?.units[0] ?? "kg" })}>
          {crops.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <select style={field} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>
          {units.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <input style={field} inputMode="decimal" placeholder="Quantity" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} />
        <input style={field} inputMode="decimal" placeholder="Price UGX per unit" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          style={btn("#2e7d32")}
          onClick={async () => {
            try {
              const r = await record({ userId, farmerName: f.farmerName, crop: f.crop, unit: f.unit, quantity: Number(f.quantity), priceUgx: Number(f.price), paidOn: today });
              setOpen(false);
              onDone(`Receipt ${r.receiptNumber} issued. Share it with the farmer from Receipts.`);
            } catch (e) {
              onError(errorText(e));
            }
          }}
        >
          Paid in cash: issue receipt
        </button>
        <button style={btn("#757575", true)} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
