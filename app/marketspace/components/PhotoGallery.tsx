"use client";

import { useEffect, useRef, useState } from "react";
import { FONT } from "./shared";

const SWIPE_DISTANCE = 60;
const FLY_MS = 220;

/**
 * An ad's photos as a stack of cards with the same swipe transition as the ad
 * deck: swipe left (or ›) for the next photo, right (or ‹) to go back. A tap
 * calls onTap, e.g. to open the photos full screen.
 */
export function PhotoGallery({
  urls,
  title,
  height,
  fit = "cover",
  dark = false,
  startIndex = 0,
  onIndexChange,
  onTap,
}: {
  urls: string[];
  title: string;
  height: number | string;
  fit?: "cover" | "contain";
  dark?: boolean;
  startIndex?: number;
  onIndexChange?: (index: number) => void;
  onTap?: (index: number) => void;
}) {
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(0, urls.length - 1)));
  const [dx, setDx] = useState(0);
  const [flying, setFlying] = useState<null | "left" | "right">(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const horizontal = useRef<boolean | null>(null);
  const dragged = useRef(false);
  const last = urls.length - 1;

  useEffect(() => {
    if (index > last) setIndex(Math.max(0, last));
  }, [index, last]);

  const go = (dir: "next" | "prev") => {
    if (flying) return;
    if (dir === "next" && index >= last) return setDx(0);
    if (dir === "prev" && index <= 0) return setDx(0);
    setFlying(dir === "next" ? "left" : "right");
    setTimeout(() => {
      const nextIndex = dir === "next" ? index + 1 : index - 1;
      setIndex(nextIndex);
      onIndexChange?.(nextIndex);
      setFlying(null);
      setDx(0);
    }, FLY_MS);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (flying) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    horizontal.current = null;
    dragged.current = false;
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
      // Resist at the ends so it is clear there is nothing further.
      const atEnd = (mx < 0 && index >= last) || (mx > 0 && index <= 0);
      setDx(atEnd ? mx / 4 : mx);
    }
  };
  const onPointerUp = () => {
    if (!start.current) return;
    start.current = null;
    if (horizontal.current === null) return onTap?.(index); // A tap, not a scroll
    if (!horizontal.current) return;
    if (dx < -SWIPE_DISTANCE) go("next");
    else if (dx > SWIPE_DISTANCE) go("prev");
    else setDx(0);
  };

  if (urls.length === 0) return null;
  const offset = flying === "left" ? -520 : flying === "right" ? 520 : dx;
  const behind = dx < 0 || flying === "left" ? urls[index + 1] : dx > 0 || flying === "right" ? urls[index - 1] : urls[index + 1];
  const frame: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: 14,
    overflow: "hidden",
    background: dark ? "#111" : "#f3f3f3",
    boxShadow: dark ? "none" : "0 6px 18px rgba(0,0,0,0.14)",
  };
  const img = (src: string, alt: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} draggable={false} style={{ width: "100%", height: "100%", objectFit: fit, display: "block", userSelect: "none" }} />
  );
  const arrow = (side: "left" | "right", disabled: boolean): React.CSSProperties => ({
    position: "absolute",
    top: "50%",
    [side]: 8,
    transform: "translateY(-50%)",
    width: 40,
    height: 40,
    borderRadius: 999,
    border: "none",
    background: "rgba(255,255,255,0.9)",
    color: "#1b5e20",
    fontSize: "1.5rem",
    fontWeight: 800,
    lineHeight: 1,
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
    display: disabled ? "none" : "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  });

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ position: "relative", height, userSelect: "none" }}>
        {urls.length > 1 && behind && (
          <div style={{ ...frame, transform: "scale(0.94) translateY(10px)", opacity: 0.55, pointerEvents: "none" }}>{img(behind, "")}</div>
        )}
        <div
          key={urls[index]}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            ...frame,
            touchAction: "pan-y",
            cursor: onTap ? "zoom-in" : "grab",
            transform: `translateX(${offset}px) rotate(${offset / 26}deg)`,
            transition: flying || dx === 0 ? `transform ${FLY_MS}ms ease-out` : "none",
            zIndex: 2,
          }}
        >
          {img(urls[index], `${title} photo ${index + 1} of ${urls.length}`)}
        </div>
        {urls.length > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => go("prev")} style={arrow("left", index <= 0)}>
              ‹
            </button>
            <button type="button" aria-label="Next photo" onClick={() => go("next")} style={arrow("right", index >= last)}>
              ›
            </button>
            <span style={{ position: "absolute", top: 10, right: 10, zIndex: 3, background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 999, padding: "0.15rem 0.55rem", fontSize: "0.75rem", fontWeight: 700 }}>
              {index + 1} / {urls.length}
            </span>
          </>
        )}
      </div>
      {urls.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
          {urls.map((u, i) => (
            <span key={u} style={{ width: i === index ? 18 : 7, height: 7, borderRadius: 999, background: i === index ? (dark ? "#fff" : "#2e7d32") : dark ? "rgba(255,255,255,0.4)" : "#c8e6c9", transition: "width 150ms" }} />
          ))}
        </div>
      )}
    </div>
  );
}
