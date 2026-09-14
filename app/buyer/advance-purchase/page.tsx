"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { useStoredUser } from "../../hooks/useStoredUser";

const FONT = '"Montserrat", sans-serif';

type MarketTab = "goods" | "services";

/** Status pill colours, so the status reads as state rather than as a link. */
const STATUS_TONES: Record<string, { bg: string; fg: string }> = {
  funded: { bg: "#e3f2fd", fg: "#1565c0" },
  in_production: { bg: "#fff8e1", fg: "#ef6c00" },
  ready_for_delivery: { bg: "#e8f5e9", fg: "#2e7d32" },
  delivered: { bg: "#e8f5e9", fg: "#1b5e20" },
  cancelled: { bg: "#f5f5f5", fg: "#757575" },
  expired: { bg: "#f5f5f5", fg: "#757575" },
  pending_negotiation: { bg: "#ede7f6", fg: "#5e35b1" },
  default: { bg: "#f3e5f5", fg: "#6a1b9a" },
};

export default function AdvancePurchaseMarketPage() {
  const { user, status } = useStoredUser();
  const [tab, setTab] = useState<MarketTab>("goods");
  const offers = useQuery(api.advancePurchase.listMarketOffers, {});
  const myCommitments = useQuery(
    api.advancePurchase.listMyCommitments,
    user ? { buyerId: user.userId as any } : "skip"
  );

  if (status === "loading" || offers === undefined) {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading Advanced Markets...</div>;
  }
  if (status === "unauthenticated" || !user || user.role !== "buyer") {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT }}>
        <p>Please log in as a buyer to view Advanced Markets.</p>
        <Link href="/" style={{ color: "#1976d2" }}>Back to home</Link>
      </div>
    );
  }

  // Legacy offers created before the goods/services classification existed
  // have no offerKind — treat them as goods (crop) since that's all this
  // market used to sell.
  const visibleOffers = offers.filter((offer: any) => (offer.offerKind || "goods") === tab);

  return (
    <div style={{ padding: "1rem", maxWidth: 720, margin: "0 auto", fontFamily: FONT }}>
      <div style={{
        background: "rgba(20, 30, 20, 0.72)",
        borderRadius: 12,
        padding: "0.85rem 1rem",
        marginBottom: "1.25rem",
      }}>
        <Link
          href="/"
          style={{
            display: "inline-block",
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.85rem",
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: 8,
            padding: "0.4rem 0.75rem",
            textDecoration: "none",
            marginBottom: "0.6rem",
          }}
        >
          ← Back to Dashboard
        </Link>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", marginBottom: "0.25rem" }}>
          🌱 Advanced Markets
        </h1>
        <p style={{ color: "#eee", fontSize: "0.9rem", margin: 0 }}>
          Payments in Advanced Markets are based on milestones reached.
        </p>
      </div>

      {myCommitments && myCommitments.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.15rem" }}>My Advanced Market Purchases</h2>
          <p style={{ fontSize: "0.8rem", color: "#f1f1f1", margin: "0 0 0.6rem" }}>
            Tap a purchase to follow its milestones and download the order form.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {myCommitments.map((c: any) => {
              const tone = STATUS_TONES[c.status] || STATUS_TONES.default;
              return (
                <Link
                  key={c._id}
                  href={`/buyer/advance-purchase/commitment/${c._id}`}
                  className="purchase-card"
                  aria-label={`Open ${c.offer?.productName || "purchase"} order details`}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.6rem" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#4a148c", lineHeight: 1.35 }}>
                      {c.offer?.productName}
                    </span>
                    <span style={{
                      flexShrink: 0,
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.02em",
                      padding: "0.22rem 0.5rem",
                      borderRadius: 999,
                      background: tone.bg,
                      color: tone.fg,
                    }}>
                      {c.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.84rem", color: "#6a4c78", marginTop: "0.2rem" }}>
                    {c.quantity} {c.offer?.unit}
                    {typeof c.totalAmount === "number" ? ` · UGX ${Math.round(c.totalAmount).toLocaleString()}` : ""}
                  </div>

                  {/* An explicit call to action, because a card that merely looks
                      nice still does not tell anyone it can be tapped. */}
                  <div className="purchase-cta">
                    <span>View order &amp; download form</span>
                    <span aria-hidden="true" className="purchase-chevron">›</span>
                  </div>
                </Link>
              );
            })}
          </div>

          <style jsx>{`
            .purchase-card {
              display: block;
              padding: 0.8rem 0.95rem;
              background: #fff;
              border: 1px solid #e5d4ec;
              border-left: 4px solid #7b1fa2;
              border-radius: 12px;
              text-decoration: none;
              color: inherit;
              box-shadow: 0 2px 8px rgba(74, 20, 140, 0.14);
              transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
              -webkit-tap-highlight-color: rgba(123, 31, 162, 0.12);
            }
            /* Pressing it should feel like pressing something. */
            .purchase-card:active {
              transform: scale(0.985);
              background: #faf5fc;
              box-shadow: 0 1px 3px rgba(74, 20, 140, 0.18);
            }
            .purchase-card:focus-visible {
              outline: 3px solid #7b1fa2;
              outline-offset: 2px;
            }
            @media (hover: hover) {
              .purchase-card:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 16px rgba(74, 20, 140, 0.2);
              }
              .purchase-card:hover .purchase-chevron {
                transform: translateX(3px);
              }
            }
            .purchase-cta {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-top: 0.55rem;
              padding-top: 0.5rem;
              border-top: 1px dashed #ecdff2;
              font-size: 0.82rem;
              font-weight: 700;
              color: #7b1fa2;
            }
            .purchase-chevron {
              font-size: 1.2rem;
              line-height: 1;
              transition: transform 0.12s ease;
            }
            /* Nudge the chevron on arrival so the row reads as interactive
               even before anyone touches it. Respects reduced-motion. */
            @media (prefers-reduced-motion: no-preference) {
              .purchase-chevron {
                animation: purchase-nudge 2.4s ease-in-out 3;
              }
            }
            @keyframes purchase-nudge {
              0%, 70%, 100% { transform: translateX(0); }
              80% { transform: translateX(4px); }
              90% { transform: translateX(0); }
            }
          `}</style>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          type="button"
          onClick={() => setTab("goods")}
          style={{
            flex: 1, padding: "0.6rem", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: "0.85rem",
            border: tab === "goods" ? "2px solid #2e7d32" : "1px solid #ccc",
            background: tab === "goods" ? "#e8f5e9" : "#fff",
            color: tab === "goods" ? "#2e7d32" : "#666",
          }}
        >
          🌾 Crops &amp; Livestock
        </button>
        <button
          type="button"
          onClick={() => setTab("services")}
          style={{
            flex: 1, padding: "0.6rem", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: "0.85rem",
            border: tab === "services" ? "2px solid #2e7d32" : "1px solid #ccc",
            background: tab === "services" ? "#e8f5e9" : "#fff",
            color: tab === "services" ? "#2e7d32" : "#666",
          }}
        >
          🧑‍🌾 Farm Services
        </button>
      </div>

      {visibleOffers.length === 0 && (
        <div style={{
          padding: "2rem 1rem",
          textAlign: "center",
          background: "#fafafa",
          border: "1px dashed #ccc",
          borderRadius: 12,
          color: "#777",
        }}>
          {tab === "goods" ? "No crop or livestock offers available yet." : "No farm service offers available yet."}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        {visibleOffers.map((offer: any) => (
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                {offer.photoUrls?.[0] && (
                  <img src={offer.photoUrls[0]} alt={offer.productName} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                    {offer.productName}
                    {offer.offerKind && (
                      <span style={{ padding: "0.1rem 0.4rem", borderRadius: 999, fontSize: "0.65rem", fontWeight: 700, background: "#e8f5e9", color: "#2e7d32" }}>
                        {offer.offerKind === "goods"
                          ? (offer.goodsCategory === "livestock" ? "🐄 Livestock" : "🌾 Crop")
                          : `🧑‍🌾 ${offer.serviceCategory || "Service"}`}
                      </span>
                    )}
                  </div>
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
              {offer.quantityRemaining} {offer.unit} available · UGX {offer.unitPrice.toLocaleString()} each
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
