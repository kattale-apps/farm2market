"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useStoredUser } from "../../../../hooks/useStoredUser";
import SubmissionPhotoGallery from "../../../../components/SubmissionPhotoGallery";

const FONT = '"Montserrat", sans-serif';

const CARD: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e0e0e0",
  borderRadius: 12,
  padding: "1rem",
  marginBottom: "1rem",
};

const ugx = (amount: number) => `UGX ${Math.round(amount || 0).toLocaleString()}`;

/** The order is still open, so an exit is still meaningful. */
const EXITABLE_STATUSES = ["funded", "in_production", "ready_for_delivery"];

type ExitAction = "cancel" | "forfeit";

export default function CommitmentDetailPage() {
  const { commitmentId } = useParams<{ commitmentId: string }>();
  const { user, status } = useStoredUser();
  const detail = useQuery(api.advancePurchase.getCommitmentDetail, {
    commitmentId: commitmentId as Id<"advancePurchaseCommitments">,
  });

  const cancelCommitment = useMutation(api.advancePurchase.cancelCommitment);
  const forfeitCommitment = useMutation(api.advancePurchase.forfeitCommitment);

  const [confirming, setConfirming] = useState<ExitAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  if (status === "loading" || detail === undefined) {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading...</div>;
  }
  if (!user) return <div style={{ padding: "2rem", fontFamily: FONT }}>Please log in.</div>;
  if (!detail) return <div style={{ padding: "2rem", fontFamily: FONT }}>Not found.</div>;

  // Nothing has been released yet, so the whole amount is still refundable and
  // the buyer can simply cancel. Once a milestone has paid out, forfeiting is
  // the only way out and it costs them what the farmer has already been paid.
  const nothingReleased = detail.releasedAmount === 0;
  const canExit =
    EXITABLE_STATUSES.includes(detail.status) && detail.quantityDelivered === 0;
  const canCancel = canExit && nothingReleased && detail.status === "funded";
  const canForfeit = canExit && !canCancel;

  const runExit = async (action: ExitAction) => {
    setBusy(true);
    setError(null);
    try {
      const mutate = action === "cancel" ? cancelCommitment : forfeitCommitment;
      const result = await mutate({
        buyerId: user.userId as Id<"users">,
        commitmentId: commitmentId as Id<"advancePurchaseCommitments">,
      });
      setConfirming(null);
      setNotice(
        action === "cancel"
          ? `Order cancelled. ${ugx(result.refundAmount)} has been returned to your wallet.`
          : `Order forfeited. ${ugx(result.refundAmount)} has been returned to your wallet; ` +
            `${ugx(result.forfeitedToFarmer)} already released to the farmer is not refundable.`
      );
    } catch (e: any) {
      setError(e?.data?.message || e?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async () => {
    setDownloading(true);
    setError(null);
    try {
      // Loaded on demand — exportUtils drags in jsPDF and xlsx, which this
      // page should not make every buyer download just to read their order.
      const { exportAdvanceMarketCommitmentToPDF } = await import(
        "../../../../utils/exportUtils"
      );
      await exportAdvanceMarketCommitmentToPDF(detail, user.alias);
    } catch (e: any) {
      setError(e?.message || "Could not build the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

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

      <button
        type="button"
        onClick={downloadPdf}
        disabled={downloading}
        style={{
          width: "100%",
          padding: "0.75rem",
          marginBottom: "1rem",
          borderRadius: 10,
          border: "1px solid #1976d2",
          background: downloading ? "#e3f2fd" : "#1976d2",
          color: downloading ? "#1976d2" : "#fff",
          fontWeight: 700,
          fontSize: "0.9rem",
          fontFamily: FONT,
          cursor: downloading ? "wait" : "pointer",
        }}
      >
        {downloading ? "Preparing PDF..." : "⬇️ Download order form (PDF)"}
      </button>

      {notice && (
        <div style={{
          ...CARD,
          background: "#e8f5e9",
          border: "1px solid #a5d6a7",
          color: "#1b5e20",
          fontSize: "0.85rem",
        }}>
          {notice}
        </div>
      )}
      {error && (
        <div style={{
          ...CARD,
          background: "#ffebee",
          border: "1px solid #ef9a9a",
          color: "#b71c1c",
          fontSize: "0.85rem",
        }}>
          {error}
        </div>
      )}

      <div style={CARD}>
        <h3 style={{ margin: "0 0 0.6rem", fontSize: "1rem" }}>Payment</h3>
        <div style={{ fontSize: "0.9rem", lineHeight: 1.7 }}>
          <div>Total committed: <strong>{ugx(detail.totalAmount)}</strong></div>
          <div>Released to farmer: <strong style={{ color: "#2e7d32" }}>{ugx(detail.releasedAmount)}</strong></div>
          <div>Pending: <strong>{ugx(detail.pendingAmount)}</strong></div>
        </div>
      </div>

      {(canCancel || canForfeit) && (
        <div style={CARD}>
          <h3 style={{ margin: "0 0 0.4rem", fontSize: "1rem" }}>Exit this order</h3>
          {canCancel ? (
            <>
              <p style={{ fontSize: "0.85rem", color: "#666", margin: "0 0 0.75rem" }}>
                No milestone payment has been released to the farmer yet, so you can cancel
                and get the full {ugx(detail.totalAmount)} back in your wallet.
              </p>
              <button
                type="button"
                onClick={() => setConfirming("cancel")}
                style={{
                  width: "100%",
                  padding: "0.7rem",
                  borderRadius: 10,
                  border: "1px solid #c62828",
                  background: "#fff",
                  color: "#c62828",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  fontFamily: FONT,
                  cursor: "pointer",
                }}
              >
                Cancel order — full refund
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: "0.85rem", color: "#666", margin: "0 0 0.75rem" }}>
                Production has started on this order. You can still walk away, but the{" "}
                {ugx(detail.releasedAmount)} already released for approved milestones stays
                with the farmer. Only the remaining {ugx(detail.pendingAmount)} comes back
                to your wallet.
              </p>
              <button
                type="button"
                onClick={() => setConfirming("forfeit")}
                style={{
                  width: "100%",
                  padding: "0.7rem",
                  borderRadius: 10,
                  border: "1px solid #c62828",
                  background: "#fff",
                  color: "#c62828",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  fontFamily: FONT,
                  cursor: "pointer",
                }}
              >
                Forfeit order
              </button>
            </>
          )}
        </div>
      )}

      {detail.status === "cancelled" && (
        <div style={{ ...CARD, background: "#fafafa", color: "#777", fontSize: "0.85rem" }}>
          This order was cancelled. Any refundable amount was returned to your wallet.
        </div>
      )}

      {detail.offer?.photoUrls && detail.offer.photoUrls.length > 0 && (
        <div style={CARD}>
          <h3 style={{ margin: "0 0 0.6rem", fontSize: "1rem" }}>Gallery</h3>
          <SubmissionPhotoGallery photos={detail.offer.photoUrls} minTileWidth={90} tileHeight={90} perPage={9} />
        </div>
      )}

      <div style={{ ...CARD, marginBottom: 0 }}>
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
                <SubmissionPhotoGallery photos={[m.proofPictures[0].url]} minTileWidth={80} tileHeight={80} />
                {m.proofPictures.length > 1 && (
                  <div style={{ marginTop: "0.4rem" }}>
                    <div style={{ fontSize: "0.68rem", color: "#aaa", marginBottom: "0.3rem" }}>
                      Past submissions ({m.proofPictures.length - 1})
                    </div>
                    <SubmissionPhotoGallery photos={m.proofPictures.slice(1).map((p: any) => p.url)} minTileWidth={64} tileHeight={64} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 1000,
          }}
        >
          <div style={{
            background: "#fff",
            borderRadius: 14,
            padding: "1.25rem",
            maxWidth: 420,
            width: "100%",
            fontFamily: FONT,
          }}>
            <h3 style={{ margin: "0 0 0.6rem", fontSize: "1.05rem", color: "#c62828" }}>
              {confirming === "cancel" ? "Cancel this order?" : "Forfeit this order?"}
            </h3>
            <div style={{ fontSize: "0.87rem", lineHeight: 1.65, color: "#444", marginBottom: "1rem" }}>
              <div>
                {detail.quantity} {detail.offer?.unit} of {detail.offer?.productName}
              </div>
              <div style={{ marginTop: "0.5rem" }}>
                Refunded to your wallet:{" "}
                <strong style={{ color: "#2e7d32" }}>{ugx(detail.pendingAmount)}</strong>
              </div>
              {confirming === "forfeit" && (
                <div>
                  Kept by the farmer:{" "}
                  <strong style={{ color: "#c62828" }}>{ugx(detail.releasedAmount)}</strong>
                </div>
              )}
              <div style={{ marginTop: "0.5rem", color: "#777" }}>
                This cannot be undone, and the quantity goes back on sale to other buyers.
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: "0.7rem",
                  borderRadius: 10,
                  border: "1px solid #ccc",
                  background: "#fff",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  fontFamily: FONT,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                Keep order
              </button>
              <button
                type="button"
                onClick={() => runExit(confirming)}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: "0.7rem",
                  borderRadius: 10,
                  border: "none",
                  background: busy ? "#e0e0e0" : "#c62828",
                  color: busy ? "#888" : "#fff",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  fontFamily: FONT,
                  cursor: busy ? "wait" : "pointer",
                }}
              >
                {busy
                  ? "Working..."
                  : confirming === "cancel"
                  ? "Yes, cancel"
                  : "Yes, forfeit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
