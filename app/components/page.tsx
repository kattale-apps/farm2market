"use client";

import Link from "next/link";

export default function ComponentsPage() {
  return (
    <div style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>Components</h1>
      <p>This route is not used. Use the farm validation flow instead.</p>
      <Link
        href="/"
        style={{ color: "#1976d2", textDecoration: "none", fontWeight: 600 }}
      >
        ← Back to Dashboard
      </Link>
    </div>
  );
}