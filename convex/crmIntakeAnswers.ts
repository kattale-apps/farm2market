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

/**
 * The most recent call logged on a lead and what was recorded on it, read
 * straight from crmCallLogs/crmCallAnswers. Answer labels are the snapshot
 * taken when the call was saved, so they read as the agent saw them even if
 * the question was renamed since. Returns null when no call has been logged.
 */
export async function loadLastCall(
  ctx: any,
  leadId: any,
  resolveAgentName: (agentId: any) => Promise<string>
) {
  const logs = await ctx.db
    .query("crmCallLogs")
    .withIndex("by_lead", (q: any) => q.eq("leadId", leadId))
    .collect();
  if (logs.length === 0) return null;

  const last = logs.reduce((latest: any, row: any) =>
    Number(row.createdAt || 0) > Number(latest.createdAt || 0) ? row : latest
  );

  const answers = await ctx.db
    .query("crmCallAnswers")
    .withIndex("by_call", (q: any) => q.eq("callLogId", last._id))
    .collect();

  return {
    callId: String(last._id),
    createdAt: last.createdAt,
    outcome: last.outcome,
    notes: last.notes || null,
    agentName: await resolveAgentName(last.agentId),
    answers: answers
      .filter((row: any) => String(row.value ?? "").trim() !== "")
      .map((row: any) => ({ answerId: String(row._id), label: row.label, value: row.value })),
  };
}
