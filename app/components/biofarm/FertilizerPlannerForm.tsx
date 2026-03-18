"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { useOfflineMutation } from "@/app/hooks/useOfflineMutation";

const CROPS: string[] = [
  "Coffee",
  "Wheat / Barley",
  "Leafy vegetables",
  "Flowers",
  "Tomatoes",
  "Maize",
  "Beans",
  "Groundnuts",
  "Peas",
  "Tea",
  "Orchard trees",
  "Rice",
  "Passion fruit",
  "Pineapple",
  "Bananas",
];

const STAGES: string[] = [
  "Seedling / Nursery",
  "Vegetative",
  "Flowering",
  "Established perennial",
];

export function FertilizerPlannerForm({
  farmerId,
  communityId,
  onCreated,
  onCancel,
}: {
  farmerId: Id<"users">;
  communityId: Id<"communities">;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const createPlan = useOfflineMutation((api as any).fertilizerPlanner.createFertilizerPlan);
  const config = useQuery((api as any).fertilizerPlanner.getFertilizerConfig, { communityId }) as any;
  const availableCrops: string[] = useMemo(() => {
    const list = (config?.cropConfigs || []).map((item: any) => String(item.crop || "")).filter(Boolean);
    return list.length > 0 ? list : CROPS;
  }, [config]);

  const [farmName, setFarmName] = useState("");
  const [crop, setCrop] = useState(availableCrops[0] || "Maize");
  const [plantingDate, setPlantingDate] = useState("");
  const [acres, setAcres] = useState("");
  const [cropStage, setCropStage] = useState("Vegetative");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (availableCrops.length > 0 && !availableCrops.includes(crop)) {
      setCrop(availableCrops[0]);
    }
  }, [availableCrops, crop]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await createPlan({
        farmerId,
        communityId,
        input: {
          farmName: farmName.trim(),
          crop,
          plantingDate,
          acres: Number(acres),
          cropStage,
        },
      });
      onCreated();
    } catch (err: any) {
      setError(err?.message || "Failed to create plan");
    }

    setSaving(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: "1px solid #dfe7df",
        borderRadius: 12,
        background: "#fff",
        padding: "0.9rem",
        display: "grid",
        gap: "0.65rem",
      }}
    >
      <h3 style={{ margin: 0, fontSize: "1rem", color: "#1b5e20" }}>Create Fertilizer Plan</h3>

      <label style={{ display: "grid", gap: 4, fontSize: "0.82rem" }}>
        Farm name
        <input
          value={farmName}
          onChange={(e) => setFarmName(e.target.value)}
          placeholder="e.g. North field"
          required
          style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ccc", fontSize: "0.9rem" }}
        />
      </label>

      <label style={{ display: "grid", gap: 4, fontSize: "0.82rem" }}>
        Crop
        <select
          value={crop}
          onChange={(e) => setCrop(e.target.value)}
          style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ccc", fontSize: "0.9rem" }}
        >
          {availableCrops.map((item: string) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: 4, fontSize: "0.82rem" }}>
        Planting date
        <input
          type="date"
          value={plantingDate}
          onChange={(e) => setPlantingDate(e.target.value)}
          required
          style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ccc", fontSize: "0.9rem" }}
        />
      </label>

      <label style={{ display: "grid", gap: 4, fontSize: "0.82rem" }}>
        Acres
        <input
          type="number"
          min="0.1"
          step="0.1"
          value={acres}
          onChange={(e) => setAcres(e.target.value)}
          required
          style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ccc", fontSize: "0.9rem" }}
        />
      </label>

      <label style={{ display: "grid", gap: 4, fontSize: "0.82rem" }}>
        Crop stage
        <select
          value={cropStage}
          onChange={(e) => setCropStage(e.target.value)}
          style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ccc", fontSize: "0.9rem" }}
        >
          {STAGES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>

      {error && (
        <p style={{ margin: 0, color: "#c62828", fontSize: "0.82rem" }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            flex: 1,
            minWidth: 140,
            border: "none",
            borderRadius: 8,
            padding: "0.65rem 0.8rem",
            background: saving ? "#9e9e9e" : "#2e7d32",
            color: "#fff",
            fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Creating..." : "Create Plan"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            border: "1px solid #ccc",
            borderRadius: 8,
            padding: "0.65rem 0.8rem",
            background: "#fff",
            color: "#333",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
