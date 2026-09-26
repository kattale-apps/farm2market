"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useStoredUser } from "../../hooks/useStoredUser";
import { COFFEE_TYPES, DEFAULT_EXPORT_CROP, PRODUCT_FORMS, productFormLabel, ugandaDateFromInstant } from "../../../convex/exportMarketsShared";
import { FONT, ON_PHOTO_SHADOW, EXPORT_HEADING, card, button, input, MarketsHelper, TraceBadges, Stars, PageHeader, CropTabs, COFFEE_BEAN_ICON } from "../../components/exportMarkets/ui";
import { PriceTicker } from "../../components/exportMarkets/PriceTicker";
import { DealsList } from "../../components/exportMarkets/DealsList";

/**
 * Buyer-facing Export Markets: an anonymous catalogue of lots from live
 * exporters, the reference price ticker, and the buyer's deals.
 */
export default function BuyerExportMarketsPage() {
  const { user, status } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));
  const [coffeeType, setCoffeeType] = useState("");
  const [crop, setCrop] = useState<string>(DEFAULT_EXPORT_CROP);
  const [productForm, setProductForm] = useState("");
  const [tab, setTab] = useState<"lots" | "deals">("lots");
  const lots = useQuery(api.exportLots.listCatalogue, { today, crop, coffeeType: coffeeType || undefined, productForm: productForm || undefined });
  const [showHelp, setShowHelp] = useState(false);

  if (status === "loading") return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading...</div>;
  const isBuyer = user?.role === "buyer" && !!userId;

  return (
    <div style={{ padding: "1rem", maxWidth: 960, margin: "0 auto", fontFamily: FONT }}>
      <PageHeader
        title="Export Markets"
        backHref="/"
        subtitle="Buy ready export lots from verified exporters: price on request, platform-handled samples, and shipment tracked step by step."
        right={
          <button style={button("secondary")} onClick={() => setShowHelp(!showHelp)}>
            {showHelp ? "Hide help" : "Export vs Advanced Markets?"}
          </button>
        }
      />
      <CropTabs value={crop} onChange={setCrop} />
      {showHelp && (
        <>
          <MarketsHelper highlight="export" />
          <div style={card}>
            <ol style={{ paddingLeft: "1.2rem", lineHeight: 1.7, fontSize: "0.88rem", margin: 0 }}>
              <li>Browse lots from verified exporters: you see their alias, rating and delivery record.</li>
              <li>Ask for a price. Prices are on request.</li>
              <li>Once an exporter accepts your offer, submit your company KYC documents.</li>
              <li>The platform collects a sample from the exporter and sends it to you.</li>
              <li>Agree the contract. Company names are shared once the platform fees are paid.</li>
              <li>Follow payment, shipment and delivery step by step, with a traceability report back to the farms.</li>
            </ol>
          </div>
        </>
      )}
      <PriceTicker />

      {isBuyer && (
        <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem" }}>
          <button style={button(tab === "lots" ? "primary" : "secondary")} onClick={() => setTab("lots")}>
            Lots
          </button>
          <button style={button(tab === "deals" ? "primary" : "secondary")} onClick={() => setTab("deals")}>
            My deals
          </button>
        </div>
      )}

      {tab === "deals" && isBuyer ? (
        <DealsList userId={userId!} viewer="buyer" />
      ) : (
        <>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <select style={{ ...input, maxWidth: 220 }} value={coffeeType} onChange={(e) => setCoffeeType(e.target.value)}>
              <option value="">All coffee</option>
              {COFFEE_TYPES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select style={{ ...input, maxWidth: 260 }} value={productForm} onChange={(e) => setProductForm(e.target.value)}>
              <option value="">Green, roasted and packaged</option>
              {PRODUCT_FORMS.map((pf) => (
                <option key={pf.key} value={pf.key}>
                  {pf.label}
                </option>
              ))}
            </select>
          </div>
          {lots === undefined ? (
            <div style={card}>Loading lots...</div>
          ) : lots.length === 0 ? (
            <div style={card}>No export lots are listed right now. Lots from verified exporters will appear here.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "0.75rem" }}>
              {lots.map((lot) => (
                <Link key={lot._id} href={`/buyer/export-markets/${lot._id}`} style={{ ...card, marginBottom: 0, textDecoration: "none", color: "#222", display: "block" }}>
                  {lot.coverUrl ? (
                    <img src={lot.coverUrl} alt="" style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8 }} />
                  ) : (
                    <div style={{ height: 110, borderRadius: 10, background: "#e1f5fe", display: "grid", placeItems: "center" }}>
                      <img src={COFFEE_BEAN_ICON} alt="" width={56} height={56} />
                    </div>
                  )}
                  <div style={{ fontWeight: 800, marginTop: "0.5rem" }}>
                    {lot.coffeeType} {lot.grade}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#0277bd", fontWeight: 700 }}>{productFormLabel(lot.productForm)}</div>
                  <div style={{ fontSize: "0.8rem", color: "#555" }}>
                    Lot {lot.lotCode} · {lot.processing} · {lot.cropYear} · {lot.originDistrict}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#555" }}>
                    {lot.availableBags} bags × {lot.bagWeightKg} kg · min {lot.minOrderBags} · {lot.incoterms.join(", ")}
                  </div>
                  <div style={{ fontSize: "0.8rem", margin: "0.3rem 0" }}>
                    {lot.exporter.alias} · <Stars value={lot.exporter.ratingAverage} />
                    {lot.exporter.onTimeShipmentRate != null && ` · ${lot.exporter.onTimeShipmentRate}% on time`}
                  </div>
                  <TraceBadges traceLevel={lot.traceLevel} eudrReady={lot.eudrReady} />
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: EXPORT_HEADING, marginTop: "0.4rem" }}>Price on request →</div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
      <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
        <Link href="/buyer/advance-purchase" style={{ color: "#6a1b9a", fontWeight: 700, fontSize: "0.9rem", textShadow: ON_PHOTO_SHADOW }}>
          Looking to fund production instead? Go to Advanced Markets →
        </Link>
      </div>
    </div>
  );
}
