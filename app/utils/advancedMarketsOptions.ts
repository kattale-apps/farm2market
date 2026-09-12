export const GOODS_CATEGORIES: Array<{ value: "crop" | "livestock"; label: string }> = [
  { value: "crop", label: "🌾 Crop" },
  { value: "livestock", label: "🐄 Livestock" },
];

// Common farm extension services a community admin can offer as a
// milestoned, pre-funded "service" on Advanced Markets. Admins can also
// type a custom service name not in this list.
export const FARM_SERVICE_OPTIONS: string[] = [
  "Land Preparation",
  "Planting",
  "Weeding",
  "Spraying Fertilizer",
  "Spraying Pesticides",
  "Irrigation Setup",
  "Pruning",
  "Harvesting",
];
