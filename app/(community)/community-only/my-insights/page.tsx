"use client";

export const dynamic = "force-dynamic";

import { api } from "@/convex/_generated/api";
import { useState, useEffect, Suspense } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import CommunityTabBar from "@/app/components/CommunityTabBar";
import { useOfflineQuery } from "@/app/hooks/useOfflineQuery";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { YieldGuaranteeBadge } from "@/app/components/biofarm/YieldGuaranteeBadge";

const BRAND = "#2e7d32";
const FONT = '"Montserrat", sans-serif';
const BIOFARM_COMMUNITY_ID = "ms72de3njrrc9k43cf9h3yq70181ncp0";

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

export default function MyInsightsPageWrapper() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MyInsightsPage />
    </Suspense>
  );
}

function LoadingFallback() {
  const FONT = '"Montserrat", sans-serif';
  return (
    <div style={{ fontFamily: FONT, paddingBottom: "5rem" }}>
      <div style={{
        background: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)",
        padding: "1.25rem 1rem",
        color: "#fff",
      }}>
        <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>
          📈 My Performance Insights
        </h1>
        <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", opacity: 0.9, fontStyle: "italic" }}>
          Know Your Numbers
        </p>
      </div>
      <div style={{ padding: "1rem" }}>
        <div style={{ textAlign: "center", padding: "2rem", color: "#888", background: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
          <p style={{ fontSize: "clamp(0.95rem, 2.5vw, 1.05rem)" }}>Loading insights...</p>
        </div>
      </div>
    </div>
  );
}

function MyInsightsPage() {
  const searchParams = useSearchParams();
  const communityId = searchParams.get("communityId") as Id<"communities"> | null;
  const [userId, setUserId] = useState<Id<"users"> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pilot_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.userId) setUserId(parsed.userId as Id<"users">);
      }
    } catch {}
  }, []);

  const insights = useOfflineQuery(
    (api as any).forms.getMemberInsights,
    userId && communityId ? { memberId: userId, communityId } : "skip"
  ) as any;

  const fertilizerPlans = useOfflineQuery(
    (api as any).fertilizerPlanner.getFarmerPlans,
    userId && communityId === BIOFARM_COMMUNITY_ID ? { farmerId: userId, communityId } : "skip"
  ) as any[] | undefined;

  const fertilizerInsights = useOfflineQuery(
    (api as any).fertilizerPlanner.getFertilizerInsightsData,
    userId && communityId === BIOFARM_COMMUNITY_ID ? { farmerId: userId, communityId } : "skip"
  ) as any;

  const formatUGX = (amount: number) => {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(amount);
  };

  if (!communityId) {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>No community selected.</p>
        <Link href="/my-communities" style={{ color: BRAND }}>Back to Communities</Link>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: FONT, paddingBottom: "5rem" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)",
        padding: "1.25rem 1rem",
        color: "#fff",
      }}>
        <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>
          📈 My Performance Insights
        </h1>
        <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", opacity: 0.9, fontStyle: "italic" }}>
          Know Your Numbers
        </p>
      </div>

      {/* Content */}
      <div style={{ padding: "1rem" }}>
        {communityId === BIOFARM_COMMUNITY_ID && (
          <div style={{ marginBottom: "1rem", display: "grid", gap: "0.75rem" }}>
            <div style={{ background: "#fff", border: "1px solid #d9ecd9", borderRadius: 12, padding: "0.85rem" }}>
              <h2 style={{ margin: 0, fontSize: "1rem", color: "#1b5e20" }}>🌱 Fertilizer Planner</h2>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "#666" }}>
                Yield guarantee and spray performance for your active plans.
              </p>
            </div>

            {(fertilizerPlans || []).map((plan: any) => (
              <YieldGuaranteeBadge
                key={String(plan._id)}
                guarantee={plan.guarantee}
                projectedYieldTons={plan.projection?.projectedYieldTons}
              />
            ))}

            {fertilizerInsights && (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #ececec", padding: "0.75rem" }}>
                  <p style={{ margin: "0 0 0.45rem", fontSize: "0.85rem", fontWeight: 700, color: "#333" }}>Spray Compliance</p>
                  <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer>
                      <BarChart data={fertilizerInsights.compliance || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="crop" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="planned" fill="#9e9e9e" name="Planned" />
                        <Bar dataKey="done" fill="#2e7d32" name="Done" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #ececec", padding: "0.75rem" }}>
                  <p style={{ margin: "0 0 0.45rem", fontSize: "0.85rem", fontWeight: 700, color: "#333" }}>Fertilizer Use (ml by month)</p>
                  <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer>
                      <BarChart data={fertilizerInsights.fertilizerByMonth || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="totalMl" fill="#1565c0" name="Total ml" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #ececec", padding: "0.75rem" }}>
                  <p style={{ margin: "0 0 0.45rem", fontSize: "0.85rem", fontWeight: 700, color: "#333" }}>Yield Projection vs Baseline</p>
                  <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer>
                      <BarChart data={fertilizerInsights.projections || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="crop" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="baselineYieldTons" fill="#8d6e63" name="Baseline" />
                        <Bar dataKey="projectedYieldTons" fill="#2e7d32" name="Projected" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!insights && (
          <div style={{ textAlign: "center", padding: "2rem", color: "#888", background: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            <p style={{ fontSize: "clamp(0.95rem, 2.5vw, 1.05rem)" }}>Loading insights...</p>
          </div>
        )}

        {insights && insights.length === 0 && (
          <div style={{ textAlign: "center", padding: "2rem", color: "#666", background: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            <p style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📈</p>
            <p style={{ fontSize: "clamp(1rem, 3vw, 1.1rem)", fontWeight: 600 }}>No insights yet</p>
            <p style={{ fontSize: "clamp(0.85rem, 2.5vw, 0.95rem)", color: "#999" }}>Submit tracker entries to see your performance data.</p>
            <Link
              href={`/community-only/trackers?communityId=${communityId}`}
              style={{
                display: "inline-block",
                marginTop: "0.75rem",
                padding: "0.5rem 1rem",
                background: BRAND,
                color: "#fff",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              Open Trackers →
            </Link>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {insights && insights.map((insight: any) => (
            <div key={insight.formId} style={{
              padding: "1rem",
              borderRadius: 12,
              background: "#fff",
              border: `2px solid ${CATEGORY_COLORS[insight.category] || "#e0e0e0"}`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
                <div>
                  <span style={{
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: CATEGORY_COLORS[insight.category] || "#666",
                  }}>
                    {CATEGORY_LABELS[insight.category] || insight.category}
                  </span>
                  <h3 style={{ margin: "0.1rem 0 0 0", fontSize: "1rem", fontWeight: 600, color: "#1a1a1a" }}>
                    {insight.formName}
                  </h3>
                </div>
                <span style={{
                  fontSize: "0.7rem",
                  background: "#f5f5f5",
                  padding: "0.2rem 0.5rem",
                  borderRadius: 4,
                  color: "#666",
                  fontWeight: 600,
                }}>
                  {insight.submissionCount} entries
                </span>
              </div>

              {/* Totals */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                gap: "0.5rem",
              }}>
                {Object.entries(insight.totals).map(([label, value]: [string, any]) => (
                  <div key={label} style={{
                    padding: "0.5rem",
                    borderRadius: 8,
                    background: `${CATEGORY_COLORS[insight.category] || "#666"}08`,
                    border: `1px solid ${CATEGORY_COLORS[insight.category] || "#666"}20`,
                  }}>
                    <div style={{ fontSize: "0.65rem", color: "#888", fontWeight: 500, marginBottom: "0.15rem" }}>
                      {label}
                    </div>
                    <div style={{
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      color: CATEGORY_COLORS[insight.category] || "#333",
                    }}>
                      {typeof value === "number" && value > 1000 ? formatUGX(value) : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <CommunityTabBar />
    </div>
  );
}
