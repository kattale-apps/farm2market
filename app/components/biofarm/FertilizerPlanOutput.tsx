"use client";

import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { useOfflineQuery } from "@/app/hooks/useOfflineQuery";
import { YieldGuaranteeBadge } from "./YieldGuaranteeBadge";

const CROP_EMOJI: Record<string, string> = {
  Maize: "🌽",
  Beans: "🫘",
  Groundnuts: "🥜",
  Rice: "🌾",
  Tomatoes: "🍅",
  Pineapple: "🍍",
  Bananas: "🍌",
  Coffee: "☕",
};

const KNAPSACK_ICON_PATH = "/icons/knapsack-sprayer.png";

export function FertilizerPlanOutput({
  planId,
  farmerId,
  communityId,
  applicationFormId,
}: {
  planId: Id<"fertilizerPlans">;
  farmerId: Id<"users">;
  communityId: Id<"communities">;
  applicationFormId?: Id<"communityForms"> | null;
}) {
  const details = useOfflineQuery(
    (api as any).fertilizerPlanner.getPlanWithDetails,
    { planId, farmerId }
  ) as any;

  if (!details) {
    return <p style={{ margin: 0, fontSize: "0.82rem", color: "#777" }}>Loading plan details...</p>;
  }

  const plan = details.plan;
  const projection = details.projection;
  const complianceByDate = details.complianceByDate || [];

  return (
    <div style={{ display: "grid", gap: "0.7rem" }}>
      <div style={{ border: "1px solid #e6e6e6", borderRadius: 10, padding: "0.75rem", background: "#fff" }}>
        <p style={{ margin: 0, fontWeight: 800, color: "#1a1a1a", fontSize: "0.95rem" }}>
          {CROP_EMOJI[plan.crop] || "🌱"} {plan.crop.toUpperCase()}
        </p>

        <div style={{ marginTop: "0.55rem", display: "grid", gap: "0.45rem" }}>
          <div style={{ fontSize: "0.82rem" }}>📏 Farm size: {plan.acres} acres</div>
          <div style={{ fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <img
              src={KNAPSACK_ICON_PATH}
              alt="Knapsack sprayer"
              width={18}
              height={18}
              style={{ display: "inline-block", objectFit: "contain", borderRadius: 3 }}
            />
            <span>Knapsacks: {plan.knapsacks}</span>
          </div>
          <div style={{ fontSize: "0.82rem" }}>🧴 Mix per tank: {plan.doseMl} ml fertilizer + {Math.round(plan.waterRequiredL / Math.max(plan.knapsacks, 1))}L water</div>
          <div style={{ fontSize: "0.82rem" }}>📦 Bottles per spray: {plan.bottlesPerSpray}</div>
          <div style={{ fontSize: "0.82rem" }}>📦 Bottles needed this season: {plan.totalBottles}</div>
          <div style={{ fontSize: "0.82rem" }}>💧 Water needed: {plan.waterRequiredL}L</div>
        </div>
      </div>

      <div style={{ border: "1px solid #e6e6e6", borderRadius: 10, padding: "0.75rem", background: "#fff" }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: "0.85rem", color: "#1b5e20" }}>🌱 Spray Days</p>
        <div style={{ marginTop: "0.55rem", display: "grid", gap: "0.4rem", maxHeight: 230, overflowY: "auto", paddingRight: 4 }}>
          {complianceByDate.map((item: any) => {
            const statusEmoji = item.status === "done" ? "✅" : item.status === "missed" ? "❌" : "⏳";
            const canLog = item.status !== "done";
            return (
              <div key={item.date} style={{
                border: "1px solid #efefef",
                borderRadius: 8,
                padding: "0.45rem 0.55rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
              }}>
                <span style={{ fontSize: "0.8rem", color: "#333" }}>
                  {statusEmoji} {new Date(`${item.date}T00:00:00Z`).toLocaleDateString("en-UG", { day: "numeric", month: "short" })}
                </span>
                {canLog && applicationFormId && (
                  <Link
                    href={`/community-only/trackers/fill?communityId=${communityId}&formId=${applicationFormId}&planId=${planId}&plannedSprayDate=${item.date}`}
                    style={{ fontSize: "0.75rem", color: "#1565c0", fontWeight: 700, textDecoration: "none" }}
                  >
                    Log Spray Day →
                  </Link>
                )}
                {canLog && !applicationFormId && (
                  <span style={{ fontSize: "0.72rem", color: "#888" }}>No Application Record form</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <YieldGuaranteeBadge
        guarantee={details.guarantee}
        projectedYieldTons={projection?.projectedYieldTons}
      />

      {projection && (
        <div style={{ border: "1px solid #e6e6e6", borderRadius: 10, padding: "0.75rem", background: "#fff" }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.85rem", color: "#1b5e20" }}>
            📊 Expected Harvest with Bio Farm
          </p>
          <p style={{ margin: "0.35rem 0 0", fontSize: "1rem", fontWeight: 800, color: "#2e7d32" }}>
            {projection.projectedYieldTons.toFixed(2)} tons
          </p>
        </div>
      )}
    </div>
  );
}
