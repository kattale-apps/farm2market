"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formLabel } from "../../../convex/processorShared";
import { card, input, label, button, StatusPill, Notice, errorText, formatUgx } from "../exportMarkets/ui";
import { PhotoSetCapture, CapturedPhoto } from "../exportMarkets/PhotoSetCapture";
import { PROCESSOR_HEADING, PROCESSOR_SOFT, PROCESSOR_BORDER, chip, uploadEvidencePhotos } from "./ProcessorWorkspace";
import { TraceLevelPill } from "./ProcessorOperations";

type Msg = { tone: "error" | "success" | "info"; text: string } | null;
type SalesData = FunctionReturnType<typeof api.processorSales.listMySales>;
type Sellable = SalesData["sellable"][number];

const MODE_TEXT: Record<string, string> = {
  direct: "Direct sale",
  market: "PROCESSED MARKETS",
  exporter_logged: "Logged by the exporter",
  off_app: "Sold outside the app",
};
const STATUS_TEXT: Record<string, string> = {
  offered: "waiting for the exporter",
  requested: "waiting for you",
  completed: "completed",
  off_app: "logged; the exporter can link it with the sale code",
  declined: "declined",
  cancelled: "cancelled",
};

export function ProcessorSalesTab({ userId, member, active, today, setMsg }: { userId: Id<"users">; member: boolean; active: boolean; today: string; setMsg: (m: Msg) => void }) {
  const data = useQuery(api.processorSales.listMySales, { userId });
  const respond = useMutation(api.processorSales.respondToSaleRequest);
  const cancel = useMutation(api.processorSales.cancelSale);
  const [selling, setSelling] = useState<{ batch: Sellable; mode: "direct" | "off_app" } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      setMsg({ tone: "success", text: ok });
    } catch (e) {
      setMsg({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: "1.15rem", color: PROCESSOR_HEADING }}>Sell to exporters</h2>
        <p style={{ fontSize: "0.85rem", color: "#607d8b", marginTop: 0 }}>
          Nothing here is posted openly unless you choose to. Offer a batch straight to an exporter you deal with, log a sale you made outside the
          app (the exporter can link it later with its sale code), or list a batch in <b>PROCESSED MARKETS</b>, which only verified exporters
          see. If your company also exports, it uses a separate exporter account and can create lots there directly.
        </p>
        {!member && <Notice tone="info">You can sell once a community admin accepts you as a processor.</Notice>}
        {data === undefined ? (
          <div>Loading...</div>
        ) : data.sellable.length === 0 ? (
          <Notice tone="info">No processed coffee to sell yet. Complete a batch (weight out) under Processing first.</Notice>
        ) : (
          data.sellable.map((b) => (
            <div key={b._id} style={{ borderTop: "1px solid #fff3c4", padding: "0.75rem 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                <b>
                  {b.batchCode} · {formLabel(b.outputForm)}
                  {b.grade ? ` · ${b.grade}` : ""} · {b.availableKg} kg available
                </b>
                <span style={{ display: "flex", gap: "0.3rem" }}>
                  <TraceLevelPill level={b.traceLevel} />
                  <StatusPill state={b.evidenceStatus === "approved" ? "verified" : b.evidenceStatus === "none" ? "missing" : b.evidenceStatus} />
                </span>
              </div>
              {member && (
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.45rem" }}>
                  <button style={button("primary")} onClick={() => setSelling({ batch: b, mode: "direct" })}>
                    Offer to an exporter
                  </button>
                  <button style={button("secondary")} onClick={() => setSelling({ batch: b, mode: "off_app" })}>
                    Log a sale outside the app
                  </button>
                </div>
              )}
              {member && <MarketListing batch={b} userId={userId} active={active} setMsg={setMsg} />}
              {selling?.batch._id === b._id &&
                (selling.mode === "direct" ? (
                  <DirectSaleForm userId={userId} batch={b} today={today} setMsg={setMsg} onDone={() => setSelling(null)} />
                ) : (
                  <OffAppSaleForm userId={userId} batch={b} today={today} setMsg={setMsg} onDone={() => setSelling(null)} />
                ))}
            </div>
          ))
        )}
      </div>

      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem", color: PROCESSOR_HEADING }}>Your sales</h2>
        {data === undefined ? null : data.sales.length === 0 ? (
          <div style={{ fontSize: "0.9rem" }}>No sales yet.</div>
        ) : (
          data.sales.map((s) => (
            <div key={s._id} style={{ borderTop: "1px solid #eee", padding: "0.6rem 0", fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                <b>
                  {s.saleCode} · {s.kilos} kg of {s.batchCode}
                </b>
                <span style={{ color: "#607d8b" }}>{MODE_TEXT[s.mode]}</span>
              </div>
              <div style={{ color: "#455a64" }}>
                {s.exporterLabel ?? "Exporter"} · {s.saleDate}
                {s.pricePerKgUgx != null ? ` · ${formatUgx(s.pricePerKgUgx)}/kg` : ""} · <b>{STATUS_TEXT[s.status]}</b>
                {s.successFeeUgx ? ` · platform fee ${formatUgx(s.successFeeUgx)}` : ""}
              </div>
              {s.status === "requested" && (
                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.35rem" }}>
                  <button style={button("primary", busy === s._id)} disabled={busy === s._id} onClick={() => run(s._id, () => respond({ userId, saleId: s._id, accept: true }), "Sale confirmed.")}>
                    Confirm sale
                  </button>
                  <button style={button("danger", busy === s._id)} disabled={busy === s._id} onClick={() => run(s._id, () => respond({ userId, saleId: s._id, accept: false }), "Request declined.")}>
                    Decline
                  </button>
                </div>
              )}
              {s.status === "offered" && s.createdBy === userId && (
                <button style={{ ...button("secondary", busy === s._id), marginTop: "0.35rem" }} disabled={busy === s._id} onClick={() => run(s._id, () => cancel({ userId, saleId: s._id }), "Offer cancelled.")}>
                  Cancel offer
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}

function MarketListing({ batch, userId, active, setMsg }: { batch: Sellable; userId: Id<"users">; active: boolean; setMsg: (m: Msg) => void }) {
  const setListing = useMutation(api.processorSales.setBatchMarketListing);
  const [price, setPrice] = useState(batch.askingPricePerKgUgx != null ? String(batch.askingPricePerKgUgx) : "");
  const [busy, setBusy] = useState(false);
  const save = async (listed: boolean) => {
    setBusy(true);
    try {
      await setListing({ userId, batchId: batch._id, listed, askingPricePerKgUgx: price.trim() ? Number(price) : undefined });
      setMsg({ tone: "success", text: listed ? "Listed in PROCESSED MARKETS." : "Removed from PROCESSED MARKETS." });
    } catch (e) {
      setMsg({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ marginTop: "0.45rem", fontSize: "0.82rem", display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ color: PROCESSOR_HEADING, fontWeight: 700 }}>PROCESSED MARKETS (optional):</span>
      {batch.marketListed ? (
        <>
          <span>listed{batch.askingPricePerKgUgx != null ? ` at ${formatUgx(batch.askingPricePerKgUgx)}/kg` : ""}</span>
          <button style={button("secondary", busy)} disabled={busy} onClick={() => save(false)}>
            Remove listing
          </button>
        </>
      ) : active ? (
        <>
          <input style={{ ...input, width: 150 }} inputMode="decimal" placeholder="Asking UGX/kg" value={price} onChange={(e) => setPrice(e.target.value)} />
          <button style={button("secondary", busy)} disabled={busy} onClick={() => save(true)}>
            List it
          </button>
        </>
      ) : (
        <span style={{ color: "#78909c" }}>open once you are fully verified</span>
      )}
    </div>
  );
}

function DirectSaleForm({ userId, batch, today, setMsg, onDone }: { userId: Id<"users">; batch: Sellable; today: string; setMsg: (m: Msg) => void; onDone: () => void }) {
  const offer = useMutation(api.processorSales.offerDirectSale);
  const [search, setSearch] = useState("");
  const exporters = useQuery(api.processorSales.findExporterForSale, search.trim().length >= 3 ? { userId, search } : "skip");
  const [exporterId, setExporterId] = useState<Id<"users"> | null>(null);
  const [f, setF] = useState({ kilos: String(batch.availableKg), price: "", saleDate: today, notes: "" });
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ background: PROCESSOR_SOFT, border: `1px solid ${PROCESSOR_BORDER}`, borderRadius: 10, padding: "0.8rem", marginTop: "0.5rem" }}>
      <label style={label}>Exporter&apos;s phone number or alias *</label>
      <input style={input} value={search} onChange={(e) => { setSearch(e.target.value); setExporterId(null); }} placeholder="Ask the exporter for it" />
      {exporters && exporters.length === 0 && <div style={{ fontSize: "0.8rem", color: "#777" }}>No accepted exporter found. If they are not on the app, log the sale as outside the app.</div>}
      {exporters?.map((x) => (
        <label key={x.userId} style={{ ...chip(exporterId === x.userId, false), marginTop: "0.4rem", borderRadius: 10 }}>
          <input type="radio" checked={exporterId === x.userId} onChange={() => setExporterId(x.userId)} />
          {x.alias}
          {x.legalName ? ` · ${x.legalName}` : ""}
          {x.verified && <span style={{ color: "#2e7d32", fontSize: "0.75rem" }}> ✔ verified</span>}
        </label>
      ))}
      <SaleFields f={f} setF={setF} today={today} />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
        <button
          style={button("primary", busy || !exporterId)}
          disabled={busy || !exporterId}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await offer({ userId, batchId: batch._id, exporterId: exporterId!, kilos: Number(f.kilos), pricePerKgUgx: f.price.trim() ? Number(f.price) : undefined, saleDate: f.saleDate, notes: f.notes || undefined });
              setMsg({ tone: "success", text: `Offer ${r.saleCode} sent. The exporter accepts it from their Export Markets page.` });
              onDone();
            } catch (e) {
              setMsg({ tone: "error", text: errorText(e) });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Sending..." : "Send offer"}
        </button>
        <button style={button("secondary", busy)} disabled={busy} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function OffAppSaleForm({ userId, batch, today, setMsg, onDone }: { userId: Id<"users">; batch: Sellable; today: string; setMsg: (m: Msg) => void; onDone: () => void }) {
  const log = useMutation(api.processorSales.logOffAppSale);
  const getUrl = useMutation(api.processors.generateProcessorUploadUrl);
  const [f, setF] = useState({ kilos: String(batch.availableKg), price: "", saleDate: today, notes: "" });
  const [exporter, setExporter] = useState({ name: "", licence: "" });
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ background: PROCESSOR_SOFT, border: `1px solid ${PROCESSOR_BORDER}`, borderRadius: 10, padding: "0.8rem", marginTop: "0.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.5rem" }}>
        <div>
          <label style={label}>Exporter you sold to *</label>
          <input style={input} value={exporter.name} onChange={(e) => setExporter({ ...exporter, name: e.target.value })} />
        </div>
        <div>
          <label style={label}>Their export licence number</label>
          <input style={input} value={exporter.licence} onChange={(e) => setExporter({ ...exporter, licence: e.target.value })} />
        </div>
      </div>
      <SaleFields f={f} setF={setF} today={today} />
      <label style={{ ...label, marginTop: "0.6rem" }}>Receipt or delivery note photo (up to 3)</label>
      <PhotoSetCapture photos={photos} onChange={setPhotos} max={3} />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
        <button
          style={button("primary", busy)}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const receiptPhotos = await uploadEvidencePhotos(() => getUrl({ userId }), photos);
              const r = await log({
                userId,
                batchId: batch._id,
                kilos: Number(f.kilos),
                pricePerKgUgx: f.price.trim() ? Number(f.price) : undefined,
                saleDate: f.saleDate,
                offAppExporterName: exporter.name,
                offAppExporterLicence: exporter.licence || undefined,
                receiptPhotos,
                notes: f.notes || undefined,
              });
              setMsg({ tone: "success", text: `Sale ${r.saleCode} logged. Give this code to the exporter: if they join the app, they can link it to their lots.` });
              onDone();
            } catch (e) {
              setMsg({ tone: "error", text: errorText(e) });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving..." : "Log sale"}
        </button>
        <button style={button("secondary", busy)} disabled={busy} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

type SaleForm = { kilos: string; price: string; saleDate: string; notes: string };

function SaleFields({ f, setF, today }: { f: SaleForm; setF: (f: SaleForm) => void; today: string }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem", marginTop: "0.6rem" }}>
        <div>
          <label style={label}>Kilos *</label>
          <input style={input} inputMode="decimal" value={f.kilos} onChange={(e) => setF({ ...f, kilos: e.target.value })} />
        </div>
        <div>
          <label style={label}>Price per kg (UGX)</label>
          <input style={input} inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        </div>
        <div>
          <label style={label}>Sale date *</label>
          <input style={input} type="date" max={today} value={f.saleDate} onChange={(e) => setF({ ...f, saleDate: e.target.value })} />
        </div>
      </div>
      <textarea style={{ ...input, minHeight: 44, marginTop: "0.5rem" }} placeholder="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
    </>
  );
}
