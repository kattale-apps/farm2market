"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useStoredUser } from "@/app/hooks/useStoredUser";
import { QrCodeDisplay } from "@/app/components/qr/QrCodeDisplay";
import { QrNav } from "../QrNav";

/** epoch ms -> "YYYY-MM-DDTHH:mm" in the browser's local time, for a datetime-local input. */
function toDatetimeLocalValue(ms: number | undefined): string {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function QrCodeDetailPage({ params }: { params: { id: string } }) {
  const { user } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  const qrCodeId = params.id as Id<"qrCodes">;

  const qrCode = useQuery(
    api.qrCodes.getQrCode,
    userId ? { adminId: userId, qrCodeId } : "skip"
  );
  const updateQrCode = useMutation(api.qrCodes.updateQrCode);
  const archiveQrCode = useMutation(api.qrCodes.archiveQrCode);
  const submissionsResult = useQuery(
    api.qrForms.listFormSubmissions,
    userId && qrCode?.formId ? { adminId: userId, formId: qrCode.formId } : "skip"
  );
  const campaigns = useQuery(api.campaigns.listCampaigns, userId ? { adminId: userId } : "skip");

  const [newDestination, setNewDestination] = useState("");
  const [status, setStatus] = useState<{ type: "idle" | "saving" | "error"; message?: string }>({ type: "idle" });
  const [campaignStatus, setCampaignStatus] = useState<{ type: "idle" | "saving" }>({ type: "idle" });

  const [activeFromInput, setActiveFromInput] = useState("");
  const [activeUntilInput, setActiveUntilInput] = useState("");
  const [scheduleStatus, setScheduleStatus] = useState<{ type: "idle" | "saving" | "error"; message?: string }>({ type: "idle" });
  const [scheduleSeededForId, setScheduleSeededForId] = useState<string | null>(null);

  useEffect(() => {
    if (!qrCode || scheduleSeededForId === qrCode._id) return;
    setActiveFromInput(toDatetimeLocalValue(qrCode.activeFrom));
    setActiveUntilInput(toDatetimeLocalValue(qrCode.activeUntil));
    setScheduleSeededForId(qrCode._id);
  }, [qrCode, scheduleSeededForId]);

  if (qrCode === undefined) return <main style={{ padding: "2rem" }}>Loading...</main>;
  if (qrCode === null) return <main style={{ padding: "2rem" }}>QR code not found.</main>;

  const targetUrl = typeof window !== "undefined" ? `${window.location.origin}/q/${qrCode.code}` : `/q/${qrCode.code}`;

  const handleChangeDestination = async () => {
    if (!userId || !newDestination.trim()) return;
    setStatus({ type: "saving" });
    try {
      await updateQrCode({ adminId: userId, qrCodeId, destinationUrl: newDestination.trim() });
      setNewDestination("");
      setStatus({ type: "idle" });
    } catch (error) {
      setStatus({ type: "error", message: (error as Error).message });
    }
  };

  const handleToggleActive = async () => {
    if (!userId) return;
    await updateQrCode({ adminId: userId, qrCodeId, isActive: !qrCode.isActive });
  };

  const handleArchive = async () => {
    if (!userId) return;
    if (!confirm("Archive this QR code? It will stop redirecting visitors.")) return;
    await archiveQrCode({ adminId: userId, qrCodeId });
  };

  const handleCampaignChange = async (value: string) => {
    if (!userId) return;
    setCampaignStatus({ type: "saving" });
    try {
      await updateQrCode({
        adminId: userId,
        qrCodeId,
        campaignId: value ? (value as Id<"campaigns">) : null,
      });
    } finally {
      setCampaignStatus({ type: "idle" });
    }
  };

  const currentCampaign = campaigns?.find((c) => c._id === qrCode.campaignId);

  const handleSaveSchedule = async () => {
    if (!userId) return;
    setScheduleStatus({ type: "saving" });
    try {
      await updateQrCode({
        adminId: userId,
        qrCodeId,
        activeFrom: activeFromInput ? new Date(activeFromInput).getTime() : null,
        activeUntil: activeUntilInput ? new Date(activeUntilInput).getTime() : null,
      });
      setScheduleStatus({ type: "idle" });
    } catch (error) {
      setScheduleStatus({ type: "error", message: (error as Error).message });
    }
  };

  const handleClearSchedule = async () => {
    if (!userId) return;
    setActiveFromInput("");
    setActiveUntilInput("");
    setScheduleStatus({ type: "saving" });
    try {
      await updateQrCode({ adminId: userId, qrCodeId, activeFrom: null, activeUntil: null });
      setScheduleStatus({ type: "idle" });
    } catch (error) {
      setScheduleStatus({ type: "error", message: (error as Error).message });
    }
  };

  const now = Date.now();
  const scheduleState: "always-on" | "upcoming" | "running" | "ended" = (() => {
    if (!qrCode.activeFrom && !qrCode.activeUntil) return "always-on";
    if (qrCode.activeFrom && now < qrCode.activeFrom) return "upcoming";
    if (qrCode.activeUntil && now > qrCode.activeUntil) return "ended";
    return "running";
  })();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem" }}>
      <QrNav />
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "0.25rem" }}>
        {qrCode.title || qrCode.code}
      </h1>
      <p style={{ color: "#666", fontSize: "0.9rem", wordBreak: "break-all", marginBottom: "0.25rem" }}>
        {targetUrl}
      </p>
      <p style={{ color: "#999", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
        Campaign: {currentCampaign?.name ?? "None"}
      </p>

      <section style={sectionStyle}>
        <QrCodeDisplay
          targetUrl={targetUrl}
          darkColor={qrCode.darkColor}
          lightColor={qrCode.lightColor}
          logoUrl={qrCode.logoUrl}
          errorCorrectionLevel={qrCode.errorCorrectionLevel as "L" | "M" | "Q" | "H" | undefined}
          fileName={qrCode.code}
        />
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionHeading}>Change destination</h2>
        <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
          Current: <span style={{ wordBreak: "break-all" }}>{qrCode.destinationUrl}</span>
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            type="url"
            placeholder="https://example.com/new-destination"
            value={newDestination}
            onChange={(e) => setNewDestination(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 220 }}
          />
          <button onClick={handleChangeDestination} disabled={status.type === "saving"} style={buttonStyle("#1976d2")}>
            {status.type === "saving" ? "Saving..." : "Update"}
          </button>
        </div>
        {status.type === "error" && (
          <p style={{ color: "#c62828", fontSize: "0.85rem", marginTop: "0.5rem" }}>{status.message}</p>
        )}
        <p style={{ fontSize: "0.8rem", color: "#999", marginTop: "0.5rem" }}>
          The QR image never changes — it always points at {targetUrl}. Only the destination it resolves to changes.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionHeading}>Campaign</h2>
        <select
          value={qrCode.campaignId ?? ""}
          disabled={campaignStatus.type === "saving"}
          onChange={(e) => handleCampaignChange(e.target.value)}
          style={{ ...inputStyle, width: "100%" }}
        >
          <option value="">No campaign</option>
          {(campaigns ?? []).map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionHeading}>Running time</h2>
        <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.75rem" }}>
          Status: <strong>{scheduleLabel(scheduleState)}</strong>. Leave both fields blank for an always-on QR code.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.85rem", fontWeight: 600, color: "#333", flex: 1, minWidth: 200 }}>
            Active from
            <input
              type="datetime-local"
              value={activeFromInput}
              onChange={(e) => setActiveFromInput(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.85rem", fontWeight: 600, color: "#333", flex: 1, minWidth: 200 }}>
            Active until
            <input
              type="datetime-local"
              value={activeUntilInput}
              onChange={(e) => setActiveUntilInput(e.target.value)}
              style={inputStyle}
            />
          </label>
        </div>
        {scheduleStatus.type === "error" && (
          <p style={{ color: "#c62828", fontSize: "0.85rem", marginTop: "0.5rem" }}>{scheduleStatus.message}</p>
        )}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          <button onClick={handleSaveSchedule} disabled={scheduleStatus.type === "saving"} style={buttonStyle("#1976d2")}>
            {scheduleStatus.type === "saving" ? "Saving..." : "Save running time"}
          </button>
          <button onClick={handleClearSchedule} disabled={scheduleStatus.type === "saving"} style={buttonStyle("#616161")}>
            Clear (always-on)
          </button>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionHeading}>Status</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button onClick={handleToggleActive} style={buttonStyle(qrCode.isActive ? "#616161" : "#2e7d32")}>
            {qrCode.isActive ? "Deactivate" : "Activate"}
          </button>
          <button onClick={handleArchive} style={buttonStyle("#c62828")}>
            Archive
          </button>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionHeading}>Activity</h2>
        <p style={{ fontSize: "0.9rem", color: "#333" }}>
          {qrCode.scanCount} recent scan{qrCode.scanCount === 1 ? "" : "s"} · {qrCode.redirectCount} recent redirect{qrCode.redirectCount === 1 ? "" : "s"}
        </p>
      </section>

      {qrCode.formId && (
        <section style={sectionStyle}>
          <h2 style={sectionHeading}>Form submissions</h2>
          {submissionsResult === undefined ? (
            <p>Loading...</p>
          ) : submissionsResult.submissions.length === 0 ? (
            <p style={{ color: "#666", fontSize: "0.9rem" }}>No submissions yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Submitted</th>
                    {submissionsResult.fields.map((f) => (
                      <th key={f._id} style={thStyle}>{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {submissionsResult.submissions.map((row) => (
                    <tr key={row.submissionId}>
                      <td style={tdStyle}>{new Date(row.createdAt).toLocaleString()}</td>
                      {row.values.map((v) => (
                        <td key={v.fieldId} style={tdStyle}>{v.value}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

const sectionStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 12,
  padding: "1.25rem",
  marginBottom: "1.25rem",
};

const sectionHeading: React.CSSProperties = { fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.75rem 0" };

const inputStyle: React.CSSProperties = {
  padding: "0.65rem 0.8rem",
  borderRadius: 8,
  border: "1px solid #ccc",
  fontSize: "0.95rem",
};

const thStyle: React.CSSProperties = { textAlign: "left", padding: "0.5rem", borderBottom: "2px solid #eee", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "0.5rem", borderBottom: "1px solid #f2f2f2", whiteSpace: "nowrap" };

function scheduleLabel(state: "always-on" | "upcoming" | "running" | "ended"): string {
  if (state === "always-on") return "Always on";
  if (state === "upcoming") return "Scheduled — not yet started";
  if (state === "ended") return "Ended — scan will show as inactive";
  return "Running";
}

function buttonStyle(background: string): React.CSSProperties {
  return {
    padding: "0.6rem 1.1rem",
    background,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
  };
}
