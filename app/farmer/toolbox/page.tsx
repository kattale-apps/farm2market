"use client";

import { useState, useEffect, useRef } from "react";
import { useConvex, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useOfflineQuery } from "@/app/hooks/useOfflineQuery";
import { useOfflineMutation } from "@/app/hooks/useOfflineMutation";
import Link from "next/link";
import { exportSubmissionsToPDF } from "@/app/utils/exportUtils";
import SubmissionPhotoGallery from "@/app/components/SubmissionPhotoGallery";
import { useStoredUser } from "@/app/hooks/useStoredUser";

const BRAND = "#2e7d32";
const BRAND_BG = "#e8f5e9";
const GOLD = "#f9a825";
const FONT = '"Montserrat", sans-serif';

type Tab = "templates" | "log" | "units" | "insights" | "supply" | "ledger";
const DEFAULT_BIOFARM_TEMPLATE_NAME = "Default Bio Farm Coffee Tree Tag Form";
const DEFAULT_TREE_TAG_PHOTO_FIELD = "Tree Tag Pic";
const DEFAULT_COFFEE_PHOTO_FIELD = "Coffee Pic";
const DEFAULT_OBSERVATION_DATE_FIELD = "Observation Date";
const DEFAULT_GPS_FIELD = "GPS";

function isDefaultBioFarmTemplate(tpl: any | null) {
  return (
    !!tpl &&
    tpl.ownerType === "system" &&
    String(tpl.templateName || "") === DEFAULT_BIOFARM_TEMPLATE_NAME
  );
}

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
const FIELD_TYPE_OPTIONS = [
  { value: "text", label: "text" },
  { value: "number", label: "number" },
  { value: "date", label: "date" },
  { value: "select", label: "select (comma options)" },
  { value: "yesno", label: "yes/no" },
  { value: "photo", label: "photo (camera/gallery)" },
  { value: "rating", label: "rating" },
  { value: "gps", label: "gps" },
] as const;
type FieldType = (typeof FIELD_TYPE_OPTIONS)[number]["value"];

type TemplateField = {
  name: string;
  fieldType: FieldType;
  required: boolean;
  emoji?: string;
  unit?: string;
  order: number;
  options?: string[];
};

function CreateTemplateForm({ userId, onDone }: { userId: Id<"users">; onDone: () => void }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📋");
  const [category, setCategory] = useState<"crop" | "livestock" | "general">("general");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTemplate = useOfflineMutation<any>((api as any).farmToolbox.createTemplate);

  const addField = () => setFields([...fields, { name: "", fieldType: "text", required: false, emoji: "", unit: "", order: fields.length, options: [] }]);
  const removeField = (i: number) => setFields(fields.filter((_, idx) => idx !== i));
  const updateField = (i: number, key: string, value: any) => setFields(fields.map((f, idx) => idx === i ? { ...f, [key]: value } : f));

  const handleSave = async () => {
    if (!name.trim()) { setError("Template name is required"); return; }
    if (fields.length === 0) { setError("Add at least one field"); return; }

    const normalizedNames = fields.map((f) => f.name.trim()).filter(Boolean);
    if (normalizedNames.length !== fields.length) {
      setError("Every field must have a name.");
      return;
    }

    const lowered = normalizedNames.map((n) => n.toLowerCase());
    if (new Set(lowered).size !== lowered.length) {
      setError("Field names must be unique.");
      return;
    }

    const normalizedFields = fields.map((f, idx) => {
      const cleanedOptions = (f.options || []).map((opt) => opt.trim()).filter(Boolean);
      if (f.fieldType === "select" && cleanedOptions.length === 0) {
        throw new Error(`Select field \"${f.name || `#${idx + 1}`}\" needs at least one option.`);
      }
      return {
        ...f,
        name: f.name.trim(),
        order: idx,
        options: f.fieldType === "select" ? cleanedOptions : undefined,
      };
    });

    setSaving(true);
    try {
      await createTemplate({ ownerId: userId, ownerType: "personal", category, templateName: name.trim(), emoji, description: description.trim() || undefined, fields: normalizedFields });
      onDone();
    } catch (e: any) { setError(e.message ?? "Failed"); }
    setSaving(false);
  };

  return (
    <div style={{ border: "1.5px dashed #a5d6a7", borderRadius: 10, padding: "1rem", marginBottom: "1rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "end" }}>
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)}
          style={{ width: 44, textAlign: "center", padding: "0.45rem", border: "1px solid #ddd", borderRadius: 8, fontSize: "1.2rem" }} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name…"
          style={{ flex: "1 1 180px", minWidth: 0, padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.88rem" }} />
        <select value={category} onChange={(e) => setCategory(e.target.value as any)}
          style={{ flex: "0 1 140px", padding: "0.45rem 0.6rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.82rem" }}>
          <option value="general">General</option>
          <option value="crop">Crop</option>
          <option value="livestock">Livestock</option>
        </select>
      </div>
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)…"
        style={{ width: "100%", padding: "0.4rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.82rem", boxSizing: "border-box", marginBottom: "0.75rem" }} />
      {fields.map((f, i) => (
        <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.35rem", alignItems: "center" }}>
          <input value={f.name} onChange={(e) => updateField(i, "name", e.target.value)} placeholder="Field name…"
            style={{ flex: "1 1 180px", minWidth: 0, padding: "0.35rem 0.5rem", border: "1px solid #ddd", borderRadius: 6, fontFamily: FONT, fontSize: "0.8rem" }} />
          <select value={f.fieldType} onChange={(e) => updateField(i, "fieldType", e.target.value)}
            style={{ flex: "0 1 170px", padding: "0.35rem 0.4rem", border: "1px solid #ddd", borderRadius: 6, fontFamily: FONT, fontSize: "0.75rem" }}>
            {FIELD_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {f.fieldType === "select" && (
            <input
              value={(f.options || []).join(", ")}
              onChange={(e) => updateField(i, "options", e.target.value.split(",").map((opt) => opt.trim()).filter(Boolean))}
              placeholder="Options, separated by commas"
              style={{ flex: "1 1 220px", minWidth: 0, padding: "0.35rem 0.5rem", border: "1px solid #ddd", borderRadius: 6, fontFamily: FONT, fontSize: "0.75rem" }}
            />
          )}
          <label style={{ fontSize: "0.72rem", display: "flex", alignItems: "center", gap: "0.2rem", cursor: "pointer" }}>
            <input type="checkbox" checked={f.required} onChange={(e) => updateField(i, "required", e.target.checked)} /> Req
          </label>
          <button onClick={() => removeField(i)} style={{ background: "#ffebee", border: "none", borderRadius: 6, padding: "0.25rem 0.4rem", cursor: "pointer", fontSize: "0.8rem" }}>✕</button>
        </div>
      ))}
      <button onClick={addField} style={{ width: "100%", maxWidth: 170, padding: "0.45rem 0.7rem", background: BRAND_BG, border: "1px solid #a5d6a7", borderRadius: 6, cursor: "pointer", fontSize: "0.78rem", color: BRAND, fontFamily: FONT, marginBottom: "0.75rem" }}>
        + Add Field
      </button>
      {error && <p style={{ color: "#c62828", fontSize: "0.78rem", margin: "0 0 0.5rem" }}>⚠️ {error}</p>}
      <button onClick={handleSave} disabled={saving}
        style={{ width: "100%", maxWidth: 240, padding: "0.55rem 1.2rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: FONT, fontSize: "0.85rem", opacity: saving ? 0.7 : 1 }}>
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
  const entries = useOfflineQuery(
    (api as any).farmToolbox.listEntries,
    { farmerId: userId, limit: 50 },
    `toolbox_entries_${userId}`
  ) as any[] | undefined;
  const deleteEntry = useOfflineMutation<any>((api as any).farmToolbox.deleteEntry);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const convex = useConvex();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [activePhotoFieldName, setActivePhotoFieldName] = useState<string | null>(null);
  const [photoStorageIds, setPhotoStorageIds] = useState<string[]>([]);
  const [photoStorageByField, setPhotoStorageByField] = useState<Record<string, string>>({});
  const [photoUploading, setPhotoUploading] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [showBatchOptions, setShowBatchOptions] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [singleExportingId, setSingleExportingId] = useState<string | null>(null);
  const [batchExporting, setBatchExporting] = useState(false);

  const isDefaultTemplate = isDefaultBioFarmTemplate(selectedTemplate);

  const toggleSelectedEntry = (entryId: string, selected: boolean) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(entryId);
      else next.delete(entryId);
      return next;
    });
  };

  const handleSingleExport = async (entry: any) => {
    const entryId = String(entry._id);
    setSingleExportingId(entryId);
    try {
      const fullEntry = await convex.query((api as any).farmToolbox.getEntryById, {
        entryId: entry._id,
      });
      const datePart = new Date().toISOString().split("T")[0];
      await exportSubmissionsToPDF(
        [fullEntry || entry],
        `farm_toolbox_submission_${datePart}`
      );
    } catch {
      setError("Failed to export PDF. Please try again.");
    }
    setSingleExportingId(null);
  };

  const handleBatchExport = async () => {
    if (selectedEntryIds.size === 0) return;
    setBatchExporting(true);
    try {
      const ids = Array.from(selectedEntryIds).map((id) => id as Id<"farmTrackerEntries">);
      const enriched = await convex.query((api as any).farmToolbox.getEntriesByIds, {
        entryIds: ids,
      });
      const datePart = new Date().toISOString().split("T")[0];
      await exportSubmissionsToPDF(enriched || [], `farm_toolbox_submissions_${datePart}`);
    } catch {
      setError("Failed to export selected entries as PDF.");
    }
    setBatchExporting(false);
  };

  const captureGPS = (): Promise<{ lat: number; lng: number; accuracy: number } | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return Promise.resolve(null);
    }
    setGpsLoading(true);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setGps(coords);
          setGpsLoading(false);
          resolve(coords);
        },
        () => {
          setGpsLoading(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  };

  const handlePhotoUpload = async (file: File, targetFieldName?: string) => {
    if (file.size > 10 * 1024 * 1024) {
      setError("Photo too large. Maximum allowed size is 10MB.");
      return;
    }
    setPhotoUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = await res.json();
      if (targetFieldName) {
        setPhotoStorageByField((prev) => ({ ...prev, [targetFieldName]: storageId }));
      } else {
        setPhotoStorageIds((prev) => [...prev, storageId]);
      }
    } catch {
      setError("Failed to upload photo. Please try again.");
    }
    setPhotoUploading(false);
  };

  useEffect(() => {
    if (isDefaultTemplate && !gps && !gpsLoading) {
      void captureGPS();
    }
  }, [isDefaultTemplate, gps, gpsLoading]);

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm("Delete this submitted entry?")) return;
    setDeletingEntryId(entryId);
    setError(null);
    try {
      await deleteEntry({ entryId: entryId as Id<"farmTrackerEntries">, requestingUserId: userId });
      setSuccessMsg("Entry deleted successfully.");
    } catch (e: any) {
      setError(e.message ?? "Failed to delete entry");
    }
    setDeletingEntryId(null);
  };

  const renderEntriesList = () => (
    <div style={{ background: "#fff", borderRadius: 12, padding: "1rem", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginTop: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700 }}>🗂 My Submitted Entries</h3>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setShowBatchOptions((prev) => !prev);
              if (showBatchOptions) setSelectedEntryIds(new Set());
            }}
            style={{
              padding: "0.3rem 0.6rem",
              background: "#fff",
              border: "1px solid #d0d7de",
              borderRadius: 6,
              fontSize: "0.74rem",
              cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            {showBatchOptions ? "Hide batch options" : "Show batch options"}
          </button>
          {showBatchOptions && (
            <button
              type="button"
              onClick={handleBatchExport}
              disabled={batchExporting || selectedEntryIds.size === 0}
              style={{
                padding: "0.3rem 0.6rem",
                background: selectedEntryIds.size === 0 ? "#e0e0e0" : BRAND,
                color: selectedEntryIds.size === 0 ? "#777" : "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: "0.74rem",
                cursor: selectedEntryIds.size === 0 || batchExporting ? "not-allowed" : "pointer",
                fontFamily: FONT,
                fontWeight: 700,
              }}
            >
              {batchExporting ? "Exporting…" : `📥 Download PDF (Batch${selectedEntryIds.size ? `: ${selectedEntryIds.size}` : ""})`}
            </button>
          )}
        </div>
      </div>
      {entries === undefined ? (
        <p style={{ margin: 0, color: "#888", fontSize: "0.82rem" }}>Loading entries…</p>
      ) : entries.length === 0 ? (
        <p style={{ margin: 0, color: "#888", fontSize: "0.82rem" }}>No entries submitted yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {entries.map((entry: any) => {
            const submittedAt = new Date(entry.submittedAt ?? entry.createdAt).toLocaleString();
            const previewFields = (entry.fieldValues ?? []).slice(0, 3);
            const isExpanded = expandedEntryId === String(entry._id);
            const isSelected = selectedEntryIds.has(String(entry._id));
            return (
              <div key={entry._id} style={{ border: "1px solid #e0e0e0", borderRadius: 10, padding: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 700 }}>{submittedAt}</div>
                    <div style={{ fontSize: "0.74rem", color: "#666" }}>
                      {entry.fieldCount ?? 0} field(s) filled {entry.photoUrls?.length ? `· ${entry.photoUrls.length} photo(s)` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
                    {showBatchOptions && (
                      <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.74rem", color: "#555" }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleSelectedEntry(String(entry._id), e.target.checked)}
                        />
                        Select
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedEntryId(isExpanded ? null : String(entry._id))}
                      style={{
                        padding: "0.35rem 0.7rem",
                        background: isExpanded ? "#eef7ee" : "#f5f5f5",
                        border: "1px solid #d9d9d9",
                        borderRadius: 6,
                        fontSize: "0.74rem",
                        cursor: "pointer",
                        color: isExpanded ? BRAND : "#444",
                        fontFamily: FONT,
                        fontWeight: 700,
                      }}
                    >
                      {isExpanded ? "▲ Close full view" : "▼ Open full view"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSingleExport(entry)}
                      disabled={singleExportingId === String(entry._id)}
                      style={{
                        padding: "0.35rem 0.7rem",
                        background: BRAND_BG,
                        border: "1px solid #a5d6a7",
                        borderRadius: 6,
                        fontSize: "0.74rem",
                        cursor: singleExportingId === String(entry._id) ? "not-allowed" : "pointer",
                        color: BRAND,
                        fontFamily: FONT,
                        fontWeight: 700,
                      }}
                    >
                      {singleExportingId === String(entry._id) ? "Preparing…" : "📥 Download PDF"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(String(entry._id))}
                      disabled={deletingEntryId === String(entry._id)}
                      style={{
                        padding: "0.35rem 0.7rem",
                        background: "#ffebee",
                        border: "1px solid #ef9a9a",
                        borderRadius: 6,
                        fontSize: "0.74rem",
                        cursor: deletingEntryId === String(entry._id) ? "not-allowed" : "pointer",
                        color: "#c62828",
                        fontFamily: FONT,
                      }}
                    >
                      {deletingEntryId === String(entry._id) ? "Deleting…" : "🗑 Delete"}
                    </button>
                  </div>
                </div>
                {!isExpanded && previewFields.length > 0 && (
                  <div style={{ marginTop: "0.45rem", fontSize: "0.75rem", color: "#555", wordBreak: "break-word" }}>
                    {previewFields.map((fv: any) => `${fv.fieldName}: ${fv.value || "—"}`).join(" · ")}
                  </div>
                )}
                {isExpanded && (
                  <div style={{ marginTop: "0.55rem", borderTop: "1px solid #efefef", paddingTop: "0.55rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      {(entry.fieldValues || []).map((fv: any, idx: number) => (
                        <div key={idx} style={{ display: "grid", gridTemplateColumns: "minmax(110px, 40%) 1fr", gap: "0.45rem" }}>
                          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#666", overflowWrap: "anywhere" }}>{fv.fieldName || "Field"}</div>
                          <div style={{ fontSize: "0.76rem", color: "#1f2937", overflowWrap: "anywhere" }}>{fv.value || "—"}</div>
                        </div>
                      ))}
                    </div>

                    {!!entry.notes && (
                      <div style={{ marginTop: "0.6rem", fontSize: "0.76rem", color: "#555" }}>
                        <strong>Notes:</strong> {entry.notes}
                      </div>
                    )}

                    {(entry.gpsLat !== undefined && entry.gpsLng !== undefined) && (
                      <div style={{ marginTop: "0.45rem", fontSize: "0.76rem", color: "#555" }}>
                        <strong>GPS:</strong> {entry.gpsLat}, {entry.gpsLng}
                      </div>
                    )}

                    {!!entry.photoUrls?.length && (
                      <div style={{ marginTop: "0.7rem" }}>
                        <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#444", marginBottom: "0.4rem" }}>
                          Photos ({entry.photoUrls.length})
                        </div>
                        <SubmissionPhotoGallery photos={entry.photoUrls} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const handleSubmit = async () => {
    if (!selectedTemplate) return;
    setSubmitting(true);
    setError(null);
    try {
      const workingFieldValues = { ...fieldValues };
      const todayIso = new Date().toISOString().slice(0, 10);

      if (isDefaultTemplate && !workingFieldValues[DEFAULT_OBSERVATION_DATE_FIELD]) {
        workingFieldValues[DEFAULT_OBSERVATION_DATE_FIELD] = todayIso;
      }

      let gpsToUse = gps;
      if (isDefaultTemplate && !gpsToUse) {
        gpsToUse = await captureGPS();
      }

      if (isDefaultTemplate && !gpsToUse) {
        throw new Error("Live GPS is required for this form. Please allow location and retry.");
      }

      const requiredFields = (selectedTemplate.fields || []).filter((f: any) => f.required && f.fieldType !== "photo");
      for (const field of requiredFields) {
        const val = String(workingFieldValues[field.name] || "").trim();
        if (!val) {
          throw new Error(`${field.name} is required`);
        }
      }

      let finalPhotoStorageIds: Id<"_storage">[] | undefined;
      if (isDefaultTemplate) {
        const treeTagStorageId = photoStorageByField[DEFAULT_TREE_TAG_PHOTO_FIELD];
        const coffeeStorageId = photoStorageByField[DEFAULT_COFFEE_PHOTO_FIELD];
        if (!treeTagStorageId || !coffeeStorageId) {
          throw new Error("Tree Tag Pic and Coffee Pic must be captured with camera.");
        }
        finalPhotoStorageIds = [
          treeTagStorageId as Id<"_storage">,
          coffeeStorageId as Id<"_storage">,
        ];
      } else {
        finalPhotoStorageIds = photoStorageIds.length ? (photoStorageIds as Id<"_storage">[]) : undefined;
      }

      const fvArray = Object.entries(workingFieldValues).map(([fieldName, value]) => ({ fieldName, value }));
      await submitEntry({
        farmerId: userId,
        templateId: selectedTemplate._id,
        trackedUnitId: selectedUnitId ? selectedUnitId as Id<"farmTrackedUnits"> : undefined,
        fieldValues: fvArray,
        photoStorageIds: finalPhotoStorageIds,
        gpsLat: gpsToUse?.lat,
        gpsLng: gpsToUse?.lng,
        gpsAccuracy: gpsToUse?.accuracy,
        notes: notes || undefined,
      });
      const filled = fvArray.filter((fv) => fv.value.trim()).length;
      setSuccessMsg(`✅ Entry saved! You earned 🪙 ${filled} FarmCoin${filled !== 1 ? "s" : ""}!`);
      setFieldValues({});
      setNotes("");
      setGps(null);
      setPhotoStorageIds([]);
      setPhotoStorageByField({});
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
                  <div style={{ fontSize: "0.72rem", color: "#888" }}>
                    {tpl.fields?.length ?? 0} fields{isDefaultBioFarmTemplate(tpl) ? " · mandatory default" : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        {renderEntriesList()}
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
            ) : field.fieldType === "select" ? (
              <select
                value={fieldValues[field.name] ?? ""}
                onChange={(e) => setFieldValues((fv) => ({ ...fv, [field.name]: e.target.value }))}
                style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.88rem", boxSizing: "border-box" }}
              >
                <option value="">Select...</option>
                {(field.options || []).map((opt: string) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
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
                <input ref={galleryInputRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f, activePhotoFieldName || undefined); }} />
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (isDefaultTemplate) {
                        setActivePhotoFieldName(field.name);
                      } else {
                        setActivePhotoFieldName(null);
                      }
                      cameraInputRef.current?.click();
                    }}
                    disabled={photoUploading}
                    style={{ padding: "0.5rem 0.8rem", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontFamily: FONT, fontSize: "0.82rem" }}>
                    {photoUploading ? "Uploading…" : "📷 Camera"}
                  </button>
                  {!isDefaultTemplate && (
                    <button type="button" onClick={() => galleryInputRef.current?.click()} disabled={photoUploading}
                      style={{ padding: "0.5rem 0.8rem", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", fontFamily: FONT, fontSize: "0.82rem" }}>
                      {photoUploading ? "Uploading…" : "🖼 Gallery"}
                    </button>
                  )}
                  {isDefaultTemplate ? (
                    <span style={{ fontSize: "0.75rem", color: photoStorageByField[field.name] ? BRAND : "#c62828", alignSelf: "center", fontWeight: 600 }}>
                      {photoStorageByField[field.name] ? "Live photo captured" : "Camera capture required"}
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: photoStorageIds.length > 0 ? BRAND : "#666", alignSelf: "center" }}>
                      {photoStorageIds.length > 0 ? `${photoStorageIds.length} photo(s) uploaded` : "No photo uploaded yet"}
                    </span>
                  )}
                </div>
              </div>
            ) : field.fieldType === "gps" ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <button onClick={() => { void captureGPS(); }} disabled={gpsLoading}
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

      {renderEntriesList()}
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "end" }}>
            <input value={newUnit.emoji} onChange={(e) => setNewUnit({ ...newUnit, emoji: e.target.value })} placeholder="🌱"
              style={{ width: 44, textAlign: "center", padding: "0.45rem", border: "1px solid #ddd", borderRadius: 8, fontSize: "1.2rem" }} />
            <input value={newUnit.unitType} onChange={(e) => setNewUnit({ ...newUnit, unitType: e.target.value })} placeholder="Type (e.g. maize, cow)"
              style={{ flex: "1 1 180px", minWidth: 0, padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem" }} />
            <select value={newUnit.category} onChange={(e) => setNewUnit({ ...newUnit, category: e.target.value as any })}
              style={{ flex: "0 1 130px", padding: "0.45rem 0.6rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.82rem" }}>
              <option value="crop">Crop</option>
              <option value="livestock">Livestock</option>
            </select>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <input value={newUnit.name} onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })} placeholder="Name/ID (optional)"
              style={{ flex: "1 1 180px", minWidth: 0, padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem" }} />
            <input type="number" value={newUnit.count} onChange={(e) => setNewUnit({ ...newUnit, count: Number(e.target.value) })} placeholder="Count"
              style={{ flex: "1 1 120px", minWidth: 0, padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem" }} />
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

// ─── INSIGHTS TAB ─────────────────────────────────────────────────────────────
function InsightsTab({ userId }: { userId: Id<"users"> }) {
  const insights = useOfflineQuery(
    (api as any).farmToolbox.getToolboxInsights,
    { farmerId: userId },
    `toolbox_insights_${userId}`
  ) as any | undefined;

  const entries = useOfflineQuery(
    (api as any).farmToolbox.listEntries,
    { farmerId: userId },
    `toolbox_entries_${userId}`
  ) as any[] | undefined;

  if (insights === undefined) return <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Loading insights…</div>;

  const activeUnits = (insights.unitSurvival ?? []).filter((u: any) => u.status === "active").length;
  const totalUnits = (insights.unitSurvival ?? []).length;
  const survivalPct = totalUnits > 0 ? Math.round((activeUnits / totalUnits) * 100) : 0;
  const maxDay = Math.max(1, ...(insights.entriesByDay ?? []).map((d: any) => d.count));

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
        {[
          { label: "Entries this month", value: insights.totalEntriesThisMonth, emoji: "📝" },
          { label: "All-time entries", value: insights.totalEntriesAllTime, emoji: "📊" },
          { label: "Active units", value: `${activeUnits} / ${totalUnits}`, emoji: "🌳" },
          { label: "Top template", value: insights.topTemplateName ? `${insights.topTemplateEmoji ?? "📋"} ${insights.topTemplateName}` : "—", emoji: null },
        ].map((card) => (
          <div key={card.label} style={{ background: "#fff", borderRadius: 12, padding: "0.85rem 1rem", boxShadow: "0 2px 6px rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: "0.72rem", color: "#888", marginBottom: "0.25rem" }}>{card.label}</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: BRAND }}>{card.emoji ? `${card.emoji} ` : ""}{card.value}</div>
          </div>
        ))}
      </div>

      {/* Unit survival bar */}
      {totalUnits > 0 && (
        <div style={{ background: "#fff", borderRadius: 12, padding: "1rem", boxShadow: "0 2px 6px rgba(0,0,0,0.07)", marginBottom: "1rem" }}>
          <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.75rem" }}>🌳 Unit Survival</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
            <div style={{ flex: 1, height: 14, borderRadius: 7, background: "#e0e0e0", overflow: "hidden" }}>
              <div style={{ width: `${survivalPct}%`, height: "100%", background: BRAND, borderRadius: 7, transition: "width 0.4s" }} />
            </div>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: BRAND, minWidth: 38 }}>{survivalPct}%</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "#888" }}>{activeUnits} active out of {totalUnits} total units</div>
        </div>
      )}

      {/* 30-day activity chart (inline bars) */}
      {(insights.entriesByDay ?? []).length > 0 && (
        <div style={{ background: "#fff", borderRadius: 12, padding: "1rem", boxShadow: "0 2px 6px rgba(0,0,0,0.07)", marginBottom: "1rem" }}>
          <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.75rem" }}>📅 Last 30 days</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 48 }}>
            {insights.entriesByDay.map((d: any) => (
              <div key={d.date} title={`${d.date}: ${d.count}`}
                style={{ flex: 1, height: `${Math.max(4, Math.round((d.count / maxDay) * 48))}px`, background: BRAND, borderRadius: 2, minWidth: 4, opacity: 0.85 }} />
            ))}
          </div>
        </div>
      )}

      {/* Recent entries */}
      {(insights.recentEntries ?? []).length > 0 && (
        <div style={{ background: "#fff", borderRadius: 12, padding: "1rem", boxShadow: "0 2px 6px rgba(0,0,0,0.07)" }}>
          <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.75rem" }}>🕐 Recent Entries</div>
          {insights.recentEntries.map((e: any) => (
            <div key={e._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.45rem 0", borderBottom: "1px solid #f0f0f0" }}>
              <span style={{ fontSize: "0.85rem" }}>{e.templateEmoji ?? "📋"} {e.templateName}</span>
              <span style={{ fontSize: "0.75rem", color: "#888" }}>{new Date(e.submittedAt).toLocaleDateString("en-UG")}</span>
            </div>
          ))}
        </div>
      )}

      {insights.totalEntriesAllTime === 0 && (
        <div style={{ textAlign: "center", padding: "2rem", color: "#888", fontSize: "0.9rem" }}>
          No data yet. Start logging entries to see insights here.
        </div>
      )}
    </div>
  );
}

// ─── SUPPLIES TAB ─────────────────────────────────────────────────────────────
type SupplyCategory = "seed" | "fertiliser" | "chemical" | "pesticide" | "vet_input" | "animal_feed" | "equipment" | "labour" | "other";
const SUPPLY_CATEGORIES: { value: SupplyCategory; label: string; emoji: string }[] = [
  { value: "seed", label: "Seeds", emoji: "🌱" },
  { value: "fertiliser", label: "Fertiliser", emoji: "🧪" },
  { value: "chemical", label: "Chemical", emoji: "⚗️" },
  { value: "pesticide", label: "Pesticides", emoji: "🧴" },
  { value: "vet_input", label: "Vet Inputs", emoji: "💉" },
  { value: "animal_feed", label: "Animal Feeds", emoji: "🌾" },
  { value: "equipment", label: "Equipment", emoji: "🔧" },
  { value: "labour", label: "Labour", emoji: "👷" },
  { value: "other", label: "Other", emoji: "📦" },
];

const BLANK_SUPPLY = { item: "", category: "seed" as SupplyCategory, quantity: "", unit: "bags", unitCost: "", supplier: "", notes: "", purchasedAt: new Date().toISOString().slice(0, 10) };

function SuppliesTab({ userId }: { userId: Id<"users"> }) {
  const [form, setForm] = useState({ ...BLANK_SUPPLY });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState<SupplyCategory | "all">("all");

  const addSupply = useOfflineMutation<any>((api as any).farmToolbox.addSupplyEntry);
  const deleteSupply = useOfflineMutation<any>((api as any).farmToolbox.deleteSupplyEntry);

  const supplies = useOfflineQuery(
    (api as any).farmToolbox.listSupplyEntries,
    { farmerId: userId },
    `toolbox_supplies_${userId}`
  ) as any[] | undefined;

  const filtered = filterCat === "all" ? supplies : (supplies ?? []).filter((s: any) => s.category === filterCat);
  const totalSpend = (filtered ?? []).reduce((sum: number, s: any) => sum + (s.totalCost ?? 0), 0);

  async function handleAdd() {
    if (!form.item.trim() || !form.quantity || !form.unitCost) return;
    setSaving(true);
    try {
      const qty = parseFloat(form.quantity);
      const uc = parseFloat(form.unitCost);
      await addSupply({
        farmerId: userId,
        item: form.item.trim(),
        category: form.category,
        quantity: qty,
        unit: form.unit || "units",
        unitCost: uc,
        totalCost: qty * uc,
        purchasedAt: new Date(form.purchasedAt).getTime(),
        supplier: form.supplier.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setForm({ ...BLANK_SUPPLY });
      setShowForm(false);
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>📦 Supply Tracker</h2>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: "0.4rem 0.85rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: FONT }}>
          {showForm ? "Cancel" : "➕ Add"}
        </button>
      </div>

      {/* Category filter pills */}
      <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.5rem", marginBottom: "0.75rem" }}>
        {[{ value: "all" as const, label: "All", emoji: "🗂️" }, ...SUPPLY_CATEGORIES].map((c) => (
          <button key={c.value} onClick={() => setFilterCat(c.value)}
            style={{ flexShrink: 0, padding: "0.3rem 0.7rem", border: `1px solid ${filterCat === c.value ? BRAND : "#ddd"}`, borderRadius: 20, background: filterCat === c.value ? BRAND_BG : "#fff", color: filterCat === c.value ? BRAND : "#666", fontWeight: filterCat === c.value ? 700 : 400, fontSize: "0.75rem", cursor: "pointer", fontFamily: FONT }}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background: "#fff", borderRadius: 12, padding: "1rem", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <input placeholder="Item name *" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })}
              style={{ gridColumn: "1/-1", padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem", boxSizing: "border-box", width: "100%" }} />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as SupplyCategory })}
              style={{ padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.82rem" }}>
              {SUPPLY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
            </select>
            <input type="date" value={form.purchasedAt} onChange={(e) => setForm({ ...form, purchasedAt: e.target.value })}
              style={{ padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem" }} />
            <input placeholder="Quantity *" type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              style={{ padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem" }} />
            <input placeholder="Unit (bags, litres…)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
              style={{ padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem" }} />
            <input placeholder="Unit cost (UGX) *" type="number" min={0} value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
              style={{ padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem" }} />
            <div style={{ padding: "0.45rem 0.7rem", background: BRAND_BG, borderRadius: 8, fontSize: "0.82rem", color: BRAND, fontWeight: 700 }}>
              Total: UGX {form.quantity && form.unitCost ? (parseFloat(form.quantity) * parseFloat(form.unitCost)).toLocaleString() : "0"}
            </div>
          </div>
          <input placeholder="Supplier (optional)" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            style={{ width: "100%", padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem", marginBottom: "0.5rem", boxSizing: "border-box" }} />
          <input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            style={{ width: "100%", padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem", marginBottom: "0.75rem", boxSizing: "border-box" }} />
          <button onClick={handleAdd} disabled={saving || !form.item.trim() || !form.quantity || !form.unitCost}
            style={{ width: "100%", padding: "0.6rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontFamily: FONT, fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : "Save Supply Entry"}
          </button>
        </div>
      )}

      {/* Summary */}
      {(filtered ?? []).length > 0 && (
        <div style={{ background: BRAND_BG, borderRadius: 10, padding: "0.7rem 1rem", marginBottom: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.82rem", color: BRAND }}>{filtered!.length} entries</span>
          <span style={{ fontWeight: 700, color: BRAND, fontSize: "0.9rem" }}>UGX {totalSpend.toLocaleString()}</span>
        </div>
      )}

      {/* List */}
      {supplies === undefined ? <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Loading…</div> :
        (filtered ?? []).length === 0 ? <div style={{ textAlign: "center", padding: "2rem", color: "#888", fontSize: "0.9rem" }}>No supply entries yet. Tap ➕ Add to record your first input.</div> :
        (filtered ?? []).map((s: any) => {
          const cat = SUPPLY_CATEGORIES.find((c) => c.value === s.category);
          return (
            <div key={s._id} style={{ background: "#fff", borderRadius: 12, padding: "0.85rem 1rem", boxShadow: "0 2px 6px rgba(0,0,0,0.06)", marginBottom: "0.6rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.2rem" }}>{cat?.emoji ?? "📦"} {s.item}</div>
                <div style={{ fontSize: "0.78rem", color: "#666" }}>{s.quantity} {s.unit} × UGX {(s.unitCost ?? 0).toLocaleString()} = <strong>UGX {(s.totalCost ?? 0).toLocaleString()}</strong></div>
                {s.supplier && <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "0.15rem" }}>Supplier: {s.supplier}</div>}
                <div style={{ fontSize: "0.72rem", color: "#aaa", marginTop: "0.15rem" }}>{new Date(s.purchasedAt).toLocaleDateString("en-UG")}</div>
              </div>
              <button onClick={() => deleteSupply({ entryId: s._id, farmerId: userId })}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", padding: "0 0.25rem", color: "#c62828", flexShrink: 0 }}>🗑️</button>
            </div>
          );
        })}
    </div>
  );
}

// ─── FARM LEDGER TAB ──────────────────────────────────────────────────────────
type LedgerType = "income" | "expense";
type LedgerCategory = "crop_sale" | "livestock_sale" | "input_cost" | "labour" | "transport" | "equipment" | "other";
const LEDGER_CATS: { value: LedgerCategory; label: string; emoji: string; type: LedgerType }[] = [
  { value: "crop_sale", label: "Crop Sale", emoji: "🌾", type: "income" },
  { value: "livestock_sale", label: "Livestock Sale", emoji: "🐄", type: "income" },
  { value: "input_cost", label: "Input Cost", emoji: "🧪", type: "expense" },
  { value: "labour", label: "Labour", emoji: "👷", type: "expense" },
  { value: "transport", label: "Transport", emoji: "🚜", type: "expense" },
  { value: "equipment", label: "Equipment", emoji: "🔧", type: "expense" },
  { value: "other", label: "Other", emoji: "📋", type: "income" },
];
const BLANK_LEDGER = { type: "income" as LedgerType, category: "crop_sale" as LedgerCategory, amount: "", description: "", entryDate: new Date().toISOString().slice(0, 10), notes: "" };

function FarmLedgerTab({ userId }: { userId: Id<"users"> }) {
  const [form, setForm] = useState({ ...BLANK_LEDGER });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<LedgerType | "all">("all");

  const addEntry = useOfflineMutation<any>((api as any).farmToolbox.addFinancialEntry);
  const deleteEntry = useOfflineMutation<any>((api as any).farmToolbox.deleteFinancialEntry);

  const allEntries = useOfflineQuery(
    (api as any).farmToolbox.listFinancialEntries,
    { farmerId: userId },
    `toolbox_ledger_${userId}`
  ) as any[] | undefined;

  const filtered = filterType === "all" ? allEntries : (allEntries ?? []).filter((e: any) => e.type === filterType);
  const totalIncome = (allEntries ?? []).filter((e: any) => e.type === "income").reduce((sum: number, e: any) => sum + (e.amount ?? 0), 0);
  const totalExpense = (allEntries ?? []).filter((e: any) => e.type === "expense").reduce((sum: number, e: any) => sum + (e.amount ?? 0), 0);
  const profit = totalIncome - totalExpense;

  // Auto-select a sensible category based on type
  const availableCats = LEDGER_CATS.filter((c) => c.type === form.type || c.value === "other");

  async function handleAdd() {
    if (!form.description.trim() || !form.amount) return;
    setSaving(true);
    try {
      await addEntry({
        farmerId: userId,
        type: form.type,
        category: form.category,
        amount: parseFloat(form.amount),
        description: form.description.trim(),
        entryDate: new Date(form.entryDate).getTime(),
        notes: form.notes.trim() || undefined,
      });
      setForm({ ...BLANK_LEDGER });
      setShowForm(false);
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>🏦 Farm Ledger</h2>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: "0.4rem 0.85rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", fontFamily: FONT }}>
          {showForm ? "Cancel" : "➕ Add"}
        </button>
      </div>

      {/* Profit summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.85rem" }}>
        {[
          { label: "Income", value: totalIncome, color: "#2e7d32" },
          { label: "Expenses", value: totalExpense, color: "#c62828" },
          { label: "Profit", value: profit, color: profit >= 0 ? "#1565c0" : "#c62828" },
        ].map((c) => (
          <div key={c.label} style={{ background: "#fff", borderRadius: 10, padding: "0.7rem 0.5rem", textAlign: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: "0.68rem", color: "#888", marginBottom: "0.2rem" }}>{c.label}</div>
            <div style={{ fontWeight: 700, fontSize: "0.82rem", color: c.color }}>{profit < 0 && c.label === "Profit" ? "−" : ""}UGX {Math.abs(c.value).toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Type filter */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem" }}>
        {(["all", "income", "expense"] as const).map((t) => (
          <button key={t} onClick={() => setFilterType(t)}
            style={{ flex: 1, padding: "0.35rem 0", border: `1px solid ${filterType === t ? BRAND : "#ddd"}`, borderRadius: 20, background: filterType === t ? BRAND_BG : "#fff", color: filterType === t ? BRAND : "#666", fontWeight: filterType === t ? 700 : 400, fontSize: "0.78rem", cursor: "pointer", fontFamily: FONT }}>
            {t === "all" ? "All" : t === "income" ? "💰 Income" : "💸 Expenses"}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background: "#fff", borderRadius: 12, padding: "1rem", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: "1rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
            {(["income", "expense"] as LedgerType[]).map((t) => (
              <button key={t} type="button" onClick={() => setForm({ ...form, type: t, category: t === "income" ? "crop_sale" : "input_cost" })}
                style={{ flex: 1, padding: "0.4rem", border: `1px solid ${form.type === t ? BRAND : "#ddd"}`, borderRadius: 8, background: form.type === t ? BRAND_BG : "#fff", color: form.type === t ? BRAND : "#666", fontFamily: FONT, fontSize: "0.82rem", fontWeight: form.type === t ? 700 : 400, cursor: "pointer" }}>
                {t === "income" ? "💰 Income" : "💸 Expense"}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as LedgerCategory })}
              style={{ padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.82rem" }}>
              {availableCats.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
            </select>
            <input type="date" value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
              style={{ padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem" }} />
          </div>
          <input placeholder="Description *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={{ width: "100%", padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem", marginBottom: "0.5rem", boxSizing: "border-box" }} />
          <input placeholder="Amount (UGX) *" type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
            style={{ width: "100%", padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem", marginBottom: "0.5rem", boxSizing: "border-box" }} />
          <input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            style={{ width: "100%", padding: "0.45rem 0.7rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.85rem", marginBottom: "0.75rem", boxSizing: "border-box" }} />
          <button onClick={handleAdd} disabled={saving || !form.description.trim() || !form.amount}
            style={{ width: "100%", padding: "0.6rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontFamily: FONT, fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : `Save ${form.type === "income" ? "Income" : "Expense"}`}
          </button>
        </div>
      )}

      {/* Entry list */}
      {allEntries === undefined ? <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Loading…</div> :
        (filtered ?? []).length === 0 ? <div style={{ textAlign: "center", padding: "2rem", color: "#888", fontSize: "0.9rem" }}>No entries yet. Tap ➕ Add to record income or expenses.</div> :
        (filtered ?? []).map((e: any) => {
          const cat = LEDGER_CATS.find((c) => c.value === e.category);
          return (
            <div key={e._id} style={{ background: "#fff", borderRadius: 12, padding: "0.85rem 1rem", boxShadow: "0 2px 6px rgba(0,0,0,0.06)", marginBottom: "0.6rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderLeft: `4px solid ${e.type === "income" ? "#2e7d32" : "#c62828"}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.15rem" }}>{cat?.emoji ?? "📋"} {e.description}</div>
                <div style={{ fontSize: "0.78rem", color: e.type === "income" ? "#2e7d32" : "#c62828", fontWeight: 700 }}>{e.type === "income" ? "+" : "−"} UGX {(e.amount ?? 0).toLocaleString()}</div>
                <div style={{ fontSize: "0.72rem", color: "#aaa", marginTop: "0.1rem" }}>{new Date(e.entryDate).toLocaleDateString("en-UG")}</div>
              </div>
              <button onClick={() => deleteEntry({ entryId: e._id, farmerId: userId })}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", padding: "0 0.25rem", color: "#c62828", flexShrink: 0 }}>🗑️</button>
            </div>
          );
        })}
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
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) || null;
  const [activeTab, setActiveTab] = useState<Tab>("log");
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const ensureDefaultTemplate = useOfflineMutation<any>((api as any).farmToolbox.ensureDefaultBioFarmCoffeeTreeTagTemplate);
  const templates = useOfflineQuery(
    (api as any).farmToolbox.listTemplates,
    userId ? { farmerId: userId } : "skip",
    userId ? `toolbox_templates_${userId}` : undefined
  ) as any[] | undefined;

  useEffect(() => {
    if (!userId) return;
    void ensureDefaultTemplate({ requestingUserId: userId });
  }, [userId, ensureDefaultTemplate]);

  useEffect(() => {
    if (!userId || !templates || selectedTemplate || activeTab !== "log") return;
    const defaultTemplate = templates.find((tpl: any) => isDefaultBioFarmTemplate(tpl));
    if (defaultTemplate) {
      setSelectedTemplate(defaultTemplate);
    }
  }, [userId, templates, selectedTemplate, activeTab]);

  const tabs: { id: Tab; emoji: string; label: string; phase?: string }[] = [
    { id: "templates", emoji: "📋", label: "Create Form Template" },
    { id: "log",       emoji: "✏️",  label: "View Form" },
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
    <div style={{ fontFamily: FONT, minHeight: "100vh", background: "#f9fafb", paddingBottom: 80, width: "100%", overflowX: "hidden", boxSizing: "border-box" }}>
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
            style={{ flexShrink: 0, padding: "0.7rem 0.85rem", border: "none", borderBottom: activeTab === t.id ? `3px solid ${BRAND}` : "3px solid transparent", background: t.id === "log" ? "#f1f8e9" : "transparent", cursor: "pointer", fontFamily: FONT, fontSize: "0.78rem", fontWeight: activeTab === t.id ? 700 : 400, color: activeTab === t.id ? BRAND : "#666", whiteSpace: "nowrap" }}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "clamp(1rem,4vw,1.25rem)", maxWidth: 680, margin: "0 auto", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
        {!userId ? (
          authStatus === "loading" ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Loading user session...</div>
          ) : (
            <div style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
              <p style={{ margin: "0 0 0.5rem" }}>Your session expired. Please log in again.</p>
              <Link href="/login" style={{ color: BRAND, textDecoration: "none", fontWeight: 700 }}>Go to Login</Link>
            </div>
          )
        ) : activeTab === "templates" ? (
          <TemplatesTab userId={userId} onSelectTemplate={handleSelectTemplate} />
        ) : activeTab === "log" ? (
          <LogEntryTab userId={userId} selectedTemplate={selectedTemplate} setSelectedTemplate={setSelectedTemplate} />
        ) : activeTab === "units" ? (
          <UnitsTab userId={userId} />
        ) : activeTab === "insights" ? (
          <InsightsTab userId={userId} />
        ) : activeTab === "supply" ? (
          <SuppliesTab userId={userId} />
        ) : activeTab === "ledger" ? (
          <FarmLedgerTab userId={userId} />
        ) : (
          <ComingSoonCard emoji={tabs.find((t) => t.id === activeTab)?.emoji ?? "🔜"} label={tabs.find((t) => t.id === activeTab)?.label ?? ""} phase={tabs.find((t) => t.id === activeTab)?.phase ?? ""} />
        )}
      </div>
    </div>
  );
}

