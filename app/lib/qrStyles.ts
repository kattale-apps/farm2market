/**
 * QR visual style registry (Phase 1: color/logo/frame only — the `qrcode`
 * library doesn't support true dot/corner-shape rendering).
 *
 * To add a new style: append an entry here and it appears in the style
 * picker automatically. No other code needs to change.
 */
export interface QrStylePreset {
  id: string;
  label: string;
  darkColor: string;
  lightColor: string;
}

export const QR_STYLE_PRESETS: QrStylePreset[] = [
  { id: "classic", label: "Classic Black & White", darkColor: "#000000", lightColor: "#ffffff" },
  { id: "farmGreen", label: "Farm Green", darkColor: "#1b5e20", lightColor: "#ffffff" },
  { id: "midnightBlue", label: "Midnight Blue", darkColor: "#0d1b3e", lightColor: "#ffffff" },
  { id: "sunsetOrange", label: "Sunset Orange", darkColor: "#bf360c", lightColor: "#ffffff" },
  { id: "royalPurple", label: "Royal Purple", darkColor: "#4a148c", lightColor: "#ffffff" },
  { id: "charcoalCream", label: "Charcoal on Cream", darkColor: "#212121", lightColor: "#fdf6e3" },
  { id: "oceanTeal", label: "Ocean Teal", darkColor: "#00695c", lightColor: "#ffffff" },
  { id: "crimson", label: "Crimson", darkColor: "#b71c1c", lightColor: "#ffffff" },
];

export function getQrStylePreset(id: string | undefined): QrStylePreset {
  return QR_STYLE_PRESETS.find((p) => p.id === id) ?? QR_STYLE_PRESETS[0];
}
