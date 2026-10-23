export type QrScanAction =
  | { kind: "link"; value: string }
  | { kind: "search"; value: string };

export function resolveQrScanAction(raw: string): QrScanAction {
  const value = (raw ?? "").trim();
  if (!value) return { kind: "search", value: "" };

  const lower = value.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("marketspace://")) {
    return { kind: "link", value };
  }

  return { kind: "search", value };
}
