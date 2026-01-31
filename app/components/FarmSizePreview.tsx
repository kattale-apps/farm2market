"use client";
import React from "react";

type Unit = "ft" | "m" | "omwigo" | "emiigo";

function toAcresFromInput(input: {
  unit?: Unit;
  length?: number;
  width?: number;
  omwigo?: number;
  emiigo?: number;
}): number | null {
  const OMWIGO_SQ_FT = 10 * 100; // 1000 sq ft
  const ACRES_PER_SQ_FT = 1 / 43560;

  if (input.omwigo !== undefined && !isNaN(input.omwigo) && input.omwigo > 0) {
    return input.omwigo * OMWIGO_SQ_FT * ACRES_PER_SQ_FT;
  }

  if (input.emiigo !== undefined && !isNaN(input.emiigo) && input.emiigo > 0) {
    return input.emiigo * OMWIGO_SQ_FT * ACRES_PER_SQ_FT;
  }

  if (
    input.length !== undefined &&
    input.width !== undefined &&
    !isNaN(input.length) &&
    !isNaN(input.width) &&
    input.length > 0 &&
    input.width > 0 &&
    input.unit
  ) {
    let sqFt = 0;
    if (input.unit === "ft") {
      sqFt = input.length * input.width;
    } else if (input.unit === "m") {
      const lengthFt = input.length * 3.28084;
      const widthFt = input.width * 3.28084;
      sqFt = lengthFt * widthFt;
    }
    return sqFt * ACRES_PER_SQ_FT;
  }

  return null;
}

export default function FarmSizePreview({
  unit,
  length,
  width,
  omwigo,
  emiigo,
}: {
  unit: Unit;
  length?: string | number;
  width?: string | number;
  omwigo?: string | number;
  emiigo?: string | number;
}) {
  const parsed = {
    unit,
    length: length !== undefined && length !== "" ? Number(length) : undefined,
    width: width !== undefined && width !== "" ? Number(width) : undefined,
    omwigo: omwigo !== undefined && omwigo !== "" ? Number(omwigo) : undefined,
    emiigo: emiigo !== undefined && emiigo !== "" ? Number(emiigo) : undefined,
  };

  const acres = toAcresFromInput(parsed);
  if (acres === null) return null;

  return (
    <div style={{ marginTop: 8, color: "#444", fontSize: 13 }}>
      <strong>Equivalent in acres:</strong> ≈ {acres.toLocaleString(undefined, { maximumFractionDigits: 2 })} acres
    </div>
  );
}
