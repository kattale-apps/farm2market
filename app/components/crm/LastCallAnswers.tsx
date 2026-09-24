"use client";

import { useState, type CSSProperties } from "react";
import { fromStoredUgandaTime, inUgandaTime } from "../../utils/timeUtils";

const OUTCOME_LABELS: Record<string, string> = {
  good_result: "Good result",
  problem: "Problem",
  wants_more: "Wants more",
  no_answer: "No answer",
};

/**
 * What was recorded on a lead's most recent call: outcome, when, who, the
 * answers given and any notes. Shown beside the intake answers so whoever
 * follows up knows what the farmer said last time. Renders nothing when no
 * call has been logged.
 */
export function LastCallAnswers({ lastCall }: { lastCall?: any }) {
  const [open, setOpen] = useState(false);
  if (!lastCall) return null;

  const answers: any[] = lastCall.answers || [];
  const when = lastCall.createdAt
    ? new Date(fromStoredUgandaTime(lastCall.createdAt)).toLocaleString(undefined, inUgandaTime())
    : "";
  const count = answers.length + (lastCall.notes ? 1 : 0);

  return (
    <div style={{ marginTop: "0.3rem" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{ background: "none", border: "none", padding: 0, color: "#1d4ed8", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}
      >
        {open ? "Hide" : "Show"} last call answers ({count})
      </button>

      {open && (
        <div style={{ marginTop: "0.3rem", border: "1px solid #dbeafe", background: "#f8fbff", borderRadius: 8, padding: "0.4rem 0.55rem" }}>
          <div style={{ fontSize: "0.76rem", color: "#374151", fontWeight: 600 }}>
            {OUTCOME_LABELS[lastCall.outcome] || lastCall.outcome} · {when}
            {lastCall.agentName ? ` · ${lastCall.agentName}` : ""}
          </div>
          {answers.length === 0 && !lastCall.notes && (
            <div style={{ fontSize: "0.76rem", color: "#999", marginTop: "0.2rem" }}>No answers were recorded on this call.</div>
          )}
          {answers.map((answer: any) => (
            <div key={answer.answerId} style={rowStyle}>
              <span style={{ flex: "0 0 45%", color: "#666" }}>{answer.label}</span>
              <span style={{ flex: 1, fontWeight: 600, color: "#111" }}>{answer.value}</span>
            </div>
          ))}
          {lastCall.notes && (
            <div style={{ marginTop: "0.25rem", fontSize: "0.78rem", color: "#444", fontStyle: "italic" }}>“{lastCall.notes}”</div>
          )}
        </div>
      )}
    </div>
  );
}

const rowStyle: CSSProperties = {
  display: "flex",
  gap: "0.6rem",
  padding: "0.2rem 0",
  borderBottom: "1px solid #eef2f7",
  fontSize: "0.78rem",
};
