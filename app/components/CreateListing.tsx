"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";

interface CreateListingProps {
  userId: Id<"users">;
  userRole?: "farmer" | "vendor" | "store";
}

export function CreateListing({ userId, userRole }: CreateListingProps) {
  const router = useRouter();
  const effectiveRole = userRole || "farmer";
  const isVendorOrStore = effectiveRole === "vendor" || effectiveRole === "store";
  const createListing = useMutation(api.listings.createListing);
  const qualityOptions = useQuery(api.listings.getActiveQualityOptions, {});
  const produceOptions = useQuery(api.listings.getActiveProduceOptions, {});
  const storageLocations = useQuery(api.listings.getActiveStorageLocations, {});
  const autoStorageLocation = useQuery(
    api.listings.getAutoStorageLocationForUser,
    isVendorOrStore ? { userId } : "skip"
  );
  const onboardingStatus = useQuery(api.farmerOnboarding.checkOnboardingStatus, { farmerId: userId });  // supports farmer/vendor/store
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const [listingMode, setListingMode] = useState<"unit" | "garden" | "packaging">("unit");
  const [gardenSizeMode, setGardenSizeMode] = useState<"acres" | "emiigo">("acres");
  const [formData, setFormData] = useState({
    produceType: "",
    totalKilos: "",
    pricePerKilo: "",
    qualityRating: "",
    qualityComment: "",
    storageLocationId: "" as string | "",
    // Garden mode fields
    gardenSize: "",
    gardenLength: "",
    gardenWidth: "",
    totalPrice: "",
    // Packaging mode fields
    packagingType: "",
    availableUnits: "",
    pricePerUnit: "",
  });

  // Check onboarding status
  useEffect(() => {
    if (onboardingStatus && !onboardingStatus.completed) {
      setMessage({
        type: "error",
        text: "Please complete your profile onboarding first. Click here to go to onboarding.",
      });
    }
  }, [onboardingStatus]);

  // Auto-set storage location for vendor/store users
  useEffect(() => {
    if (isVendorOrStore && autoStorageLocation?.storageLocationId) {
      setFormData((prev) => ({ ...prev, storageLocationId: autoStorageLocation.storageLocationId }));
    }
  }, [isVendorOrStore, autoStorageLocation]);

  const formatUGX = (amount: number) => {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(amount);
  };

  const getGardenSizeAcres = () => {
    if (gardenSizeMode === "acres") {
      return parseFloat(formData.gardenSize);
    }
    const length = parseFloat(formData.gardenLength);
    const width = parseFloat(formData.gardenWidth);
    if (isNaN(length) || isNaN(width)) {
      return NaN;
    }
    const sqftPerAcre = 43560;
    return (length * width) / sqftPerAcre;
  };

  // Filter produce types based on selected location
  const filteredProduceOptions = useMemo(() => {
    if (!produceOptions) return [];
    // Vendor/store: show all produce types even without storageLocationId
    if (isVendorOrStore && !formData.storageLocationId) {
      return produceOptions.filter((produce: any) => {
        if (!produce.allowedStorageLocationIds || produce.allowedStorageLocationIds.length === 0) {
          return true;
        }
        return true; // Show all for vendor/store without preset location
      });
    }
    if (!formData.storageLocationId || !storageLocations) {
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
  }, [formData.storageLocationId, produceOptions, storageLocations, isVendorOrStore]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check onboarding
    if (!onboardingStatus?.completed) {
      setMessage({
        type: "error",
        text: "Please complete your profile onboarding first.",
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      if (!formData.produceType.trim()) {
        setMessage({ type: "error", text: "Produce type is required" });
        setLoading(false);
        return;
      }

      if (!isVendorOrStore && !formData.storageLocationId) {
        setMessage({ type: "error", text: "Storage location is required" });
        setLoading(false);
        return;
      }

      // Packaging mode validation
      if (listingMode === "packaging") {
        const units = parseInt(formData.availableUnits);
        const ppu = parseFloat(formData.pricePerUnit);
        if (!formData.packagingType) {
          setMessage({ type: "error", text: "Packaging type is required" });
          setLoading(false);
          return;
        }
        if (isNaN(units) || units <= 0) {
          setMessage({ type: "error", text: "Number of units must be a positive number" });
          setLoading(false);
          return;
        }
        if (isNaN(ppu) || ppu <= 0) {
          setMessage({ type: "error", text: "Price per unit must be a positive number" });
          setLoading(false);
          return;
        }

        const result = await createListing({
          farmerId: userId,
          produceType: formData.produceType.trim(),
          listingMode: "packaging",
          packagingTypeEnum: formData.packagingType,
          availableUnits: units,
          pricingUnit: "per_package" as const,
          pricePerUnit: ppu,
          qualityRating: formData.qualityRating || undefined,
          qualityComment: formData.qualityComment.trim() || undefined,
          storageLocationId: formData.storageLocationId ? (formData.storageLocationId as any) : undefined,
        });

        setMessage({
          type: "success",
          text: `Listing created! UTID: ${result.utid}. ${result.totalUnits} ${formData.packagingType}(s) listed.`,
        });

        // Reset form
        setFormData({
          produceType: "", totalKilos: "", pricePerKilo: "", qualityRating: "", qualityComment: "",
          storageLocationId: "", gardenSize: "", gardenLength: "", gardenWidth: "", totalPrice: "",
          packagingType: "", availableUnits: "", pricePerUnit: "",
        });
        setListingMode("unit");
        setTimeout(() => { setShowForm(false); setMessage(null); }, 5000);
        setLoading(false);
        return;
      }

      let totalKilos: number;
      if (listingMode === "garden") {
        totalKilos = 1;
      } else {
        totalKilos = parseFloat(formData.totalKilos);
        if (isNaN(totalKilos) || totalKilos <= 0) {
          setMessage({ type: "error", text: "Total kilos must be a positive number" });
          setLoading(false);
          return;
        }
      }

      let pricePerKilo: number;
      let totalPrice: number | undefined;
      let gardenSize: number | undefined;
      let gardenDimensions: any | undefined;

      if (listingMode === "garden") {
        // Garden mode validation
        totalPrice = parseFloat(formData.totalPrice);
        if (isNaN(totalPrice) || totalPrice <= 0) {
          setMessage({ type: "error", text: "Total price is required for garden sale mode" });
          setLoading(false);
          return;
        }

        gardenSize = getGardenSizeAcres();
        if (isNaN(gardenSize) || gardenSize <= 0) {
          setMessage({
            type: "error",
            text: gardenSizeMode === "acres"
              ? "Garden size (acres) is required"
              : "Garden dimensions are required to calculate acres",
          });
          setLoading(false);
          return;
        }

        // Calculate price per kilo from total price (garden mode uses 1 unit)
        pricePerKilo = totalPrice / totalKilos;

        // Store garden dimensions when provided (emiigo mode)
        if (gardenSizeMode === "emiigo" && formData.gardenLength && formData.gardenWidth) {
          gardenDimensions = {
            length: parseFloat(formData.gardenLength),
            width: parseFloat(formData.gardenWidth),
            unit: "ft",
          };
        }
      } else {
        // Unit mode validation
        pricePerKilo = parseFloat(formData.pricePerKilo);
        if (isNaN(pricePerKilo) || pricePerKilo <= 0) {
          setMessage({ type: "error", text: "Price per kilo must be a positive number" });
          setLoading(false);
          return;
        }
      }

      const result = await createListing({
        farmerId: userId,
        produceType: formData.produceType.trim(),
        totalKilos,
        pricePerKilo,
        qualityRating: formData.qualityRating || undefined,
        qualityComment: formData.qualityComment.trim() || undefined,
        storageLocationId: formData.storageLocationId ? (formData.storageLocationId as any) : undefined,
        listingMode,
        gardenSize,
        gardenDimensions,
        totalPrice,
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
        gardenSize: "",
        gardenLength: "",
        gardenWidth: "",
        totalPrice: "",
        packagingType: "",
        availableUnits: "",
        pricePerUnit: "",
      });
      setListingMode("unit");
      setGardenSizeMode("acres");

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
            padding: "0.85rem 1.5rem",
            background: "#fbc02d",
            color: "#1a1a1a",
            border: "2px solid #000",
            borderRadius: "10px",
            cursor: "pointer",
            fontSize: "1.05rem",
            fontWeight: "700",
            width: "100%",
            textAlign: "center",
            boxShadow: "0 0 12px rgba(251, 192, 45, 0.7)",
            textTransform: "none",
          }}
        >
          Tunda Ebirime • Create New Listing
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
            setFormData({
              produceType: "",
              totalKilos: "",
              pricePerKilo: "",
              qualityRating: "",
              qualityComment: "",
              storageLocationId: "",
              gardenSize: "",
              gardenLength: "",
              gardenWidth: "",
              totalPrice: "",
              packagingType: "",
              availableUnits: "",
              pricePerUnit: "",
            });
            setListingMode("unit");
            setGardenSizeMode("acres");
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

      {!onboardingStatus?.completed && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1rem",
            background: "#fff3cd",
            borderRadius: "8px",
            border: "1px solid #ffc107",
          }}
        >
          <p style={{ margin: 0, color: "#856404" }}>
            Please complete your profile onboarding before creating listings.{" "}
            <button
              type="button"
              onClick={() => router.push(`/onboarding/${effectiveRole}`)}
              style={{
                background: "none",
                border: "none",
                color: "#0066cc",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Go to onboarding
            </button>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          
          {/* Listing Mode Selection */}
          {isVendorOrStore ? (
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
              Listing Mode *
            </label>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="listingMode"
                  value="unit"
                  checked={listingMode === "unit"}
                  onChange={() => setListingMode("unit")}
                />
                <span>By Weight (kilos)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="listingMode"
                  value="packaging"
                  checked={listingMode === "packaging"}
                  onChange={() => setListingMode("packaging")}
                />
                <span>By Packaging (crates, bags, bunches...)</span>
              </label>
            </div>
          </div>
          ) : (
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
              Listing Mode *
            </label>
            <div style={{ display: "flex", gap: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="listingMode"
                  value="unit"
                  checked={listingMode === "unit"}
                  onChange={(e) => setListingMode(e.target.value as "unit" | "garden")}
                />
                <span>Unit Sale (10kg units)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="listingMode"
                  value="garden"
                  checked={listingMode === "garden"}
                  onChange={(e) => setListingMode(e.target.value as "unit" | "garden")}
                />
                <span>Garden/Musiri Sale (Entire Plot)</span>
              </label>
            </div>
          </div>
          )}

          {/* STEP 1: Storage Location / Collection Point */}
          {isVendorOrStore ? (
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                Collection Location
              </label>
              {autoStorageLocation && autoStorageLocation.storageLocationId ? (
                <div style={{
                  padding: "0.75rem 1rem",
                  background: "#e8f5e9",
                  borderRadius: "8px",
                  border: "1px solid #81c784",
                  color: "#2e7d32",
                  fontSize: "0.95rem",
                  fontWeight: "500",
                }}>
                  📍 {autoStorageLocation.districtName} ({autoStorageLocation.code}) — your {effectiveRole === "vendor" ? "market" : "store"} location
                </div>
              ) : autoStorageLocation === undefined ? (
                <p style={{ color: "#999", fontSize: "0.9rem" }}>Loading your location...</p>
              ) : autoStorageLocation?.collectionText ? (
                <div style={{
                  padding: "0.75rem 1rem",
                  background: "#e8f5e9",
                  borderRadius: "8px",
                  border: "1px solid #81c784",
                  color: "#2e7d32",
                  fontSize: "0.95rem",
                  fontWeight: "500",
                }}>
                  📍 {autoStorageLocation.collectionText} — your registered {effectiveRole === "vendor" ? "market" : "store"} address
                </div>
              ) : (
                <div style={{
                  padding: "0.75rem 1rem",
                  background: "#e3f2fd",
                  borderRadius: "8px",
                  border: "1px solid #90caf9",
                  color: "#1565c0",
                  fontSize: "0.9rem",
                }}>
                  Your listing will be collected from your registered {effectiveRole === "vendor" ? "market" : "store"} address. You can update your address from your profile.
                </div>
              )}
              {/* Fallback picker when auto-match fails */}
              {autoStorageLocation === null && storageLocations && storageLocations.length > 0 && (
                <select
                  value={formData.storageLocationId}
                  onChange={(e) => setFormData({ ...formData, storageLocationId: e.target.value, produceType: "" })}
                  required
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "1rem",
                    background: "#fff",
                    marginTop: "0.5rem",
                  }}
                >
                  <option value="">-- Select collection location --</option>
                  {storageLocations.filter((loc: any) => loc.active).map((location) => (
                    <option key={location.locationId} value={location.locationId}>
                      {location.districtName} ({location.code})
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
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
          )}

          {/* STEP 2: Produce Type Selection (filtered by location) */}
          <div>
            <label style={{ display: "block", marginBottom: "0.75rem", fontWeight: "600", color: "#333" }}>
              Select Produce Type *
            </label>
            {!formData.storageLocationId && !isVendorOrStore ? (
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
                {(() => {
                  // Group produce options by category
                  const grouped: Record<string, typeof filteredProduceOptions> = {};
                  filteredProduceOptions.forEach((p) => {
                    const cat = (p as any).category || "Other";
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(p);
                  });
                  const categories = Object.keys(grouped);
                  return categories.map((cat) => (
                    <div key={cat} style={{ marginBottom: "1rem" }}>
                      <p style={{ fontWeight: "600", fontSize: "0.85rem", color: "#555", marginBottom: "0.5rem" }}>{cat}</p>
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
                        gap: "0.75rem",
                      }}>
                        {grouped[cat].map((produce) => (
                          <button
                            key={produce.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, produceType: produce.value })}
                            style={{
                              padding: "0.75rem 0.5rem",
                              background: formData.produceType === produce.value ? "#e8f5e9" : "#f5f5f5",
                              border: `2px solid ${formData.produceType === produce.value ? "#4caf50" : "#e0e0e0"}`,
                              borderRadius: "12px",
                              cursor: "pointer",
                              fontSize: "1.75rem",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "0.25rem",
                              transition: "all 0.2s"
                            }}
                          >
                            <span>{produce.icon}</span>
                            <span style={{ fontSize: "0.7rem", color: "#666" }}>{produce.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
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

          {listingMode !== "garden" && listingMode !== "packaging" && (
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
          )}

          {listingMode === "packaging" ? (
            <>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                  Packaging Type *
                </label>
                <select
                  value={formData.packagingType}
                  onChange={(e) => setFormData({ ...formData, packagingType: e.target.value })}
                  required
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "1rem", background: "#fff" }}
                >
                  <option value="">Select packaging type</option>
                  <option value="crate">Crate</option>
                  <option value="bag">Bag (50kg)</option>
                  <option value="bunch">Bunch</option>
                  <option value="basket">Basket</option>
                  <option value="tin">Tin / Debe</option>
                  <option value="sack">Sack</option>
                  <option value="bundle">Bundle</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                  Number of Units Available *
                </label>
                <input
                  type="number"
                  value={formData.availableUnits}
                  onChange={(e) => setFormData({ ...formData, availableUnits: e.target.value })}
                  placeholder="e.g., 10, 25, 50"
                  min="1"
                  step="1"
                  required
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "1rem" }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                  Price Per {formData.packagingType || "Unit"} (UGX) *
                </label>
                <input
                  type="number"
                  value={formData.pricePerUnit}
                  onChange={(e) => setFormData({ ...formData, pricePerUnit: e.target.value })}
                  placeholder="e.g., 50000, 100000"
                  min="1"
                  step="1"
                  required
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "1rem" }}
                />
                {formData.availableUnits && formData.pricePerUnit && (
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                    Total Value: {formatUGX(parseInt(formData.availableUnits) * parseFloat(formData.pricePerUnit))}
                  </p>
                )}
              </div>
            </>
          ) : listingMode === "garden" ? (
            <>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                  Measurement Mode *
                </label>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="gardenSizeMode"
                      value="acres"
                      checked={gardenSizeMode === "acres"}
                      onChange={() => {
                        setGardenSizeMode("acres");
                        setFormData({ ...formData, gardenLength: "", gardenWidth: "" });
                      }}
                    />
                    <span>Acres (standard)</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="gardenSizeMode"
                      value="emiigo"
                      checked={gardenSizeMode === "emiigo"}
                      onChange={() => {
                        setGardenSizeMode("emiigo");
                        setFormData({ ...formData, gardenSize: "" });
                      }}
                    />
                    <span>Emiigo (Length × Width)</span>
                  </label>
                </div>
              </div>

              {gardenSizeMode === "acres" ? (
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                    Garden Size (Acres) *
                  </label>
                  <input
                    type="number"
                    value={formData.gardenSize}
                    onChange={(e) => setFormData({ ...formData, gardenSize: e.target.value })}
                    placeholder="e.g., 0.5, 1.0, 2.5"
                    min="0.01"
                    step="0.01"
                    required={gardenSizeMode === "acres"}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "6px",
                      fontSize: "1rem",
                    }}
                  />
                </div>
              ) : (
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                    Garden Dimensions (Emiigo) *
                  </label>
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <input
                      type="number"
                      value={formData.gardenLength}
                      onChange={(e) => setFormData({ ...formData, gardenLength: e.target.value })}
                      placeholder="Length (ft)"
                      min="0.01"
                      step="0.01"
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        border: "1px solid #ddd",
                        borderRadius: "6px",
                        fontSize: "1rem",
                      }}
                    />
                    <input
                      type="number"
                      value={formData.gardenWidth}
                      onChange={(e) => setFormData({ ...formData, gardenWidth: e.target.value })}
                      placeholder="Width (ft)"
                      min="0.01"
                      step="0.01"
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        border: "1px solid #ddd",
                        borderRadius: "6px",
                        fontSize: "1rem",
                      }}
                    />
                  </div>
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                    Estimated size: {isNaN(getGardenSizeAcres()) ? "—" : `${getGardenSizeAcres().toFixed(2)} acres`}
                  </p>
                </div>
              )}
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                  Total Price for Entire Garden (UGX) *
                </label>
                <input
                  type="number"
                  value={formData.totalPrice}
                  onChange={(e) => setFormData({ ...formData, totalPrice: e.target.value })}
                  placeholder="e.g., 500000, 1000000"
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
                {formData.totalPrice && (
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                    Total price: {formatUGX(parseFloat(formData.totalPrice))}
                  </p>
                )}
              </div>
            </>
          ) : (
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
          )}


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
              disabled={loading || (!isVendorOrStore && !formData.storageLocationId) || !formData.produceType || !onboardingStatus?.completed}
              style={{
                padding: "0.75rem 1.5rem",
                background: loading || (!isVendorOrStore && !formData.storageLocationId) || !formData.produceType || !onboardingStatus?.completed ? "#ccc" : "#4caf50",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: loading || (!isVendorOrStore && !formData.storageLocationId) || !formData.produceType || !onboardingStatus?.completed ? "not-allowed" : "pointer",
                fontSize: "1rem",
                fontWeight: "600",
              }}
            >
              {loading ? "Creating..." : listingMode === "garden" ? "Create Garden Listing" : listingMode === "packaging" ? "Create Packaging Listing" : "Create Listing"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setMessage(null);
                setFormData({
                  produceType: "",
                  totalKilos: "",
                  pricePerKilo: "",
                  qualityRating: "",
                  qualityComment: "",
                  storageLocationId: "",
                  gardenSize: "",
                  gardenLength: "",
                  gardenWidth: "",
                  totalPrice: "",
                  packagingType: "",
                  availableUnits: "",
                  pricePerUnit: "",
                });
                setListingMode("unit");
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
