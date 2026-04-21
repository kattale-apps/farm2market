"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FarmCoinReward, FarmCoinVideoPreloader } from "./FarmCoinAnimation";

interface CreateListingProps {
  userId: Id<"users">;
  userRole?: "farmer" | "vendor" | "store";
}

export function CreateListing({ userId, userRole }: CreateListingProps) {
  const router = useRouter();
  const effectiveRole = userRole || "farmer";
  const isVendorOrStore = effectiveRole === "vendor" || effectiveRole === "store";
  const createListing = useMutation(api.listings.createListing);
  const submitVendorPrice = useMutation((api as any).marketPrices.submitVendorPrice);
  const qualityOptions = useQuery(api.listings.getActiveQualityOptions, {});
  const produceOptions = useQuery(api.listings.getActiveProduceOptions, {});
  const storageLocations = useQuery(api.listings.getActiveStorageLocations, {});
  const autoStorageLocation = useQuery(
    api.listings.getAutoStorageLocationForUser,
    isVendorOrStore ? { userId } : "skip"
  );
  const onboardingStatus = useQuery(api.farmerOnboarding.checkOnboardingStatus, { farmerId: userId });  // supports farmer/vendor/store
  const recentCommodities = useQuery(
    api.marketPrices.getVendorRecentCommodities,
    isVendorOrStore ? { userId } : "skip"
  );
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const [listingMode, setListingMode] = useState<"unit" | "garden" | "packaging">("unit");
  const [gardenSizeMode, setGardenSizeMode] = useState<"acres" | "emiigo">("acres");

  // ── Vendor daily price form ───────────────────────────────────────────────
  const [showPriceForm, setShowPriceForm] = useState(false);
  const [priceFormData, setPriceFormData] = useState({
    commodity: "", unit: "kg", priceUGX: "", marketName: "", marketType: "",
  });
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceMessage, setPriceMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showCoinAnim, setShowCoinAnim] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);

  // ── Custom products & packaging (vendor/store, persisted in localStorage) ─
  const CUSTOM_PRODUCTS_KEY = `f2m_vendor_custom_products_${userId}`;
  const CUSTOM_PACKAGING_KEY = `f2m_vendor_custom_packaging_${userId}`;

  const [customProducts, setCustomProducts] = useState<{ emoji: string; name: string }[]>([]);
  const [customPackagingList, setCustomPackagingList] = useState<string[]>([]);
  const [showAddCustomProduct, setShowAddCustomProduct] = useState(false);
  const [customProductEmoji, setCustomProductEmoji] = useState("🌿");
  const [customProductName, setCustomProductName] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [customPackagingInput, setCustomPackagingInput] = useState("");

  const FOOD_EMOJIS = [
    "🌽","🍅","🥬","🥕","🧅","🧄","🫛","🫘","🌶️","🥦",
    "🍆","🎃","🥔","🍠","🌾","🍌","🍍","🥭","🍊","🍋",
    "🍇","🍓","🫐","🥝","🍈","🥑","🥚","🍗","🥩","🐟",
    "🥛","🧈","☕","🍵","🍯","🫒","🌰","🥜","🌻","🌿",
  ];

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

  // Load custom products and packaging from localStorage
  useEffect(() => {
    if (!isVendorOrStore) return;
    try {
      const p = localStorage.getItem(CUSTOM_PRODUCTS_KEY);
      if (p) setCustomProducts(JSON.parse(p));
    } catch {}
    try {
      const k = localStorage.getItem(CUSTOM_PACKAGING_KEY);
      if (k) setCustomPackagingList(JSON.parse(k));
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVendorOrStore]);

  // Auto-fill market name from vendor profile
  useEffect(() => {
    if (isVendorOrStore && autoStorageLocation?.collectionText) {
      const ct = autoStorageLocation.collectionText;
      setPriceFormData((prev) => ({ ...prev, marketName: prev.marketName || ct }));
    }
  }, [isVendorOrStore, autoStorageLocation]);

  const saveCustomProduct = (emoji: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCustomProducts((prev) => {
      const exists = prev.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());
      if (exists) return prev;
      const next = [{ emoji, name: trimmed }, ...prev].slice(0, 20);
      try { localStorage.setItem(CUSTOM_PRODUCTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const saveCustomPackaging = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    setCustomPackagingList((prev) => {
      const exists = prev.some((p) => p.toLowerCase() === trimmed.toLowerCase());
      if (exists) return prev;
      const next = [trimmed, ...prev].slice(0, 10);
      try { localStorage.setItem(CUSTOM_PACKAGING_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

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

  const handlePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(priceFormData.priceUGX);
    if (!priceFormData.commodity.trim()) {
      setPriceMessage({ type: "error", text: "Commodity name is required" });
      return;
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      setPriceMessage({ type: "error", text: "Please enter a valid price" });
      return;
    }
    if (!priceFormData.marketName.trim()) {
      setPriceMessage({ type: "error", text: "Market name is required" });
      return;
    }
    setPriceLoading(true);
    setPriceMessage(null);
    try {
      const result = await submitVendorPrice({
        userId,
        commodity: priceFormData.commodity.trim(),
        unit: priceFormData.unit.trim() || "kg",
        priceUGX: priceNum,
        marketName: priceFormData.marketName.trim(),
        marketType: priceFormData.marketType.trim() || undefined,
      });
      setCoinsEarned(result.coinsEarned);
      setShowCoinAnim(true);
      // Keep market name for next entry, reset the rest
      setPriceFormData((prev) => ({ commodity: "", unit: "kg", priceUGX: "", marketName: prev.marketName, marketType: "" }));
      setTimeout(() => { setShowPriceForm(false); }, 4000);
    } catch (err: any) {
      setPriceMessage({ type: "error", text: err?.message || "Failed to submit price" });
    } finally {
      setPriceLoading(false);
    }
  };

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

        const isCustomPkg = formData.packagingType === "__custom__";
        if (isCustomPkg && !customPackagingInput.trim()) {
          setMessage({ type: "error", text: "Please enter your custom packaging type" });
          setLoading(false);
          return;
        }
        if (isCustomPkg) saveCustomPackaging(customPackagingInput.trim());

        const result = await createListing({
          farmerId: userId,
          produceType: formData.produceType.trim(),
          listingMode: "packaging",
          packagingTypeEnum: isCustomPkg ? undefined : formData.packagingType,
          packagingTypeCustom: isCustomPkg ? customPackagingInput.trim() : undefined,
          availableUnits: units,
          pricingUnit: "per_package" as const,
          pricePerUnit: ppu,
          qualityRating: formData.qualityRating || undefined,
          qualityComment: formData.qualityComment.trim() || undefined,
          storageLocationId: formData.storageLocationId ? (formData.storageLocationId as any) : undefined,
        });

        const displayPkg = isCustomPkg ? customPackagingInput.trim() : formData.packagingType;
        setMessage({
          type: "success",
          text: `Listing created! UTID: ${result.utid}. ${result.totalUnits} ${displayPkg}(s) listed.`,
        });

        // Reset form
        setFormData({
          produceType: "", totalKilos: "", pricePerKilo: "", qualityRating: "", qualityComment: "",
          storageLocationId: "", gardenSize: "", gardenLength: "", gardenWidth: "", totalPrice: "",
          packagingType: "", availableUnits: "", pricePerUnit: "",
        });
        setCustomPackagingInput("");
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

  if (!showForm && !showPriceForm) {
    return (
      <div style={{ marginBottom: "2rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {showCoinAnim && (
          <FarmCoinReward coinsEarned={coinsEarned} onDone={() => setShowCoinAnim(false)} />
        )}
        <FarmCoinVideoPreloader />
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
        {isVendorOrStore && (
          <button
            onClick={() => setShowPriceForm(true)}
            style={{
              padding: "0.85rem 1.5rem",
              background: "#e3f2fd",
              color: "#1565c0",
              border: "2px solid #1565c0",
              borderRadius: "10px",
              cursor: "pointer",
              fontSize: "1.05rem",
              fontWeight: "700",
              width: "100%",
              textAlign: "center",
            }}
          >
            📊 Submit Today's Market Price
          </button>
        )}
      </div>
    );
  }

  if (showPriceForm) {
    return (
      <div style={{
        marginBottom: "2rem",
        padding: "1.5rem",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #90caf9",
      }}>
        {showCoinAnim && (
          <FarmCoinReward coinsEarned={coinsEarned} onDone={() => setShowCoinAnim(false)} />
        )}
        <FarmCoinVideoPreloader />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#1565c0" }}>📊 Submit Today's Market Price</h3>
          <button
            type="button"
            onClick={() => { setShowPriceForm(false); setPriceMessage(null); }}
            style={{ padding: "0.5rem 1rem", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: "6px", cursor: "pointer", fontSize: "0.9rem" }}
          >
            Cancel
          </button>
        </div>
        <p style={{ fontSize: "0.85rem", color: "#555", marginBottom: "1rem" }}>
          Report a commodity price at your market today. You earn 🪙 FarmCoins for each submission!
        </p>

        {priceMessage && (
          <div style={{
            padding: "0.85rem 1rem",
            marginBottom: "1rem",
            background: priceMessage.type === "success" ? "#e8f5e9" : "#ffebee",
            border: `1px solid ${priceMessage.type === "success" ? "#4caf50" : "#ef5350"}`,
            borderRadius: "8px",
            color: priceMessage.type === "success" ? "#2e7d32" : "#c62828",
          }}>
            {priceMessage.text}
          </div>
        )}

        <form onSubmit={handlePriceSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {customProducts.length > 0 && (
              <div>
                <p style={{ fontSize: "0.8rem", color: "#555", marginBottom: "0.4rem", fontWeight: "600" }}>⭐ My saved products</p>
                <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
                  {customProducts.map((cp) => {
                    const val = `${cp.emoji} ${cp.name}`;
                    return (
                      <button
                        key={cp.name}
                        type="button"
                        onClick={() => setPriceFormData((prev) => ({ ...prev, commodity: val }))}
                        style={{
                          flexShrink: 0,
                          padding: "0.45rem 0.8rem",
                          background: priceFormData.commodity === val ? "#e3f2fd" : "#fff8e1",
                          border: `1.5px solid ${priceFormData.commodity === val ? "#1565c0" : "#f9a825"}`,
                          borderRadius: "20px",
                          cursor: "pointer",
                          fontSize: "0.82rem",
                          fontWeight: priceFormData.commodity === val ? "600" : "400",
                          color: priceFormData.commodity === val ? "#1565c0" : "#333",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cp.emoji} {cp.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                Commodity *
              </label>
              <input
                type="text"
                value={priceFormData.commodity}
                onChange={(e) => setPriceFormData((prev) => ({ ...prev, commodity: e.target.value }))}
                placeholder="e.g. Tomatoes, Maize, Bananas..."
                required
                style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "1rem" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                  Unit *
                </label>
                <select
                  value={priceFormData.unit}
                  onChange={(e) => setPriceFormData((prev) => ({ ...prev, unit: e.target.value }))}
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "1rem", background: "#fff" }}
                >
                  <option value="kg">kg</option>
                  <option value="crate">Crate</option>
                  <option value="bunch">Bunch</option>
                  <option value="basket">Basket</option>
                  <option value="bag">Bag (50kg)</option>
                  <option value="tin">Tin / Debe</option>
                  <option value="sack">Sack</option>
                  <option value="bundle">Bundle</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                  Price (UGX) *
                </label>
                <input
                  type="number"
                  value={priceFormData.priceUGX}
                  onChange={(e) => setPriceFormData((prev) => ({ ...prev, priceUGX: e.target.value }))}
                  placeholder="e.g. 3000"
                  min="1"
                  step="1"
                  required
                  style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "1rem" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                Market Name *
              </label>
              <input
                type="text"
                value={priceFormData.marketName}
                onChange={(e) => setPriceFormData((prev) => ({ ...prev, marketName: e.target.value }))}
                placeholder="e.g. Nakasero Market, Owino Market..."
                required
                style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "1rem" }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#666" }}>
                Market Type (optional)
              </label>
              <select
                value={priceFormData.marketType}
                onChange={(e) => setPriceFormData((prev) => ({ ...prev, marketType: e.target.value }))}
                style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "1rem", background: "#fff" }}
              >
                <option value="">— Select —</option>
                <option value="wholesale">Wholesale</option>
                <option value="retail">Retail</option>
                <option value="mixed">Mixed (Wholesale + Retail)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={priceLoading}
              style={{
                padding: "0.85rem 1.5rem",
                background: priceLoading ? "#ccc" : "#1565c0",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: priceLoading ? "not-allowed" : "pointer",
                fontSize: "1rem",
                fontWeight: "700",
              }}
            >
              {priceLoading ? "Submitting..." : "📤 Submit Price & Earn 🪙"}
            </button>
          </div>
        </form>
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

            {/* Vendor custom products — chips */}
            {isVendorOrStore && customProducts.length > 0 && (
              <div style={{ marginBottom: "0.75rem" }}>
                <p style={{ fontSize: "0.8rem", color: "#555", marginBottom: "0.4rem", fontWeight: "600" }}>⭐ My custom products</p>
                <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.25rem", WebkitOverflowScrolling: "touch" as any }}>
                  {customProducts.map((cp) => {
                    const val = `${cp.emoji} ${cp.name}`;
                    return (
                      <button
                        key={cp.name}
                        type="button"
                        onClick={() => setFormData({ ...formData, produceType: val })}
                        style={{
                          flexShrink: 0,
                          padding: "0.45rem 0.8rem",
                          background: formData.produceType === val ? "#e8f5e9" : "#fff8e1",
                          border: `1.5px solid ${formData.produceType === val ? "#4caf50" : "#f9a825"}`,
                          borderRadius: "20px",
                          cursor: "pointer",
                          fontSize: "0.82rem",
                          fontWeight: formData.produceType === val ? "600" : "400",
                          color: formData.produceType === val ? "#2e7d32" : "#333",
                          minHeight: "36px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cp.emoji} {cp.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Vendor commodity memory — suggestion chips */}
            {isVendorOrStore && recentCommodities && recentCommodities.commodities.length > 0 && (
              <div style={{ marginBottom: "0.75rem" }}>
                <p style={{ fontSize: "0.8rem", color: "#555", marginBottom: "0.4rem", fontWeight: "600" }}>
                  🔄 Recent commodities
                </p>
                <div style={{
                  display: "flex",
                  gap: "0.5rem",
                  overflowX: "auto",
                  paddingBottom: "0.25rem",
                  WebkitOverflowScrolling: "touch",
                }}>
                  {recentCommodities.commodities.map((c: any) => (
                    <button
                      key={c.commodity}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, produceType: c.commodity });
                      }}
                      style={{
                        flexShrink: 0,
                        padding: "0.45rem 0.8rem",
                        background: formData.produceType === c.commodity ? "#e8f5e9" : "#f5f5f5",
                        border: `1.5px solid ${formData.produceType === c.commodity ? "#4caf50" : "#ddd"}`,
                        borderRadius: "20px",
                        cursor: "pointer",
                        fontSize: "0.82rem",
                        fontWeight: formData.produceType === c.commodity ? "600" : "400",
                        color: formData.produceType === c.commodity ? "#2e7d32" : "#333",
                        minHeight: "36px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.emoji} {c.commodity}
                      {c.latestPriceUGX > 0 && (
                        <span style={{ color: "#666", marginLeft: "0.3rem", fontSize: "0.75rem" }}>
                          · {c.latestPriceUGX.toLocaleString("en-UG")} UGX
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
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

                {/* Add & save custom product (vendor/store only) */}
                {isVendorOrStore && (
                  <div style={{ marginTop: "0.75rem" }}>
                    {!showAddCustomProduct ? (
                      <button
                        type="button"
                        onClick={() => setShowAddCustomProduct(true)}
                        style={{ fontSize: "0.82rem", color: "#1565c0", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                      >
                        ➕ Save a custom product name
                      </button>
                    ) : (
                      <div style={{ background: "#f9f9f9", border: "1px solid #ddd", borderRadius: "10px", padding: "0.75rem", position: "relative" }}>
                        <p style={{ fontWeight: "600", fontSize: "0.85rem", marginBottom: "0.5rem", color: "#333" }}>Add custom product</p>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", position: "relative" }}>
                          <button
                            type="button"
                            onClick={() => setShowEmojiPicker((v) => !v)}
                            title="Choose emoji"
                            style={{
                              fontSize: "1.5rem",
                              width: 44,
                              height: 44,
                              border: "1.5px solid #ddd",
                              borderRadius: "8px",
                              background: "#fff",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {customProductEmoji}
                          </button>

                          {showEmojiPicker && (
                            <div style={{
                              position: "absolute",
                              top: "3rem",
                              left: 0,
                              zIndex: 200,
                              background: "#fff",
                              border: "1px solid #ddd",
                              borderRadius: "10px",
                              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                              padding: "0.5rem",
                              width: "min(260px, 90vw)",
                            }}>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 3 }}>
                                {FOOD_EMOJIS.map((em) => (
                                  <button
                                    key={em}
                                    type="button"
                                    onClick={() => { setCustomProductEmoji(em); setShowEmojiPicker(false); }}
                                    style={{
                                      fontSize: "1.2rem",
                                      padding: 3,
                                      border: em === customProductEmoji ? "2px solid #4caf50" : "1px solid transparent",
                                      borderRadius: "5px",
                                      background: em === customProductEmoji ? "#e8f5e9" : "transparent",
                                      cursor: "pointer",
                                    }}
                                  >
                                    {em}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <input
                            type="text"
                            value={customProductName}
                            onChange={(e) => setCustomProductName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                if (!customProductName.trim()) return;
                                saveCustomProduct(customProductEmoji, customProductName.trim());
                                setFormData({ ...formData, produceType: `${customProductEmoji} ${customProductName.trim()}` });
                                setCustomProductName("");
                                setShowAddCustomProduct(false);
                                setShowEmojiPicker(false);
                              }
                            }}
                            placeholder="e.g. Jackfruit, Tilapia, Nile Perch..."
                            maxLength={40}
                            style={{ flex: 1, padding: "0.6rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "0.95rem" }}
                          />
                          <button
                            type="button"
                            disabled={!customProductName.trim()}
                            onClick={() => {
                              if (!customProductName.trim()) return;
                              saveCustomProduct(customProductEmoji, customProductName.trim());
                              setFormData({ ...formData, produceType: `${customProductEmoji} ${customProductName.trim()}` });
                              setCustomProductName("");
                              setShowAddCustomProduct(false);
                              setShowEmojiPicker(false);
                            }}
                            style={{
                              padding: "0.6rem 0.9rem",
                              background: customProductName.trim() ? "#2e7d32" : "#ccc",
                              color: "#fff",
                              border: "none",
                              borderRadius: "6px",
                              cursor: customProductName.trim() ? "pointer" : "not-allowed",
                              fontSize: "0.85rem",
                              fontWeight: "600",
                              flexShrink: 0,
                            }}
                          >
                            Save
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setShowAddCustomProduct(false); setCustomProductName(""); setShowEmojiPicker(false); }}
                          style={{ fontSize: "0.78rem", color: "#999", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
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
                  onChange={(e) => {
                    setFormData({ ...formData, packagingType: e.target.value });
                    if (e.target.value !== "__custom__") setCustomPackagingInput("");
                  }}
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
                  {customPackagingList.length > 0 && (
                    <optgroup label="My custom types">
                      {customPackagingList.map((pkg) => (
                        <option key={pkg} value={pkg}>{pkg}</option>
                      ))}
                    </optgroup>
                  )}
                  <option value="__custom__">✏️ Custom (enter your own)…</option>
                </select>
                {formData.packagingType === "__custom__" && (
                  <input
                    type="text"
                    value={customPackagingInput}
                    onChange={(e) => setCustomPackagingInput(e.target.value)}
                    placeholder="e.g. Jerry Can, Bottle, Tray, Box..."
                    maxLength={40}
                    autoFocus
                    style={{ width: "100%", marginTop: "0.5rem", padding: "0.75rem", border: "1.5px solid #1565c0", borderRadius: "6px", fontSize: "1rem", boxSizing: "border-box" as any }}
                  />
                )}
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
