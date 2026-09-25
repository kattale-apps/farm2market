"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { fromStoredUgandaTime, getUgandaTime, inUgandaTime } from "../../utils/timeUtils";
import { LeadDetailsEditor } from "./LeadDetailsEditor";

/**
 * The reviewable archive of CRM submissions: each intake form with the answers
 * that were captured on it, and the calls that followed.
 *
 * The CRM home already answers "what happened today". This answers "what did we
 * actually learn", which previously existed only in the database.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// How many members to show per page. A supervisor reviewing one district wants
// a short page they can read to the end; one exporting a whole season wants
// everything on screen at once, so the size is theirs to pick. 0 means "all".
const PAGE_SIZE_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 10, label: "10 per page" },
  { value: 25, label: "25 per page" },
  { value: 50, label: "50 per page" },
  { value: 100, label: "100 per page" },
  { value: 0, label: "Show all" },
];

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

const STAGE_LABELS: Record<string, string> = {
  new: "New", follow_up: "Following up", order: "Order placed",
  completed: "Completed", lost: "Lost",
};

const TICKET_STATUS_LABELS: Record<string, string> = {
  open: "Open", in_progress: "In progress", resolved: "Resolved",
};

const PROBABILITY_LABELS: Record<string, string> = {
  high: "High chance", medium: "Medium chance", low: "Low chance",
};

const BAND_COLORS: Record<string, string> = {
  green: "#2e7d32",
  yellow: "#b8860b",
  red: "#c62828",
};

// Uganda midnight, in the same shifted clock CRM times are stored in
// (getUgandaTime), so "Today" means today in Uganda on any device.
function startOfToday(): number {
  const d = new Date(getUgandaTime());
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function rangeToFrom(range: RangeKey): number | undefined {
  if (range === "all") return undefined;
  if (range === "today") return startOfToday();
  return startOfToday() - Number(range) * DAY_MS;
}

function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return "-";
  return new Date(fromStoredUgandaTime(Number(ts))).toLocaleString(undefined, inUgandaTime());
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function CrmSubmissionsPanel({
  communityId,
  requesterId,
  crmForms,
  accentColor,
}: {
  communityId: Id<"communities">;
  requesterId: Id<"users">;
  crmForms: Array<{ _id: string; name: string }>;
  // Optional so callers that do not colour-code their sections keep the
  // neutral grey card this panel has always had.
  accentColor?: string;
}) {
  const [range, setRange] = useState<RangeKey>("all");
  const [formId, setFormId] = useState<string>("");
  const [outcome, setOutcome] = useState<string>("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirmingDelete, setConfirmingDelete] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string>("");
  const [deleteError, setDeleteError] = useState<string>("");
  const [editingId, setEditingId] = useState<string>("");
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);

  const deleteCrmSubmission = useMutation((api as any).crmCalls.deleteCrmSubmission);

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

  const pageCount = pageSize === 0 ? 1 : Math.max(1, Math.ceil(rows.length / pageSize));

  // A filter that narrows the list can strand the viewer on a page that no
  // longer exists, so the page is pulled back into range whenever it does.
  useEffect(() => {
    setPage(1);
  }, [range, formId, outcome, search, pageSize]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const safePage = Math.min(page, pageCount);
  const firstIndex = pageSize === 0 ? 0 : (safePage - 1) * pageSize;
  const pagedRows = pageSize === 0 ? rows : rows.slice(firstIndex, firstIndex + pageSize);

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // Deleting is permanent and takes the lead, its calls and anything raised on
  // them with it, so it asks for a second click rather than a single one next
  // to an expand toggle. The member account is deliberately left alone - they
  // may belong to the community for reasons unrelated to this lead.
  const handleDelete = async (responseId: string) => {
    setDeletingId(responseId);
    setDeleteError("");

    try {
      await deleteCrmSubmission({
        responseId: responseId as Id<"crmFormResponses">,
        requesterId,
      });
      setConfirmingDelete("");
    } catch (error: any) {
      setDeleteError(error?.message || "Failed to delete this submission");
    }

    setDeletingId("");
  };

  const exportCsv = () => {
    if (!rows.length) return;
    const header = [
      "Submitted", "Client", "Phone", "Form", "District", "SubCounty",
      "Product", "Quantity", "Crop", "Planting month",
      "Answers", "Calls", "Latest outcome", "Health",
      "Opportunities", "Issues", "Call answers",
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
        (row.opportunities || [])
          .map((o: any) => [o.productName, o.quantity, o.expectedPurchaseMonth].filter(Boolean).join(" "))
          .join(" | "),
        (row.tickets || []).map((t: any) => `${t.title} (${t.status})`).join(" | "),
        (row.calls || [])
          .flatMap((c: any) => (c.answers || []).map((a: any) => `${a.label}: ${a.value}`))
          .join(" | "),
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
    <div
      style={{
        border: `1px solid ${accentColor || "#e5e7eb"}`,
        borderLeft: `${accentColor ? 6 : 1}px solid ${accentColor || "#e5e7eb"}`,
        borderRadius: 12,
        padding: "0.9rem",
        marginTop: "1rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, color: accentColor }}>Submitted Forms &amp; Call Answers</h3>
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
      <div style={{ fontSize: "0.76rem", color: "#888", marginTop: "0.55rem" }}>
        Filters on activity: a form appears if it was submitted or called in the period.
      </div>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
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
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          style={{ padding: "0.4rem 0.6rem", borderRadius: 8, border: "1px solid #ddd", fontSize: "0.82rem" }}
        >
          {PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div style={{ marginTop: "0.7rem", fontSize: "0.82rem", color: "#555" }}>
        {data === undefined
          ? "Loading submissions..."
          : `${data.totalMatching} submission${data.totalMatching === 1 ? "" : "s"} · ${data.totalCalls} call${data.totalCalls === 1 ? "" : "s"} logged` +
            (data.totalOpportunities ? ` · ${data.totalOpportunities} sales opportunit${data.totalOpportunities === 1 ? "y" : "ies"}` : "") +
            (data.totalTickets ? ` · ${data.totalTickets} issue${data.totalTickets === 1 ? "" : "s"}` : "")}
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
        {pagedRows.map((row: any) => {
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
                    Submitted {formatDateTime(row.submittedAt)} · {row.callCount} call{row.callCount === 1 ? "" : "s"}
                    {row.callCount > 0 && row.calls?.[0] ? ` · last call ${formatDateTime(row.calls[0].createdAt)}` : ""}
                    {row.opportunities?.length ? ` · ${row.opportunities.length} opportunity` : ""}
                    {row.tickets?.length ? ` · ${row.tickets.length} issue` : ""}
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
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                    {confirmingDelete === row.responseId ? (
                      <>
                        <span style={{ fontSize: "0.76rem", color: "#991b1b", alignSelf: "center", flex: "1 1 200px" }}>
                          Delete this submission, its lead and {row.callCount} logged call
                          {row.callCount === 1 ? "" : "s"}? This cannot be undone.
                        </span>
                        <button
                          onClick={() => setConfirmingDelete("")}
                          disabled={deletingId === row.responseId}
                          style={{ padding: "0.3rem 0.7rem", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(row.responseId)}
                          disabled={deletingId === row.responseId}
                          style={{ padding: "0.3rem 0.7rem", borderRadius: 8, border: "1px solid #b91c1c", background: "#b91c1c", color: "#fff", fontSize: "0.78rem", fontWeight: 700, cursor: deletingId === row.responseId ? "not-allowed" : "pointer" }}
                        >
                          {deletingId === row.responseId ? "Deleting..." : "Delete permanently"}
                        </button>
                      </>
                    ) : (
                      <>
                      {editingId !== row.responseId && (
                        <button
                          onClick={() => setEditingId(row.responseId)}
                          style={{ padding: "0.3rem 0.7rem", borderRadius: 8, border: "1px solid #1f7a3e", background: "#fff", color: "#1f7a3e", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
                        >
                          Edit details
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setConfirmingDelete(row.responseId);
                          setDeleteError("");
                        }}
                        style={{ padding: "0.3rem 0.7rem", borderRadius: 8, border: "1px solid #fca5a5", background: "#fff", color: "#b91c1c", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
                      >
                        Delete lead
                      </button>
                      </>
                    )}
                  </div>
                  {deleteError && confirmingDelete === row.responseId && (
                    <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.78rem", color: "#b91c1c", fontWeight: 600 }}>
                      {deleteError}
                    </p>
                  )}
                  {editingId === row.responseId ? (
                    <LeadDetailsEditor
                      row={row}
                      requesterId={requesterId}
                      onDone={() => setEditingId("")}
                    />
                  ) : (
                  <DetailGrid
                    title="Lead details"
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
                  )}

                  <div style={{ marginTop: "0.8rem" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#374151", marginBottom: "0.35rem" }}>
                      Form answers ({row.answers?.length || 0})
                    </div>
                    {(!row.answers || row.answers.length === 0) && (
                      <div style={{ fontSize: "0.8rem", color: "#999" }}>
                        No questions were answered at intake. Agents now answer the form&apos;s questions on
                        every call, so look under each call below.
                      </div>
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
                        {row.nextCallAt ? ` · next call due ${new Date(fromStoredUgandaTime(row.nextCallAt)).toLocaleDateString(undefined, inUgandaTime())}` : ""}.
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
                        {call.answers?.length > 0 && (
                          <div style={{ marginTop: "0.45rem", borderTop: "1px dashed #e5e7eb", paddingTop: "0.35rem" }}>
                            {call.answers.map((answer: any) => (
                              <div key={answer.answerId} style={{ display: "flex", gap: "0.6rem", padding: "0.15rem 0", fontSize: "0.79rem" }}>
                                <span style={{ flex: "0 0 55%", color: "#666" }}>{answer.label}</span>
                                <span style={{ flex: 1, fontWeight: 600, color: "#111" }}>{answer.value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {call.notes && (
                          <div style={{ marginTop: "0.35rem", fontSize: "0.79rem", color: "#444", fontStyle: "italic" }}>
                            “{call.notes}”
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {row.opportunities?.length > 0 && (
                    <div style={{ marginTop: "0.85rem" }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#374151", marginBottom: "0.35rem" }}>
                        Sales opportunities ({row.opportunities.length})
                      </div>
                      {row.opportunities.map((opp: any) => (
                        <div key={opp.opportunityId} style={{ border: "1px solid #d7ecdd", background: "#f4fbf6", borderRadius: 8, padding: "0.5rem 0.6rem", marginBottom: "0.4rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, fontSize: "0.8rem", color: "#1f7a3e" }}>
                              {[opp.productName, opp.quantity].filter(Boolean).join(" · ") || "Opportunity"}
                            </span>
                            <span style={{ fontSize: "0.74rem", color: "#888" }}>{formatDateTime(opp.createdAt)}</span>
                          </div>
                          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
                            <Chip label={STAGE_LABELS[opp.stage] || opp.stage} />
                            <Chip label={PROBABILITY_LABELS[opp.probability] || null} />
                            <Chip label={opp.expectedPurchaseMonth ? `Expected ${opp.expectedPurchaseMonth}` : null} />
                            <Chip label={opp.nextActionAt ? `Next action ${new Date(opp.nextActionAt).toLocaleDateString(undefined, inUgandaTime())}` : null} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {row.tickets?.length > 0 && (
                    <div style={{ marginTop: "0.85rem" }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#374151", marginBottom: "0.35rem" }}>
                        Issues raised ({row.tickets.length})
                      </div>
                      {row.tickets.map((ticket: any) => (
                        <div key={ticket.ticketId} style={{ border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 8, padding: "0.5rem 0.6rem", marginBottom: "0.4rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, fontSize: "0.8rem", color: "#92400e" }}>{ticket.title}</span>
                            <span style={{ fontSize: "0.74rem", color: "#888" }}>{formatDateTime(ticket.createdAt)}</span>
                          </div>
                          <div style={{ marginTop: "0.3rem" }}>
                            <Chip label={TICKET_STATUS_LABELS[ticket.status] || ticket.status} tone="warn" />
                          </div>
                          {ticket.details && (
                            <div style={{ marginTop: "0.35rem", fontSize: "0.79rem", color: "#444", fontStyle: "italic" }}>
                              “{ticket.details.trim()}”
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {rows.length > 0 && (
        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            gap: "0.6rem", flexWrap: "wrap", marginTop: "0.6rem",
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "#555" }}>
            {pageSize === 0
              ? `Showing all ${rows.length} member${rows.length === 1 ? "" : "s"}`
              : `Showing ${firstIndex + 1}-${firstIndex + pagedRows.length} of ${rows.length} member${rows.length === 1 ? "" : "s"}`}
          </span>
          {pageCount > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={safePage <= 1}
                style={pagerButtonStyle(safePage <= 1)}
              >
                Previous
              </button>
              <span style={{ fontSize: "0.8rem", color: "#555" }}>
                Page {safePage} of {pageCount}
              </span>
              <button
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={safePage >= pageCount}
                style={pagerButtonStyle(safePage >= pageCount)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function pagerButtonStyle(disabled: boolean) {
  return {
    padding: "0.3rem 0.7rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: disabled ? "#f5f5f5" : "#fff",
    color: disabled ? "#aaa" : "#374151",
    fontSize: "0.8rem",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  } as const;
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
