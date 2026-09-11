"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useStoredUser } from "../../../../hooks/useStoredUser";
import { MilestoneEvidenceCapture } from "../../../../components/advancePurchase/MilestoneEvidenceCapture";

const FONT = '"Montserrat", sans-serif';

export default function FarmerOfferProgressPage() {
  const { offerId } = useParams<{ offerId: string }>();
  const { user, status } = useStoredUser();
  const offer = useQuery(api.advancePurchase.getOfferDetail, { offerId: offerId as Id<"advancePurchaseOffers"> });
  const milestones = useQuery(api.advancePurchase.listMilestones, { offerId: offerId as Id<"advancePurchaseOffers"> });

  if (status === "loading" || offer === undefined || milestones === undefined) {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading...</div>;
  }
  if (!user) return <div style={{ padding: "2rem", fontFamily: FONT }}>Please log in.</div>;
  if (!offer) return <div style={{ padding: "2rem", fontFamily: FONT }}>Offer not found.</div>;
  if (String(offer.farmerId) !== String(user.userId)) {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>You can only view your own offer.</div>;
  }

  const currentMilestone = milestones.find((m: any) => ["pending", "resubmission_required"].includes(m.status));
  const approvedCount = milestones.filter((m: any) => m.status === "approved").length;

  return (
    <div style={{ padding: "1rem", maxWidth: 640, margin: "0 auto", fontFamily: FONT }}>
      <div style={{ marginBottom: "1rem" }}>
        <Link href="/farmer/advance-purchase" style={{ color: "#1976d2", fontWeight: 600, fontSize: "0.9rem" }}>
          ← My offers
        </Link>
      </div>

      <h1 style={{ fontSize: "1.3rem", fontWeight: 700 }}>{offer.productName}</h1>
      <p style={{ color: "#777", fontSize: "0.85rem", marginBottom: "1rem" }}>
        {offer.quantityCommitted}/{offer.totalQuantity} {offer.unit} committed · Stage {approvedCount} of {milestones.length}
      </p>

      <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: "1rem", marginBottom: "1rem" }}>
        <h3 style={{ margin: "0 0 0.6rem", fontSize: "1rem" }}>Timeline</h3>
        {milestones.map((m: any) => (
          <div key={m._id} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid #f0f0f0" }}>
            <span>{m.name}{m.expectedDate ? ` · due ${new Date(m.expectedDate).toLocaleDateString()}` : ""}</span>
            <span style={{
              fontSize: "0.78rem",
              fontWeight: 700,
              color: m.status === "approved" ? "#2e7d32" : m.status === "submitted" ? "#f57f17" : m.status === "resubmission_required" || m.status === "rejected" ? "#d32f2f" : "#999",
            }}>
              {({
                approved: "✅ Approved",
                submitted: "⏳ Awaiting review",
                resubmission_required: "🔁 Resubmit",
                rejected: "❌ Rejected",
                pending: "Pending",
              } as Record<string, string>)[m.status]}
            </span>
          </div>
        ))}
      </div>

      {currentMilestone ? (
        <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: "1rem" }}>
          <h3 style={{ margin: "0 0 0.4rem", fontSize: "1rem" }}>
            Stage {currentMilestone.order} of {milestones.length} · {currentMilestone.name}
          </h3>
          <p style={{ fontSize: "0.82rem", color: "#666", marginBottom: "0.75rem" }}>
            {currentMilestone.expectedDate ? `Due ${new Date(currentMilestone.expectedDate).toLocaleDateString()} · ` : ""}
            Timestamp and location captured automatically.
          </p>
          <MilestoneEvidenceCapture
            farmerId={user.userId as any}
            milestoneId={currentMilestone._id}
            gpsRequired={currentMilestone.gpsRequired}
            onSubmitted={() => {}}
          />
        </div>
      ) : (
        <div style={{ padding: "1rem", background: "#e8f5e9", borderRadius: 10, color: "#2e7d32", fontWeight: 600 }}>
          🎉 All stages verified. Ready for delivery.
        </div>
      )}
    </div>
  );
}
