"use client";

import { Suspense, ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { resolveCommunityLogo } from "../lib/communityLogos";

function CommunityHeader() {
  const searchParams = useSearchParams();
  const communityId = searchParams.get("communityId") || "";
  const communityInfo = useQuery(
    api.communities.getCommunityInfo,
    communityId ? { communityId: communityId as Id<"communities"> } : "skip"
  );
  const communityLogo = communityInfo
    ? resolveCommunityLogo({
        name: communityInfo.name,
        logoPath: communityInfo.logoUrl || undefined,
      })
    : undefined;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#fff",
        borderBottom: "1px solid #e5e7eb",
        height: 48,
        display: "flex",
        alignItems: "center",
        paddingLeft: 12,
        paddingRight: 12,
        gap: 12,
      }}
    >
      <Link
        href="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          textDecoration: "none",
          color: "#fff",
          fontWeight: 600,
          fontSize: 13,
          background: "#2e7d32",
          padding: "6px 14px",
          borderRadius: 10,
          whiteSpace: "nowrap",
        }}
      >
        🏠 Back to Home
      </Link>
      {communityInfo && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
          {communityLogo && (
            <img
              src={communityLogo}
              alt=""
              style={{ width: 24, height: 24, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
            />
          )}
          <span style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {communityInfo.name}
          </span>
        </div>
      )}
    </div>
  );
}

export default function CommunityLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <Suspense fallback={<div style={{ height: 48 }} />}>
        <CommunityHeader />
      </Suspense>

      <Suspense fallback={<div className="p-8">Loading...</div>}>
        {children}
      </Suspense>
    </div>
  );
}



