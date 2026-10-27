/**
 * What a listing sells: a crop or an animal. Plain shared rules (no Convex
 * server imports), used by the listing form, convex/listings.ts and the tests.
 *
 * Crops come from the admin's produce options. Animals come from this list,
 * plus any admin produce option in an animal category (livestock, poultry,
 * fish). An animal sells per animal (a packaged listing whose unit is a
 * "head") or by weight (lots: animals of about N kg each).
 */

export type ProduceKind = "crop" | "animal";

export const ANIMAL_OPTIONS = [
  { value: "Cattle", label: "Cattle (Cows)", icon: "🐮" },
  { value: "Goat", label: "Goat", icon: "🐐" },
  { value: "Sheep", label: "Sheep", icon: "🐑" },
  { value: "Pig", label: "Pig", icon: "🐷" },
  { value: "Chicken", label: "Chicken", icon: "🐔" },
  { value: "Duck", label: "Duck", icon: "🦆" },
  { value: "Turkey", label: "Turkey", icon: "🦃" },
  { value: "Rabbit", label: "Rabbit", icon: "🐇" },
  { value: "Fish", label: "Fish", icon: "🐟" },
] as const;

/** The unit of an animal sold per animal: "3 heads", "UGX 250,000 per head". */
export const ANIMAL_UNIT = "head";

const ANIMAL_CATEGORY = /livestock|animal|poultry|fish/i;

/** Whether an admin produce option is an animal (by its category). */
export function isAnimalOption(option: { category?: string }): boolean {
  return ANIMAL_CATEGORY.test(option.category ?? "");
}
