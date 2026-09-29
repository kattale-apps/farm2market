"use client";

import { useEffect, useRef, useState } from "react";
import { AdCard } from "./AdCard";
import { FONT, type AdCardData } from "./shared";

const SWIPE_DISTANCE = 80;
const FLY_MS = 220;

/**
 * One card at a time. Swipe left (or ›) for the next ad, right (or ‹) for the
 * previous one. A tap opens the ad; the Contact button works on every card.
 */
export function SwipeDeck({
  ads,
  now,
  hasMore,
  onLoadMore,
  onOpen,
  onContact,
  endOfDeck,
}: {
  ads: AdCardData[];
  now: number;
  hasMore: boolean;
  onLoadMore: () => void;
  onOpen: (ad: AdCardData) => void;
  onContact: (ad: AdCardData) => void;
  endOfDeck: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [dx, setDx] = useState(0);
  const [flying, setFlying] = useState<null | "left" | "right">(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const dragged = useRef(false);
  const horizontal = useRef<boolean | null>(null);

  // Start again when the filter changes the list.
  const firstId = ads[0]?._id;
  useEffect(() => setIndex(0), [firstId]);

  // Fetch more ads before the deck runs out.
  useEffect(() => {
    if (hasMore && index >= ads.length - 3) onLoadMore();
  }, [index, ads.length, hasMore, onLoadMore]);

  const go = (dir: "next" | "prev") => {
    if (flying) return;
    if (dir === "next" && index >= ads.length) return;
    if (dir === "prev" && index === 0) return;
    setFlying(dir === "next" ? "left" : "right");
    setTimeout(() => {
      setIndex((i) => (dir === "next" ? i + 1 : Math.max(0, i - 1)));
      setFlying(null);
      setDx(0);
    }, FLY_MS);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
      if (e.key === "ArrowLeft") go("prev");
      if (e.key === "ArrowRight") go("next");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onPointerDown = (e: React.PointerEvent) => {
    if (flying) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dragged.current = false;
    horizontal.current = null;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    const mx = e.clientX - start.current.x;
    const my = e.clientY - start.current.y;
    if (horizontal.current === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      horizontal.current = Math.abs(mx) > Math.abs(my);
      if (horizontal.current) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (horizontal.current) {
      dragged.current = true;
      setDx(mx);
    }
  };
  const onPointerUp = () => {
    if (!start.current) return;
    start.current = null;
    if (!horizontal.current) return;
    if (dx < -SWIPE_DISTANCE && index < ads.length) go("next");
    else if (dx > SWIPE_DISTANCE && index > 0) go("prev");
    else setDx(0);
  };

  const current = ads[index];
  const nextAd = ads[index + 1];
  const offset = flying === "left" ? -600 : flying === "right" ? 600 : dx;
  const arrow = (disabled: boolean): React.CSSProperties => ({
    width: 52,
    height: 52,
    borderRadius: 999,
    border: "2px solid #2e7d32",
    background: disabled ? "#f3f3f3" : "#fff",
    color: disabled ? "#bbb" : "#1b5e20",
    fontSize: "1.6rem",
    fontWeight: 800,
    cursor: disabled ? "default" : "pointer",
    boxShadow: disabled ? "none" : "0 2px 6px rgba(0,0,0,0.12)",
  });

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ position: "relative", height: 500, maxWidth: 420, margin: "0 auto" }}>
        {current ? (
          <>
            {nextAd && (
              <div style={{ position: "absolute", inset: 0, transform: "scale(0.94) translateY(14px)", opacity: 0.6, pointerEvents: "none" }}>
                <AdCard ad={nextAd} now={now} variant="deck" />
              </div>
            )}
            <div
              key={current._id}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{
                position: "absolute",
                inset: 0,
                touchAction: "pan-y",
                transform: `translateX(${offset}px) rotate(${offset / 22}deg)`,
                transition: flying || dx === 0 ? `transform ${FLY_MS}ms ease-out` : "none",
              }}
            >
              <AdCard
                ad={current}
                now={now}
                variant="deck"
                onOpen={() => {
                  if (!dragged.current) onOpen(current);
                }}
                onContact={() => onContact(current)}
              />
            </div>
          </>
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              gap: "0.75rem",
              border: "2px dashed #c8e6c9",
              borderRadius: 18,
              padding: "1.5rem",
              background: "#fafffa",
            }}
          >
            {hasMore ? <p style={{ margin: 0 }}>Loading more ads…</p> : endOfDeck}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1.25rem", marginTop: "1rem" }}>
        <button type="button" aria-label="Previous ad" disabled={index === 0} onClick={() => go("prev")} style={arrow(index === 0)}>
          ‹
        </button>
        <span style={{ minWidth: 80, textAlign: "center", fontWeight: 700, color: "#444", fontSize: "0.9rem" }}>
          {ads.length === 0 ? "0 of 0" : `${Math.min(index + 1, ads.length)} of ${ads.length}${hasMore ? "+" : ""}`}
        </span>
        <button type="button" aria-label="Next ad" disabled={index >= ads.length} onClick={() => go("next")} style={arrow(index >= ads.length)}>
          ›
        </button>
      </div>
      <p style={{ textAlign: "center", color: "#888", fontSize: "0.78rem", margin: "0.5rem 0 0" }}>Swipe left for the next ad, right to go back. Tap a card for details.</p>
    </div>
  );
}
