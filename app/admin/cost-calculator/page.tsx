"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useStoredUser } from "@/app/hooks/useStoredUser";
import { CostTemplatesPanel } from "@/app/components/costTemplates/CostTemplatesPanel";

const FONT = '"Montserrat", sans-serif';

/**
 * Standalone cost template manager. Super admins always reach it; a community
 * admin only does so once a super admin has enabled the Cost Templates module
 * for one of their communities, which is where they normally manage templates
 * (the "Cost Templates" tab of the community dashboard).
 */
export default function CostCalculatorPage() {
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;

  const currentUser = useQuery(api.auth.getUser, userId ? { userId } : "skip");
  const isAdmin = currentUser?.role === "admin";
  const isSuperAdminUser =
    isAdmin &&
    ((currentUser as any)?.adminLevel === "super" ||
      ((currentUser as any)?.adminLevel === undefined && !(currentUser as any)?.adminCategory));

  const adminCommunities = useQuery(
    api.introspection.getCommunitiesForAdmin,
    userId && isAdmin && !isSuperAdminUser ? { adminId: userId } : "skip"
  );

  if (authStatus === "loading" || (userId && currentUser === undefined)) {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading...</div>;
  }

  if (!isAdmin) {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>Admin access required.</div>;
  }

  if (!isSuperAdminUser) {
    if (adminCommunities === undefined) {
      return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading...</div>;
    }
    const hasEnabledCommunity = adminCommunities.some((c: any) => c?.costTemplatesEnabled === true);
    if (!hasEnabledCommunity) {
      return (
        <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
          <p>Cost Templates is not enabled for your community yet.</p>
          <Link href="/admin/community-dashboard" style={{ color: "#2e7d32" }}>
            Back to Community Dashboard
          </Link>
        </div>
      );
    }
  }

  return <CostTemplatesPanel userId={userId} />;
}
