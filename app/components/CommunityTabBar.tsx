"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";

interface TabItem {
  label: string;
  icon: string;
  path: string;
}

const TABS: TabItem[] = [
  { label: "Posts", icon: "📰", path: "/community-only/noticeboard" },
  { label: "Messages", icon: "💬", path: "/community-only/messages" },
  { label: "Forms", icon: "📋", path: "/community-only/trackers" },
  { label: "Insights", icon: "📈", path: "/community-only/my-insights" },
  { label: "Profile", icon: "👤", path: "/community-only/profile" },
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
      padding: "0.35rem 0 calc(0.35rem + env(safe-area-inset-bottom, 0px)) 0",
      zIndex: 1000,
      boxShadow: "0 -2px 8px rgba(0,0,0,0.08)",
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
              padding: "0.25rem 0.5rem",
              borderRadius: 8,
              gap: "0.1rem",
              color: isActive ? "#2e7d32" : "#888",
              fontWeight: isActive ? 700 : 500,
              fontSize: "0.65rem",
              fontFamily: '"Montserrat", sans-serif',
              transition: "color 0.15s",
            }}
          >
            <span style={{ fontSize: "1.2rem" }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
