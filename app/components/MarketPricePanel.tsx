"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";

interface MarketPricePanelProps {
  /** Compact layout for mobile placement below login form */
  mobileMode?: boolean;
}

export default function MarketPricePanel({ mobileMode = false }: MarketPricePanelProps) {
  const defaultLimit = mobileMode ? 4 : 6;
  const result = useQuery(api.marketPrices.getPublicPriceCards, { limit: 20 });
  const triggerSnapshot = useMutation((api as any).marketPrices.triggerTodaySnapshot);
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [triggered, setTriggered] = useState(false);

  const cards = result?.cards ?? [];
  const dateKey = result?.dateKey ?? null;
  const isLoading = result === undefined;

  // If the query loaded and returned no cards, trigger a snapshot build once.
  // This handles the case where vendor data exists in listings/submissions but
  // no snapshot has been built yet today.
  useEffect(() => {
    if (!isLoading && cards.length === 0 && !triggered) {
      setTriggered(true);
      triggerSnapshot({}).catch(() => {/* ignore */});
    }
  }, [isLoading, cards.length, triggered, triggerSnapshot]);
  const visibleCards = showAll ? cards : cards.slice(0, defaultLimit);

  const panelStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    padding: mobileMode ? "1rem" : "1.5rem",
    maxHeight: mobileMode ? "none" : "calc(100vh - 4rem)",
    overflowY: "auto",
    width: "100%",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "1rem",
    borderBottom: "1px solid #e8f5e9",
    paddingBottom: "0.75rem",
  };

  const headingStyle: React.CSSProperties = {
    fontSize: mobileMode ? "1rem" : "1.1rem",
    fontWeight: "700",
    color: "#2c2c2c",
    fontFamily: '"Montserrat", sans-serif',
    margin: 0,
  };

  const subheadingStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    color: "#666",
    margin: 0,
    marginTop: "0.2rem",
  };

  const cardGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: mobileMode ? "1fr" : "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "0.75rem",
  };

  const cardStyle: React.CSSProperties = {
    background: "#f9fbf9",
    border: "1px solid #e0ece0",
    borderRadius: "10px",
    padding: "0.85rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
  };

  const commodityStyle: React.CSSProperties = {
    fontSize: "1rem",
    fontWeight: "700",
    color: "#1b5e20",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const marketStyle: React.CSSProperties = {
    fontSize: "0.78rem",
    color: "#555",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const priceRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "0.25rem",
  };

  const priceStyle: React.CSSProperties = {
    fontSize: "0.95rem",
    fontWeight: "700",
    color: "#2e7d32",
  };

  const buyButtonStyle: React.CSSProperties = {
    background: "#2e7d32",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "0.4rem 0.7rem",
    cursor: "pointer",
    fontSize: "1rem",
    lineHeight: 1,
    minHeight: "36px",
    minWidth: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const skeletonCardStyle: React.CSSProperties = {
    background: "#f0f4f0",
    borderRadius: "10px",
    height: "100px",
    animation: "f2m-pulse 1.5s ease-in-out infinite",
  };

  function formatPrice(price: number, unit: string): string {
    const formatted = price.toLocaleString("en-UG");
    return `UGX ${formatted}/${unit}`;
  }

  function handleBuyClick(e: React.MouseEvent) {
    e.preventDefault();
    router.push("/login?intent=buy&role=buyer");
  }

  return (
    <>
      <style>{`
        @keyframes f2m-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      <div style={panelStyle} aria-label="Live market prices">
        <div style={headerStyle}>
          <div>
            <p style={headingStyle}>🌿 Live Market Prices</p>
            {dateKey && (
              <p style={subheadingStyle}>
                Updated {new Date(dateKey).toLocaleDateString("en-UG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
          {!isLoading && cards.length > 0 && (
            <span style={{ fontSize: "0.72rem", color: "#888", fontStyle: "italic" }}>
              {cards.length} item{cards.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {isLoading ? (
          <div style={cardGridStyle}>
            {Array.from({ length: defaultLimit }).map((_, i) => (
              <div key={i} style={skeletonCardStyle} />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem 1rem", color: "#888" }}>
            <p style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>🌱</p>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>Market prices coming soon</p>
          </div>
        ) : (
          <>
            <div style={cardGridStyle}>
              {visibleCards.map((card: any) => (
                <div key={card.id} style={cardStyle}>
                  <div style={commodityStyle}>
                    {card.commodityEmoji} {card.commodity}
                  </div>
                  <div style={marketStyle}>
                    {card.marketEmoji} {card.marketName}
                  </div>
                  <div style={priceRowStyle}>
                    <span style={priceStyle}>
                      {formatPrice(card.latestPriceUGX, card.unit)}
                    </span>
                    <button
                      style={buyButtonStyle}
                      onClick={handleBuyClick}
                      title="Buy — sign in as buyer"
                      aria-label={`Buy ${card.commodity}`}
                    >
                      🛒
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {cards.length > defaultLimit && (
              <button
                onClick={() => setShowAll(!showAll)}
                style={{
                  marginTop: "1rem",
                  width: "100%",
                  padding: "0.6rem",
                  background: "transparent",
                  border: "1px solid #c8e6c9",
                  borderRadius: "8px",
                  color: "#2e7d32",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                }}
              >
                {showAll
                  ? "Show less ▲"
                  : `Show all ${cards.length} prices ▼`}
              </button>
            )}
          </>
        )}

        <p
          style={{
            marginTop: "0.75rem",
            fontSize: "0.7rem",
            color: "#aaa",
            textAlign: "center",
          }}
        >
          Prices are indicative. Sign in to see full vendor details.
        </p>
      </div>
    </>
  );
}
