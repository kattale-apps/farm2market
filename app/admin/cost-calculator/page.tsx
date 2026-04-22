"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";

const BRAND = "#1565c0";
const BRAND_BG = "#e3f2fd";
const FONT = '"Montserrat", sans-serif';

type Tab = "crop" | "livestock";
type Mode = "list" | "create";

const CROP_EMOJIS: Record<string, string> = {
  maize: "🌽", beans: "🫘", banana: "🍌", coffee: "☕",
  cassava: "🌿", sorghum: "🌾", groundnuts: "🥜", sunflower: "🌻",
};
const LIVESTOCK_EMOJIS: Record<string, string> = {
  cattle: "🐄", broilers: "🐔", pigs: "🐷", fish: "🐟",
  goats: "🐐", layers: "🥚", ducks: "🦆", rabbits: "🐇",
};

function formatUGX(n: number) {
  return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(n);
}

// ─── STAGE ITEM EDITOR ──────────────────────────────────────────────────────
function StageItemEditor({ items, onChange }: {
  items: { item: string; unitCost: number; quantity: number; unit?: string }[];
  onChange: (items: { item: string; unitCost: number; quantity: number; unit?: string }[]) => void;
}) {
  const addItem = () => onChange([...items, { item: "", unitCost: 0, quantity: 1, unit: "" }]);
  const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: any) =>
    onChange(items.map((it, idx) => idx === i ? { ...it, [field]: value } : it));

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: "0.4rem", marginBottom: "0.4rem", alignItems: "center" }}>
          <input placeholder="Item name" value={item.item} onChange={(e) => updateItem(i, "item", e.target.value)}
            style={{ padding: "0.4rem 0.6rem", border: "1px solid #ddd", borderRadius: 6, fontFamily: FONT, fontSize: "0.8rem" }} />
          <input type="number" placeholder="Unit cost" value={item.unitCost} onChange={(e) => updateItem(i, "unitCost", Number(e.target.value))}
            style={{ padding: "0.4rem 0.6rem", border: "1px solid #ddd", borderRadius: 6, fontFamily: FONT, fontSize: "0.8rem" }} />
          <input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))}
            style={{ padding: "0.4rem 0.6rem", border: "1px solid #ddd", borderRadius: 6, fontFamily: FONT, fontSize: "0.8rem" }} />
          <input placeholder="bags…" value={item.unit ?? ""} onChange={(e) => updateItem(i, "unit", e.target.value)}
            style={{ padding: "0.4rem 0.6rem", border: "1px solid #ddd", borderRadius: 6, fontFamily: FONT, fontSize: "0.8rem" }} />
          <button onClick={() => removeItem(i)} style={{ background: "#ffebee", border: "none", borderRadius: 6, padding: "0.4rem 0.5rem", cursor: "pointer", color: "#c62828" }}>✕</button>
        </div>
      ))}
      <button onClick={addItem} style={{ padding: "0.35rem 0.8rem", background: BRAND_BG, border: "1px solid #90caf9", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem", color: BRAND, fontFamily: FONT }}>
        + Add Item
      </button>
    </div>
  );
}

// ─── STAGE EDITOR ───────────────────────────────────────────────────────────
type StageType = {
  stageName: string; emoji?: string; weekFromStart: number;
  isHarvestStage?: boolean; isSaleStage?: boolean;
  costItems: { item: string; unitCost: number; quantity: number; unit?: string }[];
};

function StageEditor({ stages, onChange, isLivestock }: { stages: StageType[]; onChange: (s: StageType[]) => void; isLivestock: boolean }) {
  const addStage = () => onChange([...stages, { stageName: "", emoji: "", weekFromStart: 0, costItems: [] }]);
  const removeStage = (i: number) => onChange(stages.filter((_, idx) => idx !== i));
  const updateStage = (i: number, field: string, value: any) =>
    onChange(stages.map((s, idx) => idx === i ? { ...s, [field]: value } : s));

  return (
    <div>
      {stages.map((stage, i) => (
        <div key={i} style={{ border: "1px solid #e0e0e0", borderRadius: 10, padding: "1rem", marginBottom: "0.75rem", background: "#f9fafb" }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 2fr 1fr auto auto", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
            <input placeholder="🌱" value={stage.emoji ?? ""} onChange={(e) => updateStage(i, "emoji", e.target.value)}
              style={{ width: 40, textAlign: "center", padding: "0.4rem", border: "1px solid #ddd", borderRadius: 6, fontFamily: FONT }} />
            <input placeholder="Stage name" value={stage.stageName} onChange={(e) => updateStage(i, "stageName", e.target.value)}
              style={{ padding: "0.4rem 0.6rem", border: "1px solid #ddd", borderRadius: 6, fontFamily: FONT, fontSize: "0.85rem" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.75rem", color: "#666" }}>Wk</span>
              <input type="number" value={stage.weekFromStart} onChange={(e) => updateStage(i, "weekFromStart", Number(e.target.value))}
                style={{ width: 50, padding: "0.4rem", border: "1px solid #ddd", borderRadius: 6, fontFamily: FONT, fontSize: "0.8rem" }} />
            </div>
            <label style={{ fontSize: "0.75rem", color: "#555", display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer" }}>
              <input type="checkbox" checked={isLivestock ? !!stage.isSaleStage : !!stage.isHarvestStage}
                onChange={(e) => updateStage(i, isLivestock ? "isSaleStage" : "isHarvestStage", e.target.checked)} />
              {isLivestock ? "Sale?" : "Harvest?"}
            </label>
            <button onClick={() => removeStage(i)} style={{ background: "#ffebee", border: "none", borderRadius: 6, padding: "0.3rem 0.5rem", cursor: "pointer", color: "#c62828" }}>🗑</button>
          </div>
          <StageItemEditor items={stage.costItems} onChange={(items) => updateStage(i, "costItems", items)} />
        </div>
      ))}
      <button onClick={addStage} style={{ padding: "0.5rem 1rem", background: "#e8f5e9", border: "1.5px dashed #66bb6a", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", color: "#2e7d32", fontFamily: FONT }}>
        + Add Stage
      </button>
    </div>
  );
}

// ─── CALCULATE MODAL ─────────────────────────────────────────────────────────
function CalculateModal({ template, type, onClose }: { template: any; type: Tab; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const scaleLabel = type === "crop" ? "acres" : "head count";

  const stageCosts = (template.stages ?? []).map((stage: any) => {
    const baseSize = template.acreSize ?? 1;
    const scaleRatio = baseSize ? scale / baseSize : scale;
    const stageCost = stage.costItems.reduce((sum: number, item: any) => sum + item.unitCost * item.quantity * scaleRatio, 0);
    return { stageName: stage.stageName, emoji: stage.emoji, weekFromStart: stage.weekFromStart, stageCost: Math.round(stageCost) };
  });
  const totalCost = stageCosts.reduce((s: number, st: any) => s + st.stageCost, 0);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "1.5rem", maxWidth: 520, width: "90%", maxHeight: "85vh", overflowY: "auto", fontFamily: FONT }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>{template.emoji ?? "💰"} Cost Calculator</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
        </div>
        <p style={{ margin: "0 0 0.75rem", color: "#555", fontSize: "0.88rem" }}>
          {type === "crop" ? template.cropType : template.livestockType} · Base: {template.acreSize ?? 1} {scaleLabel}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>Your {scaleLabel}:</label>
          <input type="number" min={0.1} step={0.1} value={scale} onChange={(e) => setScale(Number(e.target.value))}
            style={{ width: 80, padding: "0.5rem", border: "1.5px solid " + BRAND, borderRadius: 8, fontFamily: FONT, fontSize: "0.9rem", textAlign: "center" }} />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          {stageCosts.map((st: any, i: number) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0.75rem", marginBottom: "0.4rem", background: "#f9fafb", borderRadius: 8, fontSize: "0.88rem" }}>
              <span>{st.emoji} {st.stageName} <span style={{ color: "#aaa", fontSize: "0.75rem" }}>(Wk {st.weekFromStart})</span></span>
              <strong>{formatUGX(st.stageCost)}</strong>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0.85rem 1rem", background: BRAND_BG, borderRadius: 10, fontWeight: 700, fontSize: "1rem" }}>
          <span>💰 Total Estimated Cost</span>
          <span style={{ color: BRAND }}>{formatUGX(totalCost)}</span>
        </div>
        <p style={{ margin: "0.75rem 0 0", fontSize: "0.75rem", color: "#888", textAlign: "center" }}>Estimates are based on template cost items. Actual costs may vary.</p>
      </div>
    </div>
  );
}

// ─── TEMPLATE CARD ───────────────────────────────────────────────────────────
function TemplateCard({ template, type, onCalculate, onDelete }: { template: any; type: Tab; onCalculate: () => void; onDelete: () => void }) {
  const name = type === "crop" ? template.cropType : template.livestockType;
  const totalBase = (template.stages ?? []).reduce((sum: number, stage: any) =>
    sum + stage.costItems.reduce((s: number, item: any) => s + item.unitCost * item.quantity, 0), 0);

  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "1rem 1.25rem", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
        <span style={{ fontSize: "2rem" }}>{template.emoji ?? "🌾"}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", textTransform: "capitalize" }}>{name}</div>
          <div style={{ fontSize: "0.75rem", color: "#888" }}>
            {template.stages?.length ?? 0} stages · Base {template.acreSize ?? 1} {type === "crop" ? "acres" : "head"} · <span style={{ color: BRAND }}>{template.ownerType}</span>
          </div>
          <div style={{ fontSize: "0.78rem", color: "#555", marginTop: "0.2rem" }}>Base cost: <strong>{formatUGX(totalBase)}</strong></div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button onClick={onCalculate} style={{ padding: "0.4rem 0.75rem", background: BRAND_BG, border: "1px solid #90caf9", borderRadius: 6, fontSize: "0.78rem", cursor: "pointer", color: BRAND, fontFamily: FONT, fontWeight: 600 }}>
          🧮 Calculate
        </button>
        <button onClick={onDelete} style={{ padding: "0.4rem 0.75rem", background: "#ffebee", border: "1px solid #ef9a9a", borderRadius: 6, fontSize: "0.78rem", cursor: "pointer", color: "#c62828", fontFamily: FONT }}>
          Archive
        </button>
      </div>
    </div>
  );
}

// ─── CREATE TEMPLATE FORM ────────────────────────────────────────────────────
function CreateTemplateForm({ userId, type, onDone }: { userId: Id<"users">; type: Tab; onDone: () => void }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(type === "crop" ? "🌽" : "🐄");
  const [acreSize, setAcreSize] = useState(1);
  const [stages, setStages] = useState<StageType[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCrop = useMutation((api as any).farmCostTemplates.createCropCostTemplate);
  const createLivestock = useMutation((api as any).farmCostTemplates.createLivestockCostTemplate);

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    if (stages.length === 0) { setError("Add at least one stage"); return; }
    setSaving(true);
    setError(null);
    try {
      if (type === "crop") {
        await createCrop({ ownerId: userId, ownerType: "system", cropType: name, emoji, acreSize, stages, currency: "UGX" });
      } else {
        await createLivestock({ ownerId: userId, ownerType: "system", livestockType: name, emoji, acreSize, stages, currency: "UGX" });
      }
      onDone();
    } catch (e: any) {
      setError(e.message ?? "Failed to save");
    }
    setSaving(false);
  };

  const emojiMap = type === "crop" ? CROP_EMOJIS : LIVESTOCK_EMOJIS;

  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "1.25rem", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
      <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 700 }}>
        {type === "crop" ? "🌾 New Crop Cost Template" : "🐄 New Livestock Cost Template"}
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: "0.75rem", marginBottom: "1rem", alignItems: "end" }}>
        <div>
          <div style={{ fontSize: "0.78rem", color: "#666", marginBottom: "0.25rem" }}>Emoji</div>
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)}
            style={{ width: 48, textAlign: "center", padding: "0.5rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "1.2rem" }} />
        </div>
        <div>
          <div style={{ fontSize: "0.78rem", color: "#666", marginBottom: "0.25rem" }}>{type === "crop" ? "Crop type (e.g. maize)" : "Livestock type (e.g. broilers)"}</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter name…"
            style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.9rem", boxSizing: "border-box" }} />
        </div>
        <div>
          <div style={{ fontSize: "0.78rem", color: "#666", marginBottom: "0.25rem" }}>{type === "crop" ? "Base acres" : "Base head count"}</div>
          <input type="number" min={0.1} step={0.1} value={acreSize} onChange={(e) => setAcreSize(Number(e.target.value))}
            style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #ddd", borderRadius: 8, fontFamily: FONT, fontSize: "0.9rem", boxSizing: "border-box" }} />
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
        {Object.entries(emojiMap).map(([label, em]) => (
          <button key={label} onClick={() => { setEmoji(em); if (!name) setName(label); }}
            style={{ padding: "0.3rem 0.6rem", background: emoji === em ? BRAND_BG : "#f5f5f5", border: `1px solid ${emoji === em ? "#90caf9" : "#e0e0e0"}`, borderRadius: 6, cursor: "pointer", fontSize: "0.78rem", fontFamily: FONT }}>
            {em} {label}
          </button>
        ))}
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "0.5rem" }}>Stages &amp; Cost Items</div>
        <StageEditor stages={stages} onChange={setStages} isLivestock={type === "livestock"} />
      </div>
      {error && <p style={{ color: "#c62828", fontSize: "0.85rem", marginBottom: "0.75rem" }}>⚠️ {error}</p>}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: "0.75rem 1.5rem", background: BRAND, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: "0.9rem", cursor: saving ? "not-allowed" : "pointer", fontFamily: FONT, opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : "💾 Save Template"}
        </button>
        <button onClick={onDone}
          style={{ padding: "0.75rem 1rem", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 10, fontFamily: FONT, cursor: "pointer", fontSize: "0.9rem" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function CostCalculatorPage() {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("crop");
  const [mode, setMode] = useState<Mode>("list");
  const [calcTarget, setCalcTarget] = useState<any | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pilot_user");
      if (stored) setUserId(JSON.parse(stored).userId as Id<"users">);
    } catch {}
  }, []);

  const cropTemplates = useQuery(
    (api as any).farmCostTemplates.listCropCostTemplates,
    userId ? { requestingUserId: userId } : "skip"
  ) as any[] | undefined;

  const livestockTemplates = useQuery(
    (api as any).farmCostTemplates.listLivestockCostTemplates,
    userId ? { requestingUserId: userId } : "skip"
  ) as any[] | undefined;

  const archiveCrop = useMutation((api as any).farmCostTemplates.archiveCropCostTemplate);
  const archiveLivestock = useMutation((api as any).farmCostTemplates.archiveLivestockCostTemplate);

  const templates = activeTab === "crop" ? (cropTemplates ?? []) : (livestockTemplates ?? []);
  const loading = activeTab === "crop" ? cropTemplates === undefined : livestockTemplates === undefined;

  const tabs: { id: Tab; emoji: string; label: string }[] = [
    { id: "crop", emoji: "🌾", label: "Crop Costs" },
    { id: "livestock", emoji: "🐄", label: "Livestock Costs" },
  ];

  return (
    <div style={{ fontFamily: FONT, minHeight: "100vh", background: "#f4f6f9", paddingBottom: 80 }}>
      <div style={{ background: BRAND, padding: "clamp(1rem,4vw,1.5rem)", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
          <div>
            <h1 style={{ margin: 0, fontSize: "clamp(1.1rem,4vw,1.4rem)", fontWeight: 700 }}>💰 Cost Calculator Engine</h1>
            <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.85 }}>Define templates · Calculate costs · Guide farmers</p>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #e0e0e0" }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setMode("list"); }}
            style={{ flex: 1, padding: "0.75rem 0.5rem", border: "none", borderBottom: activeTab === t.id ? `3px solid ${BRAND}` : "3px solid transparent", background: "transparent", cursor: "pointer", fontFamily: FONT, fontSize: "0.82rem", fontWeight: activeTab === t.id ? 700 : 400, color: activeTab === t.id ? BRAND : "#666" }}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>
      <div style={{ padding: "clamp(1rem,4vw,1.5rem)", maxWidth: 800, margin: "0 auto" }}>
        {mode === "list" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                {activeTab === "crop" ? "🌾" : "🐄"} {activeTab === "crop" ? "Crop" : "Livestock"} Templates
                {!loading && <span style={{ fontSize: "0.78rem", color: "#888", fontWeight: 400, marginLeft: "0.5rem" }}>({templates.length})</span>}
              </h2>
              <button onClick={() => setMode("create")}
                style={{ padding: "0.5rem 1rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", fontFamily: FONT }}>
                ➕ New Template
              </button>
            </div>
            {loading ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Loading templates…</div>
            ) : templates.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem 1.5rem", background: "#fff", borderRadius: 12 }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>{activeTab === "crop" ? "🌾" : "🐄"}</div>
                <p style={{ color: "#888" }}>No templates yet. Create the first one!</p>
                <button onClick={() => setMode("create")} style={{ padding: "0.6rem 1.25rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: FONT, fontWeight: 600 }}>
                  ➕ Create Template
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {templates.map((tpl) => (
                  <TemplateCard key={tpl._id} template={tpl} type={activeTab}
                    onCalculate={() => setCalcTarget(tpl)}
                    onDelete={async () => {
                      if (!userId || !confirm("Archive this template?")) return;
                      if (activeTab === "crop") await archiveCrop({ templateId: tpl._id, requestingUserId: userId });
                      else await archiveLivestock({ templateId: tpl._id, requestingUserId: userId });
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
        {mode === "create" && userId && (
          <CreateTemplateForm userId={userId} type={activeTab} onDone={() => setMode("list")} />
        )}
      </div>
      {calcTarget && <CalculateModal template={calcTarget} type={activeTab} onClose={() => setCalcTarget(null)} />}
    </div>
  );
}

