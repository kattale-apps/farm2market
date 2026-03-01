"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { CreateTraderListing } from "./CreateTraderListing";
import { TraderListings } from "./TraderListings";
import { ContactUs } from "./ContactUs";
import Link from "next/link";

interface TraderDashboardSafeProps {
  userId: Id<"users">;
}

export function TraderDashboardSafe({ userId }: TraderDashboardSafeProps) {
  const user = useQuery(api.auth.getUser, { userId });
  const farmcoinSummary = useQuery(api.farmcoin.getTraderFarmcoinSummary, { traderId: userId });
  const communities = useQuery(api.communities.getActiveCommunities, { userId });

  const memberCommunities = (communities || []).filter((c: any) => c.isMember);
  const isVerified = (user as any)?.isVerifiedTrader && (user as any)?.verificationStatus === "verified";

  return (
    <div style={{
      padding: "clamp(0.75rem, 2vw, 1rem)",
      maxWidth: "100%",
      boxSizing: "border-box",
      background: "linear-gradient(180deg, #f7faf9 0%, #eef5f1 100%)",
      borderRadius: "16px",
    }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <h2 style={{
            fontSize: "clamp(1.5rem, 4vw, 1.8rem)",
            marginBottom: "0.25rem",
            color: "#2c2c2c",
            fontFamily: '"Montserrat", sans-serif',
            fontWeight: "700",
            letterSpacing: "-0.02em"
          }}>
            🚚 Trader: {user?.alias || "Trader"}
          </h2>
          <span style={{
            padding: "0.25rem 0.6rem",
            borderRadius: "999px",
            fontSize: "0.8rem",
            fontWeight: "600",
            background: isVerified ? "#e8f5e9" : "#fff3cd",
            color: isVerified ? "#2e7d32" : "#8d6e00",
            border: `1px solid ${isVerified ? "#81c784" : "#ffe082"}`,
          }}>
            {isVerified ? "Verified" : "Not Verified"}
          </span>
        </div>
        <div style={{ color: "#64748b", fontSize: "0.9rem" }}>
          Verification is managed by SuperAdmin only.
        </div>
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

      {/* Communities Section */}
      <div style={{
        marginBottom: "1.5rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h3 style={{
            margin: 0,
            fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)",
            color: "#2c2c2c",
            fontFamily: '"Montserrat", sans-serif',
            fontWeight: "600",
            letterSpacing: "-0.01em"
          }}>
            🌾 My Communities
          </h3>
          <Link
            href="/farmer/communities"
            style={{
              padding: "0.4rem 0.8rem",
              background: "#1976d2",
              color: "#fff",
              textDecoration: "none",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: "600",
              transition: "background 0.2s",
            }}
          >
            Browse All
          </Link>
        </div>
        {communities === undefined ? (
          <p style={{ color: "#999", fontSize: "0.9rem" }}>Loading communities...</p>
        ) : memberCommunities.length === 0 ? (
          <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
            You haven&apos;t joined any communities yet.{" "}
            <Link href="/farmer/communities" style={{ color: "#1976d2", fontWeight: 600 }}>Browse communities</Link>
          </p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {memberCommunities.map((c: any) => (
              <span key={c.id} style={{
                padding: "0.35rem 0.75rem",
                borderRadius: "999px",
                background: "#e8f5e9",
                color: "#2e7d32",
                fontSize: "0.85rem",
                fontWeight: "600",
                border: "1px solid #c8e6c9",
              }}>
                {c.name}
              </span>
            ))}
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
