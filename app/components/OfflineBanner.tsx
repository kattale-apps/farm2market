"use client";

import { useNetwork } from "../context/NetworkContext";

export function OfflineBanner() {
  const { isOnline } = useNetwork();

  if (isOnline) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: "linear-gradient(90deg, #f57f17, #ff8f00)",
        color: "#fff",
        textAlign: "center",
        padding: "10px 16px",
        fontSize: "0.9rem",
        fontWeight: 600,
        fontFamily: '"Montserrat", sans-serif',
        boxShadow: "0 -2px 12px rgba(0,0,0,0.15)",
      }}
    >
      ⚡ You are offline — showing cached data. Changes will sync when reconnected.
    </div>
  );
}
