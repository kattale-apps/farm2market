/**
 * MarketSpace questions: buyers never write free text to sellers. They pick
 * questions from a pool the super admin keeps, and the poster answers with
 * typed inputs (yes/no, a number, a choice or a date). Each question is asked
 * once per post and its answer is shared with every buyer allowed to see the
 * post. On wanted ads it works the other way: suppliers respond by answering
 * the poster's questions (how much, what price, can you deliver).
 *
 * Pure rules only (tested in tests/enquiries.test.ts); the database side is
 * convex/enquiries.ts.
 */
import { v } from "convex/values";

export const answerTypeValidator = v.union(v.literal("yes_no"), v.literal("number"), v.literal("choice"), v.literal("date"));
export type AnswerType = "yes_no" | "number" | "choice" | "date";

/** Which posts a question fits: lot listings, bulk lots, classified offers, wanted ads. */
export const audienceValidator = v.union(v.literal("lots"), v.literal("bulk"), v.literal("offer"), v.literal("wanted"));
export type Audience = "lots" | "bulk" | "offer" | "wanted";
export const AUDIENCES: { key: Audience; label: string }[] = [
  { key: "lots", label: "Produce and lots" },
  { key: "bulk", label: "Bulk lots only" },
  { key: "offer", label: "Classified offers" },
  { key: "wanted", label: "Wanted ads (suppliers answer)" },
];

/** One typed answer: only the field of the question's type is set. */
export const answerValidator = v.object({
  yes: v.optional(v.boolean()),
  number: v.optional(v.number()),
  choice: v.optional(v.string()),
  date: v.optional(v.string()), // YYYY-MM-DD
});
export type Answer = { yes?: boolean; number?: number; choice?: string; date?: string };

export type QuestionRule = { answerType: AnswerType; unit?: string; choices?: string[] };

export const MAX_QUESTIONS_PER_ASK = 5;
export const MAX_ASKS_PER_POST = 10; // One buyer, one post: questions in total
export const QUESTION_TEXT_MAX = 120;
export const MAX_CHOICES = 8;
export const CHOICE_MAX = 40;
export const ADMIN_NOTE_MAX = 300;

/** The audiences of a post: listing cards are lots (and bulk); ads are offers or wanted. */
export function audiencesOf(card: { sourceKind: "listing" | "ad"; isBulk: boolean; kind: "offer" | "wanted" }): Audience[] {
  if (card.sourceKind === "listing") return card.isBulk ? ["lots", "bulk"] : ["lots"];
  return [card.kind];
}

/** Bulk-only questions need a bulk post; the others need any one audience in common. */
export function questionFits(appliesTo: Audience[], postAudiences: Audience[]): boolean {
  if (appliesTo.includes("bulk") && !appliesTo.includes("lots")) return postAudiences.includes("bulk");
  return appliesTo.some((a) => postAudiences.includes(a));
}

/** Wanted ads collect suppliers' responses; every other post collects buyers' questions. */
export function questionMode(card: { sourceKind: "listing" | "ad"; kind: "offer" | "wanted" }): "ask" | "respond" {
  return card.sourceKind === "ad" && card.kind === "wanted" ? "respond" : "ask";
}

function validDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/** Checks an answer against its question; returns the clean answer (only its type's field) or the problem. */
export function checkAnswer(q: QuestionRule, a: Answer): { answer: Answer } | { problem: string } {
  switch (q.answerType) {
    case "yes_no":
      return typeof a.yes === "boolean" ? { answer: { yes: a.yes } } : { problem: "Choose Yes or No" };
    case "number":
      return typeof a.number === "number" && Number.isFinite(a.number) && a.number >= 0 && a.number <= 1e12
        ? { answer: { number: Math.round(a.number * 100) / 100 } }
        : { problem: "Enter a number (0 or more)" };
    case "choice":
      return a.choice !== undefined && (q.choices ?? []).includes(a.choice) ? { answer: { choice: a.choice } } : { problem: "Choose one of the answers" };
    case "date":
      return a.date !== undefined && validDate(a.date) ? { answer: { date: a.date } } : { problem: "Choose a date" };
  }
}

/** How an answer reads on a post: "Yes", "14 %", "Grade 1", "12 Nov 2026". */
export function answerText(q: QuestionRule, a: Answer): string {
  if (q.answerType === "yes_no") return a.yes ? "Yes" : "No";
  if (q.answerType === "number") return `${(a.number ?? 0).toLocaleString("en-US")}${q.unit ? ` ${q.unit}` : ""}`;
  if (q.answerType === "choice") return a.choice ?? "";
  const d = new Date(`${a.date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Checks a question the super admin writes; returns the problem, or null. */
export function questionProblem(q: { text: string; answerType: AnswerType; unit?: string; choices?: string[]; appliesTo: Audience[] }): string | null {
  const text = q.text.trim();
  if (text.length < 5 || text.length > QUESTION_TEXT_MAX) return `Write the question in 5 to ${QUESTION_TEXT_MAX} letters`;
  if (q.appliesTo.length === 0) return "Choose which posts the question is for";
  if ((q.unit ?? "").trim().length > 12) return "Keep the unit short, e.g. kg, %, UGX";
  if (q.answerType === "choice") {
    const choices = (q.choices ?? []).map((c) => c.trim()).filter(Boolean);
    if (choices.length < 2 || choices.length > MAX_CHOICES) return `Give 2 to ${MAX_CHOICES} answers to choose from`;
    if (new Set(choices.map((c) => c.toLowerCase())).size !== choices.length) return "Each answer to choose from must be different";
    if (choices.some((c) => c.length > CHOICE_MAX)) return `Keep each answer under ${CHOICE_MAX} letters`;
  }
  return null;
}

/** The starter pool, added once by the super admin (or the dev seed). */
export const STARTER_QUESTIONS: { text: string; answerType: AnswerType; unit?: string; choices?: string[]; appliesTo: Audience[] }[] = [
  { text: "What is the moisture content?", answerType: "number", unit: "%", appliesTo: ["lots"] },
  { text: "What grade is it?", answerType: "choice", choices: ["Grade 1", "Grade 2", "Grade 3", "Ungraded"], appliesTo: ["lots"] },
  { text: "Is it certified organic?", answerType: "yes_no", appliesTo: ["lots", "offer"] },
  { text: "When is it available from?", answerType: "date", appliesTo: ["lots", "offer"] },
  { text: "Can you deliver?", answerType: "yes_no", appliesTo: ["lots", "offer"] },
  { text: "Where can you deliver?", answerType: "choice", choices: ["My district only", "Nearby districts", "Anywhere in Uganda"], appliesTo: ["lots", "offer"] },
  { text: "What is the smallest number of lots you sell?", answerType: "number", unit: "lots", appliesTo: ["bulk"] },
  { text: "Is a sample available?", answerType: "yes_no", appliesTo: ["lots", "offer"] },
  { text: "How much can you supply?", answerType: "number", unit: "kg", appliesTo: ["wanted"] },
  { text: "What is your price per unit?", answerType: "number", unit: "UGX", appliesTo: ["wanted"] },
  { text: "Can you deliver to my district?", answerType: "yes_no", appliesTo: ["wanted"] },
];
