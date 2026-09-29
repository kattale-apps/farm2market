"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { AdDetail } from "../../components/AdDetail";
import { ReportSheet } from "../../components/Sheets";
import { TopBar } from "../../components/TopBar";
import { FONT, useMarketspaceSession, useUgandaNow, type AdCardData } from "../../components/shared";

/** One ad on its own page, so it can be shared as a link. */
export default function MarketspaceAdPage() {
  const params = useParams<{ id: string }>();
  const session = useMarketspaceSession();
  const now = useUgandaNow();
  const [boardNow] = useState(now);
  const ad = useQuery(api.marketspace.getAd, params?.id ? { adId: params.id, now: boardNow } : "skip") as AdCardData | null | undefined;
  const [reporting, setReporting] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#f6f8f4", fontFamily: FONT }}>
      <TopBar status={session.status} backHref="/marketspace" />
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "1rem" }}>
        {ad === undefined ? (
          <p style={{ textAlign: "center", color: "#777", padding: "3rem 0" }}>Loading ad…</p>
        ) : ad === null ? (
          <div style={{ textAlign: "center", padding: "3rem 1rem", background: "#fff", borderRadius: 16 }}>
            <div style={{ fontSize: "2.2rem" }}>🔍</div>
            <p style={{ fontWeight: 700 }}>This ad is no longer on Marketspace.</p>
            <p style={{ color: "#666", fontSize: "0.9rem" }}>It may have been sold, expired or removed.</p>
            <Link href="/marketspace" style={{ color: "#1b5e20", fontWeight: 800 }}>
              Browse all ads →
            </Link>
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 16, padding: "1rem", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <AdDetail ad={ad} now={now} onReport={() => setReporting(true)} />
          </div>
        )}
      </main>
      {reporting && ad && <ReportSheet ad={ad} sessionToken={session.token} onClose={() => setReporting(false)} />}
    </div>
  );
}
