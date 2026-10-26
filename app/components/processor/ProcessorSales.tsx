"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formLabel } from "../../../convex/processorShared";
import { EXPORT_CROPS } from "../../../convex/exportMarketsShared";
import { defaultPlan, type PlanStep } from "../../../convex/lotOrdersShared";
import { LotTermsFields, planProblem } from "../lots/LotTermsFields";
import { useMarketspaceSession } from "../../marketspace/components/shared";
import { card, input, label, button, StatusPill, Notice, errorText, formatUgx } from "../exportMarkets/ui";
import { PhotoSetCapture, CapturedPhoto } from "../exportMarkets/PhotoSetCapture";
import { PROCESSOR_HEADING, PROCESSOR_SOFT, PROCESSOR_BORDER, chip, uploadEvidencePhotos } from "./ProcessorWorkspace";
import { TraceLevelPill } from "./ProcessorOperations";

type Msg = { tone: "error" | "success" | "info"; text: string } | null;
type SalesData = FunctionReturnType<typeof api.processorSales.listMySales>;
type Sellable = SalesData["sellable"][number];

const MODE_TEXT: Record<string, string> = {
  direct: "Direct sale",
  market: "Processed market (retired)",
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

export function ProcessorSalesTab({ userId, member, today, setMsg }: { userId: Id<"users">; member: boolean; today: string; setMsg: (m: Msg) => void }) {
  const data = useQuery(api.processorSales.listMySales, { userId });
  const respond = useMutation(api.processorSales.respondToSaleRequest);
  const cancel = useMutation(api.processorSales.cancelSale);
  const [selling, setSelling] = useState<{ batch: Sellable; mode: "marketspace" | "direct" | "off_app" } | null>(null);
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
        <h2 style={{ marginTop: 0, fontSize: "1.15rem", color: PROCESSOR_HEADING }}>Sell your processed coffee</h2>
        <p style={{ fontSize: "0.85rem", color: "#607d8b", marginTop: 0 }}>
          <b>MarketSpace</b> reaches every verified buyer, exporter, processor and vendor, who pay through escrow step by step. You can also
          sell straight to an exporter you deal with, or log a sale you made outside the app. Nothing is listed until you choose.
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
                <>
                  {/* MarketSpace first; selling directly or off the app are the alternatives */}
                  <button style={{ ...button("primary"), width: "100%", marginTop: "0.5rem", background: "#2e7d32", borderColor: "#2e7d32" }} onClick={() => setSelling({ batch: b, mode: "marketspace" })}>
                    🗺️ Sell on MarketSpace
                  </button>
                  <div style={{ fontSize: "0.8rem", color: "#607d8b", margin: "0.5rem 0 0.3rem" }}>Or sell it yourself:</div>
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    <button style={button("secondary")} onClick={() => setSelling({ batch: b, mode: "direct" })}>
                      Sell directly to an exporter
                    </button>
                    <button style={button("secondary")} onClick={() => setSelling({ batch: b, mode: "off_app" })}>
                      Log a sale outside the app (vendor, buyer, anyone)
                    </button>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#78909c", marginTop: "0.35rem" }}>Not selling yet? Leave it here: it stays in your stock.</div>
                </>
              )}
              {selling?.batch._id === b._id &&
                (selling.mode === "marketspace" ? (
                  <SellOnMarketSpace userId={userId} batch={b} setMsg={setMsg} onDone={() => setSelling(null)} />
                ) : selling.mode === "direct" ? (
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

const BAG_CHOICES = [50, 60];

/**
 * Put a processed batch on MarketSpace as lots: bag size, bags per lot, how
 * many lots and the price. The lots hold the batch's kilos; buyers pay
 * through escrow in the payment steps, which can be changed here.
 */
function SellOnMarketSpace({ userId, batch, setMsg, onDone }: { userId: Id<"users">; batch: Sellable; setMsg: (m: Msg) => void; onDone: () => void }) {
  const session = useMarketspaceSession();
  const createListing = useMutation(api.listings.createListing);
  const vend = useMutation(api.marketspace.vendListing);
  const [bagKg, setBagKg] = useState("60");
  const [bagsPerLot, setBagsPerLot] = useState("1");
  const lotKg = (Number(bagKg) || 0) * (Number(bagsPerLot) || 0);
  const maxLots = lotKg > 0 ? Math.floor(batch.availableKg / lotKg) : 0;
  const [lotCount, setLotCount] = useState("");
  const [price, setPrice] = useState(batch.askingPricePerKgUgx != null ? String(batch.askingPricePerKgUgx) : "");
  const [days, setDays] = useState(14);
  const [commitPercent, setCommitPercent] = useState(30);
  const [steps, setSteps] = useState<PlanStep[]>(() => defaultPlan("store", 30));
  const [changeSteps, setChangeSteps] = useState(false);
  const [busy, setBusy] = useState(false);
  const lots = Math.min(Number(lotCount) || maxLots, maxLots);
  const crop = EXPORT_CROPS.find((c) => c.key === batch.crop)?.label ?? batch.crop;
  const produceType = `${crop} ${formLabel(batch.outputForm)}`;

  const submit = async () => {
    const problem =
      lots < 1
        ? `A lot of ${lotKg} kg does not fit the ${batch.availableKg} kg left`
        : !(Number(price) > 0)
          ? "Enter your price per kg"
          : batch.photoCount === 0
            ? "Add photos to the batch (Processing) first: buyers see them"
            : planProblem(steps, commitPercent);
    if (problem) return setMsg({ tone: "error", text: problem });
    setBusy(true);
    try {
      const created = await createListing({
        farmerId: userId,
        produceType,
        pricePerKilo: Number(price),
        qualityRating: batch.grade ?? undefined,
        bagKg: Number(bagKg),
        bagsPerLot: Number(bagsPerLot),
        lotCount: lots,
        commitPercent,
        milestonePlan: steps,
        processingBatchId: batch._id,
      });
      if (!session.token) {
        setMsg({ tone: "info", text: `${lots} lot(s) listed. Put them on MarketSpace from MarketSpace → My posts.` });
      } else {
        try {
          await vend({ sessionToken: session.token, listingId: created.listingId, days, expectedBulkCostFarmcoin: 0 });
          setMsg({ tone: "success", text: `${lots} lot(s) of ${lotKg} kg are on MarketSpace for ${days} days. Manage them in MarketSpace → My posts.` });
        } catch (e) {
          setMsg({ tone: "info", text: `${lots} lot(s) listed, but not on MarketSpace yet (${errorText(e)}). Put them on from MarketSpace → My posts.` });
        }
      }
      onDone();
    } catch (e) {
      setMsg({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const pick = (on: boolean): React.CSSProperties => ({ ...button(on ? "primary" : "secondary"), minHeight: 40 });
  return (
    <div style={{ marginTop: "0.6rem", padding: "0.75rem", border: "1.5px solid #a5d6a7", borderRadius: 10, background: "#f6fbf6", display: "grid", gap: "0.6rem" }}>
      <b>
        {produceType}
        {batch.grade ? ` · ${batch.grade}` : ""} · {batch.availableKg} kg
      </b>
      <div>
        <span style={label}>Bag size</span>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
          {BAG_CHOICES.map((kg) => (
            <button key={kg} type="button" style={pick(bagKg === String(kg))} onClick={() => setBagKg(String(kg))}>
              {kg} kg
            </button>
          ))}
          <input
            style={{ ...input, width: 90 }}
            inputMode="decimal"
            aria-label="Other bag size in kg"
            placeholder="Other kg"
            value={BAG_CHOICES.includes(Number(bagKg)) ? "" : bagKg}
            onChange={(e) => setBagKg(e.target.value)}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={label}>Bags in one lot</span>
          <input style={{ ...input, width: 110 }} inputMode="numeric" value={bagsPerLot} onChange={(e) => setBagsPerLot(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={label}>Lots (up to {maxLots})</span>
          <input style={{ ...input, width: 110 }} inputMode="numeric" placeholder={String(maxLots)} value={lotCount} onChange={(e) => setLotCount(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={label}>Price per kg (UGX)</span>
          <input style={{ ...input, width: 140 }} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
      </div>
      <div style={{ fontSize: "0.85rem", color: "#33691e" }}>
        {lots > 0 ? (
          <>
            {lots} lot{lots === 1 ? "" : "s"} of {lotKg} kg
            {Number(price) > 0 ? <> · {formatUgx(lotKg * Number(price))} a lot</> : null}
          </>
        ) : (
          `A lot of ${lotKg} kg does not fit what is left`
        )}
      </div>
      <div>
        <span style={label}>Stays on MarketSpace for</span>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {[7, 14, 30].map((d) => (
            <button key={d} type="button" style={pick(days === d)} onClick={() => setDays(d)}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      {changeSteps ? (
        <LotTermsFields
          sellerRole="store"
          commitPercent={commitPercent}
          steps={steps}
          lotPrice={Number(price) > 0 ? Math.round(lotKg * Number(price)) : null}
          onChange={(c, st) => {
            setCommitPercent(c);
            setSteps(st);
          }}
        />
      ) : (
        <div style={{ fontSize: "0.85rem", color: "#455a64" }}>
          Buyers commit {commitPercent}% into escrow, then pay as you finish each step: {steps.map((st) => st.name).join(" → ")}.{" "}
          <button type="button" onClick={() => setChangeSteps(true)} style={{ border: "none", background: "none", color: "#1565c0", fontWeight: 700, cursor: "pointer", padding: 0 }}>
            Change payment steps
          </button>
        </div>
      )}
      <div style={{ fontSize: "0.78rem", color: "#607d8b" }}>
        Buyers see the batch photos. {batch.traceLevel === "platform_traced" ? "It shows as traced to the farms it came from." : "It shows as off-app stock."}
      </div>
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <button style={{ ...button("primary", busy), background: "#2e7d32", borderColor: "#2e7d32" }} disabled={busy} onClick={submit}>
          {busy ? "Listing..." : "Put on MarketSpace"}
        </button>
        <button style={button("secondary")} onClick={onDone}>
          Cancel
        </button>
      </div>
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
              setMsg({ tone: "success", text: `Offer ${r.saleCode} sent. The exporter accepts it from their Global Bulk Markets page.` });
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
