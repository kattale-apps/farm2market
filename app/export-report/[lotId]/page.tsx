"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import jsPDF from "jspdf";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { useStoredUser } from "../../hooks/useStoredUser";
import { formatUgandaDateTime, inUgandaTime } from "../../utils/timeUtils";
import { savePdfFromJsPDF } from "../../utils/pdfDownload";
import { FONT, card, button, Notice, TraceBadges, PageHeader } from "../../components/exportMarkets/ui";

type Report = NonNullable<FunctionReturnType<typeof api.exportLots.getTraceabilityReport>>;

/**
 * Traceability report for a lot (and, from a deal, its shipment). Shared with
 * the exporter, admins, and the buyer once the platform fees are paid.
 * Farm coordinates are included; the report only claims EUDR compliance when
 * every source plot has a location (and a polygon where the plot is over 4 ha).
 */
export default function TraceabilityReportPage() {
  const { lotId } = useParams<{ lotId: string }>();
  // Read ?deal= after mount, as other pages here do, so the page needs no
  // Suspense boundary for search params.
  const [dealId, setDealId] = useState<Id<"exportDeals"> | null | undefined>(undefined);
  useEffect(() => {
    setDealId((new URLSearchParams(window.location.search).get("deal") as Id<"exportDeals"> | null) ?? null);
  }, []);
  const { user, status } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  const [error, setError] = useState<string | null>(null);
  const report = useQuery(
    api.exportLots.getTraceabilityReport,
    userId && dealId !== undefined ? { userId, lotId: lotId as Id<"exportLots">, dealId: dealId ?? undefined } : "skip"
  );

  if (status === "loading" || dealId === undefined || (userId && report === undefined)) return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading report...</div>;
  if (!userId || !report) {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT }}>
        Report not available. Buyers receive the traceability report once the platform fees on their deal are paid.
      </div>
    );
  }

  const r = report;
  return (
    <div style={{ padding: "1rem", maxWidth: 900, margin: "0 auto", fontFamily: FONT }}>
      <PageHeader
        title={`Traceability report · Lot ${r.lot.lotCode}`}
        backHref={dealId ? `/export-deals/${dealId}` : "/trader/export"}
        backLabel="← Back"
        iconSrc="/icons/coffee-bean.svg"
      />
      {error && <Notice tone="error">{error}</Notice>}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <button
          style={button("primary")}
          onClick={async () => {
            try {
              await downloadPdf(r);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not create the PDF");
            }
          }}
        >
          Download PDF
        </button>
        <button style={button("secondary")} onClick={() => downloadGeoJson(r)} disabled={r.plots.every((p) => p.lat == null)}>
          Download farm locations (GeoJSON)
        </button>
      </div>

      <div style={{ ...card, borderLeft: `6px solid ${r.eudr.compliant ? "#2e7d32" : "#c62828"}` }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
          {r.eudr.compliant ? "Farm locations meet EUDR geolocation requirements" : "Not EUDR compliant"}
        </h2>
        {r.eudr.compliant ? (
          <p style={{ fontSize: "0.85rem", margin: 0 }}>
            Every source farm has a GPS location, and farms over 4 hectares have a boundary polygon. The importer still files its own due diligence
            statement.
          </p>
        ) : (
          <ul style={{ fontSize: "0.85rem", margin: 0 }}>
            {r.eudr.reasons.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        )}
      </div>

      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Lot</h2>
        <div style={{ fontSize: "0.88rem", lineHeight: 1.7 }}>
          {r.lot.coffeeType} {r.lot.grade} · {r.lot.processing} · crop {r.lot.cropYear} · origin {r.lot.originDistrict}
          {r.lot.originRegion ? `, ${r.lot.originRegion}` : ""}
          <br />
          {r.lot.bags} bags × {r.lot.bagWeightKg} kg
          {r.lot.moisturePercent != null ? ` · moisture ${r.lot.moisturePercent}%` : ""}
          {r.lot.screenSize ? ` · screen ${r.lot.screenSize}` : ""}
          {r.lot.cupScore != null ? ` · cup ${r.lot.cupScore}` : ""}
          {r.lot.certifications.length ? ` · ${r.lot.certifications.join(", ")}` : ""}
          <br />
          Exporter: {r.exporter.legalName ?? r.exporter.alias}
          {r.exporter.licenceNumber ? ` · licence ${r.exporter.licenceNumber}` : ""}
        </div>
        <TraceBadges traceLevel={r.lot.traceLevel} eudrReady={r.lot.eudrReady} />
      </div>

      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Source farms ({r.totalSourcedKg.toLocaleString()} kg)</h2>
        {r.plots.length === 0 && <p style={{ fontSize: "0.88rem" }}>No sources recorded.</p>}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                <th style={{ padding: "0.35rem" }}>Farm</th>
                <th style={{ padding: "0.35rem" }}>Source</th>
                <th style={{ padding: "0.35rem" }}>District / village</th>
                <th style={{ padding: "0.35rem" }}>Location</th>
                <th style={{ padding: "0.35rem" }}>Area</th>
                <th style={{ padding: "0.35rem" }}>Kg</th>
              </tr>
            </thead>
            <tbody>
              {r.plots.map((p, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f0f0f0", color: p.eudrIssue ? "#c62828" : "#222" }}>
                  <td style={{ padding: "0.35rem" }}>{p.label}</td>
                  <td style={{ padding: "0.35rem" }}>{p.kind === "declared" ? "Declared" : "Platform"}</td>
                  <td style={{ padding: "0.35rem" }}>{[p.district, p.village].filter(Boolean).join(" / ")}</td>
                  <td style={{ padding: "0.35rem", whiteSpace: "nowrap" }}>
                    {p.lat != null ? `${p.lat.toFixed(6)}, ${p.lng!.toFixed(6)}` : "missing"}
                    {p.hasPolygon ? " + polygon" : ""}
                  </td>
                  <td style={{ padding: "0.35rem" }}>{p.areaHa != null ? `${p.areaHa} ha` : ""}</td>
                  <td style={{ padding: "0.35rem" }}>{p.kilos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>The coffee journey</h2>
        {r.massBalanceWarnings.length > 0 && <Notice tone="error">{r.massBalanceWarnings.join(" ")}</Notice>}
        {r.stages.map((s, i) => (
          <div key={i} style={{ borderLeft: `3px solid ${s.verified ? "#2e7d32" : "#bdbdbd"}`, padding: "0.2rem 0 0.8rem 0.75rem" }}>
            <b>
              {i + 1}. {s.name}
            </b>{" "}
            <span style={{ fontSize: "0.78rem", color: s.verified ? "#2e7d32" : "#777" }}>
              {s.verified ? `verified${s.verifiedAt ? ` ${formatUgandaDateTime(s.verifiedAt)}` : ""}` : "not verified"}
            </span>
            {(s.weightInKg != null || s.weightOutKg != null) && (
              <div style={{ fontSize: "0.8rem" }}>
                {s.weightInKg != null ? `In ${s.weightInKg} kg` : ""} {s.weightOutKg != null ? `· Out ${s.weightOutKg} kg` : ""}
              </div>
            )}
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
              {s.photos.map((p, j) =>
                p.url ? (
                  <a key={j} href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: "0.7rem", color: "#555", textDecoration: "none" }}>
                    <img src={p.url} alt="" style={{ width: 96, height: 72, objectFit: "cover", borderRadius: 4, display: "block" }} />
                    {p.lat != null ? `${p.lat.toFixed(4)}, ${p.lng!.toFixed(4)}` : "no GPS"}
                  </a>
                ) : null
              )}
            </div>
          </div>
        ))}
      </div>

      {r.shipment && (
        <div style={card}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Shipment {r.shipment.dealCode}</h2>
          <div style={{ fontSize: "0.88rem", lineHeight: 1.7 }}>
            {r.shipment.bags} bags · {r.shipment.incoterm} {r.shipment.port ?? ""}
            <br />
            Container {r.shipment.containerNumber ?? "not recorded"} · seal {r.shipment.sealNumber ?? "not recorded"} · vessel {r.shipment.vessel ?? "not recorded"} · B/L{" "}
            {r.shipment.blNumber ?? "not recorded"}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
            {r.shipment.stuffingPhotos.map((p, j) => (p.url ? <img key={j} src={p.url} alt="" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 4 }} /> : null))}
          </div>
        </div>
      )}
    </div>
  );
}

function downloadGeoJson(r: Report) {
  const features = r.plots
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => {
      let geometry: unknown = { type: "Point", coordinates: [p.lng, p.lat] };
      if (p.polygonGeoJson) {
        try {
          const g = JSON.parse(p.polygonGeoJson) as { type?: string; geometry?: unknown };
          geometry = g.type === "Feature" ? g.geometry : g;
        } catch {
          // keep the point
        }
      }
      return {
        type: "Feature",
        geometry,
        properties: { farm: p.label, district: p.district ?? null, village: p.village ?? null, areaHa: p.areaHa ?? null, kilos: p.kilos, source: p.kind, lot: r.lot.lotCode },
      };
    });
  const blob = new Blob([JSON.stringify({ type: "FeatureCollection", features }, null, 2)], { type: "application/geo+json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lot-${r.lot.lotCode}-farms.geojson`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function downloadPdf(r: Report) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;
  const line = (text: string, size = 10, bold = false, color: [number, number, number] = [30, 30, 30]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    for (const part of doc.splitTextToSize(text, width) as string[]) {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(part, margin, y);
      y += size * 1.35;
    }
  };
  const generated = new Date().toLocaleString("en-GB", inUgandaTime({ dateStyle: "medium", timeStyle: "short" }));
  line(`Traceability report - Lot ${r.lot.lotCode}`, 16, true, [62, 39, 35]);
  line(`Generated ${generated} (Uganda time)`, 9, false, [110, 110, 110]);
  y += 6;
  line(
    r.eudr.compliant ? "Farm locations meet EUDR geolocation requirements." : "NOT EUDR COMPLIANT",
    12,
    true,
    r.eudr.compliant ? [46, 125, 50] : [198, 40, 40]
  );
  if (!r.eudr.compliant) for (const x of r.eudr.reasons) line(`- ${x}`, 9);
  y += 6;
  line("Lot", 12, true);
  line(`${r.lot.coffeeType} ${r.lot.grade}, ${r.lot.processing}, crop ${r.lot.cropYear}, origin ${r.lot.originDistrict}${r.lot.originRegion ? `, ${r.lot.originRegion}` : ""}`);
  line(`${r.lot.bags} bags x ${r.lot.bagWeightKg} kg${r.lot.certifications.length ? `; ${r.lot.certifications.join(", ")}` : ""}`);
  line(`Exporter: ${r.exporter.legalName ?? r.exporter.alias}${r.exporter.licenceNumber ? `, licence ${r.exporter.licenceNumber}` : ""}`);
  y += 6;
  line(`Source farms (${r.totalSourcedKg.toLocaleString()} kg)`, 12, true);
  for (const p of r.plots) {
    line(
      `${p.label} | ${p.kind === "declared" ? "declared" : "platform"} | ${[p.district, p.village].filter(Boolean).join(", ")} | ${
        p.lat != null ? `${p.lat.toFixed(6)}, ${p.lng!.toFixed(6)}` : "location missing"
      }${p.hasPolygon ? " + polygon" : ""}${p.areaHa != null ? ` | ${p.areaHa} ha` : ""} | ${p.kilos} kg`,
      9,
      false,
      p.eudrIssue ? [198, 40, 40] : [30, 30, 30]
    );
  }
  y += 6;
  line("The coffee journey", 12, true);
  for (const [i, s] of r.stages.entries()) {
    line(`${i + 1}. ${s.name}: ${s.verified ? "verified" : "not verified"}${s.weightInKg != null ? `, in ${s.weightInKg} kg` : ""}${s.weightOutKg != null ? `, out ${s.weightOutKg} kg` : ""}`, 10);
    for (const p of s.photos) {
      line(`   photo ${p.lat != null ? `at ${p.lat.toFixed(5)}, ${p.lng!.toFixed(5)}` : "without GPS"}, taken ${p.capturedAt}`, 8, false, [90, 90, 90]);
    }
  }
  for (const w of r.massBalanceWarnings) line(`Warning: ${w}`, 9, false, [198, 40, 40]);
  if (r.shipment) {
    y += 6;
    line(`Shipment ${r.shipment.dealCode}`, 12, true);
    line(`${r.shipment.bags} bags, ${r.shipment.incoterm} ${r.shipment.port ?? ""}`);
    line(`Container ${r.shipment.containerNumber ?? "-"}, seal ${r.shipment.sealNumber ?? "-"}, vessel ${r.shipment.vessel ?? "-"}, B/L ${r.shipment.blNumber ?? "-"}`);
  }
  await savePdfFromJsPDF(doc, `traceability-${r.lot.lotCode}.pdf`);
}
