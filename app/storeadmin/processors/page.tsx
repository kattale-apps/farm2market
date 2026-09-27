"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ugandaDateFromInstant } from "../../../convex/exportMarketsShared";
import { capabilityLabel, formLabel } from "../../../convex/processorShared";
import { useStoredUser } from "../../hooks/useStoredUser";
import { formatUgandaDateTime, inUgandaTime } from "../../utils/timeUtils";
import { FONT, card, input, label, button, StatusPill, Notice, errorText } from "../../components/exportMarkets/ui";
import { TraceLevelPill } from "../../components/processor/ProcessorOperations";

type Msg = { tone: "error" | "success" | "info"; text: string } | null;

/**
 * Storage Officer: every processor, filtered. Approve facility location,
 * storage and documents (step 2), review intake and batch evidence. Super
 * admins also give full verification with the badge (step 3) here.
 */
export default function StorageOfficerProcessorsPage() {
  const { user, status: authStatus } = useStoredUser();
  const adminId = (user?.userId as Id<"users"> | undefined) ?? null;
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));
  const [filters, setFilters] = useState({ status: "", communityId: "", district: "", search: "" });
  const [view, setView] = useState<"processors" | "evidence">("processors");
  const [openId, setOpenId] = useState<Id<"users"> | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const list = useQuery(
    api.processors.listProcessorsForOfficer,
    adminId
      ? {
          adminId,
          today,
          status: filters.status || undefined,
          communityId: (filters.communityId || undefined) as Id<"communities"> | undefined,
          district: filters.district || undefined,
          search: filters.search || undefined,
        }
      : "skip"
  );

  if (authStatus === "loading") return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading...</div>;
  if (!adminId || user?.role !== "admin") return <div style={{ padding: "2rem", fontFamily: FONT }}>Storage Officers and super admins only.</div>;

  return (
    <div style={{ padding: "1rem", maxWidth: 1000, margin: "0 auto", fontFamily: FONT }}>
      <Link href="/" style={{ color: "#6d4c00", fontWeight: 700, textDecoration: "none", fontSize: "0.9rem" }}>
        ← Back to Dashboard
      </Link>
      <h1 style={{ fontSize: "clamp(1.3rem, 4vw, 1.7rem)", color: "#6d4c00", margin: "0.5rem 0" }}>🏭 Processors</h1>
      <p style={{ fontSize: "0.9rem", color: "#546e7a", marginTop: 0 }}>
        Approve processors&apos; facility locations, storage and documents, and check their intake and processing evidence. Photos marked
        &quot;entered manually&quot; came from the gallery without saved location data.
      </p>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <button style={button(view === "processors" ? "primary" : "secondary")} onClick={() => setView("processors")}>
          Processors
        </button>
        <button style={button(view === "evidence" ? "primary" : "secondary")} onClick={() => setView("evidence")}>
          Evidence to review
        </button>
      </div>

      {view === "evidence" ? (
        <EvidenceQueue adminId={adminId} setMsg={setMsg} />
      ) : list === undefined ? (
        <div style={card}>Loading...</div>
      ) : (
        <>
          <div style={{ ...card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.5rem" }}>
            <div>
              <label style={label}>Status</label>
              <select style={input} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                <option value="">All</option>
                <option value="submitted">Waiting for review</option>
                <option value="approved">Approved</option>
                <option value="draft">Draft</option>
                <option value="rejected">Needs changes</option>
                <option value="suspended">Suspended</option>
                <option value="no_profile">No profile yet</option>
              </select>
            </div>
            <div>
              <label style={label}>Community</label>
              <select style={input} value={filters.communityId} onChange={(e) => setFilters({ ...filters, communityId: e.target.value })}>
                <option value="">All</option>
                {list.communities.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>District</label>
              <select style={input} value={filters.district} onChange={(e) => setFilters({ ...filters, district: e.target.value })}>
                <option value="">All</option>
                {list.districts.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>Search</label>
              <input style={input} value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Name, facility, phone" />
            </div>
          </div>
          {list.rows.length === 0 ? (
            <div style={card}>No processors match.</div>
          ) : (
            list.rows.map((r) => (
              <div key={r.userId} style={card}>
                <button
                  onClick={() => setOpenId(openId === r.userId ? null : r.userId)}
                  style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}
                  aria-expanded={openId === r.userId}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                    <b>
                      {r.profile?.facilityName ?? `Processor ${r.alias}`}
                      {r.profile ? ` · ${r.profile.district}` : ""}
                    </b>
                    <span style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                      <StatusPill state={r.profile?.status ?? "missing"} />
                      {r.checks.platformVerified && <span style={{ fontSize: "0.75rem", color: "#1b5e20", fontWeight: 700 }}>✔ verified</span>}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#607d8b" }}>
                    Processor {r.alias}
                    {r.profile?.legalName ? ` · ${r.profile.legalName}` : ""}
                    {r.communities.length ? ` · ${r.communities.join(", ")}` : " · not yet accepted by a community"}
                    {r.pendingDocuments ? ` · ${r.pendingDocuments} document(s) to review` : ""}
                    {r.isActiveProcessor ? " · live" : ""}
                  </div>
                </button>
                {openId === r.userId && <ProcessorReview adminId={adminId} processorId={r.userId} today={today} setMsg={setMsg} />}
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

function ProcessorReview({ adminId, processorId, today, setMsg }: { adminId: Id<"users">; processorId: Id<"users">; today: string; setMsg: (m: Msg) => void }) {
  const data = useQuery(api.processors.getProcessorForReview, { adminId, processorId, today });
  const reviewDoc = useMutation(api.processors.reviewProcessorDocument);
  const reviewProfile = useMutation(api.processors.reviewProcessorProfile);
  const setVerified = useMutation(api.processors.setProcessorPlatformVerified);
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
  if (data === undefined) return <div style={{ marginTop: "0.5rem" }}>Loading...</div>;
  if (data === null) return <div style={{ marginTop: "0.5rem" }}>Processor not found.</div>;
  const p = data.profile;
  return (
    <div style={{ marginTop: "0.75rem", borderTop: "1px solid #eee", paddingTop: "0.75rem", fontSize: "0.88rem" }}>
      <div>
        Contact: {data.phoneNumber ?? ""} {data.email ?? ""} · Fee: <StatusPill state={data.fee.state} />
      </div>
      {!p ? (
        <Notice tone="info">No facility profile yet.</Notice>
      ) : (
        <>
          <div style={{ lineHeight: 1.6, marginTop: "0.4rem" }}>
            <b>{p.legalName}</b>
            {p.tradingName ? ` (${p.tradingName})` : ""} · TIN {p.tin}
            {p.processingLicenceNumber ? ` · licence ${p.processingLicenceNumber}` : ""}
            <br />
            {p.facilityName}, {p.facilityAddress}, {p.district}
            {p.facilityLat !== undefined && p.facilityLng !== undefined ? (
              <>
                {" "}
                ·{" "}
                <a href={`https://www.google.com/maps?q=${p.facilityLat},${p.facilityLng}`} target="_blank" rel="noreferrer">
                  📍 {p.facilityLat.toFixed(5)}, {p.facilityLng.toFixed(5)}
                </a>
              </>
            ) : (
              <span style={{ color: "#c62828" }}> · no GPS location</span>
            )}
            <br />
            Does: {p.capabilities.map(capabilityLabel).join(", ")} · Crops: {p.crops.join(", ")}
            <br />
            Capacity {p.processingCapacityTonnesPerMonth} t/month · storage {p.storageCapacityTonnes} t ({p.storageType})
            <br />
            Contact person: {p.contactPerson}, {p.contactPhone}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
            {data.facilityPhotos.map((ph) =>
              ph.url ? (
                <a key={ph.storageId} href={ph.url} target="_blank" rel="noreferrer" style={{ fontSize: "0.7rem", color: "#555", textDecoration: "none", width: 110 }}>
                  <img src={ph.url} alt="" style={{ width: 110, height: 80, objectFit: "cover", borderRadius: 4, display: "block" }} />
                  {ph.lat != null ? `📍 ${ph.lat.toFixed(4)}, ${ph.lng?.toFixed(4)}` : "no GPS"}
                  <br />
                  {new Date(ph.capturedAt).toLocaleString(undefined, inUgandaTime({ dateStyle: "short", timeStyle: "short" }))}
                  {ph.manualEntry && <span style={{ display: "block", color: "#e65100", fontWeight: 700 }}>✍️ Entered manually</span>}
                </a>
              ) : null
            )}
          </div>
        </>
      )}

      <h3 style={{ fontSize: "0.95rem", margin: "0.9rem 0 0.3rem" }}>Documents</h3>
      {data.documents.map((d) => {
        const doc = d.current;
        return (
          <div key={d.type.key} style={{ borderTop: "1px solid #f3f3f3", padding: "0.45rem 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
              <span>
                {d.type.label}
                {d.type.required ? " *" : ""}
              </span>
              <StatusPill state={d.state} />
            </div>
            {doc && (
              <div style={{ fontSize: "0.8rem" }}>
                {doc.url ? (
                  <a href={doc.url} target="_blank" rel="noreferrer">
                    {doc.fileName}
                  </a>
                ) : (
                  doc.fileName
                )}
                {doc.documentNumber ? ` · no. ${doc.documentNumber}` : ""}
                {doc.expiryDate ? ` · expires ${doc.expiryDate}` : ""} · uploaded {formatUgandaDateTime(doc.uploadedAt)}
              </div>
            )}
            {doc?.status === "pending" && (
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
                <input style={{ ...input, maxWidth: 240 }} placeholder="Reason (to reject)" value={notes[doc._id] ?? ""} onChange={(e) => setNotes({ ...notes, [doc._id]: e.target.value })} />
                <button style={button("primary", busy === doc._id)} disabled={busy === doc._id} onClick={() => run(doc._id, () => reviewDoc({ adminId, documentId: doc._id, decision: "verify" }), "Document verified.")}>
                  Verify
                </button>
                <button style={button("danger", busy === doc._id)} disabled={busy === doc._id} onClick={() => run(doc._id, () => reviewDoc({ adminId, documentId: doc._id, decision: "reject", notes: notes[doc._id] }), "Document rejected.")}>
                  Reject
                </button>
              </div>
            )}
          </div>
        );
      })}

      {p && (
        <div style={{ marginTop: "0.9rem", background: "#fff8e1", border: "1px solid #ffd54f", borderRadius: 10, padding: "0.75rem" }}>
          <b>Step 2: facility, storage and documents</b>
          <div style={{ fontSize: "0.8rem", color: "#607d8b", margin: "0.2rem 0 0.4rem" }}>
            Approval needs community acceptance, a GPS location with photos, every required document verified and the fee paid.
          </div>
          <input style={{ ...input, marginBottom: "0.4rem" }} placeholder="Note (needed to reject or suspend)" value={notes[p._id] ?? ""} onChange={(e) => setNotes({ ...notes, [p._id]: e.target.value })} />
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {p.status !== "approved" && p.status !== "suspended" && (
              <button style={button("primary", busy === p._id)} disabled={busy === p._id} onClick={() => run(p._id, () => reviewProfile({ adminId, profileId: p._id, decision: "approve", notes: notes[p._id] }), "Facility approved.")}>
                Approve facility
              </button>
            )}
            {p.status !== "approved" && p.status !== "suspended" && (
              <button style={button("danger", busy === p._id)} disabled={busy === p._id} onClick={() => run(p._id, () => reviewProfile({ adminId, profileId: p._id, decision: "reject", notes: notes[p._id] }), "Sent back for changes.")}>
                Needs changes
              </button>
            )}
            {p.status === "approved" && (
              <button style={button("danger", busy === p._id)} disabled={busy === p._id} onClick={() => run(p._id, () => reviewProfile({ adminId, profileId: p._id, decision: "suspend", notes: notes[p._id] }), "Processor suspended.")}>
                Suspend
              </button>
            )}
            {p.status === "suspended" && (
              <button style={button("primary", busy === p._id)} disabled={busy === p._id} onClick={() => run(p._id, () => reviewProfile({ adminId, profileId: p._id, decision: "reinstate", notes: notes[p._id] }), "Processor reinstated.")}>
                Reinstate
              </button>
            )}
          </div>
        </div>
      )}

      {p && data.canVerifyPlatform && (
        <div style={{ marginTop: "0.75rem", background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 10, padding: "0.75rem" }}>
          <b>Step 3: full verification (super admin)</b>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
            {data.checks.platformVerified ? (
              <button
                style={button("danger", busy === "verify")}
                disabled={busy === "verify"}
                onClick={() => run("verify", () => setVerified({ adminId, processorId, verified: false, notes: notes[p._id] }), "Verification removed.")}
              >
                Remove verification
              </button>
            ) : (
              <button style={button("primary", busy === "verify")} disabled={busy === "verify"} onClick={() => run("verify", () => setVerified({ adminId, processorId, verified: true }), "Processor fully verified.")}>
                Fully verify (badge)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EvidenceQueue({ adminId, setMsg }: { adminId: Id<"users">; setMsg: (m: Msg) => void }) {
  const data = useQuery(api.processorOperations.listOperationsEvidenceForReview, { adminId });
  const reviewIntake = useMutation(api.processorOperations.reviewIntakeEvidence);
  const reviewBatch = useMutation(api.processorOperations.reviewBatchEvidence);
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
  if (data === undefined) return <div style={card}>Loading...</div>;
  if (data.intakes.length === 0 && data.batches.length === 0) return <div style={card}>Nothing waiting for review.</div>;
  const photoGrid = (photos: { storageId: string; url: string | null; lat?: number; lng?: number; capturedAt: string; manualEntry?: boolean; locationSource?: string }[]) => (
    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", margin: "0.4rem 0" }}>
      {photos.map((ph) =>
        ph.url ? (
          <a key={ph.storageId} href={ph.url} target="_blank" rel="noreferrer" style={{ fontSize: "0.7rem", color: "#555", textDecoration: "none", width: 120 }}>
            <img src={ph.url} alt="" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 4, display: "block" }} />
            {ph.lat != null ? `📍 ${ph.lat.toFixed(4)}, ${ph.lng?.toFixed(4)}` : "no GPS"}
            <br />
            {new Date(ph.capturedAt).toLocaleString(undefined, inUgandaTime({ dateStyle: "short", timeStyle: "short" }))}
            {ph.manualEntry && <span style={{ display: "block", color: "#e65100", fontWeight: 700 }}>✍️ Entered manually</span>}
            {ph.locationSource === "exif" && <span style={{ display: "block", color: "#2e7d32" }}>Gallery, from photo data</span>}
          </a>
        ) : null
      )}
    </div>
  );
  const actions = (id: string, approve: () => Promise<unknown>, reject: () => Promise<unknown>) => (
    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
      <input style={{ ...input, maxWidth: 260 }} placeholder="Reason (to reject)" value={notes[id] ?? ""} onChange={(e) => setNotes({ ...notes, [id]: e.target.value })} />
      <button style={button("primary", busy === id)} disabled={busy === id} onClick={() => run(id, approve, "Approved.")}>
        Approve
      </button>
      <button style={button("danger", busy === id)} disabled={busy === id} onClick={() => run(id, reject, "Rejected.")}>
        Reject
      </button>
    </div>
  );
  return (
    <>
      {data.intakes.map(({ intake, facility, farmerLabel, photos, manualPhotos }) => (
        <div key={intake._id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
            <b>
              Intake {intake.intakeCode} · {intake.kilos} kg {formLabel(intake.inputForm)}
            </b>
            <TraceLevelPill level={intake.sourceKind === "platform_farmer" ? "platform_traced" : "declared"} />
          </div>
          <div style={{ fontSize: "0.82rem", color: "#455a64" }}>
            {facility} · {farmerLabel}
            {intake.district ? ` · ${intake.district}` : ""} · {intake.intakeDate}
            {intake.lat !== undefined && intake.lng !== undefined && (
              <>
                {" "}
                ·{" "}
                <a href={`https://www.google.com/maps?q=${intake.lat},${intake.lng}`} target="_blank" rel="noreferrer">
                  farm location
                </a>
              </>
            )}
            {intake.farmerConfirmation ? ` · farmer ${intake.farmerConfirmation}` : ""}
          </div>
          {photoGrid(photos)}
          {manualPhotos && <Notice tone="info">Some photos had their location and time entered by hand. Check them against the farm location.</Notice>}
          {actions(
            intake._id,
            () => reviewIntake({ adminId, intakeId: intake._id, decision: "approve" }),
            () => reviewIntake({ adminId, intakeId: intake._id, decision: "reject", notes: notes[intake._id] })
          )}
        </div>
      ))}
      {data.batches.map(({ batch, facility, outturnPercent, photos, manualPhotos, massBalanceWarning }) => (
        <div key={batch._id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
            <b>
              Batch {batch.batchCode} · {formLabel(batch.outputForm)}
              {batch.grade ? ` · ${batch.grade}` : ""}
            </b>
            <TraceLevelPill level={batch.traceLevel} />
          </div>
          <div style={{ fontSize: "0.82rem", color: "#455a64" }}>
            {facility} · in {batch.weightInKg} kg → out {batch.weightOutKg} kg{outturnPercent != null ? ` · outturn ${outturnPercent}%` : ""} · steps{" "}
            {batch.steps.map(capabilityLabel).join(", ")}
          </div>
          {photoGrid(photos)}
          {massBalanceWarning && <Notice tone="error">{massBalanceWarning}</Notice>}
          {manualPhotos && <Notice tone="info">Some photos had their location and time entered by hand.</Notice>}
          {actions(
            batch._id,
            () => reviewBatch({ adminId, batchId: batch._id, decision: "approve" }),
            () => reviewBatch({ adminId, batchId: batch._id, decision: "reject", notes: notes[batch._id] })
          )}
        </div>
      ))}
    </>
  );
}
