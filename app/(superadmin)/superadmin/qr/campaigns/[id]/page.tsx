"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useStoredUser } from "@/app/hooks/useStoredUser";
import { QrNav } from "../../QrNav";
import { sectionStyle, sectionHeading, buttonStyle } from "../../qrUiStyles";

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const { user } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  const campaignId = params.id as Id<"campaigns">;

  const report = useQuery(
    api.campaigns.getCampaignReport,
    userId ? { adminId: userId, campaignId } : "skip"
  );
  const updateCampaign = useMutation(api.campaigns.updateCampaign);
  const [status, setStatus] = useState<{ type: "idle" | "saving" }>({ type: "idle" });

  if (report === undefined) return <main style={{ padding: "2rem" }}>Loading...</main>;
  if (report === null) return <main style={{ padding: "2rem" }}>Campaign not found.</main>;

  const handleToggleActive = async () => {
    if (!userId) return;
    setStatus({ type: "saving" });
    await updateCampaign({ adminId: userId, campaignId, isActive: !report.campaign.isActive });
    setStatus({ type: "idle" });
  };

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "1.5rem" }}>
      <QrNav />
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "0.25rem" }}>{report.campaign.name}</h1>
      {report.campaign.description && <p style={{ color: "#666", marginBottom: "1.25rem" }}>{report.campaign.description}</p>}

      <section style={{ ...sectionStyle, marginBottom: "1.25rem" }}>
        <h2 style={sectionHeading}>Performance</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "1rem" }}>
          <Stat label="QR codes" value={report.qrCodeCount} />
          <Stat label="Scans" value={report.totalScans} />
          <Stat label="Redirects" value={report.totalRedirects} />
          <Stat label="Submissions" value={report.totalSubmissions} />
          <Stat label="Conversion rate" value={`${(report.conversionRate * 100).toFixed(1)}%`} />
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionHeading}>Status</h2>
        <button onClick={handleToggleActive} disabled={status.type === "saving"} style={buttonStyle(report.campaign.isActive ? "#616161" : "#2e7d32")}>
          {report.campaign.isActive ? "Mark inactive" : "Mark active"}
        </button>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ background: "#f9f9f9", borderRadius: 10, padding: "0.9rem", textAlign: "center" }}>
      <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: "0.75rem", color: "#666" }}>{label}</div>
    </div>
  );
}
