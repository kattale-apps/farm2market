"use client";

import React, { useState } from "react";

const FONT = '"Montserrat", sans-serif';

/**
 * Tab state with history, so "Back" returns to the tab the user came from
 * and "Home" returns to the workspace's home tab.
 */
export function useTabHistory<T extends string>(home: T) {
  const [tab, setTab] = useState<T>(home);
  const [history, setHistory] = useState<T[]>([]);
  const scrollTop = () => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const go = (t: T) => {
    if (t !== tab) setHistory((h) => [...h, tab]);
    setTab(t);
    scrollTop();
  };
  const back = () => {
    setTab(history[history.length - 1] ?? home);
    setHistory((h) => h.slice(0, -1));
    scrollTop();
  };
  const goHome = () => {
    if (tab !== home) setHistory((h) => [...h, tab]);
    setTab(home);
    scrollTop();
  };
  const previous: T = history[history.length - 1] ?? home;
  return { tab, go, back, goHome, previous, home };
}

/**
 * The home tab ("Overview") of a tabbed dashboard. It deliberately looks
 * unlike the other tabs: dark fill, house icon and a heavier outline.
 */
export function HomeTabButton({ active, color, label = "Overview", onClick }: { active: boolean; color: string; label?: string; onClick: () => void }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.45rem",
        padding: "0.6rem 1.15rem",
        minHeight: 40,
        borderRadius: 999,
        border: `2px solid ${color}`,
        background: active ? color : "#fff",
        color: active ? "#fff" : color,
        fontWeight: 800,
        fontFamily: FONT,
        fontSize: "0.9rem",
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        boxShadow: active ? `0 3px 10px ${color}55` : "none",
        cursor: "pointer",
      }}
    >
      <HouseIcon size={18} />
      {label}
    </button>
  );
}

/** "Back to <previous tab>" and "Home" for tabbed dashboards. */
export function TabBackBar({ previousLabel, homeLabel, onBack, onHome, color }: { previousLabel: string; homeLabel: string; onBack: () => void; onHome: () => void; color: string }) {
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    minHeight: 40,
    padding: "0.5rem 0.9rem",
    borderRadius: 10,
    border: `1.5px solid ${color}`,
    background: "#fff",
    color,
    fontWeight: 700,
    fontFamily: FONT,
    fontSize: "0.88rem",
    cursor: "pointer",
  };
  return (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      <button type="button" style={style} onClick={onBack}>
        ← Back to {previousLabel}
      </button>
      <button type="button" style={style} onClick={onHome}>
        <HouseIcon size={16} /> {homeLabel}
      </button>
    </div>
  );
}

export function HouseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M12 3 2 11.5h3V21h5.5v-6h3v6H19v-9.5h3L12 3Z" fill="currentColor" />
    </svg>
  );
}
