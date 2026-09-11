"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useStoredUser } from "@/app/hooks/useStoredUser";
import { QrNav } from "../QrNav";
import { sectionStyle, sectionHeading, inputStyle, labelStyle } from "../qrUiStyles";

export default function QrAnalyticsPage() {
  const { user } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [qrCodeId, setQrCodeId] = useState("");

  const campaigns = useQuery(api.campaigns.listCampaigns, userId ? { adminId: userId } : "skip");
  const qrCodes = useQuery(api.qrCodes.listQrCodes, userId ? { adminId: userId } : "skip");

  const filterArgs = useMemo(() => {
    if (!userId) return "skip" as const;
    return {
      adminId: userId,
      startDate: startDate ? new Date(startDate).getTime() : undefined,
      endDate: endDate ? new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1 : undefined,
      campaignId: campaignId ? (campaignId as Id<"campaigns">) : undefined,
      qrCodeId: qrCodeId ? (qrCodeId as Id<"qrCodes">) : undefined,
    };
  }, [userId, startDate, endDate, campaignId, qrCodeId]);

  const overview = useQuery(api.qrAnalytics.getOverview, filterArgs);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "1.5rem" }}>
      <QrNav />
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "1.25rem" }}>Analytics</h1>

      <section style={{ ...sectionStyle, marginBottom: "1.25rem" }}>
        <h2 style={sectionHeading}>Filters</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <label style={{ ...labelStyle, flex: "1 1 140px" }}>
            From
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ ...labelStyle, flex: "1 1 140px" }}>
            To
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ ...labelStyle, flex: "1 1 180px" }}>
            Campaign
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} style={inputStyle}>
              <option value="">All campaigns</option>
              {(campaigns ?? []).map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label style={{ ...labelStyle, flex: "1 1 180px" }}>
            QR code
            <select value={qrCodeId} onChange={(e) => setQrCodeId(e.target.value)} style={inputStyle}>
              <option value="">All QR codes</option>
              {(qrCodes ?? []).map((qr) => (
                <option key={qr._id} value={qr._id}>{qr.title || qr.code}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {overview === undefined ? (
        <p>Loading...</p>
      ) : (
        <>
          <section style={{ ...sectionStyle, marginBottom: "1.25rem" }}>
            <h2 style={sectionHeading}>Overview</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "1rem" }}>
              <Stat label="Scans" value={overview.totalScans} />
              <Stat label="Redirects" value={overview.totalRedirects} />
              <Stat label="Form submissions" value={overview.totalSubmissions} />
              <Stat label="Conversion rate" value={`${(overview.conversionRate * 100).toFixed(1)}%`} />
            </div>
          </section>

          <section style={{ ...sectionStyle, marginBottom: "1.25rem" }}>
            <h2 style={sectionHeading}>Scans &amp; redirects by date</h2>
            {overview.dailySeries.length === 0 ? (
              <p style={{ color: "#666", fontSize: "0.9rem" }}>No activity in this range.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={overview.dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="scans" fill="#1976d2" />
                  <Bar dataKey="redirects" fill="#2e7d32" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem" }}>
            <RankedList title="Top QR codes" items={overview.topQrCodes.map((q) => ({ label: q.title || q.code, value: q.scans }))} />
            <RankedList title="Top campaigns" items={overview.topCampaigns.map((c) => ({ label: c.name, value: c.scans }))} />
            <RankedList title="Top destinations" items={overview.topDestinations.map((d) => ({ label: d.destinationUrl, value: d.redirects }))} />
          </div>

          <section style={{ ...sectionStyle, marginTop: "1.25rem" }}>
            <h2 style={sectionHeading}>Recent activity</h2>
            {overview.recentActivity.length === 0 ? (
              <p style={{ color: "#666", fontSize: "0.9rem" }}>No recent activity.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: "0.85rem" }}>
                {overview.recentActivity.map((event, i) => (
                  <li key={i} style={{ padding: "0.4rem 0", borderBottom: "1px solid #f2f2f2", display: "flex", justifyContent: "space-between" }}>
                    <span>{eventLabel(event.type)} — {event.code}</span>
                    <span style={{ color: "#999" }}>{new Date(event.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function eventLabel(type: "scan" | "redirect" | "submission") {
  if (type === "scan") return "Scan";
  if (type === "redirect") return "Redirect";
  return "Form submission";
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ background: "#f9f9f9", borderRadius: 10, padding: "0.9rem", textAlign: "center" }}>
      <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: "0.75rem", color: "#666" }}>{label}</div>
    </div>
  );
}

function RankedList({ title, items }: { title: string; items: { label: string; value: number }[] }) {
  return (
    <section style={sectionStyle}>
      <h2 style={sectionHeading}>{title}</h2>
      {items.length === 0 ? (
        <p style={{ color: "#666", fontSize: "0.85rem" }}>No data yet.</p>
      ) : (
        <ol style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem" }}>
          {items.map((item, i) => (
            <li key={i} style={{ marginBottom: "0.35rem", wordBreak: "break-all" }}>
              {item.label} <span style={{ color: "#999" }}>({item.value})</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
