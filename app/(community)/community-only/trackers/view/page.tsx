"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import CommunityTabBar from "@/app/components/CommunityTabBar";

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

  const submissions = useQuery(
    (api as any).forms.getMySubmissions,
    userId && communityId ? { memberId: userId, communityId } : "skip"
  );

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
            📋 My Submissions
          </h1>
          <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.85 }}>
            Your business tracker entries
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
          {submissions && submissions.map((sub: any) => (
            <div key={sub._id} style={{
              padding: "0.85rem",
              borderRadius: 10,
              background: "#fff",
              border: "1px solid #e0e0e0",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: CATEGORY_COLORS[sub.category] || "#666",
                  }}>
                    {sub.category || "entry"}
                  </span>
                  <h3 style={{ margin: "0.1rem 0 0 0", fontSize: "0.9rem", fontWeight: 600, color: "#1a1a1a" }}>
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

              {/* Show a few key values */}
              <div style={{ marginTop: "0.4rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {sub.values.slice(0, 4).map((v: any, i: number) => (
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
                {sub.values.length > 4 && (
                  <span style={{ fontSize: "0.72rem", color: "#999" }}>
                    +{sub.values.length - 4} more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <CommunityTabBar />
    </div>
  );
}
