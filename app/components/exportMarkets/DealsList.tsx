"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatUgandaDateTime } from "../../utils/timeUtils";
import { card, StatusPill } from "./ui";

const PILL: Record<string, string> = {
  enquiry: "pending",
  quoted: "submitted",
  in_progress: "pending",
  completed: "approved",
  declined: "rejected",
  cancelled: "rejected",
};

/** A buyer's or exporter's export deals, with whose move it is. */
export function DealsList({ userId, viewer }: { userId: Id<"users">; viewer: "buyer" | "exporter" }) {
  const deals = useQuery(api.exportDeals.listMyDeals, { userId });
  if (deals === undefined) return <div style={card}>Loading deals...</div>;
  if (deals.length === 0) return <div style={card}>No export deals yet.</div>;
  return (
    <div>
      {deals.map((d) => {
        const yourMove = d.waitingOn === viewer && (d.status === "enquiry" || d.status === "quoted" || d.status === "in_progress");
        return (
          <Link key={d._id} href={`/export-deals/${d._id}`} style={{ ...card, display: "block", textDecoration: "none", color: "#222", borderLeft: yourMove ? "5px solid #ef6c00" : card.border }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
              <b>
                {d.dealCode} · lot {d.lotCode} · {d.lotSummary}
              </b>
              <StatusPill state={PILL[d.status] ?? d.status} />
            </div>
            <div style={{ fontSize: "0.82rem", color: "#555" }}>
              {d.counterpart} · {d.bags} bags · {d.incoterm} · now: {d.currentStep}
              {yourMove && <b style={{ color: "#ef6c00" }}> · your move</b>}
            </div>
            <div style={{ fontSize: "0.72rem", color: "#888" }}>Updated {formatUgandaDateTime(d.updatedAt)}</div>
          </Link>
        );
      })}
    </div>
  );
}
