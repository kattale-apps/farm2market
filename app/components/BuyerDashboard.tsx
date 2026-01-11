"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { exportToExcel, exportToPDF, formatUTIDDataForExport } from "../utils/exportUtils";
import { formatUgandaDateTime, getUgandaTime } from "../utils/timeUtils";
import { NotificationMailbox } from "./NotificationMailbox";

interface BuyerDashboardProps {
  userId: Id<"users">;
}

export function BuyerDashboard({ userId }: BuyerDashboardProps) {
  const inventory = useQuery(api.buyerDashboard.getAvailableInventory, { buyerId: userId });
  const windowStatus = useQuery(api.buyerDashboard.getPurchaseWindowStatus, { buyerId: userId });
  const orders = useQuery(api.buyerDashboard.getBuyerOrders, { buyerId: userId });
  const walletBalance = useQuery(api.buyerDashboard.getBuyerWalletBalance, { buyerId: userId });
  const storageFeeRate = useQuery(api.buyerDashboard.getBuyerStorageFeeRate, { buyerId: userId });
  const serviceFeePercentage = useQuery(api.buyerDashboard.getBuyerServiceFeePercentageQuery, { buyerId: userId });
  const transactionLedger = useQuery(api.buyerDashboard.getBuyerTransactionLedger, { buyerId: userId });
  const walletReport = useQuery(api.buyerDashboard.getBuyerWalletReport, { buyerId: userId });
  const createPurchase = useMutation(api.buyers.createBuyerPurchase);
  const makeBuyerOffer = useMutation(api.traderBuyerNegotiations.makeBuyerOffer);
  
  const [selectedInventoryUtids, setSelectedInventoryUtids] = useState<Set<string>>(new Set());
  const [bulkOfferPrice, setBulkOfferPrice] = useState<string>("");
  const [bulkOfferKilos, setBulkOfferKilos] = useState<string>("");
  const [isMakingBulkOffer, setIsMakingBulkOffer] = useState(false);
  const [bulkOfferMessage, setBulkOfferMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const initiateDeposit = useAction(api.pesapal.initiateBuyerDeposit);
  const paymentTransactions = useQuery(api.pesapal.getUserPaymentTransactions, { userId });
  
  const [purchasing, setPurchasing] = useState<Id<"traderInventory"> | null>(null);
  const [purchaseMessage, setPurchaseMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [kilosInput, setKilosInput] = useState<{ [key: string]: string }>({});
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositMessage, setDepositMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
        buyerId: userId,
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

  const formatDate = (timestamp: number) => {
    // Timestamps are stored in Uganda time, convert for display
    return formatUgandaDateTime(timestamp);
  };

  const formatTimeRemaining = (deadline: number) => {
    const now = getUgandaTime();
    const diff = deadline - now;
    if (diff <= 0) return "OVERDUE";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m remaining`;
  };

  const handlePurchase = async (inventoryId: Id<"traderInventory">, availableKilos: number) => {
    const kilosStr = kilosInput[inventoryId] || "";
    const kilos = parseFloat(kilosStr);

    if (!kilosStr || isNaN(kilos) || kilos <= 0) {
      setPurchaseMessage({ type: "error", text: "Please enter a valid quantity (kilos)" });
      return;
    }

    if (kilos > availableKilos) {
      setPurchaseMessage({ type: "error", text: `Requested quantity (${kilos} kg) exceeds available inventory (${availableKilos} kg)` });
      return;
    }

    setPurchasing(inventoryId);
    setPurchaseMessage(null);

    try {
      const result = await createPurchase({
        buyerId: userId,
        inventoryId: inventoryId,
        kilos: kilos,
      });

      setPurchaseMessage({
        type: "success",
        text: `Purchase successful! UTID: ${result.purchaseUtid}. You have 48 hours to pick up ${kilos} kg.`,
      });

      // Clear input
      setKilosInput({ ...kilosInput, [inventoryId]: "" });

      // Clear message after delay
      setTimeout(() => {
        setPurchaseMessage(null);
      }, 10000);
    } catch (error: any) {
      setPurchaseMessage({
        type: "error",
        text: `Purchase failed: ${error.message}`,
      });
    } finally {
      setPurchasing(null);
    }
  };

  const handleToggleSelection = (inventoryUtid: string) => {
    const newSelection = new Set(selectedInventoryUtids);
    if (newSelection.has(inventoryUtid)) {
      newSelection.delete(inventoryUtid);
    } else {
      newSelection.add(inventoryUtid);
    }
    setSelectedInventoryUtids(newSelection);
  };

  const handleSelectAll = () => {
    if (inventory && inventory.inventory.length > 0) {
      if (selectedInventoryUtids.size === inventory.inventory.length) {
        setSelectedInventoryUtids(new Set());
      } else {
        setSelectedInventoryUtids(new Set(inventory?.inventory?.map((item: any) => item.inventoryUtid) || []));
      }
    }
  };

  const handleBulkOffer = async () => {
    if (selectedInventoryUtids.size === 0) {
      setBulkOfferMessage({ type: "error", text: "Please select at least one inventory item" });
      return;
    }

    const offerPrice = parseFloat(bulkOfferPrice);
    const offerKilos = parseFloat(bulkOfferKilos);

    if (!bulkOfferPrice || isNaN(offerPrice) || offerPrice <= 0) {
      setBulkOfferMessage({ type: "error", text: "Please enter a valid offer price per kilo" });
      return;
    }

    if (!bulkOfferKilos || isNaN(offerKilos) || offerKilos <= 0) {
      setBulkOfferMessage({ type: "error", text: "Please enter a valid quantity (kilos)" });
      return;
    }

    setIsMakingBulkOffer(true);
    setBulkOfferMessage(null);

    try {
      // Find inventory items by UTID
      const selectedItems = inventory?.inventory.filter((item: any) => 
        selectedInventoryUtids.has(item.inventoryUtid)
      ) || [];

      const results = [];
      const errors = [];

      for (const item of selectedItems) {
        try {
          // Validate kilos for this item
          if (offerKilos > item.totalKilos) {
            errors.push(`${item.inventoryUtid}: Requested ${offerKilos} kg exceeds available ${item.totalKilos} kg`);
            continue;
          }

          const result = await makeBuyerOffer({
            buyerId: userId,
            inventoryId: item.inventoryId,
            offerPricePerKilo: offerPrice,
            kilos: offerKilos,
          });

          results.push({
            utid: item.inventoryUtid,
            negotiationUtid: result.negotiationUtid,
          });
        } catch (error: any) {
          errors.push(`${item.inventoryUtid}: ${error.message}`);
        }
      }

      if (results.length > 0) {
        setBulkOfferMessage({
          type: "success",
          text: `Successfully made ${results.length} offer(s). ${errors.length > 0 ? `Errors: ${errors.length}` : ""}`,
        });
        // Clear selection and inputs
        setSelectedInventoryUtids(new Set());
        setBulkOfferPrice("");
        setBulkOfferKilos("");
      } else {
        setBulkOfferMessage({
          type: "error",
          text: `Failed to make offers. ${errors.join("; ")}`,
        });
      }

      setTimeout(() => {
        setBulkOfferMessage(null);
      }, 10000);
    } catch (error: any) {
      setBulkOfferMessage({
        type: "error",
        text: `Bulk offer failed: ${error.message}`,
      });
    } finally {
      setIsMakingBulkOffer(false);
    }
  };

  const user = useQuery(api.auth.getUser, { userId });

  return (
    <div style={{ padding: "1rem", maxWidth: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h2 style={{ 
            fontSize: "clamp(1.5rem, 4vw, 1.8rem)", 
            marginBottom: "0.5rem", 
            color: "#2c2c2c",
            fontFamily: '"Montserrat", sans-serif',
            fontWeight: "700",
            letterSpacing: "-0.02em"
          }}>
            Buyer Dashboard 🏢
          </h2>
          <p style={{ 
            color: "#3d3d3d", 
            fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
            fontFamily: '"Montserrat", sans-serif'
          }}>
            Storage Location: Warehouse Name
          </p>
        </div>
        <NotificationMailbox userId={userId} />
      </div>

      {/* Wallet & Deposit Section */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {/* Wallet Balance */}
        <div style={{
          padding: "clamp(1rem, 3vw, 1.5rem)",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          border: "1px solid #e0e0e0"
        }}>
          <h3 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "clamp(1rem, 3vw, 1.2rem)", color: "#1a1a1a" }}>
            Wallet Balance
          </h3>
          {walletBalance === undefined ? (
            <p style={{ color: "#999" }}>Loading...</p>
          ) : (
            <div>
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>Available Balance</div>
                <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#1976d2" }}>
                  {formatUGX(walletBalance.balance)}
                </div>
              </div>
              <div>
                <div style={{ color: "#666", fontSize: "0.9rem" }}>Total Deposits</div>
                <div style={{ fontSize: "1.2rem", color: "#666" }}>
                  {formatUGX(walletBalance.totalDeposits)}
                </div>
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
          {paymentTransactions && paymentTransactions.filter((tx: any) => tx.status === "completed").length > 0 && (
            <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e0e0e0" }}>
              <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.5rem" }}>Recent Successful Deposits</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {paymentTransactions
                  .filter((tx: any) => tx.status === "completed")
                  .slice(0, 3)
                  .map((tx: any) => (
                  <div key={tx.transactionId} style={{
                    padding: "0.5rem",
                    background: "#f9f9f9",
                    borderRadius: "6px",
                    fontSize: "0.85rem"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: "600" }}>{formatUGX(tx.amount)}</span>
                      <span style={{
                        color: "#2e7d32",
                        textTransform: "capitalize"
                      }}>
                        Completed
                      </span>
                    </div>
                    {tx.walletDepositUtid && (
                      <div style={{ 
                        marginTop: "0.5rem",
                        padding: "0.5rem",
                        background: "#f5f5f5",
                        borderRadius: "6px",
                        border: "1px solid #e0e0e0",
                      }}>
                        <div style={{
                          fontSize: "clamp(0.9rem, 2.5vw, 1rem)",
                          color: "#666",
                          fontWeight: "600",
                          marginBottom: "0.25rem",
                          fontFamily: '"Montserrat", sans-serif',
                        }}>
                          UTID:
                        </div>
                        <div style={{
                          fontSize: "clamp(1.4rem, 4vw, 1.8rem)",
                          color: "#2c2c2c",
                          fontFamily: "monospace",
                          fontWeight: "700",
                          letterSpacing: "0.05em",
                          wordBreak: "break-all",
                        }}>
                          {tx.walletDepositUtid}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Purchase Window Status */}
      <div style={{
        marginBottom: "1.5rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: windowStatus?.isOpen ? "#e8f5e9" : "#ffebee",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: `1px solid ${windowStatus?.isOpen ? "#4caf50" : "#ef5350"}`
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
          Purchase Window
        </h3>
        {windowStatus === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : (
          <div>
            <div style={{
              fontSize: "1.2rem",
              fontWeight: "600",
              color: windowStatus.isOpen ? "#2e7d32" : "#c62828",
              marginBottom: "0.5rem"
            }}>
              {windowStatus.isOpen ? "✅ OPEN" : "❌ CLOSED"}
            </div>
            {windowStatus.isOpen && (
              <p style={{ color: "#666", fontSize: "0.9rem" }}>
                You can purchase inventory now. Window opened at {formatDate(windowStatus.openedAt || 0)}.
              </p>
            )}
            {!windowStatus.isOpen && (
              <p style={{ color: "#666", fontSize: "0.9rem" }}>
                Purchase window is closed. Wait for admin to open it.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Service Fee Info */}
      {serviceFeePercentage && (
        <div style={{
          marginBottom: "1.5rem",
          padding: "clamp(1rem, 3vw, 1.5rem)",
          background: "#e3f2fd",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          border: "1px solid #2196f3"
        }}>
          <h3 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "clamp(1rem, 3vw, 1.2rem)", color: "#1565c0" }}>
            💰 Service Fee
          </h3>
          <p style={{ margin: 0, color: "#666", fontSize: "clamp(0.9rem, 2.5vw, 1rem)" }}>
            A <strong>{serviceFeePercentage.serviceFeePercentage}% service fee</strong> will be added to your purchase price.
          </p>
        </div>
      )}

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
            ⚠️ Kilo-Shaving Information
          </h3>
          <p style={{ margin: 0, color: "#666", fontSize: "clamp(0.9rem, 2.5vw, 1rem)", marginBottom: "0.5rem" }}>
            <strong>Grace Period:</strong> You have <strong>48 hours</strong> after purchase to collect your order before kilo-shaving begins.
          </p>
          <p style={{ margin: 0, color: "#666", fontSize: "clamp(0.9rem, 2.5vw, 1rem)" }}>
            <strong>Rate:</strong> {storageFeeRate.rateKgPerDay} kg per day per 100kg block (applies after the 48-hour grace period).
          </p>
        </div>
      )}

      {/* Available Inventory - Institutional Table View */}
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
          Available Inventory (100kg Bags)
        </h3>
        <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1rem" }}>
          All inventory is listed in 100kg bags. Select multiple UTIDs to make bulk offers.
        </p>
        
        {purchaseMessage && (
          <div style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            background: purchaseMessage.type === "success" ? "#e8f5e9" : "#ffebee",
            borderRadius: "8px",
            border: `1px solid ${purchaseMessage.type === "success" ? "#4caf50" : "#ef5350"}`,
            color: purchaseMessage.type === "success" ? "#2e7d32" : "#c62828",
          }}>
            {purchaseMessage.text}
          </div>
        )}

        {inventory === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : !inventory || !inventory.inventory || inventory.inventory.length === 0 ? (
          <p style={{ color: "#666" }}>No inventory available</p>
        ) : (
          <>
            {/* Bulk Offer Section */}
            {selectedInventoryUtids.size > 0 && (
              <div style={{
                padding: "1rem",
                marginBottom: "1.5rem",
                background: "#e3f2fd",
                borderRadius: "8px",
                border: "1px solid #2196f3"
              }}>
                <h4 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1rem", color: "#1565c0" }}>
                  Make Bulk Offer ({selectedInventoryUtids.size} selected)
                </h4>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", color: "#666" }}>
                      Offer Price per Kilo (UGX)
                    </label>
                    <input
                      type="number"
                      value={bulkOfferPrice}
                      onChange={(e) => setBulkOfferPrice(e.target.value)}
                      placeholder="Enter price"
                      min="1"
                      step="0.01"
                      disabled={isMakingBulkOffer}
                      style={{
                        padding: "0.5rem",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        fontSize: "0.9rem",
                        width: "150px"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", color: "#666" }}>
                      Quantity (kg)
                    </label>
                    <input
                      type="number"
                      value={bulkOfferKilos}
                      onChange={(e) => setBulkOfferKilos(e.target.value)}
                      placeholder="Enter kilos"
                      min="1"
                      step="0.01"
                      disabled={isMakingBulkOffer}
                      style={{
                        padding: "0.5rem",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        fontSize: "0.9rem",
                        width: "120px"
                      }}
                    />
                  </div>
                  <button
                    onClick={handleBulkOffer}
                    disabled={isMakingBulkOffer || !bulkOfferPrice || !bulkOfferKilos}
                    style={{
                      padding: "0.5rem 1rem",
                      background: isMakingBulkOffer || !bulkOfferPrice || !bulkOfferKilos ? "#ccc" : "#1976d2",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                      fontWeight: "600",
                      cursor: isMakingBulkOffer || !bulkOfferPrice || !bulkOfferKilos ? "not-allowed" : "pointer"
                    }}
                  >
                    {isMakingBulkOffer ? "Making Offers..." : "Make Bulk Offer"}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedInventoryUtids(new Set());
                      setBulkOfferPrice("");
                      setBulkOfferKilos("");
                    }}
                    style={{
                      padding: "0.5rem 1rem",
                      background: "#fff",
                      color: "#666",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                      cursor: "pointer"
                    }}
                  >
                    Clear Selection
                  </button>
                </div>
                {bulkOfferMessage && (
                  <div style={{
                    marginTop: "0.75rem",
                    padding: "0.75rem",
                    background: bulkOfferMessage.type === "success" ? "#e8f5e9" : "#ffebee",
                    borderRadius: "4px",
                    color: bulkOfferMessage.type === "success" ? "#2e7d32" : "#c62828",
                    fontSize: "0.85rem"
                  }}>
                    {bulkOfferMessage.text}
                  </div>
                )}
              </div>
            )}

            {/* Table View for Desktop */}
            <div style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e0e0e0", background: "#f9f9f9" }}>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333", width: "40px" }}>
                      <input
                        type="checkbox"
                        checked={inventory && selectedInventoryUtids.size === inventory.inventory.length && inventory.inventory.length > 0}
                        onChange={handleSelectAll}
                        style={{ cursor: "pointer" }}
                      />
                    </th>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>UTID</th>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Produce</th>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Quantity (kg)</th>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Quality</th>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Location</th>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Storage Age</th>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Status</th>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory?.inventory?.map((item: any, index: number) => {
                    const itemId = item.inventoryId;
                    const isPurchasing = purchasing === itemId;
                    const canPurchase = windowStatus?.isOpen && !isPurchasing;
                    const storageAge = item.storageStartTime 
                      ? Math.floor((getUgandaTime() - item.storageStartTime) / (1000 * 60 * 60 * 24))
                      : 0;
                    const isSelected = selectedInventoryUtids.has(item.inventoryUtid);

                    return (
                      <tr key={index} style={{ borderBottom: "1px solid #f0f0f0", background: isSelected ? "#e3f2fd" : "transparent" }}>
                        <td style={{ padding: "0.75rem" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelection(item.inventoryUtid)}
                            style={{ cursor: "pointer" }}
                          />
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          <div style={{
                            fontSize: "clamp(1rem, 3vw, 1.2rem)",
                            fontFamily: "monospace",
                            color: "#2c2c2c",
                            fontWeight: "700",
                            letterSpacing: "0.05em",
                            wordBreak: "break-all",
                          }}>
                            {item.inventoryUtid}
                          </div>
                        </td>
                        <td style={{ padding: "0.75rem" }}>{item.produceType}</td>
                        <td style={{ padding: "0.75rem" }}>
                          <strong>{item.totalKilos} kg</strong>
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          {item.qualityRating || "N/A"}
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          {item.storageLocation ? `${item.storageLocation.districtName} (${item.storageLocation.code})` : "N/A"}
                        </td>
                        <td style={{ padding: "0.75rem" }}>{storageAge} days</td>
                        <td style={{ padding: "0.75rem" }}>
                          <span style={{
                            padding: "0.25rem 0.5rem",
                            background: "#e8f5e9",
                            color: "#2e7d32",
                            borderRadius: "4px",
                            fontSize: "0.85rem",
                            fontWeight: "600"
                          }}>
                            Available
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          {windowStatus?.isOpen ? (
                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                              <input
                                type="number"
                                min="1"
                                max={item.totalKilos}
                                step="0.01"
                                value={kilosInput[itemId] || ""}
                                onChange={(e) => setKilosInput({ ...kilosInput, [itemId]: e.target.value })}
                                placeholder="Kilos"
                                disabled={isPurchasing}
                                style={{
                                  padding: "0.5rem",
                                  border: "1px solid #ddd",
                                  borderRadius: "4px",
                                  fontSize: "0.85rem",
                                  width: "100px"
                                }}
                              />
                              <button
                                onClick={() => handlePurchase(itemId, item.totalKilos)}
                                disabled={isPurchasing || !kilosInput[itemId] || parseFloat(kilosInput[itemId] || "0") <= 0}
                                style={{
                                  padding: "0.5rem 1rem",
                                  background: isPurchasing || !kilosInput[itemId] || parseFloat(kilosInput[itemId] || "0") <= 0 ? "#ccc" : "#1976d2",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: "4px",
                                  fontSize: "0.85rem",
                                  fontWeight: "600",
                                  cursor: isPurchasing || !kilosInput[itemId] || parseFloat(kilosInput[itemId] || "0") <= 0 ? "not-allowed" : "pointer"
                                }}
                              >
                                {isPurchasing ? "..." : "Purchase"}
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: "#999", fontSize: "0.85rem" }}>Window Closed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Card View for Mobile (fallback) */}
            <div style={{ display: "none", flexDirection: "column", gap: "1rem" }}>
            {inventory?.inventory?.map((item: any, index: number) => {
              const itemId = item.inventoryId;
              const isPurchasing = purchasing === itemId;
              const canPurchase = windowStatus?.isOpen && !isPurchasing;
              
              return (
                <div key={index} style={{
                  padding: "clamp(1rem, 3vw, 1.5rem)",
                  background: "#f9f9f9",
                  borderRadius: "8px",
                  border: "1px solid #e0e0e0"
                }}>
                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{ fontWeight: "600", marginBottom: "0.5rem", fontSize: "clamp(1rem, 3.5vw, 1.1rem)" }}>
                      {item.produceType}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))", gap: "0.75rem", fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)", color: "#666" }}>
                      <div>
                        <div style={{ color: "#999", fontSize: "clamp(0.75rem, 2vw, 0.85rem)" }}>Available</div>
                        <div style={{ fontWeight: "600", color: "#1976d2", fontSize: "clamp(0.9rem, 3vw, 1rem)" }}>{item.totalKilos} kg</div>
                      </div>
                      <div>
                        <div style={{ color: "#999", fontSize: "clamp(0.75rem, 2vw, 0.85rem)" }}>Block Size</div>
                        <div style={{ fontWeight: "600", color: "#1a1a1a", fontSize: "clamp(0.9rem, 3vw, 1rem)" }}>{item.blockSize} kg</div>
                      </div>
                      <div>
                        <div style={{ color: "#999", fontSize: "clamp(0.75rem, 2vw, 0.85rem)" }}>Trader</div>
                        <div style={{ fontWeight: "600", color: "#1a1a1a", fontSize: "clamp(0.9rem, 3vw, 1rem)" }}>{item.traderAlias}</div>
                      </div>
                    </div>
                    <div style={{ 
                      marginTop: "0.75rem", 
                      padding: "0.5rem",
                      background: "#f5f5f5",
                      borderRadius: "6px",
                      border: "1px solid #e0e0e0",
                    }}>
                      <div style={{
                        fontSize: "clamp(0.9rem, 2.5vw, 1rem)",
                        color: "#666",
                        fontWeight: "600",
                        marginBottom: "0.25rem",
                        fontFamily: '"Montserrat", sans-serif',
                      }}>
                        Transaction UTID:
                      </div>
                      <div style={{ 
                        fontFamily: "monospace", 
                        fontSize: "clamp(1.4rem, 4vw, 1.8rem)", 
                        color: "#2c2c2c", 
                        fontWeight: "700",
                        letterSpacing: "0.05em",
                        wordBreak: "break-all" 
                      }}>
                        {item.inventoryUtid}
                      </div>
                    </div>
                  </div>

                  {windowStatus?.isOpen ? (
                    <div style={{ 
                      padding: "clamp(0.75rem, 2.5vw, 1rem)", 
                      background: "#fff", 
                      borderRadius: "6px",
                      border: "1px solid #e0e0e0"
                    }}>
                      <div style={{ marginBottom: "0.75rem", fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)", color: "#666" }}>
                        <strong>Make Purchase:</strong> Enter quantity (kilos)
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                          <input
                            type="number"
                            min="1"
                            max={item.totalKilos}
                            step="0.01"
                            value={kilosInput[itemId] || ""}
                            onChange={(e) => setKilosInput({ ...kilosInput, [itemId]: e.target.value })}
                            placeholder="Enter kilos"
                            disabled={isPurchasing}
                            style={{
                              padding: "clamp(0.6rem, 2vw, 0.75rem)",
                              border: "1px solid #ddd",
                              borderRadius: "6px",
                              fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
                              flex: "1",
                              minWidth: "120px",
                              fontFamily: "inherit"
                            }}
                          />
                          <button
                            onClick={() => handlePurchase(itemId, item.totalKilos)}
                            disabled={isPurchasing || !kilosInput[itemId] || parseFloat(kilosInput[itemId] || "0") <= 0}
                            style={{
                              padding: "clamp(0.6rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)",
                              background: isPurchasing || !kilosInput[itemId] || parseFloat(kilosInput[itemId] || "0") <= 0 ? "#ccc" : "#1976d2",
                              color: "#fff",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
                              fontWeight: "600",
                              cursor: isPurchasing || !kilosInput[itemId] || parseFloat(kilosInput[itemId] || "0") <= 0 ? "not-allowed" : "pointer",
                              whiteSpace: "nowrap"
                            }}
                          >
                            {isPurchasing ? "Purchasing..." : "Purchase"}
                          </button>
                        </div>
                        <div style={{ fontSize: "clamp(0.75rem, 2vw, 0.85rem)", color: "#666" }}>
                          Max: {item.totalKilos} kg
                        </div>
                      </div>
                      <p style={{ margin: "0.5rem 0 0 0", fontSize: "clamp(0.7rem, 2vw, 0.8rem)", color: "#999" }}>
                        ⚠️ You have 48 hours to pick up after purchase. Kilo-shaving starts after the grace period.
                      </p>
                    </div>
                  ) : (
                    <div style={{ 
                      padding: "1rem", 
                      background: "#fff3cd", 
                      borderRadius: "6px",
                      border: "1px solid #ffc107",
                      color: "#856404",
                      fontSize: "0.9rem"
                    }}>
                      Purchase window is closed. Wait for admin to open it.
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </>
        )}
      </div>

      {/* Purchase Analytics - Institutional Style */}
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
            Purchases Over Time
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
            [Graph: Purchases Over Time]
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
            Inventory Age Distribution
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
            [Graph: Inventory Age Distribution]
          </div>
        </div>
      </div>

      {/* My Orders */}
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
          My Orders
        </h3>
        {orders === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : !orders || !orders.orders || orders.orders.length === 0 ? (
          <p style={{ color: "#666" }}>No orders yet</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {orders.orders.map((order: any, index: number) => (
              <div key={index} style={{
                padding: "1rem",
                background: order.status === "overdue" ? "#ffebee" : "#e8f5e9",
                borderRadius: "8px",
                border: `1px solid ${order.status === "overdue" ? "#ef5350" : "#4caf50"}`
              }}>
                <div style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
                  {order.produceType} - {order.kilos} kg
                </div>
                <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>
                  Pickup deadline: {formatDate(order.pickupSLA)}
                </div>
                <div style={{
                  fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
                  fontWeight: "600",
                  color: order.isPastDeadline ? "#c62828" : "#2e7d32"
                }}>
                  {order.isPastDeadline ? `${order.hoursOverdue.toFixed(1)}h overdue` : `${order.hoursRemaining.toFixed(1)}h remaining`}
                </div>
                <div style={{ 
                  marginTop: "0.75rem",
                  padding: "0.5rem",
                  background: "#f5f5f5",
                  borderRadius: "6px",
                  border: "1px solid #e0e0e0",
                }}>
                  <div style={{
                    fontSize: "clamp(0.9rem, 2.5vw, 1rem)",
                    color: "#666",
                    fontWeight: "600",
                    marginBottom: "0.25rem",
                    fontFamily: '"Montserrat", sans-serif',
                  }}>
                    UTID:
                  </div>
                  <div style={{
                    fontSize: "clamp(1.4rem, 4vw, 1.8rem)",
                    color: "#2c2c2c",
                    fontFamily: "monospace",
                    fontWeight: "700",
                    letterSpacing: "0.05em",
                    wordBreak: "break-all",
                  }}>
                    {order.purchaseUtid}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction Ledger */}
      <div style={{
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        marginBottom: "1.5rem"
      }}>
        <h3 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", color: "#1a1a1a" }}>
          Transaction Ledger
        </h3>
        {transactionLedger === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : transactionLedger.transactions.length === 0 ? (
          <p style={{ color: "#666" }}>No transactions yet</p>
        ) : (
          <>
            {/* Summary */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", 
              gap: "1rem", 
              marginBottom: "1.5rem",
              padding: "1rem",
              background: "#f5f5f5",
              borderRadius: "8px"
            }}>
              <div>
                <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>Total Transactions</div>
                <div style={{ fontSize: "1.2rem", fontWeight: "600", color: "#1976d2" }}>
                  {transactionLedger.totals.totalTransactions}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>Total Quantity</div>
                <div style={{ fontSize: "1.2rem", fontWeight: "600", color: "#1976d2" }}>
                  {transactionLedger.totals.totalQuantityKilos.toFixed(2)} kg
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>Total Cost</div>
                <div style={{ fontSize: "1.2rem", fontWeight: "600", color: "#1976d2" }}>
                  {formatUGX(transactionLedger.totals.totalCost)}
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e0e0e0", background: "#f9f9f9" }}>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Date</th>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Produce</th>
                    <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600", color: "#333" }}>Quantity (kg)</th>
                    <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600", color: "#333" }}>Unit Price/kg</th>
                    <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600", color: "#333" }}>Service Fee</th>
                    <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600", color: "#333" }}>Total Cost</th>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>UTID</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionLedger.transactions.map((tx: any, index: number) => (
                    <tr key={index} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "0.75rem" }}>{formatDate(tx.timestamp)}</td>
                      <td style={{ padding: "0.75rem" }}>{tx.produceType || "N/A"}</td>
                      <td style={{ padding: "0.75rem", textAlign: "right" }}>{tx.quantityKilos.toFixed(2)}</td>
                      <td style={{ padding: "0.75rem", textAlign: "right" }}>{formatUGX(tx.unitPricePerKilo)}</td>
                      <td style={{ padding: "0.75rem", textAlign: "right" }}>
                        {formatUGX(tx.serviceFee)} ({tx.serviceFeePercentage}%)
                      </td>
                      <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600", color: "#1976d2" }}>
                        {formatUGX(tx.totalCost)}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        <div style={{
                          fontSize: "clamp(1rem, 3vw, 1.2rem)",
                          fontFamily: "monospace",
                          color: "#2c2c2c",
                          fontWeight: "700",
                          letterSpacing: "0.05em",
                          wordBreak: "break-all",
                        }}>
                          {tx.utid}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Wallet Report */}
      <div style={{
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0"
      }}>
        <h3 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", color: "#1a1a1a" }}>
          Wallet Report
        </h3>
        {walletReport === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : (
          <>
            {/* Summary */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", 
              gap: "1rem", 
              marginBottom: "1.5rem",
              padding: "1rem",
              background: "#f5f5f5",
              borderRadius: "8px"
            }}>
              <div>
                <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>Total Money In</div>
                <div style={{ fontSize: "1.2rem", fontWeight: "600", color: "#2e7d32" }}>
                  {formatUGX(walletReport.totals.totalMoneyIn)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>Total Money Out</div>
                <div style={{ fontSize: "1.2rem", fontWeight: "600", color: "#d32f2f" }}>
                  {formatUGX(walletReport.totals.totalMoneyOut)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>Current Balance</div>
                <div style={{ fontSize: "1.2rem", fontWeight: "600", color: "#1976d2" }}>
                  {formatUGX(walletReport.totals.currentBalance)}
                </div>
              </div>
            </div>

            {/* Money In */}
            <div style={{ marginBottom: "2rem" }}>
              <h4 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1rem", color: "#2e7d32" }}>
                Money In (Deposits)
              </h4>
              {walletReport.moneyIn.length === 0 ? (
                <p style={{ color: "#666" }}>No deposits yet</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e0e0e0", background: "#f9f9f9" }}>
                        <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Date</th>
                        <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Description</th>
                        <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600", color: "#333" }}>Amount</th>
                        <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600", color: "#333" }}>Balance After</th>
                        <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>UTID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {walletReport.moneyIn.map((entry: any, index: number) => (
                        <tr key={index} style={{ borderBottom: "1px solid #f0f0f0" }}>
                          <td style={{ padding: "0.75rem" }}>{formatDate(entry.timestamp)}</td>
                          <td style={{ padding: "0.75rem" }}>{entry.description}</td>
                          <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600", color: "#2e7d32" }}>
                            +{formatUGX(entry.amount)}
                          </td>
                          <td style={{ padding: "0.75rem", textAlign: "right" }}>{formatUGX(entry.balanceAfter)}</td>
                          <td style={{ padding: "0.75rem" }}>
                            <div style={{
                              fontSize: "clamp(1rem, 3vw, 1.2rem)",
                              fontFamily: "monospace",
                              color: "#2c2c2c",
                              fontWeight: "700",
                              letterSpacing: "0.05em",
                              wordBreak: "break-all",
                            }}>
                              {entry.utid}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Money Out */}
            <div>
              <h4 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1rem", color: "#d32f2f" }}>
                Money Out (Purchases)
              </h4>
              {walletReport.moneyOut.length === 0 ? (
                <p style={{ color: "#666" }}>No purchases yet</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e0e0e0", background: "#f9f9f9" }}>
                        <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Date</th>
                        <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Description</th>
                        <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600", color: "#333" }}>Amount</th>
                        <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600", color: "#333" }}>Balance After</th>
                        <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>UTID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {walletReport.moneyOut.map((entry: any, index: number) => (
                        <tr key={index} style={{ borderBottom: "1px solid #f0f0f0" }}>
                          <td style={{ padding: "0.75rem" }}>{formatDate(entry.timestamp)}</td>
                          <td style={{ padding: "0.75rem" }}>{entry.description}</td>
                          <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: "600", color: "#d32f2f" }}>
                            -{formatUGX(entry.amount)}
                          </td>
                          <td style={{ padding: "0.75rem", textAlign: "right" }}>{formatUGX(entry.balanceAfter)}</td>
                          <td style={{ padding: "0.75rem" }}>
                            <div style={{
                              fontSize: "clamp(1rem, 3vw, 1.2rem)",
                              fontFamily: "monospace",
                              color: "#2c2c2c",
                              fontWeight: "700",
                              letterSpacing: "0.05em",
                              wordBreak: "break-all",
                            }}>
                              {entry.utid}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
