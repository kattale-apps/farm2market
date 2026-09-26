"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { formatUgandaDateTime } from "../../utils/timeUtils";
import {
  COFFEE_TYPES,
  DEFAULT_EXPORT_CROP,
  PRODUCT_FORMS,
  productFormLabel,
  DEFAULT_BAG_WEIGHT_KG,
  INCOTERMS,
  PROCESSING_METHODS,
} from "../../../convex/exportMarketsShared";
import {
  FONT,
  card,
  input,
  label,
  button,
  Notice,
  StatusPill,
  TraceBadges,
  errorText,
  dataUrlToBlob,
  uploadToConvex,
} from "./ui";
import { PhotoSetCapture, CapturedPhoto } from "./PhotoSetCapture";

type Msg = { tone: "error" | "success" | "info"; text: string } | null;
type LotDetail = FunctionReturnType<typeof api.exportLots.getMyLot>;

export function ExporterLots({
  userId,
  isActiveExporter,
  crop = DEFAULT_EXPORT_CROP,
  productForms = ["green"],
}: {
  userId: Id<"users">;
  isActiveExporter: boolean;
  crop?: string;
  productForms?: string[];
}) {
  const allLots = useQuery(api.exportLots.listMyLots, { userId });
  const lots = allLots?.filter((l) => (l.crop ?? DEFAULT_EXPORT_CROP) === crop);
  const [openLotId, setOpenLotId] = useState<Id<"exportLots"> | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  if (openLotId) {
    return <LotWorkspace userId={userId} lotId={openLotId} onBack={() => setOpenLotId(null)} isActiveExporter={isActiveExporter} crop={crop} productForms={productForms} />;
  }

  return (
    <div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {!isActiveExporter && (
        <Notice tone="info">You can prepare lots now. Listing them for buyers opens once you are an approved, live exporter.</Notice>
      )}
      {creating ? (
        <LotForm
          userId={userId}
          crop={crop}
          productForms={productForms}
          onDone={(lotId) => {
            setCreating(false);
            if (lotId) {
              setMsg({ tone: "success", text: "Lot saved as a draft. Add photos, sources and trace evidence, then list it." });
              setOpenLotId(lotId);
            }
          }}
        />
      ) : (
        <button style={{ ...button("primary"), marginBottom: "1rem" }} onClick={() => setCreating(true)}>
          + New export lot
        </button>
      )}
      {lots === undefined ? (
        <div style={card}>Loading lots...</div>
      ) : lots.length === 0 ? (
        !creating && <div style={card}>No lots yet.</div>
      ) : (
        lots.map((lot) => (
          <button
            key={lot._id}
            onClick={() => setOpenLotId(lot._id)}
            style={{ ...card, display: "flex", gap: "0.75rem", width: "100%", textAlign: "left", cursor: "pointer", alignItems: "center" }}
          >
            {lot.coverUrl ? (
              <img src={lot.coverUrl} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: 8, background: "#e1f5fe", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <img src="/icons/coffee-bean.svg" alt="" width={40} height={40} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                <b>
                  {lot.lotCode} · {lot.coffeeType} {lot.grade}
                </b>
                <StatusPill state={lot.status === "listed" ? "approved" : lot.status === "draft" ? "draft" : lot.status === "sold_out" ? "paid" : "suspended"} />
              </div>
              <div style={{ fontSize: "0.82rem", color: "#555" }}>
                {lot.availableBags}/{lot.bags} bags available · {lot.processing} · {lot.cropYear} · trace {lot.traceStagesApproved}/{lot.traceStagesTotal} ·{" "}
                {lot.openDeals} open deal{lot.openDeals === 1 ? "" : "s"}
              </div>
              <TraceBadges traceLevel={lot.traceLevel} eudrReady={lot.eudrReady} />
            </div>
          </button>
        ))
      )}
    </div>
  );
}

type LotFormValues = {
  coffeeType: string;
  grade: string;
  processing: string;
  cropYear: string;
  originDistrict: string;
  originRegion: string;
  bags: string;
  bagWeightKg: string;
  minOrderBags: string;
  moisturePercent: string;
  defects: string;
  screenSize: string;
  cupScore: string;
  certifications: string;
  description: string;
  warehouseLocation: string;
  incoterms: string[];
  sampleAvailable: boolean;
  productForm: string;
};

function LotForm({
  userId,
  lot,
  onDone,
  crop,
  productForms,
}: {
  userId: Id<"users">;
  lot?: LotDetail["lot"];
  onDone: (lotId?: Id<"exportLots">) => void;
  crop: string;
  productForms: string[];
}) {
  const save = useMutation(api.exportLots.saveLot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<LotFormValues>({
    coffeeType: lot?.coffeeType ?? "Robusta",
    grade: lot?.grade ?? "",
    processing: lot?.processing ?? "Natural",
    cropYear: lot?.cropYear ?? "",
    originDistrict: lot?.originDistrict ?? "",
    originRegion: lot?.originRegion ?? "",
    bags: lot ? String(lot.bags) : "",
    bagWeightKg: String(lot?.bagWeightKg ?? DEFAULT_BAG_WEIGHT_KG),
    minOrderBags: lot ? String(lot.minOrderBags) : "",
    moisturePercent: lot?.moisturePercent != null ? String(lot.moisturePercent) : "",
    defects: lot?.defects ?? "",
    screenSize: lot?.screenSize ?? "",
    cupScore: lot?.cupScore != null ? String(lot.cupScore) : "",
    certifications: (lot?.certifications ?? []).join(", "),
    description: lot?.description ?? "",
    warehouseLocation: lot?.warehouseLocation ?? "",
    incoterms: lot?.incoterms ?? ["FOB"],
    sampleAvailable: lot?.sampleAvailable ?? true,
    productForm: lot?.productForm ?? productForms[0] ?? "green",
  });
  const set = (k: keyof LotFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const text = (k: keyof LotFormValues, t: string, ph = "", req = false) => (
    <div>
      <label style={label}>
        {t}
        {req ? " *" : ""}
      </label>
      <input style={input} value={String(f[k])} onChange={set(k)} placeholder={ph} />
    </div>
  );
  const optNum = (s: string) => (s.trim() === "" ? undefined : Number(s));

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>{lot ? `Edit ${lot.lotCode}` : "New export lot"}</h2>
      {error && <Notice tone="error">{error}</Notice>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.85rem" }}>
        <div>
          <label style={label}>Product *</label>
          <select style={input} value={f.productForm} onChange={set("productForm")}>
            {PRODUCT_FORMS.filter((pf) => productForms.includes(pf.key) || pf.key === f.productForm).map((pf) => (
              <option key={pf.key} value={pf.key}>
                {pf.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={label}>Coffee type *</label>
          <select style={input} value={f.coffeeType} onChange={set("coffeeType")}>
            {COFFEE_TYPES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        {text("grade", "Grade", "e.g. Screen 18, Bugisu AA, Drugar", true)}
        <div>
          <label style={label}>Processing *</label>
          <select style={input} value={f.processing} onChange={set("processing")}>
            {PROCESSING_METHODS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        {text("cropYear", "Crop year", "e.g. 2025/26", true)}
        {text("originDistrict", "Origin district", "", true)}
        {text("originRegion", "Origin region", "e.g. Mt Elgon")}
        {text("bags", "Number of bags", "", true)}
        {text("bagWeightKg", "Bag weight (kg)", "60", true)}
        {text("minOrderBags", "Minimum order (bags)", "", true)}
        {text("moisturePercent", "Moisture (%)", "e.g. 12.5")}
        {text("defects", "Defects", "e.g. 12 per 300 g")}
        {text("screenSize", "Screen size", "e.g. 15+")}
        {text("cupScore", "Cup score (0-100)")}
        {text("certifications", "Certifications (comma separated)", "e.g. Organic, 4C")}
        {text("warehouseLocation", "Warehouse location", "Where the coffee is stored", true)}
      </div>
      <div style={{ marginTop: "0.6rem" }}>
        <label style={label}>Incoterms you offer *</label>
        <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", fontSize: "0.88rem" }}>
          {INCOTERMS.map((t) => (
            <label key={t} style={{ display: "inline-flex", gap: "0.3rem", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={f.incoterms.includes(t)}
                onChange={(e) => setF({ ...f, incoterms: e.target.checked ? [...f.incoterms, t] : f.incoterms.filter((x) => x !== t) })}
              />
              {t}
            </label>
          ))}
        </div>
      </div>
      <div style={{ marginTop: "0.6rem" }}>
        <label style={label}>Description</label>
        <textarea style={{ ...input, minHeight: 70 }} value={f.description} onChange={set("description")} />
      </div>
      <label style={{ display: "flex", gap: "0.4rem", alignItems: "center", fontSize: "0.88rem", margin: "0.6rem 0" }}>
        <input type="checkbox" checked={f.sampleAvailable} onChange={(e) => setF({ ...f, sampleAvailable: e.target.checked })} />
        A sample is available for the platform to collect
      </label>
      <p style={{ fontSize: "0.8rem", color: "#666" }}>Prices are given on request. Buyers ask; you quote per deal.</p>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          style={button("primary", busy)}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const r = await save({
                userId,
                lotId: lot?._id,
                crop: lot?.crop ?? crop,
                productForm: f.productForm,
                coffeeType: f.coffeeType,
                grade: f.grade,
                processing: f.processing,
                cropYear: f.cropYear,
                originDistrict: f.originDistrict,
                originRegion: f.originRegion || undefined,
                bags: Number(f.bags),
                bagWeightKg: Number(f.bagWeightKg),
                minOrderBags: Number(f.minOrderBags),
                moisturePercent: optNum(f.moisturePercent),
                defects: f.defects || undefined,
                screenSize: f.screenSize || undefined,
                cupScore: optNum(f.cupScore),
                certifications: f.certifications.split(",").map((s) => s.trim()).filter(Boolean),
                description: f.description || undefined,
                warehouseLocation: f.warehouseLocation,
                incoterms: f.incoterms,
                sampleAvailable: f.sampleAvailable,
              });
              onDone(r.lotId);
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Save lot
        </button>
        <button style={button("secondary", busy)} disabled={busy} onClick={() => onDone()}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function LotWorkspace({
  userId,
  lotId,
  onBack,
  isActiveExporter,
  crop,
  productForms,
}: {
  userId: Id<"users">;
  lotId: Id<"exportLots">;
  onBack: () => void;
  isActiveExporter: boolean;
  crop: string;
  productForms: string[];
}) {
  const data = useQuery(api.exportLots.getMyLot, { userId, lotId });
  const setStatus = useMutation(api.exportLots.setLotStatus);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  if (data === undefined) return <div style={card}>Loading lot...</div>;
  const { lot } = data;

  const changeStatus = async (status: "listed" | "withdrawn" | "draft") => {
    setBusy(true);
    try {
      await setStatus({ userId, lotId, status });
      setMsg({ tone: "success", text: status === "listed" ? "Lot listed. Buyers can now see it (anonymously)." : "Lot taken off the market." });
    } catch (e) {
      setMsg({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button style={{ ...button("secondary"), marginBottom: "0.75rem" }} onClick={onBack}>
        ← All lots
      </button>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {editing ? (
        <LotForm userId={userId} lot={lot} onDone={() => setEditing(false)} crop={crop} productForms={productForms} />
      ) : (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>
              {lot.lotCode} · {lot.coffeeType} {lot.grade}
            </h2>
            <StatusPill state={lot.status === "listed" ? "approved" : lot.status === "draft" ? "draft" : lot.status === "sold_out" ? "paid" : "suspended"} />
          </div>
          <div style={{ fontSize: "0.88rem", lineHeight: 1.7, marginTop: "0.4rem" }}>
            {productFormLabel(lot.productForm)} · {lot.availableBags} of {lot.bags} bags × {lot.bagWeightKg} kg available · min {lot.minOrderBags} bags · {lot.processing} · crop {lot.cropYear}
            <br />
            Origin {lot.originDistrict}
            {lot.originRegion ? `, ${lot.originRegion}` : ""} · warehouse {lot.warehouseLocation} · {lot.incoterms.join(", ")}
            <br />
            {[lot.moisturePercent != null && `moisture ${lot.moisturePercent}%`, lot.screenSize && `screen ${lot.screenSize}`, lot.defects, lot.cupScore != null && `cup ${lot.cupScore}`]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <div style={{ margin: "0.5rem 0" }}>
            <TraceBadges traceLevel={lot.traceLevel} eudrReady={lot.eudrReady} />
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button style={button("secondary")} onClick={() => setEditing(true)}>
              Edit details
            </button>
            {lot.status !== "listed" && lot.status !== "sold_out" && (
              <button style={button("primary", busy || !isActiveExporter)} disabled={busy || !isActiveExporter} onClick={() => changeStatus("listed")}>
                List for buyers
              </button>
            )}
            {lot.status === "listed" && (
              <button style={button("danger", busy)} disabled={busy} onClick={() => changeStatus("withdrawn")}>
                Withdraw from market
              </button>
            )}
            <Link href={`/export-report/${lot._id}`} style={{ ...button("secondary"), textDecoration: "none" }}>
              Traceability report
            </Link>
          </div>
        </div>
      )}
      <LotPhotos userId={userId} data={data} setMsg={setMsg} />
      <LotSources userId={userId} data={data} setMsg={setMsg} />
      <TraceMap userId={userId} data={data} setMsg={setMsg} />
    </div>
  );
}

function LotPhotos({ userId, data, setMsg }: { userId: Id<"users">; data: LotDetail; setMsg: (m: Msg) => void }) {
  const getUrl = useMutation(api.exportLots.generateLotUploadUrl);
  const setPhotos = useMutation(api.exportLots.setLotPhotos);
  const [busy, setBusy] = useState(false);
  const { lot } = data;
  return (
    <div style={card}>
      <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Lot photos ({lot.photoStorageIds.length}/8)</h3>
      <p style={{ fontSize: "0.8rem", color: "#666", marginTop: 0 }}>Avoid photos showing your company name or signage: buyers see lots anonymously.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "0.5rem" }}>
        {data.photoUrls.map((url, i) => (
          <div key={i} style={{ position: "relative" }}>
            <img src={url} alt="" style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 6 }} />
            <button
              aria-label="Remove photo"
              style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: 999, width: 22, height: 22, cursor: "pointer" }}
              onClick={async () => {
                try {
                  await setPhotos({ userId, lotId: lot._id, photoStorageIds: lot.photoStorageIds.filter((_, j) => j !== i) });
                } catch (e) {
                  setMsg({ tone: "error", text: errorText(e) });
                }
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {lot.photoStorageIds.length < 8 && (
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          style={{ marginTop: "0.5rem", fontFamily: FONT }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (file.size > 8 * 1024 * 1024) return setMsg({ tone: "error", text: "Photos must be 8 MB or smaller." });
            setBusy(true);
            try {
              const storageId = await uploadToConvex(await getUrl({ userId }), file);
              await setPhotos({ userId, lotId: lot._id, photoStorageIds: [...lot.photoStorageIds, storageId as Id<"_storage">] });
            } catch (err) {
              setMsg({ tone: "error", text: errorText(err) });
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

function LotSources({ userId, data, setMsg }: { userId: Id<"users">; data: LotDetail; setMsg: (m: Msg) => void }) {
  const add = useMutation(api.exportLots.addLotSource);
  const remove = useMutation(api.exportLots.removeLotSource);
  const [kind, setKind] = useState<"platform_purchase" | "advance_commitment" | "declared">("platform_purchase");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ ref: "", kilos: "", farmerName: "", village: "", district: "", lat: "", lng: "", areaHa: "", polygon: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

  return (
    <div style={card}>
      <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Where this coffee came from</h3>
      <p style={{ fontSize: "0.8rem", color: "#666", marginTop: 0 }}>
        Coffee bought on the platform is traced to the farms automatically. Declared farms are labelled as declared. Every farm needs a GPS location,
        and farms over 4 ha need a boundary polygon, for the report to be EUDR-compliant.
      </p>
      {data.sources.length === 0 && <p style={{ fontSize: "0.88rem" }}>No sources yet.</p>}
      {data.sources.map(({ source, plots }) => (
        <div key={source._id} style={{ borderTop: "1px solid #eee", padding: "0.5rem 0", fontSize: "0.85rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
            <b>
              {source.kind === "platform_purchase" ? "Platform purchase" : source.kind === "advance_commitment" ? "Advanced Markets commitment" : "Declared farm"} ·{" "}
              {source.kilos.toLocaleString()} kg
            </b>
            <button
              style={{ ...button("danger", busy), padding: "0.15rem 0.5rem", fontSize: "0.72rem" }}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await remove({ userId, sourceId: source._id });
                } catch (e) {
                  setMsg({ tone: "error", text: errorText(e) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Remove
            </button>
          </div>
          {plots.map((p, i) => (
            <div key={i} style={{ color: p.eudrIssue ? "#c62828" : "#555" }}>
              {p.label}
              {p.district ? ` · ${p.district}` : ""} · {p.kilos} kg · {p.lat != null ? `${p.lat.toFixed(5)}, ${p.lng!.toFixed(5)}` : "no GPS"}
              {p.eudrIssue ? ` · ${p.eudrIssue}` : ""}
            </div>
          ))}
        </div>
      ))}

      <div style={{ marginTop: "0.75rem", background: "#fafafa", border: "1px solid #eee", borderRadius: 8, padding: "0.75rem" }}>
        <label style={label}>Add a source</label>
        <select style={{ ...input, marginBottom: "0.5rem" }} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="platform_purchase">Coffee I bought on the platform</option>
          <option value="advance_commitment">My Advanced Markets commitment</option>
          <option value="declared">A farm outside the platform (declared)</option>
        </select>
        {kind === "platform_purchase" && (
          <select style={{ ...input, marginBottom: "0.5rem" }} value={form.ref} onChange={set("ref")}>
            <option value="">Choose an inventory block</option>
            {data.linkableInventory.map((i) => (
              <option key={i._id} value={i._id}>
                {i.produceType} · {i.remainingKilos} of {i.totalKilos} kg left · {i.utid}
              </option>
            ))}
          </select>
        )}
        {kind === "advance_commitment" && (
          <select style={{ ...input, marginBottom: "0.5rem" }} value={form.ref} onChange={set("ref")}>
            <option value="">Choose a commitment</option>
            {data.linkableCommitments.map((c) => (
              <option key={c._id} value={c._id}>
                {c.productName} · {c.quantity} {c.unit} · {c.status} · {c.utid}
              </option>
            ))}
          </select>
        )}
        {kind === "declared" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <input style={input} placeholder="Farmer or farm name *" value={form.farmerName} onChange={set("farmerName")} />
            <input style={input} placeholder="Village" value={form.village} onChange={set("village")} />
            <input style={input} placeholder="District *" value={form.district} onChange={set("district")} />
            <input style={input} placeholder="Latitude" value={form.lat} onChange={set("lat")} />
            <input style={input} placeholder="Longitude" value={form.lng} onChange={set("lng")} />
            <input style={input} placeholder="Farm size (ha)" value={form.areaHa} onChange={set("areaHa")} />
          </div>
        )}
        {kind === "declared" && (
          <textarea
            style={{ ...input, minHeight: 60, marginBottom: "0.5rem" }}
            placeholder='Boundary polygon as GeoJSON (needed for farms over 4 ha), e.g. {"type":"Polygon","coordinates":[...]}'
            value={form.polygon}
            onChange={set("polygon")}
          />
        )}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input style={{ ...input, maxWidth: 180 }} placeholder="Kilos in this lot *" value={form.kilos} onChange={set("kilos")} />
          <button
            style={button("primary", busy)}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await add({
                  userId,
                  lotId: data.lot._id,
                  kind,
                  kilos: Number(form.kilos),
                  inventoryId: kind === "platform_purchase" && form.ref ? (form.ref as Id<"traderInventory">) : undefined,
                  commitmentId: kind === "advance_commitment" && form.ref ? (form.ref as Id<"advancePurchaseCommitments">) : undefined,
                  farmerName: kind === "declared" ? form.farmerName : undefined,
                  village: kind === "declared" ? form.village || undefined : undefined,
                  district: kind === "declared" ? form.district : undefined,
                  lat: kind === "declared" ? num(form.lat) : undefined,
                  lng: kind === "declared" ? num(form.lng) : undefined,
                  areaHa: kind === "declared" ? num(form.areaHa) : undefined,
                  polygonGeoJson: kind === "declared" && form.polygon.trim() ? form.polygon : undefined,
                });
                setForm({ ref: "", kilos: "", farmerName: "", village: "", district: "", lat: "", lng: "", areaHa: "", polygon: "" });
                setMsg({ tone: "success", text: "Source added." });
              } catch (e) {
                setMsg({ tone: "error", text: errorText(e) });
              } finally {
                setBusy(false);
              }
            }}
          >
            Add source
          </button>
        </div>
      </div>
    </div>
  );
}

function TraceMap({ userId, data, setMsg }: { userId: Id<"users">; data: LotDetail; setMsg: (m: Msg) => void }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  return (
    <div style={card}>
      <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Trace map: the coffee journey</h3>
      <p style={{ fontSize: "0.8rem", color: "#666", marginTop: 0 }}>
        Add proof photos (with GPS and time) and weights at each stage. Farm stages are verified by the farmer&apos;s community admin, the rest by
        your exporter community admin.
      </p>
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {data.stages.map(({ stage, hint, evidence }, idx) => {
          const latest = evidence[0];
          return (
            <li key={stage._id} style={{ borderLeft: `3px solid ${stage.status === "approved" ? "#2e7d32" : "#bdbdbd"}`, padding: "0.25rem 0 0.75rem 0.75rem", position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                <b>
                  {idx + 1}. {stage.name}{" "}
                  <span style={{ fontWeight: 500, fontSize: "0.75rem", color: "#777" }}>({stage.scope === "farm" ? "farm stage" : "exporter stage"})</span>
                </b>
                <StatusPill state={stage.status === "approved" ? "verified" : stage.status === "submitted" ? "pending" : stage.status === "rejected" ? "rejected" : "missing"} />
              </div>
              <div style={{ fontSize: "0.78rem", color: "#666" }}>{hint}</div>
              {latest && (
                <div style={{ fontSize: "0.78rem", marginTop: "0.3rem" }}>
                  <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                    {latest.photoUrls.map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noreferrer">
                        <img src={u} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 4 }} />
                      </a>
                    ))}
                  </div>
                  Submitted {formatUgandaDateTime(latest.submittedAt)}
                  {latest.weightInKg != null ? ` · in ${latest.weightInKg} kg` : ""}
                  {latest.weightOutKg != null ? ` · out ${latest.weightOutKg} kg` : ""}
                  {latest.status === "rejected" && latest.reviewNotes && <div style={{ color: "#c62828" }}>Rejected: {latest.reviewNotes}</div>}
                </div>
              )}
              {stage.status !== "approved" &&
                (openKey === stage.key ? (
                  <EvidenceForm userId={userId} lotId={data.lot._id} stageKey={stage.key} onDone={() => setOpenKey(null)} setMsg={setMsg} />
                ) : (
                  <button style={{ ...button("secondary"), marginTop: "0.4rem", fontSize: "0.8rem" }} onClick={() => setOpenKey(stage.key)}>
                    {latest ? "Submit new evidence" : "Add evidence"}
                  </button>
                ))}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function EvidenceForm({ userId, lotId, stageKey, onDone, setMsg }: { userId: Id<"users">; lotId: Id<"exportLots">; stageKey: string; onDone: () => void; setMsg: (m: Msg) => void }) {
  const getUrl = useMutation(api.exportLots.generateLotUploadUrl);
  const submit = useMutation(api.exportLots.submitTraceEvidence);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [wIn, setWIn] = useState("");
  const [wOut, setWOut] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div style={{ marginTop: "0.5rem", background: "#fafafa", border: "1px solid #eee", borderRadius: 8, padding: "0.75rem" }}>
      <PhotoSetCapture photos={photos} onChange={setPhotos} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem", marginTop: "0.5rem" }}>
        <input style={input} placeholder="Weight in (kg)" value={wIn} onChange={(e) => setWIn(e.target.value)} />
        <input style={input} placeholder="Weight out (kg)" value={wOut} onChange={(e) => setWOut(e.target.value)} />
      </div>
      <textarea style={{ ...input, minHeight: 50, marginTop: "0.5rem" }} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button
          style={button("primary", busy || photos.length === 0)}
          disabled={busy || photos.length === 0}
          onClick={async () => {
            setBusy(true);
            try {
              const uploaded = [];
              for (const p of photos) {
                const url = await getUrl({ userId });
                const res = await fetch(url, { method: "POST", body: dataUrlToBlob(p.dataUrl) });
                const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
                uploaded.push({ storageId, lat: p.lat ?? undefined, lng: p.lng ?? undefined, accuracy: p.accuracy ?? undefined, capturedAt: p.capturedAt });
              }
              await submit({
                userId,
                lotId,
                stageKey,
                photos: uploaded,
                weightInKg: wIn.trim() ? Number(wIn) : undefined,
                weightOutKg: wOut.trim() ? Number(wOut) : undefined,
                notes: notes || undefined,
              });
              setMsg({ tone: "success", text: "Evidence submitted for verification." });
              onDone();
            } catch (e) {
              setMsg({ tone: "error", text: errorText(e) });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Uploading..." : "Submit for verification"}
        </button>
        <button style={button("secondary", busy)} disabled={busy} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}
