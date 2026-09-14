"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

/**
 * The reviewable archive of CRM submissions: each intake form with the answers
 * that were captured on it, and the calls that followed.
 *
 * The CRM home already answers "what happened today". This answers "what did we
 * actually learn", which previously existed only in the database.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

type RangeKey = "today" | "7" | "30" | "90" | "all";

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
  { key: "90", label: "90 days" },
  { key: "all", label: "All time" },
];

const OUTCOME_LABELS: Record<string, string> = {
  good_result: "Good result",
  problem: "Problem reported",
  wants_more: "Wants more",
  no_answer: "No answer",
  never_called: "Not yet called",
};

const USAGE_LABELS: Record<string, string> = {
  yes: "Using it",
  partly: "Partly using",
  no: "Not using",
  unknown: "Unknown",
};

const RATING_LABELS: Record<string, string> = {
  very_good: "Very good",
  good: "Good",
  average: "Average",
  poor: "Poor",
  very_poor: "Very poor",
};

const ISSUE_LABELS: Record<string, string> = {
  none: "None",
  application_problem: "Application problem",
  product_problem: "Product problem",
  packaging_problem: "Packaging problem",
  delivery_problem: "Delivery problem",
  technical_advice: "Needs technical advice",
  other: "Other",
};

const REPURCHASE_LABELS: Record<string, string> = {
  yes: "Will buy again",
  no: "Will not buy again",
  maybe: "Undecided",
};

const BAND_COLORS: Record<string, string> = {
  green: "#2e7d32",
  yellow: "#b8860b",
  red: "#c62828",
};

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function rangeToFrom(range: RangeKey): number | undefined {
  if (range === "all") return undefined;
  if (range === "today") return startOfToday();
  return startOfToday() - Number(range) * DAY_MS;
}

function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return "-";
  return new Date(Number(ts)).toLocaleString();
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function CrmSubmissionsPanel({
  communityId,
  requesterId,
  crmForms,
}: {
  communityId: Id<"communities">;
  requesterId: Id<"users">;
  crmForms: Array<{ _id: string; name: string }>;
}) {
  const [range, setRange] = useState<RangeKey>("today");
  const [formId, setFormId] = useState<string>("");
  const [outcome, setOutcome] = useState<string>("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fromTs = useMemo(() => rangeToFrom(range), [range]);

  const data = useQuery(api.crmAnalytics.getCrmSubmissions, {
    communityId,
    requesterId,
    ...(fromTs != null ? { fromTs } : {}),
    ...(formId ? { crmFormId: formId as Id<"crmForms"> } : {}),
    ...(outcome ? { outcome: outcome as any } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    limit: 200,
  });

  const rows = data?.rows ?? [];

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const exportCsv = () => {
    if (!rows.length) return;
    const header = [
      "Submitted", "Client", "Phone", "Form", "District", "SubCounty",
      "Product", "Quantity", "Crop", "Planting month",
      "Answers", "Calls", "Latest outcome", "Health",
    ];
    const lines = [header.map(csvCell).join(",")];
    for (const row of rows) {
      lines.push([
        formatDateTime(row.submittedAt),
        row.clientName,
        row.phoneNumber,
        row.formName,
        row.district,
        row.subCounty,
        row.purchase?.productName ?? "",
        row.purchase?.purchaseQuantity ?? "",
        row.purchase?.cropGrown ?? "",
        row.purchase?.monthOfPlanting ?? "",
        (row.answers || []).map((a: any) => `${a.label}: ${a.value || "-"}`).join(" | "),
        String(row.callCount),
        row.latestOutcome ? OUTCOME_LABELS[row.latestOutcome] || row.latestOutcome : "Not yet called",
        row.latestHealthScore != null ? String(row.latestHealthScore) : "",
      ].map(csvCell).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `crm-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.9rem", marginTop: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Submitted Forms &amp; Call Answers</h3>
        <button
          onClick={exportCsv}
          disabled={!rows.length}
          style={{
            padding: "0.4rem 0.8rem", borderRadius: 8, border: "1px solid #1f7a3e",
            background: rows.length ? "#eaf7ef" : "#f5f5f5",
            color: rows.length ? "#1f7a3e" : "#aaa",
            fontWeight: 600, fontSize: "0.8rem", cursor: rows.length ? "pointer" : "not-allowed",
          }}
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.7rem" }}>
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.key}
            onClick={() => setRange(option.key)}
            style={{
              padding: "0.3rem 0.65rem", borderRadius: 999, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
              border: range === option.key ? "1px solid #1f7a3e" : "1px solid #ddd",
              background: range === option.key ? "#1f7a3e" : "#fff",
              color: range === option.key ? "#fff" : "#555",
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.55rem" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone or district"
          style={{ flex: "1 1 220px", minWidth: 0, padding: "0.4rem 0.6rem", borderRadius: 8, border: "1px solid #ddd", fontSize: "0.82rem" }}
        />
        <select
          value={formId}
          onChange={(e) => setFormId(e.target.value)}
          style={{ padding: "0.4rem 0.6rem", borderRadius: 8, border: "1px solid #ddd", fontSize: "0.82rem" }}
        >
          <option value="">All forms</option>
          {crmForms.map((f) => (
            <option key={String(f._id)} value={String(f._id)}>{f.name}</option>
          ))}
        </select>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          style={{ padding: "0.4rem 0.6rem", borderRadius: 8, border: "1px solid #ddd", fontSize: "0.82rem" }}
        >
          <option value="">Any outcome</option>
          {Object.entries(OUTCOME_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div style={{ marginTop: "0.7rem", fontSize: "0.82rem", color: "#555" }}>
        {data === undefined
          ? "Loading submissions..."
          : `${data.totalMatching} submission${data.totalMatching === 1 ? "" : "s"} · ${data.totalCalls} call${data.totalCalls === 1 ? "" : "s"} logged`}
        {data?.truncated && (
          <span style={{ color: "#92400e" }}> · showing the first {rows.length}, narrow the filters to see more</span>
        )}
      </div>

      {data !== undefined && rows.length === 0 && (
        <p style={{ color: "#777", fontSize: "0.85rem" }}>
          No submissions match these filters.
        </p>
      )}

      {/* Rows */}
      <div style={{ marginTop: "0.6rem" }}>
        {rows.map((row: any) => {
          const isOpen = !!expanded[row.responseId];
          return (
            <div key={row.responseId} style={{ border: "1px solid #eee", borderRadius: 10, marginBottom: "0.5rem", overflow: "hidden" }}>
              <button
                onClick={() => toggle(row.responseId)}
                style={{
                  width: "100%", textAlign: "left", padding: "0.6rem 0.75rem", border: "none",
                  background: isOpen ? "#f8fafc" : "#fff", cursor: "pointer", display: "flex",
                  justifyContent: "space-between", alignItems: "center", gap: "0.75rem",
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 700, display: "block" }}>
                    {isOpen ? "▾" : "▸"} {row.clientName}
                    {row.wasNewClientAtIntake && (
                      <span style={{ marginLeft: "0.4rem", fontSize: "0.68rem", fontWeight: 700, color: "#1f7a3e", background: "#eaf7ef", padding: "0.1rem 0.35rem", borderRadius: 999 }}>NEW</span>
                    )}
                  </span>
                  <span style={{ fontSize: "0.78rem", color: "#666" }}>
                    {row.formName} · {row.phoneNumber} · {row.district}
                    {row.subCounty && row.subCounty !== "-" ? `, ${row.subCounty}` : ""}
                  </span>
                  <span style={{ fontSize: "0.74rem", color: "#999", display: "block" }}>
                    {formatDateTime(row.submittedAt)} · {row.callCount} call{row.callCount === 1 ? "" : "s"}
                  </span>
                </span>
                <span style={{ textAlign: "right", whiteSpace: "nowrap", fontSize: "0.76rem" }}>
                  <span style={{ fontWeight: 700, color: row.latestOutcome === "problem" ? "#c62828" : "#555" }}>
                    {row.latestOutcome ? OUTCOME_LABELS[row.latestOutcome] || row.latestOutcome : "Not yet called"}
                  </span>
                  {row.latestHealthScore != null && (
                    <span style={{ display: "block", fontWeight: 700, color: BAND_COLORS[row.latestHealthBand || ""] || "#777" }}>
                      Health {row.latestHealthScore}
                    </span>
                  )}
                </span>
              </button>

              {isOpen && (
                <div style={{ padding: "0.75rem", borderTop: "1px solid #eee", background: "#fcfcfd" }}>
                  <DetailGrid
                    title="Purchase &amp; farm details"
                    entries={[
                      ["Product", row.purchase?.productName],
                      ["Quantity", row.purchase?.purchaseQuantity],
                      ["Purchase date", row.purchase?.purchaseDate],
                      ["Crop grown", row.purchase?.cropGrown],
                      ["Month of planting", row.purchase?.monthOfPlanting],
                      ["Past spray dates", (row.purchase?.pastSprayDates || []).join(", ")],
                      ["Next spray / visit", row.purchase?.upcomingSprayScheduleAt ? formatDateTime(row.purchase.upcomingSprayScheduleAt) : null],
                      ["Parish", row.parish],
                      ["Captured by", row.submittedByName],
                    ]}
                  />

                  <div style={{ marginTop: "0.8rem" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#374151", marginBottom: "0.35rem" }}>
                      Form answers ({row.answers?.length || 0})
                    </div>
                    {(!row.answers || row.answers.length === 0) && (
                      <div style={{ fontSize: "0.8rem", color: "#999" }}>This form has no custom questions.</div>
                    )}
                    {(row.answers || []).map((answer: any) => (
                      <div key={answer.fieldId} style={{ display: "flex", gap: "0.6rem", padding: "0.22rem 0", borderBottom: "1px solid #f2f2f2", fontSize: "0.8rem" }}>
                        <span style={{ flex: "0 0 45%", color: "#666" }}>{answer.label}</span>
                        <span style={{ flex: 1, fontWeight: 600, color: answer.value ? "#111" : "#bbb" }}>
                          {answer.value || "Not answered"}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: "0.85rem" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#374151", marginBottom: "0.35rem" }}>
                      Calls ({row.callCount})
                    </div>
                    {row.callCount === 0 && (
                      <div style={{ fontSize: "0.8rem", color: "#999" }}>
                        No calls logged yet
                        {row.nextCallAt ? ` · next call due ${new Date(row.nextCallAt).toLocaleDateString()}` : ""}.
                      </div>
                    )}
                    {(row.calls || []).map((call: any) => (
                      <div key={call.callId} style={{ border: "1px solid #eee", borderRadius: 8, padding: "0.5rem 0.6rem", marginBottom: "0.4rem", background: "#fff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.8rem" }}>
                            {OUTCOME_LABELS[call.outcome] || call.outcome}
                          </span>
                          <span style={{ fontSize: "0.74rem", color: "#888" }}>
                            {formatDateTime(call.createdAt)} · {call.agentName}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
                          <Chip label={USAGE_LABELS[call.usageStatus] || null} />
                          <Chip label={RATING_LABELS[call.resultRating] || null} />
                          <Chip
                            label={call.issueType && call.issueType !== "none" ? ISSUE_LABELS[call.issueType] || call.issueType : null}
                            tone="warn"
                          />
                          <Chip label={REPURCHASE_LABELS[call.repurchaseIntent] || null} />
                          {call.healthScore != null && (
                            <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.12rem 0.45rem", borderRadius: 999, color: "#fff", background: BAND_COLORS[call.healthBand || ""] || "#777" }}>
                              Health {call.healthScore}
                            </span>
                          )}
                        </div>
                        {call.notes && (
                          <div style={{ marginTop: "0.35rem", fontSize: "0.79rem", color: "#444", fontStyle: "italic" }}>
                            “{call.notes}”
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ label, tone }: { label: string | null; tone?: "warn" }) {
  if (!label) return null;
  return (
    <span
      style={{
        fontSize: "0.72rem",
        fontWeight: 600,
        padding: "0.12rem 0.45rem",
        borderRadius: 999,
        background: tone === "warn" ? "#fef3c7" : "#eef2f7",
        color: tone === "warn" ? "#92400e" : "#374151",
      }}
    >
      {label}
    </span>
  );
}

function DetailGrid({
  title,
  entries,
}: {
  title: string;
  entries: Array<[string, unknown]>;
}) {
  const present = entries.filter(([, value]) => value != null && String(value) !== "" && String(value) !== "-");
  if (!present.length) return null;
  return (
    <div>
      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#374151", marginBottom: "0.35rem" }}>
        {title.replace("&amp;", "&")}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.2rem 0.75rem" }}>
        {present.map(([label, value]) => (
          <div key={label} style={{ display: "flex", gap: "0.5rem", fontSize: "0.8rem", padding: "0.15rem 0" }}>
            <span style={{ color: "#666", flex: "0 0 45%" }}>{label}</span>
            <span style={{ fontWeight: 600, color: "#111", flex: 1 }}>{String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
