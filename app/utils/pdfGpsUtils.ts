const GPS_COORD_PATTERN = /-?\d{1,2}\.\d+\s*,\s*-?\d{1,3}\.\d+/;

export function isLikelyGpsCoordinateText(value: string): boolean {
  if (!value) return false;
  return GPS_COORD_PATTERN.test(value);
}

export function isFarmToolboxGpsField(label: string): boolean {
  return String(label || "").trim().toUpperCase() === "GPS";
}

export function isCommunityDetailsGpsRow(fieldLabel: string, value: string): boolean {
  const key = String(fieldLabel || "").toLowerCase();
  return key.includes("gps") || isLikelyGpsCoordinateText(String(value || ""));
}

export function isCommunityResponseGpsRow(input: {
  fieldType?: string;
  label?: string;
  response?: string;
}): boolean {
  const fieldType = String(input.fieldType || "").toLowerCase();
  const label = String(input.label || "").toLowerCase();
  const response = String(input.response || "");
  return fieldType === "gps" || label.includes("gps") || isLikelyGpsCoordinateText(response);
}
