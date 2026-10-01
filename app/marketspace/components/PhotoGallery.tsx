"use client";

import { useEffect, useRef, useState } from "react";
import { FONT } from "./shared";

const SWIPE_DISTANCE = 60;
const FLY_MS = 220;
const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const DOUBLE_TAP_MS = 300;

type Zoom = { s: number; x: number; y: number; animate: boolean };
const NO_ZOOM: Zoom = { s: 1, x: 0, y: 0, animate: true };

/**
 * An ad's photos as a stack of cards with the same swipe transition as the ad
 * deck: swipe left (or ›) for the next photo, right (or ‹) to go back. A tap
 * calls onTap, e.g. to open the photos full screen. With zoomable, a photo can
 * be zoomed by pinching, double-tapping, the mouse wheel or the + / − buttons,
 * and dragged around while zoomed; swiping to the next photo works at 1×.
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
  zoomable = false,
}: {
  urls: string[];
  title: string;
  height: number | string;
  fit?: "cover" | "contain";
  dark?: boolean;
  startIndex?: number;
  onIndexChange?: (index: number) => void;
  onTap?: (index: number) => void;
  zoomable?: boolean;
}) {
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(0, urls.length - 1)));
  const [dx, setDx] = useState(0);
  const [flying, setFlying] = useState<null | "left" | "right">(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const horizontal = useRef<boolean | null>(null);
  const dragged = useRef(false);
  const [zoom, setZoom] = useState<Zoom>(NO_ZOOM);
  const card = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; cx: number; cy: number; from: Zoom } | null>(null);
  const pan = useRef<{ x: number; y: number; from: Zoom; moved: boolean } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const last = urls.length - 1;
  const zoomed = zoom.s > 1;

  useEffect(() => {
    if (index > last) setIndex(Math.max(0, last));
  }, [index, last]);

  // Keep a zoomed photo covering its frame: no panning past the edges.
  const clamp = (s: number, x: number, y: number, animate: boolean): Zoom => {
    const el = card.current;
    if (!el || s <= 1) return { ...NO_ZOOM, animate };
    const mx = (el.clientWidth * (s - 1)) / 2;
    const my = (el.clientHeight * (s - 1)) / 2;
    return { s, x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)), animate };
  };
  // Zoom to scale s keeping the point (px, py), relative to the frame centre, still.
  const zoomAt = (from: Zoom, s: number, px: number, py: number, animate: boolean) => {
    const next = Math.max(1, Math.min(MAX_ZOOM, s));
    const ratio = next / from.s;
    return clamp(next, px - (px - from.x) * ratio, py - (py - from.y) * ratio, animate);
  };
  const fromCentre = (clientX: number, clientY: number) => {
    const r = card.current?.getBoundingClientRect();
    return r ? { px: clientX - (r.left + r.width / 2), py: clientY - (r.top + r.height / 2) } : { px: 0, py: 0 };
  };
  const pinchInfo = () => {
    const [a, b] = [...pointers.current.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  };

  const go = (dir: "next" | "prev") => {
    if (flying) return;
    if (dir === "next" && index >= last) return setDx(0);
    if (dir === "prev" && index <= 0) return setDx(0);
    setFlying(dir === "next" ? "left" : "right");
    setTimeout(() => {
      const nextIndex = dir === "next" ? index + 1 : index - 1;
      setIndex(nextIndex);
      setZoom(NO_ZOOM);
      onIndexChange?.(nextIndex);
      setFlying(null);
      setDx(0);
    }, FLY_MS);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (flying) return;
    if (zoomable) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      if (pointers.current.size === 2) {
        // Second finger: a pinch, not a swipe, pan or tap.
        start.current = null;
        pan.current = null;
        setDx(0);
        pinch.current = { ...pinchInfo(), from: zoom };
        return;
      }
      if (pointers.current.size > 2) return;
      if (zoomed) {
        pan.current = { x: e.clientX, y: e.clientY, from: zoom, moved: false };
        return;
      }
    }
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    horizontal.current = null;
    dragged.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (zoomable && pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.current && pointers.current.size >= 2) {
        const p = pinch.current;
        const now = pinchInfo();
        const { px, py } = fromCentre(p.cx, p.cy);
        const z = zoomAt(p.from, (p.from.s * now.dist) / p.dist, px, py, false);
        setZoom(clamp(z.s, z.x + now.cx - p.cx, z.y + now.cy - p.cy, false));
        return;
      }
      if (pan.current) {
        const p = pan.current;
        const mx = e.clientX - p.x;
        const my = e.clientY - p.y;
        if (Math.abs(mx) > 8 || Math.abs(my) > 8) p.moved = true;
        if (p.moved) setZoom(clamp(p.from.s, p.from.x + mx, p.from.y + my, false));
        return;
      }
    }
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
  const tap = (e: React.PointerEvent) => {
    if (zoomable) {
      const t = Date.now();
      const prev = lastTap.current;
      if (prev && t - prev.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 40) {
        lastTap.current = null;
        const { px, py } = fromCentre(e.clientX, e.clientY);
        setZoom(zoomed ? NO_ZOOM : zoomAt(zoom, DOUBLE_TAP_ZOOM, px, py, true));
        return;
      }
      lastTap.current = { t, x: e.clientX, y: e.clientY };
    }
    onTap?.(index);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (zoomable) {
      pointers.current.delete(e.pointerId);
      if (pinch.current) {
        // Fingers lift one at a time; the one left behind is not a tap.
        if (pointers.current.size < 2) pinch.current = null;
        return;
      }
      if (pan.current) {
        const moved = pan.current.moved;
        pan.current = null;
        if (!moved) tap(e);
        return;
      }
    }
    if (!start.current) return;
    start.current = null;
    if (horizontal.current === null) return tap(e); // A tap, not a scroll
    if (!horizontal.current) return;
    if (dx < -SWIPE_DISTANCE) go("next");
    else if (dx > SWIPE_DISTANCE) go("prev");
    else setDx(0);
  };
  const onPointerCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    pan.current = null;
    start.current = null;
    setDx(0);
  };
  const onWheel = (e: React.WheelEvent) => {
    if (!zoomable || flying) return;
    const { px, py } = fromCentre(e.clientX, e.clientY);
    setZoom(zoomAt(zoom, zoom.s * Math.exp(-e.deltaY * 0.002), px, py, false));
  };
  const zoomBy = (factor: number) => setZoom(zoomAt(zoom, zoom.s * factor, 0, 0, true));

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
  const img = (src: string, alt: string, z: Zoom = NO_ZOOM) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      draggable={false}
      style={{
        width: "100%",
        height: "100%",
        objectFit: fit,
        display: "block",
        userSelect: "none",
        transform: z.s > 1 ? `translate(${z.x}px, ${z.y}px) scale(${z.s})` : undefined,
        transition: z.animate ? "transform 180ms ease-out" : "none",
      }}
    />
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
  const zoomButton = (disabled: boolean): React.CSSProperties => ({
    width: 44,
    height: 44,
    borderRadius: 999,
    border: "none",
    background: dark ? "rgba(255,255,255,0.15)" : "#e8f5e9",
    color: dark ? "#fff" : "#1b5e20",
    fontSize: "1.4rem",
    fontWeight: 800,
    lineHeight: 1,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
  });

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ position: "relative", height, userSelect: "none" }}>
        {urls.length > 1 && behind && (
          <div style={{ ...frame, transform: "scale(0.94) translateY(10px)", opacity: 0.55, pointerEvents: "none" }}>{img(behind, "")}</div>
        )}
        <div
          key={urls[index]}
          ref={card}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onWheel={onWheel}
          style={{
            ...frame,
            touchAction: zoomable ? "none" : "pan-y",
            cursor: zoomed ? "move" : onTap || zoomable ? "zoom-in" : "grab",
            transform: `translateX(${offset}px) rotate(${offset / 26}deg)`,
            transition: flying || dx === 0 ? `transform ${FLY_MS}ms ease-out` : "none",
            zIndex: 2,
          }}
        >
          {img(urls[index], `${title} photo ${index + 1} of ${urls.length}`, zoom)}
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
      {zoomable && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 10 }}>
          <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.5)} disabled={!zoomed} style={zoomButton(!zoomed)}>
            −
          </button>
          <span style={{ color: dark ? "#fff" : "#333", fontSize: "0.8rem", fontWeight: 700, minWidth: 40, textAlign: "center" }}>{Math.round(zoom.s * 10) / 10}×</span>
          <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.5)} disabled={zoom.s >= MAX_ZOOM} style={zoomButton(zoom.s >= MAX_ZOOM)}>
            +
          </button>
        </div>
      )}
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
