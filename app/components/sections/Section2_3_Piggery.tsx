"use client";

import React from "react";
import { Doc } from "../../../convex/_generated/dataModel";

type SectionData = Partial<NonNullable<Doc<"agroFreshUGFarmValidations">["section2_3_piggery"]>>;

interface Props {
  data?: SectionData;
  onUpdate: (data: SectionData) => void;
  readOnly?: boolean;
}

export function Section2_3_Piggery({ data, onUpdate, readOnly }: Props) {
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
  const selectStyle: React.CSSProperties = { ...inputStyle, appearance: "none" };
  const isLocalMarket = data?.marketPointOfSale === "Local Market";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h2>2.3 Piggery</h2>

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
        <label style={{ fontWeight: 600 }}>Current Piggery intensity (breeding sows)</label>
        <input
          type="number"
          min="0"
          value={data?.currentPiggeryIntensity ?? ""}
          onChange={(e) => handleChange("currentPiggeryIntensity", e.target.value)}
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div>
        <label style={{ fontWeight: 600 }}>Product</label>
        <input
          type="text"
          value={data?.product ?? ""}
          onChange={(e) => handleChange("product", e.target.value)}
          placeholder="e.g., Pork and bacon"
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