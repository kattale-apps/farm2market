"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useStoredUser } from "../../../hooks/useStoredUser";
import { productFormLabel, ugandaDateFromInstant } from "../../../../convex/exportMarketsShared";
import {
  FONT,
  ON_PHOTO_SHADOW,
  EXPORT_HEADING,
  card,
  input,
  label,
  button,
  Notice,
  TraceBadges,
  Stars,
  errorText,
  PageHeader,
} from "../../../components/exportMarkets/ui";
import { PriceTicker } from "../../../components/exportMarkets/PriceTicker";

export default function ExportLotPage() {
  const { lotId } = useParams<{ lotId: string }>();
  const router = useRouter();
  const { user, status } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));
  const lot = useQuery(api.exportLots.getCatalogueLot, { lotId: lotId as Id<"exportLots">, today });
  const enquire = useMutation(api.exportDeals.createEnquiry);
  const [f, setF] = useState({ bags: "", incoterm: "", port: "", period: "", price: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState(0);

  if (status === "loading" || lot === undefined) return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading lot...</div>;
  if (!lot) return <div style={{ padding: "2rem", fontFamily: FONT }}>This lot is no longer available.</div>;
  const isBuyer = user?.role === "buyer" && !!userId;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div style={{ padding: "1rem", maxWidth: 900, margin: "0 auto", fontFamily: FONT }}>
      <PageHeader
        title={`${lot.coffeeType} ${lot.grade} · lot ${lot.lotCode}`}
        backHref="/buyer/export-markets"
        backLabel="← All lots"
        iconSrc="/icons/coffee-bean.svg"
        subtitle={`${productFormLabel(lot.productForm)} · ${lot.processing} · crop ${lot.cropYear} · ${lot.originDistrict}`}
      />
      <PriceTicker />

      <div style={card}>
        {lot.photoUrls.length > 0 && (
          <div style={{ marginBottom: "0.75rem" }}>
            <img src={lot.photoUrls[photo]} alt="" style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 8 }} />
            {lot.photoUrls.length > 1 && (
              <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.3rem", overflowX: "auto" }}>
                {lot.photoUrls.map((u, i) => (
                  <button key={i} onClick={() => setPhoto(i)} style={{ padding: 0, border: i === photo ? "2px solid #01579b" : "2px solid transparent", borderRadius: 6, background: "none", cursor: "pointer" }}>
                    <img src={u} alt="" style={{ width: 64, height: 48, objectFit: "cover", borderRadius: 4, display: "block" }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.4rem", fontSize: "0.88rem" }}>
          <div>Processing: <b>{lot.processing}</b></div>
          <div>Crop year: <b>{lot.cropYear}</b></div>
          <div>Origin: <b>{lot.originDistrict}{lot.originRegion ? `, ${lot.originRegion}` : ""}</b></div>
          <div>Available: <b>{lot.availableBags} bags × {lot.bagWeightKg} kg</b></div>
          <div>Minimum order: <b>{lot.minOrderBags} bags</b></div>
          <div>Incoterms: <b>{lot.incoterms.join(", ")}</b></div>
          {lot.moisturePercent != null && <div>Moisture: <b>{lot.moisturePercent}%</b></div>}
          {lot.screenSize && <div>Screen: <b>{lot.screenSize}</b></div>}
          {lot.defects && <div>Defects: <b>{lot.defects}</b></div>}
          {lot.cupScore != null && <div>Cup score: <b>{lot.cupScore}</b></div>}
          {lot.certifications.length > 0 && <div>Certifications: <b>{lot.certifications.join(", ")}</b></div>}
          <div>Sample: <b>{lot.sampleAvailable ? "available" : "on request"}</b></div>
        </div>
        {lot.description && <p style={{ fontSize: "0.88rem" }}>{lot.description}</p>}
        <div style={{ marginTop: "0.5rem" }}>
          <TraceBadges traceLevel={lot.traceLevel} eudrReady={lot.eudrReady} />
        </div>
      </div>

      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>{lot.exporter.alias}</h2>
        <div style={{ fontSize: "0.88rem", lineHeight: 1.7 }}>
          <Stars value={lot.exporter.ratingAverage} /> from {lot.exporter.ratingCount} buyer{lot.exporter.ratingCount === 1 ? "" : "s"}
          <br />
          {lot.exporter.completedDeals} completed export deals
          {lot.exporter.onTimeShipmentRate != null && ` · ${lot.exporter.onTimeShipmentRate}% shipped within the agreed window`}
          <br />
          <span style={{ color: "#666", fontSize: "0.8rem" }}>Verified exporter. The company name is shared once the platform fees on your deal are paid.</span>
        </div>
      </div>

      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Trace map ({lot.traceStagesApproved}/{lot.traceStagesTotal} stages verified)
        </h2>
        {lot.trace.map((t, i) => (
          <div key={i} style={{ borderLeft: `3px solid ${t.status === "verified" ? "#2e7d32" : "#bdbdbd"}`, padding: "0.2rem 0 0.6rem 0.75rem", fontSize: "0.88rem" }}>
            <b>{t.name}</b> <span style={{ color: t.status === "verified" ? "#2e7d32" : "#777", fontSize: "0.78rem" }}>{t.status}</span>
            {t.photos.length > 0 && (
              <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.3rem" }}>
                {t.photos.map((p, j) => (p.url ? <img key={j} src={p.url} alt="" style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 4 }} /> : null))}
              </div>
            )}
          </div>
        ))}
        <p style={{ fontSize: "0.78rem", color: "#666", marginBottom: 0 }}>The full traceability report, with farm locations, is shared once the platform fees on your deal are paid.</p>
      </div>

      {isBuyer ? (
        <div style={card}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Ask for a price</h2>
          {error && <Notice tone="error">{error}</Notice>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.5rem" }}>
            <div>
              <label style={label}>Bags *</label>
              <input style={input} value={f.bags} onChange={set("bags")} placeholder={`${lot.minOrderBags}-${lot.availableBags}`} />
            </div>
            <div>
              <label style={label}>Incoterm *</label>
              <select style={input} value={f.incoterm} onChange={set("incoterm")}>
                <option value="">Choose</option>
                {lot.incoterms.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>Destination port</label>
              <input style={input} value={f.port} onChange={set("port")} placeholder="e.g. Hamburg" />
            </div>
            <div>
              <label style={label}>Shipment period</label>
              <input style={input} value={f.period} onChange={set("period")} placeholder="e.g. Nov-Dec 2026" />
            </div>
            <div>
              <label style={label}>Your target price (USD/kg)</label>
              <input style={input} value={f.price} onChange={set("price")} placeholder="optional" />
            </div>
          </div>
          <textarea style={{ ...input, minHeight: 60, marginTop: "0.5rem" }} placeholder="Message to the exporter (contact details are hidden until names are revealed)" value={f.message} onChange={set("message")} />
          <button
            style={{ ...button("primary", busy), marginTop: "0.5rem" }}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const r = await enquire({
                  buyerId: userId!,
                  lotId: lot._id,
                  bags: Number(f.bags),
                  incoterm: f.incoterm,
                  destinationPort: f.port || undefined,
                  shipmentPeriod: f.period || undefined,
                  targetPriceUsdPerKg: f.price.trim() ? Number(f.price) : undefined,
                  message: f.message || undefined,
                });
                router.push(`/export-deals/${r.dealId}`);
              } catch (e) {
                setError(errorText(e));
                setBusy(false);
              }
            }}
          >
            Send enquiry
          </button>
        </div>
      ) : (
        <Notice tone="info">Log in with a buyer account to ask for a price.</Notice>
      )}
    </div>
  );
}
