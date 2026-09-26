"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useStoredUser } from "../../hooks/useStoredUser";
import { FONT, ON_PHOTO_SHADOW, EXPORT_BROWN, card, MarketsHelper } from "../../components/exportMarkets/ui";

/**
 * Buyer-facing Export Markets. Phase 1 introduces the section and explains
 * how it differs from Advanced Markets; the anonymous lot catalogue, price
 * ticker and offers arrive in the following phases.
 */
export default function BuyerExportMarketsPage() {
  const { user, status } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  const onboarding = useQuery(
    api.buyerOnboarding.checkOnboardingStatus,
    userId && user?.role === "buyer" ? { userId } : "skip"
  );

  if (status === "loading") return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading...</div>;

  return (
    <div style={{ padding: "1rem", maxWidth: 820, margin: "0 auto", fontFamily: FONT }}>
      <div style={{ marginBottom: "1rem" }}>
        <Link href="/" style={{ color: "#0d47a1", fontWeight: 700, fontSize: "0.9rem", textDecoration: "none", textShadow: ON_PHOTO_SHADOW }}>
          ← Back to Dashboard
        </Link>
      </div>
      <h1 style={{ fontSize: "1.45rem", fontWeight: 800, margin: "0 0 0.5rem", color: EXPORT_BROWN, textShadow: ON_PHOTO_SHADOW }}>
        ☕ Export Markets
      </h1>

      <MarketsHelper highlight="export" />

      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>How buying for export works</h2>
        <ol style={{ paddingLeft: "1.2rem", lineHeight: 1.7, fontSize: "0.9rem", margin: 0 }}>
          <li>Browse lots from verified exporters. You see each exporter&apos;s alias, rating and delivery record.</li>
          <li>Ask for a price. Prices are given on request.</li>
          <li>Once an exporter accepts your offer, you submit your company KYC documents for approval.</li>
          <li>The platform collects a sample from the exporter and sends it to you to approve.</li>
          <li>You agree the contract. Company names are shared once the platform fees are paid.</li>
          <li>Follow payment, shipment and delivery step by step, with a traceability report back to the farms.</li>
        </ol>
      </div>

      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Export lots</h2>
        <p style={{ fontSize: "0.9rem", margin: 0 }}>
          No export lots are listed yet. Lots from verified exporters will appear here.
        </p>
        {onboarding?.countryName && (
          <p style={{ fontSize: "0.82rem", color: "#666", marginBottom: 0 }}>Buying from: {onboarding.countryName}</p>
        )}
      </div>

      <div style={{ textAlign: "center" }}>
        <Link href="/buyer/advance-purchase" style={{ color: "#6a1b9a", fontWeight: 700, fontSize: "0.9rem", textShadow: ON_PHOTO_SHADOW }}>
          Looking to fund production instead? Go to Advanced Markets →
        </Link>
      </div>
    </div>
  );
}
