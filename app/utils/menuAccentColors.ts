// A distinct accent color per "More" menu item so each entry is easy to
// tell apart at a glance, cycling through the list by index. Red is
// deliberately excluded — it's reserved for the profile menu's Logout
// button so no other item is ever mistaken for a destructive action.
export const MENU_ACCENT_COLORS: string[] = [
  "#1976d2", // blue
  "#f57f17", // amber
  "#7b1fa2", // purple
  "#00838f", // teal
  "#2e7d32", // green
  "#5d4037", // brown
  "#455a64", // slate
  "#ad1457", // magenta
];

export function menuAccentColor(index: number): string {
  return MENU_ACCENT_COLORS[index % MENU_ACCENT_COLORS.length];
}

// The farmer's "More" menu runs the same rainbow sequence the community CRM
// sections use, so a farmer being shown the app can be pointed at "the orange
// one" rather than a label they may not read easily. Red stays out for the
// same reason as above: it belongs to Logout alone.
export const MENU_RAINBOW_COLORS: string[] = [
  "#1d4ed8", // blue
  "#ea580c", // orange
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#15803d", // green
  "#ca8a04", // yellow
  "#4f46e5", // indigo
  "#be185d", // magenta
];

export function menuRainbowColor(index: number): string {
  return MENU_RAINBOW_COLORS[index % MENU_RAINBOW_COLORS.length];
}
