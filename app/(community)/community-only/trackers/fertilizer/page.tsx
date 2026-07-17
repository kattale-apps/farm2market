"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import CommunityTabBar from "@/app/components/CommunityTabBar";
import { FertilizerPlansView } from "@/app/components/biofarm/FertilizerPlansView";
import { useOfflineQuery } from "@/app/hooks/useOfflineQuery";
import { useStoredUser } from "@/app/hooks/useStoredUser";

const FONT = '"Montserrat", sans-serif';
const BIOFARM_COMMUNITY_ID = "ms72de3njrrc9k43cf9h3yq70181ncp0";

export default function FertilizerPlannerPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const communityId = searchParams.get("communityId") as Id<"communities"> | null;
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) || null;
  const communityInfo = useOfflineQuery(
    (api as any).communities.getCommunityInfo,
    communityId ? { communityId } : "skip"
  ) as any;
  const plannerAccessLoaded = communityInfo !== undefined;
  const plannerVisible = communityInfo?.showFertilizerPlanner === true;

  useEffect(() => {
    if (plannerAccessLoaded && !plannerVisible && communityId) {
      router.replace(`/community-only/trackers?communityId=${communityId}`);
    }
  }, [communityId, plannerAccessLoaded, plannerVisible, router]);

  if (!communityId) {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>No community selected.</p>
        <Link href="/my-communities" style={{ color: "#2e7d32" }}>Back to Communities</Link>
      </div>
    );
  }

  if (communityId !== BIOFARM_COMMUNITY_ID) {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>This module is available only in Bio Farm Community.</p>
        <Link href={`/community-only/trackers?communityId=${communityId}`} style={{ color: "#2e7d32" }}>
          Back to Trackers
        </Link>
      </div>
    );
  }

  if (authStatus === "loading") {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>Loading user session...</p>
      </div>
    );
  }

  if (authStatus === "unauthenticated" || !userId) {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>Your session expired. Please log in again.</p>
        <Link href="/login" style={{ color: "#2e7d32" }}>Go to Login</Link>
      </div>
    );
  }

  if (!plannerAccessLoaded) {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>Loading fertilizer planner...</p>
      </div>
    );
  }

  if (!plannerVisible) {
    return null;
  }

  return (
    <div style={{ fontFamily: FONT, paddingBottom: "5rem", background: "#f5f7f5", minHeight: "100vh" }}>
      <div style={{
        background: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)",
        padding: "1rem",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        gap: "0.7rem",
      }}>
        <Link
          href={`/community-only/trackers?communityId=${communityId}`}
          style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}
        >
          ←
        </Link>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>🌱 Bio Farm Fertilizer Planner</h1>
          <p style={{ margin: 0, fontSize: "0.74rem", opacity: 0.9 }}>Plan spray days and keep application logs</p>
        </div>
      </div>

      <div style={{ padding: "0.9rem" }}>
        <FertilizerPlansView communityId={communityId} farmerId={userId} />
      </div>

      <CommunityTabBar />
    </div>
  );
}
