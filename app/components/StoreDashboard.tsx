"use client";

import { Id } from "../../convex/_generated/dataModel";
import { ProcessorWorkspace } from "./processor/ProcessorWorkspace";

interface StoreDashboardProps {
  userId: Id<"users">;
}

/**
 * Processor dashboard. The role key stays "store"; users see "Processor".
 * Facility profile, verification, intake, processing and sales all live in
 * the processor workspace.
 */
export function StoreDashboard({ userId }: StoreDashboardProps) {
  return <ProcessorWorkspace userId={userId} />;
}
