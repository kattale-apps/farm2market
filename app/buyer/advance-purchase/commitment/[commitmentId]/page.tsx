"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useStoredUser } from "../../../../hooks/useStoredUser";
import SubmissionPhotoGallery from "../../../../components/SubmissionPhotoGallery";

const FONT = '"Montserrat", sans-serif';

export default function CommitmentDetailPage() {
  const { commitmentId } = useParams<{ commitmentId: string }>();
  const { user, status } = useStoredUser();
  const detail = useQuery(api.advancePurchase.getCommitmentDetail, {
    commitmentId: commitmentId as Id<"advancePurchaseCommitments">,
  });

  if (status === "loading" || detail === undefined) {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading...</div>;
  }
  if (!user) return <div style={{ padding: "2rem", fontFamily: FONT }}>Please log in.</div>;
  if (!detail) return <div style={{ padding: "2rem", fontFamily: FONT }}>Not found.</div>;

  return (
    <div style={{ padding: "1rem", maxWidth: 640, margin: "0 auto", fontFamily: FONT }}>
      <div style={{ marginBottom: "1rem" }}>
        <Link href="/buyer/advance-purchase" style={{ color: "#1976d2", fontWeight: 600, fontSize: "0.9rem" }}>
          ← Advanced Markets
        </Link>
      </div>

      <h1 style={{ fontSize: "1.3rem", fontWeight: 700 }}>{detail.offer?.productName}</h1>
      <p style={{ color: "#777", fontSize: "0.85rem", marginBottom: "1rem" }}>
        {detail.quantity} {detail.offer?.unit} · status: {detail.status.replace(/_/g, " ")}
      </p>

      <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: "1rem", marginBottom: "1rem" }}>
        <h3 style={{ margin: "0 0 0.6rem", fontSize: "1rem" }}>Payment</h3>
        <div style={{ fontSize: "0.9rem", lineHeight: 1.7 }}>
          <div>Total committed: <strong>UGX {detail.totalAmount.toLocaleString()}</strong></div>
          <div>Released to farmer: <strong style={{ color: "#2e7d32" }}>UGX {detail.releasedAmount.toLocaleString()}</strong></div>
          <div>Pending: <strong>UGX {detail.pendingAmount.toLocaleString()}</strong></div>
        </div>
      </div>

      {detail.offer?.photoUrls && detail.offer.photoUrls.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: "1rem", marginBottom: "1rem" }}>
          <h3 style={{ margin: "0 0 0.6rem", fontSize: "1rem" }}>Gallery</h3>
          <SubmissionPhotoGallery photos={detail.offer.photoUrls} minTileWidth={100} tileHeight={100} />
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: "1rem" }}>
        <h3 style={{ margin: "0 0 0.6rem", fontSize: "1rem" }}>Production progress</h3>
        {detail.milestones.map((m: any) => (
          <div key={m._id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #f0f0f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{m.name}</span>
              <span style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: m.status === "approved" ? "#2e7d32" : m.status === "submitted" ? "#f57f17" : "#999",
              }}>
                {m.status === "approved" ? "✅ Approved" : m.status === "submitted" ? "⏳ Awaiting review" : "Pending"}
              </span>
            </div>
            {m.proofPictures && m.proofPictures.length > 0 && (
              <div style={{ marginTop: "0.5rem" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#888", marginBottom: "0.3rem" }}>
                  Proof pictures
                </div>
                <SubmissionPhotoGallery photos={m.proofPictures.map((p: any) => p.url)} minTileWidth={80} tileHeight={80} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
