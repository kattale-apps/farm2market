"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { FONT } from "../../components/shared";

/** Old ad links (shared before MarketSpace cards) open the ad's card page. */
export default function MarketspaceAdPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const cardId = useQuery(api.marketspace.cardIdForAd, params?.id ? { adId: params.id } : "skip");

  useEffect(() => {
    if (cardId) router.replace(`/marketspace/p/${cardId}`);
  }, [cardId, router]);

  return (
    <div style={{ minHeight: "100vh", background: "#f6f8f4", fontFamily: FONT, textAlign: "center", padding: "3rem 1rem" }}>
      {cardId === null ? (
        <>
          <p style={{ fontWeight: 700 }}>This ad is no longer on MarketSpace.</p>
          <Link href="/marketspace?view=classifieds" style={{ color: "#1b5e20", fontWeight: 800 }}>Discover other ads →</Link>
        </>
      ) : (
        <p style={{ color: "#777" }}>Opening the ad…</p>
      )}
    </div>
  );
}
