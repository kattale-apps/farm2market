import assert from "node:assert/strict";
import test from "node:test";

import {
  STARTER_QUESTIONS,
  answerText,
  audiencesOf,
  checkAnswer,
  questionFits,
  questionMode,
  questionProblem,
} from "../convex/enquiriesShared";

test("answers are typed: yes/no, a number, one of the choices, or a date", () => {
  assert.deepEqual(checkAnswer({ answerType: "yes_no" }, { yes: false }), { answer: { yes: false } });
  assert.ok("problem" in checkAnswer({ answerType: "yes_no" }, {}));

  assert.deepEqual(checkAnswer({ answerType: "number", unit: "%" }, { number: 13.456 }), { answer: { number: 13.46 } });
  assert.ok("problem" in checkAnswer({ answerType: "number" }, { number: -1 }));
  assert.ok("problem" in checkAnswer({ answerType: "number" }, { number: Number.NaN }));

  const grade = { answerType: "choice" as const, choices: ["Grade 1", "Grade 2"] };
  assert.deepEqual(checkAnswer(grade, { choice: "Grade 2" }), { answer: { choice: "Grade 2" } });
  assert.ok("problem" in checkAnswer(grade, { choice: "Call me on 0772 123456" }), "free text is never an answer");

  assert.deepEqual(checkAnswer({ answerType: "date" }, { date: "2026-11-12" }), { answer: { date: "2026-11-12" } });
  assert.ok("problem" in checkAnswer({ answerType: "date" }, { date: "2026-02-30" }));
  assert.ok("problem" in checkAnswer({ answerType: "date" }, { date: "next week" }));
});

test("only the answer type's field is kept", () => {
  assert.deepEqual(checkAnswer({ answerType: "yes_no" }, { yes: true, choice: "extra", number: 5 }), { answer: { yes: true } });
});

test("answers read plainly on a post", () => {
  assert.equal(answerText({ answerType: "yes_no" }, { yes: true }), "Yes");
  assert.equal(answerText({ answerType: "number", unit: "%" }, { number: 14 }), "14 %");
  assert.equal(answerText({ answerType: "number", unit: "kg" }, { number: 12000 }), "12,000 kg");
  assert.equal(answerText({ answerType: "choice", choices: ["Grade 1"] }, { choice: "Grade 1" }), "Grade 1");
  assert.equal(answerText({ answerType: "date" }, { date: "2026-11-12" }), "12 Nov 2026");
});

test("each post takes the questions that fit it", () => {
  const lot = audiencesOf({ sourceKind: "listing", isBulk: false, kind: "offer" });
  const bulk = audiencesOf({ sourceKind: "listing", isBulk: true, kind: "offer" });
  const offer = audiencesOf({ sourceKind: "ad", isBulk: false, kind: "offer" });
  const wanted = audiencesOf({ sourceKind: "ad", isBulk: false, kind: "wanted" });
  assert.deepEqual(lot, ["lots"]);
  assert.deepEqual(bulk, ["lots", "bulk"]);

  assert.equal(questionFits(["lots"], lot), true);
  assert.equal(questionFits(["lots"], bulk), true);
  assert.equal(questionFits(["bulk"], lot), false, "bulk-only questions skip small lots");
  assert.equal(questionFits(["bulk"], bulk), true);
  assert.equal(questionFits(["lots", "offer"], offer), true);
  assert.equal(questionFits(["lots"], wanted), false);
  assert.equal(questionFits(["wanted"], wanted), true);

  assert.equal(questionMode({ sourceKind: "listing", kind: "offer" }), "ask");
  assert.equal(questionMode({ sourceKind: "ad", kind: "offer" }), "ask");
  assert.equal(questionMode({ sourceKind: "ad", kind: "wanted" }), "respond");
});

test("the super admin's questions are checked", () => {
  assert.equal(questionProblem({ text: "Is it sun dried?", answerType: "yes_no", appliesTo: ["lots"] }), null);
  assert.match(questionProblem({ text: "Dry?", answerType: "yes_no", appliesTo: ["lots"] }) ?? "", /5 to/);
  assert.match(questionProblem({ text: "Is it sun dried?", answerType: "yes_no", appliesTo: [] }) ?? "", /which posts/);
  assert.match(questionProblem({ text: "Which bag type?", answerType: "choice", choices: ["Sisal"], appliesTo: ["lots"] }) ?? "", /2 to/);
  assert.match(questionProblem({ text: "Which bag type?", answerType: "choice", choices: ["Sisal", "sisal"], appliesTo: ["lots"] }) ?? "", /different/);
});

test("every starter question is valid and the wanted ones ask suppliers", () => {
  for (const q of STARTER_QUESTIONS) assert.equal(questionProblem(q), null, q.text);
  const wanted = STARTER_QUESTIONS.filter((q) => q.appliesTo.includes("wanted")).map((q) => q.text);
  assert.deepEqual(wanted, ["How much can you supply?", "What is your price per unit?", "Can you deliver to my district?"]);
});
