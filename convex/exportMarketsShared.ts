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

export type DefaultDocumentType = {
  key: string;
  label: string;
  description: string;
  appliesTo: "exporter" | "buyer";
  required: boolean;
  hasExpiry: boolean;
};

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
