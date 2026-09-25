/**
 * Seed the Diagnostics library with the 12 nutrient deficiencies from the
 * "Deficiency Chart of Micronutrients" the owner supplied.
 *
 * Each entry gets: the chart's symptom text, symptom tags for the farmer
 * check, the leaf cut from the chart (full + thumbnail), and one treatment -
 * add the missing nutrient - sourced from the University of Arizona
 * Cooperative Extension guide az1106. No product brands are named.
 *
 * Entries go in as "waiting review" through the normal public mutations, so
 * they are logged and must be approved like any other contribution. Entries
 * whose name already exists are skipped, so the script is safe to re-run.
 *
 * Every entry also gets the Bio Farm treatment: the platform's official
 * fertilizer partner, recommended on all nutrient deficiencies for now (owner's
 * decision, 2026-09-25), described in the manufacturer's own words.
 *
 * Usage:
 *   node scripts/seed-diagnostics-deficiencies.mjs --url <CONVEX_URL> --admin <superAdminUserId> [--approve]
 *
 * --approve  approves everything still waiting for review on these entries
 *            (entry, photos, treatments) as that super admin, so farmers see
 *            them. Each approval is written to the audit log.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const api = anyApi;
const here = path.dirname(fileURLToPath(import.meta.url));
const imageDir = path.join(here, "data", "diagnostics-deficiency-chart");

const TREATMENT_SOURCE = {
  sourceName: "University of Arizona Cooperative Extension - Guide to Symptoms of Plant Nutrient Deficiencies (az1106)",
  sourceUrl: "https://www.extension.arizona.edu/publication/guide-symptoms-plant-nutrient-deficiencies",
};
const PHOTO_SOURCE = {
  sourceName: "Deficiency Chart of Micronutrients (supplied by farm2market super admin; original publisher not identified)",
  licence: "Unverified - supplied by admin",
};
const BIO_FARM_TREATMENT = {
  kind: "organic",
  text:
    "Bio-Farm Organic Liquid Fertilizer (official partner): a foliar spray with 20 kinds of natural amino acids and NPK, " +
    "made with nanotechnology to help the crop take up nutrients. Mix 50 ml in 20 litres of water and spray in the early morning. " +
    "Use it together with adding the missing nutrient.",
  sourceName: "Unode Agro - Bio-Farm Organic Liquid Fertilizer",
  sourceUrl: "https://www.unodeagro.com/biofarm",
};
const ALL_CROPS = ["maize", "cassava", "banana", "coffee", "beans"];

const DEFICIENCIES = [
  {
    key: "nitrogen",
    name: "Nitrogen (N) deficiency",
    symptoms: "Stunted growth. Extremely pale colour. Upright leaves with light green/yellowish colour. Appear burnt in extreme deficiency. Older (lower) leaves show it first.",
    symptomTags: ["stunted", "leaf_yellow", "leaf_pale", "dry_leaves"],
    treatment: "Add nitrogen: apply a fertilizer that contains nitrogen (ammonium, nitrate or urea), or well-rotted manure.",
  },
  {
    key: "phosphorus",
    name: "Phosphorus (P) deficiency",
    symptoms: "Plant short and dark green. In extreme deficiency leaves turn brown or black. Bronze colour under the leaf.",
    symptomTags: ["stunted", "leaf_purple"],
    treatment: "Add phosphorus: apply a phosphate fertilizer, or bone meal.",
  },
  {
    key: "potassium",
    name: "Potassium (K) deficiency",
    symptoms: "Small spots on the tips and edges of pale leaves. Spots turn rusty. Folds at tips.",
    symptomTags: ["edges_brown", "leaf_spots", "leaf_curl"],
    treatment: "Add potassium: apply a potash (potassium) fertilizer.",
  },
  {
    key: "calcium",
    name: "Calcium (Ca) deficiency",
    symptoms: "Plant dark green. Tender (young) leaves pale. Drying starts from the tips. Eventually leaf buds die.",
    symptomTags: ["buds_dying", "leaf_pale", "edges_brown"],
    treatment: "Add calcium: apply gypsum or a fertilizer that contains calcium.",
  },
  {
    key: "magnesium",
    name: "Magnesium (Mg) deficiency",
    symptoms: "Paleness from the leaf edges. No spots. Edges have cup-shaped folds. Leaves die and drop in extreme deficiency.",
    symptomTags: ["leaf_yellow", "leaf_curl", "dry_leaves"],
    treatment: "Add magnesium: apply a magnesium fertilizer such as magnesium sulphate (Epsom salt).",
  },
  {
    key: "sulphur",
    name: "Sulphur (S) deficiency",
    symptoms: "Leaves light green. Veins pale green. No spots. Younger leaves show it first.",
    symptomTags: ["leaf_pale", "leaf_yellow"],
    treatment: "Add sulphur: apply a sulphate fertilizer.",
  },
  {
    key: "iron",
    name: "Iron (Fe) deficiency",
    symptoms: "Leaves pale. No spots. Major veins stay green. Young leaves show it first.",
    symptomTags: ["leaf_pale", "veins_green"],
    treatment: "Add iron: apply an iron chelate fertilizer.",
  },
  {
    key: "manganese",
    name: "Manganese (Mn) deficiency",
    symptoms: "Leaves pale in colour. Veins and small veins dark green, in a net pattern.",
    symptomTags: ["veins_green", "leaf_mosaic", "leaf_pale"],
    treatment: "Add manganese: apply a manganese fertilizer, often together with zinc.",
  },
  {
    key: "zinc",
    name: "Zinc (Zn) deficiency",
    symptoms: "Leaves pale, narrow and short. Veins dark green. Dark spots on leaves and edges.",
    symptomTags: ["veins_green", "leaf_spots", "stunted"],
    treatment: "Add zinc: apply a zinc fertilizer.",
  },
  {
    key: "copper",
    name: "Copper (Cu) deficiency",
    symptoms: "Pale pink between the veins. Leaves wilt and drop.",
    symptomTags: ["wilting", "leaf_pale"],
    treatment: "Add copper: apply a copper fertilizer.",
  },
  {
    key: "boron",
    name: "Boron (B) deficiency",
    symptoms: "Discolouration of leaf buds. Breaking and dropping of buds.",
    symptomTags: ["buds_dying", "stunted"],
    treatment: "Add boron: apply borax or a borate fertilizer.",
  },
  {
    key: "molybdenum",
    name: "Molybdenum (Mo) deficiency",
    symptoms: "Leaves light green, lemon yellow or orange. Spots on the whole leaf except the veins. Sticky secretions from under the leaf.",
    symptomTags: ["leaf_yellow", "leaf_spots", "leaf_pale"],
    treatment: "Add molybdenum: apply a molybdate fertilizer.",
  },
];

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function upload(client, adminId, file) {
  const url = await client.mutation(api.files.generateUploadUrl, {});
  const body = await readFile(path.join(imageDir, file));
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body });
  if (!res.ok) throw new Error(`Upload failed for ${file}: ${res.status}`);
  return (await res.json()).storageId;
}

async function main() {
  const url = arg("url");
  const adminId = arg("admin");
  if (!url || !adminId) {
    console.error("Usage: node scripts/seed-diagnostics-deficiencies.mjs --url <CONVEX_URL> --admin <superAdminUserId>");
    process.exit(1);
  }
  const client = new ConvexHttpClient(url);

  const existing = new Set();
  for (const status of ["pending_review", "active", "rejected", "removed"]) {
    const rows = await client.query(api.diagnostics.listConditions, { adminId, status });
    rows.forEach((r) => existing.add(r.name.toLowerCase()));
  }

  for (const d of DEFICIENCIES) {
    if (existing.has(d.name.toLowerCase())) {
      console.log(`skip  ${d.name} (already in the library)`);
      continue;
    }
    const conditionId = await client.mutation(api.diagnostics.addCondition, {
      adminId,
      name: d.name,
      kind: "deficiency",
      hosts: ALL_CROPS,
      symptoms: d.symptoms,
      symptomTags: d.symptomTags,
      ...TREATMENT_SOURCE,
    });
    const storageId = await upload(client, adminId, `${d.key}.jpg`);
    const thumbStorageId = await upload(client, adminId, `${d.key}.thumb.jpg`);
    await client.mutation(api.diagnostics.addImage, {
      adminId,
      conditionId,
      storageId,
      thumbStorageId,
      caption: `${d.name.replace(" deficiency", "")} - leaf from the deficiency chart`,
      ...PHOTO_SOURCE,
    });
    await client.mutation(api.diagnostics.addTreatment, {
      adminId,
      conditionId,
      kind: "chemical",
      text: d.treatment,
      ...TREATMENT_SOURCE,
    });
    console.log(`added ${d.name}`);
  }

  // Bio Farm treatment and (optionally) approval, for every deficiency entry.
  const wanted = new Set(DEFICIENCIES.map((d) => d.name.toLowerCase()));
  const entries = [];
  for (const status of ["pending_review", "active"]) {
    const rows = await client.query(api.diagnostics.listConditions, { adminId, status });
    rows.filter((r) => wanted.has(r.name.toLowerCase())).forEach((r) => entries.push(r));
  }
  for (const entry of entries) {
    let detail = await client.query(api.diagnostics.getCondition, { adminId, conditionId: entry._id });
    if (!detail) continue;
    const hasBioFarm = detail.treatments.some(
      (t) => t.sourceUrl === BIO_FARM_TREATMENT.sourceUrl && t.status !== "removed" && t.status !== "rejected"
    );
    if (!hasBioFarm) {
      await client.mutation(api.diagnostics.addTreatment, { adminId, conditionId: entry._id, ...BIO_FARM_TREATMENT });
      console.log(`bio farm  ${entry.name}`);
      detail = await client.query(api.diagnostics.getCondition, { adminId, conditionId: entry._id });
    }
    if (!process.argv.includes("--approve") || !detail) continue;
    const pending = [
      ...(detail.condition.status === "pending_review" ? [{ itemType: "condition", itemId: String(detail.condition._id) }] : []),
      ...detail.images.filter((i) => i.status === "pending_review").map((i) => ({ itemType: "image", itemId: String(i._id) })),
      ...detail.treatments.filter((t) => t.status === "pending_review").map((t) => ({ itemType: "treatment", itemId: String(t._id) })),
    ];
    for (const item of pending) {
      await client.mutation(api.diagnostics.reviewItem, { adminId, ...item, decision: "approve", note: "Deficiency chart go-live" });
    }
    if (pending.length) console.log(`approved  ${entry.name} (${pending.length} items)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
