"use client";

export const dynamic = "force-dynamic";

import { api } from "@/convex/_generated/api";
import { useState, useEffect, Suspense, useMemo } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import CommunityTabBar from "@/app/components/CommunityTabBar";
import { useOfflineQuery } from "@/app/hooks/useOfflineQuery";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { useStoredUser } from "@/app/hooks/useStoredUser";

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
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) || null;
  const [selectedFarm, setSelectedFarm] = useState<string>("all");

  const insights = useOfflineQuery(
    (api as any).forms.getMemberInsights,
    userId && communityId ? { memberId: userId, communityId } : "skip"
  ) as any;

  const communityInfo = useOfflineQuery(
    (api as any).communities.getCommunityInfo,
    communityId ? { communityId } : "skip"
  ) as any;
  const showFertilizerPlanner = communityInfo?.showFertilizerPlanner === true;

  const fertilizerPlans = useOfflineQuery(
    (api as any).fertilizerPlanner.getFarmerPlans,
    userId && communityId === BIOFARM_COMMUNITY_ID && showFertilizerPlanner ? { farmerId: userId, communityId } : "skip"
  ) as any[] | undefined;

  const fertilizerInsights = useOfflineQuery(
    (api as any).fertilizerPlanner.getFertilizerInsightsData,
    userId && communityId === BIOFARM_COMMUNITY_ID && showFertilizerPlanner ? { farmerId: userId, communityId } : "skip"
  ) as any;

  const safeInsights = Array.isArray(insights) ? insights : [];
  const safeFertilizerPlans = Array.isArray(fertilizerPlans) ? fertilizerPlans : [];

  const bioFarmNames = useMemo(() => {
    const names = new Set<string>();
    for (const plan of safeFertilizerPlans) {
      if (plan?.farmName) names.add(String(plan.farmName));
    }
    return ["all", ...Array.from(names).sort((a, b) => a.localeCompare(b))];
  }, [safeFertilizerPlans]);

  useEffect(() => {
    if (!bioFarmNames.includes(selectedFarm)) {
      setSelectedFarm("all");
    }
  }, [bioFarmNames, selectedFarm]);

  const complianceData = useMemo(() => {
    const rows = Array.isArray(fertilizerInsights?.compliance) ? fertilizerInsights.compliance : [];
    const scoped = selectedFarm === "all"
      ? rows
      : rows.filter((row: any) => String(row.farmName || "") === selectedFarm);
    return scoped.map((row: any) => ({
      ...row,
      label: row.label || row.farmName || row.crop || "Plan",
    }));
  }, [fertilizerInsights, selectedFarm]);

  const projectionData = useMemo(() => {
    const rows = Array.isArray(fertilizerInsights?.projections) ? fertilizerInsights.projections : [];
    const scoped = selectedFarm === "all"
      ? rows
      : rows.filter((row: any) => String(row.farmName || "") === selectedFarm);
    return scoped.map((row: any) => ({
      ...row,
      label: row.label || row.farmName || row.crop || "Plan",
    }));
  }, [fertilizerInsights, selectedFarm]);

  const fertilizerByMonthData = useMemo(() => {
    if (!fertilizerInsights) return [];
    if (selectedFarm === "all") {
      return Array.isArray(fertilizerInsights.fertilizerByMonth)
        ? fertilizerInsights.fertilizerByMonth
        : [];
    }
    const farmScoped = fertilizerInsights.fertilizerByMonthByFarm?.[selectedFarm];
    return Array.isArray(farmScoped) ? farmScoped : [];
  }, [fertilizerInsights, selectedFarm]);

  const complianceSummary = useMemo(() => {
    const planned = complianceData.reduce((sum: number, row: any) => sum + Number(row.planned || 0), 0);
    const done = complianceData.reduce((sum: number, row: any) => sum + Number(row.done || 0), 0);
    const completionRate = planned > 0 ? Math.round((done / planned) * 100) : 0;
    const pending = Math.max(0, planned - done);
    return { planned, done, pending, completionRate };
  }, [complianceData]);

  const rightTrack = useMemo(() => {
    const scopedPlans = safeFertilizerPlans.filter((plan: any) =>
      selectedFarm === "all" ? true : String(plan.farmName || "") === selectedFarm
    );
    let checks = 0;
    let met = 0;
    for (const plan of scopedPlans) {
      const g = plan?.guarantee;
      if (!g) continue;
      checks += 4;
      if (g.doseCompliant) met += 1;
      if (g.scheduleCompliant) met += 1;
      if (g.photosComplete) met += 1;
      if (g.recordsComplete) met += 1;
    }
    const guaranteeScore = checks > 0 ? Math.round((met / checks) * 100) : complianceSummary.completionRate;
    const overall = Math.round((guaranteeScore * 0.7) + (complianceSummary.completionRate * 0.3));
    const tone = overall >= 85 ? "green" : overall >= 60 ? "amber" : "red";
    const label = tone === "green" ? "On Track" : tone === "amber" ? "Needs Attention" : "Off Track";
    return { score: overall, tone, label };
  }, [safeFertilizerPlans, selectedFarm, complianceSummary.completionRate]);

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

  if (authStatus === "loading") {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>Loading user session...</p>
      </div>
    );
  }

  if (authStatus === "unauthenticated" || !userId) {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>Your session expired. Please log in again.</p>
        <Link href="/login" style={{ color: BRAND }}>Go to Login</Link>
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
        {communityId === BIOFARM_COMMUNITY_ID && showFertilizerPlanner && (
          <div style={{ marginBottom: "1rem", display: "grid", gap: "0.75rem" }}>
            <div style={{ background: "#fff", border: "1px solid #d9ecd9", borderRadius: 12, padding: "0.85rem" }}>
              <h2 style={{ margin: 0, fontSize: "1rem", color: "#1b5e20" }}>🌱 Fertilizer Planner</h2>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "#666" }}>
                Chart-only performance view linked to farm names and spray schedules.
              </p>
            </div>

            {fertilizerInsights && (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #ececec", padding: "0.75rem", display: "grid", gap: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#333" }}>Farm Filter</p>
                    <select
                      value={selectedFarm}
                      onChange={(e) => setSelectedFarm(e.target.value)}
                      style={{ border: "1px solid #d9d9d9", borderRadius: 8, padding: "0.45rem 0.6rem", fontSize: "0.82rem", minWidth: 190 }}
                    >
                      {(Array.isArray(bioFarmNames) ? bioFarmNames : ["all"]).map((name) => (
                        <option key={name} value={name}>
                          {name === "all" ? "All Farms" : name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.55rem" }}>
                    <div style={{ border: "1px solid #eef2ef", borderRadius: 10, background: "#fafcfa", padding: "0.6rem" }}>
                      <div style={{ fontSize: "0.72rem", color: "#666" }}>Planned Sprays</div>
                      <div style={{ marginTop: "0.15rem", fontSize: "1.05rem", fontWeight: 700 }}>{complianceSummary.planned}</div>
                    </div>
                    <div style={{ border: "1px solid #eef2ef", borderRadius: 10, background: "#fafcfa", padding: "0.6rem" }}>
                      <div style={{ fontSize: "0.72rem", color: "#666" }}>Logged Sprays</div>
                      <div style={{ marginTop: "0.15rem", fontSize: "1.05rem", fontWeight: 700, color: "#2e7d32" }}>{complianceSummary.done}</div>
                    </div>
                    <div style={{ border: "1px solid #eef2ef", borderRadius: 10, background: "#fafcfa", padding: "0.6rem" }}>
                      <div style={{ fontSize: "0.72rem", color: "#666" }}>Pending Sprays</div>
                      <div style={{ marginTop: "0.15rem", fontSize: "1.05rem", fontWeight: 700, color: "#ef6c00" }}>{complianceSummary.pending}</div>
                    </div>
                    <div style={{ border: "1px solid #eef2ef", borderRadius: 10, background: "#fafcfa", padding: "0.6rem" }}>
                      <div style={{ fontSize: "0.72rem", color: "#666" }}>On-Track Score</div>
                      <div style={{ marginTop: "0.15rem", fontSize: "1.05rem", fontWeight: 700, color: rightTrack.tone === "green" ? "#2e7d32" : rightTrack.tone === "amber" ? "#ef6c00" : "#c62828" }}>
                        {rightTrack.score}% · {rightTrack.label}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #ececec", padding: "0.75rem" }}>
                  <p style={{ margin: "0 0 0.45rem", fontSize: "0.85rem", fontWeight: 700, color: "#333" }}>Spray Compliance by Farm</p>
                  <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer>
                      <BarChart data={Array.isArray(complianceData) ? complianceData : []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
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
                      <BarChart data={Array.isArray(fertilizerByMonthData) ? fertilizerByMonthData : []}>
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
                  <p style={{ margin: "0 0 0.45rem", fontSize: "0.85rem", fontWeight: 700, color: "#333" }}>Yield Projection vs Baseline by Farm</p>
                  <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer>
                      <BarChart data={Array.isArray(projectionData) ? projectionData : []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
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

        {communityId === BIOFARM_COMMUNITY_ID && communityInfo !== undefined && !showFertilizerPlanner && (
          <div style={{ background: "#fff", border: "1px dashed #cfd8dc", borderRadius: 12, padding: "0.85rem", color: "#607d8b" }}>
            Fertilizer Planner is hidden by your community admin.
          </div>
        )}

        {!safeInsights.length && !insights && (
          <div style={{ textAlign: "center", padding: "2rem", color: "#888", background: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            <p style={{ fontSize: "clamp(0.95rem, 2.5vw, 1.05rem)" }}>Loading insights...</p>
          </div>
        )}

        {!!insights && safeInsights.length === 0 && (
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

        {communityId !== BIOFARM_COMMUNITY_ID && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {safeInsights.map((insight: any) => (
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
                {Object.entries(insight?.totals || {}).map(([label, value]: [string, any]) => (
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
        )}
      </div>

      <CommunityTabBar />
    </div>
  );
}
