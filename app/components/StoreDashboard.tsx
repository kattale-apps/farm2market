"use client";

import { Id } from "../../convex/_generated/dataModel";
import { FarmerDashboard } from "./FarmerDashboard";

interface StoreDashboardProps {
  userId: Id<"users">;
}

/**
 * Store Dashboard — thin wrapper around FarmerDashboard
 * Stores see the same listing/negotiation/community UX as farmers,
 * but AgroFresh farm validation is hidden (because userRole !== "farmer").
 */
export function StoreDashboard({ userId }: StoreDashboardProps) {
  return <FarmerDashboard userId={userId} userRole="store" />;
}
