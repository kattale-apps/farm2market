"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ugandaDateFromInstant } from "../../../convex/exportMarketsShared";
import { formLabel } from "../../../convex/processorShared";
import { card, input, label, button, Notice, errorText, formatUgx, EXPORT_HEADING } from "./ui";
import { TraceLevelPill } from "../processor/ProcessorOperations";

type Msg = { tone: "error" | "success" | "info"; text: string } | null;

const STATUS_TEXT: Record<string, string> = {
  offered: "offered to you",
  requested: "waiting for the processor",
  completed: "completed",
  off_app: "logged off the app",
  declined: "declined",
  cancelled: "cancelled",
};

/**
 * The exporter's purchases from processors: accept direct offers, log a
 * purchase by batch code, link an off-app sale by its code, and (for live
 * exporters) PROCESSED MARKETS. Completed purchases become lot sources.
 */
export function ProcessorPurchasesPanel({ userId, isActiveExporter, setMsg }: { userId: Id<"users">; isActiveExporter: boolean; setMsg: (m: Msg) => void }) {
  const purchases = useQuery(api.processorSales.listMyProcessorPurchases, { userId });
  const respond = useMutation(api.processorSales.respondToDirectOffer);
  const cancel = useMutation(api.processorSales.cancelSale);
  const [open, setOpen] = useState<"" | "log" | "claim" | "market">("");
  const [busy, setBusy] = useState<string | null>(null);
  const pending = (purchases ?? []).filter((p) => p.status === "offered");
  const run = async (key: string, fn: () => Promise<{ success: boolean; error?: string | null } | unknown>, ok: string) => {
    setBusy(key);
    try {
      const r = (await fn()) as { success?: boolean; error?: string | null } | undefined;
      if (r && r.success === false) setMsg({ tone: "error", text: r.error ?? "Could not complete this." });
      else setMsg({ tone: "success", text: ok });
    } catch (e) {
      setMsg({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(null);
    }
  };
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", color: EXPORT_HEADING }}>🏭 Processor purchases</h3>
        {pending.length > 0 && <span style={{ background: "#fff3e0", color: "#e65100", borderRadius: 999, padding: "0.1rem 0.6rem", fontWeight: 700, fontSize: "0.8rem" }}>{pending.length} offer(s) waiting</span>}
      </div>
      <p style={{ fontSize: "0.82rem", color: "#607d8b" }}>
        Processed coffee you bought from processors. Link it to a lot under &quot;Where this coffee came from&quot; and the trace runs back to the
        farms through the processor&apos;s verified records.
      </p>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
        <button style={button(open === "log" ? "primary" : "secondary")} onClick={() => setOpen(open === "log" ? "" : "log")}>
          Log a purchase
        </button>
        <button style={button(open === "claim" ? "primary" : "secondary")} onClick={() => setOpen(open === "claim" ? "" : "claim")}>
          Link an off-app sale
        </button>
        <button style={button(open === "market" ? "primary" : "secondary")} onClick={() => setOpen(open === "market" ? "" : "market")}>
          PROCESSED MARKETS
        </button>
      </div>
      {open === "log" && <LogPurchaseForm userId={userId} setMsg={setMsg} onDone={() => setOpen("")} />}
      {open === "claim" && <ClaimForm userId={userId} setMsg={setMsg} onDone={() => setOpen("")} />}
      {open === "market" && <ProcessedMarket userId={userId} isActiveExporter={isActiveExporter} setMsg={setMsg} />}

      {(purchases ?? []).map((p) => (
        <div key={p._id} style={{ borderTop: "1px solid #eee", padding: "0.55rem 0", fontSize: "0.85rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
            <b>
              {p.saleCode} · {p.kilos} kg {formLabel(p.outputForm)}
              {p.grade ? ` · ${p.grade}` : ""}
            </b>
            <TraceLevelPill level={p.traceLevel} />
          </div>
          <div style={{ color: "#455a64" }}>
            {p.processor.facilityName ?? p.processor.alias}
            {p.processor.district ? `, ${p.processor.district}` : ""}
            {p.processor.verified ? " ✔" : ""} · batch {p.batchCode} · {p.saleDate}
            {p.pricePerKgUgx != null ? ` · ${formatUgx(p.pricePerKgUgx)}/kg` : ""} · <b>{STATUS_TEXT[p.status]}</b>
            {p.status === "completed" ? ` · ${p.linkedKg} kg linked to lots` : ""}
          </div>
          {p.status === "offered" && (
            <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.35rem" }}>
              <button style={button("primary", busy === p._id)} disabled={busy === p._id} onClick={() => run(p._id, () => respond({ userId, saleId: p._id, accept: true }), "Purchase accepted. Link it to a lot.")}>
                Accept
              </button>
              <button style={button("danger", busy === p._id)} disabled={busy === p._id} onClick={() => run(p._id, () => respond({ userId, saleId: p._id, accept: false }), "Offer declined.")}>
                Decline
              </button>
            </div>
          )}
          {p.status === "requested" && p.createdBy === userId && (
            <button style={{ ...button("secondary", busy === p._id), marginTop: "0.35rem" }} disabled={busy === p._id} onClick={() => run(p._id, () => cancel({ userId, saleId: p._id }), "Request cancelled.")}>
              Cancel request
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function LogPurchaseForm({ userId, setMsg, onDone }: { userId: Id<"users">; setMsg: (m: Msg) => void; onDone: () => void }) {
  const log = useMutation(api.processorSales.logPurchaseFromProcessor);
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));
  const [f, setF] = useState({ batchCode: "", kilos: "", price: "", saleDate: today, notes: "" });
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ background: "#fafafa", border: "1px solid #eee", borderRadius: 8, padding: "0.75rem", marginBottom: "0.5rem" }}>
      <p style={{ fontSize: "0.8rem", color: "#607d8b", marginTop: 0 }}>Ask the processor for the batch code (it starts with PRB-). They confirm the purchase on their side.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem" }}>
        <input style={input} placeholder="Batch code *" value={f.batchCode} onChange={(e) => setF({ ...f, batchCode: e.target.value })} />
        <input style={input} placeholder="Kilos *" inputMode="decimal" value={f.kilos} onChange={(e) => setF({ ...f, kilos: e.target.value })} />
        <input style={input} placeholder="Price UGX/kg" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        <input style={input} type="date" max={today} value={f.saleDate} onChange={(e) => setF({ ...f, saleDate: e.target.value })} />
      </div>
      <button
        style={{ ...button("primary", busy), marginTop: "0.5rem" }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await log({ userId, batchCode: f.batchCode, kilos: Number(f.kilos), pricePerKgUgx: f.price.trim() ? Number(f.price) : undefined, saleDate: f.saleDate, notes: f.notes || undefined });
            setMsg({ tone: "success", text: `Purchase ${r.saleCode} logged. The processor confirms it.` });
            onDone();
          } catch (e) {
            setMsg({ tone: "error", text: errorText(e) });
          } finally {
            setBusy(false);
          }
        }}
      >
        Log purchase
      </button>
    </div>
  );
}

function ClaimForm({ userId, setMsg, onDone }: { userId: Id<"users">; setMsg: (m: Msg) => void; onDone: () => void }) {
  const claim = useMutation(api.processorSales.claimOffAppSale);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ background: "#fafafa", border: "1px solid #eee", borderRadius: 8, padding: "0.75rem", marginBottom: "0.5rem" }}>
      <p style={{ fontSize: "0.8rem", color: "#607d8b", marginTop: 0 }}>
        A processor logged a sale to you made outside the app? Enter its sale code (it starts with PSL-) to link it to your account and use it in
        your lots.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input style={{ ...input, maxWidth: 220 }} placeholder="Sale code" value={code} onChange={(e) => setCode(e.target.value)} />
        <button
          style={button("primary", busy || !code.trim())}
          disabled={busy || !code.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await claim({ userId, saleCode: code });
              setMsg({ tone: "success", text: "Sale linked. You can now add it to a lot." });
              onDone();
            } catch (e) {
              setMsg({ tone: "error", text: errorText(e) });
            } finally {
              setBusy(false);
            }
          }}
        >
          Link sale
        </button>
      </div>
    </div>
  );
}

function ProcessedMarket({ userId, isActiveExporter, setMsg }: { userId: Id<"users">; isActiveExporter: boolean; setMsg: (m: Msg) => void }) {
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));
  const market = useQuery(api.processorSales.listProcessedMarket, isActiveExporter ? { userId, today } : "skip");
  const request = useMutation(api.processorSales.requestFromProcessedMarket);
  const [kilos, setKilos] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  if (!isActiveExporter) return <Notice tone="info">PROCESSED MARKETS opens once you are a verified, live exporter.</Notice>;
  if (market === undefined) return <div>Loading PROCESSED MARKETS...</div>;
  if (market.listings.length === 0) return <Notice tone="info">No processed coffee is listed at the moment.</Notice>;
  return (
    <div style={{ display: "grid", gap: "0.5rem", marginBottom: "0.5rem" }}>
      {market.listings.map((l) => (
        <div key={l.batchId} style={{ border: "1px solid #ffe082", borderRadius: 10, padding: "0.65rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          {l.coverUrl && <img src={l.coverUrl} alt="" style={{ width: 80, height: 64, objectFit: "cover", borderRadius: 6 }} />}
          <div style={{ flex: 1, minWidth: 180, fontSize: "0.84rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.4rem", flexWrap: "wrap" }}>
              <b>
                {formLabel(l.outputForm)}
                {l.coffeeType ? ` ${l.coffeeType}` : ""}
                {l.grade ? ` · ${l.grade}` : ""}
              </b>
              <TraceLevelPill level={l.traceLevel} />
            </div>
            <div style={{ color: "#455a64" }}>
              {l.processor.facilityName ?? l.processor.alias}
              {l.processor.district ? `, ${l.processor.district}` : ""} {l.processor.verified ? "✔" : ""} · {l.availableKg} kg
              {l.outturnPercent != null ? ` · outturn ${l.outturnPercent}%` : ""}
              {l.moisturePercent != null ? ` · moisture ${l.moisturePercent}%` : ""}
              {l.askingPricePerKgUgx != null ? ` · asking ${formatUgx(l.askingPricePerKgUgx)}/kg` : ""}
              {l.evidenceVerified ? " · processing verified" : ""}
            </div>
            <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
              <input style={{ ...input, maxWidth: 130 }} placeholder="Kilos" inputMode="decimal" value={kilos[l.batchId] ?? ""} onChange={(e) => setKilos({ ...kilos, [l.batchId]: e.target.value })} />
              <button
                style={button("primary", busy === l.batchId)}
                disabled={busy === l.batchId}
                onClick={async () => {
                  setBusy(l.batchId);
                  try {
                    const r = await request({ userId, batchId: l.batchId, kilos: Number(kilos[l.batchId]) });
                    setMsg({ tone: "success", text: `Request ${r.saleCode} sent. The processor confirms it.` });
                  } catch (e) {
                    setMsg({ tone: "error", text: errorText(e) });
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Request
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** The exporter's own processing steps on the trace map; new lots use them. */
export function TracePipelineEditor({ userId, setMsg }: { userId: Id<"users">; setMsg: (m: Msg) => void }) {
  const data = useQuery(api.exportLots.getMyTraceStages, { userId });
  const save = useMutation(api.exportLots.saveMyTraceStages);
  const [editing, setEditing] = useState<{ name: string; hint: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", color: EXPORT_HEADING }}>Your processing steps (trace pipeline)</h3>
        {!editing && (
          <button style={button("secondary")} onClick={() => setEditing(data.stages.map((s) => ({ name: s.name, hint: s.hint })))}>
            Edit steps
          </button>
        )}
      </div>
      <p style={{ fontSize: "0.82rem", color: "#607d8b" }}>
        Every lot&apos;s trace map runs: farm stages → any processor stages → your own steps below. Buyers on a deal and super admins see each step
        in the traceability report. Changes apply to new lots; existing lots keep their steps.
      </p>
      {!editing ? (
        <ol style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.86rem" }}>
          {data.stages.map((s) => (
            <li key={s.key}>
              <b>{s.name}</b>
              {s.hint ? <span style={{ color: "#78909c" }}> · {s.hint}</span> : null}
            </li>
          ))}
        </ol>
      ) : (
        <div>
          {editing.map((s, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1fr) minmax(160px, 2fr) auto", gap: "0.4rem", marginBottom: "0.4rem", alignItems: "center" }}>
              <input style={input} placeholder="Step name" value={s.name} onChange={(e) => setEditing(editing.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input style={input} placeholder="What the photos should show" value={s.hint} onChange={(e) => setEditing(editing.map((x, j) => (j === i ? { ...x, hint: e.target.value } : x)))} />
              <span style={{ display: "flex", gap: "0.2rem" }}>
                <button aria-label="Move up" style={{ ...button("secondary"), padding: "0.2rem 0.5rem", minHeight: 0 }} disabled={i === 0} onClick={() => setEditing(swap(editing, i, i - 1))}>
                  ↑
                </button>
                <button aria-label="Remove step" style={{ ...button("danger"), padding: "0.2rem 0.5rem", minHeight: 0 }} onClick={() => setEditing(editing.filter((_, j) => j !== i))}>
                  ×
                </button>
              </span>
            </div>
          ))}
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {editing.length < data.max && (
              <button style={button("secondary")} onClick={() => setEditing([...editing, { name: "", hint: "" }])}>
                + Add step
              </button>
            )}
            <button
              style={button("primary", busy)}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await save({ userId, stages: editing });
                  setEditing(null);
                  setMsg({ tone: "success", text: "Processing steps saved. New lots use them." });
                } catch (e) {
                  setMsg({ tone: "error", text: errorText(e) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save steps
            </button>
            <button style={button("secondary", busy)} disabled={busy} onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <label style={{ ...label, marginTop: "0.5rem" }}>Farm stages (fixed)</label>
      <div style={{ fontSize: "0.8rem", color: "#78909c" }}>{data.farmStages.map((s) => s.name).join(" → ")}</div>
    </div>
  );
}

function swap<T>(list: T[], a: number, b: number): T[] {
  const copy = [...list];
  [copy[a], copy[b]] = [copy[b], copy[a]];
  return copy;
}
