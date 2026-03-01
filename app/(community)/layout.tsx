"use client";

import { Suspense, ReactNode } from "react";
import Link from "next/link";

export default function CommunityLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      {/* Sticky back header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          height: 44,
          display: "flex",
          alignItems: "center",
          paddingLeft: 12,
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            textDecoration: "none",
            color: "#2e7d32",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          ← Dashboard
        </Link>
      </div>

      <Suspense fallback={<div className="p-8">Loading...</div>}>
        {children}
      </Suspense>
    </div>
  );
}
