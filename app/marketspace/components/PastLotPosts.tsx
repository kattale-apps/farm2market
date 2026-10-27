"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PAST_LOT_OUTCOMES, lotSections } from "../../../convex/marketspaceShared";
import { getUgandaTime } from "../../utils/timeUtils";
import { FONT, formatDate, formatUGX } from "./shared";

/** My posts: lot posts that ended, with the price they had, where they showed and why they ended. 10 at a time. */
export function PastLotPosts({ token }: { token: string }) {
  // Fixed while the list is open, so the pages do not reload every minute
  const [now] = useState(() => getUgandaTime());
  const { results, status, loadMore } = usePaginatedQuery(api.marketspace.myPastLotPosts, { sessionToken: token, now }, { initialNumItems: 10 });

  if (status === "LoadingFirstPage") return <p style={{ margin: 0, color: "#555" }}>Loading your past lot posts…</p>;
  if (results.length === 0) return <p style={{ margin: 0, color: "#444" }}>No past lot posts yet.</p>;

  return (
    <div style={{ display: "grid", gap: "0.6rem", fontFamily: FONT }}>
      {results.map((post) => {
        const price = post.packaged
          ? `${formatUGX(post.priceUGX ?? 0)} ${post.priceUnit ?? "each"}`
          : `${formatUGX(post.pricePerKilo ?? 0)}/kg${post.lotKg ? ` · lots of ${post.lotKg.toLocaleString()} kg` : ""}`;
        const sold = post.outcome === "sold";
        return (
          <div key={post.cardId} style={{ display: "flex", gap: "0.7rem", padding: "0.65rem", borderRadius: 12, border: "1.5px solid #e0e0e0", background: "#fafafa" }}>
            <div style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 10, overflow: "hidden", background: "#eee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem" }}>
              {post.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.thumbUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                "🌾"
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem" }}>
                <span style={{ fontWeight: 800, color: "#222" }}>{post.title}</span>
                <span style={{ padding: "0.1rem 0.5rem", borderRadius: 999, fontSize: "0.72rem", fontWeight: 800, background: sold ? "#e8f5e9" : "#eceff1", color: sold ? "#1b5e20" : "#37474f" }}>
                  {PAST_LOT_OUTCOMES[post.outcome]}
                </span>
              </div>
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#333" }}>{price}</div>
              <div style={{ fontSize: "0.8rem", color: "#444" }}>
                Showed in {lotSections(post.sellerRole, { bulk: post.isBulk, farmGate: false }).join(" · ")}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#444" }}>
                Posted {formatDate(post.postedAt)} · ended {formatDate(post.endedAt)}
              </div>
            </div>
          </div>
        );
      })}
      {status === "CanLoadMore" && (
        <button type="button" onClick={() => loadMore(10)} style={{ minHeight: 44, borderRadius: 10, border: "1.5px solid #2e7d32", background: "#fff", color: "#1b5e20", fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}>
          Show more
        </button>
      )}
      {status === "LoadingMore" && <p style={{ margin: 0, color: "#555" }}>Loading…</p>}
    </div>
  );
}
