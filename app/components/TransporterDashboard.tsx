"use client";

import { Id } from "../../convex/_generated/dataModel";
import { TraderDashboard } from "./TraderDashboard";

interface TransporterDashboardProps {
  userId: Id<"users">;
}

/**
 * Transporter Dashboard — thin wrapper around TraderDashboard
 * Transporters see the same trade/inventory/wallet UX as traders.
 */
export function TransporterDashboard({ userId }: TransporterDashboardProps) {
  return <TraderDashboard userId={userId} userRole="transporter" />;
}
