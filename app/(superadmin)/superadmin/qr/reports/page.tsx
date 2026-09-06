"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useStoredUser } from "@/app/hooks/useStoredUser";
import { downloadCsv } from "@/app/lib/csv";
import { QrNav } from "../QrNav";
import { sectionStyle, sectionHeading, buttonStyle, inputStyle, labelStyle } from "../qrUiStyles";

type ReportKind = "qr" | "campaign" | "redirect" | "forms";

export default function QrReportsPage() {
  const { user } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;

  const qrPerformance = useQuery(api.qrAnalytics.getQrPerformanceReport, userId ? { adminId: userId } : "skip");
  const campaignPerformance = useQuery(api.qrAnalytics.getCampaignPerformanceReport, userId ? { adminId: userId } : "skip");
  const redirectPerformance = useQuery(api.qrAnalytics.getRedirectPerformanceReport, userId ? { adminId: userId } : "skip");
  const qrCodes = useQuery(api.qrCodes.listQrCodes, userId ? { adminId: userId } : "skip");

  const [formQrCodeId, setFormQrCodeId] = useState("");
  const formQrCode = qrCodes?.find((qr) => qr._id === formQrCodeId);
  const formSubmissions = useQuery(
    api.qrForms.listFormSubmissions,
    userId && formQrCode && (formQrCode as any).formId
      ? { adminId: userId, formId: (formQrCode as any).formId }
      : "skip"
  );

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
      <QrNav />
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "1.25rem" }}>Reports</h1>

      <ReportSection
        title="QR performance"
        rows={qrPerformance}
        onExport={() => qrPerformance && downloadCsv("qr-performance.csv", qrPerformance)}
      />

      <ReportSection
        title="Campaign performance"
        rows={campaignPerformance}
        onExport={() => campaignPerformance && downloadCsv("campaign-performance.csv", campaignPerformance)}
      />

      <ReportSection
        title="Redirect performance (most recent 500)"
        rows={redirectPerformance}
        onExport={() => redirectPerformance && downloadCsv("redirect-performance.csv", redirectPerformance)}
      />

      <section style={{ ...sectionStyle, marginTop: "1.25rem" }}>
        <h2 style={sectionHeading}>Form submissions</h2>
        <label style={{ ...labelStyle, marginBottom: "0.75rem" }}>
          QR code
          <select value={formQrCodeId} onChange={(e) => setFormQrCodeId(e.target.value)} style={inputStyle}>
            <option value="">Select a QR code with a form</option>
            {(qrCodes ?? []).map((qr) => (
              <option key={qr._id} value={qr._id}>{qr.title || qr.code}</option>
            ))}
          </select>
        </label>
        {formSubmissions && (
          <>
            <button
              onClick={() =>
                downloadCsv(
                  "form-submissions.csv",
                  formSubmissions.submissions.map((row) => {
                    const record: Record<string, unknown> = { submittedAt: new Date(row.createdAt).toISOString() };
                    for (const v of row.values) record[v.label] = v.value;
                    return record;
                  })
                )
              }
              style={buttonStyle("#1976d2")}
            >
              Export CSV
            </button>
            <p style={{ color: "#666", fontSize: "0.85rem", marginTop: "0.5rem" }}>
              {formSubmissions.submissions.length} submission{formSubmissions.submissions.length === 1 ? "" : "s"}
            </p>
          </>
        )}
      </section>
    </main>
  );
}

function ReportSection({
  title,
  rows,
  onExport,
}: {
  title: string;
  rows: Record<string, unknown>[] | undefined;
  onExport: () => void;
}) {
  return (
    <section style={{ ...sectionStyle, marginBottom: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h2 style={{ ...sectionHeading, margin: 0 }}>{title}</h2>
        <button onClick={onExport} disabled={!rows || rows.length === 0} style={buttonStyle("#1976d2")}>
          Export CSV
        </button>
      </div>
      {rows === undefined ? (
        <p>Loading...</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "#666", fontSize: "0.85rem" }}>No data yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr>
                {Object.keys(rows[0]).map((key) => (
                  <th key={key} style={{ textAlign: "left", padding: "0.4rem", borderBottom: "2px solid #eee", whiteSpace: "nowrap" }}>
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((row, i) => (
                <tr key={i}>
                  {Object.keys(rows[0]).map((key) => (
                    <td key={key} style={{ padding: "0.4rem", borderBottom: "1px solid #f2f2f2", whiteSpace: "nowrap" }}>
                      {String(row[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 20 && (
            <p style={{ color: "#999", fontSize: "0.75rem", marginTop: "0.5rem" }}>
              Showing 20 of {rows.length} rows — export CSV for the full report.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
