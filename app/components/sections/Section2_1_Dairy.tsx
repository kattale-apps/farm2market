"use client";

import React from "react";
import { Doc } from "../../../convex/_generated/dataModel";

type SectionData = Partial<NonNullable<Doc<"agroFreshUGFarmValidations">["section2_1_dairy"]>>;

interface Props {
  data?: SectionData;
  onUpdate: (data: SectionData) => void;
  readOnly?: boolean;
}

export function Section2_1_Dairy({ data, onUpdate, readOnly }: Props) {
  const handleChange = <K extends keyof SectionData>(field: K, value: SectionData[K]) => {
    onUpdate({ ...(data ?? {}), [field]: value });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.65rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    fontSize: "0.95rem",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: "none",
  };

  const isLocalMarket = data?.marketPointOfSale === "Local Market";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h2>2.1 Dairy Farming</h2>

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
        <label style={{ fontWeight: 600 }}>Current livestock intensity</label>
        <input
          type="number"
          min="0"
          value={data?.currentLivestockIntensity ?? ""}
          onChange={(e) => handleChange("currentLivestockIntensity", e.target.value)}
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div>
        <label style={{ fontWeight: 600 }}>Number of milkers</label>
        <input
          type="number"
          min="0"
          value={data?.numberOfMilkers ?? ""}
          onChange={(e) => handleChange("numberOfMilkers", e.target.value)}
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div>
        <label style={{ fontWeight: 600 }}>Milk productivity - liters</label>
        <input
          type="text"
          value={data?.milkProductivityDaily ?? ""}
          onChange={(e) => handleChange("milkProductivityDaily", e.target.value)}
          placeholder="e.g., 20–25"
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