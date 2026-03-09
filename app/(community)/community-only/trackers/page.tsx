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

const CATEGORY_LABELS: Record<string, string> = {
  revenue: "Revenue",
  expense: "Expense",
  inventory: "Inventory",
  profit_loss: "Profit & Loss",
  cashflow: "Cash Flow",
  custom: "Custom",
};

const CATEGORY_COLORS: Record<string, string> = {
  revenue: "#2e7d32",
  expense: "#d32f2f",
  inventory: "#1976d2",
  profit_loss: "#f57c00",
  cashflow: "#00838f",
  custom: "#7b1fa2",
};

export default function TrackersHubPage() {
  const searchParams = useSearchParams();
  const communityId = searchParams.get("communityId") as Id<"communities"> | null;
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pilot_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.userId) setUserId(parsed.userId);
      }
    } catch {}
  }, []);

  const forms = useOfflineQuery(
    (api as any).forms.getCommunityForms,
    communityId ? { communityId } : "skip"
  ) as any;

  const activeForms = forms?.filter((f: any) => f.isActive) || [];

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
          📊 Business Trackers
        </h1>
        <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", opacity: 0.9, fontStyle: "italic" }}>
          Know Your Numbers
        </p>
      </div>

      {/* Content */}
      <div style={{ padding: "1rem" }}>
        {!forms && (
          <div style={{ textAlign: "center", padding: "2rem", color: "#888", background: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            <p style={{ fontSize: "clamp(0.95rem, 2.5vw, 1.05rem)" }}>Loading trackers...</p>
          </div>
        )}

        {forms && activeForms.length === 0 && (
          <div style={{ textAlign: "center", padding: "2rem", color: "#666", background: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📊</p>
            <p style={{ fontSize: "clamp(1rem, 3vw, 1.1rem)", fontWeight: 600 }}>No business trackers available yet.</p>
            <p style={{ fontSize: "clamp(0.85rem, 2.5vw, 0.95rem)", color: "#999" }}>Your community admin will set these up.</p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {activeForms.map((form: any) => (
            <Link
              key={form._id}
              href={`/community-only/trackers/fill?communityId=${communityId}&formId=${form._id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div style={{
                padding: "1rem",
                borderRadius: 12,
                background: "#fff",
                border: `2px solid ${CATEGORY_COLORS[form.category] || "#e0e0e0"}`,
                boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                transition: "transform 0.15s",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: `${CATEGORY_COLORS[form.category] || BRAND}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.3rem",
                    flexShrink: 0,
                  }}>
                    {form.category === "revenue" ? "💰" :
                     form.category === "expense" ? "💸" :
                     form.category === "inventory" ? "📦" :
                     form.category === "profit_loss" ? "📈" :
                     form.category === "cashflow" ? "🔄" : "📝"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: CATEGORY_COLORS[form.category] || "#666",
                    }}>
                      {CATEGORY_LABELS[form.category] || "Custom"}
                    </span>
                    <h3 style={{ margin: "0.15rem 0 0 0", fontSize: "0.95rem", fontWeight: 600, color: "#1a1a1a" }}>
                      {form.name}
                    </h3>
                    {form.description && (
                      <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.75rem", color: "#888" }}>
                        {form.description}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: "1.2rem", color: "#ccc" }}>→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* My Submissions Link */}
        {userId && activeForms.length > 0 && (
          <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
            <Link
              href={`/community-only/trackers/view?communityId=${communityId}`}
              style={{
                display: "inline-block",
                padding: "0.6rem 1.2rem",
                background: "#f5f5f5",
                color: "#333",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: "0.85rem",
                fontWeight: 600,
                border: "1px solid #ddd",
              }}
            >
              📋 View My Submissions
            </Link>
          </div>
        )}
      </div>

      <CommunityTabBar />
    </div>
  );
}
