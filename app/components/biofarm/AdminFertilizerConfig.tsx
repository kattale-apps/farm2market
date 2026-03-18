"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

type ConfigState = {
  cropConfigs: Array<{
    crop: string;
    doseMl: number;
    startDay: number;
    intervalDays: number;
    seasonLengthDays: number;
    stageOverrides?: Array<{ stage: string; startDayAdjust?: number; intervalAdjust?: number }>;
  }>;
  baselineYields: Array<{ crop: string; tonsPerAcre: number }>;
  improvementFactor: number;
  bottleSizeMl: number;
  knapsacksPerAcre: number;
  waterPerKnapsackL: number;
  requiredPhotoCategories: string[];
  guaranteeThresholds: { doseTolerancePct: number; scheduleDaysLateTolerance: number };
};

export function AdminFertilizerConfig({
  userId,
  communityId,
}: {
  userId: Id<"users">;
  communityId: Id<"communities">;
}) {
  const config = useQuery((api as any).fertilizerPlanner.getFertilizerConfig, { communityId }) as ConfigState | undefined;
  const saveConfig = useMutation((api as any).fertilizerPlanner.upsertFertilizerConfig);
  const [draft, setDraft] = useState<ConfigState | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newCropName, setNewCropName] = useState("");
  const [tab, setTab] = useState<"doses" | "schedules" | "yields" | "system" | "guarantee">("doses");

  const defaultStageOverrides = [
    { stage: "Seedling / Nursery", startDayAdjust: 7, intervalAdjust: 0 },
    { stage: "Vegetative", startDayAdjust: 0, intervalAdjust: 0 },
    { stage: "Flowering", startDayAdjust: 0, intervalAdjust: -2 },
    { stage: "Established perennial", startDayAdjust: 0, intervalAdjust: 0 },
  ];

  useEffect(() => {
    if (config) {
      setDraft(config);
    }
  }, [config]);

  const canRender = useMemo(() => !!draft, [draft]);

  const persist = async () => {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    try {
      await saveConfig({ adminId: userId, communityId, config: draft });
      setMessage("Saved");
    } catch (error: any) {
      setMessage(error?.message || "Save failed");
    }
    setSaving(false);
  };

  if (!canRender || !draft) {
    return <div style={{ padding: "1rem", color: "#666" }}>Loading fertilizer config...</div>;
  }

  return (
    <div style={{ padding: "1rem" }}>
      <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
        {([
          ["doses", "Crop Doses"],
          ["schedules", "Spray Schedules"],
          ["yields", "Baseline Yields"],
          ["system", "System Constants"],
          ["guarantee", "Guarantee Thresholds"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            style={{
              border: "1px solid #d0d0d0",
              borderRadius: 999,
              background: tab === value ? "#2e7d32" : "#fff",
              color: tab === value ? "#fff" : "#333",
              padding: "0.35rem 0.6rem",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "doses" && (
        <div style={{ display: "grid", gap: "0.45rem" }}>
          {draft.cropConfigs.map((crop, idx) => (
            <div
              key={`${crop.crop}-${idx}`}
              style={{ display: "grid", gridTemplateColumns: "1fr 110px 80px", gap: "0.5rem", alignItems: "center" }}
            >
              <span style={{ fontSize: "0.85rem", color: "#333", overflowWrap: "anywhere" }}>{crop.crop}</span>
              <input
                type="number"
                value={crop.doseMl}
                onChange={(e) => {
                  const next = [...draft.cropConfigs];
                  next[idx] = { ...next[idx], doseMl: Number(e.target.value) || 0 };
                  setDraft({ ...draft, cropConfigs: next });
                }}
                style={{ padding: "0.45rem", borderRadius: 8, border: "1px solid #ccc" }}
              />
              <button
                type="button"
                onClick={() => {
                  setDraft({ ...draft, cropConfigs: draft.cropConfigs.filter((_, i) => i !== idx) });
                }}
                style={{ borderRadius: 8, border: "1px solid #ccc", padding: "0.35rem", background: "#fff", cursor: "pointer" }}
              >
                Remove
              </button>
            </div>
          ))}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: "0.5rem", alignItems: "center", marginTop: "0.4rem" }}>
            <input
              value={newCropName}
              onChange={(e) => setNewCropName(e.target.value)}
              placeholder="New crop name"
              style={{ padding: "0.45rem", borderRadius: 8, border: "1px solid #ccc" }}
            />
            <button
              type="button"
              onClick={() => {
                const candidate = newCropName.trim();
                if (!candidate) return;
                if (draft.cropConfigs.some((c) => c.crop.toLowerCase() === candidate.toLowerCase())) {
                  setMessage("Crop already exists");
                  return;
                }
                const newCrop = {
                  crop: candidate,
                  doseMl: 55,
                  startDay: 14,
                  intervalDays: 12,
                  seasonLengthDays: 120,
                  stageOverrides: draft.cropConfigs[0]?.stageOverrides || defaultStageOverrides,
                };
                setDraft({ ...draft, cropConfigs: [...draft.cropConfigs, newCrop] });
                setNewCropName("");
                setMessage(null);
              }}
              style={{ borderRadius: 8, border: "1px solid #2e7d32", background: "#2e7d32", color: "#fff", cursor: "pointer", fontWeight: 700 }}
            >
              + Add crop
            </button>
          </div>
        </div>
      )}

      {tab === "schedules" && (
        <div style={{ display: "grid", gap: "0.45rem" }}>
          {draft.cropConfigs.map((crop, idx) => (
            <div key={crop.crop} style={{ border: "1px solid #eee", borderRadius: 8, padding: "0.55rem" }}>
              <strong style={{ fontSize: "0.82rem", color: "#1a1a1a" }}>{crop.crop}</strong>
              <div style={{ marginTop: "0.4rem", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.4rem" }}>
                <input
                  type="number"
                  value={crop.startDay}
                  onChange={(e) => {
                    const next = [...draft.cropConfigs];
                    next[idx] = { ...next[idx], startDay: Number(e.target.value) || 0 };
                    setDraft({ ...draft, cropConfigs: next });
                  }}
                  placeholder="Start"
                  style={{ padding: "0.45rem", borderRadius: 8, border: "1px solid #ccc" }}
                />
                <input
                  type="number"
                  value={crop.intervalDays}
                  onChange={(e) => {
                    const next = [...draft.cropConfigs];
                    next[idx] = { ...next[idx], intervalDays: Number(e.target.value) || 1 };
                    setDraft({ ...draft, cropConfigs: next });
                  }}
                  placeholder="Interval"
                  style={{ padding: "0.45rem", borderRadius: 8, border: "1px solid #ccc" }}
                />
                <input
                  type="number"
                  value={crop.seasonLengthDays}
                  onChange={(e) => {
                    const next = [...draft.cropConfigs];
                    next[idx] = { ...next[idx], seasonLengthDays: Number(e.target.value) || 1 };
                    setDraft({ ...draft, cropConfigs: next });
                  }}
                  placeholder="Season"
                  style={{ padding: "0.45rem", borderRadius: 8, border: "1px solid #ccc" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "yields" && (
        <div style={{ display: "grid", gap: "0.45rem" }}>
          {draft.baselineYields.map((item, idx) => (
            <div key={item.crop} style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", color: "#333" }}>{item.crop}</span>
              <input
                type="number"
                step="0.1"
                value={item.tonsPerAcre}
                onChange={(e) => {
                  const next = [...draft.baselineYields];
                  next[idx] = { ...next[idx], tonsPerAcre: Number(e.target.value) || 0 };
                  setDraft({ ...draft, baselineYields: next });
                }}
                style={{ padding: "0.45rem", borderRadius: 8, border: "1px solid #ccc" }}
              />
            </div>
          ))}
          <div style={{ display: "grid", gap: 4 }}>
            <label style={{ fontSize: "0.78rem", color: "#666" }}>Improvement factor</label>
            <input
              type="number"
              step="0.01"
              value={draft.improvementFactor}
              onChange={(e) => setDraft({ ...draft, improvementFactor: Number(e.target.value) || 1 })}
              style={{ padding: "0.45rem", borderRadius: 8, border: "1px solid #ccc", maxWidth: 180 }}
            />
          </div>
        </div>
      )}

      {tab === "system" && (
        <div style={{ display: "grid", gap: "0.55rem", maxWidth: 320 }}>
          <label style={{ display: "grid", gap: 4, fontSize: "0.82rem" }}>
            Bottle size (ml)
            <input type="number" value={draft.bottleSizeMl} onChange={(e) => setDraft({ ...draft, bottleSizeMl: Number(e.target.value) || 500 })} style={{ padding: "0.45rem", borderRadius: 8, border: "1px solid #ccc" }} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.82rem" }}>
            Knapsacks per acre
            <input type="number" value={draft.knapsacksPerAcre} onChange={(e) => setDraft({ ...draft, knapsacksPerAcre: Number(e.target.value) || 10 })} style={{ padding: "0.45rem", borderRadius: 8, border: "1px solid #ccc" }} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.82rem" }}>
            Water per knapsack (L)
            <input type="number" value={draft.waterPerKnapsackL} onChange={(e) => setDraft({ ...draft, waterPerKnapsackL: Number(e.target.value) || 20 })} style={{ padding: "0.45rem", borderRadius: 8, border: "1px solid #ccc" }} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.82rem" }}>
            Required photo categories (comma-separated)
            <input
              value={draft.requiredPhotoCategories.join(", ")}
              onChange={(e) => setDraft({ ...draft, requiredPhotoCategories: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              style={{ padding: "0.45rem", borderRadius: 8, border: "1px solid #ccc" }}
            />
          </label>
        </div>
      )}

      {tab === "guarantee" && (
        <div style={{ display: "grid", gap: "0.55rem", maxWidth: 320 }}>
          <label style={{ display: "grid", gap: 4, fontSize: "0.82rem" }}>
            Dose tolerance (%)
            <input
              type="number"
              value={draft.guaranteeThresholds.doseTolerancePct}
              onChange={(e) => setDraft({ ...draft, guaranteeThresholds: { ...draft.guaranteeThresholds, doseTolerancePct: Number(e.target.value) || 0 } })}
              style={{ padding: "0.45rem", borderRadius: 8, border: "1px solid #ccc" }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.82rem" }}>
            Schedule late tolerance (days)
            <input
              type="number"
              value={draft.guaranteeThresholds.scheduleDaysLateTolerance}
              onChange={(e) => setDraft({ ...draft, guaranteeThresholds: { ...draft.guaranteeThresholds, scheduleDaysLateTolerance: Number(e.target.value) || 0 } })}
              style={{ padding: "0.45rem", borderRadius: 8, border: "1px solid #ccc" }}
            />
          </label>
        </div>
      )}

      <div style={{ marginTop: "0.9rem", display: "flex", gap: "0.55rem", alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={persist}
          disabled={saving}
          style={{
            border: "none",
            borderRadius: 8,
            padding: "0.6rem 0.85rem",
            background: saving ? "#9e9e9e" : "#2e7d32",
            color: "#fff",
            fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save Fertilizer Config"}
        </button>
        {message && <span style={{ fontSize: "0.82rem", color: message === "Saved" ? "#2e7d32" : "#c62828" }}>{message}</span>}
      </div>
    </div>
  );
}
