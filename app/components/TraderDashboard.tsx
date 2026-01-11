"use client";

import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { TraderListings } from "./TraderListings";
import { CreateTraderListing } from "./CreateTraderListing";
import { useState } from "react";
import { exportToExcel, exportToPDF, formatUTIDDataForExport } from "../utils/exportUtils";
import { exportUTIDsByCategory, exportUTIDsByCategoryPDF, exportInventoryVolume, exportCapitalVolume } from "../utils/traderReports";
import { NotificationMailbox } from "./NotificationMailbox";
import { formatUgandaDateTime, formatUgandaTimeOnly, getUgandaTime } from "../utils/timeUtils";

interface TraderDashboardProps {
  userId: Id<"users">;
}

export function TraderDashboard({ userId }: TraderDashboardProps) {
  const ledger = useQuery(api.traderDashboard.getLedgerBreakdown, { traderId: userId });
  const exposure = useQuery(api.traderDashboard.getExposureStatus, { traderId: userId });
  const inventory = useQuery(api.traderDashboard.getInventoryWithProjectedLoss, { traderId: userId });
  const activeUTIDs = useQuery(api.traderDashboard.getTraderActiveUTIDs, { traderId: userId });
  const storageFeeRate = useQuery(api.traderDashboard.getTraderStorageFeeRate, { traderId: userId });
  const initiateDeposit = useAction(api.pesapal.initiateTraderDeposit);
  const paymentTransactions = useQuery(api.pesapal.getUserPaymentTransactions, { userId });
  const buyOffers = useQuery(api.traderBuyerNegotiations.getTraderBuyOffers, { traderId: userId });
  const acceptBuyerOffer = useMutation(api.traderBuyerNegotiations.acceptBuyerOffer);
  const rejectBuyerOffer = useMutation(api.traderBuyerNegotiations.rejectBuyerOffer);
  const counterBuyerOffer = useMutation(api.traderBuyerNegotiations.counterBuyerOffer);

  const [depositAmount, setDepositAmount] = useState<string>("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositMessage, setDepositMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [proView, setProView] = useState(false);
  const [counterPrices, setCounterPrices] = useState<{ [key: string]: string }>({});
  const [processingOffers, setProcessingOffers] = useState<{ [key: string]: boolean }>({});
  const [offerMessages, setOfferMessages] = useState<{ [key: string]: { type: "success" | "error"; text: string } }>({});
  const user = useQuery(api.auth.getUser, { userId });

  const formatUGX = (amount: number) => {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(amount);
  };

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!depositAmount || isNaN(amount) || amount <= 0) {
      setDepositMessage({ type: "error", text: "Please enter a valid amount" });
      return;
    }

    setIsDepositing(true);
    setDepositMessage(null);

    try {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const callbackUrl = `${baseUrl}/payment/callback`;
      const cancelUrl = `${baseUrl}/`;

      const result = await initiateDeposit({
        traderId: userId,
        amount: amount,
        currency: "UGX",
        callbackUrl,
        cancelUrl,
      });

      // Redirect to Pesapal payment page
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      } else {
        throw new Error("No redirect URL received from Pesapal");
      }
    } catch (error: any) {
      setDepositMessage({
        type: "error",
        text: `Failed to initiate payment: ${error.message}`,
      });
      setIsDepositing(false);
    }
  };

  const handleExportUTIDs = (format: "excel" | "pdf") => {
    if (!activeUTIDs || !activeUTIDs.utids || activeUTIDs.utids.length === 0) {
      alert("No UTID data available to export");
      return;
    }

    const formattedData = formatUTIDDataForExport(activeUTIDs.utids);
    const ugandaDate = new Date(getUgandaTime() - 3 * 60 * 60 * 1000); // Convert back to UTC for ISO string
    const filename = `trader_report_${ugandaDate.toISOString().split("T")[0]}`;

    if (format === "excel") {
      exportToExcel(formattedData, filename, "Trader");
    } else {
      exportToPDF(formattedData, filename, "Trader", user?.alias);
    }
  };

  const handleExportUTIDsByCategory = (category: string, format: "excel" | "pdf") => {
    if (!activeUTIDs || !activeUTIDs.utids || activeUTIDs.utids.length === 0) {
      alert("No UTID data available to export");
      return;
    }

    const ugandaDate = new Date(getUgandaTime() - 3 * 60 * 60 * 1000);
    const filename = `trader_report_${ugandaDate.toISOString().split("T")[0]}`;

    if (format === "excel") {
      exportUTIDsByCategory(activeUTIDs.utids, category, filename);
    } else {
      exportUTIDsByCategoryPDF(activeUTIDs.utids, category, filename, user?.alias);
    }
  };

  const handleExportInventoryVolume = (format: "excel" | "pdf") => {
    if (!inventory || !inventory.inventory || inventory.inventory.length === 0) {
      alert("No inventory data available to export");
      return;
    }

    const ugandaDate = new Date(getUgandaTime() - 3 * 60 * 60 * 1000);
    const filename = `trader_report_${ugandaDate.toISOString().split("T")[0]}`;

    exportInventoryVolume(inventory.inventory, filename, format, user?.alias);
  };

  const handleExportCapitalVolume = (format: "excel" | "pdf") => {
    if (!ledger || !exposure) {
      alert("No capital data available to export");
      return;
    }

    const ugandaDate = new Date(getUgandaTime() - 3 * 60 * 60 * 1000);
    const filename = `trader_report_${ugandaDate.toISOString().split("T")[0]}`;

    exportCapitalVolume(ledger, exposure, filename, format, user?.alias);
  };

  // Calculate wallet investment percentage for simple view
  const capitalInvestedPercentage = ledger && exposure
    ? Math.min(100, (exposure.exposure.lockedCapital / Math.max(ledger.capital.balance, 1)) * 100)
    : 0;

  // Get open listings (from farmers)
  const openListings = useQuery(api.listings.getActiveListings);

  // Calculate today's activity with UTIDs and status
  const todayActivity = activeUTIDs?.utids.filter((utid: any) => {
    const today = Date.now();
    const dayStart = today - (today % (24 * 60 * 60 * 1000));
    return utid.timestamp && utid.timestamp >= dayStart;
  }).map((utid: any) => {
    // Determine status: Confirmed or Pending Acceptance/Rejection
    let activityStatus = "Confirmed";
    if (utid.type === "unit_lock" && utid.status === "pending") {
      activityStatus = "Pending Delivery";
    } else if (utid.type === "negotiation") {
      if (utid.status === "pending" || utid.status === "countered") {
        activityStatus = "Pending Acceptance/Rejection";
      } else {
        activityStatus = "Confirmed";
      }
    }
    return {
      ...utid,
      activityStatus
    };
  }) || [];

  return (
    <div style={{ padding: "1rem", maxWidth: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ 
            fontSize: "clamp(1.5rem, 4vw, 1.8rem)", 
            marginBottom: "0.5rem", 
            color: "#2c2c2c",
            fontFamily: '"Montserrat", sans-serif',
            fontWeight: "700",
            letterSpacing: "-0.02em"
          }}>
            Trader: {user?.alias || "Trader"} 🚚
          </h2>
          <p style={{ 
            color: "#3d3d3d", 
            fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
            fontFamily: '"Montserrat", sans-serif'
          }}>
            Location: District
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <NotificationMailbox userId={userId} />
          <button
            onClick={() => setProView(!proView)}
            style={{
              padding: "0.5rem 1rem",
              background: proView ? "#1976d2" : "#f5f5f5",
              color: proView ? "#fff" : "#333",
              border: "1px solid #ddd",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: "600"
            }}
          >
            {proView ? "Simple View" : "Pro View"}
          </button>
        </div>
      </div>

      {!proView ? (
        /* Simple View (Default) */
        <>
          {/* Wallet Investment Percentage */}
          <div style={{
            marginBottom: "1.5rem",
            padding: "clamp(1rem, 3vw, 1.5rem)",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0"
          }}>
            <div style={{ marginBottom: "0.5rem", fontSize: "clamp(0.9rem, 2.5vw, 1rem)", color: "#666" }}>
              Capital Invested: {ledger ? formatUGX(exposure?.exposure.lockedCapital || 0) : "Loading..."} ({capitalInvestedPercentage.toFixed(1)}%)
            </div>
            <div style={{
              width: "100%",
              height: "20px",
              background: "#e0e0e0",
              borderRadius: "10px",
              overflow: "hidden"
            }}>
              <div style={{
                width: `${capitalInvestedPercentage}%`,
                height: "100%",
                background: "#1976d2",
                transition: "width 0.3s"
              }} />
            </div>
            {ledger && (
              <div style={{ marginTop: "0.5rem", fontSize: "clamp(0.8rem, 2vw, 0.85rem)", color: "#999" }}>
                Total Capital: {formatUGX(ledger.capital.balance)} | Available: {formatUGX(ledger.capital.available)}
              </div>
            )}
          </div>

          {/* Open Listings */}
          <div style={{
            marginBottom: "1.5rem",
            padding: "clamp(1rem, 3vw, 1.5rem)",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0"
          }}>
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: "1rem", 
              fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", 
              color: "#2c2c2c",
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: "600",
              letterSpacing: "-0.01em"
            }}>
              Open Listings
            </h3>
            {openListings === undefined ? (
              <p style={{ color: "#999" }}>Loading listings...</p>
            ) : openListings.length === 0 ? (
              <p style={{ color: "#666" }}>No open listings available</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {openListings.slice(0, 5).map((listing: any, idx: number) => (
                  <div key={idx} style={{
                    padding: "0.75rem",
                    background: "#f5f5f5",
                    borderRadius: "8px",
                    fontSize: "0.9rem"
                  }}>
                    <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
                      {listing.produceType} - {listing.totalKilos}kg
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#666", fontFamily: "monospace", wordBreak: "break-all" }}>
                      UTID: {listing.utid}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#999", marginTop: "0.25rem" }}>
                      {listing.availableUnits} units available | {listing.farmerAlias}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Your Activity Today */}
          <div style={{
            padding: "clamp(1rem, 3vw, 1.5rem)",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0",
            marginBottom: "1.5rem"
          }}>
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: "1rem", 
              fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", 
              color: "#2c2c2c",
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: "600",
              letterSpacing: "-0.01em"
            }}>
              Your Activity Today
            </h3>
            {todayActivity.length === 0 ? (
              <p style={{ color: "#666" }}>No activity today</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {todayActivity.map((utid: any, idx: number) => (
                  <div key={idx} style={{
                    padding: "0.75rem",
                    background: "#f5f5f5",
                    borderRadius: "8px",
                    fontSize: "0.85rem"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                      <div style={{ fontFamily: "monospace", wordBreak: "break-all", fontSize: "0.8rem" }}>
                        {utid.utid}
                      </div>
                      <div style={{
                        padding: "0.25rem 0.5rem",
                        background: utid.activityStatus === "Confirmed" ? "#d4edda" : "#fff3cd",
                        color: utid.activityStatus === "Confirmed" ? "#155724" : "#856404",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: "600"
                      }}>
                        {utid.activityStatus}
                      </div>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#666" }}>
                      Type: {utid.type} | {utid.state || utid.status || "Active"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Buy-Offers from Buyers */}
          <div style={{
            padding: "clamp(1rem, 3vw, 1.5rem)",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0",
            marginBottom: "1.5rem"
          }}>
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: "1rem", 
              fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", 
              color: "#2c2c2c",
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: "600",
              letterSpacing: "-0.01em"
            }}>
              Buy-Offers from Buyers
            </h3>
            {buyOffers === undefined ? (
              <p style={{ color: "#999" }}>Loading buy-offers...</p>
            ) : buyOffers.negotiations.length === 0 ? (
              <p style={{ color: "#666" }}>No buy-offers from buyers</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {buyOffers.negotiations.map((offer: any) => {
                  const offerId = offer.negotiationId;
                  const counterPrice = counterPrices[offerId] || "";
                  const isProcessing = processingOffers[offerId] || false;
                  const message = offerMessages[offerId] || null;

                  const handleAccept = async () => {
                    setProcessingOffers({ ...processingOffers, [offerId]: true });
                    const newMessages = { ...offerMessages };
                    delete newMessages[offerId];
                    setOfferMessages(newMessages);
                    try {
                      await acceptBuyerOffer({
                        traderId: userId,
                        negotiationId: offer.negotiationId,
                      });
                      setOfferMessages({ ...offerMessages, [offerId]: { type: "success", text: "Offer accepted successfully!" } });
                    } catch (error: any) {
                      setOfferMessages({ ...offerMessages, [offerId]: { type: "error", text: `Failed to accept: ${error.message}` } });
                    } finally {
                      setProcessingOffers({ ...processingOffers, [offerId]: false });
                    }
                  };

                  const handleReject = async () => {
                    setProcessingOffers({ ...processingOffers, [offerId]: true });
                    const newMessages = { ...offerMessages };
                    delete newMessages[offerId];
                    setOfferMessages(newMessages);
                    try {
                      await rejectBuyerOffer({
                        traderId: userId,
                        negotiationId: offer.negotiationId,
                      });
                      setOfferMessages({ ...offerMessages, [offerId]: { type: "success", text: "Offer rejected." } });
                    } catch (error: any) {
                      setOfferMessages({ ...offerMessages, [offerId]: { type: "error", text: `Failed to reject: ${error.message}` } });
                    } finally {
                      setProcessingOffers({ ...processingOffers, [offerId]: false });
                    }
                  };

                  const handleCounter = async () => {
                    const price = parseFloat(counterPrice);
                    if (isNaN(price) || price <= 0) {
                      setOfferMessages({ ...offerMessages, [offerId]: { type: "error", text: "Please enter a valid price" } });
                      return;
                    }
                    setProcessingOffers({ ...processingOffers, [offerId]: true });
                    const newMessages = { ...offerMessages };
                    delete newMessages[offerId];
                    setOfferMessages(newMessages);
                    try {
                      await counterBuyerOffer({
                        traderId: userId,
                        negotiationId: offer.negotiationId,
                        counterPricePerKilo: price,
                      });
                      setOfferMessages({ ...offerMessages, [offerId]: { type: "success", text: "Counter-offer made successfully!" } });
                      setCounterPrices({ ...counterPrices, [offerId]: "" });
                    } catch (error: any) {
                      setOfferMessages({ ...offerMessages, [offerId]: { type: "error", text: `Failed to counter: ${error.message}` } });
                    } finally {
                      setProcessingOffers({ ...processingOffers, [offerId]: false });
                    }
                  };

                  return (
                    <div key={offer.negotiationId} style={{
                      padding: "1rem",
                      background: offer.status === "countered" ? "#fff3cd" : "#f5f5f5",
                      borderRadius: "8px",
                      border: offer.status === "countered" ? "2px solid #ffc107" : "1px solid #e0e0e0"
                    }}>
                      {message && (
                        <div style={{
                          padding: "0.5rem",
                          marginBottom: "0.5rem",
                          background: message.type === "success" ? "#d4edda" : "#f8d7da",
                          color: message.type === "success" ? "#155724" : "#721c24",
                          borderRadius: "4px",
                          fontSize: "0.85rem"
                        }}>
                          {message.text}
                        </div>
                      )}
                      <div style={{ marginBottom: "0.75rem" }}>
                        <div style={{ fontWeight: "600", marginBottom: "0.25rem", fontSize: "1rem" }}>
                          {offer.produceType} - {offer.kilos}kg
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#666", fontFamily: "monospace", wordBreak: "break-all", marginBottom: "0.25rem" }}>
                          UTID: {offer.negotiationUtid}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#666" }}>
                          Buyer: {offer.buyerAlias || "Unknown"}
                        </div>
                      </div>
                      <div style={{ 
                        display: "grid", 
                        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", 
                        gap: "0.5rem",
                        marginBottom: "0.75rem",
                        fontSize: "0.85rem"
                      }}>
                        <div>
                          <div style={{ color: "#999" }}>Buyer Offer</div>
                          <div style={{ fontWeight: "600", color: "#1976d2" }}>
                            {formatUGX(offer.buyerOfferPricePerKilo)}/kg
                          </div>
                        </div>
                        <div>
                          <div style={{ color: "#999" }}>Current Price</div>
                          <div style={{ fontWeight: "600", color: "#1a1a1a" }}>
                            {formatUGX(offer.currentPricePerKilo)}/kg
                          </div>
                        </div>
                        <div>
                          <div style={{ color: "#999" }}>Total Value</div>
                          <div style={{ fontWeight: "600", color: "#2e7d32" }}>
                            {formatUGX(offer.currentPricePerKilo * offer.kilos)}
                          </div>
                        </div>
                      </div>
                      {offer.status === "pending" && (
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <button
                            onClick={handleAccept}
                            disabled={isProcessing}
                            style={{
                              padding: "0.5rem 1rem",
                              background: isProcessing ? "#ccc" : "#28a745",
                              color: "#fff",
                              border: "none",
                              borderRadius: "6px",
                              cursor: isProcessing ? "not-allowed" : "pointer",
                              fontSize: "0.85rem",
                              fontWeight: "600"
                            }}
                          >
                            Accept
                          </button>
                          <button
                            onClick={handleReject}
                            disabled={isProcessing}
                            style={{
                              padding: "0.5rem 1rem",
                              background: isProcessing ? "#ccc" : "#dc3545",
                              color: "#fff",
                              border: "none",
                              borderRadius: "6px",
                              cursor: isProcessing ? "not-allowed" : "pointer",
                              fontSize: "0.85rem",
                              fontWeight: "600"
                            }}
                          >
                            Reject
                          </button>
                          <div style={{ display: "flex", gap: "0.5rem", flex: 1, minWidth: "200px" }}>
                            <input
                              type="number"
                              value={counterPrice}
                              onChange={(e) => setCounterPrices({ ...counterPrices, [offerId]: e.target.value })}
                              placeholder="Counter price/kg"
                              disabled={isProcessing}
                              style={{
                                padding: "0.5rem",
                                flex: 1,
                                border: "1px solid #ccc",
                                borderRadius: "6px",
                                fontSize: "0.85rem"
                              }}
                            />
                            <button
                              onClick={handleCounter}
                              disabled={isProcessing || !counterPrice}
                              style={{
                                padding: "0.5rem 1rem",
                                background: isProcessing || !counterPrice ? "#ccc" : "#ff9800",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                cursor: isProcessing || !counterPrice ? "not-allowed" : "pointer",
                                fontSize: "0.85rem",
                                fontWeight: "600"
                              }}
                            >
                              Counter
                            </button>
                          </div>
                        </div>
                      )}
                      {offer.status === "countered" && (
                        <div style={{
                          padding: "0.5rem",
                          background: "#fff",
                          borderRadius: "4px",
                          fontSize: "0.85rem",
                          color: "#856404"
                        }}>
                          ⚠️ Waiting for buyer to respond to your counter-offer
                        </div>
                      )}
                      {offer.status === "accepted" && (
                        <div style={{
                          padding: "0.5rem",
                          background: "#d4edda",
                          borderRadius: "4px",
                          fontSize: "0.85rem",
                          color: "#155724",
                          fontWeight: "600"
                        }}>
                          ✓ Accepted - Buyer can now purchase
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Deposit Funds Section - Simple View */}
          <div style={{
            marginBottom: "1.5rem",
            padding: "clamp(1rem, 3vw, 1.5rem)",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0"
          }}>
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: "1rem", 
              fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", 
              color: "#2c2c2c",
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: "600",
              letterSpacing: "-0.01em"
            }}>
              💰 Deposit Funds via Pesapal
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "#666" }}>
                  Amount (UGX)
                </label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Enter amount"
                  min="1"
                  step="1"
                  disabled={isDepositing}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    fontSize: "1rem",
                    border: "1px solid #e0e0e0",
                    borderRadius: "8px",
                    boxSizing: "border-box"
                  }}
                />
              </div>
              <button
                onClick={handleDeposit}
                disabled={isDepositing || !depositAmount}
                style={{
                  padding: "0.75rem 1.5rem",
                  background: isDepositing || !depositAmount ? "#ccc" : "#1976d2",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: isDepositing || !depositAmount ? "not-allowed" : "pointer",
                  fontSize: "1rem",
                  fontWeight: "600",
                  transition: "background 0.2s"
                }}
              >
                {isDepositing ? "Processing..." : "💳 Deposit via Pesapal"}
              </button>
              {depositMessage && (
                <div style={{
                  padding: "0.75rem",
                  borderRadius: "6px",
                  background: depositMessage.type === "success" ? "#e8f5e9" : "#ffebee",
                  color: depositMessage.type === "success" ? "#2e7d32" : "#d32f2f",
                  fontSize: "0.9rem"
                }}>
                  {depositMessage.text}
                </div>
              )}
            </div>
            {paymentTransactions && paymentTransactions.length > 0 && (
              <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e0e0e0" }}>
                <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>Recent Deposits</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {paymentTransactions.slice(0, 3).map((tx: any) => (
                    <div key={tx.transactionId} style={{
                      padding: "0.5rem",
                      background: "#f9f9f9",
                      borderRadius: "6px",
                      fontSize: "0.85rem"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                        <span style={{ fontWeight: "600" }}>{formatUGX(tx.amount)}</span>
                        <span style={{
                          color: tx.status === "completed" ? "#2e7d32" : tx.status === "pending" ? "#ff9800" : "#d32f2f",
                          textTransform: "capitalize"
                        }}>
                          {tx.status}
                        </span>
                      </div>
                      {tx.walletDepositUtid && (
                        <div style={{ fontSize: "0.75rem", color: "#999", fontFamily: "monospace" }}>
                          UTID: {tx.walletDepositUtid}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Pro View */
        <>
          {/* Wallet & Exposure */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {/* Ledger Summary */}
        <div style={{
          padding: "clamp(1rem, 3vw, 1.5rem)",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          border: "1px solid #e0e0e0"
        }}>
          <h3 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "clamp(1rem, 3vw, 1.2rem)", color: "#1a1a1a" }}>
            Wallet Summary
          </h3>
          {ledger === undefined ? (
            <p style={{ color: "#999" }}>Loading...</p>
          ) : (
            <div>
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>Capital Deposited</div>
                <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#1976d2" }}>
                  {formatUGX(ledger.capital.balance)}
                </div>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>Profit Earned</div>
                <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#2e7d32" }}>
                  {formatUGX(ledger.profit.balance)}
                </div>
              </div>
              <div>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>Available Balance</div>
                <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#1a1a1a" }}>
                  {formatUGX(ledger.capital.available + ledger.profit.balance)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Exposure Status */}
        <div style={{
          padding: "clamp(1rem, 3vw, 1.5rem)",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          border: "1px solid #e0e0e0"
        }}>
          <h3 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "clamp(1rem, 3vw, 1.2rem)", color: "#1a1a1a" }}>
            Exposure Status
          </h3>
          {exposure === undefined ? (
            <p style={{ color: "#999" }}>Loading...</p>
          ) : (
            <div>
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>Current Exposure</div>
                <div style={{ fontSize: "1.5rem", fontWeight: "600", color: exposure.exposure.totalExposure >= exposure.spendCap.maxExposure * 0.8 ? "#d32f2f" : "#1a1a1a" }}>
                  {formatUGX(exposure.exposure.totalExposure)}
                </div>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>Spend Cap</div>
                <div style={{ fontSize: "1.2rem", color: "#666" }}>
                  {formatUGX(exposure.spendCap.maxExposure)}
                </div>
              </div>
              <div style={{
                width: "100%",
                height: "8px",
                background: "#e0e0e0",
                borderRadius: "4px",
                overflow: "hidden",
                marginTop: "0.5rem"
              }}>
                <div style={{
                  width: `${Math.min(100, exposure.spendCap.usagePercent)}%`,
                  height: "100%",
                  background: exposure.spendCap.usagePercent >= 80 ? "#d32f2f" : "#4caf50",
                  transition: "width 0.3s"
                }} />
              </div>
              <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#666" }}>
                {exposure.spendCap.usagePercent}% of cap used
              </div>
            </div>
          )}
        </div>

        {/* Deposit Section */}
        <div style={{
          padding: "clamp(1rem, 3vw, 1.5rem)",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          border: "1px solid #e0e0e0"
        }}>
          <h3 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "clamp(1rem, 3vw, 1.2rem)", color: "#1a1a1a" }}>
            Deposit Funds
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "#666" }}>
                Amount (UGX)
              </label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Enter amount"
                min="1"
                step="1"
                disabled={isDepositing}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "1rem",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  boxSizing: "border-box"
                }}
              />
            </div>
            <button
              onClick={handleDeposit}
              disabled={isDepositing || !depositAmount}
              style={{
                padding: "0.75rem 1.5rem",
                background: isDepositing || !depositAmount ? "#ccc" : "#1976d2",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: isDepositing || !depositAmount ? "not-allowed" : "pointer",
                fontSize: "1rem",
                fontWeight: "500",
                transition: "background 0.2s"
              }}
            >
              {isDepositing ? "Processing..." : "Deposit via Pesapal"}
            </button>
            {depositMessage && (
              <div style={{
                padding: "0.75rem",
                borderRadius: "6px",
                background: depositMessage.type === "success" ? "#e8f5e9" : "#ffebee",
                color: depositMessage.type === "success" ? "#2e7d32" : "#d32f2f",
                fontSize: "0.9rem"
              }}>
                {depositMessage.text}
              </div>
            )}
          </div>
          {paymentTransactions && paymentTransactions.length > 0 && (
            <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e0e0e0" }}>
              <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>Recent Deposits</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {paymentTransactions.slice(0, 3).map((tx: any) => (
                  <div key={tx.transactionId} style={{
                    padding: "0.5rem",
                    background: "#f9f9f9",
                    borderRadius: "6px",
                    fontSize: "0.85rem"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: "600" }}>{formatUGX(tx.amount)}</span>
                      <span style={{
                        color: tx.status === "completed" ? "#2e7d32" : tx.status === "pending" ? "#ff9800" : "#d32f2f",
                        textTransform: "capitalize"
                      }}>
                        {tx.status}
                      </span>
                    </div>
                    {tx.walletDepositUtid && (
                      <div style={{ fontSize: "0.75rem", color: "#999", fontFamily: "monospace" }}>
                        UTID: {tx.walletDepositUtid}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Storage Fee Rate Info */}
      {storageFeeRate && (
        <div style={{
          marginBottom: "1.5rem",
          padding: "clamp(1rem, 3vw, 1.5rem)",
          background: "#fff3cd",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          border: "1px solid #ffc107"
        }}>
          <h3 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "clamp(1rem, 3vw, 1.2rem)", color: "#856404" }}>
            ⚠️ Current Kilo-Shaving Rate
          </h3>
          <p style={{ margin: 0, color: "#666", fontSize: "clamp(0.9rem, 2.5vw, 1rem)" }}>
            <strong>{storageFeeRate.rateKgPerDay} kg per day</strong> per 100kg block. This rate applies to all inventory in storage.
          </p>
        </div>
      )}

      {/* Inventory */}
      <div style={{
        marginBottom: "1.5rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0"
      }}>
        <h3 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", color: "#1a1a1a" }}>
          Inventory in Storage
        </h3>
        {inventory === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : inventory.inventory.length === 0 ? (
          <p style={{ color: "#666" }}>No inventory in storage</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {inventory.inventory.map((item: any, index: number) => {
              const totalPrice = item.originalPricePerKilo * item.totalKilos;
              const projectedRemainingPrice = item.originalPricePerKilo * item.projectedKilosRemaining;
              
              return (
                <div key={index} style={{
                  padding: "clamp(1rem, 3vw, 1.5rem)",
                  background: "#f9f9f9",
                  borderRadius: "8px",
                  border: "1px solid #e0e0e0"
                }}>
                  {/* Header with UTID */}
                  <div style={{ 
                    marginBottom: "1rem", 
                    paddingBottom: "0.75rem", 
                    borderBottom: "1px solid #e0e0e0" 
                  }}>
                    <div style={{ 
                      fontSize: "clamp(0.7rem, 2vw, 0.75rem)", 
                      color: "#666", 
                      marginBottom: "0.25rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>
                      Transaction UTID
                    </div>
                    <div style={{ 
                      fontSize: "clamp(0.8rem, 2.5vw, 0.9rem)", 
                      color: "#1a1a1a", 
                      fontFamily: "monospace",
                      fontWeight: "600",
                      wordBreak: "break-all"
                    }}>
                      {item.utid}
                    </div>
                  </div>

                  {/* Produce Type and Quantity */}
                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{ 
                      fontSize: "1.1rem", 
                      fontWeight: "600", 
                      marginBottom: "0.5rem",
                      color: "#1a1a1a"
                    }}>
                      {item.produceType}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: "0.75rem" }}>
                      <div>
                        <div style={{ fontSize: "clamp(0.8rem, 2.5vw, 0.85rem)", color: "#666", marginBottom: "0.25rem" }}>
                          Quantity
                        </div>
                        <div style={{ fontSize: "clamp(0.9rem, 3vw, 1rem)", fontWeight: "600", color: "#1976d2" }}>
                          {item.totalKilos.toFixed(2)} kg
                        </div>
                        <div style={{ fontSize: "clamp(0.7rem, 2vw, 0.75rem)", color: "#999", marginTop: "0.25rem" }}>
                          Original: {item.originalKilos.toFixed(2)} kg
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "clamp(0.8rem, 2.5vw, 0.85rem)", color: "#666", marginBottom: "0.25rem" }}>
                          Price per Kilo
                        </div>
                        <div style={{ fontSize: "clamp(0.9rem, 3vw, 1rem)", fontWeight: "600", color: "#2e7d32" }}>
                          {formatUGX(item.originalPricePerKilo)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "clamp(0.8rem, 2.5vw, 0.85rem)", color: "#666", marginBottom: "0.25rem" }}>
                          Total Value
                        </div>
                        <div style={{ fontSize: "clamp(0.9rem, 3vw, 1rem)", fontWeight: "600", color: "#1a1a1a" }}>
                          {formatUGX(totalPrice)}
                        </div>
                        <div style={{ fontSize: "clamp(0.7rem, 2vw, 0.75rem)", color: "#999", marginTop: "0.25rem" }}>
                          Projected: {formatUGX(projectedRemainingPrice)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Storage Details */}
                  <div style={{ 
                    padding: "0.75rem", 
                    background: "#fff", 
                    borderRadius: "6px",
                    border: "1px solid #e0e0e0"
                  }}>
                    <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>
                      Storage Information
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 100px), 1fr))", gap: "0.5rem", fontSize: "clamp(0.75rem, 2.5vw, 0.85rem)" }}>
                      <div>
                        <div style={{ color: "#999", fontSize: "clamp(0.7rem, 2vw, 0.75rem)" }}>Days Stored</div>
                        <div style={{ fontWeight: "600", color: "#1a1a1a", fontSize: "clamp(0.8rem, 2.5vw, 0.9rem)" }}>{item.daysInStorage.toFixed(1)}</div>
                      </div>
                      <div>
                        <div style={{ color: "#999", fontSize: "clamp(0.7rem, 2vw, 0.75rem)" }}>Loss</div>
                        <div style={{ fontWeight: "600", color: "#d32f2f", fontSize: "clamp(0.8rem, 2.5vw, 0.9rem)" }}>{item.projectedKilosLost.toFixed(2)} kg</div>
                      </div>
                      <div>
                        <div style={{ color: "#999", fontSize: "clamp(0.7rem, 2vw, 0.75rem)" }}>Remaining</div>
                        <div style={{ fontWeight: "600", color: "#2e7d32", fontSize: "clamp(0.8rem, 2.5vw, 0.9rem)" }}>{item.projectedKilosRemaining.toFixed(2)} kg</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Transactions */}
      <div style={{
        marginBottom: "1.5rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ marginTop: 0, marginBottom: 0, fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", color: "#1a1a1a" }}>
            Active Transactions
          </h3>
          {activeUTIDs && activeUTIDs.utids && activeUTIDs.utids.length > 0 && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => handleExportUTIDs("excel")}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#2e7d32",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: "500"
                }}
              >
                📊 Excel
              </button>
              <button
                onClick={() => handleExportUTIDs("pdf")}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#d32f2f",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: "500"
                }}
              >
                📄 PDF
              </button>
            </div>
          )}
        </div>
        {activeUTIDs === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : activeUTIDs.utids.length === 0 ? (
          <p style={{ color: "#666" }}>No active transactions</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {activeUTIDs.utids.map((utid: any, index: number) => {
              // Determine background color based on state
              const getStateColor = (state: string) => {
                if (state?.includes("Locked-In (In Transit)")) return "#fff3cd"; // Yellow for in transit
                if (state?.includes("Inventory")) return "#d4edda"; // Green for inventory
                if (state?.includes("Late")) return "#f8d7da"; // Red for late
                return "#f5f5f5"; // Default gray
              };
              
              const getStateBorderColor = (state: string) => {
                if (state?.includes("Locked-In (In Transit)")) return "#ffc107"; // Yellow border
                if (state?.includes("Inventory")) return "#28a745"; // Green border
                if (state?.includes("Late")) return "#dc3545"; // Red border
                return "#e0e0e0"; // Default border
              };
              
              const state = utid.state || (utid.type === "unit_lock" ? "Locked-In" : utid.type === "inventory" ? "Inventory" : "Active");
              
              return (
                <div key={index} style={{
                  padding: "clamp(0.75rem, 2.5vw, 1rem)",
                  background: getStateColor(state),
                  borderRadius: "8px",
                  border: `2px solid ${getStateBorderColor(state)}`,
                  fontSize: "clamp(0.8rem, 2.5vw, 0.85rem)",
                  wordBreak: "break-all"
                }}>
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "flex-start",
                    marginBottom: "0.5rem",
                    flexWrap: "wrap",
                    gap: "0.5rem"
                  }}>
                    <div style={{ flex: 1, minWidth: "200px" }}>
                      <div style={{ 
                        fontSize: "clamp(0.7rem, 2vw, 0.75rem)", 
                        color: "#666",
                        marginBottom: "0.25rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        fontWeight: "600"
                      }}>
                        Transaction UTID
                      </div>
                      <div style={{ 
                        fontWeight: "600", 
                        fontFamily: "monospace",
                        color: "#1a1a1a",
                        fontSize: "clamp(0.8rem, 2.5vw, 0.9rem)"
                      }}>
                        {utid.utid}
                      </div>
                    </div>
                    <div style={{
                      padding: "0.25rem 0.75rem",
                      background: state.includes("Locked-In (In Transit)") ? "#ff9800" 
                        : state.includes("Inventory") ? "#28a745"
                        : state.includes("Late") ? "#dc3545"
                        : "#6c757d",
                      color: "#fff",
                      borderRadius: "4px",
                      fontSize: "clamp(0.7rem, 2vw, 0.75rem)",
                      fontWeight: "600",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      whiteSpace: "nowrap"
                    }}>
                      {state}
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: "clamp(0.7rem, 2vw, 0.75rem)", 
                    color: "#666",
                    display: "flex",
                    gap: "1rem",
                    flexWrap: "wrap"
                  }}>
                    <span>Type: <strong>{utid.type}</strong></span>
                    {utid.status && (
                      <span>Status: <strong>{utid.status}</strong></span>
                    )}
                    {utid.entities && utid.entities.length > 0 && utid.entities[0].produceType && (
                      <span>Produce: <strong>{utid.entities[0].produceType}</strong></span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Comprehensive Reports Section */}
      <div style={{
        marginBottom: "1.5rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0"
      }}>
        <h3 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", color: "#1a1a1a" }}>
          Comprehensive Reports
        </h3>
        
        {/* UTID Reports by Category */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h4 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "clamp(1rem, 3vw, 1.1rem)", color: "#666" }}>
            UTID Reports by Category
          </h4>
          {activeUTIDs && activeUTIDs.utids && activeUTIDs.utids.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
              {Array.from(new Set(activeUTIDs.utids.map((utid: any) => utid.type))).map((category: string) => {
                const count = activeUTIDs.utids.filter((utid: any) => utid.type === category).length;
                return (
                  <div key={category} style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.85rem", color: "#666" }}>{category} ({count}):</span>
                    <button
                      onClick={() => handleExportUTIDsByCategory(category, "excel")}
                      style={{
                        padding: "0.4rem 0.75rem",
                        background: "#2e7d32",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        fontWeight: "500"
                      }}
                    >
                      Excel
                    </button>
                    <button
                      onClick={() => handleExportUTIDsByCategory(category, "pdf")}
                      style={{
                        padding: "0.4rem 0.75rem",
                        background: "#d32f2f",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                        fontWeight: "500"
                      }}
                    >
                      PDF
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: "#999", fontSize: "0.85rem" }}>No UTID data available</p>
          )}
        </div>

        {/* Inventory Volume Report */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h4 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "clamp(1rem, 3vw, 1.1rem)", color: "#666" }}>
            Inventory Volume Report (Produce In & Out)
          </h4>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => handleExportInventoryVolume("excel")}
              style={{
                padding: "0.5rem 1rem",
                background: "#2e7d32",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: "500"
              }}
            >
              📊 Export Excel
            </button>
            <button
              onClick={() => handleExportInventoryVolume("pdf")}
              style={{
                padding: "0.5rem 1rem",
                background: "#d32f2f",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: "500"
              }}
            >
              📄 Export PDF
            </button>
          </div>
        </div>

        {/* Capital Volume Report */}
        <div>
          <h4 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "clamp(1rem, 3vw, 1.1rem)", color: "#666" }}>
            Capital Volume Report (Capital Exposed & Revenue Earned)
          </h4>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => handleExportCapitalVolume("excel")}
              style={{
                padding: "0.5rem 1rem",
                background: "#2e7d32",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: "500"
              }}
            >
              📊 Export Excel
            </button>
            <button
              onClick={() => handleExportCapitalVolume("pdf")}
              style={{
                padding: "0.5rem 1rem",
                background: "#d32f2f",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: "500"
              }}
            >
              📄 Export PDF
            </button>
          </div>
        </div>
      </div>

          {/* Create Trader Listing from 100kg Blocks */}
          <CreateTraderListing userId={userId} />

          {/* Available Listings for Negotiations */}
          <div style={{
            padding: "clamp(1rem, 3vw, 1.5rem)",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0"
          }}>
            <TraderListings userId={userId} />
          </div>

          {/* Pro View: Inventory Table */}
          <div style={{
            marginBottom: "1.5rem",
            padding: "clamp(1rem, 3vw, 1.5rem)",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0"
          }}>
            <h3 style={{ 
              marginTop: 0, 
              marginBottom: "1rem", 
              fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", 
              color: "#2c2c2c",
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: "600",
              letterSpacing: "-0.01em"
            }}>
              Inventory Table
            </h3>
            {inventory === undefined ? (
              <p style={{ color: "#999" }}>Loading...</p>
            ) : inventory.inventory.length === 0 ? (
              <p style={{ color: "#666" }}>No inventory</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.9rem", color: "#666" }}>Produce</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.9rem", color: "#666" }}>Qty</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.9rem", color: "#666" }}>Status</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.9rem", color: "#666" }}>Storage Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.inventory.map((item: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "0.75rem", fontSize: "0.9rem" }}>{item.produceType}</td>
                        <td style={{ padding: "0.75rem", fontSize: "0.9rem" }}>{item.totalKilos.toFixed(2)} kg</td>
                        <td style={{ padding: "0.75rem", fontSize: "0.9rem" }}>In Storage</td>
                        <td style={{ padding: "0.75rem", fontSize: "0.9rem" }}>{item.daysInStorage.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pro View: Analytics Placeholders */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem"
          }}>
            <div style={{
              padding: "clamp(1rem, 3vw, 1.5rem)",
              background: "#fff",
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              border: "1px solid #e0e0e0"
            }}>
              <h3 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "clamp(1rem, 3vw, 1.2rem)", color: "#1a1a1a" }}>
                Inventory Over Time
              </h3>
              <div style={{ 
                height: "200px", 
                background: "#f5f5f5", 
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#999"
              }}>
                [Graph: Inventory over Time]
              </div>
            </div>
            <div style={{
              padding: "clamp(1rem, 3vw, 1.5rem)",
              background: "#fff",
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              border: "1px solid #e0e0e0"
            }}>
              <h3 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "clamp(1rem, 3vw, 1.2rem)", color: "#1a1a1a" }}>
                Lock vs Sales
              </h3>
              <div style={{ 
                height: "200px", 
                background: "#f5f5f5", 
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#999"
              }}>
                [Graph: Lock vs Sales]
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
