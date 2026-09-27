"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ugandaDateFromInstant } from "../../../convex/exportMarketsShared";
import { formLabel } from "../../../convex/processorShared";
import { useStoredUser } from "../../hooks/useStoredUser";
import { ReceiptCard, cropName } from "../../components/market/ReceiptCard";
import { TransportDirectory } from "../../components/transport/TransportDirectory";
import { TabBackBar, useTabHistory } from "../../components/nav/TabNav";

const BRAND = "#2e7d32";
const FONT = '"Montserrat", sans-serif';
type Tab = "prices" | "deliveries" | "transport";
const TAB_LABELS: [Tab, string][] = [
  ["prices", "💰 Prices near me"],
  ["deliveries", "🧾 My deliveries"],
  ["transport", "🚚 Transport"],
];

/**
 * Sales & Services (farmer): which processors buy near me and at what price, my delivery
 * bookings and cash receipts, and transport. Free for every farmer.
 */
export default function FarmerServicesPage() {
  const { user, status } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  const nav = useTabHistory<Tab>("prices");
  const tab = nav.tab;
  const setTab = nav.go;
  if (status === "loading") return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading...</div>;
  if (!userId) return <div style={{ padding: "2rem", fontFamily: FONT }}>Please log in again.</div>;
  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", fontFamily: FONT }}>
      <div style={{ background: BRAND, color: "#fff", padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem", position: "sticky", top: 0, zIndex: 100 }}>
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.3rem" }} aria-label="Back">
          ←
        </Link>
        <h1 style={{ margin: 0, fontSize: "clamp(1rem, 4vw, 1.2rem)" }}>🏭 Sales & Services</h1>
      </div>
      <div style={{ padding: "1rem", maxWidth: 720, margin: "0 auto" }}>
        <div role="tablist" style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {TAB_LABELS.map(([key, text]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              style={{ flex: 1, minHeight: 44, borderRadius: 10, border: `2px solid ${BRAND}`, background: tab === key ? BRAND : "#fff", color: tab === key ? "#fff" : BRAND, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}
            >
              {text}
            </button>
          ))}
        </div>
        {tab !== "prices" && (
          <div style={{ marginBottom: 12 }}>
            <TabBackBar color={BRAND} previousLabel={TAB_LABELS.find(([k]) => k === nav.previous)![1]} homeLabel="Prices near me" onBack={nav.back} onHome={nav.goHome} />
          </div>
        )}
        {tab === "prices" && <PricesNearMe userId={userId} canBook={user?.role === "farmer"} onBooked={() => setTab("deliveries")} />}
        {tab === "deliveries" && <MyDeliveries userId={userId} />}
        {tab === "transport" && <TransportDirectory userId={userId} />}
      </div>
    </div>
  );
}

function WorldPriceTicker() {
  const world = useQuery(api.marketOffers.getWorldPricesUgx, {});
  if (!world || world.prices.length === 0) return null;
  return (
    <div style={{ background: "#e1f5fe", border: "2px solid #81d4fa", borderRadius: 14, padding: "1rem 1.1rem", marginBottom: 16 }}>
      <div style={{ fontWeight: 800, color: "#01579b", fontSize: "1.05rem" }}>🌍 World coffee prices (reference)</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        {world.prices.map((p) => (
          <div key={p.label} style={{ background: "#fff", borderRadius: 10, padding: "0.6rem 0.8rem", minWidth: 160, flex: "1 1 160px" }}>
            <div style={{ fontSize: "0.85rem", color: "#37474f", fontWeight: 600 }}>{p.label}</div>
            <div style={{ fontWeight: 800, color: "#01579b", fontSize: "1.1rem" }}>UGX {p.ugxPerKg.toLocaleString()}/kg</div>
            <div style={{ fontSize: "0.78rem", color: "#607d8b" }}>
              USD {p.usdPerKg}/kg · {p.asOf}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: "0.92rem", color: "#263238", marginTop: 12, lineHeight: 1.6 }}>
        <p style={{ margin: 0 }}>
          <b>World price</b> for <b>export-grade green coffee</b>, converted to <b>UGX</b>.
        </p>
        <p style={{ margin: "0.4rem 0 0" }}>
          <b>Prices paid at the farm are lower</b>, because of <b>drying, hulling, grading, transport</b> and <b>export costs</b>.
        </p>
      </div>
    </div>
  );
}

function PricesNearMe({ userId, canBook, onBooked }: { userId: Id<"users">; canBook: boolean; onBooked: () => void }) {
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));
  const [district, setDistrict] = useState<string>("");
  const data = useQuery(api.marketOffers.listOffersNearMe, { userId, today, district: district || undefined });
  const [booking, setBooking] = useState<string | null>(null);
  if (data === undefined) return <div>Loading prices...</div>;
  if (data === null) return null;
  // Price range per crop, form and unit in this district.
  const groups = new Map<string, number[]>();
  for (const o of data.offers) {
    const k = `${o.crop}|${o.form ?? ""}|${o.unit}`;
    groups.set(k, [...(groups.get(k) ?? []), o.priceUgx]);
  }
  return (
    <>
      <WorldPriceTicker />
      <div style={{ background: "#fff", borderRadius: 12, padding: "0.75rem", marginBottom: 12 }}>
        <label style={{ fontSize: "0.85rem", fontWeight: 700 }}>District</label>
        <select
          value={district || data.district}
          onChange={(e) => setDistrict(e.target.value)}
          style={{ width: "100%", minHeight: 44, borderRadius: 8, border: "1px solid #ccc", padding: "0 0.5rem", marginTop: 4, fontFamily: FONT }}
        >
          {[...new Set([data.homeDistrict ?? "", data.district, ...data.districts].filter(Boolean))].map((d) => (
            <option key={d} value={d}>
              {d}
              {d === data.homeDistrict ? " (my district)" : ""}
            </option>
          ))}
        </select>
        {groups.size > 0 && (
          <div style={{ marginTop: 8, fontSize: "0.82rem", color: "#37474f" }}>
            {[...groups.entries()].map(([k, prices]) => {
              const [crop, form, unit] = k.split("|");
              return (
                <div key={k}>
                  {cropName(crop)}
                  {form ? ` (${formLabel(form)})` : ""}: UGX {Math.min(...prices).toLocaleString()} – {Math.max(...prices).toLocaleString()} per {unit}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {data.offers.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 12, padding: "1rem", fontSize: "0.9rem" }}>No processors have posted prices in {data.district || "your district"} this week. Try another district.</div>
      ) : (
        data.offers.map((o) => (
          <div key={o._id} style={{ background: "#fff", borderRadius: 12, padding: "0.75rem 0.85rem", marginBottom: 8, border: "1px solid #e0e0e0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <b>
                {cropName(o.crop)}
                {o.form ? ` · ${formLabel(o.form)}` : ""}
              </b>
              <b style={{ color: BRAND }}>
                UGX {o.priceUgx.toLocaleString()}/{o.unit}
              </b>
            </div>
            <div style={{ fontSize: "0.82rem", color: "#455a64" }}>
              {o.buyer.kind === "processor" ? "🏭" : "🏪"} {o.buyer.name}
              {o.buyer.verified ? " ✔" : ""} · {o.district} · valid until {o.validUntil}
              {o.minQuantity ? ` · min ${o.minQuantity} ${o.unit}` : ""}
            </div>
            {o.notes && <div style={{ fontSize: "0.8rem", color: "#607d8b" }}>{o.notes}</div>}
            <div style={{ fontSize: "0.72rem", color: "#9e9e9e" }}>Price may change after checking quality and moisture at the scale.</div>
            {canBook &&
              (booking === o._id ? (
                <BookForm userId={userId} offer={o} today={today} onDone={(ok) => { setBooking(null); if (ok) onBooked(); }} />
              ) : (
                <button onClick={() => setBooking(o._id)} style={{ marginTop: 8, minHeight: 40, padding: "0.4rem 0.9rem", borderRadius: 8, border: "none", background: BRAND, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                  Plan a delivery
                </button>
              ))}
          </div>
        ))
      )}
    </>
  );
}

function BookForm({ userId, offer, today, onDone }: { userId: Id<"users">; offer: { _id: Id<"buyingOffers">; unit: string; latestBookingDate: string; minQuantity?: number }; today: string; onDone: (ok: boolean) => void }) {
  const book = useMutation(api.marketOffers.bookDelivery);
  const [quantity, setQuantity] = useState(offer.minQuantity ? String(offer.minQuantity) : "");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field: React.CSSProperties = { minHeight: 44, borderRadius: 8, border: "1px solid #ccc", padding: "0 0.5rem", fontFamily: FONT, width: "100%", boxSizing: "border-box" };
  return (
    <div style={{ marginTop: 8, background: "#f1f8e9", borderRadius: 10, padding: "0.7rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        <label style={{ fontSize: "0.8rem" }}>
          How much ({offer.unit})
          <input style={field} inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <label style={{ fontSize: "0.8rem" }}>
          Delivery day (up to {offer.latestBookingDate})
          <input style={field} type="date" min={today} max={offer.latestBookingDate} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <input style={{ ...field, marginTop: 8 }} placeholder="Message to the processor (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <div style={{ color: "#c62828", fontSize: "0.82rem", marginTop: 6 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await book({ userId, offerId: offer._id, quantity: Number(quantity), deliveryDate: date, note: note || undefined });
              onDone(true);
            } catch (e) {
              setError(e instanceof Error ? e.message.replace(/.*Uncaught Error: /, "").split("\n")[0] : "Could not book");
              setBusy(false);
            }
          }}
          style={{ minHeight: 40, padding: "0.4rem 0.9rem", borderRadius: 8, border: "none", background: BRAND, color: "#fff", fontWeight: 700, cursor: "pointer" }}
        >
          {busy ? "Booking..." : "Book delivery"}
        </button>
        <button onClick={() => onDone(false)} style={{ minHeight: 40, padding: "0.4rem 0.9rem", borderRadius: 8, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const BOOKING_TEXT: Record<string, string> = {
  requested: "waiting for the processor",
  accepted: "accepted: deliver on the day",
  declined: "declined",
  cancelled: "cancelled",
  completed: "delivered and paid",
};

function MyDeliveries({ userId }: { userId: Id<"users"> }) {
  const bookings = useQuery(api.marketOffers.listMyBookings, { userId });
  const receipts = useQuery(api.marketOffers.listMyReceipts, { userId });
  const cancel = useMutation(api.marketOffers.cancelBooking);
  return (
    <>
      <h2 style={{ fontSize: "1rem", margin: "0 0 8px" }}>Delivery bookings</h2>
      {bookings === undefined ? (
        <div>Loading...</div>
      ) : bookings.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 12, padding: "0.9rem", fontSize: "0.88rem", marginBottom: 12 }}>No bookings yet. Plan one from Prices near me.</div>
      ) : (
        bookings.map((b) => (
          <div key={b._id} style={{ background: "#fff", borderRadius: 12, padding: "0.7rem 0.85rem", marginBottom: 8, border: "1px solid #e0e0e0", fontSize: "0.86rem" }}>
            <b>
              {b.quantity} {b.unit} {cropName(b.crop)}
              {b.form ? ` (${formLabel(b.form)})` : ""} → {b.buyer?.name ?? "Processor"}
            </b>
            <div style={{ color: "#455a64" }}>
              {b.deliveryDate} · UGX {b.priceUgx.toLocaleString()}/{b.unit} · <b>{BOOKING_TEXT[b.status]}</b>
            </div>
            {b.buyerNote && <div style={{ color: "#607d8b" }}>Processor: {b.buyerNote}</div>}
            {(b.status === "requested" || b.status === "accepted") && (
              <button onClick={() => cancel({ userId, bookingId: b._id })} style={{ marginTop: 6, minHeight: 36, padding: "0.3rem 0.8rem", borderRadius: 8, border: "1px solid #c62828", background: "#fff", color: "#c62828", cursor: "pointer" }}>
                Cancel booking
              </button>
            )}
          </div>
        ))
      )}
      <h2 style={{ fontSize: "1rem", margin: "16px 0 8px" }}>Receipts</h2>
      {receipts === undefined ? null : receipts.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 12, padding: "0.9rem", fontSize: "0.88rem" }}>Receipts from processors and vendors who pay you appear here, to download or share anytime.</div>
      ) : (
        receipts.map((r) => <ReceiptCard key={r._id} receipt={r} />)
      )}
    </>
  );
}
