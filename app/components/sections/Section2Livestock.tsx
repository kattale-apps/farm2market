"use client";

import React from "react";

interface Props {
  title: string;
  data?: {
    present?: boolean;
    breed?: string;
    animalCount?: string;
    managementSystem?: string;
    healthStatus?: string;
    productionOutput?: string;
  };
  onUpdate: (data: Props["data"]) => void;
}

export function Section2Livestock({ title, data, onUpdate }: Props) {
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
      <h2>{title}</h2>

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
        <label style={labelStyle}>Breed</label>
        <input
          type="text"
          value={data?.breed ?? ""}
          onChange={(e) => handleChange("breed", e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Animal count</label>
        <input
          type="text"
          value={data?.animalCount ?? ""}
          onChange={(e) => handleChange("animalCount", e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Management system</label>
        <input
          type="text"
          value={data?.managementSystem ?? ""}
          onChange={(e) => handleChange("managementSystem", e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Health status</label>
        <input
          type="text"
          value={data?.healthStatus ?? ""}
          onChange={(e) => handleChange("healthStatus", e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Production output</label>
        <input
          type="text"
          value={data?.productionOutput ?? ""}
          onChange={(e) => handleChange("productionOutput", e.target.value)}
          style={inputStyle}
        />
      </div>
    </div>
  );
}