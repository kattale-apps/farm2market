import Link from "next/link";

const FONT = '"Montserrat", sans-serif';

/**
 * Branded 404. Without this, a stale link drops the user on the bare Next.js
 * error page, which has no way back into the app.
 */
export default function NotFound() {
  return (
    <div
      style={{
        fontFamily: FONT,
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        padding: "2rem 1rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "2.5rem" }}>🧭</div>
      <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700, color: "#1b5e20" }}>
        Page not found
      </h1>
      <p style={{ margin: 0, color: "#555", fontSize: "0.9rem", maxWidth: 420 }}>
        This page has moved or no longer exists. Your account and data are not affected.
      </p>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", justifyContent: "center", marginTop: "0.5rem" }}>
        <Link
          href="/"
          style={{
            padding: "0.6rem 1.1rem",
            background: "#2e7d32",
            color: "#fff",
            borderRadius: 10,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          🏠 Back to Home
        </Link>
        <Link
          href="/login"
          style={{
            padding: "0.6rem 1.1rem",
            background: "#fff",
            color: "#1b5e20",
            border: "1px solid #c8e6c9",
            borderRadius: 10,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          Log in
        </Link>
      </div>
    </div>
  );
}
