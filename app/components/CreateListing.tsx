"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FarmCoinReward, FarmCoinVideoPreloader } from "./FarmCoinAnimation";
import { FarmCoinIcon } from "./icons/Brand";
import { ugandaDateFromInstant } from "../../convex/exportMarketsShared";
import { LOT_BAG_SIZES_KG } from "../../convex/constants";
import { defaultPlan, type PlanStep, PACKAGED_COMMIT_PERCENT, isPackagedPlan, packagedPlan } from "../../convex/lotOrdersShared";
import { PhotoSetCapture, type CapturedPhoto } from "./exportMarkets/PhotoSetCapture";
import { uploadEvidencePhotos } from "./exportMarkets/PhotoSetCapture";
import { watchLocation } from "../utils/gps";
import { LotTermsFields, PackagedTermsFields, planProblem } from "./lots/LotTermsFields";
import { GoodsQrChooser, reuseCodeOf } from "./qr/GoodsQr";

interface CreateListingProps {
  userId: Id<"users">;
  userRole?: "farmer" | "vendor" | "store" | "trader";
}

// A blank listing form. Lots start at one lot of one bag; the seller picks the bag size.
const EMPTY_FORM = {
  produceType: "",
  pricePerKilo: "",
  qualityRating: "",
  qualityComment: "",
  deliveryProcessorId: "" as string | "",
  // Lot fields (by weight)
  bagKg: "",
  bagsPerLot: "1",
  lotCount: "1",
  // Garden mode fields
  gardenSize: "",
  gardenLength: "",
  gardenWidth: "",
  totalPrice: "",
  // Packaging mode fields
  packagingType: "",
  availableUnits: "",
  pricePerUnit: "",
};

export function CreateListing({ userId, userRole }: CreateListingProps) {
  const router = useRouter();
  const effectiveRole = userRole || "farmer";
  const isVendorOrStore = effectiveRole === "vendor" || effectiveRole === "store";
  // Exporters list stock they hold as lots, like vendors and processors.
  const isExporter = effectiveRole === "trader";
  const sellsStock = isVendorOrStore || isExporter;
  const createListing = useMutation(api.listings.createListing);
  const submitVendorPrice = useMutation((api as any).marketPrices.submitVendorPrice);
  const qualityOptions = useQuery(api.listings.getActiveQualityOptions, {});
  const produceOptions = useQuery(api.listings.getActiveProduceOptions, {});
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));
  // Farmers may name a verified processor as the delivery point (optional).
  const deliveryProcessors = useQuery(api.processors.listDeliveryProcessors, effectiveRole === "farmer" ? { userId, today } : "skip");
  const collectionPoint = useQuery(api.listings.getCollectionPointForUser, isVendorOrStore ? { userId } : "skip");
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

  const [formData, setFormData] = useState(EMPTY_FORM);

  // Lots (by weight): one lot is bagsPerLot bags of bagKg; buyers buy whole lots.
  const lotPlan = useMemo(() => {
    const bagKg = parseFloat(formData.bagKg);
    const bagsPerLot = parseInt(formData.bagsPerLot, 10);
    const lotCount = parseInt(formData.lotCount, 10);
    if (!(bagKg > 0) || !(bagsPerLot >= 1) || !(lotCount >= 1)) return null;
    const lotKg = Math.round(bagKg * bagsPerLot * 100) / 100;
    return { bagKg, bagsPerLot, lotCount, lotKg, totalKilos: Math.round(lotKg * lotCount * 100) / 100 };
  }, [formData.bagKg, formData.bagsPerLot, formData.lotCount]);
  const [customBagSize, setCustomBagSize] = useState(false);

  // Photos (camera or gallery), the seller's live position, and the lot terms.
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy?: number; capturedAt: string } | null>(null);
  const [gpsState, setGpsState] = useState<"reading" | "ok" | "weak" | "off">("reading");
  const [gpsTry, setGpsTry] = useState(0);
  const [commitPercent, setCommitPercent] = useState(30);
  // Packaged items: single items or batches, and no payment steps unless switched on
  const [packSellAs, setPackSellAs] = useState<"single" | "batches">("single");
  const [perBatch, setPerBatch] = useState("10");
  const [takesOffers, setTakesOffers] = useState(false);
  const [qr, setQr] = useState<Id<"goodsCodes"> | "new" | undefined>(undefined);
  const [pkgCommit, setPkgCommit] = useState(PACKAGED_COMMIT_PERCENT);
  const [pkgSteps, setPkgSteps] = useState<PlanStep[]>(() => packagedPlan());
  const [steps, setSteps] = useState<PlanStep[]>(() => defaultPlan(effectiveRole, 30));
  // Vendors, processors and exporters: stock bought in the app (traced) or not.
  const myStock = useQuery(api.lotOrders.myStock, sellsStock ? { userId } : "skip");
  const [stockChoice, setStockChoice] = useState<"stock" | "off_app">("off_app");
  const [stockId, setStockId] = useState("");
  // Listable stock rows, kept apart by where they came from (100 kg buyer blocks are on the buyer catalogue)
  const freeStock = (myStock ?? []).filter((s) => !s.listed && !s.isBuyerBlock);
  const inAppStock = freeStock.filter((s) => s.source === "in_app");
  const offAppStock = freeStock.filter((s) => s.source === "off_app");

  // Live location while the form is open: it keeps updating, so the listing carries where the seller is now.
  // "Turn on location" (gpsTry) asks for the permission again and restarts the watch.
  useEffect(() => {
    if (!showForm) return;
    setGpsState("reading");
    return watchLocation(
      (pos) => {
        setGps({ lat: pos.latitude, lng: pos.longitude, accuracy: pos.accuracy, capturedAt: new Date(pos.at).toISOString() });
        setGpsState("ok");
      },
      // A fix already found stays; the watch keeps trying. Off: no permission or location switched off.
      (message) => setGpsState((s) => (s === "ok" ? s : /denied|disabled|not enabled|cannot/i.test(message) ? "off" : "weak"))
    );
  }, [showForm, gpsTry]);

  const resetLotFields = () => {
    setCustomBagSize(false);
    setPhotos([]);
    setCommitPercent(30);
    setSteps(defaultPlan(effectiveRole, 30));
    setStockChoice("off_app");
    setStockId("");
    setPackSellAs("single");
    setPerBatch("10");
    setTakesOffers(false);
    setQr(undefined);
    setPkgCommit(PACKAGED_COMMIT_PERCENT);
    setPkgSteps(packagedPlan());
  };

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
    if (isVendorOrStore && collectionPoint?.collectionText) {
      const ct = collectionPoint.collectionText;
      setPriceFormData((prev) => ({ ...prev, marketName: prev.marketName || ct }));
    }
  }, [isVendorOrStore, collectionPoint]);

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

  // Every active produce type can be listed (storage locations are retired).
  const filteredProduceOptions = useMemo(() => produceOptions ?? [], [produceOptions]);

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
      if (photos.length === 0) {
        setMessage({ type: "error", text: "Add at least one photo of what you are selling (camera or gallery)" });
        setLoading(false);
        return;
      }
      if (sellsStock && listingMode === "unit" && stockChoice === "stock" && !stockId) {
        setMessage({ type: "error", text: "Choose the stock you bought in the app, or choose \"Not bought in the app\"" });
        setLoading(false);
        return;
      }
      const termsProblem = listingMode === "packaging" ? null : planProblem(steps, commitPercent);
      if (termsProblem) {
        setMessage({ type: "error", text: `Payment steps: ${termsProblem}` });
        setLoading(false);
        return;
      }
      if (stockChoice === "stock" && !stockId) {
        setMessage({ type: "error", text: "Choose the stock you are selling, or pick \"Not bought in the app\"" });
        setLoading(false);
        return;
      }
      const uploadedPhotos = await uploadEvidencePhotos(() => generateUploadUrl(), photos);

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
        const batchSize = packSellAs === "batches" ? parseInt(perBatch) : 1;
        if (packSellAs === "batches" && !(batchSize >= 2)) {
          setMessage({ type: "error", text: "A batch needs at least 2 items" });
          setLoading(false);
          return;
        }
        const withSteps = !isPackagedPlan(pkgSteps, pkgCommit);
        const pkgProblem = withSteps ? planProblem(pkgSteps, pkgCommit) : null;
        if (pkgProblem) {
          setMessage({ type: "error", text: `Payment steps: ${pkgProblem}` });
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
          packagesPerBatch: batchSize,
          takesOffers,
          goodsCodeId: reuseCodeOf(qr),
          commitPercent: withSteps ? pkgCommit : undefined,
          milestonePlan: withSteps ? pkgSteps : undefined,
          qualityRating: formData.qualityRating || undefined,
          qualityComment: formData.qualityComment.trim() || undefined,
          deliveryProcessorId: formData.deliveryProcessorId ? (formData.deliveryProcessorId as Id<"users">) : undefined,
          photos: uploadedPhotos,
          gps: gps ?? undefined,
        });

        const displayPkg = isCustomPkg ? customPackagingInput.trim() : formData.packagingType;
        setMessage({
          type: "success",
          text: batchSize > 1
            ? `Listing created! UTID: ${result.utid}. ${result.totalUnits} batch(es) of ${batchSize} ${displayPkg}(s) listed. Put them on MarketSpace from MarketSpace → My posts.`
            : `Listing created! UTID: ${result.utid}. ${result.totalUnits} ${displayPkg}(s) listed. Put them on MarketSpace from MarketSpace → My posts.`,
        });

        // Reset form
        setFormData(EMPTY_FORM);
        resetLotFields();
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
        if (!lotPlan) {
          setMessage({ type: "error", text: "Choose a bag size, the bags in each lot and the number of lots" });
          setLoading(false);
          return;
        }
        totalKilos = lotPlan.totalKilos;
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

      const lots = listingMode === "unit" ? lotPlan : null;
      const result = await createListing({
        farmerId: userId,
        produceType: formData.produceType.trim(),
        totalKilos: lots ? undefined : totalKilos,
        pricePerKilo,
        qualityRating: formData.qualityRating || undefined,
        qualityComment: formData.qualityComment.trim() || undefined,
        deliveryProcessorId: formData.deliveryProcessorId ? (formData.deliveryProcessorId as Id<"users">) : undefined,
        listingMode,
        gardenSize,
        gardenDimensions,
        totalPrice,
        bagKg: lots?.bagKg,
        bagsPerLot: lots?.bagsPerLot,
        lotCount: lots?.lotCount,
        photos: uploadedPhotos,
        gps: gps ?? undefined,
        commitPercent,
        milestonePlan: steps,
        inventoryId: sellsStock && listingMode === "unit" && stockId ? (stockId as Id<"traderInventory">) : undefined,
        stockSource: sellsStock && listingMode === "unit" ? (stockChoice === "stock" ? "in_app" : "off_app") : undefined,
        goodsCodeId: reuseCodeOf(qr),
      });

      setMessage({
        type: "success",
        text: lots
          ? `Listing created! UTID: ${result.utid}. ${result.totalUnits} lot(s) of ${lots.lotKg} kg are now for sale.`
          : `Listing created successfully! UTID: ${result.utid}. ${result.totalUnits} unit(s) created.`,
      });

      // Reset form
      setFormData(EMPTY_FORM);
      resetLotFields();
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
            📊 Submit Today&apos;s Market Price
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
          <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#1565c0" }}>📊 Submit Today&apos;s Market Price</h3>
          <button
            type="button"
            onClick={() => { setShowPriceForm(false); setPriceMessage(null); }}
            style={{ padding: "0.5rem 1rem", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: "6px", cursor: "pointer", fontSize: "0.9rem" }}
          >
            Cancel
          </button>
        </div>
        <p style={{ fontSize: "0.85rem", color: "#555", marginBottom: "1rem" }}>
          Report a commodity price at your market today. You earn <FarmCoinIcon size={16} /> FarmCoins for each submission!
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
              {priceLoading ? "Submitting..." : <>📤 Submit Price &amp; Earn <FarmCoinIcon size={18} /></>}
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
            setFormData(EMPTY_FORM);
            resetLotFields();
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
          
          {/* Listing Mode Selection (exporters sell by weight only) */}
          {isExporter ? null : isVendorOrStore ? (
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
                <span>By weight (bags and lots)</span>
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
                <span>Sell in bags and lots</span>
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

          {/* STEP 1: Collection point (vendors) or delivery point (farmers, optional) */}
          {isExporter ? null : isVendorOrStore ? (
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                Collection Location
              </label>
              {collectionPoint === undefined ? (
                <p style={{ color: "#999", fontSize: "0.9rem" }}>Loading your location...</p>
              ) : collectionPoint?.collectionText ? (
                <div style={{ padding: "0.75rem 1rem", background: "#e8f5e9", borderRadius: "8px", border: "1px solid #81c784", color: "#2e7d32", fontSize: "0.95rem", fontWeight: "500" }}>
                  📍 {collectionPoint.collectionText} — your registered {effectiveRole === "vendor" ? "market" : "store"} address
                </div>
              ) : (
                <div style={{ padding: "0.75rem 1rem", background: "#e3f2fd", borderRadius: "8px", border: "1px solid #90caf9", color: "#1565c0", fontSize: "0.9rem" }}>
                  Your listing will be collected from your registered {effectiveRole === "vendor" ? "market" : "store"} address. You can update your address from your profile.
                </div>
              )}
            </div>
          ) : (
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                Delivery point (optional)
              </label>
              <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.75rem" }}>
                Name a verified processor where you will deliver, or leave it to agree with the buyer.
              </p>
              <select
                value={formData.deliveryProcessorId}
                onChange={(e) => setFormData({ ...formData, deliveryProcessorId: e.target.value })}
                style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "1rem", background: "#fff" }}
              >
                <option value="">Agree the delivery point with the buyer</option>
                {(deliveryProcessors ?? []).map((p) => (
                  <option key={p.processorId} value={p.processorId}>
                    🏭 {p.name}, {p.district}
                    {p.sameDistrict ? " (your district)" : ""}
                  </option>
                ))}
              </select>
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
            {produceOptions === undefined ? (
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
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                  Bag size *
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {LOT_BAG_SIZES_KG.map((kg) => {
                    const chosen = !customBagSize && formData.bagKg === String(kg);
                    return (
                      <button
                        key={kg}
                        type="button"
                        onClick={() => { setCustomBagSize(false); setFormData({ ...formData, bagKg: String(kg) }); }}
                        style={{ minHeight: 44, padding: "0 0.9rem", borderRadius: 999, border: `2px solid ${chosen ? "#2e7d32" : "#ddd"}`, background: chosen ? "#e8f5e9" : "#fff", color: "#222", fontWeight: 700, cursor: "pointer" }}
                      >
                        {kg} kg
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => { setCustomBagSize(true); setFormData({ ...formData, bagKg: "" }); }}
                    style={{ minHeight: 44, padding: "0 0.9rem", borderRadius: 999, border: `2px solid ${customBagSize ? "#2e7d32" : "#ddd"}`, background: customBagSize ? "#e8f5e9" : "#fff", color: "#222", fontWeight: 700, cursor: "pointer" }}
                  >
                    Other
                  </button>
                </div>
                {customBagSize && (
                  <input
                    type="number"
                    value={formData.bagKg}
                    onChange={(e) => setFormData({ ...formData, bagKg: e.target.value })}
                    placeholder="Bag size in kg, e.g. 70"
                    min="0.1"
                    step="0.1"
                    required
                    style={{ width: "100%", marginTop: "0.5rem", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "1rem" }}
                  />
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                    Bags in each lot *
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={formData.bagsPerLot}
                    onChange={(e) => setFormData({ ...formData, bagsPerLot: e.target.value })}
                    min="1"
                    step="1"
                    required
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "1rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                    Number of lots *
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={formData.lotCount}
                    onChange={(e) => setFormData({ ...formData, lotCount: e.target.value })}
                    min="1"
                    step="1"
                    required
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "1rem" }}
                  />
                </div>
              </div>

              {lotPlan && (
                <div style={{ padding: "0.75rem 0.9rem", borderRadius: 8, background: "#e8f5e9", border: "1px solid #a5d6a7", color: "#1b5e20", fontSize: "0.95rem", lineHeight: 1.5 }}>
                  You are selling <strong>{lotPlan.lotCount} lot{lotPlan.lotCount === 1 ? "" : "s"}</strong>.
                  {" "}Each lot is {lotPlan.bagsPerLot} bag{lotPlan.bagsPerLot === 1 ? "" : "s"} of {lotPlan.bagKg} kg = <strong>{lotPlan.lotKg.toLocaleString()} kg</strong>.
                  {" "}Total: <strong>{lotPlan.totalKilos.toLocaleString()} kg</strong>.
                </div>
              )}
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#666" }}>
                Buyers buy whole lots. Make one big lot for one buyer, or small lots so many buyers can buy.
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
                  Sell As *
                </label>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {([["single", "Single Items"], ["batches", "In Batches (bulk)"]] as const).map(([value, text]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPackSellAs(value)}
                      style={{ minHeight: 44, padding: "0 0.9rem", borderRadius: 999, border: `2px solid ${packSellAs === value ? "#2e7d32" : "#ddd"}`, background: packSellAs === value ? "#e8f5e9" : "#fff", color: "#222", fontWeight: 700, cursor: "pointer" }}
                    >
                      {text}
                    </button>
                  ))}
                </div>
                <p style={{ margin: "0.4rem 0 0", fontSize: "0.8rem", color: "#666" }}>
                  {packSellAs === "single" ? "Buyers choose how many they want, one order for all." : "Buyers buy whole batches. Verified sellers can show them under Local Bulk on MarketSpace."}
                </p>
              </div>
              {packSellAs === "batches" && (
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                    Items in One Batch *
                  </label>
                  <input
                    type="number"
                    value={perBatch}
                    onChange={(e) => setPerBatch(e.target.value)}
                    placeholder="e.g., 10, 20"
                    min="2"
                    step="1"
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "1rem" }}
                  />
                </div>
              )}
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                  {packSellAs === "batches" ? "Number of Batches *" : "Number of Items *"}
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
                    Total Value: {formatUGX(parseInt(formData.availableUnits) * parseFloat(formData.pricePerUnit) * (packSellAs === "batches" ? parseInt(perBatch) || 1 : 1))}
                  </p>
                )}
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                  Take Offers?
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {([[false, "No, fixed price"], [true, "Yes, buyers can offer"]] as const).map(([value, text]) => (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() => setTakesOffers(value)}
                      style={{ minHeight: 44, padding: "0 0.9rem", borderRadius: 999, border: `2px solid ${takesOffers === value ? "#2e7d32" : "#ddd"}`, background: takesOffers === value ? "#e8f5e9" : "#fff", color: "#222", fontWeight: 700, cursor: "pointer" }}
                    >
                      {text}
                    </button>
                  ))}
                </div>
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
              {lotPlan && parseFloat(formData.pricePerKilo) > 0 && (
                <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                  One lot: {formatUGX(lotPlan.lotKg * parseFloat(formData.pricePerKilo))} · All lots: {formatUGX(lotPlan.totalKilos * parseFloat(formData.pricePerKilo))}
                </p>
              )}
            </div>
          )}


          {/* Photos: camera or gallery, each with its GPS and time */}
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
              Photos *
            </label>
            <PhotoSetCapture photos={photos} onChange={setPhotos} max={6} />
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", fontWeight: 600, color: gpsState === "ok" ? "#2e7d32" : gpsState === "off" ? "#c62828" : "#555" }}>
              {gpsState === "reading"
                ? "📍 Finding your location…"
                : gpsState === "ok"
                  ? `📍 Live location on${gps?.accuracy ? ` (±${Math.round(gps.accuracy)} m)` : ""}`
                  : gpsState === "weak"
                    ? "📍 No GPS signal yet. Stand in the open; it keeps trying."
                    : (
                    <>
                      📍 Location is off.{" "}
                      <button type="button" onClick={() => setGpsTry((n) => n + 1)} style={{ minHeight: 36, padding: "0 0.8rem", marginLeft: "0.3rem", borderRadius: 8, border: "none", background: "#1565c0", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                        Turn on location
                      </button>
                    </>
                  )}
            </p>
          </div>

          {/* Vendors, processors and exporters: is this stock bought in the app (traced to farms)? */}
          {sellsStock && listingMode === "unit" && (
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600", color: "#333" }}>
                Where is this stock from? *
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {([["stock", "From my stock (bought in the app)"], ["off_app", "Not bought in the app"]] as const).map(([value, text]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setStockChoice(value); setStockId(""); }}
                    style={{ minHeight: 44, padding: "0 0.9rem", borderRadius: 999, border: `2px solid ${stockChoice === value ? "#2e7d32" : "#ddd"}`, background: stockChoice === value ? "#e8f5e9" : "#fff", color: "#222", fontWeight: 700, cursor: "pointer" }}
                  >
                    {text}
                  </button>
                ))}
              </div>
              {stockChoice === "stock" && inAppStock.length === 0 && (
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "#666" }}>You have no unlisted stock bought in the app yet.</p>
              )}
              {/* Each choice lists only its own stock, so the two never mix (the server checks too) */}
              {(stockChoice === "stock" ? inAppStock : offAppStock).length > 0 && (
                <select
                  value={stockId}
                  onChange={(e) => {
                    setStockId(e.target.value);
                    const chosen = myStock?.find((s) => s.inventoryId === e.target.value);
                    if (chosen) setFormData({ ...formData, produceType: chosen.produceType });
                  }}
                  style={{ width: "100%", marginTop: "0.5rem", padding: "0.75rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "1rem", background: "#fff" }}
                >
                  <option value="">{stockChoice === "stock" ? "-- Choose your stock --" : "-- New stock (not in my records) --"}</option>
                  {(stockChoice === "stock" ? inAppStock : offAppStock).map((s) => (
                    <option key={s.inventoryId} value={s.inventoryId}>
                      {s.produceType} · {s.totalKilos.toLocaleString()} kg{s.sellerCount > 0 ? ` · from ${s.sellerCount} seller${s.sellerCount === 1 ? "" : "s"}` : ""}
                    </option>
                  ))}
                </select>
              )}
              <p style={{ margin: "0.4rem 0 0", fontSize: "0.8rem", color: "#666" }}>
                {stockChoice === "stock"
                  ? "Buyers see it as traced: bought in the app, back to the farms it came from."
                  : "Buyers see it as off-app stock."}
              </p>
            </div>
          )}

          {/* What the buyer commits up front, and the steps that bring in the rest */}
          {listingMode === "packaging" && (
            <PackagedTermsFields
              sellerRole={effectiveRole}
              commitPercent={pkgCommit}
              steps={pkgSteps}
              lotPrice={parseFloat(formData.pricePerUnit) > 0 ? Math.round(parseFloat(formData.pricePerUnit) * (packSellAs === "batches" ? parseInt(perBatch) || 1 : 1)) : null}
              onChange={(c, st) => { setPkgCommit(c); setPkgSteps(st); }}
            />
          )}
          {listingMode !== "packaging" && (
            <LotTermsFields
              sellerRole={effectiveRole}
              commitPercent={commitPercent}
              steps={steps}
              lotPrice={
                listingMode === "garden"
                  ? parseFloat(formData.totalPrice) > 0 ? parseFloat(formData.totalPrice) : null
                  : lotPlan && parseFloat(formData.pricePerKilo) > 0 ? Math.round(lotPlan.lotKg * parseFloat(formData.pricePerKilo)) : null
              }
              onChange={(c, s) => { setCommitPercent(c); setSteps(s); }}
            />
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

          <GoodsQrChooser userId={userId} goodLabel={formData.produceType} value={qr} onChange={setQr} />

          <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
            <button
              type="submit"
              disabled={loading || !formData.produceType || !onboardingStatus?.completed}
              style={{
                padding: "0.75rem 1.5rem",
                background: loading || !formData.produceType || !onboardingStatus?.completed ? "#ccc" : "#4caf50",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: loading || !formData.produceType || !onboardingStatus?.completed ? "not-allowed" : "pointer",
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
                setFormData(EMPTY_FORM);
                resetLotFields();
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
