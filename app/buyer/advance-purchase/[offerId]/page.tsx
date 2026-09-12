"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useStoredUser } from "../../../hooks/useStoredUser";

const FONT = '"Montserrat", sans-serif';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: "1rem",
      background: "#fff",
      border: "1px solid #e0e0e0",
      borderRadius: 12,
      marginBottom: "1rem",
    }}>
      <h3 style={{ margin: "0 0 0.6rem", fontSize: "1rem", fontWeight: 700, color: "#2c2c2c" }}>{title}</h3>
      {children}
    </div>
  );
}

export default function AdvancePurchaseOfferDetailPage() {
  const { offerId } = useParams<{ offerId: string }>();
  const router = useRouter();
  const { user, status } = useStoredUser();
  const offer = useQuery(api.advancePurchase.getOfferDetail, { offerId: offerId as Id<"advancePurchaseOffers"> });
  const createCommitment = useMutation(api.advancePurchase.createCommitment);
  const createProposal = useMutation(api.advancePurchase.createProposal);

  const [quantity, setQuantity] = useState<number>(1);
  const [deliveryOptionKey, setDeliveryOptionKey] = useState<string>("");
  const [insuranceOpted, setInsuranceOpted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProposal, setShowProposal] = useState(false);
  const [proposedPrice, setProposedPrice] = useState<string>("");
  const [proposedQty, setProposedQty] = useState<string>("");
  const [proposalMsg, setProposalMsg] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const handleDownload = async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${offer?.productName || "product"}-photo.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  if (status === "loading" || offer === undefined) {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading offer...</div>;
  }
  if (!user || user.role !== "buyer") {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>Please log in as a buyer.</div>;
  }
  if (!offer) {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>Offer not found.</div>;
  }

  const cashShare = offer.cashComponent != null ? offer.cashComponent : offer.unitPrice * quantity;
  const inKindShare = offer.inKindComponent != null ? offer.inKindComponent * (quantity / offer.totalQuantity) : 0;
  const deliveryFee = deliveryOptionKey
    ? offer.deliveryOptions?.find((d: any) => d.key === deliveryOptionKey)?.feeAmount || 0
    : 0;
  const insuranceFee = insuranceOpted ? (offer.insuranceAmount || 0) : 0;
  const baseTotal = offer.unitPrice * quantity;
  const grandTotal = baseTotal + deliveryFee + insuranceFee;

  const handleFund = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await createCommitment({
        buyerId: user.userId as Id<"users">,
        offerId: offer._id,
        quantity,
        deliveryOptionKey: deliveryOptionKey || undefined,
        insuranceOpted: insuranceOpted || undefined,
      });
      router.push(`/buyer/advance-purchase/commitment/${result._id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handlePropose = async () => {
    setBusy(true);
    setError(null);
    try {
      await createProposal({
        buyerId: user.userId as Id<"users">,
        offerId: offer._id,
        proposedUnitPrice: proposedPrice ? Number(proposedPrice) : undefined,
        proposedQuantity: proposedQty ? Number(proposedQty) : undefined,
        message: proposalMsg || undefined,
      });
      setShowProposal(false);
      alert("Your proposal was sent to the farmer.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: "1rem", maxWidth: 640, margin: "0 auto", fontFamily: FONT }}>
      <div style={{
        background: "rgba(20, 30, 20, 0.72)",
        borderRadius: 12,
        padding: "0.85rem 1rem",
        marginBottom: "1rem",
      }}>
        <Link
          href="/buyer/advance-purchase"
          style={{
            display: "inline-block",
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.85rem",
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: 8,
            padding: "0.4rem 0.75rem",
            textDecoration: "none",
            marginBottom: "0.6rem",
          }}
        >
          ← Advanced Markets
        </Link>

        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.1rem", color: "#fff" }}>{offer.productName}</h1>
        <p style={{ color: "#eee", fontSize: "0.85rem", margin: 0 }}>
          {offer.communityName} · seller {offer.farmerAlias} · {offer.quantityRemaining} {offer.unit} available
        </p>
      </div>

      <Section title="Purchase">
        <p style={{ margin: "0 0 0.5rem" }}>
          {offer.quantityRemaining} {offer.unit} · UGX {offer.unitPrice.toLocaleString()} each
        </p>
        <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
          Quantity to fund
        </label>
        <input
          type="number"
          min={offer.minOrderQty || 1}
          max={offer.quantityRemaining}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          style={{ width: "100%", padding: "0.6rem", borderRadius: 8, border: "1px solid #ccc", marginBottom: "0.75rem" }}
        />

        {offer.deliveryOptions && offer.deliveryOptions.length > 0 && (
          <>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.3rem" }}>
              Delivery option
            </label>
            <select
              value={deliveryOptionKey}
              onChange={(e) => setDeliveryOptionKey(e.target.value)}
              style={{ width: "100%", padding: "0.6rem", borderRadius: 8, border: "1px solid #ccc", marginBottom: "0.75rem" }}
            >
              <option value="">No preference</option>
              {offer.deliveryOptions.map((d: any) => (
                <option key={d.key} value={d.key}>
                  {d.label} (UGX {d.feeAmount.toLocaleString()} {d.feeUnit.replace("_", " ")})
                </option>
              ))}
            </select>
          </>
        )}

        {offer.insuranceEnabled && (
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", marginBottom: "0.75rem" }}>
            <input type="checkbox" checked={insuranceOpted} onChange={(e) => setInsuranceOpted(e.target.checked)} />
            {offer.insuranceLabel || "Farm insurance"} (+UGX {(offer.insuranceAmount || 0).toLocaleString()})
          </label>
        )}

        <div style={{ background: "#f5f5f5", borderRadius: 8, padding: "0.75rem", fontSize: "0.85rem" }}>
          <div>Cash to seller: UGX {Math.round(baseTotal - inKindShare).toLocaleString()}</div>
          {offer.inKindComponent != null && <div>In-kind inputs: UGX {Math.round(inKindShare).toLocaleString()}</div>}
          {deliveryFee > 0 && <div>Delivery fee: UGX {deliveryFee.toLocaleString()}</div>}
          {insuranceFee > 0 && <div>Insurance: UGX {insuranceFee.toLocaleString()}</div>}
          <div style={{ fontWeight: 700, marginTop: "0.4rem" }}>Total due: UGX {Math.round(grandTotal).toLocaleString()}</div>
        </div>

        {error && <p style={{ color: "#d32f2f", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>}

        <button
          type="button"
          onClick={handleFund}
          disabled={busy || quantity <= 0 || quantity > offer.quantityRemaining}
          style={{
            marginTop: "0.9rem",
            width: "100%",
            padding: "0.9rem",
            background: busy ? "#a5d6a7" : "#2e7d32",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: "1rem",
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Processing..." : "Fund Advance Purchase (wallet)"}
        </button>

        {offer.negotiationAllowed && (
          <button
            type="button"
            onClick={() => setShowProposal((s) => !s)}
            style={{
              marginTop: "0.6rem",
              width: "100%",
              padding: "0.7rem",
              background: "#fff",
              color: "#1976d2",
              border: "1.5px solid #1976d2",
              borderRadius: 10,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Propose different terms
          </button>
        )}

        {showProposal && (
          <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "#f0f7ff", borderRadius: 8 }}>
            {offer.buyerCanProposePrice && (
              <input
                type="number"
                placeholder="Proposed unit price (UGX)"
                value={proposedPrice}
                onChange={(e) => setProposedPrice(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: 6, border: "1px solid #ccc", marginBottom: "0.5rem" }}
              />
            )}
            <input
              type="number"
              placeholder="Proposed quantity"
              value={proposedQty}
              onChange={(e) => setProposedQty(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", borderRadius: 6, border: "1px solid #ccc", marginBottom: "0.5rem" }}
            />
            <textarea
              placeholder="Message to farmer (optional)"
              value={proposalMsg}
              onChange={(e) => setProposalMsg(e.target.value)}
              style={{ width: "100%", padding: "0.5rem", borderRadius: 6, border: "1px solid #ccc", marginBottom: "0.5rem" }}
            />
            <button
              type="button"
              onClick={handlePropose}
              disabled={busy}
              style={{ padding: "0.6rem 1rem", background: "#1976d2", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700 }}
            >
              Send proposal
            </button>
          </div>
        )}
      </Section>

      <Section title="Production milestones">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
          {offer.milestones.map((m: any, i: number) => (
            <div key={m._id} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{
                padding: "0.3rem 0.7rem",
                borderRadius: 999,
                fontSize: "0.8rem",
                fontWeight: 700,
                background: m.status === "approved" ? "#e8f5e9" : m.status === "submitted" ? "#fff8e1" : "#f5f5f5",
                color: m.status === "approved" ? "#2e7d32" : m.status === "submitted" ? "#f57f17" : "#777",
              }}>
                {m.status === "approved" ? "✅" : ""} {m.name}
              </span>
              {i < offer.milestones.length - 1 && <span style={{ color: "#ccc" }}>→</span>}
            </div>
          ))}
        </div>
        {offer.milestones.some((m: any) => m.proofPictures && m.proofPictures.length > 0) && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {offer.milestones.map((m: any) => {
              if (!m.proofPictures || m.proofPictures.length === 0) return null;
              const [latest, ...past] = m.proofPictures; // already sorted newest-first
              return (
                <div key={m._id}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#666", marginBottom: "0.3rem" }}>
                    {m.name} — proof pictures
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <img
                      key={latest._id}
                      src={latest.url}
                      alt="Proof"
                      onClick={() => setLightboxUrl(latest.url)}
                      style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, border: "1px solid #e0e0e0", cursor: "zoom-in" }}
                    />
                  </div>
                  {past.length > 0 && (
                    <div style={{ marginTop: "0.4rem" }}>
                      <div style={{ fontSize: "0.72rem", color: "#999", marginBottom: "0.3rem" }}>
                        Past submissions ({past.length})
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {past.map((p: any) => (
                          <img
                            key={p._id}
                            src={p.url}
                            alt="Past proof"
                            onClick={() => setLightboxUrl(p.url)}
                            style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid #e0e0e0", cursor: "zoom-in", opacity: 0.85 }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {offer.photoUrls && offer.photoUrls.length > 0 && (
        <Section title="Gallery">
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {offer.photoUrls.map((url: string, i: number) => (
              <img
                key={i}
                src={url}
                alt={`${offer.productName} ${i + 1}`}
                onClick={() => setLightboxUrl(url)}
                style={{ width: 110, height: 110, objectFit: "cover", borderRadius: 8, border: "1px solid #e0e0e0", cursor: "zoom-in" }}
              />
            ))}
          </div>
        </Section>
      )}

      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1.5rem",
          }}
        >
          <img
            src={lightboxUrl}
            alt="Product enlarged"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", borderRadius: 8 }}
          />
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(lightboxUrl);
              }}
              style={{
                padding: "0.6rem 1rem",
                background: "#2e7d32",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              ⬇ Download
            </button>
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              style={{
                padding: "0.6rem 1rem",
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.5)",
                color: "#fff",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {offer.description && (
        <Section title="Description">
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#444" }}>{offer.description}</p>
        </Section>
      )}
    </div>
  );
}
