"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { useStoredUser } from "../../hooks/useStoredUser";
import { inUgandaTime } from "../../utils/timeUtils";

const FONT = '"Montserrat", sans-serif';

/**
 * Text that sits directly on the app's photographic background, with no card
 * behind it, needs a white halo to stay readable over both the bright and the
 * dark parts of the photo. Matches the other Advanced Markets headers.
 */
const ON_PHOTO_SHADOW = "0 1px 2px rgba(255,255,255,0.95), 0 0 8px rgba(255,255,255,0.9)";

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
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.15rem", color: "#1a1a1a", textShadow: ON_PHOTO_SHADOW }}>
            My Advanced Market Purchases
          </h2>
          <p style={{ fontSize: "0.8rem", color: "#333", fontWeight: 600, margin: "0 0 0.6rem", textShadow: ON_PHOTO_SHADOW }}>
            Tap a purchase to follow its milestones and download the order form.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {myCommitments.map((c: any) => {
              const tone = STATUS_TONES[c.status] || STATUS_TONES.default;
              return (
                <Link
                  key={c._id}
                  href={`/buyer/advance-purchase/commitment/${c._id}`}
                  className="am-purchase-card"
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
                  <div className="am-purchase-cta">
                    <span>View order &amp; download form</span>
                    <span aria-hidden="true" className="am-purchase-chevron">›</span>
                  </div>
                </Link>
              );
            })}
          </div>

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
            className="am-offer-card"
            aria-label={`Open ${offer.productName}`}
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
            {/* A flex item defaults to min-width:auto, so without minWidth:0 the
                left group refuses to shrink below its longest unbroken word and
                shoves the stage pill outside the card. The pill keeps its own
                width instead, since "Stage 0 of 24" must not be cut in half. */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", flex: "1 1 auto", minWidth: 0 }}>
                {offer.photoUrls?.[0] && (
                  <img src={offer.photoUrls[0]} alt={offer.productName} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", minWidth: 0 }}>
                    <span style={{ overflowWrap: "anywhere" }}>{offer.productName}</span>
                    {offer.offerKind && (
                      <span style={{ padding: "0.1rem 0.4rem", borderRadius: 999, fontSize: "0.65rem", fontWeight: 700, background: "#e8f5e9", color: "#2e7d32", whiteSpace: "nowrap" }}>
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
                flexShrink: 0,
              }}>
                Stage {offer.stageProgress}
              </span>
            </div>
            <div style={{ marginTop: "0.6rem", fontSize: "0.9rem", color: "#444" }}>
              {offer.quantityRemaining} {offer.unit} available · UGX {offer.unitPrice.toLocaleString()} each
            </div>
            <div style={{ fontSize: "0.85rem", color: "#666" }}>
              Total value UGX {offer.totalValue.toLocaleString()}
              {offer.expectedDeliveryDate ? ` · delivery ~${new Date(offer.expectedDeliveryDate).toLocaleDateString(undefined, inUgandaTime())}` : ""}
            </div>

            {/* The icons, not the words, are what make this readable to someone
                who cannot read the label. */}
            <div className="am-offer-cta">
              <span aria-hidden="true" className="am-offer-tap">👆</span>
              <span>Tap to open</span>
              <span aria-hidden="true" className="am-offer-chevron">›</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Kept at the top level of the page, not inside the purchases section:
          the offer cards below render even when a buyer has no purchases yet,
          and styles nested in that conditional would simply not exist for them. */}
        {/* Global rather than scoped: styled-jsx adds its hash class only to
            plain DOM elements, never to a child component, so a scoped rule
            can never match the <Link> below — which is why the card rendered
            with no background and underlined text. Names are prefixed to keep
            global scope safe. */}
        <style jsx global>{`
          .am-purchase-card {
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
          .am-purchase-card:active {
            transform: scale(0.985);
            background: #faf5fc;
            box-shadow: 0 1px 3px rgba(74, 20, 140, 0.18);
          }
          .am-purchase-card:focus-visible {
            outline: 3px solid #7b1fa2;
            outline-offset: 2px;
          }
          @media (hover: hover) {
            .am-purchase-card:hover {
              transform: translateY(-1px);
              box-shadow: 0 6px 16px rgba(74, 20, 140, 0.2);
            }
            .am-purchase-card:hover .am-purchase-chevron {
              transform: translateX(3px);
            }
          }
          .am-purchase-cta {
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
          .am-purchase-chevron {
            font-size: 1.2rem;
            line-height: 1;
            transition: transform 0.12s ease;
          }
          /* Nudge the chevron on arrival so the row reads as interactive
             even before anyone touches it. Respects reduced-motion. */
          @media (prefers-reduced-motion: no-preference) {
            .am-purchase-chevron {
              animation: am-purchase-nudge 2.4s ease-in-out 3;
            }
          }
          /* ---- Offer cards ------------------------------------------------
             Some users cannot read the label, so the cue has to work without
             it: a pointing finger and a chevron, plus motion, which needs no
             language at all. Only the FIRST card animates, and only a few
             times — enough to teach that these cards open, without the whole
             list twitching. */
          .am-offer-card {
            transition: transform 0.12s ease, box-shadow 0.12s ease;
            -webkit-tap-highlight-color: rgba(46, 125, 50, 0.12);
          }
          .am-offer-card:active {
            transform: scale(0.985);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.14);
          }
          .am-offer-card:focus-visible {
            outline: 3px solid #2e7d32;
            outline-offset: 2px;
          }
          @media (hover: hover) {
            .am-offer-card:hover {
              transform: translateY(-1px);
              box-shadow: 0 6px 16px rgba(0, 0, 0, 0.14);
            }
            .am-offer-card:hover .am-offer-chevron {
              transform: translateX(3px);
            }
          }
          .am-offer-cta {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            margin-top: 0.7rem;
            padding-top: 0.55rem;
            border-top: 1px solid #eee;
            font-size: 0.84rem;
            font-weight: 700;
            color: #2e7d32;
          }
          .am-offer-tap {
            font-size: 1rem;
            display: inline-block;
            transform-origin: center bottom;
          }
          .am-offer-chevron {
            margin-left: auto;
            font-size: 1.2rem;
            line-height: 1;
            transition: transform 0.12s ease;
          }
          @media (prefers-reduced-motion: no-preference) {
            .am-offer-card:first-child .am-offer-tap {
              animation: am-tap-hint 2.6s ease-in-out 3;
            }
            .am-offer-card:first-child .am-offer-chevron {
              animation: am-chevron-hint 2.6s ease-in-out 3;
            }
          }
          @keyframes am-tap-hint {
            0%, 58%, 100% { transform: translateY(0) scale(1); }
            68% { transform: translateY(-3px) scale(1.14); }
            78% { transform: translateY(0) scale(1); }
            88% { transform: translateY(-2px) scale(1.08); }
          }
          @keyframes am-chevron-hint {
            0%, 58%, 100% { transform: translateX(0); }
            72% { transform: translateX(4px); }
            84% { transform: translateX(0); }
          }
          @keyframes am-purchase-nudge {
            0%, 70%, 100% { transform: translateX(0); }
            80% { transform: translateX(4px); }
            90% { transform: translateX(0); }
          }
        `}</style>
    </div>
  );
}
