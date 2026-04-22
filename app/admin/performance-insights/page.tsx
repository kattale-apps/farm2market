"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";

const BRAND = "#2e7d32";
const FONT = '"Montserrat", sans-serif';

const CATEGORY_COLORS: Record<string, string> = {
  revenue: "#2e7d32",
  expense: "#d32f2f",
  inventory: "#1976d2",
  profit_loss: "#f57c00",
  cashflow: "#00838f",
  custom: "#7b1fa2",
};

const CATEGORY_LABELS: Record<string, string> = {
  revenue: "Revenue",
  expense: "Expense",
  inventory: "Inventory",
  profit_loss: "Profit & Loss",
  cashflow: "Cash Flow",
  custom: "Custom",
};

const CHART_COLORS = ["#2e7d32", "#1976d2", "#f57c00", "#d32f2f", "#00838f", "#7b1fa2", "#c2185b", "#00695c"];

export default function PerformanceInsightsPage() {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState<Id<"communities"> | null>(null);
  const [drilldownFormId, setDrilldownFormId] = useState<Id<"communityForms"> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pilot_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.userId) setUserId(parsed.userId as Id<"users">);
      }
    } catch {}
  }, []);

  const currentUser = useQuery(api.auth.getUser, userId ? { userId } : "skip");
  const isSuperAdmin = currentUser?.role === "admin" && (
    currentUser?.adminLevel === "super" ||
    (currentUser?.adminLevel === undefined && !currentUser?.adminCategory)
  );

  const communities = useQuery(
    api.introspection.getCommunitiesForAdmin,
    userId && isSuperAdmin ? { adminId: userId } : "skip"
  );

  const insights = useQuery(
    (api as any).forms.getPerformanceInsights,
    selectedCommunityId ? { communityId: selectedCommunityId } : "skip"
  );

  const memberBreakdown = useQuery(
    (api as any).forms.getMemberBreakdown,
    drilldownFormId ? { formId: drilldownFormId } : "skip"
  );

  useEffect(() => {
    if (communities && communities.length > 0 && !selectedCommunityId) {
      setSelectedCommunityId(communities[0]._id);
    }
  }, [communities, selectedCommunityId]);

  const formatUGX = (amount: number) =>
    new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(amount);

  // PDF export via jsPDF
  const handleExportPDF = () => {
    if (!insights || insights.length === 0) return;
    try {
      const jsPDF = require("jspdf");
      require("jspdf-autotable");
      const doc = new jsPDF.default();

      doc.setFontSize(18);
      doc.setTextColor(46, 125, 50);
      doc.text("Performance Insights Report", 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("Know Your Numbers — Farm2Market Uganda", 14, 28);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 34);

      let yPos = 44;

      for (const insight of insights) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(13);
        doc.setTextColor(0, 0, 0);
        doc.text(`${insight.formName} (${CATEGORY_LABELS[insight.category] || insight.category})`, 14, yPos);
        yPos += 6;
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(`${insight.submissionCount} submissions`, 14, yPos);
        yPos += 8;

        const rows = Object.entries(insight.totals).map(([label, value]: [string, any]) => [
          label,
          typeof value === "number" ? (value > 1000 ? formatUGX(value) : value.toLocaleString()) : String(value),
        ]);

        (doc as any).autoTable({
          startY: yPos,
          head: [["Metric", "Total"]],
          body: rows,
          theme: "grid",
          headStyles: { fillColor: [46, 125, 50], fontSize: 9 },
          bodyStyles: { fontSize: 8 },
          margin: { left: 14 },
        });

        yPos = (doc as any).lastAutoTable.finalY + 12;
      }

      doc.save(`performance_insights_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (e) {
      alert("PDF export failed. Please try again.");
    }
  };

  if (!userId || (!isSuperAdmin && currentUser)) {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>{!currentUser ? "Loading..." : "Access denied."}</p>
        <Link href="/" style={{ color: BRAND }}>Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem", fontFamily: FONT, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/admin/business-trackers" style={{ color: BRAND, textDecoration: "none", fontSize: "0.9rem" }}>
          ← Back to Business Trackers
        </Link>
        <h1 style={{ margin: "0.75rem 0 0.25rem 0", fontSize: "clamp(1.4rem, 4vw, 2rem)", fontWeight: 700, color: "#1a1a1a" }}>
          📈 Performance Insights
        </h1>
        <p style={{ margin: 0, fontSize: "1rem", color: BRAND, fontWeight: 600, fontStyle: "italic" }}>
          Know Your Numbers
        </p>
      </div>

      {/* Community Selector + Export */}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        {communities && (
          <select
            value={selectedCommunityId || ""}
            onChange={(e) => {
              setSelectedCommunityId(e.target.value as Id<"communities">);
              setDrilldownFormId(null);
            }}
            style={{ padding: "0.5rem 0.8rem", borderRadius: 8, border: "1px solid #ccc", fontFamily: FONT, fontSize: "0.9rem" }}
          >
            {communities.map((c: any) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={handleExportPDF}
          disabled={!insights || insights.length === 0}
          style={{
            padding: "0.5rem 1rem",
            background: insights && insights.length > 0 ? "#ffc107" : "#e0e0e0",
            color: "#000",
            border: "none",
            borderRadius: 8,
            cursor: insights && insights.length > 0 ? "pointer" : "not-allowed",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          📄 Export PDF
        </button>
      </div>

      {/* Loading / Empty */}
      {!insights && <p style={{ color: "#888" }}>Loading insights...</p>}
      {insights && insights.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#888" }}>
          <p style={{ fontSize: "2.5rem" }}>📈</p>
          <p>No tracker data yet. Create trackers and members will submit entries.</p>
        </div>
      )}

      {/* Overview Cards */}
      {insights && insights.length > 0 && (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}>
            {insights.map((insight: any) => {
              const cat = insight.category || "custom";
              return (
                <div key={insight.formId} style={{
                  padding: "1rem",
                  borderRadius: 12,
                  background: "#fff",
                  border: `2px solid ${CATEGORY_COLORS[cat] || "#e0e0e0"}`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  cursor: "pointer",
                  transition: "transform 0.15s",
                }}
                  onClick={() => setDrilldownFormId(drilldownFormId === insight.formId ? null : insight.formId)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{
                      fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "0.08em", color: CATEGORY_COLORS[cat] || "#666",
                    }}>
                      {CATEGORY_LABELS[cat] || cat}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: "#888", fontWeight: 600 }}>
                      {insight.submissionCount} entries
                    </span>
                  </div>
                  <h3 style={{ margin: "0.3rem 0 0.5rem", fontSize: "1rem", fontWeight: 600 }}>{insight.formName}</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "0.4rem" }}>
                    {Object.entries(insight.totals).map(([label, value]: [string, any]) => (
                      <div key={label} style={{
                        padding: "0.35rem 0.5rem", borderRadius: 6,
                        background: `${CATEGORY_COLORS[cat] || "#666"}08`,
                      }}>
                        <div style={{ fontSize: "0.6rem", color: "#888" }}>{label}</div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: CATEGORY_COLORS[cat] || "#333" }}>
                          {typeof value === "number" && value > 1000 ? formatUGX(value) : String(Math.round(value as number))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: "0.5rem", fontSize: "0.7rem", color: BRAND, fontWeight: 500 }}>
                    {drilldownFormId === insight.formId ? "▲ Close drill-down" : "▼ Click for member breakdown"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submission Distribution Chart */}
          <div style={{
            padding: "1.25rem",
            borderRadius: 12,
            background: "#fff",
            border: "1px solid #e0e0e0",
            marginBottom: "2rem",
          }}>
            <h3 style={{ margin: "0 0 1rem", fontSize: "1.05rem", fontWeight: 700 }}>Submissions by Tracker</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={insights.map((i: any) => ({
                name: i.formName.length > 15 ? i.formName.slice(0, 15) + "…" : i.formName,
                submissions: i.submissionCount,
                fill: CATEGORY_COLORS[i.category] || BRAND,
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Bar dataKey="submissions" fill={BRAND}>
                  {insights.map((_: any, index: number) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Distribution Pie */}
          {(() => {
            const categoryData = insights.reduce((acc: any[], i: any) => {
              const existing = acc.find((a) => a.name === (CATEGORY_LABELS[i.category] || i.category));
              if (existing) {
                existing.value += i.submissionCount;
              } else {
                acc.push({
                  name: CATEGORY_LABELS[i.category] || i.category,
                  value: i.submissionCount,
                  color: CATEGORY_COLORS[i.category] || "#999",
                });
              }
              return acc;
            }, []);
            return categoryData.length > 1 ? (
              <div style={{
                padding: "1.25rem", borderRadius: 12, background: "#fff",
                border: "1px solid #e0e0e0", marginBottom: "2rem",
              }}>
                <h3 style={{ margin: "0 0 1rem", fontSize: "1.05rem", fontWeight: 700 }}>Category Distribution</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {categoryData.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : null;
          })()}
        </>
      )}

      {/* Member Drill-down */}
      {drilldownFormId && memberBreakdown && (
        <div style={{
          padding: "1.25rem", borderRadius: 12, background: "#fff",
          border: "2px solid " + BRAND, marginBottom: "2rem",
        }}>
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem", fontWeight: 700 }}>
            Member Breakdown
          </h3>
          {memberBreakdown.length === 0 && (
            <p style={{ color: "#888", fontSize: "0.9rem" }}>No submitted entries for this tracker yet.</p>
          )}
          {memberBreakdown.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "2px solid #ddd" }}>Member</th>
                    <th style={{ padding: "0.5rem", textAlign: "center", borderBottom: "2px solid #ddd" }}>Entries</th>
                    {memberBreakdown[0] && Object.keys(memberBreakdown[0].totals).map((label: string) => (
                      <th key={label} style={{ padding: "0.5rem", textAlign: "right", borderBottom: "2px solid #ddd" }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {memberBreakdown.map((m: any) => (
                    <tr key={m.memberId} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "0.5rem", fontWeight: 500 }}>{m.memberName}</td>
                      <td style={{ padding: "0.5rem", textAlign: "center" }}>{m.submissionCount}</td>
                      {Object.values(m.totals).map((val: any, i: number) => (
                        <td key={i} style={{ padding: "0.5rem", textAlign: "right", fontWeight: 600 }}>
                          {typeof val === "number" && val > 1000 ? formatUGX(val) : String(Math.round(val))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Member bar chart */}
          {memberBreakdown.length > 0 && (() => {
            const firstMetric = Object.keys(memberBreakdown[0].totals)[0];
            if (!firstMetric) return null;
            const chartData = memberBreakdown.slice(0, 10).map((m: any) => ({
              name: m.memberName.length > 12 ? m.memberName.slice(0, 12) + "…" : m.memberName,
              value: m.totals[firstMetric] || 0,
            }));
            return (
              <div style={{ marginTop: "1rem" }}>
                <h4 style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Top Members by {firstMetric}
                </h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={9} />
                    <YAxis fontSize={9} />
                    <Tooltip />
                    <Bar dataKey="value" fill={BRAND} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
