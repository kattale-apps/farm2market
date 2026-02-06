"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { CameraCapture } from "./CameraCapture";

type SectionData = Partial<NonNullable<Doc<"agroFreshUGFarmValidations">["section1"]>>;

interface PrefillData {
  phoneNumber?: string;
  emailAddress?: string;
  county?: string;
  districtSubCounty?: string;
  village?: string;
  waterSource?: string;
  farmerFullName?: string;
  farmName?: string;
}

interface Props {
  data?: SectionData;
  onUpdate: (data: SectionData) => void;
  formId: Id<"agroFreshUGFarmValidations">;
  prefill?: PrefillData;
  readOnly?: boolean;
}

export function Section1FarmerParticulars({ data, onUpdate, formId, prefill, readOnly }: Props) {
  const handleChange = <K extends keyof SectionData>(field: K, value: SectionData[K]) => {
    onUpdate({ ...(data ?? {}), [field]: value });
  };

  useEffect(() => {
    if (!prefill) return;
    const next: SectionData = { ...(data ?? {}) };
    let changed = false;

    if (!next.farmerFullName && prefill.farmerFullName) {
      next.farmerFullName = prefill.farmerFullName;
      changed = true;
    }
    if (!next.farmName && prefill.farmName) {
      next.farmName = prefill.farmName;
      changed = true;
    }
    if (!next.phoneNumber && prefill.phoneNumber) {
      next.phoneNumber = prefill.phoneNumber;
      changed = true;
    }
    if (!next.emailAddress && prefill.emailAddress) {
      next.emailAddress = prefill.emailAddress;
      changed = true;
    }
    if (!next.county && prefill.county) {
      next.county = prefill.county;
      changed = true;
    }
    if (!next.districtSubCounty && prefill.districtSubCounty) {
      next.districtSubCounty = prefill.districtSubCounty;
      changed = true;
    }
    if (!next.village && prefill.village) {
      next.village = prefill.village;
      changed = true;
    }
    if (!next.waterSource && prefill.waterSource) {
      next.waterSource = prefill.waterSource;
      changed = true;
    }

    if (changed) {
      onUpdate(next);
    }
  }, [prefill, data, onUpdate]);

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

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: "none",
  };

  const helperStyle: React.CSSProperties = {
    fontSize: "0.85rem",
    color: "#6b7280",
  };

  const enterpriseOptions = [
    "Dairy Farming",
    "Poultry Farming",
    "Piggery",
    "Rabbitry",
    "Apiary",
    "Aquaculture",
    "Banana Plantation",
    "Maize",
    "Fruit Trees",
    "Planted Forest",
  ];

  const toggleEnterprise = (value: string) => {
    const current = data?.mainEnterprises ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    handleChange("mainEnterprises", next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h2>Section 1: Farmer Registration Information</h2>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Full Name *</label>
        <input
          type="text"
          id="section1-farmerFullName"
          value={data?.farmerFullName ?? ""}
          onChange={(e) => handleChange("farmerFullName", e.target.value)}
          placeholder="Full Name"
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Farm Name *</label>
        <input
          type="text"
          id="section1-farmName"
          value={data?.farmName ?? ""}
          onChange={(e) => handleChange("farmName", e.target.value)}
          placeholder="Farm Name"
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Phone Number *</label>
        <input
          type="text"
          id="section1-phoneNumber"
          value={data?.phoneNumber ?? ""}
          onChange={(e) => handleChange("phoneNumber", e.target.value)}
          placeholder="e.g., 2567XXXXXXXX"
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Email Address *</label>
        <input
          type="email"
          id="section1-emailAddress"
          value={data?.emailAddress ?? ""}
          onChange={(e) => handleChange("emailAddress", e.target.value)}
          placeholder="e.g., farmer@example.com"
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <h3 style={{ marginTop: "0.5rem" }}>Location of farm</h3>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>County *</label>
        <input
          type="text"
          id="section1-county"
          value={data?.county ?? ""}
          onChange={(e) => handleChange("county", e.target.value)}
          placeholder="County"
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>District/Sub-county *</label>
        <input
          type="text"
          id="section1-districtSubCounty"
          value={data?.districtSubCounty ?? ""}
          onChange={(e) => handleChange("districtSubCounty", e.target.value)}
          placeholder="District/Sub-county"
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Village *</label>
        <input
          type="text"
          id="section1-village"
          value={data?.village ?? ""}
          onChange={(e) => handleChange("village", e.target.value)}
          placeholder="Village"
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <h3 style={{ marginTop: "0.5rem" }}>Farm Specifics</h3>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Farm Size (acres) *</label>
        <input
          type="number"
          min="0"
          id="section1-farmSizeAcres"
          value={data?.farmSizeAcres ?? ""}
          onChange={(e) => handleChange("farmSizeAcres", e.target.value)}
          placeholder="In acres"
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Total area under agricultural production (acres) *</label>
        <input
          type="number"
          min="0"
          id="section1-totalAreaAgProductionAcres"
          value={data?.totalAreaAgProductionAcres ?? ""}
          onChange={(e) => handleChange("totalAreaAgProductionAcres", e.target.value)}
          placeholder="In acres"
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Total area under planted forest (acres) *</label>
        <input
          type="number"
          min="0"
          id="section1-totalAreaPlantedForestAcres"
          value={data?.totalAreaPlantedForestAcres ?? ""}
          onChange={(e) => handleChange("totalAreaPlantedForestAcres", e.target.value)}
          placeholder="In acres"
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>System of farming *</label>
        <select
          id="section1-systemOfFarming"
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
        <span style={helperStyle}>If needed, add details below.</span>
        <input
          type="text"
          value={data?.systemOfFarmingOther ?? ""}
          onChange={(e) => handleChange("systemOfFarmingOther", e.target.value)}
          placeholder="Additional comments"
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Number of main enterprises (Select all applicable)</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.5rem" }}>
          {enterpriseOptions.map((option) => (
            <label key={option} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <input
                type="checkbox"
                checked={(data?.mainEnterprises ?? []).includes(option)}
                onChange={() => toggleEnterprise(option)}
                disabled={readOnly}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Other commercial activity</label>
        <input
          type="text"
          value={data?.otherCommercialActivity ?? ""}
          onChange={(e) => handleChange("otherCommercialActivity", e.target.value)}
          placeholder="Other commercial activity"
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Years of experience *</label>
        <input
          type="number"
          min="0"
          id="section1-yearsOfExperience"
          value={data?.yearsOfExperience ?? ""}
          onChange={(e) => handleChange("yearsOfExperience", e.target.value)}
          placeholder="Years"
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Source of water *</label>
        <select
          id="section1-waterSource"
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

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>Certifications (text)</label>
        <input
          type="text"
          value={data?.certifications ?? ""}
          onChange={(e) => handleChange("certifications", e.target.value)}
          placeholder="Certifications"
          style={inputStyle}
          disabled={readOnly}
        />
      </div>

      <div style={fieldWrapperStyle}>
        <label style={labelStyle}>📸 Verified timestamped photo (Camera only)</label>
        <CameraCapture
          formId={formId}
          field="section1.verificationPhoto"
          onUploadComplete={(metadata) => {
            handleChange("verificationPhoto", metadata);
          }}
        />
        {data?.verificationPhoto?.url && (
          <div style={{ width: 180, marginTop: 10 }}>
            <Image
              src={data.verificationPhoto.url}
              alt="Verification"
              width={360}
              height={240}
              style={{ width: "100%", height: "auto", borderRadius: 8 }}
              unoptimized
            />
          </div>
        )}
      </div>
    </div>
  );
}