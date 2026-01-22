"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";

interface NegotiationPanelProps {
  negotiation: any;
  userId: Id<"users">;
  userRole: "farmer" | "trader";
  onUpdate?: () => void;
}

export function NegotiationPanel({
  negotiation,
  userId,
  userRole,
  onUpdate,
}: NegotiationPanelProps) {
  const acceptOffer = useMutation(api.negotiations.acceptOffer);
  const acceptCounterOffer = useMutation(api.negotiations.acceptCounterOffer);
  const rejectOffer = useMutation(api.negotiations.rejectOffer);
  const counterOffer = useMutation(api.negotiations.counterOffer);
  const [counterPrice, setCounterPrice] = useState("");
  const [showCounter, setShowCounter] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const formatUGX = (amount: number) => {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(amount);
  };

  const handleAccept = async () => {
    if (userRole !== "farmer") return;
    
    setLoading(true);
    setMessage(null);
    try {
      await acceptOffer({
        negotiationId: negotiation.negotiationId || negotiation._id,
        farmerId: userId,
      });
      setMessage({ type: "success", text: "Offer accepted! Trader can now proceed to payment." });
      onUpdate?.();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to accept offer" });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (userRole !== "farmer") return;
    
    setLoading(true);
    setMessage(null);
    try {
      await rejectOffer({
        negotiationId: negotiation.negotiationId || negotiation._id,
        farmerId: userId,
      });
      setMessage({ type: "success", text: "Offer rejected." });
      onUpdate?.();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to reject offer" });
    } finally {
      setLoading(false);
    }
  };

  const handleCounter = async () => {
    if (userRole !== "farmer") return;
    
    const price = parseFloat(counterPrice);
    if (isNaN(price) || price <= 0) {
      setMessage({ type: "error", text: "Please enter a valid price" });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      await counterOffer({
        negotiationId: negotiation.negotiationId || negotiation._id,
        farmerId: userId,
        counterPricePerKilo: price,
      });
      setMessage({ type: "success", text: `Counter-offer sent: ${formatUGX(price)}/kg` });
      setCounterPrice("");
      setShowCounter(false);
      onUpdate?.();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to send counter-offer" });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptCounter = async () => {
    if (userRole !== "trader") return;
    
    setLoading(true);
    setMessage(null);
    try {
      await acceptCounterOffer({
        negotiationId: negotiation.negotiationId || negotiation._id,
        traderId: userId,
      });
      setMessage({ type: "success", text: "Counter-offer accepted! You can now proceed to payment." });
      onUpdate?.();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to accept counter-offer" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: "1.5rem",
        background: negotiation.status === "accepted" ? "#d4edda" : "#fff3cd",
        borderRadius: "12px",
        border: `2px solid ${negotiation.status === "accepted" ? "#28a745" : "#ffc107"}`,
        marginBottom: "1rem",
      }}
    >
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <h4 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700" }}>
            {negotiation.produceType} - Unit #{negotiation.unitNumber}
          </h4>
          <span
            style={{
              padding: "0.25rem 0.75rem",
              borderRadius: "12px",
              fontSize: "0.85rem",
              fontWeight: "600",
              background: negotiation.status === "accepted" ? "#28a745" : "#ffc107",
              color: "white",
            }}
          >
            {negotiation.status.toUpperCase()}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: "0.9rem", color: "#666" }}>
          UTID: <strong>{negotiation.negotiationUtid || negotiation.utid || "N/A"}</strong>
        </p>
      </div>

      {/* Prominent Price Display */}
      <div
        style={{
          padding: "1rem",
          background: "white",
          borderRadius: "8px",
          marginBottom: "1rem",
          border: "2px solid #4caf50",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.5rem" }}>
            {userRole === "farmer" ? "Your Price" : "Farmer's Price"}
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#2e7d32", marginBottom: "1rem" }}>
            {formatUGX(negotiation.farmerPricePerKilo)}/kg
          </div>

          <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.5rem" }}>
            {userRole === "farmer" ? "Trader's Offer" : "Your Offer"}
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#1976d2", marginBottom: "1rem" }}>
            {formatUGX(negotiation.traderOfferPricePerKilo)}/kg
          </div>

          <div style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.5rem" }}>
            Current Negotiated Price
          </div>
          <div style={{ fontSize: "2rem", fontWeight: "700", color: "#4caf50" }}>
            {formatUGX(negotiation.currentPricePerKilo)}/kg
          </div>
        </div>
      </div>

      {message && (
        <div
          style={{
            padding: "0.75rem",
            marginBottom: "1rem",
            borderRadius: "6px",
            background: message.type === "success" ? "#d4edda" : "#f8d7da",
            color: message.type === "success" ? "#155724" : "#721c24",
          }}
        >
          {message.text}
        </div>
      )}

      {/* Actions based on role and status */}
      {userRole === "farmer" && negotiation.status === "pending" && (
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <button
            onClick={handleAccept}
            disabled={loading}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: "600",
            }}
          >
            Accept Offer
          </button>
          <button
            onClick={handleReject}
            disabled={loading}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: "600",
            }}
          >
            Reject
          </button>
          <button
            onClick={() => setShowCounter(!showCounter)}
            disabled={loading}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#ffc107",
              color: "#000",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: "600",
            }}
          >
            Counter-Offer
          </button>
        </div>
      )}

      {userRole === "trader" && negotiation.status === "countered" && (
        <div style={{ display: "flex", gap: "1rem" }}>
          <button
            onClick={handleAcceptCounter}
            disabled={loading}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: "600",
            }}
          >
            Accept Counter-Offer
          </button>
        </div>
      )}

      {showCounter && userRole === "farmer" && (
        <div style={{ marginTop: "1rem", padding: "1rem", background: "#f5f5f5", borderRadius: "6px" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
            Your Counter-Offer Price (UGX/kg)
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="number"
              value={counterPrice}
              onChange={(e) => setCounterPrice(e.target.value)}
              placeholder="Enter your price"
              min="1"
              step="1"
              style={{
                flex: 1,
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            />
            <button
              onClick={handleCounter}
              disabled={loading}
              style={{
                padding: "0.75rem 1.5rem",
                background: "#ffc107",
                color: "#000",
                border: "none",
                borderRadius: "6px",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: "600",
              }}
            >
              Submit
            </button>
            <button
              onClick={() => {
                setShowCounter(false);
                setCounterPrice("");
              }}
              style={{
                padding: "0.75rem 1.5rem",
                background: "#f5f5f5",
                border: "1px solid #ddd",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {negotiation.status === "accepted" && (
        <div style={{ padding: "1rem", background: "#e8f5e9", borderRadius: "6px", marginTop: "1rem" }}>
          <p style={{ margin: 0, fontWeight: "600", color: "#2e7d32" }}>
            ✓ Offer Accepted
          </p>
          {userRole === "trader" && (
            <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.9rem", color: "#666" }}>
              You can now proceed to pay-to-lock this unit.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
