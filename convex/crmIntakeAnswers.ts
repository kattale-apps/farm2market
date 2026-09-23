/**
 * The answers captured on a submission, read straight from what was stored.
 *
 * Built from the submission's own `crmFormResponseValues` rows, not from the
 * form's current question list. Intake only stores questions that were filled
 * in, so listing every question on the form padded the result with blanks that
 * were never answered and made an empty submission look like it had answers.
 * Values are returned exactly as stored, ordered as the questions appear on
 * the form; a value whose question has since gone is kept, labelled as such,
 * rather than silently dropped.
 */
export function createIntakeAnswerLoader(ctx: any) {
  const fieldCache = new Map<string, any>();

  const loadField = async (crmFieldId: any) => {
    const key = String(crmFieldId);
    if (!fieldCache.has(key)) {
      fieldCache.set(key, await ctx.db.get(crmFieldId));
    }
    return fieldCache.get(key);
  };

  return async (crmResponseId: any) => {
    if (!crmResponseId) return [];

    const values = await ctx.db
      .query("crmFormResponseValues")
      .withIndex("by_response", (q: any) => q.eq("crmResponseId", crmResponseId))
      .collect();

    const rows = await Promise.all(
      values
        .filter((row: any) => String(row.value ?? "").trim() !== "")
        .map(async (row: any) => {
          const field = await loadField(row.crmFieldId);
          return {
            fieldId: String(row.crmFieldId),
            label: field?.label || "Removed question",
            fieldType: field?.fieldType || "text",
            value: row.value,
            order: field ? Number(field.order || 0) : Number.MAX_SAFE_INTEGER,
          };
        })
    );

    return rows
      .sort((a, b) => a.order - b.order)
      .map(({ order: _order, ...answer }) => answer);
  };
}
