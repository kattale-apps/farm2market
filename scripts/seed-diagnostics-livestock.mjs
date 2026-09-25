/**
 * Seed the Diagnostics library with the main livestock diseases in Uganda
 * (cattle, goats, sheep, pigs, chickens), researched 2026-09-25.
 *
 * Which diseases: the most diagnosed in Uganda's cattle and poultry (East
 * Coast fever, worms, mastitis; Newcastle disease, coccidiosis, Gumboro -
 * Byaruhanga et al., "Retrospective study on cattle and poultry diseases in
 * Uganda", https://pubmed.ncbi.nlm.nih.gov/30255067/), plus foot-and-mouth
 * disease, African swine fever, PPR, CCPP and lumpy skin disease.
 *
 * Signs and control measures come from the Merck Veterinary Manual page named
 * on each entry. Treatments tell the farmer what to do on the farm and to get
 * a vet for medicines and doses: no drug doses, no brands. Diseases the
 * sources describe as reportable say to report them to the District
 * Veterinary Officer.
 *
 * Entries go in as "waiting review" through the normal public mutations, so
 * they are logged and need approval (ideally by a vet) before farmers see
 * them. Existing names are skipped, so the script is safe to re-run.
 *
 * Usage:
 *   node scripts/seed-diagnostics-livestock.mjs --url <CONVEX_URL> --admin <superAdminUserId> [--approve]
 */

import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const api = anyApi;

const MERCK = (title, path) => ({
  sourceName: `Merck Veterinary Manual - ${title}`,
  sourceUrl: `https://www.merckvetmanual.com/${path}`,
});

const REPORT_DVO =
  "Report it to your District Veterinary Officer (DVO) straight away. Do not sell or move animals until the vet says it is safe.";
const CALL_VET_EARLY = "Call a vet as soon as you see these signs. Treatment given early works best.";

const DISEASES = [
  // ── Cattle ─────────────────────────────────────────────────────────────
  {
    name: "East Coast fever (ECF)",
    scientificName: "Theileria parva",
    kind: "disease",
    hosts: ["cattle"],
    symptoms:
      "High fever. Swollen glands below the ear and in front of the shoulder. Not eating, losing weight, tears and runny nose, hard breathing. Spread by the brown ear tick. Often kills in 2-3 weeks without treatment.",
    symptomTags: ["fever", "swelling", "not_eating", "weight_loss", "discharge", "coughing", "ticks_lice"],
    source: MERCK("Theileriosis in Animals", "circulatory-system/blood-parasites/theileriosis-in-animals"),
    treatments: [
      { kind: "cultural", text: CALL_VET_EARLY + " Late treatment often fails." },
      { kind: "chemical", text: "Control ticks: spray or dip cattle regularly with a tick killer (acaricide) your vet recommends." },
      { kind: "cultural", text: "Ask your vet about ECF immunisation for calves and new cattle before they graze tick-infested pasture." },
    ],
  },
  {
    name: "Foot-and-mouth disease (FMD)",
    kind: "disease",
    hosts: ["cattle", "goats", "sheep", "pigs"],
    symptoms:
      "Fever. Blisters and sores on the tongue, lips, gums, feet and teats. Heavy drooling, limping, not wanting to walk, less milk. Young animals can die suddenly. In goats and sheep the signs can be mild, often limping first.",
    symptomTags: ["fever", "mouth_sores", "limping", "not_eating", "less_milk_eggs", "sudden_deaths"],
    source: MERCK("Foot-and-Mouth Disease in Animals", "infectious-diseases/foot-and-mouth-disease/foot-and-mouth-disease-in-animals"),
    treatments: [
      { kind: "cultural", text: REPORT_DVO },
      { kind: "cultural", text: "Keep sick animals apart. Do not share grazing, water points or equipment with other herds." },
      { kind: "cultural", text: "Vaccinate your herd when your vet or the district runs FMD vaccination. Protection lasts about 4-6 months." },
    ],
  },
  {
    name: "Lumpy skin disease (LSD)",
    kind: "disease",
    hosts: ["cattle"],
    symptoms:
      "Fever, tears, runny nose and drooling, then firm painful lumps all over the skin. Swollen glands and swollen legs. Less milk. Spread by biting flies and mosquitoes.",
    symptomTags: ["fever", "skin_sores", "swelling", "discharge", "less_milk_eggs"],
    source: MERCK("Lumpy Skin Disease in Cattle", "integumentary-system/pox-diseases/lumpy-skin-disease-in-cattle"),
    treatments: [
      { kind: "cultural", text: REPORT_DVO },
      { kind: "cultural", text: "Vaccinate cattle against lumpy skin disease. Vaccination is the main protection." },
      { kind: "cultural", text: "Keep sick animals apart and reduce biting flies and mosquitoes around the kraal. Ask a vet to treat infected sores." },
    ],
  },
  {
    name: "Anaplasmosis (gall sickness)",
    kind: "disease",
    hosts: ["cattle", "goats", "sheep"],
    symptoms:
      "Fever, weakness, pale gums and eyelids (low blood), losing weight, less milk. Pregnant cows may abort. Older cattle get sicker than calves. Spread by ticks, and by needles or tools used on many animals.",
    symptomTags: ["fever", "weak_lying", "weight_loss", "less_milk_eggs", "not_eating", "ticks_lice"],
    source: MERCK("Anaplasmosis in Ruminants", "circulatory-system/blood-parasites/anaplasmosis-in-ruminants"),
    treatments: [
      { kind: "cultural", text: CALL_VET_EARLY },
      { kind: "chemical", text: "Control ticks: spray or dip regularly with a tick killer (acaricide) your vet recommends." },
      { kind: "cultural", text: "Use a clean needle for every animal and clean tools between animals." },
    ],
  },
  {
    name: "Trypanosomiasis (nagana)",
    kind: "disease",
    hosts: ["cattle", "goats", "sheep"],
    symptoms:
      "Fever that comes and goes, weakness, pale gums (low blood), losing weight and poor condition over weeks. Spread by tsetse flies.",
    symptomTags: ["fever", "weak_lying", "weight_loss", "not_eating"],
    source: MERCK("Trypanosomiasis in Animals", "circulatory-system/blood-parasites/trypanosomiasis-in-animals"),
    treatments: [
      { kind: "cultural", text: "Call a vet to test the blood and treat the animal." },
      { kind: "cultural", text: "Reduce tsetse flies: use fly traps and targets, and ask your vet about insecticide pour-on or spray for cattle." },
    ],
  },
  {
    name: "Mastitis (udder infection)",
    kind: "disease",
    hosts: ["cattle", "goats"],
    symptoms:
      "Swollen, hot, painful or red udder. Milk looks abnormal - watery, clots or a different colour. Less milk. Some animals get a fever.",
    symptomTags: ["swelling", "less_milk_eggs", "fever"],
    source: MERCK("Mastitis in Cattle", "reproductive-system/mastitis-in-large-animals/mastitis-in-cattle"),
    treatments: [
      { kind: "cultural", text: "Call a vet to treat it. After antibiotics, keep the milk out of sale for as long as the vet says." },
      { kind: "cultural", text: "Dip every teat in teat dip after milking. Milk with clean hands and a clean cloth for each animal." },
      { kind: "cultural", text: "Keep the resting area clean and dry." },
    ],
  },
  // ── Goats and sheep ────────────────────────────────────────────────────
  {
    name: "Peste des petits ruminants (PPR, goat plague)",
    kind: "disease",
    hosts: ["goats", "sheep"],
    symptoms:
      "Fever, sores in the mouth, crusted eyes and a smelly runny nose, coughing, then heavy diarrhoea. Animals get thin and weak and many die within 5-10 days.",
    symptomTags: ["fever", "mouth_sores", "discharge", "coughing", "diarrhoea", "sudden_deaths", "not_eating"],
    source: MERCK("Peste des Petits Ruminants", "generalized-conditions/peste-des-petits-ruminants/peste-des-petits-ruminants"),
    treatments: [
      { kind: "cultural", text: REPORT_DVO },
      { kind: "cultural", text: "Vaccinate goats and sheep against PPR. One vaccination protects for more than a year." },
      { kind: "cultural", text: "Keep sick animals apart. A vet can treat other infections that follow, which saves more animals." },
    ],
  },
  {
    name: "Contagious caprine pleuropneumonia (CCPP)",
    kind: "disease",
    hosts: ["goats"],
    symptoms:
      "Weak, not eating, fever, coughing, fast or hard breathing, runny nose, sometimes frothy drooling and open-mouth breathing. Spreads fast through a herd and many goats can die.",
    symptomTags: ["coughing", "fever", "discharge", "not_eating", "weak_lying", "sudden_deaths"],
    source: MERCK("Mycoplasma Pneumonias in Goats", "respiratory-system/respiratory-diseases-of-sheep-and-goats/contagious-caprine-pleuropneumonia"),
    treatments: [
      { kind: "cultural", text: CALL_VET_EARLY },
      { kind: "cultural", text: "Keep new goats apart for some weeks before they join the herd, and keep sick goats apart." },
      { kind: "cultural", text: "Ask your vet about CCPP vaccination." },
    ],
  },
  {
    name: "Barber's pole worm and stomach worms",
    scientificName: "Haemonchus contortus",
    kind: "pest",
    hosts: ["goats", "sheep", "cattle"],
    symptoms:
      "Pale inside of the lower eyelid and pale gums, weakness, swelling under the jaw (bottle jaw), losing weight, rough coat, diarrhoea. Heavy worm loads can kill young animals quickly.",
    symptomTags: ["weak_lying", "swelling", "weight_loss", "diarrhoea", "hair_feather_loss", "sudden_deaths"],
    source: MERCK(
      "Common Gastrointestinal Parasites of Small Ruminants",
      "digestive-system/gastrointestinal-parasites-of-ruminants/common-gastrointestinal-parasites-of-small-ruminants"
    ),
    treatments: [
      { kind: "cultural", text: "Check the colour inside the lower eyelid (FAMACHA). Pale pink or white means that animal needs deworming." },
      { kind: "chemical", text: "Deworm with a dewormer your vet recommends, at the full dose for the animal's weight." },
      { kind: "cultural", text: "Move animals to clean pasture when you can, and do not let them graze very short grass." },
    ],
  },
  // ── Pigs ────────────────────────────────────────────────────────────────
  {
    name: "African swine fever (ASF)",
    kind: "disease",
    hosts: ["pigs"],
    symptoms:
      "High fever, red or purple ears and snout, then red or purple skin, bleeding from the nose or anus, not eating. Many pigs die quickly. There is no treatment or vaccine.",
    symptomTags: ["fever", "red_purple_skin", "not_eating", "weak_lying", "sudden_deaths", "diarrhoea"],
    source: MERCK("African Swine Fever", "generalized-conditions/african-swine-fever/african-swine-fever"),
    treatments: [
      { kind: "cultural", text: REPORT_DVO + " Do not sell or eat pork from sick or dead pigs." },
      { kind: "cultural", text: "Never feed pigs kitchen or hotel waste that may contain uncooked pork." },
      { kind: "cultural", text: "Keep pigs fenced or housed, keep visitors and other pigs away, and clean shoes and tools." },
    ],
  },
  // ── Chickens ────────────────────────────────────────────────────────────
  {
    name: "Newcastle disease",
    kind: "disease",
    hosts: ["chickens"],
    symptoms:
      "Hard breathing, weakness, twisted neck, shaking, green watery droppings, fewer or misshapen eggs, and many birds dying suddenly.",
    symptomTags: ["coughing", "weak_lying", "nervous_signs", "diarrhoea", "less_milk_eggs", "sudden_deaths"],
    source: MERCK("Newcastle Disease in Poultry", "poultry/newcastle-disease-and-other-paramyxovirus-infections/newcastle-disease-in-poultry"),
    treatments: [
      { kind: "cultural", text: "There is no treatment. " + REPORT_DVO },
      { kind: "cultural", text: "Vaccinate all birds regularly against Newcastle disease, as your vet advises." },
      { kind: "cultural", text: "Keep new and sick birds apart, keep wild birds out, and clean the house and drinkers." },
    ],
  },
  {
    name: "Coccidiosis",
    kind: "disease",
    hosts: ["chickens"],
    symptoms: "Diarrhoea, often with blood, dull birds, and deaths. Usually young birds of 1-4 months.",
    symptomTags: ["diarrhoea", "weak_lying", "not_eating", "sudden_deaths"],
    source: MERCK(
      "Common Infectious Diseases in Backyard Poultry",
      "exotic-and-laboratory-animals/backyard-poultry/common-infectious-diseases-in-backyard-poultry"
    ),
    treatments: [
      { kind: "cultural", text: "Keep litter dry and change wet litter. Do not keep too many birds in one house." },
      { kind: "chemical", text: "Ask a vet for a coccidiosis medicine. Some are not allowed for laying hens." },
    ],
  },
  {
    name: "Gumboro (infectious bursal disease)",
    kind: "disease",
    hosts: ["chickens"],
    symptoms: "Young chicks (3-6 weeks) become very weak, with watery diarrhoea and ruffled feathers. Some die, and survivors catch other diseases easily.",
    symptomTags: ["weak_lying", "diarrhoea", "not_eating", "sudden_deaths"],
    source: MERCK("Infectious Bursal Disease in Poultry", "poultry/infectious-bursal-disease/infectious-bursal-disease-in-poultry"),
    treatments: [
      { kind: "cultural", text: "There is no treatment. Vaccinate chicks against Gumboro on the schedule your vet or hatchery gives." },
      { kind: "cultural", text: "Clean and disinfect the house well between batches of chicks." },
    ],
  },
  {
    name: "Fowl pox",
    kind: "disease",
    hosts: ["chickens"],
    symptoms: "Crusty, wart-like lumps on the comb, wattles and face. Sometimes sores in the mouth and throat that make breathing hard. Spread by mosquitoes.",
    symptomTags: ["skin_sores", "mouth_sores", "coughing", "less_milk_eggs"],
    source: MERCK(
      "Common Infectious Diseases in Backyard Poultry",
      "exotic-and-laboratory-animals/backyard-poultry/common-infectious-diseases-in-backyard-poultry"
    ),
    treatments: [
      { kind: "cultural", text: "Vaccinate the flock against fowl pox, especially if pox was seen before or is nearby." },
      { kind: "cultural", text: "Reduce mosquitoes around the chicken house and keep sick birds apart." },
    ],
  },
];

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const url = arg("url");
  const adminId = arg("admin");
  if (!url || !adminId) {
    console.error("Usage: node scripts/seed-diagnostics-livestock.mjs --url <CONVEX_URL> --admin <superAdminUserId> [--approve]");
    process.exit(1);
  }
  const client = new ConvexHttpClient(url);

  const existing = new Set();
  for (const status of ["pending_review", "active", "rejected", "removed"]) {
    const rows = await client.query(api.diagnostics.listConditions, { adminId, status });
    rows.forEach((r) => existing.add(r.name.toLowerCase()));
  }

  for (const d of DISEASES) {
    if (existing.has(d.name.toLowerCase())) {
      console.log(`skip  ${d.name} (already in the library)`);
      continue;
    }
    const conditionId = await client.mutation(api.diagnostics.addCondition, {
      adminId,
      name: d.name,
      scientificName: d.scientificName,
      kind: d.kind,
      hosts: d.hosts,
      symptoms: d.symptoms,
      symptomTags: d.symptomTags,
      ...d.source,
    });
    for (const t of d.treatments) {
      await client.mutation(api.diagnostics.addTreatment, { adminId, conditionId, kind: t.kind, text: t.text, ...d.source });
    }
    console.log(`added ${d.name}`);
  }

  if (!process.argv.includes("--approve")) return;
  const wanted = new Set(DISEASES.map((d) => d.name.toLowerCase()));
  const rows = await client.query(api.diagnostics.listConditions, { adminId, status: "pending_review" });
  for (const entry of rows.filter((r) => wanted.has(r.name.toLowerCase()))) {
    const detail = await client.query(api.diagnostics.getCondition, { adminId, conditionId: entry._id });
    if (!detail) continue;
    const pending = [
      { itemType: "condition", itemId: String(detail.condition._id) },
      ...detail.treatments.filter((t) => t.status === "pending_review").map((t) => ({ itemType: "treatment", itemId: String(t._id) })),
    ];
    for (const item of pending) {
      await client.mutation(api.diagnostics.reviewItem, { adminId, ...item, decision: "approve", note: "Livestock library go-live" });
    }
    console.log(`approved  ${entry.name} (${pending.length} items)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
