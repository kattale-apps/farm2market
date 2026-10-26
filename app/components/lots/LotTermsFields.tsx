"use client";

import { useState } from "react";
import {
  COMMIT_PERCENT_CHOICES,
  PACKAGED_COMMIT_PERCENT,
  chargeForStep,
  commitAmount,
  defaultPlan,
  isPackagedPlan,
  packagedPlan,
  proRatePay,
  validatePlan,
  type PlanStep,
} from "../../../convex/lotOrdersShared";

const formatUGX = (n: number) => `UGX ${Math.round(n).toLocaleString()}`;

/** The plan's problem in plain words, or null when it is fine. */
export function planProblem(steps: PlanStep[], commitPercent: number): string | null {
  try {
    validatePlan(steps, commitPercent);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

/** Keeps the step names and shares, and spreads the rest of the price again. */
export function respread(steps: PlanStep[], commitPercent: number): PlanStep[] {
  const pay = proRatePay(steps, commitPercent);
  return steps.map((s, i) => ({ ...s, payPercent: pay[i] }));
}

/**
 * Packaged items: no payment steps unless the seller switches them on. Off,
 * the buyer pays in full into escrow and the seller is paid when the buyer
 * collects. On, it is the usual editor (commit % and steps).
 */
export function PackagedTermsFields({
  sellerRole,
  commitPercent,
  steps,
  lotPrice,
  onChange,
}: {
  sellerRole: string;
  commitPercent: number;
  steps: PlanStep[];
  lotPrice: number | null;
  onChange: (commitPercent: number, steps: PlanStep[]) => void;
}) {
  const usingSteps = !isPackagedPlan(steps, commitPercent);
  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, color: "#333" }}>
        <input
          type="checkbox"
          checked={usingSteps}
          onChange={(e) => (e.target.checked ? onChange(30, defaultPlan(sellerRole, 30)) : onChange(PACKAGED_COMMIT_PERCENT, packagedPlan()))}
        />
        Use payment steps
      </label>
      {usingSteps ? (
        <LotTermsFields sellerRole={sellerRole} commitPercent={commitPercent} steps={steps} lotPrice={lotPrice} onChange={onChange} />
      ) : (
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#555" }}>
          No steps: the buyer pays in full into escrow, collects from you, and you are paid then. Switch steps on for big orders.
        </p>
      )}
    </div>
  );
}

/**
 * What the buyer commits up front and the seller's payment steps. Basic
 * sellers keep the defaults; "Change steps" lets others edit them.
 * `lotPrice` (UGX for one lot) turns the percentages into amounts.
 */
export function LotTermsFields({
  sellerRole,
  commitPercent,
  steps,
  lotPrice,
  onChange,
}: {
  sellerRole: string;
  commitPercent: number;
  steps: PlanStep[];
  lotPrice: number | null;
  onChange: (commitPercent: number, steps: PlanStep[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const preset = (COMMIT_PERCENT_CHOICES as readonly number[]).includes(commitPercent);
  const [other, setOther] = useState(!preset);
  const problem = planProblem(steps, commitPercent);
  const pays = steps.map((s) => s.payPercent);
  const amount = (i: number) => (lotPrice ? chargeForStep(lotPrice, commitPercent, pays, i) : null);

  const setCommit = (percent: number) => onChange(percent, respread(steps, percent));
  const setStep = (i: number, patch: Partial<PlanStep>) => onChange(commitPercent, steps.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const addStep = () => {
    const next = [...steps];
    next.splice(steps.length - 1, 0, { name: "", earnPercent: 0, payPercent: 0, handover: false });
    onChange(commitPercent, next);
  };
  const removeStep = (i: number) => onChange(commitPercent, respread(steps.filter((_, k) => k !== i), commitPercent));

  const chip = (on: boolean): React.CSSProperties => ({
    minHeight: 44,
    padding: "0 0.9rem",
    borderRadius: 999,
    border: `2px solid ${on ? "#2e7d32" : "#ddd"}`,
    background: on ? "#e8f5e9" : "#fff",
    color: "#222",
    fontWeight: 700,
    cursor: "pointer",
  });
  const small: React.CSSProperties = { width: "100%", padding: "0.5rem", border: "1px solid #ddd", borderRadius: 6, fontSize: "0.95rem" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#333" }}>
          Buyer pays first *
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {COMMIT_PERCENT_CHOICES.map((p) => (
            <button key={p} type="button" onClick={() => { setOther(false); setCommit(p); }} style={chip(!other && commitPercent === p)}>
              {p}%
            </button>
          ))}
          <button type="button" onClick={() => setOther(true)} style={chip(other)}>
            Other
          </button>
        </div>
        {other && (
          <input
            type="number"
            inputMode="decimal"
            min={1}
            max={100}
            value={commitPercent}
            onChange={(e) => setCommit(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
            placeholder="Percent, from 1 to 100"
            style={{ ...small, marginTop: "0.5rem" }}
          />
        )}
        <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem", color: "#666" }}>
          The buyer puts this share of the price into escrow to hold a lot
          {lotPrice ? ` (${formatUGX(commitAmount(lotPrice, commitPercent))} for one lot)` : ""}. The rest comes in as you finish each step.
        </p>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
          <span style={{ fontWeight: 600, color: "#333" }}>Payment steps</span>
          <button type="button" onClick={() => setEditing((e) => !e)} style={{ border: "none", background: "none", color: "#1565c0", fontWeight: 700, cursor: "pointer" }}>
            {editing ? "Done" : "Change steps"}
          </button>
        </div>

        {!editing ? (
          <ol style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.92rem", color: "#333" }}>
            {steps.map((s, i) => (
              <li key={i}>
                <strong>{s.name || "(no name)"}</strong>
                {s.handover
                  ? " — the buyer collects; the whole price must be in escrow first."
                  : s.payPercent > 0
                    ? ` — buyer pays ${s.payPercent}%${amount(i) !== null ? ` (${formatUGX(amount(i)!)})` : ""} when you finish it.`
                    : " — no payment at this step."}
              </li>
            ))}
          </ol>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 64px 32px", gap: "0.4rem", fontSize: "0.75rem", color: "#666", fontWeight: 700 }}>
              <span>Step</span>
              <span>Earns %</span>
              <span>Pay %</span>
              <span />
            </div>
            {steps.map((s, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 64px 64px 32px", gap: "0.4rem", alignItems: "center" }}>
                <input value={s.name} onChange={(e) => setStep(i, { name: e.target.value })} placeholder="Step name" maxLength={60} style={small} />
                <input type="number" inputMode="decimal" min={0} value={s.earnPercent} onChange={(e) => setStep(i, { earnPercent: Number(e.target.value) || 0 })} style={small} aria-label={`${s.name} earns percent`} />
                <input type="number" inputMode="decimal" min={0} value={s.payPercent} onChange={(e) => setStep(i, { payPercent: Number(e.target.value) || 0 })} style={small} aria-label={`${s.name} pay percent`} />
                {s.handover ? (
                  <span title="Collection is always the last step" style={{ textAlign: "center" }}>🔒</span>
                ) : (
                  <button type="button" onClick={() => removeStep(i)} aria-label={`Remove ${s.name}`} style={{ border: "none", background: "#ffebee", color: "#c62828", borderRadius: 6, minHeight: 36, cursor: "pointer" }}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <button type="button" onClick={addStep} disabled={steps.length >= 8} style={chip(false)}>+ Add a step</button>
              <button type="button" onClick={() => onChange(commitPercent, respread(steps, commitPercent))} style={chip(false)}>Spread payments</button>
              <button type="button" onClick={() => onChange(commitPercent, defaultPlan(sellerRole, commitPercent))} style={chip(false)}>Reset</button>
            </div>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#666" }}>
              <strong>Earns %</strong> is what each step is worth to you. <strong>Pay %</strong> is charged to the buyer when you finish the step. Collection stays last.
            </p>
          </div>
        )}
        {problem && <p style={{ margin: "0.4rem 0 0", fontSize: "0.85rem", color: "#c62828", fontWeight: 600 }}>{problem}</p>}
      </div>
    </div>
  );
}
