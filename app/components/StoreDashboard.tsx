"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTitleSlot(document.getElementById("dashboard-title-slot"));
  }, []);

  // Same role-only greeting as the other dashboards: no name, just the role.
  const titleContent = (
    <h2 style={{
      fontSize: "clamp(1.05rem, 4vw, 1.4rem)",
      margin: 0,
      color: "#fff",
      fontFamily: '"Montserrat", sans-serif',
      fontWeight: "700",
      letterSpacing: "-0.02em",
      whiteSpace: "nowrap",
      display: "flex",
      alignItems: "center",
      gap: "0.6rem",
    }}>
      Hello, Processor 🏭
    </h2>
  );

  return (
    <>
      {titleSlot && createPortal(titleContent, titleSlot)}
      <ProcessorWorkspace userId={userId} />
    </>
  );
}
