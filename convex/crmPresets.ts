/**
 * Shared CRM vocabulary: the default opening script, the tokens it may use,
 * and the mapping between a form's preset questions and the structured
 * outcome columns on a call log.
 *
 * Deliberately free of any Convex server imports so the admin UI can import
 * the same constants instead of keeping its own copy. The opening script
 * default previously existed twice - once here in the backend and once in
 * `app/admin/community-crm/page.tsx` - and the two were free to drift.
 *
 * Nothing in this file names a specific community or product. Every community
 * on the platform shares these defaults, so a brand belongs in a community's
 * own saved template, never in the fallback.
 */

export const DEFAULT_OPENING_SCRIPT_TEMPLATE =
  "Good morning, {{customer_gender_title}} {{customer_last_name}}. My name is {{agent_name}} calling from {{community_name}}. You previously purchased {{product_name}} on {{purchase_date}}. We are following up to find out how it has performed for you and whether you need any assistance.";

export const ALLOWED_SCRIPT_TOKENS = [
  "agent_name",
  "customer_full_name",
  "customer_last_name",
  "customer_gender_title",
  "product_name",
  "quantity",
  "purchase_date",
  "district",
  "sub_county",
  "parish",
  "phone_number",
  "crop_grown",
  "month_of_planting",
  "community_name",
  "today_date",
] as const;

/**
 * Fallbacks used when a token has no value on the lead. They must stay
 * generic: `community_name` resolving to a hard-coded brand meant an agent
 * could introduce themselves as a company they do not work for.
 */
export const SCRIPT_TOKEN_FALLBACKS = {
  product_name: "the product you bought from us",
  community_name: "our team",
  customer_name: "valued customer",
  purchase_date: "your recent purchase",
};

/**
 * The four structured outcome columns a call log carries. Each one can be
 * driven by a form question tagged with the matching `presetKey`, which is
 * what makes the form answers - not a fixed set of hard-coded dropdowns - the
 * source of truth for a call.
 */
export const PRESET_KEYS = {
  usageStatus: "usage_status",
  resultRating: "result_rating",
  issueType: "issue_type",
  repurchaseIntent: "repurchase_intent",
  notes: "notes",
} as const;

function normalizeOption(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Maps the option text a supervisor wrote on a form question onto the literal
 * the database stores. Keyed by the normalized option so "Very good",
 * "very good" and "Very Good" all land on `very_good`.
 */
const OPTION_TO_LITERAL: Record<string, Record<string, string>> = {
  usage_status: {
    yes: "yes",
    used_it: "yes",
    partly: "partly",
    partially: "partly",
    no: "no",
    not_yet: "no",
    don_t_know: "unknown",
    dont_know: "unknown",
    unknown: "unknown",
    not_sure: "unknown",
  },
  result_rating: {
    very_good: "very_good",
    excellent: "very_good",
    good: "good",
    average: "average",
    ok: "average",
    fair: "average",
    poor: "poor",
    bad: "poor",
    very_poor: "very_poor",
    very_bad: "very_poor",
  },
  issue_type: {
    none: "none",
    no_problem: "none",
    no_issue: "none",
    application_problem: "application_problem",
    product_problem: "product_problem",
    packaging_problem: "packaging_problem",
    delivery_problem: "delivery_problem",
    technical_advice: "technical_advice",
    needs_technical_advice: "technical_advice",
    farmer_needs_technical_advice: "technical_advice",
    customer_needs_technical_advice: "technical_advice",
    other: "other",
  },
  repurchase_intent: {
    yes: "yes",
    will_buy_again: "yes",
    maybe: "maybe",
    undecided: "maybe",
    no: "no",
    will_not_buy_again: "no",
  },
};

/**
 * Translates one answer into the literal its column accepts, or null when the
 * option text does not correspond to a known value. Returning null keeps the
 * column unset rather than guessing - an unrecognised answer is still visible
 * verbatim in the call's answer list.
 */
export function literalForPresetAnswer(
  presetKey: string,
  value: string
): string | null {
  const table = OPTION_TO_LITERAL[presetKey];
  if (!table) return null;
  return table[normalizeOption(value)] ?? null;
}

/**
 * The default question set a new CRM form starts with. Worded for any product
 * in any community - a supervisor renames them to suit their campaign.
 */
export const DEFAULT_CRM_FORM_FIELDS = [
  {
    fieldType: "select",
    label: "Did the customer use the product?",
    required: true,
    options: ["Yes", "Partly", "No", "Don't know"],
    presetKey: PRESET_KEYS.usageStatus,
  },
  {
    fieldType: "select",
    label: "How would you rate the result?",
    required: true,
    options: ["Very good", "Good", "Average", "Poor", "Very poor"],
    presetKey: PRESET_KEYS.resultRating,
  },
  {
    fieldType: "select",
    label: "Any problem?",
    required: false,
    options: [
      "No problem",
      "Application problem",
      "Product problem",
      "Packaging problem",
      "Delivery problem",
      "Needs technical advice",
      "Other",
    ],
    presetKey: PRESET_KEYS.issueType,
  },
  {
    fieldType: "select",
    label: "Wants to purchase more?",
    required: true,
    options: ["Yes", "Maybe", "No"],
    presetKey: PRESET_KEYS.repurchaseIntent,
  },
  {
    fieldType: "text",
    label: "Notes",
    required: false,
    presetKey: PRESET_KEYS.notes,
  },
] as const;
