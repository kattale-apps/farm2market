"use client";

import { useMemo, useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { useOfflineQuery } from "@/app/hooks/useOfflineQuery";
import { FertilizerPlannerForm } from "./FertilizerPlannerForm";
import { FertilizerPlanOutput } from "./FertilizerPlanOutput";

export function FertilizerPlansView({
  communityId,
  farmerId,
}: {
  communityId: Id<"communities">;
  farmerId: Id<"users">;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  const plans = useOfflineQuery(
    (api as any).fertilizerPlanner.getFarmerPlans,
    { farmerId, communityId }
  ) as any[] | undefined;

  const forms = useOfflineQuery(
    (api as any).forms.getCommunityForms,
    { communityId }
  ) as any[] | undefined;

  const applicationFormId = useMemo(() => {
    const aliases = [
      "application record",
      "fertilizer application",
      "fertiliser application",
      "spray record",
      "spray log",
      "spray day record",
      "spray day log",
      "application",
    ];
    const form = (forms || []).find((item: any) =>
      item.isActive && aliases.some((alias) => {
        const name = String(item.name || "").toLowerCase();
        const description = String(item.description || "").toLowerCase();
        return name.includes(alias) || description.includes(alias);
      })
    );
    return form?._id || null;
  }, [forms]);

  return (
    <div style={{ display: "grid", gap: "0.8rem" }}>
      <div style={{ border: "1px solid #d7e9d7", borderRadius: 12, background: "#fff", padding: "0.85rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "1rem", color: "#1b5e20" }}>🌱 Bio Farm Fertilizer Planner</h2>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "0.55rem 0.75rem",
              background: "#2e7d32",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            {showCreate ? "Close" : "+ Create New Plan"}
          </button>
        </div>

        {!applicationFormId && (
          <p style={{ margin: "0.55rem 0 0", fontSize: "0.78rem", color: "#ef6c00" }}>
            Admin note: create an Application Record form in Forms tab to enable Spray Day logging links.
          </p>
        )}
      </div>

      {showCreate && (
        <FertilizerPlannerForm
          farmerId={farmerId}
          communityId={communityId}
          onCreated={() => setShowCreate(false)}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {!plans && (
        <div style={{ border: "1px solid #eee", borderRadius: 10, background: "#fff", padding: "0.8rem", color: "#777" }}>
          Loading plans...
        </div>
      )}

      {plans && plans.length === 0 && (
        <div style={{ border: "1px solid #eee", borderRadius: 10, background: "#fff", padding: "0.8rem", color: "#777" }}>
          No fertilizer plans yet. Tap Create New Plan to get started.
        </div>
      )}

      {plans && plans.map((plan: any) => {
        const expanded = expandedPlanId === String(plan._id);
        return (
          <div key={plan._id} style={{ border: "1px solid #e7e7e7", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setExpandedPlanId(expanded ? null : String(plan._id))}
              style={{
                width: "100%",
                border: "none",
                background: "#fff",
                padding: "0.85rem",
                textAlign: "left",
                display: "grid",
                gap: "0.35rem",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <strong style={{ color: "#1a1a1a", fontSize: "0.95rem", overflowWrap: "anywhere" }}>{plan.crop} - {plan.farmName}</strong>
                <span style={{ fontSize: "0.74rem", padding: "0.2rem 0.5rem", borderRadius: 999, background: plan.status === "active" ? "#e8f5e9" : "#f5f5f5", color: plan.status === "active" ? "#1b5e20" : "#555" }}>
                  {plan.status}
                </span>
              </div>
              <span style={{ fontSize: "0.78rem", color: "#666" }}>
                {plan.acres} acres | {plan.sprayDates?.length || 0} spray days | {expanded ? "Tap to collapse" : "Tap to open"}
              </span>
            </button>

            {expanded && (
              <div style={{ padding: "0.8rem", borderTop: "1px solid #eee", background: "#fafafa" }}>
                <FertilizerPlanOutput
                  planId={plan._id}
                  farmerId={farmerId}
                  communityId={communityId}
                  applicationFormId={applicationFormId}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
