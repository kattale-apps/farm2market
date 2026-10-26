"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ADMIN_NOTE_MAX, MAX_QUESTIONS_PER_ASK, checkAnswer, type Answer, type AnswerType } from "../../../convex/enquiriesShared";
import { Sheet } from "./Sheets";
import { FONT, formatDate } from "./shared";

type FormQuestion = { questionId: Id<"enquiryQuestions">; text: string; answerType: AnswerType; unit: string | null; choices: string[] };
type ToAnswer = FormQuestion & { askCount: number; answer: Answer | null };

function errorText(e: unknown): string {
  return (e as Error)?.message?.replace(/^.*Uncaught Error: /, "").split("\n")[0] ?? "Something went wrong.";
}

const ruleOf = (q: FormQuestion) => ({ answerType: q.answerType, unit: q.unit ?? undefined, choices: q.choices });
const complete = (q: FormQuestion, a: Answer | undefined) => !!a && !("problem" in checkAnswer(ruleOf(q), a));

const chip = (on: boolean): React.CSSProperties => ({
  minHeight: 40,
  padding: "0 0.85rem",
  borderRadius: 999,
  border: `2px solid ${on ? "#2e7d32" : "#ddd"}`,
  background: on ? "#e8f5e9" : "#fff",
  fontWeight: 700,
  fontFamily: FONT,
  cursor: "pointer",
});
const goButton = (busy: boolean): React.CSSProperties => ({
  minHeight: 44,
  padding: "0 1rem",
  borderRadius: 10,
  border: "none",
  background: busy ? "#ccc" : "#2e7d32",
  color: "#fff",
  fontWeight: 800,
  fontFamily: FONT,
  cursor: busy ? "not-allowed" : "pointer",
});

/** A typed answer: Yes/No, a number with its unit, one choice, or a date. No free text. */
export function AnswerInput({ q, value, onChange }: { q: FormQuestion; value: Answer | undefined; onChange: (a: Answer) => void }) {
  if (q.answerType === "yes_no") {
    return (
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <button type="button" onClick={() => onChange({ yes: true })} style={chip(value?.yes === true)}>Yes</button>
        <button type="button" onClick={() => onChange({ yes: false })} style={chip(value?.yes === false)}>No</button>
      </div>
    );
  }
  if (q.answerType === "choice") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
        {q.choices.map((c) => (
          <button key={c} type="button" onClick={() => onChange({ choice: c })} style={chip(value?.choice === c)}>{c}</button>
        ))}
      </div>
    );
  }
  const input: React.CSSProperties = { minHeight: 42, padding: "0 0.6rem", border: "1px solid #ccc", borderRadius: 8, fontFamily: FONT, fontSize: "1rem" };
  if (q.answerType === "date") {
    return <input type="date" value={value?.date ?? ""} onChange={(e) => onChange(e.target.value ? { date: e.target.value } : {})} style={input} />;
  }
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={value?.number ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? {} : { number: parseFloat(e.target.value) })}
        style={{ ...input, width: 130 }}
      />
      {q.unit && <span style={{ fontWeight: 700 }}>{q.unit}</span>}
    </label>
  );
}

/** "Missing a question?": a short note to Farm2Market, who can add the question for everyone. */
function MessageFarm2Market({ cardId, token, label }: { cardId: Id<"marketCards">; token: string; label: string }) {
  const send = useMutation(api.enquiries.messageFarm2Market);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | { error: string }>("idle");
  if (state === "sent") {
    return (
      <p style={{ margin: "0.6rem 0 0", color: "#2e7d32", fontWeight: 700, fontSize: "0.88rem" }}>
        Sent. Farm2Market replies in your <Link href="/messages" style={{ color: "#1b5e20" }}>messages</Link>.
      </p>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ marginTop: "0.6rem", border: "none", background: "none", color: "#1565c0", fontWeight: 700, fontFamily: FONT, cursor: "pointer", padding: 0 }}>
        {label}
      </button>
    );
  }
  return (
    <div style={{ marginTop: "0.6rem", display: "grid", gap: "0.4rem" }}>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={ADMIN_NOTE_MAX}
        rows={3}
        placeholder="Which question should be added? Only Farm2Market sees this."
        style={{ padding: "0.6rem", borderRadius: 10, border: "1px solid #ddd", fontFamily: FONT, fontSize: "0.9rem" }}
      />
      {typeof state === "object" && <div style={{ color: "#c62828", fontSize: "0.85rem" }}>{state.error}</div>}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          disabled={state === "sending" || note.trim().length < 3}
          onClick={async () => {
            setState("sending");
            try {
              await send({ sessionToken: token, cardId, note });
              setState("sent");
            } catch (e) {
              setState({ error: errorText(e) });
            }
          }}
          style={goButton(state === "sending" || note.trim().length < 3)}
        >
          Send to Farm2Market
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ ...chip(false), borderRadius: 10 }}>Cancel</button>
      </div>
    </div>
  );
}

/** The poster answers (or pre-answers) the questions that fit the post. */
function AnswerForm({ cardId, token, items, onSaved }: { cardId: Id<"marketCards">; token: string; items: ToAnswer[]; onSaved?: (text: string) => void }) {
  const save = useMutation(api.enquiries.answer);
  const [draft, setDraft] = useState<Record<string, Answer>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (items.length === 0) return <p style={{ color: "#666", margin: 0 }}>No questions fit this post yet.</p>;

  const changed = items.filter((q) => draft[q.questionId] && complete(q, draft[q.questionId]));
  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await save({ sessionToken: token, cardId, answers: changed.map((q) => ({ questionId: q.questionId, answer: draft[q.questionId] })) });
      setDraft({});
      const text = `Saved ${changed.length} answer${changed.length === 1 ? "" : "s"}. Buyers see them on your post.`;
      setMsg({ ok: true, text });
      onSaved?.(text);
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "0.7rem" }}>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "#555" }}>
        Buyers see your answers. Answer what buyers asked first; answering the others now saves buyers asking.
      </p>
      {items.map((q) => {
        const waiting = q.askCount > 0 && !q.answer;
        return (
          <div key={q.questionId} style={{ padding: "0.6rem", borderRadius: 10, border: `1.5px solid ${waiting ? "#f6bf26" : "#eee"}`, background: waiting ? "#fffdf3" : "#fff" }}>
            <div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>
              {q.text}
              {waiting && <span style={{ marginLeft: "0.4rem", fontSize: "0.75rem", color: "#8d6e00" }}>Asked by {q.askCount} buyer{q.askCount === 1 ? "" : "s"}</span>}
            </div>
            <AnswerInput q={q} value={draft[q.questionId] ?? q.answer ?? undefined} onChange={(a) => setDraft((d) => ({ ...d, [q.questionId]: a }))} />
          </div>
        );
      })}
      {msg && <div style={{ fontWeight: 700, color: msg.ok ? "#2e7d32" : "#c62828" }}>{msg.text}</div>}
      <button type="button" disabled={busy || changed.length === 0} onClick={submit} style={goButton(busy || changed.length === 0)}>
        {busy ? "Saving…" : changed.length > 0 ? `Save ${changed.length} answer${changed.length === 1 ? "" : "s"}` : "Save answers"}
      </button>
    </div>
  );
}

/** The suppliers who answered a wanted ad, by alias. */
function Responses({ cardId, token, responses }: { cardId: Id<"marketCards">; token: string; responses: { responder: string; updatedAt: number; answers: { text: string; answer: string }[] }[] }) {
  return (
    <div style={{ display: "grid", gap: "0.6rem" }}>
      {responses.length === 0 ? (
        <p style={{ margin: 0, color: "#666" }}>No supplier has responded yet.</p>
      ) : (
        responses.map((r, i) => (
          <div key={i} style={{ padding: "0.6rem", borderRadius: 10, border: "1px solid #eee", background: "#fff" }}>
            <div style={{ fontWeight: 800 }}>{r.responder} <span style={{ fontWeight: 400, fontSize: "0.78rem", color: "#777" }}>· {formatDate(r.updatedAt)}</span></div>
            {r.answers.map((a, j) => (
              <div key={j} style={{ fontSize: "0.88rem" }}>{a.text} <strong>{a.answer}</strong></div>
            ))}
          </div>
        ))
      )}
      <MessageFarm2Market cardId={cardId} token={token} label="Want to go ahead with a supplier? Message Farm2Market" />
    </div>
  );
}

/** Questions and answers on a post's page: read the answers, ask, or respond to a wanted ad. */
export function CardQuestions({ cardId, token, today, now }: { cardId: string; token: string | null; today: string; now: number }) {
  const data = useQuery(api.enquiries.forCard, { cardId, now, today, sessionToken: token ?? undefined });
  const ask = useMutation(api.enquiries.ask);
  const respond = useMutation(api.enquiries.respond);
  const [picked, setPicked] = useState<string[]>([]);
  const [draft, setDraft] = useState<Record<string, Answer> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!data) return null;
  const id = cardId as Id<"marketCards">;

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await action() });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };
  const maxPick = Math.min(MAX_QUESTIONS_PER_ASK, data.asksLeft);
  const box: React.CSSProperties = { padding: "0.85rem", borderRadius: 12, background: "#fff", border: "1px solid #e3e8e0", marginTop: "0.8rem" };

  // The poster: answer questions, or read responses to a wanted ad
  if (data.isMine && token) {
    return (
      <div style={box}>
        <h2 style={{ margin: "0 0 0.6rem", fontSize: "1.05rem" }}>{data.mode === "ask" ? "❓ Buyers' questions" : "📨 Supplier responses"}</h2>
        {data.mode === "ask" ? <AnswerForm cardId={id} token={token} items={data.toAnswer} /> : <Responses cardId={id} token={token} responses={data.responses} />}
      </div>
    );
  }

  const answers = draft ?? Object.fromEntries((data.myResponse ?? []).map((a) => [a.questionId, a.answer]));
  const ready = data.respondForm.filter((q) => complete(q, answers[q.questionId]));

  return (
    <div style={box}>
      <h2 style={{ margin: "0 0 0.6rem", fontSize: "1.05rem" }}>{data.mode === "ask" ? "❓ Questions" : "📨 Respond to this wanted ad"}</h2>

      {data.mode === "ask" && (
        data.full ? (
          data.answered.length > 0 ? (
            <div style={{ display: "grid", gap: "0.3rem", marginBottom: "0.6rem" }}>
              {data.answered.map((a) => (
                <div key={a.questionId} style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", padding: "0.4rem 0", borderBottom: "1px solid #f1f1f1", fontSize: "0.92rem" }}>
                  <span>{a.text}</span>
                  <strong style={{ textAlign: "right" }}>{a.answer}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: "0 0 0.6rem", color: "#666", fontSize: "0.9rem" }}>No answers yet.</p>
          )
        ) : (
          <p style={{ margin: "0 0 0.6rem", color: "#666", fontSize: "0.9rem" }}>
            {data.answeredCount > 0 ? `${data.answeredCount} question${data.answeredCount === 1 ? "" : "s"} answered.` : "No answers yet."}
          </p>
        )
      )}
      {data.waiting.length > 0 && (
        <div style={{ fontSize: "0.85rem", color: "#8d6e00", marginBottom: "0.6rem" }}>
          Waiting for the seller: {data.waiting.map((w) => `${w.text}${w.askedByMe ? " (you asked)" : ""}`).join(" · ")}
        </div>
      )}

      {data.reason && <p style={{ margin: 0, color: "#6d4c00", fontWeight: 600 }}>🔒 {data.reason}</p>}

      {data.mode === "ask" && data.askable.length > 0 && (
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <div style={{ fontWeight: 700 }}>Ask the seller (choose up to {maxPick})</div>
          {data.askable.map((q) => {
            const on = picked.includes(q.questionId);
            const full = !on && picked.length >= maxPick;
            return (
              <label key={q.questionId} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.45rem 0.6rem", borderRadius: 10, border: `1.5px solid ${on ? "#2e7d32" : "#eee"}`, color: full ? "#aaa" : "#222", cursor: full ? "not-allowed" : "pointer" }}>
                <input type="checkbox" checked={on} disabled={full} onChange={() => setPicked((p) => (on ? p.filter((x) => x !== q.questionId) : [...p, q.questionId]))} />
                {q.text}
              </label>
            );
          })}
          <button
            type="button"
            disabled={busy || picked.length === 0 || !token}
            onClick={() => run(async () => {
              const r = await ask({ sessionToken: token!, cardId: id, questionIds: picked as Id<"enquiryQuestions">[] });
              setPicked([]);
              return r.asked > 0 ? "Sent. You will be told when the seller answers." : "Those questions are already answered or asked.";
            })}
            style={{ ...goButton(busy || picked.length === 0), justifySelf: "start" }}
          >
            Ask {picked.length > 0 ? picked.length : ""} question{picked.length === 1 ? "" : "s"}
          </button>
        </div>
      )}
      {data.mode === "ask" && !data.reason && data.askable.length === 0 && data.asksLeft === 0 && (
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#666" }}>You have asked all the questions you can on this post.</p>
      )}

      {data.mode === "respond" && data.respondForm.length > 0 && (
        <div style={{ display: "grid", gap: "0.6rem" }}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#555" }}>Only the poster sees your answers, under your alias.</p>
          {data.respondForm.map((q) => (
            <div key={q.questionId}>
              <div style={{ fontWeight: 700, marginBottom: "0.3rem" }}>{q.text}</div>
              <AnswerInput q={q} value={answers[q.questionId]} onChange={(a) => setDraft({ ...answers, [q.questionId]: a })} />
            </div>
          ))}
          <button
            type="button"
            disabled={busy || ready.length === 0 || !token}
            onClick={() => run(async () => {
              await respond({ sessionToken: token!, cardId: id, answers: ready.map((q) => ({ questionId: q.questionId, answer: answers[q.questionId] })) });
              setDraft(null);
              return "Sent. The poster sees your answers.";
            })}
            style={{ ...goButton(busy || ready.length === 0), justifySelf: "start" }}
          >
            {data.myResponse ? "Update my response" : "Send my response"}
          </button>
        </div>
      )}

      {msg && <div style={{ marginTop: "0.5rem", fontWeight: 700, color: msg.ok ? "#2e7d32" : "#c62828" }}>{msg.text}</div>}
      {token && !data.reason && <MessageFarm2Market cardId={id} token={token} label="Missing a question? Message Farm2Market" />}
    </div>
  );
}

/** My posts: answer a post's questions, or read a wanted ad's responses. */
export function QuestionsSheet({ cardId, token, today, now, onClose }: { cardId: string; token: string; today: string; now: number; onClose: () => void }) {
  const data = useQuery(api.enquiries.forCard, { cardId, now, today, sessionToken: token });
  const id = cardId as Id<"marketCards">;
  return (
    <Sheet title={data ? `Questions · ${data.title}` : "Questions"} onClose={onClose}>
      {data === undefined ? (
        <p style={{ color: "#777" }}>Loading…</p>
      ) : data === null || !data.isMine ? (
        <p style={{ color: "#777" }}>This post is not available.</p>
      ) : data.mode === "ask" ? (
        <AnswerForm cardId={id} token={token} items={data.toAnswer} />
      ) : (
        <Responses cardId={id} token={token} responses={data.responses} />
      )}
    </Sheet>
  );
}
