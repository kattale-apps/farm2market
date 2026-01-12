"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useMemo } from "react";

interface CreateListingProps {
  userId: Id<"users">;
}

export function CreateListing({ userId }: CreateListingProps) {
  const createListing = useMutation(api.listings.createListing);
  const qualityOptions = useQuery(api.listings.getActiveQualityOptions, {});
  const produceOptions = useQuery(api.listings.getActiveProduceOptions, {});
  const storageLocations = useQuery(api.listings.getActiveStorageLocations, {});
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const [formData, setFormData] = useState({
    produceType: "",
    totalKilos: "",
    pricePerKilo: "",
    qualityRating: "",
    qualityComment: "",
    storageLocationId: "" as string | "",
  });

  const formatUGX = (amount: number) => {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(amount);
  };

  // Filter produce types based on selected location
  const filteredProduceOptions = useMemo(() => {
    if (!formData.storageLocationId || !produceOptions || !storageLocations) {
      return [];
    }
    
    // Find produce types that allow this location
    return produceOptions.filter((produce: any) => {
      // If produce has no location restrictions, it's allowed everywhere
      if (!produce.allowedStorageLocationIds || produce.allowedStorageLocationIds.length === 0) {
        return true;
      }
      
      // Check if this location is in the allowed list
      return produce.allowedStorageLocationIds.includes(formData.storageLocationId);
    });
  }, [formData.storageLocationId, produceOptions, storageLocations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const totalKilos = parseFloat(formData.totalKilos);
      const pricePerKilo = parseFloat(formData.pricePerKilo);

      if (isNaN(totalKilos) || totalKilos <= 0) {
        setMessage({ type: "error", text: "Total kilos must be a positive number" });
        setLoading(false);
        return;
      }

      if (isNaN(pricePerKilo) || pricePerKilo <= 0) {
        setMessage({ type: "error", text: "Price per kilo must be a positive number" });
        setLoading(false);
        return;
      }

      if (!formData.produceType.trim()) {
        setMessage({ type: "error", text: "Produce type is required" });
        setLoading(false);
        return;
      }

      if (!formData.storageLocationId) {
        setMessage({ type: "error", text: "Storage location is required" });
        setLoading(false);
        return;
      }

      const result = await createListing({
        farmerId: userId,
        produceType: formData.produceType.trim(),
        totalKilos,
        pricePerKilo,
        qualityRating: formData.qualityRating || undefined,
        qualityComment: formData.qualityComment.trim() || undefined,
        storageLocationId: formData.storageLocationId as any,
      });

      setMessage({
        type: "success",
        text: `Listing created successfully! UTID: ${result.utid}. ${result.totalUnits} unit(s) created.`,
      });

      // Reset form
      setFormData({
        produceType: "",
        totalKilos: "",
        pricePerKilo: "",
        qualityRating: "",
        qualityComment: "",
        storageLocationId: "",
      });

      // Hide form after success
      setTimeout(() => {
        setShowForm(false);
        setMessage(null);
      }, 5000);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: `Failed to create listing: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!showForm) {
    return (
      <div style={{ marginBottom: "2rem" }}>
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#4caf50",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "1rem",
            fontWeight: "600",
          }}
        >
          + Create New Listing
        </button>
      </div>
    );
  }

  return (
    <div style={{
      marginBottom: "2rem",
      padding: "1.5rem",
      background: "#fff",
      borderRadius: "12px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      border: "1px solid #e0e0e0"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0, fontSize: "1.3rem", color: "#1a1a1a" }}>
          Create New Listing
        </h3>
        <button
          onClick={() => {
            setShowForm(false);
            setMessage(null);
            setFormData({ produceType: "", totalKilos: "", pricePerKilo: "", qualityRating: "", qualityComment: "", storageLocationId: "" });
          }}
          style={{
            padding: "0.5rem 1rem",
            background: "#f5f5f5",
            border: "1px solid #ddd",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          Cancel
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1rem",
            background: message.type === "success" ? "#e8f5e9" : "#ffebee",
            borderRadius: "8px",
            border: `1px solid ${message.type === "success" ? "#4caf50" : "#ef5350"}`,
            color: message.type === "success" ? "#2e7d32" : "#c62828",
          }}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          
          {/* STEP 1: Storage Location Selection (FIRST) */}
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
              Select Delivery Location (District) *
            </label>
            <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.75rem" }}>
              Choose the storage location where you will deliver your produce
            </p>
            {storageLocations === undefined ? (
              <p style={{ color: "#999", fontSize: "0.9rem" }}>Loading storage locations...</p>
            ) : storageLocations.length === 0 ? (
              <p style={{ color: "#666", fontSize: "0.9rem", padding: "1rem", background: "#fff3cd", borderRadius: "6px" }}>
                No storage locations available. Please contact admin to add storage locations.
              </p>
            ) : (
              <select
                value={formData.storageLocationId}
                onChange={(e) => {
                  // Clear produce type when location changes
                  setFormData({ ...formData, storageLocationId: e.target.value, produceType: "" });
                }}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                  background: "#fff",
                }}
              >
                <option value="">-- Select storage location --</option>
                {storageLocations.filter((loc: any) => loc.active).map((location) => (
                  <option key={location.locationId} value={location.locationId}>
                    {location.districtName} ({location.code})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* STEP 2: Produce Type Selection (filtered by location) */}
          <div>
            <label style={{ display: "block", marginBottom: "0.75rem", fontWeight: "600", color: "#333" }}>
              Select Produce Type *
            </label>
            {!formData.storageLocationId ? (
              <p style={{ color: "#666", fontSize: "0.9rem", padding: "1rem", background: "#fff3cd", borderRadius: "6px" }}>
                Please select a storage location first to see available produce types.
              </p>
            ) : produceOptions === undefined ? (
              <p style={{ color: "#999", fontSize: "0.9rem" }}>Loading produce options...</p>
            ) : filteredProduceOptions.length === 0 ? (
              <p style={{ color: "#d32f2f", fontSize: "0.9rem", padding: "1rem", background: "#ffebee", borderRadius: "6px" }}>
                No produce types available for the selected location. Please contact admin or select a different location.
              </p>
            ) : (
              <>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
                  gap: "1rem",
                  marginBottom: "1rem"
                }}>
                  {filteredProduceOptions.map((produce) => (
                    <button
                      key={produce.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, produceType: produce.value })}
                      style={{
                        padding: "1rem",
                        background: formData.produceType === produce.value ? "#e8f5e9" : "#f5f5f5",
                        border: `2px solid ${formData.produceType === produce.value ? "#4caf50" : "#e0e0e0"}`,
                        borderRadius: "12px",
                        cursor: "pointer",
                        fontSize: "2rem",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "0.5rem",
                        transition: "all 0.2s"
                      }}
                    >
                      <span>{produce.icon}</span>
                      <span style={{ fontSize: "0.75rem", color: "#666" }}>{produce.label}</span>
                    </button>
                  ))}
                </div>
                {/* Fallback text input for other produce types */}
                <input
                  type="text"
                  value={formData.produceType}
                  onChange={(e) => setFormData({ ...formData, produceType: e.target.value })}
                  placeholder="Or type another produce type..."
                  required
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "1rem",
                  }}
                />
                {formData.storageLocationId && filteredProduceOptions.length > 0 && (
                  <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "0.5rem" }}>
                    {filteredProduceOptions.length} produce type(s) available for selected location
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
              Total Kilos *
            </label>
            <input
              type="number"
              value={formData.totalKilos}
              onChange={(e) => setFormData({ ...formData, totalKilos: e.target.value })}
              placeholder="e.g., 50, 100, 150"
              min="0.1"
              step="0.1"
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            />
            <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
              You can list any amount of kilos. Units will be created automatically (10kg each, or less if total is under 10kg).
            </p>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
              Price Per Kilo (UGX) *
            </label>
            <input
              type="number"
              value={formData.pricePerKilo}
              onChange={(e) => setFormData({ ...formData, pricePerKilo: e.target.value })}
              placeholder="e.g., 2000, 3000, 5000"
              min="1"
              step="1"
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
              }}
            />
            {formData.totalKilos && formData.pricePerKilo && (
              <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                Total Value: {formatUGX(parseFloat(formData.totalKilos || "0") * parseFloat(formData.pricePerKilo || "0"))}
              </p>
            )}
          </div>


          {/* Quality Rating Dropdown */}
          {qualityOptions && qualityOptions.length > 0 && (
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                Produce Quality Rating
              </label>
              <select
                value={formData.qualityRating}
                onChange={(e) => setFormData({ ...formData, qualityRating: e.target.value })}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                  background: "#fff",
                }}
              >
                <option value="">-- Select quality rating (optional) --</option>
                {qualityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quality Comment */}
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
              Quality Comment (Optional)
            </label>
            <textarea
              value={formData.qualityComment}
              onChange={(e) => setFormData({ ...formData, qualityComment: e.target.value })}
              placeholder="Add any comments about the quality of your produce..."
              rows={4}
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem",
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />
            <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
              Describe the quality, freshness, or any special characteristics of your produce.
            </p>
          </div>

          <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
            <button
              type="submit"
              disabled={loading || !formData.storageLocationId || !formData.produceType}
              style={{
                padding: "0.75rem 1.5rem",
                background: loading || !formData.storageLocationId || !formData.produceType ? "#ccc" : "#4caf50",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: loading || !formData.storageLocationId || !formData.produceType ? "not-allowed" : "pointer",
                fontSize: "1rem",
                fontWeight: "600",
              }}
            >
              {loading ? "Creating..." : "Create Listing"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setMessage(null);
                setFormData({ produceType: "", totalKilos: "", pricePerKilo: "", qualityRating: "", qualityComment: "", storageLocationId: "" });
              }}
              style={{
                padding: "0.75rem 1.5rem",
                background: "#f5f5f5",
                border: "1px solid #ddd",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "1rem",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
