"use client";

import React from "react";
import { Doc } from "../../../convex/_generated/dataModel";

type SectionData = Partial<NonNullable<Doc<"agroFreshUGFarmValidations">["section2_4_rabbitry"]>>;

interface Props {
  data?: SectionData;
  onUpdate: (data: SectionData) => void;
  readOnly?: boolean;
}

function calculateAcres(unit?: string, length?: string, width?: string) {
  const l = Number(length || 0);
  const w = Number(width || 0);
  if (!l || !w) return "";
  const area = l * w;
  if (unit === "Feet") {
    return (area / 43560).toFixed(4);
  }
  if (unit === "Meters") {
    return (area / 4046.8564224).toFixed(4);
  }
  return "";
}

export function Section2_4_Cuniculture({ data, onUpdate, readOnly }: Props) {
  const handleChange = <K extends keyof SectionData>(field: K, value: SectionData[K]) => {
    onUpdate({ ...(data ?? {}), [field]: value });
  };

  const updateArea = (next: Partial<SectionData>) => {
    const unit = next.enterpriseAreaUnit ?? data?.enterpriseAreaUnit;
    const length = next.enterpriseAreaLength ?? data?.enterpriseAreaLength;
    const width = next.enterpriseAreaWidth ?? data?.enterpriseAreaWidth;
    const acres = calculateAcres(unit, length, width);
    onUpdate({ ...(data ?? {}), ...next, enterpriseAreaAcres: acres });
  };

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

  const productOptions = ["Hides", "Milk", "Meat"];
  const toggleProduct = (value: string) => {
    const current = data?.mainProduct ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    handleChange("mainProduct", next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h2>2.4 Rabbitry</h2>

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
        <label style={{ fontWeight: 600 }}>Enterprise area</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem" }}>
          <select
            value={data?.enterpriseAreaUnit ?? ""}
            onChange={(e) => updateArea({ enterpriseAreaUnit: e.target.value })}
            style={selectStyle}
            disabled={readOnly}
          >
            <option value="">Unit</option>
            <option value="Feet">Feet</option>
            <option value="Meters">Meters</option>
          </select>
          <input
            type="number"
            min="0"
            value={data?.enterpriseAreaLength ?? ""}
            onChange={(e) => updateArea({ enterpriseAreaLength: e.target.value })}
            placeholder="Length"
            style={inputStyle}
            disabled={readOnly}
          />
          <input
            type="number"
            min="0"
            value={data?.enterpriseAreaWidth ?? ""}
            onChange={(e) => updateArea({ enterpriseAreaWidth: e.target.value })}
            placeholder="Width"
            style={inputStyle}
            disabled={readOnly}
          />
        </div>
        <input
          type="text"
          value={data?.enterpriseAreaAcres ?? ""}
          placeholder="Calculated acres"
          style={inputStyle}
          disabled
        />
      </div>

      <div>
        <label style={{ fontWeight: 600 }}>Current Rabbitry intensity</label>
        <input
          type="number"
          min="0"
          value={data?.currentRabbitryIntensity ?? ""}
          onChange={(e) => handleChange("currentRabbitryIntensity", e.target.value)}
          placeholder="Number of does"
          style={inputStyle}
          disabled={readOnly}
        />
        <input
          type="text"
          value={data?.rabbitryIntensityOther ?? ""}
          onChange={(e) => handleChange("rabbitryIntensityOther", e.target.value)}
          placeholder="Additional notes"
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div>
        <label style={{ fontWeight: 600 }}>Main product</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem" }}>
          {productOptions.map((option) => (
            <label key={option} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <input
                type="checkbox"
                checked={(data?.mainProduct ?? []).includes(option)}
                onChange={() => toggleProduct(option)}
                disabled={readOnly}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        <input
          type="text"
          value={data?.mainProductOther ?? ""}
          onChange={(e) => handleChange("mainProductOther", e.target.value)}
          placeholder="Other products"
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
            <option value="Boat">Boat</option>
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