"use client";

import React, { useEffect } from "react";
import { Doc } from "../../../convex/_generated/dataModel";

type SectionData = Partial<NonNullable<Doc<"agroFreshUGFarmValidations">["section2_9_fruitTrees"]>>;

interface Props {
  data?: SectionData;
  onUpdate: (data: SectionData) => void;
  readOnly?: boolean;
  preloadedWaterSource?: string;
}

export function Section2_9_FruitTrees({ data, onUpdate, readOnly, preloadedWaterSource }: Props) {
  const handleChange = <K extends keyof SectionData>(field: K, value: SectionData[K]) => {
    onUpdate({ ...(data ?? {}), [field]: value });
  };

  useEffect(() => {
    if (!preloadedWaterSource) return;
    if (!data?.waterSource) {
      onUpdate({ ...(data ?? {}), waterSource: preloadedWaterSource });
    }
  }, [preloadedWaterSource, data, onUpdate]);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.65rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    fontSize: "0.95rem",
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, appearance: "none" };
  const isLocalMarket = data?.marketPointOfSale === "Local Market";

  const fruitOptions = ["Mango", "Orange", "Hass Avocado"];
  const toggleFruit = (value: string) => {
    const current = data?.type ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    handleChange("type", next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h2>2.9 Fruit Trees</h2>

      <div>
        <label style={{ fontWeight: 600 }}>System of farming</label>
        <select
          value={data?.systemOfFarming ?? ""}
          onChange={(e) => handleChange("systemOfFarming", e.target.value)}
          style={selectStyle}
          disabled={readOnly}
        >
          <option value="">Select one</option>
          <option value="Intensive">Intensive</option>
          <option value="Semi-Intensive">Semi-Intensive</option>
          <option value="Extensive">Extensive</option>
        </select>
        <input
          type="text"
          value={data?.systemOfFarmingOther ?? ""}
          onChange={(e) => handleChange("systemOfFarmingOther", e.target.value)}
          placeholder="Additional comments"
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div>
        <label style={{ fontWeight: 600 }}>Water Source</label>
        <select
          value={data?.waterSource ?? ""}
          onChange={(e) => handleChange("waterSource", e.target.value)}
          style={selectStyle}
          disabled={readOnly}
        >
          <option value="">Select water source</option>
          <option value="Borehole">Borehole</option>
          <option value="River">River</option>
          <option value="Lake">Lake</option>
          <option value="Rainwater">Rainwater</option>
          <option value="Other">Other</option>
        </select>
        <input
          type="text"
          value={data?.waterSourceOther ?? ""}
          onChange={(e) => handleChange("waterSourceOther", e.target.value)}
          placeholder="If other, specify"
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div>
        <label style={{ fontWeight: 600 }}>Manure Type</label>
        <input
          type="text"
          value={data?.manureType ?? ""}
          onChange={(e) => handleChange("manureType", e.target.value)}
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div>
        <label style={{ fontWeight: 600 }}>Enterprise area (acres)</label>
        <input
          type="number"
          min="0"
          value={data?.enterpriseAreaAcres ?? ""}
          onChange={(e) => handleChange("enterpriseAreaAcres", e.target.value)}
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div>
        <label style={{ fontWeight: 600 }}>Stock per acre</label>
        <input
          type="number"
          min="0"
          value={data?.stockPerAcre ?? ""}
          onChange={(e) => handleChange("stockPerAcre", e.target.value)}
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div>
        <label style={{ fontWeight: 600 }}>Type</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem" }}>
          {fruitOptions.map((option) => (
            <label key={option} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <input
                type="checkbox"
                checked={(data?.type ?? []).includes(option)}
                onChange={() => toggleFruit(option)}
                disabled={readOnly}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        <input
          type="text"
          value={data?.typeOther ?? ""}
          onChange={(e) => handleChange("typeOther", e.target.value)}
          placeholder="Other fruit types"
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div>
        <label style={{ fontWeight: 600 }}>Access to cold storage</label>
        <select
          value={data?.accessToColdStorage ?? ""}
          onChange={(e) => handleChange("accessToColdStorage", e.target.value)}
          style={selectStyle}
          disabled={readOnly}
        >
          <option value="">Select</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>

      <div>
        <label style={{ fontWeight: 600 }}>Market</label>
        <select
          value={data?.marketPointOfSale ?? ""}
          onChange={(e) => handleChange("marketPointOfSale", e.target.value)}
          style={selectStyle}
          disabled={readOnly}
        >
          <option value="">Select</option>
          <option value="Farm-Gate">Farm-Gate</option>
          <option value="Local Market">Local Market</option>
          <option value="Online Market">Online Market</option>
        </select>
      </div>

      <div>
        <label style={{ fontWeight: 600 }}>Transport to market</label>
        {isLocalMarket ? (
          <select
            value={data?.transportToMarket ?? ""}
            onChange={(e) => handleChange("transportToMarket", e.target.value)}
            style={selectStyle}
            disabled={readOnly}
          >
            <option value="">Select transport</option>
            <option value="Bicycle">Bicycle</option>
            <option value="Truck">Truck</option>
          </select>
        ) : (
          <input type="text" value="None" style={inputStyle} disabled />
        )}
      </div>
    </div>
  );
}