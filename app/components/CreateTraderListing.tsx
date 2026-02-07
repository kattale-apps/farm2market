"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";

interface CreateTraderListingProps {
  userId: Id<"users">;
}

export function CreateTraderListing({ userId }: CreateTraderListingProps) {
  const createTraderListing = useMutation(api.listings.createTraderListing);
  const createTraderPackagingListing = useMutation((api as any).listings.createTraderPackagingListing);
  const availableInventory = useQuery(api.listings.getTraderAvailableInventoryForListing, { traderId: userId });
  const traderProfile = useQuery(api.auth.getUser, { userId });
  const farmcoinSummary = useQuery((api as any).farmcoin.getTraderFarmcoinSummary, { traderId: userId } as any);
  const farmcoinSettings = useQuery((api as any).farmcoin.getFarmcoinSettings, {} as any);
  const requestFarmcoinTokens = useMutation((api as any).farmcoin.requestFarmcoinTokens);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [listingSource, setListingSource] = useState<"farmer_inventory" | "trader_sourced">("farmer_inventory");
  const [selectedInventory, setSelectedInventory] = useState<string>("");
  const [pricePerKilo, setPricePerKilo] = useState<string>("");
  const [requestReason, setRequestReason] = useState("");
  const [productName, setProductName] = useState("");
  const [packagingTypeEnum, setPackagingTypeEnum] = useState("");
  const [packagingTypeCustom, setPackagingTypeCustom] = useState("");
  const [totalUnitsAvailable, setTotalUnitsAvailable] = useState("");
  const [pricingUnit, setPricingUnit] = useState<"per_package" | "per_kg">("per_package");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [departureLocation, setDepartureLocation] = useState("");
  const [destinationLocation, setDestinationLocation] = useState("");
  const [etaType, setEtaType] = useState<"duration" | "arrival_time">("duration");
  const [etaValue, setEtaValue] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState<"in_storage" | "in_transit">("in_storage");

  const formatUGX = (amount: number) => {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedInventory) {
      setMessage({ type: "error", text: "Please select an inventory lot" });
      return;
    }

    const price = parseFloat(pricePerKilo);
    if (isNaN(price) || price <= 0) {
      setMessage({ type: "error", text: "Please enter a valid price per kilo" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await createTraderListing({
        traderId: userId,
        inventoryId: selectedInventory as Id<"traderInventory">,
        pricePerKilo: price,
      });

      setMessage({
        type: "success",
        text: `Listing created successfully! UTID: ${result.utid}. Your inventory lot is now available for buyers.`,
      });

      // Reset form
      setSelectedInventory("");
      setPricePerKilo("");
      setShowForm(false);

      setTimeout(() => {
        setMessage(null);
      }, 8000);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: `Failed to create listing: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTraderSourcedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productName.trim()) {
      setMessage({ type: "error", text: "Please enter a product name." });
      return;
    }

    const totalUnits = parseInt(totalUnitsAvailable, 10);
    if (isNaN(totalUnits) || totalUnits <= 0) {
      setMessage({ type: "error", text: "Please enter total units available." });
      return;
    }

    const price = parseFloat(pricePerUnit);
    if (isNaN(price) || price <= 0) {
      setMessage({ type: "error", text: "Please enter a valid price per unit." });
      return;
    }

    if (!departureLocation.trim() || !destinationLocation.trim()) {
      setMessage({ type: "error", text: "Departure and destination locations are required." });
      return;
    }

    let etaNumber: number;
    if (etaType === "duration") {
      etaNumber = parseInt(etaValue, 10);
      if (isNaN(etaNumber) || etaNumber <= 0) {
        setMessage({ type: "error", text: "Please enter a valid ETA in hours." });
        return;
      }
    } else {
      const timestamp = new Date(etaValue).getTime();
      if (!etaValue || Number.isNaN(timestamp)) {
        setMessage({ type: "error", text: "Please provide a valid arrival time." });
        return;
      }
      etaNumber = timestamp;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await createTraderPackagingListing({
        traderId: userId,
        productName: productName.trim(),
        produceType: productName.trim(),
        packagingTypeEnum: packagingTypeEnum || undefined,
        packagingTypeCustom: packagingTypeCustom || undefined,
        totalUnits,
        pricingUnit,
        pricePerUnit: price,
        departureLocation: departureLocation.trim(),
        destinationLocation: destinationLocation.trim(),
        etaType,
        etaValue: etaNumber,
        deliveryStatus,
      });

      setMessage({
        type: "success",
        text: `Listing created successfully! UTID: ${result.utid}.`,
      });

      setProductName("");
      setPackagingTypeEnum("");
      setPackagingTypeCustom("");
      setTotalUnitsAvailable("");
      setPricingUnit("per_package");
      setPricePerUnit("");
      setDepartureLocation("");
      setDestinationLocation("");
      setEtaType("duration");
      setEtaValue("");
      setDeliveryStatus("in_storage");
      setShowForm(false);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to create listing" });
    } finally {
      setLoading(false);
    }
  };

  const selectedBlock = availableInventory?.availableBlocks.find(
    (block: any) => block.inventoryId === selectedInventory
  );

  const postingCost = farmcoinSettings?.farmcoinPostingCost ?? 1;
  const farmcoinBalance = farmcoinSummary?.balance ?? 0;
  const isVerified = (traderProfile as any)?.isVerifiedTrader && (traderProfile as any)?.verificationStatus === "verified";
  const canPost = isVerified && farmcoinBalance >= postingCost;

  const packagingOptionsByProduct: Record<string, string[]> = {
    maize: ["50kg bag", "25kg bag", "10kg bag", "Other"],
    beans: ["50kg bag", "25kg bag", "10kg bag", "Other"],
    cassava: ["Sack", "Crate", "Bundle", "Other"],
    bananas: ["Bunch", "Crate", "Box", "Other"],
    potatoes: ["50kg bag", "25kg bag", "Sack", "Other"],
    tomatoes: ["Crate", "Box", "Basket", "Other"],
    default: ["Bag", "Box", "Crate", "Other"],
  };

  const productKey = productName.trim().toLowerCase();
  const packagingOptions = packagingOptionsByProduct[productKey] || packagingOptionsByProduct.default;

  return (
    <div style={{
      padding: "clamp(1rem, 3vw, 1.5rem)",
      background: "#fff",
      borderRadius: "12px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      border: "1px solid #e0e0e0",
      marginBottom: "1.5rem"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, marginBottom: 0, fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", color: "#1a1a1a" }}>
          Create Listing
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: "0.5rem 1rem",
            background: showForm ? "#999" : "#1976d2",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "0.85rem",
            fontWeight: "600"
          }}
        >
          {showForm ? "Cancel" : "Create Listing"}
        </button>
      </div>

      {message && (
        <div style={{
          padding: "0.75rem",
          marginBottom: "1rem",
          background: message.type === "success" ? "#e8f5e9" : "#ffebee",
          borderRadius: "8px",
          border: `1px solid ${message.type === "success" ? "#4caf50" : "#ef5350"}`,
          color: message.type === "success" ? "#2e7d32" : "#c62828",
        }}>
          {message.text}
        </div>
      )}

      <div style={{
        marginBottom: "1rem",
        padding: "0.75rem",
        borderRadius: "8px",
        background: "#f1f5f9",
        border: "1px solid #e2e8f0",
        fontSize: "0.85rem",
        color: "#334155",
      }}>
        <div><strong>Verification:</strong> {isVerified ? "Verified" : "Not Verified"}</div>
        <div><strong>FarmCoin Balance:</strong> {farmcoinBalance} Token(s)</div>
        <div><strong>Posting Cost:</strong> {postingCost} Token(s)</div>
        {!isVerified && (
          <div style={{ marginTop: "0.35rem", color: "#b45309" }}>
            Posting is locked until Superadmin verifies your trader account.
          </div>
        )}
        {isVerified && farmcoinBalance < postingCost && (
          <div style={{ marginTop: "0.35rem", color: "#b45309" }}>
            Insufficient FarmCoin Tokens to post a listing.
          </div>
        )}
      </div>

      {!canPost && (
        <div style={{ marginBottom: "1rem" }}>
          <input
            type="text"
            placeholder="Reason for token request"
            value={requestReason}
            onChange={(e) => setRequestReason(e.target.value)}
            style={{
              width: "100%",
              padding: "0.65rem",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: "0.85rem",
              marginBottom: "0.5rem",
            }}
          />
          <button
            type="button"
            onClick={async () => {
              try {
                await requestFarmcoinTokens({
                  traderId: userId,
                  reason: requestReason || "Request FarmCoin tokens",
                });
                setMessage({ type: "success", text: "FarmCoin token request sent to Superadmin." });
                setRequestReason("");
              } catch (error: any) {
                setMessage({ type: "error", text: error.message || "Failed to request tokens" });
              }
            }}
            style={{
              padding: "0.6rem 1rem",
              background: "#0f172a",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            Request FarmCoin Tokens
          </button>
        </div>
      )}

      {showForm && (
        <div style={{
          marginBottom: "1rem",
          padding: "0.75rem",
          borderRadius: "8px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
        }}>
          <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Listing Source</div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <input
                type="radio"
                name="listingSource"
                value="farmer_inventory"
                checked={listingSource === "farmer_inventory"}
                onChange={() => setListingSource("farmer_inventory")}
              />
              Farmer-sourced inventory
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <input
                type="radio"
                name="listingSource"
                value="trader_sourced"
                checked={listingSource === "trader_sourced"}
                onChange={() => setListingSource("trader_sourced")}
              />
              Trader-sourced listing
            </label>
          </div>
        </div>
      )}

      {showForm && listingSource === "farmer_inventory" && (
        <div>
          {availableInventory === undefined ? (
            <p style={{ color: "#999" }}>Loading available inventory...</p>
          ) : availableInventory.availableBlocks.length === 0 ? (
            <p style={{ color: "#666" }}>
              No inventory lots available for listing. You need inventory in storage to create listings.
            </p>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
                  Select Inventory Lot:
                </label>
                <select
                  value={selectedInventory}
                  onChange={(e) => setSelectedInventory(e.target.value)}
                  disabled={loading}
                  required
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "0.9rem",
                    fontFamily: "inherit"
                  }}
                >
                  <option value="">-- Select an inventory lot --</option>
                  {availableInventory.availableBlocks.map((block: any) => (
                    <option key={block.inventoryId} value={block.inventoryId}>
                      {block.produceType} - {block.totalKilos}kg | Purchase Price: {formatUGX(block.unitPrice)}/kg | UTID: {block.utid.slice(-12)}
                    </option>
                  ))}
                </select>
                {selectedBlock && (
                  <div style={{ marginTop: "0.5rem", padding: "0.75rem", background: "#f5f5f5", borderRadius: "6px", fontSize: "0.85rem" }}>
                    <div><strong>Produce:</strong> {selectedBlock.produceType}</div>
                    <div><strong>Inventory Size:</strong> {selectedBlock.totalKilos}kg</div>
                    <div><strong>Your Purchase Price:</strong> {formatUGX(selectedBlock.unitPrice)}/kg</div>
                    <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "0.25rem", fontFamily: "monospace", wordBreak: "break-all" }}>
                      Inventory UTID: {selectedBlock.utid}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
                  Your Asking Price per Kilo (UGX):
                </label>
                <input
                  type="number"
                  value={pricePerKilo}
                  onChange={(e) => setPricePerKilo(e.target.value)}
                  placeholder={selectedBlock ? `Suggested: ${formatUGX(selectedBlock.unitPrice * 1.1)}/kg (10% markup)` : "Enter price per kilo"}
                  disabled={loading || !selectedInventory}
                  required
                  min="1"
                  step="1"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "0.9rem",
                    fontFamily: "inherit"
                  }}
                />
                {selectedBlock && pricePerKilo && !isNaN(parseFloat(pricePerKilo)) && (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#666" }}>
                    Total Lot Value: {formatUGX(parseFloat(pricePerKilo) * (selectedBlock?.totalKilos || 0))} ({selectedBlock?.totalKilos || 0}kg × {formatUGX(parseFloat(pricePerKilo))}/kg)
                  </div>
                )}
              </div>

              <div style={{ padding: "0.75rem", background: "#fff3cd", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.85rem", color: "#856404" }}>
                <strong>⚠️ Important:</strong> Posting a listing costs {postingCost} FarmCoin Token(s). Listings use your full inventory lot size.
              </div>

              <button
                type="submit"
                disabled={loading || !selectedInventory || !pricePerKilo || !canPost}
                style={{
                  width: "100%",
                  padding: "0.75rem 1.5rem",
                  background: loading || !selectedInventory || !pricePerKilo || !canPost ? "#ccc" : "#28a745",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: loading || !selectedInventory || !pricePerKilo || !canPost ? "not-allowed" : "pointer",
                  fontSize: "1rem",
                  fontWeight: "600"
                }}
              >
                {loading ? "Creating Listing..." : "Create Inventory Listing"}
              </button>
            </form>
          )}
        </div>
      )}

      {showForm && listingSource === "trader_sourced" && (
        <form onSubmit={handleTraderSourcedSubmit}>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <input
              type="text"
              placeholder="Product"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "0.9rem",
              }}
            />

            <div style={{ display: "grid", gap: "0.5rem" }}>
              <label style={{ fontWeight: 600 }}>Packaging type</label>
              <select
                value={packagingTypeEnum}
                onChange={(e) => setPackagingTypeEnum(e.target.value)}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "0.9rem",
                }}
              >
                <option value="">Select packaging</option>
                {packagingOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {packagingTypeEnum === "Other" && (
                <input
                  type="text"
                  placeholder="Custom packaging type"
                  value={packagingTypeCustom}
                  onChange={(e) => setPackagingTypeCustom(e.target.value)}
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "0.9rem",
                  }}
                />
              )}
            </div>

            <input
              type="number"
              min="1"
              placeholder="Total units available"
              value={totalUnitsAvailable}
              onChange={(e) => setTotalUnitsAvailable(e.target.value)}
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "0.9rem",
              }}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <select
                value={pricingUnit}
                onChange={(e) => setPricingUnit(e.target.value as any)}
                disabled={loading}
                style={{
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "0.9rem",
                }}
              >
                <option value="per_package">Per package</option>
                <option value="per_kg">Per kg</option>
              </select>
              <input
                type="number"
                min="1"
                placeholder="Price per unit (UGX)"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                disabled={loading}
                style={{
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "0.9rem",
                }}
              />
            </div>

            <input
              type="text"
              placeholder="Departure location"
              value={departureLocation}
              onChange={(e) => setDepartureLocation(e.target.value)}
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "0.9rem",
              }}
            />

            <input
              type="text"
              placeholder="Destination location"
              value={destinationLocation}
              onChange={(e) => setDestinationLocation(e.target.value)}
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "0.9rem",
              }}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <select
                value={etaType}
                onChange={(e) => {
                  setEtaType(e.target.value as any);
                  setEtaValue("");
                }}
                disabled={loading}
                style={{
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "0.9rem",
                }}
              >
                <option value="duration">ETA (hours)</option>
                <option value="arrival_time">Arrival time</option>
              </select>
              {etaType === "duration" ? (
                <input
                  type="number"
                  min="1"
                  placeholder="Hours"
                  value={etaValue}
                  onChange={(e) => setEtaValue(e.target.value)}
                  disabled={loading}
                  style={{
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "0.9rem",
                  }}
                />
              ) : (
                <input
                  type="datetime-local"
                  value={etaValue}
                  onChange={(e) => setEtaValue(e.target.value)}
                  disabled={loading}
                  style={{
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "0.9rem",
                  }}
                />
              )}
            </div>

            <select
              value={deliveryStatus}
              onChange={(e) => setDeliveryStatus(e.target.value as any)}
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "0.9rem",
              }}
            >
              <option value="in_storage">In storage</option>
              <option value="in_transit">In transit</option>
            </select>
          </div>

          <div style={{ padding: "0.75rem", background: "#fff3cd", borderRadius: "6px", marginTop: "1rem", fontSize: "0.85rem", color: "#856404" }}>
            <strong>⚠️ Important:</strong> Posting a listing costs {postingCost} FarmCoin Token(s).
          </div>

          <button
            type="submit"
            disabled={loading || !canPost}
            style={{
              width: "100%",
              marginTop: "1rem",
              padding: "0.75rem 1.5rem",
              background: loading || !canPost ? "#ccc" : "#28a745",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: loading || !canPost ? "not-allowed" : "pointer",
              fontSize: "1rem",
              fontWeight: "600",
            }}
          >
            {loading ? "Posting Listing..." : "Post Trader Listing"}
          </button>
        </form>
      )}
    </div>
  );
}
