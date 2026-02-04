"use client";

import React from "react";

interface Props {
  label: string;
  value?: string;
  options: string[];
  placeholder?: string;
  onChange: (value: string) => void;
}

export function DropdownWithOther({
  label,
  value,
  options,
  placeholder = "Select...",
  onChange,
}: Props) {
  const normalizedOptions = [...options, "Other"];
  const isOther = value ? !options.includes(value) : false;
  const selectValue = isOther ? "Other" : value ?? "";

  const labelStyle: React.CSSProperties = {
    fontWeight: 600,
    color: "#1f2937",
    display: "inline-block",
    alignSelf: "flex-start",
    background: "#ffffff",
    padding: "0.15rem 0.45rem",
    borderRadius: 6,
  };
  const controlStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.65rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    fontSize: "0.95rem",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <label style={labelStyle}>{label}</label>
      <select
        value={selectValue}
        onChange={(e) => {
          const next = e.target.value;
          if (next !== "Other") {
            onChange(next);
          } else if (!isOther) {
            onChange("");
          }
        }}
        style={controlStyle}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {normalizedOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>

      {selectValue === "Other" && (
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Please specify"
          style={controlStyle}
        />
      )}
    </div>
  );
}