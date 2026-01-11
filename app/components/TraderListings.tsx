"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { formatUgandaDateTime } from "../utils/timeUtils";

interface TraderListingsProps {
  userId: Id<"users">;
}

export function TraderListings({ userId }: TraderListingsProps) {
  const [offering, setOffering] = useState<{ listingId: Id<"listings">; unitId: Id<"listingUnits"> | null } | null>(null);
  const [offerPrice, setOfferPrice] = useState<string>("");
  const [locking, setLocking] = useState<Id<"listingUnits"> | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const listings = useQuery(api.listings.getActiveListings);
  const traderNegotiations = useQuery(api.negotiations.getTraderNegotiations, { traderId: userId });
  const acceptedNegotiations = useQuery(api.negotiations.getAcceptedNegotiations, { traderId: userId });
  const makeOffer = useMutation(api.negotiations.makeOffer);
  const acceptCounterOffer = useMutation(api.negotiations.acceptCounterOffer);
  const lockUnit = useMutation(api.payments.lockUnit);
  
  // Get first available unit for the listing being offered on
  const listingDetails = useQuery(
    api.listings.getListingDetails,
    offering ? { listingId: offering.listingId } : "skip"
  );
  const firstAvailableUnit = listingDetails?.units?.find((u: any) => u.status === "available");

  const formatUGX = (amount: number) => {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    // Timestamps are stored in Uganda time, convert for display
    return formatUgandaDateTime(timestamp);
  };

  const handleMakeOffer = async (listingId: Id<"listings">) => {
    const price = parseFloat(offerPrice);
    if (isNaN(price) || price <= 0) {
      setMessage({ type: "error", text: "Please enter a valid price per kilo" });
      return;
    }

    // Get first available unit
    if (!firstAvailableUnit || !firstAvailableUnit.unitId) {
      setMessage({ type: "error", text: "No available units found for this listing" });
      return;
    }

    setMessage(null);
    
    try {
      const result = await makeOffer({
        traderId: userId,
        unitId: firstAvailableUnit.unitId,
        offerPricePerKilo: price,
      });
      
      setMessage({
        type: "success",
        text: `Offer made successfully! UTID: ${result.negotiationUtid}. Waiting for farmer's response.`,
      });
      
      setOfferPrice("");
      setOffering(null);
      
      setTimeout(() => {
        setMessage(null);
      }, 8000);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: `Failed to make offer: ${error.message}`,
      });
    }
  };

  const handleAcceptCounterOffer = async (negotiationId: Id<"negotiations">) => {
    setMessage(null);
    
    try {
      const result = await acceptCounterOffer({
        traderId: userId,
        negotiationId: negotiationId,
      });
      
      setMessage({
        type: "success",
        text: `Counter-offer accepted! UTID: ${result.acceptedUtid}. You can now proceed to pay-to-lock.`,
      });
      
      setTimeout(() => {
        setMessage(null);
      }, 8000);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: `Failed to accept counter-offer: ${error.message}`,
      });
    }
  };

  const handleLockUnit = async (unitId: Id<"listingUnits">) => {
    setLocking(unitId);
    setMessage(null);
    
    try {
      const result = await lockUnit({
        traderId: userId,
        unitId: unitId,
      });
      
      setMessage({
        type: "success",
        text: `Unit locked successfully! UTID: ${result.utid}. Balance after: ${formatUGX(result.balanceAfter)}. Delivery deadline: 6 hours from now.`,
      });
      
      setTimeout(() => {
        setMessage(null);
      }, 8000);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: `Failed to lock unit: ${error.message}`,
      });
    } finally {
      setLocking(null);
    }
  };


  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", color: "#1a1a1a" }}>
        Available Listings (Make Offers)
      </h3>

      {message && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            background: message.type === "success" ? "#e8f5e9" : "#ffebee",
            borderRadius: "8px",
            border: `1px solid ${message.type === "success" ? "#4caf50" : "#ef5350"}`,
            color: message.type === "success" ? "#2e7d32" : "#c62828",
          }}
        >
          {message.text}
        </div>
      )}

      {/* Active Negotiations */}
      {traderNegotiations && traderNegotiations.negotiations.length > 0 && (
        <div style={{
          marginBottom: "1.5rem",
          padding: "clamp(1rem, 3vw, 1.5rem)",
          background: "#fff3cd",
          borderRadius: "12px",
          border: "1px solid #ffc107"
        }}>
          <h4 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "clamp(1rem, 3vw, 1.1rem)", color: "#856404" }}>
            Your Active Negotiations
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {traderNegotiations.negotiations.map((neg: any) => (
              <div key={neg.negotiationId} style={{
                padding: "0.75rem",
                background: "#fff",
                borderRadius: "8px",
                border: "1px solid #e0e0e0"
              }}>
                <div style={{ fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)", marginBottom: "0.5rem" }}>
                  <strong>{neg.produceType}</strong> - Unit #{neg.unitNumber}
                </div>
                <div style={{ fontSize: "clamp(0.8rem, 2.5vw, 0.85rem)", color: "#666", marginBottom: "0.5rem" }}>
                  Your Offer: {formatUGX(neg.traderOfferPricePerKilo)}/kg | 
                  Current Price: {formatUGX(neg.currentPricePerKilo)}/kg | 
                  Status: <strong>{neg.status}</strong>
                </div>
                <div style={{ fontSize: "clamp(0.7rem, 2vw, 0.75rem)", color: "#999", fontFamily: "monospace", wordBreak: "break-all", marginBottom: "0.5rem" }}>
                  UTID: {neg.negotiationUtid}
                </div>
                {neg.status === "countered" && (
                  <button
                    onClick={() => handleAcceptCounterOffer(neg.negotiationId)}
                    style={{
                      padding: "0.5rem 1rem",
                      background: "#1976d2",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
                      fontWeight: "600",
                    }}
                  >
                    Accept Counter-Offer ({formatUGX(neg.currentPricePerKilo)}/kg)
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accepted Negotiations Ready for Pay-to-Lock */}
      {acceptedNegotiations && acceptedNegotiations.negotiations.length > 0 && (
        <div style={{
          marginBottom: "1.5rem",
          padding: "clamp(1rem, 3vw, 1.5rem)",
          background: "#d4edda",
          borderRadius: "12px",
          border: "1px solid #28a745"
        }}>
          <h4 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "clamp(1rem, 3vw, 1.1rem)", color: "#155724" }}>
            Accepted Offers - Ready to Lock
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {acceptedNegotiations.negotiations.map((neg: any) => (
              <div key={neg.negotiationId} style={{
                padding: "0.75rem",
                background: "#fff",
                borderRadius: "8px",
                border: "1px solid #e0e0e0"
              }}>
                <div style={{ fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)", marginBottom: "0.5rem" }}>
                  <strong>{neg.produceType}</strong> - Unit #{neg.unitNumber} ({neg.unitSize}kg)
                </div>
                <div style={{ fontSize: "clamp(0.8rem, 2.5vw, 0.85rem)", color: "#666", marginBottom: "0.5rem" }}>
                  Final Price: {formatUGX(neg.finalPricePerKilo)}/kg | 
                  Total: {formatUGX(neg.totalPrice)}
                </div>
                <div style={{ fontSize: "clamp(0.7rem, 2vw, 0.75rem)", color: "#999", fontFamily: "monospace", wordBreak: "break-all", marginBottom: "0.5rem" }}>
                  UTID: {neg.acceptedUtid}
                </div>
                <button
                  onClick={() => handleLockUnit(neg.unitId)}
                  disabled={locking === neg.unitId}
                  style={{
                    padding: "0.5rem 1rem",
                    background: locking === neg.unitId ? "#ccc" : "#28a745",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: locking === neg.unitId ? "not-allowed" : "pointer",
                    fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
                    fontWeight: "600",
                  }}
                >
                  {locking === neg.unitId ? "Locking..." : `Pay-to-Lock (${formatUGX(neg.totalPrice)})`}
                </button>
                <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.75rem", color: "#666" }}>
                  ⚠️ After payment, farmer must deliver within 6 hours. Delivery countdown starts from payment time.
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Listings */}
      {listings === undefined ? (
        <p style={{ color: "#999" }}>Loading listings...</p>
      ) : listings.length === 0 ? (
        <p style={{ color: "#666" }}>No active listings available. Farmers need to create listings first.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {listings.map((listing: any) => {
            // Check if trader has an active negotiation for this listing
            const hasActiveNegotiation = traderNegotiations?.negotiations.some(
              (neg: any) => neg.listingId === listing.listingId && (neg.status === "pending" || neg.status === "countered")
            );
            const isOffering = offering?.listingId === listing.listingId;

            return (
              <div
                key={listing.listingId}
                style={{
                  padding: "clamp(1rem, 3vw, 1.5rem)",
                  background: "#fff",
                  borderRadius: "12px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  border: hasActiveNegotiation ? "2px solid #ff9800" : "1px solid #e0e0e0",
                  position: "relative",
                }}
              >
                {hasActiveNegotiation && (
                  <div style={{
                    position: "absolute",
                    top: "0.75rem",
                    right: "0.75rem",
                    padding: "0.25rem 0.75rem",
                    background: "#ff9800",
                    color: "#fff",
                    borderRadius: "4px",
                    fontSize: "clamp(0.7rem, 2vw, 0.75rem)",
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>
                    PENDING
                  </div>
                )}
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "clamp(1rem, 3.5vw, 1.2rem)", color: "#1a1a1a" }}>
                      {listing.produceType}
                    </h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: "0.75rem", fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)", color: "#666", marginBottom: "0.5rem" }}>
                      <div>
                        <strong>Total:</strong> {listing.totalKilos} kg ({listing.totalUnits} {listing.isTraderListing ? "block" : "units"})
                      </div>
                      <div>
                        <strong>Price:</strong> {formatUGX(listing.pricePerKilo)}/kg
                      </div>
                      <div>
                        <strong>Unit:</strong> {formatUGX(listing.pricePerKilo * (listing.unitSize || 10))} ({listing.unitSize || 10}kg)
                      </div>
                      <div>
                        <strong>Available:</strong> {listing.availableUnits || listing.totalUnits} {listing.isTraderListing ? "block" : "units"}
                      </div>
                    </div>
                    <div style={{ fontSize: "clamp(0.8rem, 2.5vw, 0.85rem)", color: "#999" }}>
                      {listing.isTraderListing ? (
                        <>Trader: {listing.traderAlias || "Unknown"} | Listed: {formatDate(listing.createdAt)} | 100kg Block</>
                      ) : (
                        <>Farmer: {listing.farmerAlias || "Unknown"} | Listed: {formatDate(listing.createdAt)}</>
                      )}
                    </div>
                    <div style={{ fontSize: "clamp(0.7rem, 2vw, 0.75rem)", color: "#999", marginTop: "0.5rem", fontFamily: "monospace", wordBreak: "break-all" }}>
                      UTID: {listing.utid}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "1rem", padding: "1rem", background: "#f5f5f5", borderRadius: "8px" }}>
                  {hasActiveNegotiation ? (
                    <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", color: "#666" }}>
                      <strong>You have an active negotiation for this listing.</strong> Check "Your Active Negotiations" above.
                    </p>
                  ) : isOffering ? (
                    <div>
                      <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", color: "#666" }}>
                        <strong>Make an offer:</strong> Enter your price per kilo below.
                      </p>
                      <input
                        type="number"
                        value={offerPrice}
                        onChange={(e) => setOfferPrice(e.target.value)}
                        placeholder={`Current: ${formatUGX(listing.pricePerKilo)}/kg`}
                        style={{
                          padding: "0.5rem",
                          width: "100%",
                          marginBottom: "0.5rem",
                          borderRadius: "6px",
                          border: "1px solid #ccc",
                          fontSize: "0.9rem",
                        }}
                      />
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          onClick={() => handleMakeOffer(listing.listingId)}
                          disabled={!offerPrice || listingDetails === undefined || !firstAvailableUnit}
                          style={{
                            padding: "0.5rem 1rem",
                            background: offerPrice && firstAvailableUnit ? "#1976d2" : "#ccc",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            cursor: offerPrice && firstAvailableUnit ? "pointer" : "not-allowed",
                            fontSize: "0.9rem",
                            fontWeight: "600",
                          }}
                        >
                          {listingDetails === undefined ? "Loading..." : "Submit Offer"}
                        </button>
                        <button
                          onClick={() => {
                            setOffering(null);
                            setOfferPrice("");
                          }}
                          style={{
                            padding: "0.5rem 1rem",
                            background: "#999",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem", color: "#666" }}>
                        <strong>How to negotiate:</strong> Click "Make Offer" to propose a price per kilo. Farmer can accept, reject, or counter-offer.
                      </p>
                      <button
                        onClick={() => {
                          setOffering({ listingId: listing.listingId, unitId: null });
                          setOfferPrice(listing.pricePerKilo.toString());
                        }}
                        disabled={(listing.availableUnits || 0) === 0}
                        style={{
                          padding: "clamp(0.6rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)",
                          background: (listing.availableUnits || 0) === 0 ? "#ccc" : "#1976d2",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          cursor: (listing.availableUnits || 0) === 0 ? "not-allowed" : "pointer",
                          fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
                          fontWeight: "600",
                          marginTop: "0.5rem",
                          width: "100%",
                        }}
                      >
                        {(listing.availableUnits || 0) === 0
                          ? "All Units Locked"
                          : "Make Offer"}
                      </button>
                      <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.8rem", color: "#999" }}>
                        ⚠️ After farmer accepts your offer, you can pay-to-lock. Delivery deadline: 6 hours after payment.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
