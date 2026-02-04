"use client";

import React from "react";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { CameraCapture } from "./CameraCapture";
import { DropdownWithOther } from "./inputs/DropdownWithOther";

type SectionData = Partial<NonNullable<Doc<"agroFreshUGFarmValidations">["section1"]>>;

interface Props {
  data?: SectionData;
  onUpdate: (data: SectionData) => void;
  formId: Id<"agroFreshUGFarmValidations">;
}

export function Section1FarmerParticulars({ data, onUpdate, formId }: Props) {
  const handleChange = <K extends keyof SectionData>(field: K, value: SectionData[K]) => {
    onUpdate({ ...(data ?? {}), [field]: value });
  };

  // In a real app, you would pre-fill these from the user's profile
  const prefilledName = "Farmer Name from Profile";

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
      <h2>Section 1: Farmer & Farm Particulars</h2>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Farmer full name</label>
        <input
          type="text"
          value={data?.farmerFullName ?? ""}
          onChange={(e) => handleChange("farmerFullName", e.target.value)}
          placeholder={prefilledName}
          style={inputStyle}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Phone number</label>
        <input
          type="text"
          value={data?.phoneNumber ?? ""}
          onChange={(e) => handleChange("phoneNumber", e.target.value)}
          placeholder="e.g., 2567XXXXXXXX"
          style={inputStyle}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>National ID</label>
        <input
          type="text"
          value={data?.nationalId ?? ""}
          onChange={(e) => handleChange("nationalId", e.target.value)}
          placeholder="NIN"
          style={inputStyle}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Farm name / identifier</label>
        <input
          type="text"
          value={data?.farmName ?? ""}
          onChange={(e) => handleChange("farmName", e.target.value)}
          placeholder="e.g., Masaka Farm 1"
          style={inputStyle}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>District</label>
        <input
          type="text"
          value={data?.district ?? ""}
          onChange={(e) => handleChange("district", e.target.value)}
          placeholder="District"
          style={inputStyle}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Sub-county</label>
        <input
          type="text"
          value={data?.subCounty ?? ""}
          onChange={(e) => handleChange("subCounty", e.target.value)}
          placeholder="Sub-county"
          style={inputStyle}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Parish</label>
        <input
          type="text"
          value={data?.parish ?? ""}
          onChange={(e) => handleChange("parish", e.target.value)}
          placeholder="Parish"
          style={inputStyle}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Village</label>
        <input
          type="text"
          value={data?.village ?? ""}
          onChange={(e) => handleChange("village", e.target.value)}
          placeholder="Village"
          style={inputStyle}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Farm size</label>
        <input
          type="text"
          value={data?.farmSize ?? ""}
          onChange={(e) => handleChange("farmSize", e.target.value)}
          placeholder="e.g., 2"
          style={inputStyle}
        />
      </div>

      <DropdownWithOther
        label="Farm size unit"
        value={data?.farmSizeUnit}
        options={["Acres", "Hectares"]}
        onChange={(val) => handleChange("farmSizeUnit", val)}
      />

      <DropdownWithOther
        label="Main enterprise"
        value={data?.mainEnterprise}
        options={["Dairy", "Poultry", "Piggery", "Crops", "Mixed"]}
        onChange={(val) => handleChange("mainEnterprise", val)}
      />

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Farming experience (years)</label>
        <input
          type="text"
          value={data?.farmingExperience ?? ""}
          onChange={(e) => handleChange("farmingExperience", e.target.value)}
          placeholder="e.g., 5"
          style={inputStyle}
        />
      </div>

      <DropdownWithOther
        label="Water source"
        value={data?.waterSource}
        options={["Borehole", "River", "Lake", "Rainwater"]}
        onChange={(val) => handleChange("waterSource", val)}
      />

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Picture of the farmer (Live Capture Only)</label>
        <CameraCapture
          formId={formId}
          field="section1.farmerPhoto" // Path to update in the document
          onUploadComplete={(metadata) => {
            handleChange("farmerPhoto", metadata);
          }}
        />
        {data?.farmerPhoto && <img src={data.farmerPhoto.url} alt="Farmer" style={{width: 150, marginTop: 10}}/>}
      </div>
    </div>
  );
}