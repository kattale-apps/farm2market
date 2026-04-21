"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useOfflineQuery } from "@/app/hooks/useOfflineQuery";
import { useOfflineMutation } from "@/app/hooks/useOfflineMutation";
import Link from "next/link";

const BRAND = "#2e7d32";
const BRAND_BG = "#e8f5e9";
const GOLD = "#f9a825";
const FONT = '"Montserrat", sans-serif';

type Tab = "templates" | "log" | "units" | "insights" | "supply" | "ledger";

const STATUS_COLORS: Record<string, string> = {
  active: "#2e7d32", sold: "#1565c0", deceased: "#c62828", harvested: "#6a1e00",
};

// ─── TEMPLATES TAB ───────────────────────────────────────────────────────────
function TemplatesTab({ userId, onSelectTemplate }: { userId: Id<"users">; onSelectTemplate: (tpl: any) => void }) {
  const templates = useOfflineQuery(
    (api as any).farmToolbox.listTemplates,
    { farmerId: userId },
    `toolbox_templates_${userId}`
  ) as any[] | undefined;

  const deleteTemplate = useOfflineMutation<any>((api as any).farmToolbox.deleteTemplate);
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div>
      <div style={{ background: "#fff", borderRadius: 12, padding: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>📋 Tracker Templates</h2>
          <button onClick={() => setShowCreateForm(!showCreateForm)}
            style={{ padding: "0.4rem 0.85rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: FONT }}>
            {showCreateForm ? "Cancel" : "➕ Create"}
          </button>
        </div>
        <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "#666" }}>
          Choose a template to log your farm data. Earn 🪙 1 FarmCoin per field filled in.
        </p>
        {showCreateForm && <CreateTemplateForm userId={userId} onDone={() => setShowCreateForm(false)} />}
        {templates === undefined ? (
          <div style={{ textAlign: "center", padding: "1.5rem", color: "#888" }}>Loading…</div>
        ) : templates.length === 0 ? (
          <div style={{ textAlign: "center", padding: "1.5rem", color: "#888" }}>No templates yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {templates.map((tpl: any) => (
              <div key={tpl._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1rem", background: "#f9fafb", borderRadius: 10, border: "1px solid #e8f5e9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                  <span style={{ fontSize: "1.7rem" }}>{tpl.emoji || "📋"}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{tpl.templateName}</div>
                    <div style={{ fontSize: "0.72rem", color: "#888" }}>
                      {tpl.category} · {tpl.fields?.length ?? 0} fields · <span style={{ color: BRAND }}>{tpl.ownerType}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.35rem" }}>
                  <button onClick={() => onSelectTemplate(tpl)}
                    style={{ padding: "0.35rem 0.7rem", background: BRAND_BG, border: `1px solid #a5d6a7`, borderRadius: 6, fontSize: "0.75rem", cursor: "pointer", color: BRAND, fontFamily: FONT, fontWeight: 600 }}>
                    ✏️ Log
                  </button>
                  {tpl.ownerType === "personal" && (
                    <button onClick={async () => {
                      if (!confirm("Delete this template?")) return;
                      await deleteTemplate({ templateId: tpl._id, requestingUserId: userId });
                    }}
                      style={{ padding: "0.35rem 0.5rem", background: "#ffebee", border: "1px solid #ef9a9a", borderRadius: 6, fontSize: "0.75rem", cursor: "pointer", color: "#c62828", fontFamily: FONT }}>
                      🗑
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ background: "#fff8e1", border: "1px solid " + GOLD, borderRadius: 12, padding: "1rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
        <span style={{ fontSize: "1.5rem" }}>🪙</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#e65100" }}>Earn FarmCoins!</div>
          <div style={{ fontSize: "0.78rem", color: "#555", marginTop: "0.2rem" }}>
            1 FarmCoin per field filled when you submit a tracker entry. Redeem in the marketplace!
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CREATE TEMPLATE FORM ────────────────────────────────────────────────────
const FIELD_TYPES = ["text", "number", "date", "yesno", "photo", "rating", "gps"] as const;
type FieldType = typeof FIELD_TYPES[number];

function CreateTemplateForm({ userId, onDone }: { userId: Id<"users">; onDone: () => void }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📋");
  const [category, setCategory] = useState<"crop" | "livestock" | "general">("general");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<{ name: string; fieldType: FieldType; required: boolean; emoji?: string; unit?: string; order: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTemplate = useOfflineMutation<any>((api as any).farmToolbox.createTemplate);

  const addField = () => setFields([...fields, { name: "", fieldType: "text", required: false, emoji: "", unit: "", order: fields.length }]);
  const removeField = (i: number) => setFields(fields.filter((_, idx) => idx !== i));
  const updateField = (i: number, key: string, value: any) => setFields(fields.map((f, idx) => idx === i ? { ...f, [key]: value } : f));

  const handleSave = async () => {
    if (!name.trim()) { setError("Template name is required"); return; }
    if (fields.length === 0) { setError("Add at least one field"); return; }
    setSaving(true);
    try {
      await createTemplate({ ownerId: userId, ownerType: "personal", category, templateName: name, emoji, description, fields });
      onDone();
    } catch (e: any) { setError(e.message ?? "Failed"); }
    setSaving(false);
  };

  return (
    <div style={{ border: "1.5px dashed #a5d6a7", borderRadius: 10, padding: "1rem", marginBottom: "1rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "end" }}>
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)}
          style={{ width: 44, textAlign: "center", padding: "0.45rem", border: "1px solid #ddd", borderRadius: 8, fontSize: "1.2rem" }} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name…"
          style={{ padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.88rem" }} />
        <select value={category} onChange={(e) => setCategory(e.target.value as any)}
          style={{ padding: "0.45rem 0.6rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.82rem" }}>
          <option value="general">General</option>
          <option value="crop">Crop</option>
          <option value="livestock">Livestock</option>
        </select>
      </div>
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)…"
        style={{ width: "100%", padding: "0.4rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.82rem", boxSizing: "border-box", marginBottom: "0.75rem" }} />
      {fields.map((f, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "0.35rem", marginBottom: "0.35rem", alignItems: "center" }}>
          <input value={f.name} onChange={(e) => updateField(i, "name", e.target.value)} placeholder="Field name…"
            style={{ padding: "0.35rem 0.5rem", border: "1px solid #ddd", borderRadius: 6, fontFamily: FONT, fontSize: "0.8rem" }} />
          <select value={f.fieldType} onChange={(e) => updateField(i, "fieldType", e.target.value)}
            style={{ padding: "0.35rem 0.4rem", border: "1px solid #ddd", borderRadius: 6, fontFamily: FONT, fontSize: "0.75rem" }}>
            {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label style={{ fontSize: "0.72rem", display: "flex", alignItems: "center", gap: "0.2rem", cursor: "pointer" }}>
            <input type="checkbox" checked={f.required} onChange={(e) => updateField(i, "required", e.target.checked)} /> Req
          </label>
          <button onClick={() => removeField(i)} style={{ background: "#ffebee", border: "none", borderRadius: 6, padding: "0.25rem 0.4rem", cursor: "pointer", fontSize: "0.8rem" }}>✕</button>
        </div>
      ))}
      <button onClick={addField} style={{ padding: "0.3rem 0.7rem", background: BRAND_BG, border: "1px solid #a5d6a7", borderRadius: 6, cursor: "pointer", fontSize: "0.78rem", color: BRAND, fontFamily: FONT, marginBottom: "0.75rem" }}>
        + Add Field
      </button>
      {error && <p style={{ color: "#c62828", fontSize: "0.78rem", margin: "0 0 0.5rem" }}>⚠️ {error}</p>}
      <button onClick={handleSave} disabled={saving}
        style={{ padding: "0.55rem 1.2rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONT, fontSize: "0.85rem", opacity: saving ? 0.7 : 1 }}>
        {saving ? "Saving…" : "💾 Save Template"}
      </button>
    </div>
  );
}

// ─── LOG ENTRY TAB ───────────────────────────────────────────────────────────
function LogEntryTab({ userId, selectedTemplate, setSelectedTemplate }: {
  userId: Id<"users">; selectedTemplate: any | null; setSelectedTemplate: (t: any | null) => void;
}) {
  const templates = useOfflineQuery(
    (api as any).farmToolbox.listTemplates,
    { farmerId: userId },
    `toolbox_templates_${userId}`
  ) as any[] | undefined;

  const units = useOfflineQuery(
    (api as any).farmToolbox.listTrackedUnits,
    { farmerId: userId },
    `toolbox_units_${userId}`
  ) as any[] | undefined;

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitEntry = useOfflineMutation<any>((api as any).farmToolbox.submitEntry, { expectedCoins: 1 });
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoStorageIds, setPhotoStorageIds] = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);

  const captureGPS = () => {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }); setGpsLoading(false); },
      () => { setGpsLoading(false); }
    );
  };

  const handlePhotoUpload = async (file: File) => {
    setPhotoUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = await res.json();
      setPhotoStorageIds((prev) => [...prev, storageId]);
    } catch {}
    setPhotoUploading(false);
  };

  const handleSubmit = async () => {
    if (!selectedTemplate) return;
    setSubmitting(true);
    setError(null);
    try {
      const fvArray = Object.entries(fieldValues).map(([fieldName, value]) => ({ fieldName, value }));
      await submitEntry({
        farmerId: userId,
        templateId: selectedTemplate._id,
        trackedUnitId: selectedUnitId ? selectedUnitId as Id<"farmTrackedUnits"> : undefined,
        fieldValues: fvArray,
        photoStorageIds: photoStorageIds.length ? photoStorageIds as Id<"_storage">[] : undefined,
        gpsLat: gps?.lat,
        gpsLng: gps?.lng,
        gpsAccuracy: gps?.accuracy,
        notes: notes || undefined,
      });
      const filled = fvArray.filter((fv) => fv.value.trim()).length;
      setSuccessMsg(`✅ Entry saved! You earned 🪙 ${filled} FarmCoin${filled !== 1 ? "s" : ""}!`);
      setFieldValues({});
      setNotes("");
      setGps(null);
      setPhotoStorageIds([]);
      setSelectedUnitId("");
    } catch (e: any) {
      setError(e.message ?? "Failed to submit");
    }
    setSubmitting(false);
  };

  if (!selectedTemplate) {
    return (
      <div>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>✏️ Log an Entry</h2>
        <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.75rem" }}>Choose a template to log against:</p>
        {templates === undefined ? (
          <div style={{ textAlign: "center", padding: "1.5rem", color: "#888" }}>Loading templates…</div>
        ) : templates.length === 0 ? (
          <div style={{ textAlign: "center", padding: "1.5rem", color: "#888" }}>No templates yet. Create one in the Templates tab.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {templates.map((tpl: any) => (
              <button key={tpl._id} onClick={() => setSelectedTemplate(tpl)}
                style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1rem", background: "#fff", borderRadius: 10, border: "1.5px solid #e8f5e9", cursor: "pointer", textAlign: "left", fontFamily: FONT }}>
                <span style={{ fontSize: "1.7rem" }}>{tpl.emoji || "📋"}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{tpl.templateName}</div>
                  <div style={{ fontSize: "0.72rem", color: "#888" }}>{tpl.fields?.length ?? 0} fields</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <button onClick={() => { setSelectedTemplate(null); setSuccessMsg(null); }}
          style={{ background: "none", border: "none", fontSize: "1rem", cursor: "pointer", color: BRAND }}>← Back</button>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>{selectedTemplate.emoji} {selectedTemplate.templateName}</h2>
      </div>

      {successMsg && (
        <div style={{ background: BRAND_BG, border: "1px solid #a5d6a7", borderRadius: 10, padding: "0.85rem 1rem", marginBottom: "1rem", fontWeight: 600, color: BRAND, fontSize: "0.88rem" }}>
          {successMsg}
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, padding: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
        {/* Unit selector */}
        {units && units.length > 0 && (
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem", display: "block" }}>Log for unit (optional)</label>
            <select value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)}
              style={{ width: "100%", padding: "0.5rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem" }}>
              <option value="">— No specific unit —</option>
              {units.filter((u: any) => u.status === "active").map((u: any) => (
                <option key={u._id} value={u._id}>{u.emoji || "🌱"} {u.name || u.unitType} ({u.category})</option>
              ))}
            </select>
          </div>
        )}

        {/* Field inputs */}
        {(selectedTemplate.fields ?? []).map((field: any) => (
          <div key={field.name} style={{ marginBottom: "0.85rem" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.3rem", display: "block" }}>
              {field.emoji} {field.name} {field.unit ? <span style={{ color: "#999", fontWeight: 400 }}>({field.unit})</span> : null}
              {field.required && <span style={{ color: "#c62828" }}> *</span>}
            </label>
            {field.fieldType === "yesno" ? (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {["Yes", "No"].map((opt) => (
                  <button key={opt} onClick={() => setFieldValues((fv) => ({ ...fv, [field.name]: opt }))}
                    style={{ padding: "0.45rem 1rem", background: fieldValues[field.name] === opt ? BRAND : "#f5f5f5", color: fieldValues[field.name] === opt ? "#fff" : "#333", border: `1px solid ${fieldValues[field.name] === opt ? BRAND : "#ddd"}`, borderRadius: 8, cursor: "pointer", fontFamily: FONT, fontSize: "0.85rem" }}>
                    {opt === "Yes" ? "✅" : "❌"} {opt}
                  </button>
                ))}
              </div>
            ) : field.fieldType === "rating" ? (
              <div style={{ display: "flex", gap: "0.4rem" }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setFieldValues((fv) => ({ ...fv, [field.name]: String(n) }))}
                    style={{ width: 36, height: 36, borderRadius: "50%", border: `2px solid ${Number(fieldValues[field.name]) >= n ? GOLD : "#ddd"}`, background: Number(fieldValues[field.name]) >= n ? GOLD : "#f9f9f9", cursor: "pointer", fontSize: "0.85rem", fontWeight: 700 }}>
                    {n}
                  </button>
                ))}
              </div>
            ) : field.fieldType === "photo" ? (
              <div>
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }} />
                <button onClick={() => fileInputRef.current?.click()} disabled={photoUploading}
                  style={{ padding: "0.5rem 1rem", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontFamily: FONT, fontSize: "0.82rem" }}>
                  {photoUploading ? "Uploading…" : `📷 ${photoStorageIds.length > 0 ? `${photoStorageIds.length} photo(s) ✓` : "Take Photo"}`}
                </button>
              </div>
            ) : field.fieldType === "gps" ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <button onClick={captureGPS} disabled={gpsLoading}
                  style={{ padding: "0.5rem 1rem", background: gps ? BRAND_BG : "#f5f5f5", border: `1px solid ${gps ? "#a5d6a7" : "#ddd"}`, borderRadius: 8, cursor: "pointer", fontFamily: FONT, fontSize: "0.82rem", color: gps ? BRAND : "#333" }}>
                  {gpsLoading ? "Locating…" : gps ? `📍 ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : "📍 Capture GPS"}
                </button>
              </div>
            ) : (
              <input
                type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text"}
                value={fieldValues[field.name] ?? ""}
                onChange={(e) => setFieldValues((fv) => ({ ...fv, [field.name]: e.target.value }))}
                style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.88rem", boxSizing: "border-box" }}
              />
            )}
          </div>
        ))}

        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes (optional)…"
          style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem", minHeight: 60, resize: "vertical", boxSizing: "border-box", marginBottom: "1rem" }} />

        {error && <p style={{ color: "#c62828", fontSize: "0.82rem", marginBottom: "0.75rem" }}>⚠️ {error}</p>}

        <button onClick={handleSubmit} disabled={submitting}
          style={{ width: "100%", padding: "0.85rem", background: BRAND, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: "0.95rem", cursor: submitting ? "not-allowed" : "pointer", fontFamily: FONT, opacity: submitting ? 0.7 : 1 }}>
          {submitting ? "Submitting…" : "💾 Submit Entry · Earn 🪙 FarmCoins"}
        </button>
      </div>
    </div>
  );
}

// ─── UNITS TAB ───────────────────────────────────────────────────────────────
function UnitsTab({ userId }: { userId: Id<"users"> }) {
  const units = useOfflineQuery(
    (api as any).farmToolbox.listTrackedUnits,
    { farmerId: userId },
    `toolbox_units_${userId}`
  ) as any[] | undefined;

  const createUnit = useOfflineMutation<any>((api as any).farmToolbox.createTrackedUnit);
  const updateStatus = useOfflineMutation<any>((api as any).farmToolbox.updateTrackedUnitStatus);
  const deleteUnit = useOfflineMutation<any>((api as any).farmToolbox.deleteTrackedUnit);

  const [showForm, setShowForm] = useState(false);
  const [newUnit, setNewUnit] = useState({ category: "crop" as "crop" | "livestock", unitType: "", name: "", emoji: "", count: 1, notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newUnit.unitType.trim()) { setError("Unit type is required"); return; }
    setSaving(true);
    try {
      await createUnit({ farmerId: userId, ...newUnit });
      setShowForm(false);
      setNewUnit({ category: "crop", unitType: "", name: "", emoji: "", count: 1, notes: "" });
      setError(null);
    } catch (e: any) { setError(e.message ?? "Failed"); }
    setSaving(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>🌳 My Tracked Units</h2>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: "0.4rem 0.85rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: FONT }}>
          {showForm ? "Cancel" : "➕ Add Unit"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "#fff", borderRadius: 12, padding: "1.25rem", marginBottom: "1rem", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "end" }}>
            <input value={newUnit.emoji} onChange={(e) => setNewUnit({ ...newUnit, emoji: e.target.value })} placeholder="🌱"
              style={{ width: 44, textAlign: "center", padding: "0.45rem", border: "1px solid #ddd", borderRadius: 8, fontSize: "1.2rem" }} />
            <input value={newUnit.unitType} onChange={(e) => setNewUnit({ ...newUnit, unitType: e.target.value })} placeholder="Type (e.g. maize, cow)"
              style={{ padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem" }} />
            <select value={newUnit.category} onChange={(e) => setNewUnit({ ...newUnit, category: e.target.value as any })}
              style={{ padding: "0.45rem 0.6rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.82rem" }}>
              <option value="crop">Crop</option>
              <option value="livestock">Livestock</option>
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <input value={newUnit.name} onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })} placeholder="Name/ID (optional)"
              style={{ padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem" }} />
            <input type="number" value={newUnit.count} onChange={(e) => setNewUnit({ ...newUnit, count: Number(e.target.value) })} placeholder="Count"
              style={{ padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem" }} />
          </div>
          <input value={newUnit.notes} onChange={(e) => setNewUnit({ ...newUnit, notes: e.target.value })} placeholder="Notes (optional)"
            style={{ width: "100%", padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem", boxSizing: "border-box", marginBottom: "0.75rem" }} />
          {error && <p style={{ color: "#c62828", fontSize: "0.8rem", margin: "0 0 0.5rem" }}>⚠️ {error}</p>}
          <button onClick={handleCreate} disabled={saving}
            style={{ padding: "0.55rem 1.2rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONT, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : "💾 Save Unit"}
          </button>
        </div>
      )}

      {units === undefined ? (
        <div style={{ textAlign: "center", padding: "1.5rem", color: "#888" }}>Loading…</div>
      ) : units.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2.5rem 1.5rem", background: "#fff", borderRadius: 12 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🌳</div>
          <p style={{ color: "#888" }}>No units yet. Add your first crop or livestock unit!</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {units.map((unit: any) => (
            <div key={unit._id} style={{ background: "#fff", borderRadius: 12, padding: "1rem", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span style={{ fontSize: "1.6rem" }}>{unit.emoji || (unit.category === "crop" ? "🌱" : "🐾")}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{unit.name || unit.unitType}</div>
                    <div style={{ fontSize: "0.72rem", color: "#888" }}>
                      {unit.category} · {unit.unitType} {unit.count ? `· ${unit.count} head/units` : ""}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: "0.72rem", padding: "0.2rem 0.55rem", borderRadius: 12, background: `${STATUS_COLORS[unit.status]}22`, color: STATUS_COLORS[unit.status], fontWeight: 700 }}>
                  {unit.status}
                </span>
              </div>
              {unit.notes && <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", color: "#666" }}>{unit.notes}</p>}
              <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                {(["active", "sold", "deceased", "harvested"] as const).filter((s) => s !== unit.status).map((s) => (
                  <button key={s} onClick={async () => {
                    await updateStatus({ unitId: unit._id, requestingUserId: userId, status: s });
                  }}
                    style={{ padding: "0.25rem 0.6rem", background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 6, fontSize: "0.72rem", cursor: "pointer", fontFamily: FONT }}>
                    → {s}
                  </button>
                ))}
                <button onClick={async () => {
                  if (!confirm("Delete this unit?")) return;
                  await deleteUnit({ unitId: unit._id, requestingUserId: userId });
                }}
                  style={{ padding: "0.25rem 0.6rem", background: "#ffebee", border: "1px solid #ef9a9a", borderRadius: 6, fontSize: "0.72rem", cursor: "pointer", color: "#c62828", fontFamily: FONT }}>
                  🗑 Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── COMING SOON CARD ─────────────────────────────────────────────────────────
function ComingSoonCard({ emoji, label, phase }: { emoji: string; label: string; phase: string }) {
  return (
    <div style={{ textAlign: "center", padding: "3rem 1.5rem", background: "#fff", borderRadius: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
      <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>{emoji}</div>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem", fontWeight: 700 }}>{label}</h2>
      <p style={{ margin: 0, color: "#888", fontSize: "0.85rem" }}>Coming in <strong>{phase}</strong>. The foundation is ready!</p>
      <div style={{ marginTop: "1.25rem", display: "inline-block", padding: "0.35rem 1rem", background: BRAND_BG, borderRadius: 20, color: BRAND, fontWeight: 600, fontSize: "0.78rem" }}>
        🔜 Coming Soon
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function FarmToolboxPage() {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("templates");
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pilot_user");
      if (stored) setUserId(JSON.parse(stored).userId as Id<"users">);
    } catch {}
  }, []);

  const tabs: { id: Tab; emoji: string; label: string; phase?: string }[] = [
    { id: "templates", emoji: "📋", label: "Templates" },
    { id: "log",       emoji: "✏️",  label: "Log Entry" },
    { id: "units",     emoji: "🌳",  label: "My Units" },
    { id: "insights",  emoji: "📊",  label: "Insights",   phase: "Phase 4" },
    { id: "supply",    emoji: "📦",  label: "Supplies",   phase: "Phase 5a" },
    { id: "ledger",    emoji: "🏦",  label: "Farm Ledger", phase: "Phase 5b" },
  ];

  const handleSelectTemplate = (tpl: any) => {
    setSelectedTemplate(tpl);
    setActiveTab("log");
  };

  return (
    <div style={{ fontFamily: FONT, minHeight: "100vh", background: "#f9fafb", paddingBottom: 80 }}>
      <div style={{ background: BRAND, padding: "clamp(1rem,4vw,1.5rem)", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
          <div>
            <h1 style={{ margin: 0, fontSize: "clamp(1.1rem,4vw,1.4rem)", fontWeight: 700 }}>🧰 My Farm Toolbox</h1>
            <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.85 }}>Track • Plan • Earn 🪙 FarmCoins</p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", overflowX: "auto", background: "#fff", borderBottom: "1px solid #e0e0e0", padding: "0 0.25rem" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); if (t.id !== "log") setSelectedTemplate(null); }}
            style={{ flexShrink: 0, padding: "0.7rem 0.85rem", border: "none", borderBottom: activeTab === t.id ? `3px solid ${BRAND}` : "3px solid transparent", background: "transparent", cursor: "pointer", fontFamily: FONT, fontSize: "0.78rem", fontWeight: activeTab === t.id ? 700 : 400, color: activeTab === t.id ? BRAND : "#666", whiteSpace: "nowrap" }}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "clamp(1rem,4vw,1.25rem)", maxWidth: 680, margin: "0 auto" }}>
        {!userId ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Loading…</div>
        ) : activeTab === "templates" ? (
          <TemplatesTab userId={userId} onSelectTemplate={handleSelectTemplate} />
        ) : activeTab === "log" ? (
          <LogEntryTab userId={userId} selectedTemplate={selectedTemplate} setSelectedTemplate={setSelectedTemplate} />
        ) : activeTab === "units" ? (
          <UnitsTab userId={userId} />
        ) : (
          <ComingSoonCard emoji={tabs.find((t) => t.id === activeTab)?.emoji ?? "🔜"} label={tabs.find((t) => t.id === activeTab)?.label ?? ""} phase={tabs.find((t) => t.id === activeTab)?.phase ?? ""} />
        )}
      </div>
    </div>
  );
}

