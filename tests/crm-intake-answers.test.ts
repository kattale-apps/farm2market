import test from "node:test";
import assert from "node:assert/strict";

import { createIntakeAnswerLoader } from "../convex/crmIntakeAnswers";

// Just enough of ctx.db for the loader: get() by id and the by_response index.
function fakeCtx(fields: Record<string, any>, values: any[]) {
  return {
    db: {
      get: async (id: string) => fields[id] ?? null,
      query: (_table: string) => ({
        withIndex: (_index: string, build: (q: any) => any) => {
          let responseId: string | undefined;
          build({ eq: (_f: string, v: string) => { responseId = v; return {}; } });
          return { collect: async () => values.filter((row) => row.crmResponseId === responseId) };
        },
      }),
    },
  };
}

test("returns exactly the stored values, in form order", async () => {
  const ctx = fakeCtx(
    {
      f1: { label: "Did the customer use the product?", fieldType: "select", order: 1 },
      f2: { label: "Notes", fieldType: "textarea", order: 5 },
    },
    [
      { crmResponseId: "r1", crmFieldId: "f2", value: "  Farmer said: call after 5pm  " },
      { crmResponseId: "r1", crmFieldId: "f1", value: "Yes" },
      { crmResponseId: "r2", crmFieldId: "f1", value: "No" },
    ]
  );

  const answers = await createIntakeAnswerLoader(ctx)("r1");

  assert.deepEqual(answers, [
    { fieldId: "f1", label: "Did the customer use the product?", fieldType: "select", value: "Yes" },
    // Stored text is passed through untouched, whitespace included.
    { fieldId: "f2", label: "Notes", fieldType: "textarea", value: "  Farmer said: call after 5pm  " },
  ]);
});

test("a submission with nothing stored has no answers, not a list of blanks", async () => {
  const ctx = fakeCtx({ f1: { label: "Q", fieldType: "text", order: 1 } }, [
    { crmResponseId: "r1", crmFieldId: "f1", value: "   " },
  ]);
  const load = createIntakeAnswerLoader(ctx);

  assert.deepEqual(await load("r1"), []);
  assert.deepEqual(await load("r-none"), []);
  assert.deepEqual(await load(undefined), []);
});

test("a value whose question was removed is kept, not dropped", async () => {
  const ctx = fakeCtx({}, [{ crmResponseId: "r1", crmFieldId: "gone", value: "2 litres" }]);

  const answers = await createIntakeAnswerLoader(ctx)("r1");

  assert.deepEqual(answers, [
    { fieldId: "gone", label: "Removed question", fieldType: "text", value: "2 litres" },
  ]);
});

import { loadLastCall } from "../convex/crmIntakeAnswers";

function fakeCallCtx(logs: any[], answers: any[]) {
  return {
    db: {
      query: (table: string) => ({
        withIndex: (_index: string, build: (q: any) => any) => {
          let key: string | undefined;
          build({ eq: (_f: string, v: string) => { key = v; return {}; } });
          const rows = table === "crmCallLogs"
            ? logs.filter((row) => row.leadId === key)
            : answers.filter((row) => row.callLogId === key);
          return { collect: async () => rows };
        },
      }),
    },
  };
}

test("last call is the newest log, with its stored answers and notes", async () => {
  const ctx = fakeCallCtx(
    [
      { _id: "c1", leadId: "L1", createdAt: 100, outcome: "no_answer", agentId: "a1" },
      { _id: "c2", leadId: "L1", createdAt: 300, outcome: "problem", agentId: "a2", notes: "Leaves yellowing" },
      { _id: "c3", leadId: "L2", createdAt: 999, outcome: "good_result", agentId: "a1" },
    ],
    [
      { _id: "x1", callLogId: "c2", label: "Any problem?", value: "Product problem" },
      { _id: "x2", callLogId: "c2", label: "Notes", value: "  " },
      { _id: "x3", callLogId: "c1", label: "Any problem?", value: "No" },
    ]
  );

  const last = await loadLastCall(ctx, "L1", async (id) => `Agent ${id}`);

  assert.deepEqual(last, {
    callId: "c2",
    createdAt: 300,
    outcome: "problem",
    notes: "Leaves yellowing",
    agentName: "Agent a2",
    answers: [{ answerId: "x1", label: "Any problem?", value: "Product problem" }],
  });
});

test("a lead never called has no last call", async () => {
  assert.equal(await loadLastCall(fakeCallCtx([], []), "L1", async () => "x"), null);
});
