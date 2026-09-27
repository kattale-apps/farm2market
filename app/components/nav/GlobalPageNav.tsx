"use client";

import { usePathname, useRouter } from "next/navigation";
import { HouseIcon } from "./TabNav";

const FONT = '"Montserrat", sans-serif';

/** Pages that are the home itself, or come before sign-in, get no nav bar. */
const HIDDEN_PREFIXES = ["/login", "/forgot-password", "/reset-password", "/onboarding", "/join/", "/q/"];

/**
 * "← Back" and "Home" at the top of every page reached from a dashboard, so
 * the way back is always in the same place.
 */
export function GlobalPageNav() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  if (pathname === "/" || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  };
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    minHeight: 38,
    padding: "0.4rem 0.9rem",
    borderRadius: 999,
    border: "1.5px solid #2e7d32",
    background: "#fff",
    color: "#1b5e20",
    fontWeight: 700,
    fontFamily: FONT,
    fontSize: "0.85rem",
    cursor: "pointer",
  };
  return (
    <nav
      aria-label="Page navigation"
      style={{ display: "flex", gap: "0.5rem", padding: "0.5rem 1rem", background: "rgba(255,255,255,0.94)", borderBottom: "1px solid #e0e0e0", fontFamily: FONT }}
    >
      <button type="button" style={style} onClick={back}>
        ← Back
      </button>
      <button type="button" style={style} onClick={() => router.push("/")}>
        <HouseIcon size={16} /> Home
      </button>
    </nav>
  );
}
