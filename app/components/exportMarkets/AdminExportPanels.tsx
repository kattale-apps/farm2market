"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatUgandaDateTime, inUgandaTime } from "../../utils/timeUtils";
import { INCOTERMS, PipelineStep, ugandaDateFromInstant } from "../../../convex/exportMarketsShared";
import { card, input, label, button, Notice, StatusPill, errorText, formatUsd } from "./ui";

type Msg = { tone: "error" | "success" | "info"; text: string } | null;
type P = { adminId: Id<"users">; setMsg: (m: Msg) => void };

// ------------------------------------------------------------------
// Deals: tasks waiting on an admin, and the deal list
// ------------------------------------------------------------------

export function AdminDealsPanel({ adminId, setMsg }: P) {
  const tasks = useQuery(api.exportDeals.listAdminDealTasks, { adminId });
  const [status, setStatus] = useState<"enquiry" | "quoted" | "in_progress" | "completed" | "declined" | "cancelled">("in_progress");
  const deals = useQuery(api.exportDeals.listDealsForAdmin, { adminId, status });
  const reviewKyc = useMutation(api.exportDeals.reviewBuyerKyc);
  const reviewDoc = useMutation(api.exportDeals.reviewDealDocument);
  const [notes, setNotes] = useState<Record<string, string>>({});
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
    <div>
      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Buyer KYC waiting for approval</h2>
        {!tasks ? (
          "Loading..."
        ) : tasks.kycBuyers.length === 0 ? (
          <p style={{ fontSize: "0.88rem", margin: 0 }}>None.</p>
        ) : (
          tasks.kycBuyers.map((b) => (
            <div key={b.buyerId} style={{ borderTop: "1px solid #eee", padding: "0.5rem 0", fontSize: "0.88rem" }}>
              <b>{b.businessName}</b> (alias {b.alias}, {b.country}) · deals {b.dealCodes.join(", ")}
              <div style={{ fontSize: "0.78rem", color: "#666" }}>Verify each document in the Documents tab first.</div>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
                <input style={{ ...input, maxWidth: 280 }} placeholder="Reason (to reject)" value={notes[b.buyerId] ?? ""} onChange={(e) => setNotes({ ...notes, [b.buyerId]: e.target.value })} />
                <button style={button("primary", busy === b.buyerId)} disabled={busy === b.buyerId} onClick={() => run(b.buyerId, () => reviewKyc({ adminId, buyerId: b.buyerId, decision: "approve" }), "KYC approved.")}>
                  Approve KYC
                </button>
                <button
                  style={button("danger", busy === b.buyerId)}
                  disabled={busy === b.buyerId}
                  onClick={() => run(b.buyerId, () => reviewKyc({ adminId, buyerId: b.buyerId, decision: "reject", notes: notes[b.buyerId] }), "KYC rejected.")}
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Sample desk</h2>
        {!tasks ? (
          "Loading..."
        ) : tasks.sampleTasks.length === 0 ? (
          <p style={{ fontSize: "0.88rem", margin: 0 }}>No samples to collect or send.</p>
        ) : (
          tasks.sampleTasks.map((t) => (
            <div key={t.dealId} style={{ borderTop: "1px solid #eee", padding: "0.5rem 0", fontSize: "0.85rem", lineHeight: 1.6 }}>
              <b>
                {t.dealCode} · lot {t.lotCode}
              </b>{" "}
              <StatusPill state={t.status === "ready" ? "pending" : "submitted"} /> {t.status === "ready" ? "Collect from exporter" : "Send to buyer"}
              {t.round > 1 && ` (sample ${t.round})`}
              <div>Collect from: {t.collectFrom} · warehouse {t.warehouse}</div>
              <div>Ship to: {t.shipTo}</div>
              <div style={{ fontSize: "0.75rem", color: "#666" }}>Relabel the sample with the lot code only, so neither side is identified.</div>
              <Link href={`/export-deals/${t.dealId}`} style={{ color: "#0d47a1", fontWeight: 700 }}>
                Open deal to update the sample →
              </Link>
            </div>
          ))
        )}
      </div>

      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Deal documents to review</h2>
        {!tasks ? (
          "Loading..."
        ) : tasks.pendingDocs.length === 0 ? (
          <p style={{ fontSize: "0.88rem", margin: 0 }}>None.</p>
        ) : (
          tasks.pendingDocs.map((d) => (
            <div key={d._id} style={{ borderTop: "1px solid #eee", padding: "0.5rem 0", fontSize: "0.85rem" }}>
              <b>{d.label}</b> · {d.dealCode} · from the {d.uploaderRole} · {formatUgandaDateTime(d.uploadedAt)}
              {d.lat != null && ` · 📍 ${d.lat.toFixed(4)}, ${d.lng?.toFixed(4)}`}
              <div>
                {d.url && (
                  <a href={d.url} target="_blank" rel="noreferrer">
                    Open {d.fileName}
                  </a>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
                <input style={{ ...input, maxWidth: 280 }} placeholder="Reason (to reject)" value={notes[d._id] ?? ""} onChange={(e) => setNotes({ ...notes, [d._id]: e.target.value })} />
                <button style={button("primary", busy === d._id)} disabled={busy === d._id} onClick={() => run(d._id, () => reviewDoc({ adminId, documentId: d._id, decision: "accept" }), "Document accepted.")}>
                  Accept
                </button>
                <button
                  style={button("danger", busy === d._id)}
                  disabled={busy === d._id}
                  onClick={() => run(d._id, () => reviewDoc({ adminId, documentId: d._id, decision: "reject", notes: notes[d._id] }), "Document rejected.")}
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>All deals</h2>
          <select style={{ ...input, maxWidth: 200 }} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="enquiry">Enquiries</option>
            <option value="quoted">Quoted</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="declined">Declined</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        {!deals ? (
          "Loading..."
        ) : deals.length === 0 ? (
          <p style={{ fontSize: "0.88rem" }}>None.</p>
        ) : (
          deals.map((d) => (
            <Link key={d._id} href={`/export-deals/${d._id}`} style={{ display: "block", borderTop: "1px solid #eee", padding: "0.5rem 0", fontSize: "0.85rem", color: "#222", textDecoration: "none" }}>
              <b>{d.dealCode}</b> · lot {d.lotCode} · {d.bags} bags {d.incoterm}
              {d.contractValueUsd != null && ` · ${formatUsd(d.contractValueUsd)}`} · now: {d.currentStep} · {formatUgandaDateTime(d.updatedAt)}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Trace evidence review
// ------------------------------------------------------------------

export function AdminTracePanel({ adminId, setMsg }: P) {
  const items = useQuery(api.exportLots.listTraceEvidenceForReview, { adminId });
  const review = useMutation(api.exportLots.reviewTraceEvidence);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  if (items === undefined) return <div style={card}>Loading...</div>;
  if (items.length === 0) return <div style={card}>No trace evidence waiting for you.</div>;
  return (
    <div>
      {items.map((it) => {
        const id = it.evidence._id;
        const act = async (decision: "approve" | "reject") => {
          setBusy(id);
          try {
            await review({ adminId, evidenceId: id, decision, notes: notes[id] || undefined });
            setMsg({ tone: "success", text: decision === "approve" ? "Stage verified." : "Stage rejected." });
          } catch (e) {
            setMsg({ tone: "error", text: errorText(e) });
          } finally {
            setBusy(null);
          }
        };
        return (
          <div key={id} style={card}>
            <b>
              {it.stageName} · lot {it.lotCode}
            </b>{" "}
            <span style={{ fontSize: "0.78rem", color: "#666" }}>
              ({it.scope === "farm" ? "farm stage" : "exporter stage"}) · {it.lotSummary} · exporter {it.exporterAlias}
            </span>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", margin: "0.5rem 0" }}>
              {it.photos.map((p, i) =>
                p.url ? (
                  <a key={i} href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: "0.7rem", color: "#555", textDecoration: "none" }}>
                    <img src={p.url} alt="" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 4, display: "block" }} />
                    {p.lat != null ? `📍 ${p.lat.toFixed(4)}, ${p.lng?.toFixed(4)}` : "no GPS"}
                    <br />
                    {new Date(p.capturedAt).toLocaleString(undefined, inUgandaTime({ dateStyle: "short", timeStyle: "short" }))}
                  </a>
                ) : null
              )}
            </div>
            <div style={{ fontSize: "0.85rem" }}>
              {it.evidence.weightInKg != null && `In ${it.evidence.weightInKg} kg `}
              {it.evidence.weightOutKg != null && `· Out ${it.evidence.weightOutKg} kg`}
              {it.evidence.notes && <div>Notes: {it.evidence.notes}</div>}
            </div>
            {it.massBalanceWarning && <Notice tone="error">{it.massBalanceWarning}</Notice>}
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
              <input style={{ ...input, maxWidth: 280 }} placeholder="Reason (to reject)" value={notes[id] ?? ""} onChange={(e) => setNotes({ ...notes, [id]: e.target.value })} />
              <button style={button("primary", busy === id)} disabled={busy === id} onClick={() => act("approve")}>
                Verify stage
              </button>
              <button style={button("danger", busy === id)} disabled={busy === id} onClick={() => act("reject")}>
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------
// Pipeline templates (super admin)
// ------------------------------------------------------------------

export function AdminPipelinePanel({ adminId, setMsg }: P) {
  const [incoterm, setIncoterm] = useState<string>("FOB");
  const tpl = useQuery(api.exportDeals.getPipelineTemplate, { incoterm });
  const save = useMutation(api.exportDeals.savePipelineTemplate);
  const [steps, setSteps] = useState<PipelineStep[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setSteps(tpl ? (tpl.steps as PipelineStep[]) : null);
  }, [tpl]);
  if (!steps) return <div style={card}>Loading...</div>;
  const update = (i: number, patch: Partial<PipelineStep>) => setSteps(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const disclosureIdx = steps.findIndex((s) => s.key === "disclosure");

  return (
    <div style={card}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ ...label, margin: 0 }}>Incoterm</label>
        <select style={{ ...input, maxWidth: 140 }} value={incoterm} onChange={(e) => setIncoterm(e.target.value)}>
          {INCOTERMS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <span style={{ fontSize: "0.8rem", color: "#666" }}>{tpl?.customised ? "Customised" : "Default template"}</span>
      </div>
      <p style={{ fontSize: "0.8rem", color: "#666" }}>
        Built-in steps keep their order and behaviour; you can rename them and change the documents required. Custom steps can only come after identities
        are revealed. Changes apply to new deals only.
      </p>
      {steps.map((s, i) => (
        <div key={s.key} style={{ borderTop: "1px solid #eee", padding: "0.5rem 0", fontSize: "0.85rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ width: 22 }}>{i + 1}.</b>
            <input style={{ ...input, maxWidth: 280 }} value={s.name} onChange={(e) => update(i, { name: e.target.value })} />
            <span style={{ color: "#777", fontSize: "0.75rem" }}>
              {s.system ? "built-in" : "custom"} · {s.kind} · {s.actor}
            </span>
            {!s.system && (
              <button style={{ ...button("danger"), padding: "0.2rem 0.5rem", fontSize: "0.72rem" }} onClick={() => setSteps(steps.filter((_, j) => j !== i))}>
                Remove
              </button>
            )}
          </div>
          {s.kind === "documents" && (
            <textarea
              style={{ ...input, minHeight: 50, marginTop: "0.3rem" }}
              value={s.requiredDocuments.join("\n")}
              onChange={(e) => update(i, { requiredDocuments: e.target.value.split("\n") })}
              placeholder="One required document per line"
            />
          )}
        </div>
      ))}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
        <button
          style={button("secondary")}
          onClick={() => {
            const key = `custom_${Date.now().toString(36)}`;
            const at = steps.length - 1; // before the rating step
            const s: PipelineStep = { key, name: "New step", actor: "exporter", kind: "documents", system: false, requiredDocuments: ["Document"] };
            setSteps([...steps.slice(0, Math.max(at, disclosureIdx + 1)), s, ...steps.slice(Math.max(at, disclosureIdx + 1))]);
          }}
        >
          + Add document step
        </button>
        <button
          style={button("secondary")}
          onClick={() => {
            const key = `custom_${Date.now().toString(36)}`;
            const at = steps.length - 1;
            const s: PipelineStep = { key, name: "Confirm", actor: "buyer", kind: "confirm", system: false, requiredDocuments: [] };
            setSteps([...steps.slice(0, at), s, ...steps.slice(at)]);
          }}
        >
          + Add confirmation step
        </button>
      </div>
      {steps.some((s) => !s.system) && (
        <div style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
          {steps.map((s, i) =>
            s.system ? null : (
              <div key={s.key} style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginTop: "0.3rem" }}>
                <span style={{ width: 160 }}>{s.name}: who acts</span>
                <select style={{ ...input, maxWidth: 140 }} value={s.actor} onChange={(e) => update(i, { actor: e.target.value as PipelineStep["actor"] })}>
                  <option value="buyer">Buyer</option>
                  <option value="exporter">Exporter</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
        <button
          style={button("primary", busy)}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await save({ adminId, incoterm, steps: steps.map((s) => ({ ...s, requiredDocuments: s.requiredDocuments.filter((d) => d.trim()) })) });
              setMsg({ tone: "success", text: `${incoterm} pipeline saved.` });
            } catch (e) {
              setMsg({ tone: "error", text: errorText(e) });
            } finally {
              setBusy(false);
            }
          }}
        >
          Save {incoterm} pipeline
        </button>
        {tpl?.customised && (
          <button
            style={button("danger", busy)}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await save({ adminId, incoterm, steps: [], reset: true });
                setMsg({ tone: "success", text: "Reset to default." });
              } catch (e) {
                setMsg({ tone: "error", text: errorText(e) });
              } finally {
                setBusy(false);
              }
            }}
          >
            Reset to default
          </button>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Reference prices (super admin)
// ------------------------------------------------------------------

export function AdminPricesPanel({ adminId, setMsg }: P) {
  const prices = useQuery(api.exportPrices.getReferencePrices, {});
  const setPrice = useMutation(api.exportPrices.setReferencePrice);
  const refresh = useAction(api.exportPrices.refreshIcoCompositeNow);
  const [f, setF] = useState({ key: "robusta" as "arabica" | "robusta", value: "", unit: "US cents/lb" as "US cents/lb" | "USD/kg", asOf: ugandaDateFromInstant(Date.now()), source: "", sourceUrl: "" });
  const [busy, setBusy] = useState(false);
  return (
    <div style={card}>
      <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Coffee reference prices</h2>
      <p style={{ fontSize: "0.8rem", color: "#666" }}>
        The ICO monthly composite average is read from the ICO homepage once a day (free). Enter daily Arabica and Robusta reference prices here, with
        their source, for fresher figures.
      </p>
      {prices?.map((p) => (
        <div key={p._id} style={{ fontSize: "0.85rem", borderTop: "1px solid #eee", padding: "0.35rem 0" }}>
          <b>{p.label}</b>: {p.value} {p.unit} · {p.asOf} · {p.source} · updated {formatUgandaDateTime(p.updatedAt)}
        </div>
      ))}
      <button
        style={{ ...button("secondary", busy), margin: "0.5rem 0" }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await refresh({ adminId });
            setMsg({ tone: r.found ? "success" : "error", text: r.found ? "ICO price refreshed." : "The ICO homepage did not show the composite price right now." });
          } catch (e) {
            setMsg({ tone: "error", text: errorText(e) });
          } finally {
            setBusy(false);
          }
        }}
      >
        Refresh ICO price now
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.5rem" }}>
        <select style={input} value={f.key} onChange={(e) => setF({ ...f, key: e.target.value as typeof f.key })}>
          <option value="robusta">Robusta</option>
          <option value="arabica">Arabica</option>
        </select>
        <input style={input} placeholder="Price" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
        <select style={input} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value as typeof f.unit })}>
          <option>US cents/lb</option>
          <option>USD/kg</option>
        </select>
        <input style={input} type="date" value={f.asOf} onChange={(e) => setF({ ...f, asOf: e.target.value })} />
        <input style={input} placeholder="Source *" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} />
        <input style={input} placeholder="Source link" value={f.sourceUrl} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} />
      </div>
      <button
        style={{ ...button("primary", busy), marginTop: "0.5rem" }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await setPrice({ adminId, key: f.key, value: Number(f.value), unit: f.unit, asOf: f.asOf, source: f.source, sourceUrl: f.sourceUrl || undefined });
            setMsg({ tone: "success", text: "Price saved." });
          } catch (e) {
            setMsg({ tone: "error", text: errorText(e) });
          } finally {
            setBusy(false);
          }
        }}
      >
        Save price
      </button>
    </div>
  );
}
