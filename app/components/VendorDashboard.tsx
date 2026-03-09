"use client";

import { Id } from "../../convex/_generated/dataModel";
import { FarmerDashboard } from "./FarmerDashboard";

interface VendorDashboardProps {
  userId: Id<"users">;
}

/**
 * Vendor Dashboard — thin wrapper around FarmerDashboard
 * Vendors see the same listing/negotiation/community UX as farmers,
 * but AgroFresh farm validation is hidden (because userRole !== "farmer").
 */
export function VendorDashboard({ userId }: VendorDashboardProps) {
  return <FarmerDashboard userId={userId} userRole="vendor" />;
}
