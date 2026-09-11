import type { CSSProperties } from "react";

export const sectionStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 12,
  padding: "1.25rem",
};

export const sectionHeading: CSSProperties = { fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.75rem 0" };

export const labelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  fontSize: "0.9rem",
  fontWeight: 600,
  color: "#333",
};

export const inputStyle: CSSProperties = {
  padding: "0.65rem 0.8rem",
  borderRadius: 8,
  border: "1px solid #ccc",
  fontSize: "0.95rem",
  fontWeight: 400,
};

export function buttonStyle(background: string): CSSProperties {
  return {
    padding: "0.6rem 1.1rem",
    background,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
  };
}
