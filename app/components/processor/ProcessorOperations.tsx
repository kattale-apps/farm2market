"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { BATCH_OUTPUT_FORMS, INTAKE_FORMS, PROCESSING_CAPABILITIES, capabilityLabel, formLabel } from "../../../convex/processorShared";
import { COFFEE_TYPES, PROCESSING_METHODS } from "../../../convex/exportMarketsShared";
import { getCurrentLocation } from "../../utils/gps";
import { card, input, label, button, StatusPill, Notice, errorText, formatUgx } from "../exportMarkets/ui";
import { PhotoSetCapture, CapturedPhoto } from "../exportMarkets/PhotoSetCapture";
import { PROCESSOR_HEADING, PROCESSOR_SOFT, PROCESSOR_BORDER, chip, uploadEvidencePhotos } from "./ProcessorWorkspace";

type Msg = { tone: "error" | "success" | "info"; text: string } | null;
type TabProps = { userId: Id<"users">; member: boolean; today: string; crops: { key: string; label: string }[]; setMsg: (m: Msg) => void };

/** Crop picker shown only when the processor handles more than one open crop. */
function CropSelect({ crops, value, onChange }: { crops: { key: string; label: string }[]; value: string; onChange: (c: string) => void }) {
  if (crops.length <= 1) return null;
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <label style={label}>Crop *</label>
      <select style={input} value={value} onChange={(e) => onChange(e.target.value)}>
        {crops.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export const TRACE_LEVEL_LABEL: Record<string, string> = {
  platform_traced: "Platform traced",
  partly_declared: "Partly declared",
  declared_evidenced: "Declared + evidenced",
  declared: "Declared",
};

export function TraceLevelPill({ level }: { level: string }) {
  const colors: Record<string, [string, string]> = {
    platform_traced: ["#e8f5e9", "#1b5e20"],
    partly_declared: ["#fff3e0", "#e65100"],
    declared_evidenced: ["#e3f2fd", "#0d47a1"],
    declared: ["#f5f5f5", "#616161"],
  };
  const [bg, fg] = colors[level] ?? colors.declared;
  return <span style={{ background: bg, color: fg, borderRadius: 999, padding: "0.12rem 0.55rem", fontSize: "0.74rem", fontWeight: 700 }}>{TRACE_LEVEL_LABEL[level] ?? level}</span>;
}

export function PhotoStrip({ photos }: { photos: { url: string | null; manualEntry?: boolean; lat?: number; lng?: number }[] }) {
  if (photos.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
      {photos.map((p, i) =>
        p.url ? (
          <a key={i} href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: "0.68rem", color: "#555", textDecoration: "none", width: 72 }}>
            <img src={p.url} alt="" style={{ width: 72, height: 56, objectFit: "cover", borderRadius: 4, display: "block" }} />
            {p.manualEntry ? <span style={{ color: "#e65100", fontWeight: 700 }}>✍️ manual</span> : p.lat != null ? "📍 GPS" : "no GPS"}
          </a>
        ) : null
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Intake
// ------------------------------------------------------------------

export function ProcessorIntakeTab({ userId, member, today, crops, setMsg }: TabProps) {
  const intakes = useQuery(api.processorOperations.listMyIntakes, { userId });
  const [adding, setAdding] = useState(false);
  return (
    <>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "1.15rem", color: PROCESSOR_HEADING }}>Intake from farmers</h2>
          {member && !adding && (
            <button style={button("primary")} onClick={() => setAdding(true)}>
              + Record intake
            </button>
          )}
        </div>
        <p style={{ fontSize: "0.85rem", color: "#607d8b" }}>
          A farmer on the app is asked to confirm the delivery. A farmer who is not on the app is recorded as <b>declared</b> with the farm
          location; photos approved by the Storage and Transport Officer raise it to <b>declared + evidenced</b>.
        </p>
        {!member && <Notice tone="info">You can record intake once a community admin accepts you as a processor.</Notice>}
        {adding && <IntakeForm userId={userId} today={today} crops={crops} setMsg={setMsg} onDone={() => setAdding(false)} />}
      </div>
      {intakes === undefined ? (
        <div style={card}>Loading intake...</div>
      ) : intakes.length === 0 ? (
        <div style={card}>No intake recorded yet.</div>
      ) : (
        intakes.map((i) => <IntakeRow key={i._id} intake={i} userId={userId} setMsg={setMsg} />)
      )}
    </>
  );
}

type IntakeRowData = FunctionReturnType<typeof api.processorOperations.listMyIntakes>[number];

function IntakeRow({ intake, userId, setMsg }: { intake: IntakeRowData; userId: Id<"users">; setMsg: (m: Msg) => void }) {
  const getUrl = useMutation(api.processors.generateProcessorUploadUrl);
  const setPhotos = useMutation(api.processorOperations.setIntakePhotos);
  const [adding, setAdding] = useState<CapturedPhoto[] | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ ...card, padding: "0.85rem 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
        <b>
          {intake.intakeCode} · {intake.kilos} kg {formLabel(intake.inputForm)}
        </b>
        <span style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
          <TraceLevelPill level={intake.sourceKind === "platform_farmer" ? "platform_traced" : intake.evidenceStatus === "approved" ? "declared_evidenced" : "declared"} />
          <StatusPill state={intake.evidenceStatus === "approved" ? "verified" : intake.evidenceStatus === "none" ? "missing" : intake.evidenceStatus} />
        </span>
      </div>
      <div style={{ fontSize: "0.82rem", color: "#455a64", marginTop: "0.25rem", lineHeight: 1.55 }}>
        {intake.farmerLabel}
        {intake.district ? ` · ${intake.district}` : ""} · {intake.intakeDate}
        {intake.pricePerKgUgx != null ? ` · ${formatUgx(intake.pricePerKgUgx)}/kg` : ""} · {intake.remainingKilos} kg not yet processed
        {intake.farmerConfirmation && (
          <div>
            Farmer confirmation:{" "}
            <b style={{ color: intake.farmerConfirmation === "confirmed" ? "#2e7d32" : intake.farmerConfirmation === "disputed" ? "#c62828" : "#e65100" }}>{intake.farmerConfirmation}</b>
          </div>
        )}
        {intake.eudrIssue && <div style={{ color: "#e65100" }}>EUDR: {intake.eudrIssue}</div>}
        {intake.evidenceStatus === "rejected" && intake.reviewNotes && <div style={{ color: "#c62828" }}>Storage and Transport Officer: {intake.reviewNotes}</div>}
      </div>
      <PhotoStrip photos={intake.photoRows} />
      {intake.evidenceStatus !== "approved" &&
        (adding === null ? (
          <button style={{ ...button("secondary"), marginTop: "0.5rem", fontSize: "0.8rem" }} onClick={() => setAdding([])}>
            {intake.photos.length ? "Replace photos" : "Add photos"}
          </button>
        ) : (
          <div style={{ marginTop: "0.5rem" }}>
            <PhotoSetCapture photos={adding} onChange={setAdding} />
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
              <button
                style={button("primary", busy || adding.length === 0)}
                disabled={busy || adding.length === 0}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const photos = await uploadEvidencePhotos(() => getUrl({ userId }), adding);
                    await setPhotos({ userId, intakeId: intake._id, photos });
                    setAdding(null);
                    setMsg({ tone: "success", text: "Photos sent to the Storage and Transport Officer." });
                  } catch (e) {
                    setMsg({ tone: "error", text: errorText(e) });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Uploading..." : "Send for review"}
              </button>
              <button style={button("secondary", busy)} disabled={busy} onClick={() => setAdding(null)}>
                Cancel
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}

function IntakeForm({ userId, today, crops, setMsg, onDone }: { userId: Id<"users">; today: string; crops: { key: string; label: string }[]; setMsg: (m: Msg) => void; onDone: () => void }) {
  const [crop, setCrop] = useState(crops[0]?.key ?? "coffee");
  const record = useMutation(api.processorOperations.recordIntake);
  const getUrl = useMutation(api.processors.generateProcessorUploadUrl);
  const [sourceKind, setSourceKind] = useState<"platform_farmer" | "declared">("declared");
  const [search, setSearch] = useState("");
  const farmers = useQuery(api.processorOperations.findFarmerForIntake, sourceKind === "platform_farmer" && search.trim().length >= 3 ? { userId, search } : "skip");
  const [farmerId, setFarmerId] = useState<Id<"users"> | null>(null);
  const [f, setF] = useState({ inputForm: "kiboko", kilos: "", price: "", intakeDate: today, farmerName: "", farmerPhone: "", village: "", district: "", lat: "", lng: "", areaHa: "", polygon: "", notes: "" });
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [paidCash, setPaidCash] = useState(true);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const num = (s: string) => (s.trim() ? Number(s) : undefined);
  const areaHa = num(f.areaHa);

  return (
    <div style={{ background: PROCESSOR_SOFT, border: `1px solid ${PROCESSOR_BORDER}`, borderRadius: 10, padding: "0.85rem", marginTop: "0.5rem" }}>
      <CropSelect crops={crops} value={crop} onChange={setCrop} />
      <label style={label}>Who delivered it?</label>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <label style={chip(sourceKind === "platform_farmer", false)}>
          <input type="radio" checked={sourceKind === "platform_farmer"} onChange={() => setSourceKind("platform_farmer")} /> A farmer on the app
        </label>
        <label style={chip(sourceKind === "declared", false)}>
          <input type="radio" checked={sourceKind === "declared"} onChange={() => setSourceKind("declared")} /> A farmer not on the app
        </label>
      </div>

      {sourceKind === "platform_farmer" ? (
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={label}>Farmer&apos;s phone number or alias *</label>
          <input style={input} value={search} onChange={(e) => { setSearch(e.target.value); setFarmerId(null); }} placeholder="e.g. 0772 123456" />
          {farmers && farmers.length === 0 && <div style={{ fontSize: "0.8rem", color: "#777" }}>No farmer found. Record them as a farmer not on the app instead.</div>}
          {farmers?.map((fr) => (
            <label key={fr.userId} style={{ ...chip(farmerId === fr.userId, false), marginTop: "0.4rem", borderRadius: 10 }}>
              <input type="radio" checked={farmerId === fr.userId} onChange={() => setFarmerId(fr.userId)} />
              Farmer {fr.alias}
              {fr.district ? ` · ${fr.district}` : ""}
              {!fr.hasGps && <span style={{ fontSize: "0.72rem", color: "#e65100" }}> (no farm GPS yet)</span>}
            </label>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <div>
            <label style={label}>Farmer name *</label>
            <input style={input} value={f.farmerName} onChange={set("farmerName")} />
          </div>
          <div>
            <label style={label}>Farmer phone</label>
            <input style={input} value={f.farmerPhone} onChange={set("farmerPhone")} inputMode="tel" />
          </div>
          <div>
            <label style={label}>Village</label>
            <input style={input} value={f.village} onChange={set("village")} />
          </div>
          <div>
            <label style={label}>District *</label>
            <input style={input} value={f.district} onChange={set("district")} />
          </div>
          <div>
            <label style={label}>Farm latitude</label>
            <input style={input} value={f.lat} onChange={set("lat")} inputMode="decimal" />
          </div>
          <div>
            <label style={label}>Farm longitude</label>
            <input style={input} value={f.lng} onChange={set("lng")} inputMode="decimal" />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              type="button"
              style={button("secondary")}
              onClick={async () => {
                const gps = await getCurrentLocation().catch(() => null);
                if (gps) setF((x) => ({ ...x, lat: gps.latitude.toFixed(6), lng: gps.longitude.toFixed(6) }));
                else setMsg({ tone: "error", text: "Could not get your location." });
              }}
            >
              📍 I am at the farm
            </button>
          </div>
          <div>
            <label style={label}>Farm size (hectares)</label>
            <input style={input} value={f.areaHa} onChange={set("areaHa")} inputMode="decimal" />
          </div>
          {areaHa !== undefined && areaHa > 4 && (
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={label}>Farm boundary (GeoJSON polygon, needed for EUDR over 4 ha)</label>
              <textarea style={{ ...input, minHeight: 60 }} value={f.polygon} onChange={set("polygon")} />
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.5rem" }}>
        <div>
          <label style={label}>Delivered as *</label>
          <select style={input} value={f.inputForm} onChange={set("inputForm")}>
            {INTAKE_FORMS.map((x) => (
              <option key={x.key} value={x.key}>
                {x.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={label}>Kilos *</label>
          <input style={input} value={f.kilos} onChange={set("kilos")} inputMode="decimal" />
        </div>
        <div>
          <label style={label}>Price paid per kg (UGX)</label>
          <input style={input} value={f.price} onChange={set("price")} inputMode="decimal" />
        </div>
        <div>
          <label style={label}>Intake date *</label>
          <input style={input} type="date" max={today} value={f.intakeDate} onChange={set("intakeDate")} />
        </div>
      </div>
      <label style={{ ...label, marginTop: "0.75rem" }}>Photos (weighing, the produce, the farm)</label>
      <PhotoSetCapture photos={photos} onChange={setPhotos} />
      <textarea style={{ ...input, minHeight: 50, marginTop: "0.5rem" }} placeholder="Notes" value={f.notes} onChange={set("notes")} />
      <label style={{ ...chip(paidCash, false), borderRadius: 10, marginTop: "0.5rem" }}>
        <input type="checkbox" checked={paidCash} onChange={(e) => setPaidCash(e.target.checked)} />
        Paid in cash now: issue the farmer&apos;s receipt (needs the price per kg)
      </label>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
        <button
          style={button("primary", busy)}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const uploaded = await uploadEvidencePhotos(() => getUrl({ userId }), photos);
              const r = await record({
                userId,
                crop,
                inputForm: f.inputForm,
                kilos: Number(f.kilos),
                pricePerKgUgx: num(f.price),
                intakeDate: f.intakeDate,
                sourceKind,
                farmerId: sourceKind === "platform_farmer" ? farmerId ?? undefined : undefined,
                farmerName: f.farmerName || undefined,
                farmerPhone: f.farmerPhone || undefined,
                village: f.village || undefined,
                district: f.district || undefined,
                lat: num(f.lat),
                lng: num(f.lng),
                areaHa,
                polygonGeoJson: f.polygon || undefined,
                photos: uploaded,
                notes: f.notes || undefined,
                paidCash,
              });
              setMsg({
                tone: "success",
                text: `Intake ${r.intakeCode} recorded.${r.receiptNumber ? ` Receipt ${r.receiptNumber} issued; share it from Buying prices → Receipts.` : ""}`,
              });
              onDone();
            } catch (e) {
              setMsg({ tone: "error", text: errorText(e) });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving..." : "Save intake"}
        </button>
        <button style={button("secondary", busy)} disabled={busy} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Processing batches
// ------------------------------------------------------------------

export function ProcessorBatchesTab({ userId, member, today, crops, setMsg }: TabProps) {
  const batches = useQuery(api.processorOperations.listMyBatches, { userId });
  const intakes = useQuery(api.processorOperations.listMyIntakes, { userId });
  const [creating, setCreating] = useState(false);
  const open = (intakes ?? []).filter((i) => i.remainingKilos > 0 && i.farmerConfirmation !== "disputed");
  return (
    <>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "1.15rem", color: PROCESSOR_HEADING }}>Processing batches</h2>
          {member && !creating && (
            <button style={button("primary", open.length === 0)} disabled={open.length === 0} onClick={() => setCreating(true)}>
              + Start a batch
            </button>
          )}
        </div>
        <p style={{ fontSize: "0.85rem", color: "#607d8b" }}>
          Put intake into a batch (weight in), then record what came out (weight out). The outturn is worked out for you, and the Storage and Transport Officer
          verifies the batch photos. A verified batch shows as a processor stage on the exporter&apos;s trace map.
        </p>
        {member && open.length === 0 && <Notice tone="info">Record intake first; batches are made from intake that is not yet processed.</Notice>}
        {creating && <BatchForm userId={userId} today={today} crops={crops} intakes={open} setMsg={setMsg} onDone={() => setCreating(false)} />}
      </div>
      {batches === undefined ? (
        <div style={card}>Loading batches...</div>
      ) : batches.length === 0 ? (
        <div style={card}>No batches yet.</div>
      ) : (
        batches.map((b) => <BatchRow key={b._id} batch={b} userId={userId} today={today} setMsg={setMsg} />)
      )}
    </>
  );
}

type IntakeOption = { _id: Id<"processorIntakes">; intakeCode: string; remainingKilos: number; farmerLabel: string; inputForm: string; crop: string };

function BatchForm({ userId, today, crops, intakes: allIntakes, setMsg, onDone }: { userId: Id<"users">; today: string; crops: { key: string; label: string }[]; intakes: IntakeOption[]; setMsg: (m: Msg) => void; onDone: () => void }) {
  const [crop, setCrop] = useState(crops[0]?.key ?? "coffee");
  // A batch holds one crop, so only that crop's intake can go in.
  const intakes = allIntakes.filter((i) => i.crop === crop);
  const create = useMutation(api.processorOperations.createBatch);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [steps, setSteps] = useState<string[]>(["drying", "hulling"]);
  const [f, setF] = useState({ outputForm: "faq", coffeeType: "Robusta", processingMethod: "Natural", startedDate: today, notes: "" });
  const [busy, setBusy] = useState(false);
  const total = Object.values(picked).reduce((a, k) => a + (Number(k) || 0), 0);
  return (
    <div style={{ background: PROCESSOR_SOFT, border: `1px solid ${PROCESSOR_BORDER}`, borderRadius: 10, padding: "0.85rem", marginTop: "0.5rem" }}>
      <CropSelect crops={crops} value={crop} onChange={(c) => { setCrop(c); setPicked({}); }} />
      <label style={label}>Intake going into this batch (kilos from each)</label>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        {intakes.map((i) => (
          <div key={i._id} style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", fontSize: "0.85rem" }}>
            <input
              type="checkbox"
              checked={picked[i._id] !== undefined}
              onChange={(e) => setPicked((p) => {
                const next = { ...p };
                if (e.target.checked) next[i._id] = String(i.remainingKilos);
                else delete next[i._id];
                return next;
              })}
            />
            <span style={{ flex: 1, minWidth: 160 }}>
              {i.intakeCode} · {formLabel(i.inputForm)} · {i.farmerLabel} ({i.remainingKilos} kg left)
            </span>
            {picked[i._id] !== undefined && (
              <input style={{ ...input, width: 110 }} inputMode="decimal" value={picked[i._id]} onChange={(e) => setPicked((p) => ({ ...p, [i._id]: e.target.value }))} />
            )}
          </div>
        ))}
      </div>
      <div style={{ fontSize: "0.85rem", margin: "0.4rem 0 0.75rem" }}>
        Weight in: <b>{Math.round(total * 10) / 10} kg</b>
      </div>
      <label style={label}>Processing steps *</label>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        {PROCESSING_CAPABILITIES.map((c) => (
          <label key={c.key} style={chip(steps.includes(c.key), false)}>
            <input type="checkbox" checked={steps.includes(c.key)} onChange={(e) => setSteps(e.target.checked ? [...steps, c.key] : steps.filter((s) => s !== c.key))} />
            {c.label}
          </label>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.5rem" }}>
        <div>
          <label style={label}>Output *</label>
          <select style={input} value={f.outputForm} onChange={(e) => setF({ ...f, outputForm: e.target.value })}>
            {BATCH_OUTPUT_FORMS.map((x) => (
              <option key={x.key} value={x.key}>
                {x.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={label}>Coffee type</label>
          <select style={input} value={f.coffeeType} onChange={(e) => setF({ ...f, coffeeType: e.target.value })}>
            {COFFEE_TYPES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={label}>Processing method</label>
          <select style={input} value={f.processingMethod} onChange={(e) => setF({ ...f, processingMethod: e.target.value })}>
            {PROCESSING_METHODS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={label}>Started *</label>
          <input style={input} type="date" max={today} value={f.startedDate} onChange={(e) => setF({ ...f, startedDate: e.target.value })} />
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
        <button
          style={button("primary", busy || total <= 0)}
          disabled={busy || total <= 0}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await create({
                userId,
                crop,
                outputForm: f.outputForm,
                coffeeType: f.coffeeType,
                processingMethod: f.processingMethod,
                steps,
                inputs: Object.entries(picked).map(([intakeId, kilos]) => ({ intakeId: intakeId as Id<"processorIntakes">, kilos: Number(kilos) })),
                startedDate: f.startedDate,
                notes: f.notes || undefined,
              });
              setMsg({ tone: "success", text: `Batch ${r.batchCode} started. Record the weight out when it is done.` });
              onDone();
            } catch (e) {
              setMsg({ tone: "error", text: errorText(e) });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving..." : "Start batch"}
        </button>
        <button style={button("secondary", busy)} disabled={busy} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

type BatchRowData = FunctionReturnType<typeof api.processorOperations.listMyBatches>[number];

function BatchRow({ batch, userId, today, setMsg }: { batch: BatchRowData; userId: Id<"users">; today: string; setMsg: (m: Msg) => void }) {
  const complete = useMutation(api.processorOperations.completeBatch);
  const getUrl = useMutation(api.processors.generateProcessorUploadUrl);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ weightOut: batch.weightOutKg != null ? String(batch.weightOutKg) : "", completedDate: today, grade: batch.grade ?? "", moisture: "" });
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ ...card, padding: "0.85rem 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
        <b>
          {batch.batchCode} · {formLabel(batch.outputForm)}
          {batch.grade ? ` · ${batch.grade}` : ""}
        </b>
        <span style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
          <TraceLevelPill level={batch.traceLevel} />
          <StatusPill state={batch.evidenceStatus === "approved" ? "verified" : batch.evidenceStatus === "none" ? (batch.status === "in_progress" ? "draft" : "missing") : batch.evidenceStatus} />
        </span>
      </div>
      <div style={{ fontSize: "0.82rem", color: "#455a64", marginTop: "0.25rem", lineHeight: 1.55 }}>
        In {batch.weightInKg} kg{batch.weightOutKg != null ? ` → out ${batch.weightOutKg} kg` : " (in progress)"}
        {batch.outturnPercent != null ? ` · outturn ${batch.outturnPercent}%` : ""} · steps: {batch.steps.map(capabilityLabel).join(", ")}
        <div>From: {batch.inputs.map((i) => `${i.intakeCode} (${i.kilos} kg)`).join(", ")}</div>
        {batch.soldKg > 0 && <div>Sold: {batch.soldKg} kg</div>}
        {batch.evidenceStatus === "rejected" && batch.reviewNotes && <div style={{ color: "#c62828" }}>Storage and Transport Officer: {batch.reviewNotes}</div>}
      </div>
      <PhotoStrip photos={batch.photoRows} />
      {batch.evidenceStatus !== "approved" &&
        (!open ? (
          <button style={{ ...button("secondary"), marginTop: "0.5rem", fontSize: "0.8rem" }} onClick={() => setOpen(true)}>
            {batch.status === "in_progress" ? "Record weight out" : "Update and resubmit"}
          </button>
        ) : (
          <div style={{ marginTop: "0.5rem", background: "#fafafa", border: "1px solid #eee", borderRadius: 8, padding: "0.75rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem" }}>
              <div>
                <label style={label}>Weight out (kg) *</label>
                <input style={input} inputMode="decimal" value={f.weightOut} onChange={(e) => setF({ ...f, weightOut: e.target.value })} />
              </div>
              <div>
                <label style={label}>Completed *</label>
                <input style={input} type="date" max={today} value={f.completedDate} onChange={(e) => setF({ ...f, completedDate: e.target.value })} />
              </div>
              <div>
                <label style={label}>Grade</label>
                <input style={input} value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })} placeholder="e.g. Screen 18" />
              </div>
              <div>
                <label style={label}>Moisture %</label>
                <input style={input} inputMode="decimal" value={f.moisture} onChange={(e) => setF({ ...f, moisture: e.target.value })} />
              </div>
            </div>
            {f.weightOut && Number(f.weightOut) > 0 && (
              <div style={{ fontSize: "0.85rem", marginTop: "0.4rem" }}>
                Outturn: <b>{Math.round((Number(f.weightOut) / batch.weightInKg) * 1000) / 10}%</b>
              </div>
            )}
            <label style={{ ...label, marginTop: "0.6rem" }}>Photos (machines, weighing, bags) *</label>
            <PhotoSetCapture photos={photos} onChange={setPhotos} />
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                style={button("primary", busy || photos.length === 0)}
                disabled={busy || photos.length === 0}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const uploaded = await uploadEvidencePhotos(() => getUrl({ userId }), photos);
                    const r = await complete({
                      userId,
                      batchId: batch._id,
                      weightOutKg: Number(f.weightOut),
                      completedDate: f.completedDate,
                      grade: f.grade || undefined,
                      moisturePercent: f.moisture.trim() ? Number(f.moisture) : undefined,
                      photos: uploaded,
                    });
                    setMsg({ tone: "success", text: `Batch sent to the Storage and Transport Officer. Outturn ${r.outturnPercent}%.` });
                    setOpen(false);
                    setPhotos([]);
                  } catch (e) {
                    setMsg({ tone: "error", text: errorText(e) });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Uploading..." : "Submit for verification"}
              </button>
              <button style={button("secondary", busy)} disabled={busy} onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
