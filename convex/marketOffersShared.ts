/**
 * Buying offers - plain shared constants (no Convex server imports).
 *
 * Processors and exporters post buying prices for crops they process or
 * export (coffee first); vendors post buying offers for foodstuffs. Farmers
 * see them by district and book a delivery while the price is up.
 *
 * Like MarketSpace posts, a price ends by itself: the poster picks how long it
 * stays up (a day, three days or a week) and posts it again to keep it up, so
 * farmers never travel on an old price.
 */

/** How long a posted price stays up before it ends by itself. */
export const OFFER_DAY_CHOICES = [1, 3, 7];
export const DEFAULT_OFFER_DAYS = 3;
/** The longest a price can stay up in one go. */
export const OFFER_VALID_DAYS = 7;

/** Days a price has left, counting today (1 on its last day, 0 once it ended). */
export function offerDaysLeft(today: string, validUntil: string): number {
  if (validUntil < today) return 0;
  const ms = Date.parse(`${validUntil}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}
/** Farmers can book a delivery at most this many days ahead. */
export const MAX_BOOKING_DAYS_AHEAD = 5;

/** Foodstuffs vendors buy straight from farmers, with the units they are sold in. */
export const VENDOR_CROPS: { key: string; label: string; units: string[] }[] = [
  { key: "matooke", label: "Matooke (bananas)", units: ["bunch", "kg"] },
  { key: "sweet_bananas", label: "Sweet bananas", units: ["bunch", "kg"] },
  { key: "maize", label: "Maize (grain)", units: ["kg", "bag"] },
  { key: "fresh_maize", label: "Fresh maize (cobs)", units: ["piece", "sack"] },
  { key: "beans", label: "Beans", units: ["kg", "bag"] },
  { key: "groundnuts", label: "Groundnuts", units: ["kg", "basin"] },
  { key: "rice", label: "Rice", units: ["kg", "bag"] },
  { key: "millet", label: "Millet", units: ["kg", "bag"] },
  { key: "sorghum", label: "Sorghum", units: ["kg", "bag"] },
  { key: "cassava", label: "Cassava", units: ["kg", "sack"] },
  { key: "sweet_potatoes", label: "Sweet potatoes", units: ["kg", "sack", "basin"] },
  { key: "irish_potatoes", label: "Irish potatoes", units: ["kg", "bag"] },
  { key: "tomatoes", label: "Tomatoes", units: ["kg", "crate", "basin"] },
  { key: "onions", label: "Onions", units: ["kg", "bag"] },
  { key: "cabbage", label: "Cabbage", units: ["piece", "sack"] },
  { key: "sukuma_wiki", label: "Sukuma wiki (kale)", units: ["bundle", "kg"] },
  { key: "eggplant", label: "Eggplant", units: ["kg", "basin"] },
  { key: "green_peppers", label: "Green peppers", units: ["kg", "basin"] },
  { key: "carrots", label: "Carrots", units: ["kg", "bag"] },
  { key: "pumpkins", label: "Pumpkins", units: ["piece", "kg"] },
  { key: "pineapples", label: "Pineapples", units: ["piece"] },
  { key: "mangoes", label: "Mangoes", units: ["kg", "crate"] },
  { key: "avocados", label: "Avocados", units: ["piece", "kg", "crate"] },
  { key: "oranges", label: "Oranges", units: ["kg", "bag"] },
  { key: "watermelon", label: "Watermelon", units: ["piece"] },
  { key: "jackfruit", label: "Jackfruit", units: ["piece"] },
  { key: "eggs", label: "Eggs", units: ["tray"] },
  { key: "chicken", label: "Chicken (live)", units: ["piece"] },
];

export function vendorCropLabel(key: string): string {
  return VENDOR_CROPS.find((c) => c.key === key)?.label ?? key;
}

/** District names compared without case or extra spaces. */
export function districtKey(name: string | undefined | null): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ").replace(/ district$/, "");
}

/** Latest date a delivery can be booked for an offer, given today (YYYY-MM-DD). */
export function latestBookingDate(today: string, offerValidUntil: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + MAX_BOOKING_DAYS_AHEAD);
  const max = d.toISOString().slice(0, 10);
  return max < offerValidUntil ? max : offerValidUntil;
}

/** The lowest and highest price per offer group (crop + form + unit). */
export function priceRange(prices: number[]): { min: number; max: number } | null {
  if (prices.length === 0) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}
