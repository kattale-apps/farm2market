"use client";

import { useEffect, useState } from "react";
import { getStoredToken, getStoredUser } from "../utils/authStorage";
import { fromStoredUgandaTime, inUgandaTime } from "../utils/timeUtils";

export const FONT = '"Montserrat", sans-serif';
export const GREEN = "#2e7d32";
export const DARK_GREEN = "#1b5e20";

/** The session token of the signed-in user, or null for a guest. */
export function useSessionToken(): { status: "loading" | "guest" | "user"; token: string | null } {
  const [state, setState] = useState<{ status: "loading" | "guest" | "user"; token: string | null }>({ status: "loading", token: null });
  useEffect(() => {
    let active = true;
    Promise.all([getStoredUser(), getStoredToken()])
      .then(([user, token]) => {
        if (!active) return;
        const t = token || user?.sessionToken || null;
        setState(user?.userId && t ? { status: "user", token: t } : { status: "guest", token: null });
      })
      .catch(() => active && setState({ status: "guest", token: null }));
    return () => {
      active = false;
    };
  }, []);
  return state;
}

export function formatUGX(amount: number): string {
  return `UGX ${Math.round(amount).toLocaleString("en-UG")}`;
}

/** Date and time in Uganda from a stored Uganda-time value. */
export function formatWhen(storedUgandaTime: number): string {
  return new Date(fromStoredUgandaTime(storedUgandaTime)).toLocaleString(
    "en-GB",
    inUgandaTime({ day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  );
}

/** The readable part of a Convex error. */
export function errorText(e: unknown, fallback: string): string {
  const raw = (e as any)?.data ?? (e as any)?.message;
  if (typeof raw !== "string") return fallback;
  return raw.replace(/^.*Uncaught (Convex)?Error: /, "").split("\n")[0] || fallback;
}

export const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 14,
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  padding: "1.1rem",
  marginBottom: "1rem",
};

export const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "0.7rem",
  borderRadius: 10,
  border: "1px solid #d0d0d0",
  fontSize: "1rem",
  fontFamily: FONT,
};

export const label: React.CSSProperties = {
  display: "block",
  fontSize: "0.82rem",
  fontWeight: 700,
  color: "#444",
  marginBottom: "0.3rem",
};

export function button(color: string, disabled = false): React.CSSProperties {
  return {
    width: "100%",
    minHeight: 46,
    padding: "0.7rem 1rem",
    borderRadius: 10,
    border: "none",
    background: disabled ? "#bdbdbd" : color,
    color: "#fff",
    fontWeight: 800,
    fontSize: "0.95rem",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: FONT,
  };
}
