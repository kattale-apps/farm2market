"use client";

export const dynamic = "force-dynamic";

import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import CommunityTabBar from "@/app/components/CommunityTabBar";
import { useOfflineQuery } from "@/app/hooks/useOfflineQuery";

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

export default function TrackerViewPage() {
  const searchParams = useSearchParams();
  const communityId = searchParams.get("communityId") as Id<"communities"> | null;
  const formId = searchParams.get("formId") as Id<"communityForms"> | null;
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pilot_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.userId) setUserId(parsed.userId as Id<"users">);
      }
    } catch {}
  }, []);

  const submissions = useOfflineQuery(
    (api as any).forms.getMySubmissions,
    userId && communityId
      ? { memberId: userId, communityId, formId: formId || undefined }
      : "skip"
  ) as any;

  const selectedFormName = submissions?.[0]?.formName || "My Submissions";

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
        padding: "1rem",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
      }}>
        <Link
          href={`/community-only/trackers?communityId=${communityId}`}
          style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}
        >
          ←
        </Link>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
            {formId ? `📋 ${selectedFormName}` : "📋 My Submissions"}
          </h1>
          <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.85 }}>
            {formId ? "Tap a card to open full entry view" : "Your business tracker entries"}
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "1rem" }}>
        {!submissions && (
          <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Loading...</div>
        )}

        {submissions && submissions.length === 0 && (
          <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>
            <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📋</p>
            <p style={{ fontSize: "0.95rem" }}>No submissions yet.</p>
            <Link
              href={`/community-only/trackers?communityId=${communityId}`}
              style={{ color: BRAND, fontSize: "0.9rem" }}
            >
              Fill out a tracker →
            </Link>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {submissions && submissions.map((sub: any) => {
            const isExpanded = expandedId === String(sub._id);
            return (
              <div key={sub._id} style={{
                padding: "0.85rem",
                borderRadius: 10,
                background: "#fff",
                border: "1px solid #e0e0e0",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: CATEGORY_COLORS[sub.category] || "#666",
                    }}>
                      {sub.category || "entry"}
                    </span>
                    <h3 style={{ margin: "0.1rem 0 0 0", fontSize: "0.9rem", fontWeight: 600, color: "#1a1a1a", overflowWrap: "anywhere" }}>
                      {sub.formName}
                    </h3>
                  </div>
                  <span style={{
                    fontSize: "0.7rem",
                    color: "#888",
                    whiteSpace: "nowrap",
                  }}>
                    {new Date(sub.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <button
                  onClick={() => setExpandedId(isExpanded ? null : String(sub._id))}
                  style={{
                    marginTop: "0.55rem",
                    border: "1px solid #d9d9d9",
                    background: isExpanded ? "#eef7ee" : "#f9f9f9",
                    color: isExpanded ? "#2e7d32" : "#555",
                    borderRadius: 8,
                    padding: "0.4rem 0.65rem",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {isExpanded ? "▲ Close full view" : "▼ Open full view"}
                </button>

                {!isExpanded && (
                  <div style={{ marginTop: "0.45rem", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {(sub.values || []).slice(0, 3).map((v: any, i: number) => (
                      <span key={i} style={{
                        fontSize: "0.72rem",
                        background: "#f5f5f5",
                        padding: "0.15rem 0.4rem",
                        borderRadius: 4,
                        color: "#555",
                      }}>
                        {v.value}
                      </span>
                    ))}
                    {(sub.values || []).length > 3 && (
                      <span style={{ fontSize: "0.72rem", color: "#999" }}>
                        +{sub.values.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                {isExpanded && (
                  <div style={{ marginTop: "0.6rem", borderTop: "1px solid #eee", paddingTop: "0.5rem" }}>
                    {(sub.values || []).map((valueRow: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(100px, 42%) 1fr",
                          gap: "0.5rem",
                          padding: "0.35rem 0",
                          borderBottom: "1px dashed #f0f0f0",
                        }}
                      >
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#666", overflowWrap: "anywhere" }}>
                          {valueRow.fieldLabel || "Field"}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "#222", overflowWrap: "anywhere" }}>
                          {valueRow.value || "-"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <CommunityTabBar />
    </div>
  );
}
