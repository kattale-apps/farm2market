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
  const availableInventory = useQuery(api.listings.getTraderAvailableInventoryForListing, { traderId: userId });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedInventory, setSelectedInventory] = useState<string>("");
  const [pricePerKilo, setPricePerKilo] = useState<string>("");

  const formatUGX = (amount: number) => {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedInventory) {
      setMessage({ type: "error", text: "Please select an inventory block" });
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
        text: `Listing created successfully! UTID: ${result.utid}. Your 100kg block is now available for buyers.`,
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

  const selectedBlock = availableInventory?.availableBlocks.find(
    (block: any) => block.inventoryId === selectedInventory
  );

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
          Create Listing from Inventory
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

      {showForm && (
        <div>
          {availableInventory === undefined ? (
            <p style={{ color: "#999" }}>Loading available inventory...</p>
          ) : availableInventory.availableBlocks.length === 0 ? (
            <p style={{ color: "#666" }}>
              No 100kg inventory blocks available for listing. You need to have 100kg blocks in storage to create listings.
            </p>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#1a1a1a" }}>
                  Select 100kg Inventory Block:
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
                  <option value="">-- Select a 100kg block --</option>
                  {availableInventory.availableBlocks.map((block: any) => (
                    <option key={block.inventoryId} value={block.inventoryId}>
                      {block.produceType} - {block.totalKilos}kg | Purchase Price: {formatUGX(block.unitPrice)}/kg | UTID: {block.utid.slice(-12)}
                    </option>
                  ))}
                </select>
                {selectedBlock && (
                  <div style={{ marginTop: "0.5rem", padding: "0.75rem", background: "#f5f5f5", borderRadius: "6px", fontSize: "0.85rem" }}>
                    <div><strong>Produce:</strong> {selectedBlock.produceType}</div>
                    <div><strong>Block Size:</strong> {selectedBlock.totalKilos}kg (100kg block)</div>
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
                    Total Block Value: {formatUGX(parseFloat(pricePerKilo) * 100)} (100kg × {formatUGX(parseFloat(pricePerKilo))}/kg)
                  </div>
                )}
              </div>

              <div style={{ padding: "0.75rem", background: "#fff3cd", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.85rem", color: "#856404" }}>
                <strong>⚠️ Important:</strong> Traders can only list in 100kg blocks. This listing will be for exactly 100kg.
              </div>

              <button
                type="submit"
                disabled={loading || !selectedInventory || !pricePerKilo}
                style={{
                  width: "100%",
                  padding: "0.75rem 1.5rem",
                  background: loading || !selectedInventory || !pricePerKilo ? "#ccc" : "#28a745",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: loading || !selectedInventory || !pricePerKilo ? "not-allowed" : "pointer",
                  fontSize: "1rem",
                  fontWeight: "600"
                }}
              >
                {loading ? "Creating Listing..." : "Create 100kg Block Listing"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
