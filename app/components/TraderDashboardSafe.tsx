"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { CreateTraderListing } from "./CreateTraderListing";
import { TraderListings } from "./TraderListings";
import { ContactUs } from "./ContactUs";

interface TraderDashboardSafeProps {
  userId: Id<"users">;
}

export function TraderDashboardSafe({ userId }: TraderDashboardSafeProps) {
  const user = useQuery(api.auth.getUser, { userId });
  const farmcoinSummary = useQuery(api.farmcoin.getTraderFarmcoinSummary, { traderId: userId });

  return (
    <div style={{ padding: "clamp(0.75rem, 2vw, 1rem)", maxWidth: "100%", boxSizing: "border-box" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{
          fontSize: "clamp(1.5rem, 4vw, 1.8rem)",
          marginBottom: "0.5rem",
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "700",
          letterSpacing: "-0.02em"
        }}>
          Trader: {user?.alias || "Trader"}
        </h2>
      </div>

      <div style={{
        marginBottom: "1.5rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0"
      }}>
        <h3 style={{
          marginTop: 0,
          marginBottom: "0.75rem",
          fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)",
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "600",
          letterSpacing: "-0.01em"
        }}>
          FarmCoin Tokens
        </h3>
        {farmcoinSummary === undefined ? (
          <p style={{ color: "#999" }}>Loading FarmCoin balance...</p>
        ) : (
          <div>
            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ color: "#666", fontSize: "0.9rem" }}>Balance</div>
              <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#2e7d32" }}>
                {farmcoinSummary.balance} Token(s)
              </div>
            </div>
            <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Last 10 transactions</div>
            <div style={{ display: "grid", gap: "0.35rem" }}>
              {farmcoinSummary.recent?.length ? (
                farmcoinSummary.recent.map((entry: any, idx: number) => (
                  <div key={idx} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.85rem",
                    color: "#4b5563",
                    borderBottom: "1px solid #f1f5f9",
                    paddingBottom: "0.3rem",
                  }}>
                    <span>{entry.source?.replace("_", " ")}</span>
                    <span style={{ fontWeight: 600 }}>
                      {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: "0.85rem", color: "#999" }}>No FarmCoin transactions yet.</div>
              )}
            </div>
          </div>
        )}
      </div>

      <CreateTraderListing userId={userId} />
      <TraderListings userId={userId} />

      <ContactUs
        isMobile={false}
        onOpenInbox={() => undefined}
      />
    </div>
  );
}
