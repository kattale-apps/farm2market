import test from "node:test";
import assert from "node:assert/strict";

import {
  ALLOWED_SCRIPT_TOKENS,
  DEFAULT_CRM_FORM_FIELDS,
  DEFAULT_OPENING_SCRIPT_TEMPLATE,
  PRESET_KEYS,
  literalForPresetAnswer,
} from "../convex/crmPresets";

test("a form answer decides the outcome column it is tagged with", () => {
  assert.equal(literalForPresetAnswer(PRESET_KEYS.usageStatus, "Partly"), "partly");
  assert.equal(literalForPresetAnswer(PRESET_KEYS.resultRating, "Very good"), "very_good");
  assert.equal(literalForPresetAnswer(PRESET_KEYS.repurchaseIntent, "Maybe"), "maybe");
  assert.equal(
    literalForPresetAnswer(PRESET_KEYS.issueType, "Delivery problem"),
    "delivery_problem"
  );
});

test("option text is matched regardless of case, spacing or punctuation", () => {
  assert.equal(literalForPresetAnswer(PRESET_KEYS.usageStatus, "  YES  "), "yes");
  assert.equal(literalForPresetAnswer(PRESET_KEYS.usageStatus, "Don't know"), "unknown");
  assert.equal(literalForPresetAnswer(PRESET_KEYS.usageStatus, "dont know"), "unknown");
  assert.equal(literalForPresetAnswer(PRESET_KEYS.resultRating, "very POOR"), "very_poor");
});

test("an answer nobody gave never becomes a value", () => {
  // The whole point of the change: blank stays blank instead of defaulting to
  // the most positive option, so an unworked call cannot read as a happy one.
  assert.equal(literalForPresetAnswer(PRESET_KEYS.usageStatus, ""), null);
  assert.equal(literalForPresetAnswer(PRESET_KEYS.repurchaseIntent, "   "), null);
});

test("an unrecognised option is left unset rather than guessed", () => {
  assert.equal(literalForPresetAnswer(PRESET_KEYS.resultRating, "Spectacular"), null);
  assert.equal(literalForPresetAnswer("not_a_preset", "Yes"), null);
});

test("wording changes that keep the same meaning still map", () => {
  // A supervisor is free to reword the default questions for their own
  // product, so the common rewordings resolve to the same literal.
  assert.equal(literalForPresetAnswer(PRESET_KEYS.issueType, "No problem"), "none");
  assert.equal(
    literalForPresetAnswer(PRESET_KEYS.issueType, "Farmer needs technical advice"),
    "technical_advice"
  );
  assert.equal(
    literalForPresetAnswer(PRESET_KEYS.issueType, "Customer needs technical advice"),
    "technical_advice"
  );
});

test("every default question can be read back into its column", () => {
  for (const field of DEFAULT_CRM_FORM_FIELDS) {
    if (field.presetKey === PRESET_KEYS.notes) continue;
    for (const option of (field as any).options as string[]) {
      assert.notEqual(
        literalForPresetAnswer(field.presetKey, option),
        null,
        `default option "${option}" on "${field.label}" does not map to a stored value`
      );
    }
  }
});

test("the default opening script names no specific company or product", () => {
  const script = DEFAULT_OPENING_SCRIPT_TEMPLATE.toLowerCase();
  for (const brandWord of ["bio farm", "biofarm", "fertilizer", "lumina", "solar"]) {
    assert.ok(
      !script.includes(brandWord),
      `the shared default script must not mention "${brandWord}" - it is sent to every community`
    );
  }

  assert.ok(script.includes("{{community_name}}"));
  assert.ok(script.includes("{{product_name}}"));
});

test("the default script only uses tokens the backend will accept", () => {
  const used = (DEFAULT_OPENING_SCRIPT_TEMPLATE.match(/{{\s*([a-z_]+)\s*}}/g) || []).map(
    (token) => token.replace(/{{\s*|\s*}}/g, "")
  );

  assert.ok(used.length > 0);
  for (const token of used) {
    assert.ok(
      (ALLOWED_SCRIPT_TOKENS as readonly string[]).includes(token),
      `default script uses {{${token}}}, which assertScriptTemplateSafe would reject`
    );
  }
});
