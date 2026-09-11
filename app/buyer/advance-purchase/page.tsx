"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { useStoredUser } from "../../hooks/useStoredUser";

const FONT = '"Montserrat", sans-serif';

export default function AdvancePurchaseMarketPage() {
  const { user, status } = useStoredUser();
  const offers = useQuery(api.advancePurchase.listMarketOffers, {});
  const myCommitments = useQuery(
    api.advancePurchase.listMyCommitments,
    user ? { buyerId: user.userId as any } : "skip"
  );

  if (status === "loading" || offers === undefined) {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading Advance Purchase Market...</div>;
  }
  if (status === "unauthenticated" || !user || user.role !== "buyer") {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT }}>
        <p>Please log in as a buyer to view the Advance Purchase Market.</p>
        <Link href="/" style={{ color: "#1976d2" }}>Back to home</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem", maxWidth: 720, margin: "0 auto", fontFamily: FONT }}>
      <div style={{ marginBottom: "1rem" }}>
        <Link href="/" style={{ color: "#1976d2", fontWeight: 600, fontSize: "0.9rem" }}>← Back to Dashboard</Link>
      </div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#2c2c2c", marginBottom: "0.25rem" }}>
        🌱 Advance Purchase Market
      </h1>
      <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1.25rem" }}>
        Fund a farmer&apos;s production ahead of harvest. Money is released to the farmer as each production stage is verified.
      </p>

      {myCommitments && myCommitments.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.5rem" }}>My Advance Purchases</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {myCommitments.map((c: any) => (
              <Link
                key={c._id}
                href={`/buyer/advance-purchase/commitment/${c._id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.75rem 1rem",
                  background: "#f3e5f5",
                  borderRadius: 10,
                  textDecoration: "none",
                  color: "#4a148c",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                }}
              >
                <span>{c.offer?.productName} · {c.quantity} {c.offer?.unit}</span>
                <span>{c.status.replace(/_/g, " ")}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {offers.length === 0 && (
        <div style={{
          padding: "2rem 1rem",
          textAlign: "center",
          background: "#fafafa",
          border: "1px dashed #ccc",
          borderRadius: 12,
          color: "#777",
        }}>
          No advance purchase offers available yet.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        {offers.map((offer: any) => (
          <Link
            key={offer._id}
            href={`/buyer/advance-purchase/${offer._id}`}
            style={{
              display: "block",
              padding: "1rem 1.1rem",
              background: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: 14,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              textDecoration: "none",
              color: "#2c2c2c",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{offer.productName}</div>
                <div style={{ fontSize: "0.8rem", color: "#888" }}>
                  {offer.communityName} · seller {offer.farmerAlias}
                </div>
              </div>
              <span style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                padding: "0.2rem 0.55rem",
                borderRadius: 999,
                background: "#e8f5e9",
                color: "#2e7d32",
                whiteSpace: "nowrap",
              }}>
                Stage {offer.stageProgress}
              </span>
            </div>
            <div style={{ marginTop: "0.6rem", fontSize: "0.9rem", color: "#444" }}>
              {offer.quantityRemaining} {offer.unit} remaining · UGX {offer.unitPrice.toLocaleString()} each
            </div>
            <div style={{ fontSize: "0.85rem", color: "#666" }}>
              Total value UGX {offer.totalValue.toLocaleString()}
              {offer.expectedDeliveryDate ? ` · delivery ~${new Date(offer.expectedDeliveryDate).toLocaleDateString()}` : ""}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
