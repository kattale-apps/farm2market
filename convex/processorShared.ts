/**
 * Processors - plain shared constants and helpers (no Convex server imports),
 * used by convex/processors.ts and the app so the values never drift apart.
 *
 * A processor (role key "store") buys produce from farmers, processes it and
 * sells it on, mainly to exporters. Coffee is open first; other crops follow
 * the EXPORT_CROPS "active" flags.
 */

export const PROCESSING_CAPABILITIES = [
  { key: "drying", label: "Drying", hint: "Sun or mechanical drying of cherry or parchment" },
  { key: "wet_processing", label: "Wet processing", hint: "Pulping, fermenting and washing" },
  { key: "hulling", label: "Hulling", hint: "Removing husk or parchment to green beans" },
  { key: "sorting_grading", label: "Sorting and grading", hint: "Screen grading, density and colour sorting" },
  { key: "roasting", label: "Roasting", hint: "Roasting green beans" },
  { key: "packaging", label: "Packaging", hint: "Bagging and packing for sale" },
  { key: "storage", label: "Warehouse storage", hint: "Holding bagged produce in a store" },
] as const;
export const CAPABILITY_KEYS = PROCESSING_CAPABILITIES.map((c) => c.key) as string[];

export function capabilityLabel(key: string): string {
  return PROCESSING_CAPABILITIES.find((c) => c.key === key)?.label ?? key;
}

/** What a farmer delivers to a processor. */
export const INTAKE_FORMS = [
  { key: "red_cherry", label: "Red cherry" },
  { key: "kiboko", label: "Kiboko (dry cherry)" },
  { key: "parchment", label: "Parchment" },
  { key: "faq", label: "FAQ (fair average quality)" },
  { key: "green", label: "Green beans" },
  { key: "other", label: "Other" },
] as const;
export const INTAKE_FORM_KEYS = INTAKE_FORMS.map((f) => f.key) as string[];

/** What comes out of a processing batch. */
export const BATCH_OUTPUT_FORMS = [
  { key: "faq", label: "FAQ" },
  { key: "green", label: "Graded green beans" },
  { key: "roasted", label: "Roasted" },
  { key: "packaged", label: "Packaged" },
] as const;
export const BATCH_OUTPUT_FORM_KEYS = BATCH_OUTPUT_FORMS.map((f) => f.key) as string[];

export function formLabel(key: string): string {
  return (
    INTAKE_FORMS.find((f) => f.key === key)?.label ?? BATCH_OUTPUT_FORMS.find((f) => f.key === key)?.label ?? key
  );
}

export const STORAGE_TYPES = [
  { key: "dry", label: "Dry store" },
  { key: "cold", label: "Cold store" },
  { key: "both", label: "Dry and cold" },
] as const;

/** Vault documents a processor uploads. Regulator names are Uganda's rules, not a tenant. */
export const DEFAULT_PROCESSOR_DOCUMENT_TYPES = [
  {
    key: "processor_business_registration",
    label: "Business registration",
    description: "Certificate of incorporation or business name registration from URSB.",
    appliesTo: "processor" as const,
    required: true,
    hasExpiry: false,
  },
  {
    key: "processor_tin_certificate",
    label: "URA TIN certificate",
    description: "Tax Identification Number registration from the Uganda Revenue Authority.",
    appliesTo: "processor" as const,
    required: true,
    hasExpiry: false,
  },
  {
    key: "processor_processing_licence",
    label: "Processing licence / registration",
    description: "Annual registration of your processing facility with the crop regulator (for coffee: MAAIF, formerly UCDA).",
    appliesTo: "processor" as const,
    required: true,
    hasExpiry: true,
  },
  {
    key: "processor_premises_certificate",
    label: "Premises or trading licence",
    description: "District trading licence or operating certificate for the facility.",
    appliesTo: "processor" as const,
    required: false,
    hasExpiry: true,
  },
  {
    key: "processor_certification",
    label: "Certification (Organic, Fairtrade, Rainforest Alliance, 4C)",
    description: "Any sustainability or quality certification of the facility.",
    appliesTo: "processor" as const,
    required: false,
    hasExpiry: true,
  },
];

export type TraceLevel = "platform_traced" | "partly_declared" | "declared_evidenced" | "declared";

/**
 * Trace level of processed produce from its intakes. Farmers on the app make
 * it platform-traced; declared (off-app) farmers stay declared, raised to
 * "declared + evidenced" when the Storage Officer approved their intake
 * evidence. That approval is added on top of the declared level, it does not
 * replace it.
 */
export function traceLevelFromIntakes(intakes: { sourceKind: "platform_farmer" | "declared"; evidenceStatus: string }[]): TraceLevel {
  if (intakes.length === 0) return "declared";
  const platform = intakes.filter((i) => i.sourceKind === "platform_farmer").length;
  if (platform === intakes.length) return "platform_traced";
  if (platform > 0) return "partly_declared";
  return intakes.every((i) => i.evidenceStatus === "approved") ? "declared_evidenced" : "declared";
}

/** One level for a lot from the levels of its sources. */
export function combineTraceLevels(levels: TraceLevel[]): TraceLevel {
  if (levels.length === 0) return "declared";
  if (levels.every((l) => l === "platform_traced")) return "platform_traced";
  if (levels.every((l) => l === "declared_evidenced")) return "declared_evidenced";
  if (levels.every((l) => l === "declared" || l === "declared_evidenced")) return "declared";
  return "partly_declared";
}

/**
 * Farm stages are covered by the processor's intake records when every source
 * is a processor purchase, so they do not count towards the lot's progress.
 */
export function applicableStages<S extends { scope: string }>(stages: S[], sources: { kind: string }[]): S[] {
  const allFromProcessors = sources.length > 0 && sources.every((s) => s.kind === "processor_purchase");
  return allFromProcessors ? stages.filter((s) => s.scope !== "farm") : stages;
}

/** Outturn: the share of the input weight that came out, as a percentage. */
export function outturnPercent(weightInKg: number, weightOutKg: number | undefined): number | null {
  if (weightOutKg === undefined || !(weightInKg > 0)) return null;
  return Math.round((weightOutKg / weightInKg) * 1000) / 10;
}

/** Processor success fee in UGX for a sale value; 0 when no fee is set. */
export function processorSuccessFeeUgx(saleValueUgx: number, percent: number | undefined): number {
  if (!percent || percent <= 0 || !(saleValueUgx > 0)) return 0;
  return Math.ceil((saleValueUgx * percent) / 100);
}

/** The exporter's own stages used when they have not set a pipeline. */
export const DEFAULT_EXPORTER_TRACE_STAGES = [
  { key: "hulling", name: "Hulling / processing", hint: "Hulling or wet processing into green beans; weight in and out." },
  { key: "grading", name: "Grading and sorting", hint: "Screen grading and sorting; grading sheet if available." },
  { key: "warehouse", name: "Warehouse storage", hint: "Bags in the warehouse with the lot marking visible." },
  { key: "export_bagging", name: "Export bagging and marking", hint: "Final export bags with marks; total bags and weight." },
];

export const MAX_EXPORTER_TRACE_STAGES = 12;
