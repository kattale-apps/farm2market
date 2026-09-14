import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDistrictMatcher,
  foldDistrictText,
  levenshtein,
  tallyDistricts,
} from "../app/utils/districtNormalization";

/**
 * A representative slice of the real district list, deliberately including the
 * pairs that sit one or two edits apart — Kalungu/Kanungu, Buyende/Mubende,
 * Kabale/Mbale/Kibaale. Those are what a fuzzy matcher gets wrong.
 */
const CANONICAL = [
  "Mubende",
  "Buyende",
  "Mityana",
  "Mukono",
  "Kampala",
  "Luweero",
  "Masaka",
  "Mpigi",
  "Kalungu",
  "Kanungu",
  "Kabale",
  "Kibaale",
  "Mbale",
  "Lira",
  "Kamuli",
  "Wakiso",
  "Kayunga",
];

const match = buildDistrictMatcher(CANONICAL);

test("levenshtein reports plain edit distance", () => {
  assert.equal(levenshtein("MUBENDE", "MUBENDE"), 0);
  assert.equal(levenshtein("MUBBENDE", "MUBENDE"), 1);
  assert.equal(levenshtein("KALUNGU", "KANUNGU"), 1);
});

test("levenshtein stops early once past the cap", () => {
  // Only the fact that it exceeded the cap matters, not the exact value.
  assert.ok(levenshtein("KAMPALA", "MITYANA", 2) > 2);
});

test("folding strips case, accents and punctuation", () => {
  assert.equal(foldDistrictText("  mubende  "), "MUBENDE");
  assert.equal(foldDistrictText("MASAKA-NYENDO"), "MASAKA NYENDO");
  assert.equal(foldDistrictText("LIRA/ENTEBBE"), "LIRA ENTEBBE");
});

test("case and spacing variants resolve to one district", () => {
  for (const variant of ["MUBENDE", "Mubende", "mubende", "  Mubende "]) {
    const result = match(variant);
    assert.equal(result.canonical, "Mubende", `failed for ${variant}`);
    assert.equal(result.method, "exact");
  }
});

test("administrative suffixes are stripped", () => {
  assert.equal(match("MUBENDE T/C").canonical, "Mubende");
  assert.equal(match("MASAKA DLG").canonical, "Masaka");
  assert.equal(match("MASAKA CITY").canonical, "Masaka");
  assert.equal(match("Kampala District").canonical, "Kampala");
});

test("a district is recovered from a compound value", () => {
  const masaka = match("MASAKA-NYENDO");
  assert.equal(masaka.canonical, "Masaka");
  assert.equal(masaka.method, "compound");

  assert.equal(match("KIKUUYU-MITYANA").canonical, "Mityana");
  assert.equal(match("MITYANA-SINGO").canonical, "Mityana");
});

test("a compound naming two real districts is left for a human", () => {
  const ambiguous = match("LIRA/MBALE");
  assert.equal(ambiguous.canonical, null);
  assert.equal(ambiguous.method, "unrecognised");
});

test("an unambiguous misspelling is corrected", () => {
  const fixed = match("MUBBENDE");
  assert.equal(fixed.canonical, "Mubende");
  assert.equal(fixed.method, "spelling");

  assert.equal(match("MUKKONO").canonical, "Mukono");
  assert.equal(match("KAMPPALA").canonical, "Kampala");
});

test("real districts are never absorbed into their near neighbours", () => {
  // These are distinct places whose names are 1-2 edits apart. Each must
  // resolve to itself and nothing else.
  const pairs: Array<[string, string]> = [
    ["Kalungu", "Kalungu"],
    ["Kanungu", "Kanungu"],
    ["Mubende", "Mubende"],
    ["Buyende", "Buyende"],
    ["Kabale", "Kabale"],
    ["Kibaale", "Kibaale"],
    ["Mbale", "Mbale"],
  ];
  for (const [input, expected] of pairs) {
    const result = match(input);
    assert.equal(result.canonical, expected, `${input} resolved to ${result.canonical}`);
    assert.equal(result.method, "exact");
  }
});

test("a typo sitting between two real districts is flagged, not guessed", () => {
  // KALUNGO is one edit from Kalungu and two from Kanungu. Guessing here
  // would silently move members between districts, so it must be reported.
  const result = match("KALUNGO");
  assert.equal(result.canonical, null);
  assert.equal(result.method, "unrecognised");
});

test("short and unknown values are not force-fitted", () => {
  assert.equal(match("KANYIZA FOOD SECURITY").canonical, null);
  assert.equal(match("XYZ").canonical, null);
  assert.equal(match("").canonical, null);
});

test("tally folds spellings together and reports what it assumed", () => {
  const rawValues = [
    "Mubende", "MUBENDE", "mubende", "MUBBENDE", "MUBENDE T/C",
    "Mityana", "KIKUUYU-MITYANA",
    "Kampala",
    "KANYIZA FOOD SECURITY",
    "KALUNGO",
  ];

  const tally = tallyDistricts(rawValues, CANONICAL);

  assert.equal(tally.rawSpellings, 10, "distinct raw spellings seen");
  assert.equal(tally.distinctDistricts, 3, "Mubende, Mityana, Kampala");

  const mubende = tally.districts.find((d) => d.name === "Mubende");
  assert.equal(mubende?.value, 5, "all five Mubende spellings counted once");
  assert.equal(tally.districts[0].name, "Mubende", "sorted by member count");

  assert.equal(tally.unrecognisedMembers, 2);
  assert.deepEqual(
    tally.unrecognised.map((u) => u.raw).sort(),
    ["KALUNGO", "KANYIZA FOOD SECURITY"]
  );

  // Every non-exact assumption is auditable. "MUBENDE T/C" is absent because
  // stripping a town-council suffix leaves an exact match, not a guess.
  const corrected = tally.corrections.map((c) => `${c.raw}->${c.canonical}:${c.method}`).sort();
  assert.deepEqual(corrected, [
    "KIKUUYU-MITYANA->Mityana:compound",
    "MUBBENDE->Mubende:spelling",
  ]);
});

test("without a canonical list it still merges case duplicates", () => {
  const tally = tallyDistricts(["MUBENDE", "Mubende", "mubende"], []);
  assert.equal(tally.distinctDistricts, 1);
  assert.equal(tally.districts[0].name, "Mubende");
  assert.equal(tally.districts[0].value, 3);
});
