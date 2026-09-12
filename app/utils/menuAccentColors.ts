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
