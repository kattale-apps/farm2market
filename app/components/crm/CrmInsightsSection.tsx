"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

/**
 * Call-centre findings on the community insights dashboard.
 *
 * The CRM tab answers "what did this client say"; this answers "what are we
 * learning across everyone we called" — whether the product is being used,
 * how it is rating, what is going wrong and who intends to buy again.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const COLORS = ["#2e7d32", "#1565c0", "#ef6c00", "#8e24aa", "#c62828", "#00838f", "#6d4c41", "#546e7a"];
const BAND_COLORS: Record<string, string> = { green: "#2e7d32", yellow: "#f9a825", red: "#c62828" };
const OUTCOME_COLORS: Record<string, string> = {
  "Good result": "#2e7d32",
  "Wants more": "#1565c0",
  "Problem reported": "#c62828",
  "No answer": "#9e9e9e",
};

const LABELS: Record<string, string> = {
  good_result: "Good result", problem: "Problem reported", wants_more: "Wants more", no_answer: "No answer",
  yes: "Yes", partly: "Partly", no: "No", unknown: "Unknown", maybe: "Undecided",
  very_good: "Very good", good: "Good", average: "Average", poor: "Poor", very_poor: "Very poor",
  none: "No issue", application_problem: "Application", product_problem: "Product",
  packaging_problem: "Packaging", delivery_problem: "Delivery", technical_advice: "Needs advice", other: "Other",
  green: "Healthy", yellow: "At risk", red: "Critical",
};

type Slice = { name: string; value: number };

const pretty = (data: Slice[] = []) => data.map((d) => ({ ...d, name: LABELS[d.name] || d.name }));

const RANGES: Array<{ key: string; label: string; days: number | null }> = [
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "all", label: "All time", days: null },
];

export function CrmInsightsSection({
  communityId,
  userId,
  isMobile,
}: {
  communityId: Id<"communities">;
  userId: Id<"users">;
  isMobile: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [rangeKey, setRangeKey] = useState("30");

  const fromTs = useMemo(() => {
    const range = RANGES.find((r) => r.key === rangeKey);
    if (!range?.days) return undefined;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start.getTime() - range.days * DAY_MS;
  }, [rangeKey]);

  const data = useQuery(api.crmAnalytics.getCrmInsights, {
    communityId,
    requesterId: userId,
    ...(fromTs != null ? { fromTs } : {}),
  });

  const tooltipStyle = { fontSize: isMobile ? "0.78rem" : "0.82rem", padding: "0.4rem 0.6rem", borderRadius: "6px" };
  const gridColumns = isMobile ? "1fr" : "1fr 1fr";

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginBottom: "0.75rem" }}
      >
        <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a237e" }}>📞 Call Centre Insights</span>
        <span style={{ fontSize: "0.8rem", color: "#888" }}>{open ? "▼" : "▶"}</span>
      </div>

      {open && (
        <>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
            {RANGES.map((range) => (
              <button
                key={range.key}
                onClick={() => setRangeKey(range.key)}
                style={{
                  padding: "0.3rem 0.7rem", borderRadius: 999, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
                  border: rangeKey === range.key ? "1px solid #1a237e" : "1px solid #ddd",
                  background: rangeKey === range.key ? "#1a237e" : "#fff",
                  color: rangeKey === range.key ? "#fff" : "#555",
                }}
              >
                {range.label}
              </button>
            ))}
          </div>

          {data === undefined && (
            <div style={{ padding: "1.5rem", textAlign: "center", color: "#999" }}>Loading call centre data...</div>
          )}

          {data && data.totalSubmissions === 0 && data.totalCalls === 0 && (
            <div style={{ padding: "1.5rem", textAlign: "center", color: "#999" }}>
              No CRM submissions or calls in this period.
            </div>
          )}

          {data && (data.totalSubmissions > 0 || data.totalCalls > 0) && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
                <Kpi label="Forms Submitted" value={data.totalSubmissions} bg="#e8f5e9" fg="#2e7d32" />
                <Kpi label="Calls Logged" value={data.totalCalls} bg="#e3f2fd" fg="#1565c0" />
                <Kpi label="New Clients" value={data.newClients} bg="#fff3e0" fg="#ef6c00" />
                <Kpi
                  label="Avg Health Score"
                  value={data.averageHealthScore != null ? data.averageHealthScore : "—"}
                  bg="#f3e5f5"
                  fg="#6a1b9a"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: gridColumns, gap: "1rem" }}>
                {data.submissionsOverTime.length > 1 && (
                  <ChartCard title="Submissions Over Time" wide={!isMobile}>
                    <ResponsiveContainer width="100%" height={isMobile ? 220 : 200}>
                      <LineChart data={data.submissionsOverTime}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: isMobile ? 9 : 10 }} />
                        <YAxis tick={{ fontSize: isMobile ? 9 : 10 }} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Line type="monotone" dataKey="value" stroke="#1565c0" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                <DonutCard
                  title="Call Outcomes"
                  data={pretty(data.outcomeData)}
                  isMobile={isMobile}
                  tooltipStyle={tooltipStyle}
                  colorFor={(name, i) => OUTCOME_COLORS[name] || COLORS[i % COLORS.length]}
                />

                <BarCard
                  title="Is the Product Being Used?"
                  data={pretty(data.usageData)}
                  isMobile={isMobile}
                  tooltipStyle={tooltipStyle}
                  fill="#2e7d32"
                />

                <BarCard
                  title="Result Rating Reported"
                  data={pretty(data.resultRatingData)}
                  isMobile={isMobile}
                  tooltipStyle={tooltipStyle}
                  fill="#1565c0"
                />

                <BarCard
                  title="Issues Reported"
                  data={pretty(data.issueTypeData.filter((d: Slice) => d.name !== "none"))}
                  isMobile={isMobile}
                  tooltipStyle={tooltipStyle}
                  fill="#c62828"
                  emptyNote="No problems reported in this period."
                />

                <DonutCard
                  title="Intention to Buy Again"
                  data={pretty(data.repurchaseData)}
                  isMobile={isMobile}
                  tooltipStyle={tooltipStyle}
                  colorFor={(name, i) =>
                    name === "Yes" ? "#2e7d32" : name === "No" ? "#c62828" : name === "Undecided" ? "#f9a825" : COLORS[i % COLORS.length]
                  }
                />

                <DonutCard
                  title="Client Health"
                  data={pretty(data.healthBandData)}
                  isMobile={isMobile}
                  tooltipStyle={tooltipStyle}
                  colorFor={(name, i) => {
                    const key = Object.keys(BAND_COLORS).find((k) => LABELS[k] === name);
                    return (key && BAND_COLORS[key]) || COLORS[i % COLORS.length];
                  }}
                />

                <BarCard
                  title="Top Crops Grown"
                  data={data.cropData.slice(0, 8)}
                  isMobile={isMobile}
                  tooltipStyle={tooltipStyle}
                  fill="#6d4c41"
                  emptyNote="No crop captured on intake yet."
                />

                <BarCard
                  title="Products Purchased"
                  data={data.productData.slice(0, 8)}
                  isMobile={isMobile}
                  tooltipStyle={tooltipStyle}
                  fill="#8e24aa"
                  emptyNote="No product captured on intake yet."
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, bg, fg }: { label: string; value: number | string; bg: string; fg: string }) {
  return (
    <div style={{ flex: "1 1 130px", background: bg, padding: "0.75rem", borderRadius: "8px", textAlign: "center" }}>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: fg }}>{value}</div>
      <div style={{ fontSize: "0.78rem", color: "#555" }}>{label}</div>
    </div>
  );
}

function ChartCard({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div
      style={{
        background: "#fafafa", borderRadius: "10px", border: "1px solid #eee", padding: "1rem",
        ...(wide ? { gridColumn: "1 / -1" } : {}),
      }}
    >
      <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", fontWeight: 700, color: "#333" }}>{title}</h4>
      {children}
    </div>
  );
}

function BarCard({
  title, data, isMobile, tooltipStyle, fill, emptyNote,
}: {
  title: string;
  data: Slice[];
  isMobile: boolean;
  tooltipStyle: Record<string, string>;
  fill: string;
  emptyNote?: string;
}) {
  return (
    <ChartCard title={title}>
      {data.length === 0 ? (
        <div style={{ padding: "1.5rem 0", textAlign: "center", color: "#999", fontSize: "0.82rem" }}>
          {emptyNote || "Nothing recorded yet."}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={isMobile ? 230 : 210}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              interval={0}
              height={isMobile ? 56 : 40}
              tick={isMobile ? { fontSize: 9, angle: -35, textAnchor: "end" } : { fontSize: 10 }}
            />
            <YAxis tick={{ fontSize: isMobile ? 9 : 10 }} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" fill={fill} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function DonutCard({
  title, data, isMobile, tooltipStyle, colorFor,
}: {
  title: string;
  data: Slice[];
  isMobile: boolean;
  tooltipStyle: Record<string, string>;
  colorFor: (name: string, index: number) => string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <ChartCard title={title}>
      {data.length === 0 ? (
        <div style={{ padding: "1.5rem 0", textAlign: "center", color: "#999", fontSize: "0.82rem" }}>
          Nothing recorded yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={isMobile ? 250 : 230}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="45%"
              innerRadius={isMobile ? 44 : 48}
              outerRadius={isMobile ? 70 : 76}
              labelLine={false}
              label={
                isMobile
                  ? false
                  : ({ percent }: any) => (percent > 0.06 ? `${(percent * 100).toFixed(0)}%` : "")
              }
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={colorFor(d.name, i)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: any) => [
                `${value} (${total ? ((Number(value) / total) * 100).toFixed(0) : 0}%)`,
                "Calls",
              ]}
            />
            <Legend
              layout={isMobile ? "vertical" : "horizontal"}
              align="center"
              verticalAlign="bottom"
              iconSize={isMobile ? 10 : 11}
              wrapperStyle={{ fontSize: isMobile ? "0.74rem" : "0.78rem", paddingTop: "0.3rem" }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
