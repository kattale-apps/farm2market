"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/superadmin/qr", label: "QR Codes" },
  { href: "/superadmin/qr/campaigns", label: "Campaigns" },
  { href: "/superadmin/qr/analytics", label: "Analytics" },
  { href: "/superadmin/qr/reports", label: "Reports" },
  { href: "/superadmin/qr/branding", label: "Branding" },
  { href: "/superadmin/qr/administrators", label: "Administrators" },
];

export function QrNav() {
  const pathname = usePathname();

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <Link
        href="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.3rem",
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "#666",
          textDecoration: "none",
          marginBottom: "0.75rem",
        }}
      >
        ← Back to Dashboard
      </Link>
      <nav
        style={{
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
          borderBottom: "1px solid #eee",
          paddingBottom: "0.75rem",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: 999,
                fontSize: "0.85rem",
                fontWeight: 600,
                textDecoration: "none",
                background: active ? "#1976d2" : "#f3f4f6",
                color: active ? "#fff" : "#333",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
