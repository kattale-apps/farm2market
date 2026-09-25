"use client";

export const dynamic = "force-dynamic";

/**
 * Crop and animal check from the farmer dashboard (Farm Needs). Any farmer
 * can use it. An optional ?communityId= (one of the farmer's Diagnostics
 * communities) records the check there and allows that community's paid AI
 * photo check. The screen itself is CropCheck.
 */

import { useSearchParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import CropCheck from "@/app/components/diagnostics/CropCheck";

export default function FarmerCropCheckPage() {
  const searchParams = useSearchParams();
  const communityId = (searchParams.get("communityId") || null) as Id<"communities"> | null;
  return (
    <CropCheck communityId={communityId} kind={searchParams.get("kind")} backHref="/farmer/farm-needs" showTabBar={false} />
  );
}
