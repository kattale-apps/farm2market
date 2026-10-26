"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { AUDIENCES, MAX_CHOICES, questionProblem, type AnswerType, type Audience } from "../../../convex/enquiriesShared";
import { FONT } from "./shared";

const errorText = (e: unknown) => (e as Error)?.message?.replace(/^.*Uncaught Error: /, "").split("\n")[0] ?? "Something went wrong.";

const ANSWER_TYPES: { key: AnswerType; label: string }[] = [
  { key: "yes_no", label: "Yes / No" },
  { key: "number", label: "Number" },
  { key: "choice", label: "Choose one" },
  { key: "date", label: "Date" },
];

type Draft = {
  id?: Id<"enquiryQuestions">;
  text: string;
  answerType: AnswerType;
  unit: string;
  choices: string; // One per line
  appliesTo: Audience[];
  active: boolean;
  sortOrder: number;
};

/**
 * The super admin's question pool: the only questions buyers can ask on
 * MarketSpace (and suppliers answer on wanted ads). Questions are retired,
 * not deleted, so old answers keep their wording.
 */
export function QuestionPool({ token }: { token: string }) {
  const questions = useQuery(api.enquiries.adminQuestions, { sessionToken: token });
  const save = useMutation(api.enquiries.saveQuestion);
  const addStarters = useMutation(api.enquiries.addStarterQuestions);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (questions === undefined) return <p>Loading…</p>;
  if (questions === null) return <p>Only the super admin can manage questions.</p>;

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setMessage(null);
    try {
      await fn();
      setMessage({ ok: true, text: done });
      return true;
    } catch (e) {
      setMessage({ ok: false, text: errorText(e) });
      return false;
    }
  };
  const input: React.CSSProperties = { padding: "0.55rem", borderRadius: 8, border: "1px solid #ccc", fontFamily: FONT, fontSize: "0.9rem", minWidth: 0 };
  const small = (color: string, filled = false): React.CSSProperties => ({ minHeight: 34, padding: "0 0.7rem", borderRadius: 8, border: `1.5px solid ${color}`, background: filled ? color : "#fff", color: filled ? "#fff" : color, fontWeight: 700, fontSize: "0.8rem", fontFamily: FONT, cursor: "pointer" });
  const typeLabel = (t: AnswerType) => ANSWER_TYPES.find((a) => a.key === t)?.label ?? t;
  const audienceLabel = (a: Audience) => AUDIENCES.find((x) => x.key === a)?.label ?? a;
  const argsOf = (d: Draft) => ({
    sessionToken: token,
    questionId: d.id,
    text: d.text,
    answerType: d.answerType,
    unit: d.answerType === "number" ? d.unit : undefined,
    choices: d.answerType === "choice" ? d.choices.split("\n").map((c) => c.trim()).filter(Boolean) : undefined,
    appliesTo: d.appliesTo,
    active: d.active,
    sortOrder: d.sortOrder,
  });
  const problem = draft ? questionProblem(argsOf(draft)) : null;

  return (
    <div>
      {message && (
        <div style={{ marginBottom: "0.75rem", padding: "0.6rem 0.75rem", borderRadius: 10, background: message.ok ? "#e8f5e9" : "#ffebee", color: message.ok ? "#1b5e20" : "#c62828", fontWeight: 600 }}>
          {message.text}
        </div>
      )}
      <p style={{ color: "#555", fontSize: "0.9rem", marginTop: 0 }}>
        Buyers ask only these questions, and sellers answer with Yes/No, a number, a choice or a date. Members who miss a question message you; add it here. Retire a question to stop it being asked; its answers stay on posts.
      </p>

      {questions.length === 0 && (
        <div style={{ padding: "1rem", background: "#fff", borderRadius: 12, marginBottom: "1rem" }}>
          <p style={{ marginTop: 0 }}>There are no questions yet.</p>
          <button type="button" onClick={() => act(() => addStarters({ sessionToken: token }), "Starter questions added.")} style={small("#2e7d32", true)}>
            Add starter questions (moisture, grade, delivery…)
          </button>
        </div>
      )}

      <div style={{ display: "grid", gap: "0.5rem" }}>
        {questions.map((q) => (
          <div key={q._id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", padding: "0.6rem 0.8rem", background: "#fff", borderRadius: 12, border: "1px solid #e3e8e0", opacity: q.active ? 1 : 0.6 }}>
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{q.text}</div>
              <div style={{ fontSize: "0.75rem", color: "#666" }}>
                {typeLabel(q.answerType)}
                {q.unit ? ` (${q.unit})` : ""}
                {q.choices?.length ? `: ${q.choices.join(" / ")}` : ""} · {q.appliesTo.map(audienceLabel).join(", ")} · order {q.sortOrder}
                {q.active ? "" : " · retired"}
              </div>
            </div>
            <span style={{ display: "flex", gap: "0.35rem" }}>
              <button
                type="button"
                onClick={() => setDraft({ id: q._id, text: q.text, answerType: q.answerType, unit: q.unit ?? "", choices: (q.choices ?? []).join("\n"), appliesTo: q.appliesTo, active: q.active, sortOrder: q.sortOrder })}
                style={small("#1565c0")}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() =>
                  act(
                    () => save({ sessionToken: token, questionId: q._id, text: q.text, answerType: q.answerType, unit: q.unit, choices: q.choices, appliesTo: q.appliesTo, active: !q.active, sortOrder: q.sortOrder }),
                    q.active ? "Question retired." : "Question is back in use."
                  )
                }
                style={small("#555")}
              >
                {q.active ? "Retire" : "Use again"}
              </button>
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setDraft({ text: "", answerType: "yes_no", unit: "", choices: "", appliesTo: ["lots"], active: true, sortOrder: (questions.reduce((m, q) => Math.max(m, q.sortOrder), 0) || 0) + 10 })}
        style={{ ...small("#2e7d32", true), marginTop: "1rem", minHeight: 42 }}
      >
        ＋ New question
      </button>

      {draft && (
        <div style={{ marginTop: "1rem", padding: "1rem", background: "#fff", borderRadius: 12, border: "1.5px solid #2e7d32", display: "grid", gap: "0.6rem", maxWidth: 520 }}>
          <strong>{draft.id ? "Edit question" : "New question"}</strong>
          <input style={input} placeholder="The question, e.g. Is it sun dried?" value={draft.text} maxLength={120} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: 4 }}>Answer {draft.id ? "(cannot change)" : ""}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
              {ANSWER_TYPES.map((t) => (
                <button key={t.key} type="button" disabled={!!draft.id} onClick={() => setDraft({ ...draft, answerType: t.key })} style={{ ...small(draft.answerType === t.key ? "#2e7d32" : "#999", draft.answerType === t.key), cursor: draft.id ? "not-allowed" : "pointer" }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {draft.answerType === "number" && (
            <input style={{ ...input, width: 160 }} placeholder="Unit, e.g. kg, %, UGX" value={draft.unit} maxLength={12} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
          )}
          {draft.answerType === "choice" && (
            <textarea style={input} rows={4} placeholder={`Answers to choose from, one per line (2 to ${MAX_CHOICES})`} value={draft.choices} onChange={(e) => setDraft({ ...draft, choices: e.target.value })} />
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: 4 }}>Asked on</div>
            {AUDIENCES.map((a) => (
              <label key={a.key} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.9rem" }}>
                <input
                  type="checkbox"
                  checked={draft.appliesTo.includes(a.key)}
                  onChange={(e) => setDraft({ ...draft, appliesTo: e.target.checked ? [...draft.appliesTo, a.key] : draft.appliesTo.filter((x) => x !== a.key) })}
                />
                {a.label}
              </label>
            ))}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            Display order <input type="number" style={{ ...input, width: 80 }} value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })} />
          </label>
          {problem && <div style={{ color: "#8d6e00", fontSize: "0.85rem" }}>{problem}</div>}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              disabled={!!problem}
              style={{ ...small(problem ? "#999" : "#2e7d32", true), cursor: problem ? "not-allowed" : "pointer" }}
              onClick={async () => {
                if (await act(() => save(argsOf(draft)), "Question saved.")) setDraft(null);
              }}
            >
              Save question
            </button>
            <button type="button" style={small("#555")} onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
