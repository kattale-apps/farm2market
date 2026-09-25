"use client";

export const dynamic = "force-dynamic";

/** Crop and animal check inside a community. The screen itself is CropCheck. */

import { useSearchParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import CropCheck from "@/app/components/diagnostics/CropCheck";

export default function CommunityCropCheckPage() {
  const searchParams = useSearchParams();
  const communityId = searchParams.get("communityId") as Id<"communities"> | null;
  const backHref =
    searchParams.get("from") === "farm-needs" || !communityId
      ? "/farmer/farm-needs"
      : `/community-only/trackers?communityId=${communityId}`;
  return <CropCheck communityId={communityId} kind={searchParams.get("kind")} backHref={backHref} showTabBar />;
}
