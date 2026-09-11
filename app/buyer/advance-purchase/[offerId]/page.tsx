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
      <div style={{ marginBottom: "1rem" }}>
        <Link href="/buyer/advance-purchase" style={{ color: "#1976d2", fontWeight: 600, fontSize: "0.9rem" }}>
          ← Advance Purchase Market
        </Link>
      </div>

      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.1rem" }}>{offer.productName}</h1>
      <p style={{ color: "#777", fontSize: "0.85rem", marginBottom: "1rem" }}>
        {offer.communityName} · seller {offer.farmerAlias} · {offer.quantityRemaining} {offer.unit} available
      </p>

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
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
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
      </Section>

      {offer.description && (
        <Section title="Description">
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#444" }}>{offer.description}</p>
        </Section>
      )}
    </div>
  );
}
