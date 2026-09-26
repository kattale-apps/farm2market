/**
 * Export Markets - plain shared constants and helpers.
 *
 * No Convex server imports, so both the backend (convex/exportMarkets.ts,
 * convex/buyerOnboarding.ts) and the app import this one module and the
 * values can never drift apart.
 */

// ------------------------------------------------------------------
// Dates. Every expiry and "valid until" is a YYYY-MM-DD Uganda date.
// ------------------------------------------------------------------

const UGANDA_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Uganda calendar date for a real instant (Date.now() in the browser). */
export function ugandaDateFromInstant(instantMs: number): string {
  return new Date(instantMs + UGANDA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Uganda calendar date for a value produced by getUgandaTime() on the server. */
export function ugandaDateFromStored(storedUgandaMs: number): string {
  return new Date(storedUgandaMs).toISOString().slice(0, 10);
}

export function isIsoDate(value: string | undefined | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDaysToIsoDate(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetweenIsoDates(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY_MS
  );
}

/** Warn this many days before a document or fee expires. */
export const EXPIRY_WARNING_DAYS = 30;

export type ExpiryState = "no_expiry" | "valid" | "expiring" | "expired";

/** A document is valid through its expiry date and expired the day after. */
export function expiryState(expiryDate: string | undefined, today: string): ExpiryState {
  if (!expiryDate) return "no_expiry";
  const daysLeft = daysBetweenIsoDates(today, expiryDate);
  if (daysLeft < 0) return "expired";
  if (daysLeft <= EXPIRY_WARNING_DAYS) return "expiring";
  return "valid";
}

// ------------------------------------------------------------------
// Fees
// ------------------------------------------------------------------

export const DEFAULT_EXPORT_FEE_SETTINGS = {
  exporterVerificationFeeUgx: 0,
  verificationFeeValidityDays: 365,
  creditVerificationFeeAgainstSuccessFee: true,
  successFeeMode: "percent" as "percent" | "per_bag",
  successFeePercent: 1,
  successFeePerBagUsd: 0,
  buyerFeePercent: 0,
  sampleHandlingFeeUgx: 0,
};

// ------------------------------------------------------------------
// Default vault document types. Super admins edit these in the admin
// Export Markets page; the defaults are only what a fresh deployment
// starts with. Regulator names are Uganda's export rules, not a tenant.
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// What an exporter sells. Roasted and packaged coffee is a food product
// for consumption and needs UNBS certification on top of export papers.
// ------------------------------------------------------------------

export const PRODUCT_FORMS = [
  { key: "green", label: "Green beans", hint: "Unroasted, graded export coffee" },
  { key: "roasted", label: "Roasted", hint: "Roasted beans in bulk" },
  { key: "packaged", label: "Packaged for consumption", hint: "Retail packs of roasted or ground coffee" },
] as const;
export type ProductForm = (typeof PRODUCT_FORMS)[number]["key"];
export const PRODUCT_FORM_KEYS = PRODUCT_FORMS.map((p) => p.key) as ProductForm[];

export function productFormLabel(key: string | undefined): string {
  return PRODUCT_FORMS.find((p) => p.key === key)?.label ?? "Green beans";
}

/**
 * Crops that can be exported, each with its icon in /public/icons. Only
 * active crops can be listed; the others are placeholders shown as
 * "coming soon" until their lot fields are defined.
 */
export const EXPORT_CROPS = [
  { key: "coffee", label: "Coffee", icon: "/icons/coffee-bean.svg", active: true },
  { key: "cocoa", label: "Cocoa", icon: "/icons/cocoa-pod.svg", active: false },
  { key: "tea", label: "Tea", icon: "/icons/tea-leaf.svg", active: false },
  { key: "vanilla", label: "Vanilla", icon: "/icons/vanilla-pod.svg", active: false },
  { key: "sesame", label: "Sesame", icon: "/icons/sesame-seed.svg", active: false },
] as const;

export function isActiveExportCrop(key: string): boolean {
  return EXPORT_CROPS.some((c) => c.key === key && c.active);
}
export const DEFAULT_EXPORT_CROP = "coffee";

export type DefaultDocumentType = {
  key: string;
  label: string;
  description: string;
  appliesTo: "exporter" | "buyer";
  required: boolean;
  hasExpiry: boolean;
  /** Only needed by exporters who sell one of these forms; empty or absent = everyone. */
  productForms?: ProductForm[];
};

/** Does a document type apply to an exporter who sells these product forms? */
export function docTypeAppliesTo(type: { productForms?: string[] }, forms: string[] | undefined): boolean {
  if (!type.productForms || type.productForms.length === 0) return true;
  const mine = forms && forms.length ? forms : ["green"];
  return type.productForms.some((f) => mine.includes(f));
}

export const DEFAULT_EXPORT_DOCUMENT_TYPES: DefaultDocumentType[] = [
  {
    key: "certificate_of_incorporation",
    label: "Certificate of incorporation",
    description: "Company registration certificate from URSB.",
    appliesTo: "exporter",
    required: true,
    hasExpiry: false,
  },
  {
    key: "tin_certificate",
    label: "URA TIN certificate",
    description: "Tax Identification Number registration from the Uganda Revenue Authority.",
    appliesTo: "exporter",
    required: true,
    hasExpiry: false,
  },
  {
    key: "coffee_export_licence",
    label: "Coffee exporter registration / licence",
    description: "Annual exporter registration from the coffee regulator (MAAIF, formerly UCDA).",
    appliesTo: "exporter",
    required: true,
    hasExpiry: true,
  },
  {
    key: "store_registration",
    label: "Registered store or processing facility",
    description: "Registration of your store or processing facility, or your contract with a registered one.",
    appliesTo: "exporter",
    required: true,
    hasExpiry: true,
  },
  {
    key: "customs_registration",
    label: "Customs registration or clearing agent",
    description: "URA customs registration, or the appointment letter of your clearing agent.",
    appliesTo: "exporter",
    required: false,
    hasExpiry: false,
  },
  {
    key: "certification",
    label: "Certification (Organic, Fairtrade, Rainforest Alliance, 4C)",
    description: "Any sustainability or quality certification buyers may ask for.",
    appliesTo: "exporter",
    required: false,
    hasExpiry: true,
  },
  {
    key: "unbs_certification",
    label: "UNBS product certification",
    description: "Uganda National Bureau of Standards certification (e.g. Q-Mark) for roasted or packaged coffee sold for consumption.",
    appliesTo: "exporter",
    required: true,
    hasExpiry: true,
    productForms: ["roasted", "packaged"],
  },
  {
    key: "food_premises_certificate",
    label: "Food processing premises certificate",
    description: "Operating certificate or food safety certification (e.g. HACCP) for the roasting or packing premises.",
    appliesTo: "exporter",
    required: false,
    hasExpiry: true,
    productForms: ["roasted", "packaged"],
  },
  {
    key: "buyer_company_registration",
    label: "Company registration",
    description: "Certificate of incorporation or business registration in your country.",
    appliesTo: "buyer",
    required: true,
    hasExpiry: false,
  },
  {
    key: "buyer_tax_registration",
    label: "Tax / VAT registration",
    description: "Tax or VAT registration in your country.",
    appliesTo: "buyer",
    required: true,
    hasExpiry: false,
  },
  {
    key: "buyer_signatory_id",
    label: "ID of authorised signatory",
    description: "Passport or national ID of the person who signs contracts.",
    appliesTo: "buyer",
    required: true,
    hasExpiry: true,
  },
  {
    key: "buyer_import_licence",
    label: "Import licence or EORI registration",
    description: "Import licence, or EORI registration for EU importers.",
    appliesTo: "buyer",
    required: false,
    hasExpiry: true,
  },
  {
    key: "buyer_proof_of_address",
    label: "Proof of business address",
    description: "A recent utility bill, bank statement or lease for the business address.",
    appliesTo: "buyer",
    required: false,
    hasExpiry: false,
  },
];

// ------------------------------------------------------------------
// Markets helper text - shown to buyers to tell the two markets apart.
// ------------------------------------------------------------------

export const MARKETS_HELPER = {
  export: {
    title: "Export Markets",
    tagline: "Bean to cup",
    body:
      "Buy green coffee that is already harvested, processed and graded, in export volumes. " +
      "Verified exporters list ready lots; you request a price, approve a sample and follow the " +
      "shipment step by step, with a traceability report back to the farms.",
  },
  advanced: {
    title: "Advanced Markets",
    tagline: "Seedling to harvest",
    body:
      "Fund production before it happens - from seedlings through to harvest - under contract " +
      "farming. Payments are released as the farmer reaches each verified milestone.",
  },
};

// ------------------------------------------------------------------
// Countries (ISO 3166-1 alpha-2). International buyers may be anywhere.
// ------------------------------------------------------------------

export const UGANDA_COUNTRY_CODE = "UG";

export const COUNTRIES: { code: string; name: string }[] = [
  { code: "AF", name: "Afghanistan" }, { code: "AX", name: "Åland Islands" }, { code: "AL", name: "Albania" },
  { code: "DZ", name: "Algeria" }, { code: "AS", name: "American Samoa" }, { code: "AD", name: "Andorra" },
  { code: "AO", name: "Angola" }, { code: "AI", name: "Anguilla" }, { code: "AQ", name: "Antarctica" },
  { code: "AG", name: "Antigua and Barbuda" }, { code: "AR", name: "Argentina" }, { code: "AM", name: "Armenia" },
  { code: "AW", name: "Aruba" }, { code: "AU", name: "Australia" }, { code: "AT", name: "Austria" },
  { code: "AZ", name: "Azerbaijan" }, { code: "BS", name: "Bahamas" }, { code: "BH", name: "Bahrain" },
  { code: "BD", name: "Bangladesh" }, { code: "BB", name: "Barbados" }, { code: "BY", name: "Belarus" },
  { code: "BE", name: "Belgium" }, { code: "BZ", name: "Belize" }, { code: "BJ", name: "Benin" },
  { code: "BM", name: "Bermuda" }, { code: "BT", name: "Bhutan" }, { code: "BO", name: "Bolivia" },
  { code: "BQ", name: "Bonaire, Sint Eustatius and Saba" }, { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BW", name: "Botswana" }, { code: "BV", name: "Bouvet Island" }, { code: "BR", name: "Brazil" },
  { code: "IO", name: "British Indian Ocean Territory" }, { code: "BN", name: "Brunei Darussalam" },
  { code: "BG", name: "Bulgaria" }, { code: "BF", name: "Burkina Faso" }, { code: "BI", name: "Burundi" },
  { code: "CV", name: "Cabo Verde" }, { code: "KH", name: "Cambodia" }, { code: "CM", name: "Cameroon" },
  { code: "CA", name: "Canada" }, { code: "KY", name: "Cayman Islands" }, { code: "CF", name: "Central African Republic" },
  { code: "TD", name: "Chad" }, { code: "CL", name: "Chile" }, { code: "CN", name: "China" },
  { code: "CX", name: "Christmas Island" }, { code: "CC", name: "Cocos (Keeling) Islands" }, { code: "CO", name: "Colombia" },
  { code: "KM", name: "Comoros" }, { code: "CG", name: "Congo" }, { code: "CD", name: "Congo, Democratic Republic of the" },
  { code: "CK", name: "Cook Islands" }, { code: "CR", name: "Costa Rica" }, { code: "CI", name: "Côte d'Ivoire" },
  { code: "HR", name: "Croatia" }, { code: "CU", name: "Cuba" }, { code: "CW", name: "Curaçao" },
  { code: "CY", name: "Cyprus" }, { code: "CZ", name: "Czechia" }, { code: "DK", name: "Denmark" },
  { code: "DJ", name: "Djibouti" }, { code: "DM", name: "Dominica" }, { code: "DO", name: "Dominican Republic" },
  { code: "EC", name: "Ecuador" }, { code: "EG", name: "Egypt" }, { code: "SV", name: "El Salvador" },
  { code: "GQ", name: "Equatorial Guinea" }, { code: "ER", name: "Eritrea" }, { code: "EE", name: "Estonia" },
  { code: "SZ", name: "Eswatini" }, { code: "ET", name: "Ethiopia" }, { code: "FK", name: "Falkland Islands" },
  { code: "FO", name: "Faroe Islands" }, { code: "FJ", name: "Fiji" }, { code: "FI", name: "Finland" },
  { code: "FR", name: "France" }, { code: "GF", name: "French Guiana" }, { code: "PF", name: "French Polynesia" },
  { code: "TF", name: "French Southern Territories" }, { code: "GA", name: "Gabon" }, { code: "GM", name: "Gambia" },
  { code: "GE", name: "Georgia" }, { code: "DE", name: "Germany" }, { code: "GH", name: "Ghana" },
  { code: "GI", name: "Gibraltar" }, { code: "GR", name: "Greece" }, { code: "GL", name: "Greenland" },
  { code: "GD", name: "Grenada" }, { code: "GP", name: "Guadeloupe" }, { code: "GU", name: "Guam" },
  { code: "GT", name: "Guatemala" }, { code: "GG", name: "Guernsey" }, { code: "GN", name: "Guinea" },
  { code: "GW", name: "Guinea-Bissau" }, { code: "GY", name: "Guyana" }, { code: "HT", name: "Haiti" },
  { code: "HM", name: "Heard Island and McDonald Islands" }, { code: "VA", name: "Holy See" },
  { code: "HN", name: "Honduras" }, { code: "HK", name: "Hong Kong" }, { code: "HU", name: "Hungary" },
  { code: "IS", name: "Iceland" }, { code: "IN", name: "India" }, { code: "ID", name: "Indonesia" },
  { code: "IR", name: "Iran" }, { code: "IQ", name: "Iraq" }, { code: "IE", name: "Ireland" },
  { code: "IM", name: "Isle of Man" }, { code: "IL", name: "Israel" }, { code: "IT", name: "Italy" },
  { code: "JM", name: "Jamaica" }, { code: "JP", name: "Japan" }, { code: "JE", name: "Jersey" },
  { code: "JO", name: "Jordan" }, { code: "KZ", name: "Kazakhstan" }, { code: "KE", name: "Kenya" },
  { code: "KI", name: "Kiribati" }, { code: "KP", name: "Korea, Democratic People's Republic of" },
  { code: "KR", name: "Korea, Republic of" }, { code: "KW", name: "Kuwait" }, { code: "KG", name: "Kyrgyzstan" },
  { code: "LA", name: "Lao People's Democratic Republic" }, { code: "LV", name: "Latvia" }, { code: "LB", name: "Lebanon" },
  { code: "LS", name: "Lesotho" }, { code: "LR", name: "Liberia" }, { code: "LY", name: "Libya" },
  { code: "LI", name: "Liechtenstein" }, { code: "LT", name: "Lithuania" }, { code: "LU", name: "Luxembourg" },
  { code: "MO", name: "Macao" }, { code: "MG", name: "Madagascar" }, { code: "MW", name: "Malawi" },
  { code: "MY", name: "Malaysia" }, { code: "MV", name: "Maldives" }, { code: "ML", name: "Mali" },
  { code: "MT", name: "Malta" }, { code: "MH", name: "Marshall Islands" }, { code: "MQ", name: "Martinique" },
  { code: "MR", name: "Mauritania" }, { code: "MU", name: "Mauritius" }, { code: "YT", name: "Mayotte" },
  { code: "MX", name: "Mexico" }, { code: "FM", name: "Micronesia" }, { code: "MD", name: "Moldova" },
  { code: "MC", name: "Monaco" }, { code: "MN", name: "Mongolia" }, { code: "ME", name: "Montenegro" },
  { code: "MS", name: "Montserrat" }, { code: "MA", name: "Morocco" }, { code: "MZ", name: "Mozambique" },
  { code: "MM", name: "Myanmar" }, { code: "NA", name: "Namibia" }, { code: "NR", name: "Nauru" },
  { code: "NP", name: "Nepal" }, { code: "NL", name: "Netherlands" }, { code: "NC", name: "New Caledonia" },
  { code: "NZ", name: "New Zealand" }, { code: "NI", name: "Nicaragua" }, { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" }, { code: "NU", name: "Niue" }, { code: "NF", name: "Norfolk Island" },
  { code: "MK", name: "North Macedonia" }, { code: "MP", name: "Northern Mariana Islands" }, { code: "NO", name: "Norway" },
  { code: "OM", name: "Oman" }, { code: "PK", name: "Pakistan" }, { code: "PW", name: "Palau" },
  { code: "PS", name: "Palestine, State of" }, { code: "PA", name: "Panama" }, { code: "PG", name: "Papua New Guinea" },
  { code: "PY", name: "Paraguay" }, { code: "PE", name: "Peru" }, { code: "PH", name: "Philippines" },
  { code: "PN", name: "Pitcairn" }, { code: "PL", name: "Poland" }, { code: "PT", name: "Portugal" },
  { code: "PR", name: "Puerto Rico" }, { code: "QA", name: "Qatar" }, { code: "RE", name: "Réunion" },
  { code: "RO", name: "Romania" }, { code: "RU", name: "Russian Federation" }, { code: "RW", name: "Rwanda" },
  { code: "BL", name: "Saint Barthélemy" }, { code: "SH", name: "Saint Helena, Ascension and Tristan da Cunha" },
  { code: "KN", name: "Saint Kitts and Nevis" }, { code: "LC", name: "Saint Lucia" }, { code: "MF", name: "Saint Martin (French part)" },
  { code: "PM", name: "Saint Pierre and Miquelon" }, { code: "VC", name: "Saint Vincent and the Grenadines" },
  { code: "WS", name: "Samoa" }, { code: "SM", name: "San Marino" }, { code: "ST", name: "Sao Tome and Principe" },
  { code: "SA", name: "Saudi Arabia" }, { code: "SN", name: "Senegal" }, { code: "RS", name: "Serbia" },
  { code: "SC", name: "Seychelles" }, { code: "SL", name: "Sierra Leone" }, { code: "SG", name: "Singapore" },
  { code: "SX", name: "Sint Maarten (Dutch part)" }, { code: "SK", name: "Slovakia" }, { code: "SI", name: "Slovenia" },
  { code: "SB", name: "Solomon Islands" }, { code: "SO", name: "Somalia" }, { code: "ZA", name: "South Africa" },
  { code: "GS", name: "South Georgia and the South Sandwich Islands" }, { code: "SS", name: "South Sudan" },
  { code: "ES", name: "Spain" }, { code: "LK", name: "Sri Lanka" }, { code: "SD", name: "Sudan" },
  { code: "SR", name: "Suriname" }, { code: "SJ", name: "Svalbard and Jan Mayen" }, { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" }, { code: "SY", name: "Syrian Arab Republic" }, { code: "TW", name: "Taiwan" },
  { code: "TJ", name: "Tajikistan" }, { code: "TZ", name: "Tanzania" }, { code: "TH", name: "Thailand" },
  { code: "TL", name: "Timor-Leste" }, { code: "TG", name: "Togo" }, { code: "TK", name: "Tokelau" },
  { code: "TO", name: "Tonga" }, { code: "TT", name: "Trinidad and Tobago" }, { code: "TN", name: "Tunisia" },
  { code: "TR", name: "Türkiye" }, { code: "TM", name: "Turkmenistan" }, { code: "TC", name: "Turks and Caicos Islands" },
  { code: "TV", name: "Tuvalu" }, { code: "UG", name: "Uganda" }, { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" }, { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States of America" }, { code: "UM", name: "United States Minor Outlying Islands" },
  { code: "UY", name: "Uruguay" }, { code: "UZ", name: "Uzbekistan" }, { code: "VU", name: "Vanuatu" },
  { code: "VE", name: "Venezuela" }, { code: "VN", name: "Viet Nam" }, { code: "VG", name: "Virgin Islands (British)" },
  { code: "VI", name: "Virgin Islands (U.S.)" }, { code: "WF", name: "Wallis and Futuna" }, { code: "EH", name: "Western Sahara" },
  { code: "YE", name: "Yemen" }, { code: "ZM", name: "Zambia" }, { code: "ZW", name: "Zimbabwe" },
];

export function countryName(code: string | undefined | null): string | undefined {
  if (!code) return undefined;
  return COUNTRIES.find((c) => c.code === code.toUpperCase())?.name;
}

// ==================================================================
// Phase 2-4 shared definitions
// ==================================================================

export const COFFEE_TYPES = ["Arabica", "Robusta"] as const;
export const PROCESSING_METHODS = ["Washed", "Natural", "Honey", "Semi-washed", "Other"];
export const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP"] as const;
export type Incoterm = (typeof INCOTERMS)[number];
export const DEFAULT_BAG_WEIGHT_KG = 60;
export const PAYMENT_TERMS = [
  "Letter of Credit (LC)",
  "Cash Against Documents (CAD)",
  "Advance payment (TT)",
  "Part advance, balance against documents",
  "Other",
];

// ------------------------------------------------------------------
// Trace map: the coffee journey from farm to export bag. Farm stages are
// verified by an admin of the farmer's community; the rest by an admin of
// the exporter community. Super admins can verify any stage.
// ------------------------------------------------------------------

export type TraceScope = "farm" | "exporter";
export const TRACE_STAGES: { key: string; name: string; scope: TraceScope; hint: string }[] = [
  { key: "farm_harvest", name: "Harvest at the farm", scope: "farm", hint: "Cherries being picked on the farm; weight of cherry collected." },
  { key: "drying", name: "Drying", scope: "farm", hint: "Coffee on drying tables or tarpaulins; weight in and out." },
  { key: "hulling", name: "Hulling / processing", scope: "exporter", hint: "Hulling or wet processing into green beans; weight in and out." },
  { key: "grading", name: "Grading and sorting", scope: "exporter", hint: "Screen grading and sorting; grading sheet if available." },
  { key: "warehouse", name: "Warehouse storage", scope: "exporter", hint: "Bags in the warehouse with the lot marking visible." },
  { key: "export_bagging", name: "Export bagging and marking", scope: "exporter", hint: "Final export bags with marks; total bags and weight." },
];

/** Weight may drop between stages (hulling, drying, sorting) but never rise beyond this tolerance. */
export const MASS_BALANCE_TOLERANCE = 0.02;

// ------------------------------------------------------------------
// EUDR (EU Deforestation Regulation) readiness. Every source plot needs a
// location; plots larger than 4 hectares need a boundary polygon.
// ------------------------------------------------------------------

export const EUDR_POLYGON_THRESHOLD_HA = 4;
export const HECTARES_PER_ACRE = 0.40468564224;

// ------------------------------------------------------------------
// Order pipeline. System steps are driven by the app and cannot be removed
// or reordered; super admins may rename them, change required documents,
// and add custom steps after identities are revealed.
// ------------------------------------------------------------------

export type PipelineActor = "buyer" | "exporter" | "admin" | "platform";
export type PipelineKind = "system" | "documents" | "confirm";
export type PipelineStep = {
  key: string;
  name: string;
  actor: PipelineActor;
  kind: PipelineKind;
  system: boolean;
  requiredDocuments: string[];
  description?: string;
};

export const SYSTEM_STEP_KEYS = [
  "offer_accepted",
  "buyer_kyc",
  "sample",
  "contract_terms",
  "platform_fees",
  "disclosure",
  "payment_security",
  "pre_shipment_docs",
  "stuffing",
  "shipped",
  "arrived",
  "balance_settled",
  "rating",
] as const;

export function defaultPipelineSteps(incoterm: string): PipelineStep[] {
  const insured = incoterm === "CIF" || incoterm === "CIP";
  const preShipment = [
    "ICO certificate of origin",
    "Phytosanitary certificate",
    "Quality / grading certificate",
    "Fumigation certificate",
    "Weight certificate",
    "Commercial invoice",
    "Packing list",
    ...(insured ? ["Insurance certificate"] : []),
  ];
  return [
    { key: "offer_accepted", name: "Offer accepted", actor: "exporter", kind: "system", system: true, requiredDocuments: [], description: "The exporter accepts the buyer's offer, subject to sample approval." },
    { key: "buyer_kyc", name: "Buyer KYC approved", actor: "buyer", kind: "system", system: true, requiredDocuments: [], description: "The buyer submits company documents; an admin approves them." },
    { key: "sample", name: "Sample approved", actor: "platform", kind: "system", system: true, requiredDocuments: [], description: "The platform collects a sample from the exporter and sends it to the buyer." },
    { key: "contract_terms", name: "Contract terms agreed", actor: "buyer", kind: "system", system: true, requiredDocuments: [], description: "Price, quantity, Incoterm, port, shipment window and payment terms." },
    { key: "platform_fees", name: "Platform fees paid", actor: "platform", kind: "system", system: true, requiredDocuments: [], description: "The exporter's success fee (and any buyer fee) is paid." },
    { key: "disclosure", name: "Identities revealed", actor: "platform", kind: "system", system: true, requiredDocuments: [], description: "Company names and contacts are shared with both sides." },
    { key: "payment_security", name: "Payment secured", actor: "buyer", kind: "documents", system: true, requiredDocuments: ["Letter of Credit or payment proof"], description: "The buyer uploads the LC or payment documents; an admin verifies them." },
    { key: "pre_shipment_docs", name: "Pre-shipment certificates", actor: "exporter", kind: "documents", system: true, requiredDocuments: preShipment, description: "Export certificates for this shipment." },
    { key: "stuffing", name: "Container stuffing", actor: "exporter", kind: "documents", system: true, requiredDocuments: ["Container stuffing photo"], description: "Container and seal numbers with a photo of the loaded container." },
    { key: "shipped", name: "Shipped", actor: "exporter", kind: "documents", system: true, requiredDocuments: ["Bill of lading / air waybill"], description: "Vessel details and the bill of lading." },
    { key: "arrived", name: "Arrived", actor: "buyer", kind: "confirm", system: true, requiredDocuments: [], description: "The buyer confirms the shipment arrived." },
    { key: "balance_settled", name: "Balance settled", actor: "exporter", kind: "confirm", system: true, requiredDocuments: [], description: "The exporter confirms full payment was received." },
    { key: "rating", name: "Buyer rating", actor: "buyer", kind: "system", system: true, requiredDocuments: [], description: "The buyer rates the exporter." },
  ];
}

/** Validates an edited template: system steps all present, in order, and custom steps only after disclosure. */
export function validatePipelineSteps(steps: PipelineStep[]): string | null {
  const keys = steps.map((s) => s.key);
  if (new Set(keys).size !== keys.length) return "Step keys must be unique";
  const systemOrder = keys.filter((k) => (SYSTEM_STEP_KEYS as readonly string[]).includes(k));
  if (systemOrder.join(",") !== SYSTEM_STEP_KEYS.join(",")) return "Built-in steps must all be present, in their original order";
  const disclosureIndex = keys.indexOf("disclosure");
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (!s.name.trim()) return "Every step needs a name";
    const isSystemKey = (SYSTEM_STEP_KEYS as readonly string[]).includes(s.key);
    if (s.system !== isSystemKey) return "Only built-in steps can be marked as system steps";
    if (!s.system) {
      if (i < disclosureIndex) return "Custom steps can only come after identities are revealed";
      if (s.kind === "system") return "Custom steps must be a document or confirmation step";
      if (s.actor === "platform") return "Custom steps need a buyer, exporter or admin to act";
      if (s.kind === "documents" && s.requiredDocuments.length === 0) return `"${s.name}" needs at least one document`;
    }
  }
  if (steps.length > 30) return "A pipeline can have at most 30 steps";
  return null;
}

// ------------------------------------------------------------------
// Anti side-trading: contact details are masked in deal messages until the
// platform fees are paid and identities are revealed.
// ------------------------------------------------------------------

export function maskContactDetails(text: string): { text: string; masked: boolean } {
  let masked = false;
  const hide = (re: RegExp, label: string, t: string) =>
    t.replace(re, (match, ...rest) => {
      masked = true;
      // Keep a leading space captured by the handle pattern.
      const lead = typeof rest[0] === "string" && /^\s$/.test(rest[0]) ? rest[0] : "";
      return `${lead}[${label} hidden until names are revealed]`;
    });
  let t = text;
  t = hide(/[A-Z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[A-Z0-9.-]+\s*(?:\.|\(dot\)|\[dot\])\s*[A-Z]{2,}/gi, "email", t);
  t = hide(/\b(?:https?:\/\/|www\.)\S+/gi, "link", t);
  t = hide(/\b[a-z0-9-]+\.(?:com|net|org|co|io|biz|info|ug|ke|uk|de|nl|us|eu)(?:\/\S*)?\b/gi, "link", t);
  t = hide(/\b(?:wa\.me|whatsapp|telegram|t\.me|signal|skype|wechat|viber)\b\S*/gi, "contact app", t);
  // Phone numbers: 9+ digits in a run of digits, spaces and separators.
  // Dates (2026-10-01) and quantities (19,200 kg) stay readable.
  t = t.replace(/(?:\+|00)?\d[\d\s().-]{7,}\d/g, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length < 9 || /^\d{4}-\d{2}-\d{2}$/.test(match.trim())) return match;
    masked = true;
    return "[phone number hidden until names are revealed]";
  });
  t = hide(/(^|\s)@[A-Za-z0-9_]{3,}/g, "handle", t);
  return { text: t, masked };
}

// ------------------------------------------------------------------
// Fees
// ------------------------------------------------------------------

/** exchangeRates stores foreign units per 1 UGX; this returns UGX per 1 USD. */
export function ugxPerUsd(usdPerUgx: number | undefined | null): number | null {
  if (!usdPerUgx || usdPerUgx <= 0) return null;
  return 1 / usdPerUgx;
}

export function computeDealFees(input: {
  contractValueUsd: number;
  bags: number;
  fxUgxPerUsd: number;
  successFeeMode: "percent" | "per_bag";
  successFeePercent: number;
  successFeePerBagUsd: number;
  buyerFeePercent: number;
  exporterCreditUgx: number;
}) {
  const successUsd =
    input.successFeeMode === "percent"
      ? (input.contractValueUsd * input.successFeePercent) / 100
      : input.bags * input.successFeePerBagUsd;
  const successUgx = Math.ceil(successUsd * input.fxUgxPerUsd);
  const creditApplied = Math.min(Math.max(0, input.exporterCreditUgx), successUgx);
  const buyerUgx = Math.ceil(((input.contractValueUsd * input.buyerFeePercent) / 100) * input.fxUgxPerUsd);
  return {
    successFeeUsd: successUsd,
    successFeeUgx: successUgx,
    creditAppliedUgx: creditApplied,
    exporterDueUgx: successUgx - creditApplied,
    buyerFeeUgx: buyerUgx,
  };
}

/** 1 US cent per pound = 0.0220462 USD per kilogram. */
export function centsPerLbToUsdPerKg(centsPerLb: number): number {
  return (centsPerLb / 100) * 2.20462262;
}
