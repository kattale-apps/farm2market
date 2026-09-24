"use client";

import { useState, type CSSProperties } from "react";
import { inUgandaTime } from "../../utils/timeUtils";

const BRAND = "#1f7a3e";

export function IntakeAnswers({ purchase, answers }: { purchase?: any; answers?: any[] }) {
  const [open, setOpen] = useState(false);

  const purchaseEntries: Array<[string, string]> = [
    ["Product", purchase?.productName],
    ["Quantity", purchase?.purchaseQuantity],
    ["Purchase date", purchase?.purchaseDate],
    ["Parish", purchase?.parish],
    ["Crop grown", purchase?.cropGrown],
    ["Month of planting", purchase?.monthOfPlanting],
    ["Past spray dates", (purchase?.pastSprayDates || []).join(", ")],
    [
      "Next spray / visit",
      purchase?.upcomingSprayScheduleAt
        ? new Date(purchase.upcomingSprayScheduleAt).toLocaleDateString(undefined, inUgandaTime())
        : "",
    ],
  ]
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => [label, String(value)] as [string, string]);

  // Only what was actually stored counts as an answer; a blank is not one.
  const formAnswers = (answers || []).filter((answer: any) => String(answer?.value ?? "").trim() !== "");
  const total = purchaseEntries.length + formAnswers.length;

  if (total === 0) {
    return (
      <div style={{ fontSize: "0.76rem", color: "#999", marginTop: "0.25rem" }}>
        Nothing was captured at intake.
      </div>
    );
  }

  return (
    <div style={{ marginTop: "0.3rem" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          color: BRAND,
          fontWeight: 700,
          fontSize: "0.78rem",
          cursor: "pointer",
        }}
      >
        {open ? "Hide" : "Show"} intake answers ({total})
      </button>

      {open && (
        <div style={{ marginTop: "0.3rem" }}>
          {purchaseEntries.map(([label, value]) => (
            <div key={label} style={rowStyle}>
              <span style={{ flex: "0 0 45%", color: "#666" }}>{label}</span>
              <span style={{ flex: 1, fontWeight: 600, color: "#111" }}>{value}</span>
            </div>
          ))}
          {formAnswers.map((answer: any) => (
            <div key={answer.fieldId} style={rowStyle}>
              <span style={{ flex: "0 0 45%", color: "#666" }}>{answer.label}</span>
              <span
                style={{
                  flex: 1,
                  fontWeight: 600,
                  color: "#111",
                }}
              >
                {answer.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const rowStyle: CSSProperties = {
  display: "flex",
  gap: "0.6rem",
  padding: "0.2rem 0",
  borderBottom: "1px solid #f5f5f5",
  fontSize: "0.78rem",
};
