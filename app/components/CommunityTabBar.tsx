"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";

interface TabItem {
  label: string;
  icon: string;
  path: string;
  color: string;
}

const TABS: TabItem[] = [
  { label: "Posts", icon: "📰", path: "/community-only/noticeboard", color: "#2e7d32" },
  { label: "Messages", icon: "💬", path: "/community-only/messages", color: "#1565c0" },
  { label: "Forms", icon: "📋", path: "/community-only/trackers", color: "#e65100" },
  { label: "Insights", icon: "📈", path: "/community-only/my-insights", color: "#6a1b9a" },
  { label: "Profile", icon: "👤", path: "/community-only/profile", color: "#00695c" },
];

export default function CommunityTabBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const communityId = searchParams.get("communityId") || "";

  return (
    <nav style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      background: "#ffffff",
      borderTop: "1px solid #e0e0e0",
      display: "flex",
      justifyContent: "space-around",
      alignItems: "center",
      padding: "0.4rem 0.25rem calc(0.4rem + env(safe-area-inset-bottom, 0px)) 0.25rem",
      zIndex: 1000,
      boxShadow: "0 -2px 8px rgba(0,0,0,0.08)",
      gap: "0.25rem",
    }}>
      {TABS.map((tab) => {
        const isActive = pathname === tab.path || pathname?.startsWith(tab.path + "/");
        const href = communityId ? `${tab.path}?communityId=${communityId}` : tab.path;
        return (
          <Link
            key={tab.path}
            href={href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textDecoration: "none",
              padding: "0.35rem 0.6rem",
              borderRadius: 12,
              gap: "0.15rem",
              minHeight: 48,
              justifyContent: "center",
              background: isActive ? tab.color : `${tab.color}1F`,
              color: isActive ? "#fff" : tab.color,
              fontWeight: isActive ? 700 : 600,
              fontSize: "0.65rem",
              fontFamily: '"Montserrat", sans-serif',
              transition: "all 0.2s ease",
              boxShadow: isActive ? `0 2px 10px ${tab.color}66` : "none",
              flex: 1,
            }}
          >
            <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
