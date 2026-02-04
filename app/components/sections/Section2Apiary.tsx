"use client";

import React from "react";

interface Props {
  data?: {
    present?: boolean;
    hiveCount?: string;
    honeyProduction?: string;
    productionUnit?: string;
  };
  onUpdate: (data: Props["data"]) => void;
}

export function Section2Apiary({ data, onUpdate }: Props) {
  const handleChange = (field: keyof NonNullable<Props["data"]>, value: any) => {
    onUpdate({ ...(data ?? {}), [field]: value });
  };

  const fieldWrapperStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
  };
  const labelStyle: React.CSSProperties = {
    fontWeight: 600,
    color: "#1f2937",
    display: "inline-block",
    alignSelf: "flex-start",
    background: "#ffffff",
    padding: "0.15rem 0.45rem",
    borderRadius: 6,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.65rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    fontSize: "0.95rem",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h2>2.5 Apiary (Beekeeping)</h2>

      <label style={{ fontWeight: 600, color: "#1f2937" }}>
        <input
          type="checkbox"
          checked={!!data?.present}
          onChange={(e) => handleChange("present", e.target.checked)}
          style={{ marginRight: "0.5rem" }}
        />
        This enterprise is present
      </label>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Hive count</label>
        <input
          type="text"
          value={data?.hiveCount ?? ""}
          onChange={(e) => handleChange("hiveCount", e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Honey production</label>
        <input
          type="text"
          value={data?.honeyProduction ?? ""}
          onChange={(e) => handleChange("honeyProduction", e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Production unit</label>
        <input
          type="text"
          value={data?.productionUnit ?? ""}
          onChange={(e) => handleChange("productionUnit", e.target.value)}
          style={inputStyle}
        />
      </div>
    </div>
  );
}