"use client";

/**
 * Diagnostics library - admin panel (phase 0).
 *
 * Shown as a tab in the community dashboard for communities a super admin has
 * switched Diagnostics on for. The library itself is shared by every enabled
 * community: admins here add pests/diseases, photos and treatments (each with
 * its source), review each other's entries and flag problems. Only super
 * admins see the Remove / Restore / Dismiss controls, and the server enforces
 * the same rules.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DIAGNOSTIC_HOSTS, FLAG_REASONS, SYMPTOMS, isUnderReview } from "@/convex/diagnosticsRules";
import { compressImage, uploadToConvex } from "@/app/utils/imageCompress";
import { formatUgandaDateTime } from "@/app/utils/timeUtils";

const BRAND = "#166534";
const BRAND_BG = "#f0fdf4";
const FONT = '"Montserrat", sans-serif';

type View = "library" | "review" | "flags" | "checks" | "import" | "log" | "addCondition";
type ItemType = "condition" | "image" | "treatment";
type Status = "pending_review" | "active" | "rejected" | "removed";

const STATUS_LABEL: Record<Status, { label: string; color: string; bg: string }> = {
  pending_review: { label: "Waiting review", color: "#92400e", bg: "#fef3c7" },
  active: { label: "Approved", color: "#166534", bg: "#dcfce7" },
  rejected: { label: "Rejected", color: "#6b7280", bg: "#f3f4f6" },
  removed: { label: "Removed", color: "#991b1b", bg: "#fee2e2" },
};
const TREATMENT_ICON: Record<string, string> = { cultural: "🌱", organic: "🍃", chemical: "🧪" };
const hostEmoji = (key: string) => DIAGNOSTIC_HOSTS.find((h) => h.key === key)?.emoji ?? "🌾";
const hostLabel = (key: string) => DIAGNOSTIC_HOSTS.find((h) => h.key === key)?.label ?? key;

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "0.6rem 0.7rem",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontFamily: FONT,
  fontSize: "0.9rem",
};
const buttonStyle = (primary = false, danger = false): React.CSSProperties => ({
  padding: "0.55rem 0.9rem",
  minHeight: 40,
  borderRadius: 8,
  border: primary ? "none" : `1px solid ${danger ? "#fca5a5" : "#d1d5db"}`,
  background: primary ? BRAND : danger ? "#fef2f2" : "#fff",
  color: primary ? "#fff" : danger ? "#991b1b" : "#111827",
  fontFamily: FONT,
  fontWeight: 600,
  fontSize: "0.85rem",
  cursor: "pointer",
});
const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "0.75rem",
  background: "#fff",
  marginBottom: "0.6rem",
};

function StatusBadge({ status, openFlagCount }: { status: Status; openFlagCount?: number }) {
  const s = STATUS_LABEL[status];
  return (
    <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
      <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: s.color, background: s.bg }}>
        {s.label}
      </span>
      {isUnderReview(openFlagCount) && (
        <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: "#9a3412", background: "#ffedd5" }}>
          ⚠ Being reviewed
        </span>
      )}
      {!!openFlagCount && !isUnderReview(openFlagCount) && (
        <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: "#9a3412", background: "#fff7ed" }}>
          🚩 {openFlagCount}
        </span>
      )}
    </span>
  );
}

function SourceLine({ name, url, licence }: { name: string; url?: string; licence?: string }) {
  return (
    <div style={{ fontSize: "0.75rem", color: "#4b5563", marginTop: 4, wordBreak: "break-word" }}>
      Source:{" "}
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#1d4ed8" }}>
          {name}
        </a>
      ) : (
        name
      )}
      {licence ? ` · ${licence}` : ""}
    </div>
  );
}

const MAX_PHOTOS_PER_BATCH = 6;

type PhotoSource = { sourceName: string; sourceUrl: string; licence: string };

/** Shrinks and uploads each photo, then adds it to the entry. Returns how many were added. */
function usePhotoUploader(base: Base) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const addImage = useMutation(api.diagnostics.addImage);
  return async (
    conditionId: Id<"diagnosticConditions">,
    files: File[],
    source: PhotoSource,
    onAdded?: (count: number) => void
  ) => {
    let added = 0;
    for (const file of files) {
      // Full photo ~800px and a ~240px thumbnail keep uploads small on slow networks.
      const [full, thumb] = await Promise.all([compressImage(file, 800, 0.75), compressImage(file, 240, 0.7)]);
      const storageId = await uploadToConvex(await generateUploadUrl(), full);
      const thumbStorageId = await uploadToConvex(await generateUploadUrl(), thumb);
      await addImage({
        ...base,
        conditionId,
        storageId: storageId as Id<"_storage">,
        thumbStorageId: thumbStorageId as Id<"_storage">,
        sourceName: source.sourceName,
        sourceUrl: source.sourceUrl || undefined,
        licence: source.licence,
      });
      added++;
      onAdded?.(added);
    }
    return added;
  };
}

function PhotoFields({
  files,
  onFiles,
  source,
  onSource,
}: {
  files: File[];
  onFiles: (files: File[]) => void;
  source: PhotoSource;
  onSource: (patch: Partial<PhotoSource>) => void;
}) {
  const [previews, setPreviews] = useState<string[]>([]);
  const pick = (list: FileList | null) => {
    const next = [...files, ...Array.from(list ?? [])].slice(0, MAX_PHOTOS_PER_BATCH);
    previews.forEach((u) => URL.revokeObjectURL(u));
    setPreviews(next.map((f) => URL.createObjectURL(f)));
    onFiles(next);
  };
  const removeAt = (i: number) => {
    URL.revokeObjectURL(previews[i]);
    setPreviews(previews.filter((_, idx) => idx !== i));
    onFiles(files.filter((_, idx) => idx !== i));
  };
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={{ ...buttonStyle(), textAlign: "center", display: "block" }}>
        📷 Add photos ({files.length}/{MAX_PHOTOS_PER_BATCH})
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
          style={{ display: "none" }}
        />
      </label>
      {files.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 6 }}>
            {previews.map((url, i) => (
              <div key={url} style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 6 }} />
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label="Remove photo"
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    border: "none",
                    background: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#4b5563" }}>Source for these photos:</div>
          <input
            placeholder="Source name (or your community for own photos)"
            value={source.sourceName}
            onChange={(e) => onSource({ sourceName: e.target.value })}
            style={inputStyle}
          />
          <input
            placeholder="Source link https://… (optional)"
            value={source.sourceUrl}
            onChange={(e) => onSource({ sourceUrl: e.target.value })}
            style={inputStyle}
            inputMode="url"
          />
          <input
            placeholder="Licence (e.g. CC BY 4.0, Own photo)"
            value={source.licence}
            onChange={(e) => onSource({ licence: e.target.value })}
            style={inputStyle}
            list="diagnostic-licences"
          />
          <datalist id="diagnostic-licences">
            <option value="Own photo" />
            <option value="CC BY 4.0" />
            <option value="CC BY-SA 4.0" />
            <option value="CC0 / Public domain" />
          </datalist>
        </>
      )}
    </div>
  );
}

function SymptomPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
      {SYMPTOMS.map((sym) => {
        const on = value.includes(sym.key);
        return (
          <button
            key={sym.key}
            type="button"
            onClick={() => onChange(on ? value.filter((k) => k !== sym.key) : [...value, sym.key])}
            style={{ ...buttonStyle(on), textAlign: "left", fontWeight: 500 }}
          >
            {sym.emoji} {sym.label}
          </button>
        );
      })}
    </div>
  );
}

const symptomLabel = (key: string) => {
  const sym = SYMPTOMS.find((x) => x.key === key);
  return sym ? `${sym.emoji} ${sym.label}` : key;
};

export function DiagnosticsLibraryPanel({
  userId,
  communityId,
  isSuperAdmin,
}: {
  userId: Id<"users">;
  communityId: Id<"communities">;
  isSuperAdmin: boolean;
}) {
  const [view, setView] = useState<View>("library");
  const [openConditionId, setOpenConditionId] = useState<Id<"diagnosticConditions"> | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const base = { adminId: userId, communityId };
  const reviewQueue = useQuery(api.diagnostics.listReviewQueue, base);
  const openFlags = useQuery(api.diagnostics.listOpenFlags, base);

  const notify = (type: "success" | "error", text: string) => setMessage({ type, text });
  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      notify("success", success);
      return true;
    } catch (error: any) {
      notify("error", String(error?.message || error).replace(/^.*Uncaught Error:\s*/, "").split("\n")[0]);
      return false;
    }
  };

  const tabs: { key: View; label: string }[] = [
    { key: "library", label: "📚 Library" },
    { key: "review", label: `✅ Review${reviewQueue?.length ? ` (${reviewQueue.length})` : ""}` },
    { key: "flags", label: `🚩 Flags${openFlags?.length ? ` (${openFlags.length})` : ""}` },
    { key: "checks", label: "🌾 Farmer checks" },
    ...(isSuperAdmin ? [{ key: "import" as View, label: "🌐 Import" }] : []),
    { key: "log", label: "🕘 Log" },
  ];

  return (
    <div style={{ fontFamily: FONT, padding: "0.5rem", maxWidth: 820 }}>
      <p style={{ fontSize: "0.8rem", color: "#4b5563", margin: "0 0 0.75rem" }}>
        Shared pest &amp; disease library for every community with Diagnostics. New entries are only used after
        another admin approves them. {isSuperAdmin ? "" : "Only a super admin can remove entries."}
      </p>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 8 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setView(t.key);
              setOpenConditionId(null);
            }}
            style={{
              ...buttonStyle(view === t.key && !openConditionId),
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && (
        <div
          role="status"
          onClick={() => setMessage(null)}
          style={{
            padding: "0.6rem 0.8rem",
            borderRadius: 8,
            marginBottom: 10,
            fontSize: "0.85rem",
            background: message.type === "success" ? "#dcfce7" : "#fee2e2",
            color: message.type === "success" ? "#166534" : "#991b1b",
          }}
        >
          {message.text}
        </div>
      )}

      {openConditionId ? (
        <ConditionDetail
          base={base}
          conditionId={openConditionId}
          onBack={() => setOpenConditionId(null)}
          run={run}
        />
      ) : view === "library" ? (
        <LibraryList base={base} isSuperAdmin={isSuperAdmin} onOpen={setOpenConditionId} onAdd={() => setView("addCondition")} />
      ) : view === "addCondition" ? (
        <AddConditionForm
          base={base}
          run={run}
          onDone={(id) => {
            setView("library");
            if (id) setOpenConditionId(id);
          }}
        />
      ) : view === "review" ? (
        <ReviewQueue base={base} rows={reviewQueue} run={run} onOpen={setOpenConditionId} />
      ) : view === "flags" ? (
        <FlagList base={base} rows={openFlags} isSuperAdmin={isSuperAdmin} run={run} onOpen={setOpenConditionId} />
      ) : view === "checks" ? (
        <FarmerChecks base={base} />
      ) : view === "import" && isSuperAdmin ? (
        <ImportSettings adminId={userId} run={run} />
      ) : (
        <AuditLog base={base} />
      )}
    </div>
  );
}

type Base = { adminId: Id<"users">; communityId: Id<"communities"> };
type Run = (fn: () => Promise<unknown>, success: string) => Promise<boolean>;

function LibraryList({
  base,
  isSuperAdmin,
  onOpen,
  onAdd,
}: {
  base: Base;
  isSuperAdmin: boolean;
  onOpen: (id: Id<"diagnosticConditions">) => void;
  onAdd: () => void;
}) {
  const [host, setHost] = useState<string>("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("active");
  const rows = useQuery(api.diagnostics.listConditions, {
    ...base,
    status,
    host: host || undefined,
    search: search || undefined,
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>
        {[{ key: "", label: "All", emoji: "🌍" }, ...DIAGNOSTIC_HOSTS].map((h) => (
          <button
            key={h.key}
            onClick={() => setHost(h.key)}
            style={{ ...buttonStyle(host === h.key), whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {h.emoji} {h.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, margin: "6px 0 10px", flexWrap: "wrap" }}>
        <input
          placeholder="Search name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: "1 1 160px", width: "auto" }}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)} style={{ ...inputStyle, flex: "0 1 170px", width: "auto" }}>
          <option value="active">Approved</option>
          <option value="pending_review">Waiting review</option>
          <option value="rejected">Rejected</option>
          {isSuperAdmin && <option value="removed">Removed</option>}
        </select>
        <button onClick={onAdd} style={buttonStyle(true)}>
          + Add pest / disease
        </button>
      </div>

      {rows === undefined ? (
        <p style={{ color: "#6b7280" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>Nothing here yet.</p>
      ) : (
        rows.map((c) => (
          <button
            key={c._id}
            onClick={() => onOpen(c._id)}
            style={{ ...cardStyle, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: FONT, display: "block" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ fontSize: "0.95rem" }}>{c.name}</strong>
              <StatusBadge status={c.status} openFlagCount={c.openFlagCount} />
            </div>
            <div style={{ fontSize: "0.8rem", color: "#4b5563", marginTop: 4 }}>
              {c.kind} · {c.hosts.map((h) => `${hostEmoji(h)} ${hostLabel(h)}`).join("  ")}
              {c.scientificName ? ` · ${c.scientificName}` : ""}
            </div>
            {c.symptomTagCount === 0 && (
              <div style={{ fontSize: "0.72rem", color: "#9a3412", marginTop: 4 }}>
                ⚠ No symptoms picked - farmers cannot match this yet
              </div>
            )}
          </button>
        ))
      )}
    </div>
  );
}

function AddConditionForm({
  base,
  run,
  onDone,
}: {
  base: Base;
  run: Run;
  onDone: (id?: Id<"diagnosticConditions">) => void;
}) {
  const addCondition = useMutation(api.diagnostics.addCondition);
  const uploadPhotos = usePhotoUploader(base);
  const [symptomTags, setSymptomTags] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [photoSource, setPhotoSource] = useState<PhotoSource>({ sourceName: "", sourceUrl: "", licence: "" });
  const [form, setForm] = useState({
    name: "",
    scientificName: "",
    kind: "disease" as "pest" | "disease" | "deficiency" | "other",
    hosts: [] as string[],
    symptoms: "",
    sourceName: "",
    sourceUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    setSaving(true);
    let newId: Id<"diagnosticConditions"> | undefined;
    const ok = await run(async () => {
      if (files.length > 0 && (!photoSource.sourceName.trim() || !photoSource.licence.trim())) {
        throw new Error("Add a source name and licence for the photos");
      }
      newId = await addCondition({ ...base, ...form, symptomTags });
      if (files.length > 0) {
        let added = 0;
        try {
          await uploadPhotos(newId, files, photoSource, (n) => (added = n));
        } catch (error: any) {
          // The entry is already saved, so point the admin at it rather than letting them add it twice.
          throw new Error(
            `Entry saved with ${added} of ${files.length} photos (${error?.message || "upload failed"}). Open it to add the rest.`
          );
        }
      }
    }, `Added${files.length ? ` with ${files.length} photo${files.length > 1 ? "s" : ""}` : ""}. It will be used once another admin approves it.`);
    setSaving(false);
    if (ok) onDone(newId);
  };

  return (
    <div style={cardStyle}>
      <h3 style={{ margin: "0 0 0.6rem", fontSize: "1rem" }}>Add a pest or disease</h3>
      <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Crops affected</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0 10px" }}>
        {DIAGNOSTIC_HOSTS.map((h) => {
          const on = form.hosts.includes(h.key);
          return (
            <button
              key={h.key}
              type="button"
              onClick={() => set({ hosts: on ? form.hosts.filter((x) => x !== h.key) : [...form.hosts, h.key] })}
              style={buttonStyle(on)}
            >
              {h.emoji} {h.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <input placeholder="Common name (e.g. Fall armyworm)" value={form.name} onChange={(e) => set({ name: e.target.value })} style={inputStyle} />
        <input placeholder="Scientific name (optional)" value={form.scientificName} onChange={(e) => set({ scientificName: e.target.value })} style={inputStyle} />
        <select value={form.kind} onChange={(e) => set({ kind: e.target.value as typeof form.kind })} style={inputStyle}>
          <option value="disease">Disease</option>
          <option value="pest">Pest</option>
          <option value="deficiency">Nutrient deficiency</option>
          <option value="other">Other</option>
        </select>
        <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Symptoms farmers will tap (used for matching)</label>
        <SymptomPicker value={symptomTags} onChange={setSymptomTags} />
        <textarea
          placeholder="Describe what the farmer sees"
          value={form.symptoms}
          onChange={(e) => set({ symptoms: e.target.value })}
          rows={4}
          style={inputStyle}
        />
        <input placeholder="Source name (e.g. FAO, NARO)" value={form.sourceName} onChange={(e) => set({ sourceName: e.target.value })} style={inputStyle} />
        <input placeholder="Source link https://… (optional)" value={form.sourceUrl} onChange={(e) => set({ sourceUrl: e.target.value })} style={inputStyle} inputMode="url" />
        <label style={{ fontSize: "0.8rem", fontWeight: 600, marginTop: 4 }}>Photos (optional, up to {MAX_PHOTOS_PER_BATCH})</label>
        <PhotoFields
          files={files}
          onFiles={setFiles}
          source={photoSource}
          onSource={(p) => setPhotoSource((prev) => ({ ...prev, ...p }))}
        />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={submit} disabled={saving} style={buttonStyle(true)}>
          {saving ? (files.length ? "Uploading…" : "Saving…") : "Submit for review"}
        </button>
        <button onClick={() => onDone()} style={buttonStyle()}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ConditionDetail({
  base,
  conditionId,
  onBack,
  run,
}: {
  base: Base;
  conditionId: Id<"diagnosticConditions">;
  onBack: () => void;
  run: Run;
}) {
  const data = useQuery(api.diagnostics.getCondition, { ...base, conditionId });
  const [adding, setAdding] = useState<"image" | "treatment" | null>(null);

  if (data === undefined) return <p style={{ color: "#6b7280" }}>Loading…</p>;
  if (data === null)
    return (
      <div>
        <button onClick={onBack} style={buttonStyle()}>← Back</button>
        <p>This entry is no longer in the library.</p>
      </div>
    );

  const { condition, images, treatments, flags, viewer } = data;
  const flagsFor = (itemId: string) => flags.filter((f) => f.itemId === itemId);
  const canAddChildren = condition.status === "active" || condition.status === "pending_review";

  return (
    <div>
      <button onClick={onBack} style={{ ...buttonStyle(), marginBottom: 10 }}>
        ← Back
      </button>

      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{condition.name}</h3>
          <StatusBadge status={condition.status} openFlagCount={condition.openFlagCount} />
        </div>
        <div style={{ fontSize: "0.8rem", color: "#4b5563", margin: "4px 0 8px" }}>
          {condition.kind}
          {condition.scientificName ? ` · ${condition.scientificName}` : ""} ·{" "}
          {condition.hosts.map((h) => `${hostEmoji(h)} ${hostLabel(h)}`).join("  ")}
        </div>
        <p style={{ fontSize: "0.9rem", margin: 0, whiteSpace: "pre-wrap" }}>{condition.symptoms}</p>
        <SymptomTagsEditor
          base={base}
          conditionId={conditionId}
          tags={condition.symptomTags ?? []}
          canEdit={
            condition.status !== "removed" &&
            condition.status !== "rejected" &&
            (viewer.isSuperAdmin || condition.status === "pending_review")
          }
          run={run}
        />
        <SourceLine name={condition.sourceName} url={condition.sourceUrl} />
        <Attribution row={condition} />
        {condition.removalReason && <p style={{ fontSize: "0.8rem", color: "#991b1b" }}>Removed: {condition.removalReason}</p>}
        <ItemActions base={base} itemType="condition" item={condition} flags={flagsFor(String(condition._id))} isSuperAdmin={viewer.isSuperAdmin} run={run} />
      </div>

      <h4 style={{ margin: "14px 0 6px" }}>📷 Photos ({images.length})</h4>
      {images.length === 0 && <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>No photos yet.</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
        {images.map((img) => (
          <div key={img._id} style={{ ...cardStyle, marginBottom: 0, padding: 8 }}>
            {img.thumbUrl && (
              <a href={img.url ?? img.thumbUrl} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.thumbUrl} alt={img.caption || condition.name} loading="lazy" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 6 }} />
              </a>
            )}
            <StatusBadge status={img.status} openFlagCount={img.openFlagCount} />
            {img.caption && <div style={{ fontSize: "0.8rem", marginTop: 4 }}>{img.caption}</div>}
            <SourceLine name={img.sourceName} url={img.sourceUrl} licence={img.licence} />
            <Attribution row={img} />
            <ItemActions base={base} itemType="image" item={img} flags={flagsFor(String(img._id))} isSuperAdmin={viewer.isSuperAdmin} run={run} compact />
          </div>
        ))}
      </div>

      <h4 style={{ margin: "14px 0 6px" }}>💊 Treatments ({treatments.length})</h4>
      {treatments.length === 0 && <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>No treatments yet.</p>}
      {treatments.map((t) => (
        <div key={t._id} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ fontSize: "0.85rem" }}>
              {TREATMENT_ICON[t.kind]} {t.kind}
            </strong>
            <StatusBadge status={t.status} openFlagCount={t.openFlagCount} />
          </div>
          <p style={{ fontSize: "0.9rem", margin: "4px 0", whiteSpace: "pre-wrap" }}>{t.text}</p>
          <SourceLine name={t.sourceName} url={t.sourceUrl} />
          <Attribution row={t} />
          <ItemActions base={base} itemType="treatment" item={t} flags={flagsFor(String(t._id))} isSuperAdmin={viewer.isSuperAdmin} run={run} />
        </div>
      ))}

      {canAddChildren && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
          <button onClick={() => setAdding(adding === "image" ? null : "image")} style={buttonStyle(adding === "image")}>
            + Add photo
          </button>
          <button onClick={() => setAdding(adding === "treatment" ? null : "treatment")} style={buttonStyle(adding === "treatment")}>
            + Add treatment
          </button>
        </div>
      )}
      {adding === "image" && <AddImageForm base={base} conditionId={conditionId} run={run} onDone={() => setAdding(null)} />}
      {adding === "treatment" && <AddTreatmentForm base={base} conditionId={conditionId} run={run} onDone={() => setAdding(null)} />}
    </div>
  );
}

function Attribution({ row }: { row: { addedByName?: string; addedByCommunityName?: string; addedAt: number } }) {
  return (
    <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 2 }}>
      Added by {row.addedByName ?? "Admin"} ({row.addedByCommunityName}) · {formatUgandaDateTime(row.addedAt)}
    </div>
  );
}

function ItemActions({
  base,
  itemType,
  item,
  flags,
  isSuperAdmin,
  run,
  compact,
}: {
  base: Base;
  itemType: ItemType;
  item: { _id: string; status: Status; isMine: boolean };
  flags: { _id: string; reason: string; note?: string; flaggedByName?: string; flaggedByCommunityName?: string }[];
  isSuperAdmin: boolean;
  run: Run;
  compact?: boolean;
}) {
  const reviewItem = useMutation(api.diagnostics.reviewItem);
  const flagItem = useMutation(api.diagnostics.flagItem);
  const removeItem = useMutation(api.diagnostics.removeItem);
  const restoreItem = useMutation(api.diagnostics.restoreItem);
  const dismissFlags = useMutation(api.diagnostics.dismissFlags);
  const [flagging, setFlagging] = useState(false);
  const [reason, setReason] = useState<string>(FLAG_REASONS[0].key);
  const [note, setNote] = useState("");
  const args = { ...base, itemType, itemId: String(item._id) };

  const canReviewIt = item.status === "pending_review" && (isSuperAdmin || !item.isMine);
  const canFlagIt = item.status === "active" || item.status === "pending_review";
  const reasonLabel = (key: string) => FLAG_REASONS.find((r) => r.key === key)?.label ?? key;

  return (
    <div style={{ marginTop: 8 }}>
      {flags.length > 0 && (
        <div style={{ fontSize: "0.75rem", background: "#fff7ed", borderRadius: 6, padding: 6, marginBottom: 6 }}>
          {flags.map((f) => (
            <div key={f._id}>
              🚩 {reasonLabel(f.reason)}
              {f.note ? `: ${f.note}` : ""} ({f.flaggedByCommunityName})
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {canReviewIt && (
          <>
            <button onClick={() => run(() => reviewItem({ ...args, decision: "approve" }), "Approved")} style={buttonStyle(true)}>
              Approve
            </button>
            <button
              onClick={() => {
                const reviewNote = window.prompt("Why is this rejected? (optional)") ?? undefined;
                run(() => reviewItem({ ...args, decision: "reject", note: reviewNote }), "Rejected");
              }}
              style={buttonStyle()}
            >
              Reject
            </button>
          </>
        )}
        {item.status === "pending_review" && item.isMine && !isSuperAdmin && (
          <span style={{ fontSize: "0.75rem", color: "#6b7280", alignSelf: "center" }}>Another admin must review this</span>
        )}
        {canFlagIt && (
          <button onClick={() => setFlagging(!flagging)} style={buttonStyle()}>
            🚩 {compact ? "" : "Flag"}
          </button>
        )}
        {isSuperAdmin && flags.length > 0 && (
          <button onClick={() => run(() => dismissFlags(args), "Flags dismissed")} style={buttonStyle()}>
            Dismiss flags
          </button>
        )}
        {isSuperAdmin && item.status !== "removed" && (
          <button
            onClick={() => {
              const removalReason = window.prompt("Reason for removing this entry (required)");
              if (removalReason && removalReason.trim()) run(() => removeItem({ ...args, reason: removalReason }), "Removed");
            }}
            style={buttonStyle(false, true)}
          >
            Remove
          </button>
        )}
        {isSuperAdmin && item.status === "removed" && (
          <button onClick={() => run(() => restoreItem(args), "Restored - it is back in the review queue")} style={buttonStyle()}>
            Restore
          </button>
        )}
      </div>
      {flagging && (
        <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
          <select value={reason} onChange={(e) => setReason(e.target.value)} style={inputStyle}>
            {FLAG_REASONS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <input placeholder="What is wrong? (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
          <button
            onClick={async () => {
              const ok = await run(() => flagItem({ ...args, reason, note: note || undefined }), "Flagged for review");
              if (ok) {
                setFlagging(false);
                setNote("");
              }
            }}
            style={buttonStyle(true)}
          >
            Send flag
          </button>
        </div>
      )}
    </div>
  );
}

function AddImageForm({
  base,
  conditionId,
  run,
  onDone,
}: {
  base: Base;
  conditionId: Id<"diagnosticConditions">;
  run: Run;
  onDone: () => void;
}) {
  const uploadPhotos = usePhotoUploader(base);
  const [files, setFiles] = useState<File[]>([]);
  const [source, setSource] = useState<PhotoSource>({ sourceName: "", sourceUrl: "", licence: "" });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (files.length === 0) return;
    setSaving(true);
    const ok = await run(async () => {
      let added = 0;
      try {
        await uploadPhotos(conditionId, files, source, (n) => (added = n));
      } catch (error: any) {
        throw new Error(`${added} of ${files.length} photos added. ${error?.message || "Upload failed"}`);
      }
    }, `${files.length} photo${files.length > 1 ? "s" : ""} added. They will be used once another admin approves them.`);
    setSaving(false);
    if (ok) onDone();
  };

  return (
    <div style={cardStyle}>
      <PhotoFields files={files} onFiles={setFiles} source={source} onSource={(p) => setSource((prev) => ({ ...prev, ...p }))} />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={submit} disabled={files.length === 0 || saving} style={buttonStyle(true)}>
          {saving ? "Uploading…" : files.length > 1 ? `Submit ${files.length} photos` : "Submit photo"}
        </button>
        <button onClick={onDone} style={buttonStyle()}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function SymptomTagsEditor({
  base,
  conditionId,
  tags,
  canEdit,
  run,
}: {
  base: Base;
  conditionId: Id<"diagnosticConditions">;
  tags: string[];
  canEdit: boolean;
  run: Run;
}) {
  const setSymptomTags = useMutation(api.diagnostics.setSymptomTags);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(tags);

  if (editing) {
    return (
      <div style={{ marginTop: 8 }}>
        <SymptomPicker value={draft} onChange={setDraft} />
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button
            onClick={async () => {
              if (await run(() => setSymptomTags({ ...base, conditionId, symptomTags: draft }), "Symptoms saved")) {
                setEditing(false);
              }
            }}
            style={buttonStyle(true)}
          >
            Save symptoms
          </button>
          <button onClick={() => setEditing(false)} style={buttonStyle()}>
            Cancel
          </button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 8 }}>
      {tags.length === 0 ? (
        <div style={{ fontSize: "0.78rem", color: "#9a3412" }}>⚠ No symptoms picked - farmers cannot match this yet</div>
      ) : (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {tags.map((t) => (
            <span key={t} style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: 999, background: BRAND_BG, color: BRAND }}>
              {symptomLabel(t)}
            </span>
          ))}
        </div>
      )}
      {canEdit && (
        <button
          onClick={() => {
            setDraft(tags);
            setEditing(true);
          }}
          style={{ ...buttonStyle(), marginTop: 6 }}
        >
          ✏️ Symptoms
        </button>
      )}
    </div>
  );
}

function AddTreatmentForm({
  base,
  conditionId,
  run,
  onDone,
}: {
  base: Base;
  conditionId: Id<"diagnosticConditions">;
  run: Run;
  onDone: () => void;
}) {
  const addTreatment = useMutation(api.diagnostics.addTreatment);
  const [form, setForm] = useState({
    kind: "cultural" as "cultural" | "organic" | "chemical",
    text: "",
    sourceName: "",
    sourceUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    setSaving(true);
    const ok = await run(
      () => addTreatment({ ...base, conditionId, ...form, sourceUrl: form.sourceUrl || undefined }),
      "Treatment added. It will be used once another admin approves it."
    );
    setSaving(false);
    if (ok) onDone();
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {(["cultural", "organic", "chemical"] as const).map((k) => (
          <button key={k} type="button" onClick={() => set({ kind: k })} style={buttonStyle(form.kind === k)}>
            {TREATMENT_ICON[k]} {k}
          </button>
        ))}
      </div>
      {form.kind === "chemical" && (
        <p style={{ fontSize: "0.78rem", color: "#92400e", background: "#fef3c7", borderRadius: 6, padding: 6, margin: "0 0 8px" }}>
          Name the active ingredient, not a brand. Brands are only shown to farmers once a verified pesticide supplier
          sells them in the community.
        </p>
      )}
      <div style={{ display: "grid", gap: 8 }}>
        <textarea placeholder="What should the farmer do? Keep it short." value={form.text} onChange={(e) => set({ text: e.target.value })} rows={3} style={inputStyle} />
        <input placeholder="Source name" value={form.sourceName} onChange={(e) => set({ sourceName: e.target.value })} style={inputStyle} />
        <input placeholder="Source link https://… (optional)" value={form.sourceUrl} onChange={(e) => set({ sourceUrl: e.target.value })} style={inputStyle} inputMode="url" />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={submit} disabled={saving} style={buttonStyle(true)}>
          {saving ? "Saving…" : "Submit treatment"}
        </button>
        <button onClick={onDone} style={buttonStyle()}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ReviewQueue({
  base,
  rows,
  run,
  onOpen,
}: {
  base: Base;
  rows:
    | {
        itemType: ItemType;
        itemId: string;
        conditionId: Id<"diagnosticConditions">;
        conditionName: string;
        summary: string;
        addedAt: number;
        addedByName?: string;
        addedByCommunityName?: string;
        canReview: boolean;
      }[]
    | undefined;
  run: Run;
  onOpen: (id: Id<"diagnosticConditions">) => void;
}) {
  const reviewItem = useMutation(api.diagnostics.reviewItem);
  if (rows === undefined) return <p style={{ color: "#6b7280" }}>Loading…</p>;
  if (rows.length === 0) return <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>Nothing is waiting for review.</p>;
  const typeLabel: Record<ItemType, string> = { condition: "Pest/disease", image: "Photo", treatment: "Treatment" };

  return (
    <div>
      {rows.map((r) => (
        <div key={r.itemId} style={cardStyle}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{typeLabel[r.itemType]}</div>
          <strong style={{ fontSize: "0.95rem" }}>{r.conditionName}</strong>
          {r.itemType !== "condition" && <p style={{ fontSize: "0.85rem", margin: "4px 0" }}>{r.summary}</p>}
          <div style={{ fontSize: "0.72rem", color: "#6b7280" }}>
            {r.addedByName} ({r.addedByCommunityName}) · {formatUgandaDateTime(r.addedAt)}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            <button onClick={() => onOpen(r.conditionId)} style={buttonStyle()}>
              Open
            </button>
            {r.canReview ? (
              <>
                <button
                  onClick={() => run(() => reviewItem({ ...base, itemType: r.itemType, itemId: r.itemId, decision: "approve" }), "Approved")}
                  style={buttonStyle(true)}
                >
                  Approve
                </button>
                <button
                  onClick={() => {
                    const note = window.prompt("Why is this rejected? (optional)") ?? undefined;
                    run(() => reviewItem({ ...base, itemType: r.itemType, itemId: r.itemId, decision: "reject", note }), "Rejected");
                  }}
                  style={buttonStyle()}
                >
                  Reject
                </button>
              </>
            ) : (
              <span style={{ fontSize: "0.75rem", color: "#6b7280", alignSelf: "center" }}>Your entry - another admin must review it</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function FlagList({
  base,
  rows,
  isSuperAdmin,
  run,
  onOpen,
}: {
  base: Base;
  rows:
    | {
        _id: string;
        itemType: ItemType;
        itemId: string;
        conditionId: Id<"diagnosticConditions">;
        conditionName?: string;
        reason: string;
        note?: string;
        createdAt: number;
        flaggedByName?: string;
        flaggedByCommunityName?: string;
      }[]
    | undefined;
  isSuperAdmin: boolean;
  run: Run;
  onOpen: (id: Id<"diagnosticConditions">) => void;
}) {
  const dismissFlags = useMutation(api.diagnostics.dismissFlags);
  if (rows === undefined) return <p style={{ color: "#6b7280" }}>Loading…</p>;
  if (rows.length === 0) return <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>No open flags.</p>;
  const reasonLabel = (key: string) => FLAG_REASONS.find((r) => r.key === key)?.label ?? key;

  return (
    <div>
      {rows.map((f) => (
        <div key={f._id} style={cardStyle}>
          <strong style={{ fontSize: "0.95rem" }}>🚩 {f.conditionName}</strong>
          <div style={{ fontSize: "0.85rem", margin: "4px 0" }}>
            {f.itemType} · {reasonLabel(f.reason)}
            {f.note ? `: ${f.note}` : ""}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#6b7280" }}>
            {f.flaggedByName} ({f.flaggedByCommunityName}) · {formatUgandaDateTime(f.createdAt)}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            <button onClick={() => onOpen(f.conditionId)} style={buttonStyle()}>
              Open
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => run(() => dismissFlags({ ...base, itemType: f.itemType, itemId: f.itemId }), "Flags dismissed")}
                style={buttonStyle()}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  added: "added",
  approved: "approved",
  rejected: "rejected",
  flagged: "flagged",
  flag_dismissed: "dismissed flags on",
  removed: "removed",
  restored: "restored",
  module_enabled: "enabled Diagnostics for",
  module_disabled: "disabled Diagnostics for",
  symptoms_changed: "changed symptoms on",
  imported: "imported",
  import_enabled: "switched on the weekly photo import",
  import_disabled: "switched off the weekly photo import",
};

function AuditLog({ base }: { base: Base }) {
  const rows = useQuery(api.diagnostics.listAuditLog, base);
  if (rows === undefined) return <p style={{ color: "#6b7280" }}>Loading…</p>;
  if (rows.length === 0) return <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>No activity yet.</p>;
  return (
    <div>
      {rows.map((r) => (
        <div key={r._id} style={{ ...cardStyle, padding: "0.55rem 0.75rem" }}>
          <div style={{ fontSize: "0.85rem" }}>
            <strong>{r.actorName}</strong> ({r.actorCommunityName}) {ACTION_LABEL[r.action] ?? r.action}{" "}
            {r.itemType ?? ""}
            {r.note ? ` - ${r.note}` : ""}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#6b7280" }}>{formatUgandaDateTime(r.at)}</div>
        </div>
      ))}
    </div>
  );
}

const LEVEL_LABEL: Record<string, { emoji: string; label: string; color: string }> = {
  likely: { emoji: "🔴", label: "Likely problem", color: "#991b1b" },
  possible: { emoji: "🟠", label: "Possible problem", color: "#9a3412" },
  unsure: { emoji: "❔", label: "Not sure", color: "#854d0e" },
  healthy: { emoji: "✅", label: "Healthy", color: "#166534" },
};

function StatTile({ value, label }: { value: number | string; label: string }) {
  return (
    <div style={{ ...cardStyle, marginBottom: 0, textAlign: "center", padding: "0.6rem" }}>
      <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: "0.72rem", color: "#4b5563" }}>{label}</div>
    </div>
  );
}

/** How this community's farmers are using the crop check, and what they are finding. */
function FarmerChecks({ base }: { base: Base }) {
  const [days, setDays] = useState(30);
  const data = useQuery(api.diagnostics.listCommunityChecks, { ...base, days });

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDays(d)} style={buttonStyle(days === d)}>
            {d} days
          </button>
        ))}
      </div>

      {data === undefined ? (
        <p style={{ color: "#6b7280" }}>Loading…</p>
      ) : data.total === 0 ? (
        <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>No crop checks in the last {data.days} days.</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 10 }}>
            <StatTile value={data.capped ? `${data.total}+` : data.total} label="checks" />
            <StatTile value={data.farmerCount} label="farmers" />
            <StatTile value={data.byLevel.likely + data.byLevel.possible} label="found a problem" />
            <StatTile
              value={data.feedback.right + data.feedback.wrong > 0 ? `${Math.round((100 * data.feedback.right) / (data.feedback.right + data.feedback.wrong))}%` : "-"}
              label={`said right (${data.feedback.right + data.feedback.wrong} answers)`}
            />
          </div>

          <div style={cardStyle}>
            <strong style={{ fontSize: "0.9rem" }}>Results</strong>
            {(["likely", "possible", "unsure", "healthy"] as const).map((k) => {
              const n = data.byLevel[k] ?? 0;
              const pct = data.total ? Math.round((100 * n) / data.total) : 0;
              return (
                <div key={k} style={{ marginTop: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                    <span>
                      {LEVEL_LABEL[k].emoji} {LEVEL_LABEL[k].label}
                    </span>
                    <span>
                      {n} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: 8, background: "#f3f4f6", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: LEVEL_LABEL[k].color }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
            <div style={cardStyle}>
              <strong style={{ fontSize: "0.9rem" }}>Most found problems</strong>
              {data.topProblems.length === 0 ? (
                <p style={{ fontSize: "0.82rem", color: "#6b7280", margin: "6px 0 0" }}>None named with confidence yet.</p>
              ) : (
                data.topProblems.map((p) => (
                  <div key={p.name} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginTop: 6 }}>
                    <span>{p.name}</span>
                    <strong>{p.count}</strong>
                  </div>
                ))
              )}
            </div>
            <div style={cardStyle}>
              <strong style={{ fontSize: "0.9rem" }}>Checks by crop</strong>
              {Object.entries(data.byHost)
                .sort((a, b) => b[1] - a[1])
                .map(([h, n]) => (
                  <div key={h} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginTop: 6 }}>
                    <span>
                      {hostEmoji(h)} {hostLabel(h)}
                    </span>
                    <strong>{n}</strong>
                  </div>
                ))}
            </div>
          </div>

          <h4 style={{ margin: "12px 0 6px" }}>Latest checks</h4>
          {data.latest.map((r) => (
            <div key={r._id} style={{ ...cardStyle, display: "flex", gap: 10 }}>
              {r.photoUrl ? (
                <a href={r.photoUrl} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.photoUrl} alt="Farmer photo" loading="lazy" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} />
                </a>
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 8, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", flexShrink: 0 }}>
                  {hostEmoji(r.host)}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>
                  {LEVEL_LABEL[r.healthLevel].emoji} {r.topMatch && r.healthLevel !== "unsure" && r.healthLevel !== "healthy" ? `${r.topMatch.name} (${r.topMatch.percent}%)` : LEVEL_LABEL[r.healthLevel].label}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#4b5563" }}>
                  {r.farmerName} · {hostLabel(r.host)}
                  {r.feedback ? ` · farmer said: ${r.feedback === "right" ? "👍 right" : r.feedback === "wrong" ? "👎 wrong" : "🤷 unsure"}` : ""}
                </div>
                {r.symptomTags.length > 0 && (
                  <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: 2 }}>{r.symptomTags.map(symptomLabel).join(" · ")}</div>
                )}
                <div style={{ fontSize: "0.7rem", color: "#9ca3af" }}>{formatUgandaDateTime(r.checkedAt)}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/** Super admin only: the weekly iNaturalist photo import. */
function ImportSettings({ adminId, run }: { adminId: Id<"users">; run: Run }) {
  const settings = useQuery(api.diagnosticsImport.getImportSettings, { adminId });
  const setEnabled = useMutation(api.diagnosticsImport.setImportEnabled);
  const runNow = useMutation(api.diagnosticsImport.runImportNow);
  if (settings === undefined) return <p style={{ color: "#6b7280" }}>Loading…</p>;

  return (
    <div style={cardStyle}>
      <h3 style={{ margin: "0 0 0.4rem", fontSize: "1rem" }}>Weekly photo import</h3>
      <p style={{ fontSize: "0.85rem", color: "#374151", margin: "0 0 0.6rem" }}>
        Every Monday morning, entries with a scientific name and fewer than 4 photos get up to 2 research-grade photos
        from iNaturalist. Only openly licensed photos (CC0, CC BY, CC BY-SA) are taken, each credited to its
        photographer with a link to the observation. They go to the review queue like any other contribution.
        Entries without a scientific name (such as nutrient deficiencies) are skipped.
      </p>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem", fontWeight: 600, marginBottom: 10 }}>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => {
            const enabled = e.target.checked;
            run(() => setEnabled({ adminId, enabled }), enabled ? "Weekly import switched on" : "Weekly import switched off");
          }}
          style={{ width: 18, height: 18 }}
        />
        Import photos every week
      </label>
      <button
        onClick={() => run(() => runNow({ adminId }), "Import started. New photos will appear in the review queue shortly.")}
        style={buttonStyle()}
      >
        ▶ Run now
      </button>
      <div style={{ fontSize: "0.78rem", color: "#4b5563", marginTop: 10 }}>
        {settings.lastRunAt
          ? `Last run ${formatUgandaDateTime(settings.lastRunAt)}: ${settings.lastRunSummary ?? ""}`
          : "Not run yet."}
      </div>
    </div>
  );
}
