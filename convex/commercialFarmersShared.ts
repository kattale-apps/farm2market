/**
 * Commercial farmers - plain shared rules (no Convex server imports), used by
 * convex/commercialFarmers.ts and the app so they never drift apart.
 *
 * A farmer puts lots on MarketSpace only with a commercial profile: a
 * trading name and one commercial document. Farmers without one still sell
 * to vendors by answering their posted buying prices, and verified buyers
 * (exporters, processors, vendors and business buyers) still see every
 * farmer's lots as farm-gate sources. Who sees which farmer lots is
 * produceVisible (marketspaceShared).
 *
 * The trading name is private: only the farmer and the super admin who
 * checks the document see it. MarketSpace shows the alias and a
 * "Commercial Farmer" badge.
 */

export const COMMERCIAL_DOCUMENTS = [
  { key: "trading_licence", label: "Trading licence", hint: "A photo of your trading licence from the district or town council" },
  { key: "business_registration", label: "Business registration", hint: "A photo of your business name or company registration certificate (URSB)" },
  { key: "tin", label: "TIN (tax number)", hint: "Your 10-digit URA tax number" },
] as const;

export type CommercialDocumentKind = (typeof COMMERCIAL_DOCUMENTS)[number]["key"];
export const COMMERCIAL_DOCUMENT_KINDS = COMMERCIAL_DOCUMENTS.map((d) => d.key) as CommercialDocumentKind[];

export function documentLabel(kind: string): string {
  return COMMERCIAL_DOCUMENTS.find((d) => d.key === kind)?.label ?? kind;
}

/** Why the super admin did not accept a profile: presets, so the farmer gets a clear reason. */
export const REJECT_REASONS = [
  "The document photo is not clear",
  "The trading name does not match the document",
  "This is not a commercial document",
  "The document has expired",
] as const;

export type CommercialStatus = "pending" | "verified" | "rejected";

export const TRADING_NAME_MAX = 80;

/**
 * Checks a commercial profile before it is saved; returns a plain problem
 * the farmer can fix, or null. A licence or registration needs its photo;
 * a TIN needs the 10-digit number (a photo of the TIN certificate helps).
 */
export function commercialProfileProblem(input: {
  tradingName: string;
  kind: string;
  number?: string;
  hasPhoto: boolean;
}): string | null {
  const name = input.tradingName.trim();
  if (name.length < 2) return "Enter your trading name.";
  if (name.length > TRADING_NAME_MAX) return `Keep the trading name under ${TRADING_NAME_MAX} letters.`;
  if (!(COMMERCIAL_DOCUMENT_KINDS as string[]).includes(input.kind)) return "Choose your document.";
  const number = (input.number ?? "").replace(/\s+/g, "");
  if (input.kind === "tin") {
    if (!/^\d{10}$/.test(number)) return "A TIN has 10 digits.";
  } else {
    if (!input.hasPhoto) return `Add a photo of your ${documentLabel(input.kind).toLowerCase()}.`;
    if (number.length > 40) return "The document number is too long.";
  }
  return null;
}
