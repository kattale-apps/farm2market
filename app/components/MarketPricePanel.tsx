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
  const defaultLimit = mobileMode ? 2 : 3;
  const result = useQuery((api as any).marketPrices.getPublicMarketCards, {
    marketsLimit: 20,
    itemsPerMarket: 5,
  });
  const triggerSnapshot = useMutation((api as any).marketPrices.triggerTodaySnapshot);
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [triggered, setTriggered] = useState(false);

  const markets = result?.markets ?? [];
  const dateKey = result?.dateKey ?? null;
  const isLoading = result === undefined;

  // Keep trigger in place for compatibility with environments relying on snapshot seeding.
  useEffect(() => {
    if (!isLoading && markets.length === 0 && !triggered) {
      setTriggered(true);
      triggerSnapshot({}).catch(() => {/* ignore */});
    }
  }, [isLoading, markets.length, triggered, triggerSnapshot]);
  const visibleMarkets = showAll ? markets : markets.slice(0, defaultLimit);
  const visibleItemCount = visibleMarkets.reduce((sum: number, market: any) => sum + market.items.length, 0);

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

  const cardStackStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "0.75rem",
  };

  const cardStyle: React.CSSProperties = {
    background: "#f9fbf9",
    border: "1px solid #e0ece0",
    borderRadius: "10px",
    padding: "0.85rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.45rem",
  };

  const marketTitleStyle: React.CSSProperties = {
    fontSize: "1rem",
    fontWeight: "700",
    color: "#1b5e20",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const marketMetaStyle: React.CSSProperties = {
    fontSize: "0.72rem",
    color: "#555",
    display: "flex",
    justifyContent: "space-between",
    gap: "0.5rem",
    flexWrap: "wrap",
  };

  const lineItemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.4rem",
    borderTop: "1px solid #e8f2e8",
    paddingTop: "0.45rem",
  };

  const commodityCellStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
  };

  const commodityNameStyle: React.CSSProperties = {
    fontSize: "0.86rem",
    fontWeight: 700,
    color: "#1f4f24",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    lineHeight: 1.3,
  };

  // Price column: price on line 1, trend movement on line 2
  const priceCellStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    flexShrink: 0,
    minWidth: mobileMode ? "90px" : "105px",
  };

  const priceStyle: React.CSSProperties = {
    fontSize: "0.78rem",
    color: "#2e7d32",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums" as any,
    lineHeight: 1.3,
    whiteSpace: "nowrap",
  };

  const trendStyleBase: React.CSSProperties = {
    fontSize: "0.62rem",
    fontWeight: 700,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  };

  // Time column: relative on line 1, absolute on line 2
  const timeCellStyle: React.CSSProperties = {
    flexShrink: 0,
    minWidth: mobileMode ? "68px" : "80px",
    maxWidth: mobileMode ? "68px" : "80px",
    overflow: "hidden",
    textAlign: "right",
    lineHeight: 1.2,
  };

  const timeRelativeStyle: React.CSSProperties = {
    fontSize: "0.7rem",
    color: "#4a4a4a",
    fontWeight: 600,
    lineHeight: 1.3,
    whiteSpace: "nowrap",
  };

  const timeAbsoluteStyle: React.CSSProperties = {
    fontSize: "0.62rem",
    color: "#888",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const buyButtonStyle: React.CSSProperties = {
    background: "#2e7d32",
    color: "#fff",
    border: "none",
    borderRadius: "7px",
    padding: "0.28rem 0.55rem",
    cursor: "pointer",
    fontSize: "0.72rem",
    lineHeight: 1.1,
    minHeight: "28px",
    minWidth: "46px",
    fontWeight: 700,
    whiteSpace: "nowrap",
    flexShrink: 0,
    alignSelf: "flex-start",
  };

  const skeletonCardStyle: React.CSSProperties = {
    background: "#f0f4f0",
    borderRadius: "10px",
    height: "140px",
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

  function getTrendText(item: any): string {
    const delta = item.trendDeltaUGX as number | null;
    if (item.trendDirection === "cheaper") {
      return `▼ UGX ${(delta ?? 0).toLocaleString("en-UG")}`;
    }
    if (item.trendDirection === "costlier") {
      return `▲ UGX ${(delta ?? 0).toLocaleString("en-UG")}`;
    }
    if (item.trendDirection === "flat") {
      return "• No change";
    }
    return "• No baseline";
  }

  function getTrendStyle(direction: string): React.CSSProperties {
    if (direction === "cheaper") return { ...trendStyleBase, color: "#2e7d32" };
    if (direction === "costlier") return { ...trendStyleBase, color: "#c62828" };
    return { ...trendStyleBase, color: "#777" };
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
          {!isLoading && markets.length > 0 && (
            <span style={{ fontSize: "0.72rem", color: "#888", fontStyle: "italic" }}>
              {visibleMarkets.length} market{visibleMarkets.length !== 1 ? "s" : ""} · {visibleItemCount} post{visibleItemCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {isLoading ? (
          <div style={cardStackStyle}>
            {Array.from({ length: defaultLimit }).map((_, i) => (
              <div key={i} style={skeletonCardStyle} />
            ))}
          </div>
        ) : markets.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem 1rem", color: "#888" }}>
            <p style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>🌱</p>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>Market prices coming soon</p>
          </div>
        ) : (
          <>
            <div style={cardStackStyle}>
              {visibleMarkets.map((market: any) => (
                <div key={market.marketKey} style={cardStyle}>
                  <div style={marketTitleStyle}>
                    {market.marketEmoji} {market.marketName}
                  </div>
                  <div style={marketMetaStyle}>
                    <span>{market.itemCount} post{market.itemCount !== 1 ? "s" : ""}</span>
                    <span title={market.latestPostedAtAbsolute}>Updated {market.latestPostedAtRelative}</span>
                  </div>

                  {market.items.map((item: any) => (
                    <div key={item.id} style={lineItemStyle}>
                      <div style={commodityCellStyle}>
                        <div style={commodityNameStyle} title={`${item.commodityEmoji} ${item.commodity}`}>
                          {item.commodityEmoji} {item.commodity}
                        </div>
                      </div>

                      <div style={priceCellStyle}>
                        <span style={priceStyle}>{formatPrice(item.priceUGX, item.unit)}</span>
                        <span style={getTrendStyle(item.trendDirection)}>{getTrendText(item)}</span>
                      </div>

                      <div style={timeCellStyle} title={item.absoluteTime}>
                        <div style={timeRelativeStyle}>{item.relativeTime}</div>
                        <div style={timeAbsoluteStyle}>{item.absoluteTime}</div>
                      </div>

                      <button
                        style={buyButtonStyle}
                        onClick={handleBuyClick}
                        title="Buy — sign in as buyer"
                        aria-label={`Buy ${item.commodity}`}
                      >
                        Buy
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {markets.length > defaultLimit && (
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
                  : `Show all ${markets.length} markets ▼`}
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
