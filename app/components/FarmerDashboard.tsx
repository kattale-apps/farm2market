"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { CreateListing } from "./CreateListing";
import { useEffect, useMemo, useRef, useState } from "react";
import { exportToExcel, exportToPDF, formatUTIDDataForExport } from "../utils/exportUtils";
import { formatUgandaDateTime, getUgandaTime } from "../utils/timeUtils";
import { NotificationMailbox } from "./NotificationMailbox";
import { ThreadView } from "./messages/ThreadView";
import { ContactUs } from "./ContactUs";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface FarmerDashboardProps {
  userId: Id<"users">;
}

export function FarmerDashboard({ userId }: FarmerDashboardProps) {
  const listings = useQuery(api.farmerDashboard.getFarmerListings, { farmerId: userId });
  const negotiations = useQuery(api.negotiations.getFarmerNegotiations, { farmerId: userId });
  const confirmations = useQuery(api.farmerDashboard.getPayToLockConfirmations, { farmerId: userId });
  const deliveryDeadlines = useQuery(api.farmerDashboard.getDeliveryDeadlines, { farmerId: userId });
  const expiredUTIDs = useQuery(api.farmerDashboard.getExpiredUTIDs, { farmerId: userId });
  const transactionsLedger = useQuery(api.farmerDashboard.getSuccessfulTransactionsLedger, { farmerId: userId });
  const allUnitsLedger = useQuery(api.farmerDashboard.getAllUnitsLedger, { farmerId: userId });
  const communities = useQuery(api.communities.getActiveCommunities, { userId });
  const myAgroFreshDrafts = useQuery(api.farmValidation.getMyDrafts, { farmerId: userId });
  
  const acceptOffer = useMutation(api.negotiations.acceptOffer);
  const rejectOffer = useMutation(api.negotiations.rejectOffer);
  const counterOffer = useMutation(api.negotiations.counterOffer);
  const archiveUTID = useMutation(api.farmerDashboard.archiveUTID);
  const cancelOverdueUTID = useMutation(api.farmerDashboard.cancelOverdueUTID);
  const cancelListing = useMutation(api.farmerDashboard.cancelListing);
  const farmerConfirmDelivery = useMutation(api.farmerDashboard.farmerConfirmDelivery);
  const messageThreads = useQuery(api.messages.getUserMessageThreads, { userId });
  const createNewValidation = useMutation(api.farmValidation.createNewDraft) as (
    args: { farmerId: Id<"users"> }
  ) => Promise<Id<"agroFreshUGFarmValidations">>;
  const router = useRouter();
  
  const [countering, setCountering] = useState<Id<"negotiations"> | null>(null);
  const [counteringBatch, setCounteringBatch] = useState<string | null>(null);
  const [expandedBatchUtids, setExpandedBatchUtids] = useState<Set<string>>(new Set());
  const [cancelling, setCancelling] = useState<Id<"listingUnits"> | null>(null);
  const [confirmingDelivery, setConfirmingDelivery] = useState<Id<"listingUnits"> | null>(null);
  const [cancellingListing, setCancellingListing] = useState<Id<"listings"> | null>(null);
  const [counterPrice, setCounterPrice] = useState<string>("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [creatingValidation, setCreatingValidation] = useState(false);
  const [messageInboxOpen, setMessageInboxOpen] = useState(false);
  const [selectedMessageUtid, setSelectedMessageUtid] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<any | null>(null);
  const [expandedListings, setExpandedListings] = useState<Set<string>>(new Set());
  const [cancelledUnitIds, setCancelledUnitIds] = useState<Set<string>>(new Set());
  const [transactionsView, setTransactionsView] = useState<"list" | "card">("list");
  const [transactionsPage, setTransactionsPage] = useState(0);
  const [activeNegotiationsView, setActiveNegotiationsView] = useState<"list" | "card">("list");
  const [activeNegotiationsPage, setActiveNegotiationsPage] = useState(0);
  const [concludedNegotiationsView, setConcludedNegotiationsView] = useState<"list" | "card">("list");
  const [concludedNegotiationsPage, setConcludedNegotiationsPage] = useState(0);
  const [deliveryDeadlinesView, setDeliveryDeadlinesView] = useState<"list" | "card">("list");
  const [deliveryDeadlinesPage, setDeliveryDeadlinesPage] = useState(0);
  const [expiredUtidsView, setExpiredUtidsView] = useState<"list" | "card">("list");
  const [expiredUtidsPage, setExpiredUtidsPage] = useState(0);
  const [ledgerView, setLedgerView] = useState<"list" | "card">("list");
  const [ledgerPage, setLedgerPage] = useState(0);
  const ITEMS_PER_PAGE = 5;
  const SUPPORT_THREAD = "SUPPORT";
  const [isMobile, setIsMobile] = useState(false);
  const inboxRef = useRef<HTMLDivElement>(null);
  const [isInboxNarrow, setIsInboxNarrow] = useState(false);
  const isInboxStacked = isMobile || isInboxNarrow;
  const activeThreadUtid = selectedMessageUtid || messageThreads?.[0]?.utid || SUPPORT_THREAD;
  const getSortTimestamp = (item: any) => {
    const raw =
      item?.timestamp ??
      item?.updatedAt ??
      item?.createdAt ??
      item?.lastUpdatedAt ??
      item?.deliveryDeadline ??
      item?.lockedAt ??
      item?.lockAt ??
      item?.purchaseAt ??
      item?._creationTime ??
      0;
    if (typeof raw === "number") {
      return raw;
    }
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  const sortedListings = useMemo(() => {
    if (!listings?.listings) return [];
    return [...listings.listings].sort((a: any, b: any) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [listings]);
  const sortedNegotiations = useMemo(() => {
    if (!negotiations?.negotiations) return [];
    return [...negotiations.negotiations].sort((a: any, b: any) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [negotiations]);
  const sortedLedgerTransactions = useMemo(() => {
    if (!transactionsLedger?.transactions) return [];
    return [...transactionsLedger.transactions].sort((a: any, b: any) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [transactionsLedger]);
  const defaultSupportUtid = useMemo(() => {
    const listingUtid = sortedListings?.[0]?.utid;
    if (listingUtid) return listingUtid;
    const negotiationUtid = sortedNegotiations?.[0]?.negotiationUtid;
    if (negotiationUtid) return negotiationUtid;
    const ledgerUtid = sortedLedgerTransactions?.[0]?.lockUtid;
    if (ledgerUtid) return ledgerUtid;
    return SUPPORT_THREAD;
  }, [sortedListings, sortedNegotiations, sortedLedgerTransactions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      setIsInboxNarrow(width <= 720);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!inboxRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width || 0;
      setIsInboxNarrow(width <= 720);
    });
    observer.observe(inboxRef.current);
    return () => observer.disconnect();
  }, []);

  const formatDate = (timestamp: number) => {
    // Timestamps are stored in Uganda time, convert for display
    return formatUgandaDateTime(timestamp);
  };

  const formatTimeRemaining = (deadline: number) => {
    // Use Uganda time for comparisons
    const now = getUgandaTime();
    const diff = deadline - now;
    if (diff <= 0) return "OVERDUE";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m remaining`;
  };

  const formatUGX = (amount: number) => {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(amount);
  };

  const getProduceEmoji = (produceType?: string) => {
    const key = (produceType || "").toLowerCase();
    if (key.includes("maize")) return "🌽";
    if (key.includes("rice")) return "🍚";
    if (key.includes("cassava")) return "🌿";
    if (key.includes("cocoa")) return "🍫";
    if (key.includes("coffee") || key.includes("arabica")) return "☕";
    if (key.includes("banana") || key.includes("matooke") || key.includes("plantain")) return "🍌";
    if (key.includes("beans") || key.includes("soy")) return "🫘";
    if (key.includes("groundnut") || key.includes("peanut")) return "🥜";
    if (key.includes("millet") || key.includes("sorghum")) return "🌾";
    if (key.includes("sunflower")) return "🌻";
    if (key.includes("sweet potato") || key.includes("potato")) return "🥔";
    if (key.includes("tomato")) return "🍅";
    if (key.includes("onion")) return "🧅";
    if (key.includes("cabbage")) return "🥬";
    if (key.includes("avocado")) return "🥑";
    if (key.includes("mango")) return "🥭";
    if (key.includes("pineapple")) return "🍍";
    if (key.includes("watermelon")) return "🍉";
    return "🌾";
  };

  const getTotalPages = (items: any[]) => Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const getPageItems = (items: any[], page: number) =>
    items.slice(page * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE + ITEMS_PER_PAGE);

  const listingsById = useMemo(() => {
    const map = new Map<string, any>();
    if (listings?.listings) {
      listings.listings.forEach((listing: any) => {
        map.set(listing.listingId || listing._id, listing);
      });
    }
    return map;
  }, [listings]);

  const handleExportUTIDs = (format: "excel" | "pdf") => {
    if (!listings || !listings.listings || listings.listings.length === 0) {
      alert("No UTID data available to export");
      return;
    }

    // Format farmer listings as UTID data
    const utidData = listings.listings.map((listing: any) => ({
      utid: listing.utid,
      type: "farmer_listing",
      timestamp: listing.createdAt,
      status: listing.status,
      details: {
        produceType: listing.produceType,
        totalKilos: listing.totalKilos,
        pricePerKilo: listing.pricePerKilo,
        totalUnits: listing.totalUnits,
      },
    }));

    const formattedData = formatUTIDDataForExport(utidData);
    const filename = `farmer_utid_report_${new Date().toISOString().split("T")[0]}`;

    if (format === "excel") {
      exportToExcel(formattedData, filename, "Farmer");
    } else {
      exportToPDF(formattedData, filename, "Farmer");
    }
  };

  const handleArchiveUTID = async (unitId: Id<"listingUnits">) => {
    setMessage(null);
    try {
      await archiveUTID({
        farmerId: userId,
        unitId: unitId,
      });
      setMessage({
        type: "success",
        text: "UTID archived successfully.",
      });
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      setMessage({ type: "error", text: `Failed to archive UTID: ${error.message}` });
    }
  };

  const handleExportLedger = (format: "excel" | "pdf") => {
    if (!transactionsLedger || !transactionsLedger.transactions || transactionsLedger.transactions.length === 0) {
      alert("No transaction data available to export");
      return;
    }

    // Format transactions ledger for export
    const ledgerData = transactionsLedger.transactions.map((tx: any) => ({
      utid: tx.lockUtid || "N/A",
      type: "successful_transaction",
      timestamp: tx.lockedAt || getUgandaTime(),
      status: "delivered",
      details: {
        produceType: tx.produceType,
        kilos: tx.kilos,
        desiredPricePerKilo: tx.desiredPricePerKilo,
        negotiatedPricePerKilo: tx.negotiatedPricePerKilo,
        finalPricePerKilo: tx.finalPricePerKilo,
        totalEarned: tx.totalEarned,
        soldToBuyer: tx.soldToBuyer,
        buyerPurchaseUtid: tx.buyerPurchaseUtid || "N/A",
        priceAction: tx.priceAction,
      },
    }));

    const formattedData = formatUTIDDataForExport(ledgerData);
    const ugandaDate = new Date(getUgandaTime() - 3 * 60 * 60 * 1000); // Convert back to UTC for ISO string
    const filename = `farmer_transactions_ledger_${ugandaDate.toISOString().split("T")[0]}`;

    if (format === "excel") {
      exportToExcel(formattedData, filename, "Farmer");
    } else {
      exportToPDF(formattedData, filename, "Farmer");
    }
  };

  const handleAcceptOffer = async (negotiationId: Id<"negotiations">) => {
    setMessage(null);
    try {
      const result = await acceptOffer({
        farmerId: userId,
        negotiationId: negotiationId,
      });
      setMessage({
        type: "success",
        text: `Offer accepted! UTID: ${result.acceptedUtid}. Trader can now proceed to pay-to-lock.`,
      });
      setTimeout(() => setMessage(null), 8000);
    } catch (error: any) {
      setMessage({ type: "error", text: `Failed to accept offer: ${error.message}` });
    }
  };

  const handleRejectOffer = async (negotiationId: Id<"negotiations">) => {
    setMessage(null);
    try {
      await rejectOffer({
        farmerId: userId,
        negotiationId: negotiationId,
      });
      setMessage({ type: "success", text: "Offer rejected." });
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      setMessage({ type: "error", text: `Failed to reject offer: ${error.message}` });
    }
  };

  const handleCounterOffer = async (negotiationId: Id<"negotiations">) => {
    const price = parseFloat(counterPrice);
    if (isNaN(price) || price <= 0) {
      setMessage({ type: "error", text: "Please enter a valid price per kilo" });
      return;
    }
    setMessage(null);
    try {
      const result = await counterOffer({
        farmerId: userId,
        negotiationId: negotiationId,
        counterPricePerKilo: price,
      });
      setMessage({
        type: "success",
        text: `Counter-offer made! New price: ${formatUGX(result.counterPricePerKilo)}/kg. Waiting for trader's response.`,
      });
      setCountering(null);
      setCounterPrice("");
      setTimeout(() => setMessage(null), 8000);
    } catch (error: any) {
      setMessage({ type: "error", text: `Failed to counter-offer: ${error.message}` });
    }
  };

  const handleAcceptOfferBatch = async (negotiationIds: Id<"negotiations">[]) => {
    setMessage(null);
    try {
      for (const negotiationId of negotiationIds) {
        await acceptOffer({ farmerId: userId, negotiationId });
      }
      setMessage({
        type: "success",
        text: `Accepted ${negotiationIds.length} offer(s). Trader can now proceed to pay-to-lock.`,
      });
      setTimeout(() => setMessage(null), 8000);
    } catch (error: any) {
      setMessage({ type: "error", text: `Failed to accept offers: ${error.message}` });
    }
  };

  const handleRejectOfferBatch = async (negotiationIds: Id<"negotiations">[]) => {
    setMessage(null);
    try {
      for (const negotiationId of negotiationIds) {
        await rejectOffer({ farmerId: userId, negotiationId });
      }
      setMessage({ type: "success", text: `Rejected ${negotiationIds.length} offer(s).` });
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      setMessage({ type: "error", text: `Failed to reject offers: ${error.message}` });
    }
  };

  const handleCounterOfferBatch = async (negotiationIds: Id<"negotiations">[]) => {
    const price = parseFloat(counterPrice);
    if (isNaN(price) || price <= 0) {
      setMessage({ type: "error", text: "Please enter a valid price per kilo" });
      return;
    }
    setMessage(null);
    try {
      for (const negotiationId of negotiationIds) {
        await counterOffer({ farmerId: userId, negotiationId, counterPricePerKilo: price });
      }
      setMessage({
        type: "success",
        text: `Counter-offer sent to ${negotiationIds.length} unit(s): ${formatUGX(price)}/kg.`,
      });
      setCounteringBatch(null);
      setCounterPrice("");
      setTimeout(() => setMessage(null), 8000);
    } catch (error: any) {
      setMessage({ type: "error", text: `Failed to counter-offer: ${error.message}` });
    }
  };

  const activeNegotiations = useMemo(() => {
    if (!sortedNegotiations.length) return [];
    return sortedNegotiations.filter(
      (neg: any) => neg.status === "pending" || neg.status === "countered"
    );
  }, [sortedNegotiations]);

  const batchedActiveNegotiations = useMemo(() => {
    const batches = new Map<string, any>();
    activeNegotiations.forEach((neg: any) => {
      const bucket = Math.floor((neg.createdAt || 0) / (5 * 60 * 1000));
      const key = [
        neg.traderId || neg.traderAlias || "unknown",
        neg.listingId || "listing",
        neg.status,
        neg.farmerPricePerKilo,
        neg.traderOfferPricePerKilo,
        neg.currentPricePerKilo,
        bucket,
      ].join("|");

      if (!batches.has(key)) {
        batches.set(key, {
          key,
          produceType: neg.produceType,
          traderAlias: neg.traderAlias || "Unknown",
          traderIsVerified: !!neg.traderIsVerified,
          status: neg.status,
          farmerPricePerKilo: neg.farmerPricePerKilo,
          traderOfferPricePerKilo: neg.traderOfferPricePerKilo,
          currentPricePerKilo: neg.currentPricePerKilo,
          latestCreatedAt: 0,
          items: [],
        });
      }
      const batch = batches.get(key);
      const negTimestamp = getSortTimestamp(neg);
      batch.latestCreatedAt = Math.max(batch.latestCreatedAt, negTimestamp);
      batch.items.push(neg);
    });

    return Array.from(batches.values()).sort((a: any, b: any) => b.latestCreatedAt - a.latestCreatedAt);
  }, [activeNegotiations]);

  const transactionItems = sortedListings;
  const pagedTransactions = getPageItems(transactionItems, transactionsPage);
  const transactionTotalPages = getTotalPages(transactionItems);

  const pagedBatchedActiveNegotiations = getPageItems(
    batchedActiveNegotiations,
    activeNegotiationsPage
  );
  const activeNegotiationsTotalPages = getTotalPages(batchedActiveNegotiations);

  const concludedNegotiations = sortedNegotiations.filter(
    (neg: any) => neg.status === "accepted" || neg.status === "rejected" || neg.status === "cancelled"
  );
  const pagedConcludedNegotiations = getPageItems(concludedNegotiations, concludedNegotiationsPage);
  const concludedTotalPages = getTotalPages(concludedNegotiations);

  const deliveryItems = deliveryDeadlines
    ? [...deliveryDeadlines.overdue.deadlines, ...deliveryDeadlines.pending.deadlines].filter(
        (delivery: any) => !cancelledUnitIds.has(delivery.unitId)
      )
    : [];
  const sortedDeliveryItems = [...deliveryItems].sort((a: any, b: any) => getSortTimestamp(b) - getSortTimestamp(a));
  const pagedDeliveryItems = getPageItems(sortedDeliveryItems, deliveryDeadlinesPage);
  const deliveryTotalPages = getTotalPages(sortedDeliveryItems);

  const expiredItems = expiredUTIDs?.expiredUTIDs || [];
  const sortedExpiredItems = [...expiredItems].sort((a: any, b: any) => getSortTimestamp(b) - getSortTimestamp(a));
  const pagedExpiredItems = getPageItems(sortedExpiredItems, expiredUtidsPage);
  const expiredTotalPages = getTotalPages(sortedExpiredItems);

  const ledgerItems = allUnitsLedger?.listings || [];
  const sortedLedgerItems = [...ledgerItems].sort((a: any, b: any) => getSortTimestamp(b) - getSortTimestamp(a));
  const pagedLedgerItems = getPageItems(sortedLedgerItems, ledgerPage);
  const ledgerTotalPages = getTotalPages(sortedLedgerItems);

  const user = useQuery(api.auth.getUser, { userId });
  const profile = useQuery(api.farmerProfile.getFarmerProfile, { farmerId: userId });

  // Format location display
  const locationDisplay = profile
    ? [profile.districtName, profile.subcountyName, profile.parishName]
        .filter(Boolean)
        .join(", ") || "Location not set"
    : "Loading...";

  const normalizeCommunityKey = (value?: string) =>
    (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const agroFreshCommunityId = process.env.NEXT_PUBLIC_AGROFRESH_COMMUNITY_ID;

  const isAgroFreshMember =
    communities?.some((c: any) => {
      if (agroFreshCommunityId && c.id === agroFreshCommunityId) return !!c.isMember;
      const nameKey = normalizeCommunityKey(c.name);
      const descriptionKey = normalizeCommunityKey(c.description);
      return (nameKey.includes("agrofresh") || descriptionKey.includes("agrofresh")) && c.isMember;
    }) ?? false;

  const handleStartNewForm = async () => {
    setCreatingValidation(true);
    try {
      const latestDraft = myAgroFreshDrafts?.length
        ? [...myAgroFreshDrafts].sort((a: any, b: any) => {
            const aTime = a.updatedAt ?? a.createdAt ?? a._creationTime ?? 0;
            const bTime = b.updatedAt ?? b.createdAt ?? b._creationTime ?? 0;
            return bTime - aTime;
          })[0]
        : null;

      if (latestDraft?._id) {
        router.push(`/farm-validation/${latestDraft._id}`);
      } else {
        const newFormId = await createNewValidation({ farmerId: userId });
        router.push(`/farm-validation/${newFormId}`);
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to start new farm validation" });
    } finally {
      setCreatingValidation(false);
    }
  };

  return (
    <div style={{ padding: "1rem", maxWidth: "100%", boxSizing: "border-box" }}>
      <div style={{ 
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        justifyContent: "space-between", 
        alignItems: isMobile ? "stretch" : "flex-start",
        gap: isMobile ? "0.75rem" : "1.5rem",
        marginBottom: "1.5rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0"
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: "0.5rem" }}>
            <h2 style={{ 
              fontSize: "clamp(1.5rem, 4vw, 1.8rem)", 
              margin: 0, 
              color: "#2c2c2c",
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: "700",
              letterSpacing: "-0.02em"
            }}>
              Hello, Farmer 👩🏾‍🌾
            </h2>
          </div>
          <p style={{ 
            color: "#3d3d3d", 
            fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
            fontFamily: '"Montserrat", sans-serif',
            margin: 0,
            lineHeight: 1.35,
            wordBreak: "break-word"
          }}>
            Location: {locationDisplay}
          </p>
          {profile?.farmSizeAcres && (
            <p style={{ 
              color: "#666", 
              fontSize: "clamp(0.8rem, 2vw, 0.85rem)",
              fontFamily: '"Montserrat", sans-serif',
              margin: "0.25rem 0 0 0"
            }}>
              Farm Size: {profile.farmSizeAcres.toFixed(4)} acres
            </p>
          )}
        </div>
        <div style={{
          display: "flex",
          gap: "0.75rem",
          alignItems: "flex-start",
          flexWrap: "wrap",
          width: isMobile ? "100%" : "auto",
        }}>
          <Link
            href="/farmer/profile"
            style={{
              padding: "1rem 1.25rem",
              background: "#4CAF50",
              color: "white",
              textDecoration: "none",
              borderRadius: "12px",
              fontSize: "1rem",
              fontWeight: "600",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "64px",
              minWidth: "96px",
            }}
          >
            Profile
          </Link>
          <div id="notification-inbox">
            <NotificationMailbox userId={userId} />
          </div>
          <button
            type="button"
            onClick={() => {
              const nextOpen = !messageInboxOpen;
              setMessageInboxOpen(nextOpen);
              if (nextOpen && !selectedMessageUtid && defaultSupportUtid) {
                setSelectedMessageUtid(defaultSupportUtid);
              }
            }}
            style={{
              padding: "1rem 1.25rem",
              background: messageInboxOpen ? "#1976d2" : "#f5f5f5",
              color: messageInboxOpen ? "#fff" : "#1a1a1a",
              border: "2px solid #ddd",
              borderRadius: "12px",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: "600",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "64px",
              minWidth: "96px",
            }}
          >
            📩 Inbox {messageThreads && messageThreads.length > 0
              ? `(${messageThreads.reduce((sum, t) => sum + (t.unreadCount || 0), 0)})`
              : ""}
          </button>
        </div>
      </div>

      {isAgroFreshMember && (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "clamp(1rem, 3vw, 1.5rem)",
            background: "#ffffff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "clamp(1.1rem, 3vw, 1.3rem)",
              color: "#2c2c2c",
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: "600",
              letterSpacing: "-0.01em",
            }}
          >
            Farm Validation
          </h3>
          <p style={{ margin: 0, color: "#555", fontSize: "0.95rem" }}>
            Submit a new farm for validation with AGROFRESH UG.
          </p>
          <div>
            <button
              onClick={handleStartNewForm}
              disabled={creatingValidation}
              style={{
                padding: "0.75rem 1.25rem",
                background: "#2e7d32",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "0.95rem",
                fontWeight: "600",
                cursor: creatingValidation ? "not-allowed" : "pointer",
                opacity: creatingValidation ? 0.7 : 1,
              }}
            >
              {creatingValidation ? "Starting..." : "Start New Farm Validation"}
            </button>
          </div>
        </div>
      )}

      {messageInboxOpen && (
        <div
          id="message-inbox"
          ref={inboxRef}
          style={{
          marginBottom: "1.5rem",
          padding: "clamp(1rem, 3vw, 1.5rem)",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          border: "1px solid #e0e0e0",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          overflowX: "hidden",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "clamp(0.5rem, 2vw, 1rem)", flexWrap: "wrap", gap: "0.5rem" }}>
            <h3 style={{
              marginTop: 0,
              marginBottom: 0,
              fontSize: "clamp(1.1rem, 3vw, 1.3rem)",
              color: "#2c2c2c",
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: "600",
              letterSpacing: "-0.01em"
            }}>
              Messages Inbox
            </h3>
            <button
              type="button"
              onClick={() => setMessageInboxOpen(false)}
              style={{
                padding: "0.25rem 0.6rem",
                background: "#f5f5f5",
                border: "1px solid #ddd",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: "600",
              }}
            >
              x
            </button>
          </div>
          {messageThreads === undefined ? (
            <p style={{ color: "#999" }}>Loading message threads...</p>
          ) : messageThreads.length === 0 ? (
            <div>
              <p style={{ color: "#666", marginBottom: "0.75rem" }}>
                No messages yet. Start a support conversation with SuperAdmin below.
              </p>
              <ThreadView userId={userId} utid={defaultSupportUtid} />
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isInboxStacked ? "1fr" : "minmax(220px, 1fr) 2fr",
                gap: "1rem",
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
                overflowX: "hidden",
              }}
            >
              {!isInboxStacked && (
                <div style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  overflow: "hidden",
                  maxHeight: "420px",
                  overflowY: "auto",
                  width: "100%",
                  minWidth: 0,
                }}>
                  {messageThreads.map((thread) => {
                    const isSelected = selectedMessageUtid === thread.utid;
                    const isSupport = thread.utid === SUPPORT_THREAD;
                    return (
                      <button
                        key={thread.utid}
                        onClick={() => setSelectedMessageUtid(thread.utid)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "0.75rem",
                          border: "none",
                          borderBottom: "1px solid #e0e0e0",
                          background: isSelected ? "#e3f2fd" : "#fff",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: "600", color: "#2c2c2c" }}>
                          {isSupport ? "Support Inbox" : `UTID: ${thread.utid}`}
                        </div>
                        {isSupport && (
                          <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.25rem" }}>
                            General help with SuperAdmin
                          </div>
                        )}
                        {thread.unreadCount > 0 && (
                          <div style={{ marginTop: "0.35rem", fontSize: "0.75rem", color: "#d32f2f", fontWeight: "600" }}>
                            {thread.unreadCount} unread
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              <div style={{ width: "100%", minWidth: 0 }}>
                {isInboxStacked ? (
                  <ThreadView userId={userId} utid={activeThreadUtid} />
                ) : selectedMessageUtid ? (
                  <ThreadView userId={userId} utid={selectedMessageUtid} />
                ) : (
                  <div style={{
                    padding: "2rem",
                    border: "1px dashed #ddd",
                    borderRadius: "8px",
                    textAlign: "center",
                    color: "#666"
                  }}>
                    Select a thread to view messages.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Listing */}
      <CreateListing userId={userId} />

      {/* Your Transactions - Simplified Cards */}
      <div style={{
        marginBottom: "1.5rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "1rem", flexWrap: "wrap" }}>
          <h3 style={{ 
            marginTop: 0, 
            marginBottom: 0, 
            fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", 
            color: "#2c2c2c",
            fontFamily: '"Montserrat", sans-serif',
            fontWeight: "600",
            letterSpacing: "-0.01em"
          }}>
            Your Transactions
          </h3>
          {listings && listings.listings && listings.listings.length > 0 && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                onClick={() => handleExportUTIDs("excel")}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#000000",
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
                  background: "#ffc107",
                  color: "#000",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: "500"
                }}
              >
                📄 PDF
              </button>
              <button
                onClick={() => setTransactionsView("list")}
                style={{
                  padding: "0.5rem 0.75rem",
                  background: transactionsView === "list" ? "#1976d2" : "#f5f5f5",
                  color: transactionsView === "list" ? "#fff" : "#333",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: "500"
                }}
              >
                List
              </button>
              <button
                onClick={() => setTransactionsView("card")}
                style={{
                  padding: "0.5rem 0.75rem",
                  background: transactionsView === "card" ? "#1976d2" : "#f5f5f5",
                  color: transactionsView === "card" ? "#fff" : "#333",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: "500"
                }}
              >
                Card
              </button>
            </div>
          )}
        </div>
        {listings === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : listings.listings.length === 0 ? (
          <p style={{ color: "#666" }}>No transactions yet. Create your first listing to get started.</p>
        ) : (
          <div>
            {transactionsView === "list" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {pagedTransactions.map((listing: any, index: number) => {
                  let status = "Available";
                  let statusColor = "#4caf50";
                  if (listing.units.locked > 0 && listing.units.available > 0) {
                    status = "Partially Locked";
                    statusColor = "#ff9800";
                  } else if (listing.units.locked === listing.totalUnits) {
                    status = "Locked";
                    statusColor = "#2196f3";
                  } else if (listing.units.delivered > 0) {
                    status = "Sold";
                    statusColor = "#2e7d32";
                  }

                  return (
                    <div
                      key={index}
                      onClick={() => setSelectedListing(listing)}
                      style={{
                        padding: "0.75rem 1rem",
                        background: "#f9f9f9",
                        borderRadius: "8px",
                        border: `1px solid ${statusColor}`,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: "600", color: "#2c2c2c" }}>
                          {getProduceEmoji(listing.produceType)} {listing.produceType} • {listing.totalUnits} units
                        </div>
                        <span style={{
                          padding: "0.2rem 0.6rem",
                          borderRadius: "999px",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          background: statusColor,
                          color: "#fff",
                        }}>
                          {status}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.35rem", fontFamily: "monospace" }}>
                        UTID: {listing.utid}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))", 
                gap: "1rem" 
              }}>
                {pagedTransactions.map((listing: any, index: number) => {
              // Determine status based on unit counts
              let status = "Available";
              let statusColor = "#4caf50";
              if (listing.units.locked > 0 && listing.units.available > 0) {
                status = "Partially Locked";
                statusColor = "#ff9800";
              } else if (listing.units.locked === listing.totalUnits) {
                status = "Locked";
                statusColor = "#2196f3";
              } else if (listing.units.delivered > 0) {
                status = "Sold";
                statusColor = "#2e7d32";
              }

              // Check if listing can be cancelled (no locked or delivered units)
              const canCancel = listing.units.locked === 0 && listing.units.delivered === 0 && listing.status !== "cancelled";

              return (
                <div 
                  key={index} 
                  style={{
                    padding: "1rem",
                    background: "#f9f9f9",
                    borderRadius: "12px",
                    border: `2px solid ${statusColor}`,
                    cursor: "pointer",
                    transition: "transform 0.2s",
                    position: "relative",
                  }}
                  onClick={() => setSelectedListing(listing)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {canCancel && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation(); // Prevent opening the details modal
                        if (window.confirm(`Are you sure you want to cancel this listing? This will cancel all ${listing.units.available} available unit(s) and cannot be undone.`)) {
                          setCancellingListing(listing.listingId);
                          try {
                            await cancelListing({
                              farmerId: userId,
                              listingId: listing.listingId,
                            });
                            setMessage({
                              type: "success",
                              text: "Listing cancelled successfully.",
                            });
                            setTimeout(() => setMessage(null), 5000);
                          } catch (error: any) {
                            setMessage({
                              type: "error",
                              text: `Failed to cancel listing: ${error.message}`,
                            });
                            setTimeout(() => setMessage(null), 5000);
                          } finally {
                            setCancellingListing(null);
                          }
                        }
                      }}
                      disabled={cancellingListing === listing.listingId}
                      style={{
                        position: "absolute",
                        top: "0.5rem",
                        right: "0.5rem",
                        padding: "0.4rem 0.8rem",
                        background: cancellingListing === listing.listingId ? "#ccc" : "#d32f2f",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: cancellingListing === listing.listingId ? "not-allowed" : "pointer",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        zIndex: 10,
                      }}
                    >
                      {cancellingListing === listing.listingId ? "Cancelling..." : "✕ Cancel"}
                    </button>
                  )}
                  <div style={{ 
                    marginBottom: "0.5rem",
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
                      fontSize: "clamp(0.84rem, 2.45vw, 1.05rem)",
                      color: "#2c2c2c",
                      fontFamily: "monospace",
                      fontWeight: "700",
                      letterSpacing: "0.05em",
                      wordBreak: "break-all",
                    }}>
                      {listing.utid}
                    </div>
                  </div>
                  <div style={{ 
                    fontWeight: "600", 
                    marginBottom: "0.5rem", 
                    fontSize: "clamp(1rem, 3vw, 1.1rem)",
                    color: "#1a1a1a"
                  }}>
                    {getProduceEmoji(listing.produceType)} {listing.totalKilos}kg {listing.produceType}
                  </div>
                  <div style={{ 
                    fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)", 
                    fontWeight: "600",
                    color: statusColor
                  }}>
                    Status: {status}
                  </div>
                  <div style={{ 
                    fontSize: "clamp(0.7rem, 2vw, 0.75rem)", 
                    color: "#666",
                    marginTop: "0.5rem"
                  }}>
                    Click to view details →
                  </div>
                </div>
              );
                })}
              </div>
            )}
            {transactionTotalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                <button
                  onClick={() => setTransactionsPage((p) => Math.max(0, p - 1))}
                  disabled={transactionsPage === 0}
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: transactionsPage === 0 ? "#eee" : "#f5f5f5",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    cursor: transactionsPage === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  Prev
                </button>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>
                  Page {transactionsPage + 1} of {transactionTotalPages}
                </div>
                <button
                  onClick={() => setTransactionsPage((p) => Math.min(transactionTotalPages - 1, p + 1))}
                  disabled={transactionsPage >= transactionTotalPages - 1}
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: transactionsPage >= transactionTotalPages - 1 ? "#eee" : "#f5f5f5",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    cursor: transactionsPage >= transactionTotalPages - 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Negotiations */}
      <div style={{
        marginBottom: "1.5rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "0.75rem", flexWrap: "wrap" }}>
          <h3 style={{ 
            marginTop: 0, 
            marginBottom: 0, 
            fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", 
            color: "#2c2c2c",
            fontFamily: '"Montserrat", sans-serif',
            fontWeight: "600",
            letterSpacing: "-0.01em"
          }}>
            Active Negotiations
          </h3>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setActiveNegotiationsView("list")}
              style={{
                padding: "0.4rem 0.7rem",
                background: activeNegotiationsView === "list" ? "#1976d2" : "#f5f5f5",
                color: activeNegotiationsView === "list" ? "#fff" : "#333",
                border: "1px solid #ddd",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: "500"
              }}
            >
              List
            </button>
            <button
              onClick={() => setActiveNegotiationsView("card")}
              style={{
                padding: "0.4rem 0.7rem",
                background: activeNegotiationsView === "card" ? "#1976d2" : "#f5f5f5",
                color: activeNegotiationsView === "card" ? "#fff" : "#333",
                border: "1px solid #ddd",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: "500"
              }}
            >
              Card
            </button>
          </div>
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

        {negotiations === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : activeNegotiations.length === 0 ? (
          <p style={{ color: "#666" }}>No active negotiations. Traders can make offers on your listings.</p>
        ) : (
          <div>
            {activeNegotiationsView === "list" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {pagedBatchedActiveNegotiations.map((batch: any) => (
                  <div key={batch.key} style={{
                    padding: "0.75rem 1rem",
                    background: "#f9f9f9",
                    borderRadius: "8px",
                    border: "1px solid #e0e0e0",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: "600", color: "#2c2c2c" }}>
                        {getProduceEmoji(batch.produceType)} {batch.produceType} • {batch.items.length} unit{batch.items.length !== 1 ? "s" : ""}
                      </div>
                      <span style={{
                        padding: "0.2rem 0.6rem",
                        borderRadius: "999px",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        background: "#ffc107",
                        color: "#000",
                      }}>
                        {batch.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.35rem", display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                      <span>Trader: {batch.traderAlias}</span>
                      {batch.traderIsVerified && (
                        <span style={{
                          padding: "0.15rem 0.5rem",
                          borderRadius: "999px",
                          fontSize: "0.7rem",
                          fontWeight: "600",
                          background: "#e8f5e9",
                          color: "#2e7d32",
                          border: "1px solid #81c784",
                        }}>
                          Verified
                        </span>
                      )}
                      <span>• Offer: {formatUGX(batch.traderOfferPricePerKilo)}/kg</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {pagedBatchedActiveNegotiations.map((batch: any) => {
              const negotiationIds = batch.items.map((item: any) => item.negotiationId);
              const utids = batch.items.map((item: any) => item.negotiationUtid).filter(Boolean);
              const isExpanded = expandedBatchUtids.has(batch.key);

              return (
              <div key={batch.key} style={{
                padding: "1rem",
                background: batch.status === "accepted" ? "#d4edda" : "#fff3cd",
                borderRadius: "8px",
                border: `1px solid ${batch.status === "accepted" ? "#28a745" : "#ffc107"}`
              }}>
                <div style={{ fontWeight: "600", marginBottom: "0.5rem", fontSize: "clamp(0.9rem, 3vw, 1rem)" }}>
                  {getProduceEmoji(batch.produceType)} {batch.produceType} - {batch.items.length} unit{batch.items.length !== 1 ? "s" : ""}
                </div>
                <div style={{ fontSize: "clamp(0.8rem, 2.5vw, 0.85rem)", color: "#666", marginBottom: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                  <span>Trader: {batch.traderAlias}</span>
                  {batch.traderIsVerified && (
                    <span style={{
                      padding: "0.15rem 0.5rem",
                      borderRadius: "999px",
                      fontSize: "0.7rem",
                      fontWeight: "600",
                      background: "#e8f5e9",
                      color: "#2e7d32",
                      border: "1px solid #81c784",
                    }}>
                      Verified
                    </span>
                  )}
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  {(() => {
                    const listingForBatch = listingsById.get(batch.items[0]?.listingId);
                    const fallbackUnitSize =
                      listingForBatch?.totalKilos && listingForBatch?.totalUnits
                        ? listingForBatch.totalKilos / listingForBatch.totalUnits
                        : 10;
                    const unitSize = listingForBatch?.unitSize || fallbackUnitSize || 10;
                    const totalKg = unitSize * batch.items.length;
                    const totalTraderOffer = batch.traderOfferPricePerKilo * totalKg;
                    const totalCurrentOffer = batch.currentPricePerKilo * totalKg;

                    return (
                      <div>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0.4rem 0.75rem",
                            background: "#e8f5e9",
                            borderRadius: "999px",
                            border: "1px solid #4caf50",
                            color: "#2e7d32",
                            fontWeight: "700",
                            fontSize: "clamp(0.85rem, 2.5vw, 0.95rem)",
                          }}
                        >
                          Total Trader Offer: {formatUGX(totalTraderOffer)}
                        </div>
                        {totalCurrentOffer !== totalTraderOffer && (
                          <div
                            style={{
                              marginTop: "0.4rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              padding: "0.35rem 0.7rem",
                              background: "#fff3cd",
                              borderRadius: "999px",
                              border: "1px solid #ffc107",
                              color: "#856404",
                              fontWeight: "700",
                              fontSize: "clamp(0.8rem, 2.3vw, 0.9rem)",
                            }}
                          >
                            Current Offer: {formatUGX(totalCurrentOffer)}
                          </div>
                        )}
                        <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.35rem" }}>
                          {batch.items.length} unit{batch.items.length !== 1 ? "s" : ""} × {unitSize}kg each
                        </div>
                      </div>
                    );
                  })()}
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
                    UTIDs:
                  </div>
                  <div style={{
                    fontSize: "clamp(0.95rem, 2.5vw, 1.1rem)",
                    color: "#2c2c2c",
                    fontFamily: "monospace",
                    fontWeight: "700",
                    letterSpacing: "0.02em",
                  }}>
                    {utids.length} UTID{utids.length !== 1 ? "s" : ""}{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedBatchUtids((prev) => {
                          const next = new Set(prev);
                          if (next.has(batch.key)) {
                            next.delete(batch.key);
                          } else {
                            next.add(batch.key);
                          }
                          return next;
                        });
                      }}
                      style={{
                        marginLeft: "0.5rem",
                        background: "transparent",
                        border: "none",
                        color: "#1976d2",
                        cursor: "pointer",
                        textDecoration: "underline",
                        fontSize: "0.85rem",
                        padding: 0,
                      }}
                    >
                      {isExpanded ? "Hide list" : "View list"}
                    </button>
                  </div>
                  {isExpanded && (
                    <div style={{ marginTop: "0.5rem", maxHeight: "120px", overflowY: "auto" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                        {utids.map((utid: string) => (
                          <div key={utid} style={{ fontSize: "0.85rem", color: "#666", wordBreak: "break-all" }}>
                            {utid}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: "clamp(0.8rem, 2.5vw, 0.85rem)", fontWeight: "600", marginBottom: "0.75rem", color: batch.status === "accepted" ? "#155724" : "#856404" }}>
                  Status: {batch.status.toUpperCase()}
                </div>
                
                {batch.status === "pending" && (
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      onClick={() => handleAcceptOfferBatch(negotiationIds)}
                      style={{
                        padding: "0.5rem 1rem",
                        background: "#28a745",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
                        fontWeight: "600",
                      }}
                    >
                      Accept All
                    </button>
                    <button
                      onClick={() => handleRejectOfferBatch(negotiationIds)}
                      style={{
                        padding: "0.5rem 1rem",
                        background: "#dc3545",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
                        fontWeight: "600",
                      }}
                    >
                      Reject All
                    </button>
                    <button
                      onClick={() => {
                        setCounteringBatch(batch.key);
                        setCounterPrice(batch.currentPricePerKilo.toString());
                      }}
                      style={{
                        padding: "0.5rem 1rem",
                        background: "#ffc107",
                        color: "#000",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
                        fontWeight: "600",
                      }}
                    >
                      Counter-Offer All
                    </button>
                  </div>
                )}
                
                {batch.status === "countered" && (
                  <div style={{ fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)", color: "#856404" }}>
                    Waiting for trader to accept your counter-offer...
                  </div>
                )}
                
                {batch.status === "accepted" && (
                  <div style={{ fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)", color: "#155724" }}>
                    ✅ Offer accepted! Trader can now proceed to pay-to-lock. Delivery deadline will start 6 hours after payment.
                  </div>
                )}
                
                {counteringBatch === batch.key && (
                  <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "#fff", borderRadius: "6px", border: "1px solid #ffc107" }}>
                    <input
                      type="number"
                      value={counterPrice}
                      onChange={(e) => setCounterPrice(e.target.value)}
                      placeholder="Enter counter-offer price"
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
                        onClick={() => handleCounterOfferBatch(negotiationIds)}
                        style={{
                          padding: "0.5rem 1rem",
                          background: "#ffc107",
                          color: "#000",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "0.9rem",
                          fontWeight: "600",
                        }}
                      >
                        Submit Counter-Offer
                      </button>
                      <button
                        onClick={() => {
                          setCounteringBatch(null);
                          setCounterPrice("");
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
                )}
                </div>
              )})}
              </div>
            )}
            {activeNegotiationsTotalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                <button
                  onClick={() => setActiveNegotiationsPage((p) => Math.max(0, p - 1))}
                  disabled={activeNegotiationsPage === 0}
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: activeNegotiationsPage === 0 ? "#eee" : "#f5f5f5",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    cursor: activeNegotiationsPage === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  Prev
                </button>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>
                  Page {activeNegotiationsPage + 1} of {activeNegotiationsTotalPages}
                </div>
                <button
                  onClick={() => setActiveNegotiationsPage((p) => Math.min(activeNegotiationsTotalPages - 1, p + 1))}
                  disabled={activeNegotiationsPage >= activeNegotiationsTotalPages - 1}
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: activeNegotiationsPage >= activeNegotiationsTotalPages - 1 ? "#eee" : "#f5f5f5",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    cursor: activeNegotiationsPage >= activeNegotiationsTotalPages - 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Concluded Negotiations */}
      <div style={{
        marginBottom: "1.5rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "0.75rem", flexWrap: "wrap" }}>
          <h3 style={{ 
            marginTop: 0, 
            marginBottom: 0, 
            fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", 
            color: "#2c2c2c",
            fontFamily: '"Montserrat", sans-serif',
            fontWeight: "600",
            letterSpacing: "-0.01em"
          }}>
            Concluded Negotiations
          </h3>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setConcludedNegotiationsView("list")}
              style={{
                padding: "0.4rem 0.7rem",
                background: concludedNegotiationsView === "list" ? "#1976d2" : "#f5f5f5",
                color: concludedNegotiationsView === "list" ? "#fff" : "#333",
                border: "1px solid #ddd",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: "500"
              }}
            >
              List
            </button>
            <button
              onClick={() => setConcludedNegotiationsView("card")}
              style={{
                padding: "0.4rem 0.7rem",
                background: concludedNegotiationsView === "card" ? "#1976d2" : "#f5f5f5",
                color: concludedNegotiationsView === "card" ? "#fff" : "#333",
                border: "1px solid #ddd",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: "500"
              }}
            >
              Card
            </button>
          </div>
        </div>

        {negotiations === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : concludedNegotiations.length === 0 ? (
          <p style={{ color: "#666" }}>No concluded negotiations yet.</p>
        ) : (
          <div>
            {concludedNegotiationsView === "list" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {pagedConcludedNegotiations.map((neg: any) => {
                  const isDeliveryCancelled = (neg.deliveryStatus || "").toLowerCase() === "cancelled";
                  const pillText = isDeliveryCancelled ? "CANCELLED" : neg.status.toUpperCase();
                  const pillColor = isDeliveryCancelled
                    ? "#dc3545"
                    : neg.status === "accepted"
                      ? "#4caf50"
                      : "#9e9e9e";
                  return (
                    <div key={neg.negotiationId} style={{
                      padding: "0.75rem 1rem",
                      background: "#f9f9f9",
                      borderRadius: "8px",
                      border: "1px solid #e0e0e0"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: "600" }}>
                          {getProduceEmoji(neg.produceType)} {neg.produceType} • Unit #{neg.unitNumber}
                        </div>
                        <span style={{
                          padding: "0.2rem 0.6rem",
                          borderRadius: "999px",
                          fontSize: "0.75rem",
                          fontWeight: "600",
                          background: pillColor,
                          color: "white",
                        }}>
                          {pillText}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.35rem", fontFamily: "monospace" }}>
                        UTID: {neg.negotiationUtid}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {pagedConcludedNegotiations.map((neg: any) => (
                  <div key={neg.negotiationId} style={{
                    padding: "1rem",
                    background: "#f8f9fa",
                    borderRadius: "8px",
                    border: "1px solid #e0e0e0"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <div style={{ fontWeight: "600" }}>
                        {getProduceEmoji(neg.produceType)} {neg.produceType} - Unit #{neg.unitNumber}
                      </div>
                      {(() => {
                        const isDeliveryCancelled = (neg.deliveryStatus || "").toLowerCase() === "cancelled";
                        const pillText = isDeliveryCancelled ? "CANCELLED" : neg.status.toUpperCase();
                        const pillColor = isDeliveryCancelled
                          ? "#dc3545"
                          : neg.status === "accepted"
                            ? "#4caf50"
                            : "#9e9e9e";
                        return (
                          <span style={{
                            padding: "0.25rem 0.75rem",
                            borderRadius: "12px",
                            fontSize: "0.8rem",
                            fontWeight: "600",
                            background: pillColor,
                            color: "white",
                          }}>
                            {pillText}
                          </span>
                        );
                      })()}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>
                      UTID: {neg.negotiationUtid}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#666" }}>
                      Delivery: {neg.deliveryStatus || "Pending"}
                    </div>
                    {neg.deliveryDeadline && (
                      <div style={{ fontSize: "0.85rem", color: "#666" }}>
                        Delivery deadline: {new Date(neg.deliveryDeadline).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {concludedTotalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                <button
                  onClick={() => setConcludedNegotiationsPage((p) => Math.max(0, p - 1))}
                  disabled={concludedNegotiationsPage === 0}
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: concludedNegotiationsPage === 0 ? "#eee" : "#f5f5f5",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    cursor: concludedNegotiationsPage === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  Prev
                </button>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>
                  Page {concludedNegotiationsPage + 1} of {concludedTotalPages}
                </div>
                <button
                  onClick={() => setConcludedNegotiationsPage((p) => Math.min(concludedTotalPages - 1, p + 1))}
                  disabled={concludedNegotiationsPage >= concludedTotalPages - 1}
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: concludedNegotiationsPage >= concludedTotalPages - 1 ? "#eee" : "#f5f5f5",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    cursor: concludedNegotiationsPage >= concludedTotalPages - 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delivery Deadlines */}
      <div style={{
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "0.75rem", flexWrap: "wrap" }}>
          <h3 style={{ 
            marginTop: 0, 
            marginBottom: 0, 
            fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", 
            color: "#2c2c2c",
            fontFamily: '"Montserrat", sans-serif',
            fontWeight: "600",
            letterSpacing: "-0.01em"
          }}>
            Delivery Deadlines
          </h3>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setDeliveryDeadlinesView("list")}
              style={{
                padding: "0.4rem 0.7rem",
                background: deliveryDeadlinesView === "list" ? "#1976d2" : "#f5f5f5",
                color: deliveryDeadlinesView === "list" ? "#fff" : "#333",
                border: "1px solid #ddd",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: "500"
              }}
            >
              List
            </button>
            <button
              onClick={() => setDeliveryDeadlinesView("card")}
              style={{
                padding: "0.4rem 0.7rem",
                background: deliveryDeadlinesView === "card" ? "#1976d2" : "#f5f5f5",
                color: deliveryDeadlinesView === "card" ? "#fff" : "#333",
                border: "1px solid #ddd",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: "500"
              }}
            >
              Card
            </button>
          </div>
        </div>
        {deliveryDeadlines === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : deliveryItems.length === 0 ? (
          <p style={{ color: "#666" }}>No pending deliveries</p>
        ) : (
          <div>
            {deliveryDeadlinesView === "list" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {pagedDeliveryItems.map((delivery: any, index: number) => (
                  <div key={index} style={{
                    padding: "0.75rem 1rem",
                    background: "#f9f9f9",
                    borderRadius: "8px",
                    border: `1px solid ${delivery.isPastDeadline ? "#ef5350" : "#4caf50"}`
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: "600" }}>
                        {getProduceEmoji(delivery.produceType)} {delivery.produceType} • {delivery.kilos} kg
                      </div>
                      <span style={{
                        padding: "0.2rem 0.6rem",
                        borderRadius: "999px",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        background: delivery.isPastDeadline ? "#dc3545" : "#4caf50",
                        color: "#fff",
                      }}>
                        {delivery.isPastDeadline ? "OVERDUE" : "PENDING"}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.35rem" }}>
                      Deadline: {formatDate(delivery.deliveryDeadline)} • {formatTimeRemaining(delivery.deliveryDeadline)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {pagedDeliveryItems.map((delivery: any, index: number) => (
                <div key={index} style={{
                  padding: "1rem",
                  background: delivery.isPastDeadline ? "#ffebee" : "#e8f5e9",
                  borderRadius: "8px",
                  border: `1px solid ${delivery.isPastDeadline ? "#ef5350" : "#4caf50"}`
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
                      {getProduceEmoji(delivery.produceType)} {delivery.produceType} - {delivery.kilos} kg
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>
                      Deadline: {formatDate(delivery.deliveryDeadline)}
                    </div>
                    <div style={{
                      fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
                      fontWeight: "600",
                      color: delivery.isPastDeadline ? "#c62828" : "#2e7d32"
                    }}>
                      {delivery.isPastDeadline 
                        ? `⏰ OVERDUE by ${delivery.hoursOverdue.toFixed(1)} hours`
                        : `${delivery.hoursRemaining.toFixed(1)} hours remaining (${delivery.minutesRemaining} minutes)`}
                    </div>
                    <div style={{ fontSize: "clamp(0.75rem, 2vw, 0.8rem)", color: "#666", marginTop: "0.25rem" }}>
                      ⏰ Delivery countdown started from payment time. 6 hours deadline.
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
                        fontSize: "clamp(0.98rem, 2.8vw, 1.26rem)",
                        color: "#2c2c2c",
                        fontFamily: "monospace",
                        fontWeight: "700",
                        letterSpacing: "0.05em",
                        wordBreak: "break-all",
                      }}>
                        {delivery.lockUtid}
                      </div>
                    </div>
                    {delivery.deliveryStatus === "farmer_confirmed" && (
                      <div style={{
                        marginTop: "0.75rem",
                        padding: "0.5rem",
                        background: "#fff3cd",
                        borderRadius: "6px",
                        border: "1px solid #ffc107",
                        fontSize: "0.85rem",
                        color: "#856404",
                        fontWeight: "600",
                      }}>
                        ✅ Delivery confirmed. Awaiting admin confirmation.
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginLeft: "0.5rem" }}>
                    {!delivery.isPastDeadline && delivery.deliveryStatus === "pending" && (
                      <button
                        onClick={async () => {
                          if (window.confirm("Confirm that you have delivered this produce to the storage location?")) {
                            setConfirmingDelivery(delivery.unitId);
                            try {
                              await farmerConfirmDelivery({
                                farmerId: userId,
                                unitId: delivery.unitId,
                              });
                              setMessage({
                                type: "success",
                                text: "Delivery confirmed! Admin will now verify and complete the process.",
                              });
                              setTimeout(() => setMessage(null), 5000);
                            } catch (error: any) {
                              setMessage({
                                type: "error",
                                text: `Failed to confirm delivery: ${error.message}`,
                              });
                              setTimeout(() => setMessage(null), 5000);
                            } finally {
                              setConfirmingDelivery(null);
                            }
                          }
                        }}
                        disabled={confirmingDelivery === delivery.unitId}
                        style={{
                          padding: "0.5rem 1rem",
                          background: confirmingDelivery === delivery.unitId ? "#ccc" : "#4caf50",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          cursor: confirmingDelivery === delivery.unitId ? "not-allowed" : "pointer",
                          fontSize: "0.85rem",
                          fontWeight: "600",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {confirmingDelivery === delivery.unitId ? "Confirming..." : "Mark as Delivered"}
                      </button>
                    )}
                    {delivery.isPastDeadline && (
                      <button
                        onClick={async () => {
                          if (window.confirm("Are you sure you want to cancel and delete this overdue UTID? The trader's capital will be returned.")) {
                            // Optimistically remove from UI
                            setCancelledUnitIds(prev => new Set(prev).add(delivery.unitId));
                            setCancelling(delivery.unitId);
                            try {
                              await cancelOverdueUTID({
                                farmerId: userId,
                                unitId: delivery.unitId,
                              });
                              setMessage({
                                type: "success",
                                text: "Overdue UTID cancelled successfully. Capital has been returned to trader.",
                              });
                              setTimeout(() => setMessage(null), 5000);
                              // Keep it removed - query will refetch and confirm
                            } catch (error: any) {
                              // Revert optimistic update on error
                              setCancelledUnitIds(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(delivery.unitId);
                                return newSet;
                              });
                              setMessage({
                                type: "error",
                                text: `Failed to cancel UTID: ${error.message}`,
                              });
                              setTimeout(() => setMessage(null), 5000);
                            } finally {
                              setCancelling(null);
                            }
                          }
                        }}
                        disabled={cancelling === delivery.unitId}
                        style={{
                          padding: "0.5rem 1rem",
                          background: cancelling === delivery.unitId ? "#ccc" : "#d32f2f",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          cursor: cancelling === delivery.unitId ? "not-allowed" : "pointer",
                          fontSize: "0.85rem",
                          fontWeight: "600",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cancelling === delivery.unitId ? "Cancelling..." : "Cancel & Delete"}
                      </button>
                    )}
                  </div>
                  </div>
                </div>
              ))}
              </div>
            )}
            {deliveryTotalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                <button
                  onClick={() => setDeliveryDeadlinesPage((p) => Math.max(0, p - 1))}
                  disabled={deliveryDeadlinesPage === 0}
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: deliveryDeadlinesPage === 0 ? "#eee" : "#f5f5f5",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    cursor: deliveryDeadlinesPage === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  Prev
                </button>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>
                  Page {deliveryDeadlinesPage + 1} of {deliveryTotalPages}
                </div>
                <button
                  onClick={() => setDeliveryDeadlinesPage((p) => Math.min(deliveryTotalPages - 1, p + 1))}
                  disabled={deliveryDeadlinesPage >= deliveryTotalPages - 1}
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: deliveryDeadlinesPage >= deliveryTotalPages - 1 ? "#eee" : "#f5f5f5",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    cursor: deliveryDeadlinesPage >= deliveryTotalPages - 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expired UTIDs */}
      <div style={{
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "0.75rem", flexWrap: "wrap" }}>
          <h3 style={{ 
            marginTop: 0, 
            marginBottom: 0, 
            fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", 
            color: "#2c2c2c",
            fontFamily: '"Montserrat", sans-serif',
            fontWeight: "600",
            letterSpacing: "-0.01em"
          }}>
            Expired UTIDs
          </h3>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setExpiredUtidsView("list")}
              style={{
                padding: "0.4rem 0.7rem",
                background: expiredUtidsView === "list" ? "#1976d2" : "#f5f5f5",
                color: expiredUtidsView === "list" ? "#fff" : "#333",
                border: "1px solid #ddd",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: "500"
              }}
            >
              List
            </button>
            <button
              onClick={() => setExpiredUtidsView("card")}
              style={{
                padding: "0.4rem 0.7rem",
                background: expiredUtidsView === "card" ? "#1976d2" : "#f5f5f5",
                color: expiredUtidsView === "card" ? "#fff" : "#333",
                border: "1px solid #ddd",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: "500"
              }}
            >
              Card
            </button>
          </div>
        </div>
        {expiredUTIDs === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : expiredItems.length === 0 ? (
          <p style={{ color: "#666" }}>No expired UTIDs. All deliveries are on time!</p>
        ) : (
          <div>
            {expiredUtidsView === "list" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {pagedExpiredItems.map((expired: any, index: number) => (
                  <div key={index} style={{
                    padding: "0.75rem 1rem",
                    background: "#f9f9f9",
                    borderRadius: "8px",
                    border: "1px solid #ffc107"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: "600" }}>
                        {getProduceEmoji(expired.produceType)} {expired.produceType} • {expired.kilos} kg
                      </div>
                      <span style={{
                        padding: "0.2rem 0.6rem",
                        borderRadius: "999px",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                        background: "#dc3545",
                        color: "#fff",
                      }}>
                        EXPIRED
                      </span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.35rem", fontFamily: "monospace" }}>
                      UTID: {expired.lockUtid}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {pagedExpiredItems.map((expired: any, index: number) => (
                  <div key={index} style={{
                    padding: "1rem",
                    background: "#fff3cd",
                    borderRadius: "8px",
                    border: "1px solid #ffc107"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                      <div>
                        <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
                          {getProduceEmoji(expired.produceType)} {expired.produceType} - {expired.kilos} kg
                        </div>
                        <div style={{ fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)", color: "#c62828", fontWeight: "600" }}>
                          ⚠️ EXPIRED - {expired.hoursExpired.toFixed(1)} hours ago ({expired.daysExpired.toFixed(1)} days)
                        </div>
                      </div>
                      <button
                        onClick={() => handleArchiveUTID(expired.unitId)}
                        style={{
                          padding: "0.5rem 1rem",
                          background: "#6c757d",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
                          fontWeight: "500"
                        }}
                      >
                        Archive
                      </button>
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
                        {expired.lockUtid}
                      </div>
                    </div>
                    <div style={{ fontSize: "clamp(0.75rem, 2vw, 0.8rem)", color: "#666", marginTop: "0.25rem" }}>
                      Deadline: {formatDate(expired.deliveryDeadline)}
                    </div>
                    <div style={{ fontSize: "clamp(0.75rem, 2vw, 0.8rem)", color: "#666", marginTop: "0.25rem" }}>
                      Status: {expired.deliveryStatus}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {expiredTotalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                <button
                  onClick={() => setExpiredUtidsPage((p) => Math.max(0, p - 1))}
                  disabled={expiredUtidsPage === 0}
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: expiredUtidsPage === 0 ? "#eee" : "#f5f5f5",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    cursor: expiredUtidsPage === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  Prev
                </button>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>
                  Page {expiredUtidsPage + 1} of {expiredTotalPages}
                </div>
                <button
                  onClick={() => setExpiredUtidsPage((p) => Math.min(expiredTotalPages - 1, p + 1))}
                  disabled={expiredUtidsPage >= expiredTotalPages - 1}
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: expiredUtidsPage >= expiredTotalPages - 1 ? "#eee" : "#f5f5f5",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    cursor: expiredUtidsPage >= expiredTotalPages - 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* All Units Ledger - Comprehensive View */}
      <div style={{
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "0.75rem", flexWrap: "wrap" }}>
          <h3 style={{ 
            marginTop: 0, 
            marginBottom: 0, 
            fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", 
            color: "#2c2c2c",
            fontFamily: '"Montserrat", sans-serif',
            fontWeight: "600",
            letterSpacing: "-0.01em"
          }}>
            Transactions Ledger
          </h3>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setLedgerView("list")}
              style={{
                padding: "0.4rem 0.7rem",
                background: ledgerView === "list" ? "#1976d2" : "#f5f5f5",
                color: ledgerView === "list" ? "#fff" : "#333",
                border: "1px solid #ddd",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: "500"
              }}
            >
              List
            </button>
            <button
              onClick={() => setLedgerView("card")}
              style={{
                padding: "0.4rem 0.7rem",
                background: ledgerView === "card" ? "#1976d2" : "#f5f5f5",
                color: ledgerView === "card" ? "#fff" : "#333",
                border: "1px solid #ddd",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: "500"
              }}
            >
              Card
            </button>
          </div>
        </div>
        {allUnitsLedger === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : ledgerItems.length === 0 ? (
          <p style={{ color: "#666" }}>No listings yet. Create a listing to start tracking units.</p>
        ) : (
          <div>
            {ledgerView === "list" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {pagedLedgerItems.map((listing: any, listingIndex: number) => (
                  <div key={listingIndex} style={{
                    padding: "0.75rem 1rem",
                    background: "#f9f9f9",
                    borderRadius: "8px",
                    border: "1px solid #e0e0e0"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: "600" }}>
                        {getProduceEmoji(listing.produceType)} {listing.produceType} • {listing.totalKilos} kg ({listing.totalUnits} units)
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#666" }}>
                        Open: {listing.totals.open} | Locked: {listing.totals.locked} | Delivered: {listing.totals.delivered}
                      </div>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.35rem", fontFamily: "monospace" }}>
                      UTID: {listing.listingUtid}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {pagedLedgerItems.map((listing: any, listingIndex: number) => {
              const listingKey = listing.listingId || `listing-${listingIndex}`;
              const isExpanded = expandedListings.has(listingKey);
              
              return (
              <div key={listingIndex} style={{
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                overflow: "hidden"
              }}>
                {/* Listing Header - Clickable to Expand/Collapse */}
                <div 
                  onClick={() => {
                    const newExpanded = new Set(expandedListings);
                    if (isExpanded) {
                      newExpanded.delete(listingKey);
                    } else {
                      newExpanded.add(listingKey);
                    }
                    setExpandedListings(newExpanded);
                  }}
                  style={{
                    padding: "1rem",
                    background: "#f5f5f5",
                    borderBottom: isExpanded ? "2px solid #e0e0e0" : "none",
                    cursor: "pointer",
                    userSelect: "none"
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                        <span style={{ fontSize: "clamp(1rem, 3vw, 1.1rem)", fontWeight: "600" }}>
                          {isExpanded ? "▼" : "▶"}
                        </span>
                        <h4 style={{ 
                          margin: 0, 
                          fontSize: "clamp(1rem, 3vw, 1.1rem)", 
                          color: "#2c2c2c",
                          fontWeight: "600"
                        }}>
                          {getProduceEmoji(listing.produceType)} {listing.produceType} - {listing.totalKilos} kg ({listing.totalUnits} units)
                        </h4>
                      </div>
                      <div style={{ fontSize: "clamp(0.75rem, 2vw, 0.8rem)", color: "#666", marginBottom: "0.5rem" }}>
                        Listed: {formatDate(listing.createdAt)} | Price: {formatUGX(listing.pricePerKilo)}/kg
                      </div>
                      <div style={{ 
                        padding: "0.5rem",
                        background: "#fff",
                        borderRadius: "6px",
                        border: "1px solid #e0e0e0",
                      }}>
                        <div style={{
                          fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
                          color: "#666",
                          fontWeight: "600",
                          marginBottom: "0.25rem",
                          fontFamily: '"Montserrat", sans-serif',
                        }}>
                          Listing UTID:
                        </div>
                        <div style={{
                          fontSize: "clamp(1.1rem, 3.5vw, 1.4rem)",
                          color: "#2c2c2c",
                          fontFamily: "monospace",
                          fontWeight: "700",
                          letterSpacing: "0.05em",
                          wordBreak: "break-all",
                        }}>
                          {listing.listingUtid}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)", color: "#666", marginBottom: "0.25rem" }}>
                        <span style={{ color: "#4caf50" }}>Open: {listing.totals.open}</span> | 
                        <span style={{ color: "#2196f3" }}> Locked: {listing.totals.locked}</span> | 
                        <span style={{ color: "#2e7d32" }}> Delivered: {listing.totals.delivered}</span>
                        {listing.totals.cancelled > 0 && (
                          <span style={{ color: "#999" }}> | Cancelled: {listing.totals.cancelled}</span>
                        )}
                      </div>
                      <div style={{ fontSize: "clamp(0.9rem, 2.5vw, 1rem)", fontWeight: "600", color: "#2e7d32" }}>
                        Earnings: {formatUGX(listing.totals.totalEarnings)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Units Table - Collapsible */}
                {isExpanded && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f9f9f9", borderBottom: "2px solid #e0e0e0" }}>
                        <th style={{ 
                          padding: "0.75rem", 
                          textAlign: "left", 
                          fontSize: "clamp(0.8rem, 2.5vw, 0.85rem)",
                          fontWeight: "600",
                          color: "#2c2c2c"
                        }}>
                          Unit #
                        </th>
                        <th style={{ 
                          padding: "0.75rem", 
                          textAlign: "left", 
                          fontSize: "clamp(0.8rem, 2.5vw, 0.85rem)",
                          fontWeight: "600",
                          color: "#2c2c2c"
                        }}>
                          UTID
                        </th>
                        <th style={{ 
                          padding: "0.75rem", 
                          textAlign: "center", 
                          fontSize: "clamp(0.8rem, 2.5vw, 0.85rem)",
                          fontWeight: "600",
                          color: "#2c2c2c"
                        }}>
                          Status
                        </th>
                        <th style={{ 
                          padding: "0.75rem", 
                          textAlign: "right", 
                          fontSize: "clamp(0.8rem, 2.5vw, 0.85rem)",
                          fontWeight: "600",
                          color: "#2c2c2c"
                        }}>
                          Earnings
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {listing.units.map((unit: any, unitIndex: number) => {
                        const getStatusColor = (status: string) => {
                          if (status === "open") return { bg: "#e8f5e9", text: "#2e7d32", label: "Open" };
                          if (status === "locked") return { bg: "#e3f2fd", text: "#1976d2", label: "Locked" };
                          if (status === "delivered") return { bg: "#e8f5e9", text: "#2e7d32", label: "Delivered" };
                          return { bg: "#f5f5f5", text: "#999", label: "Cancelled" };
                        };
                        const statusStyle = getStatusColor(unit.status);

                        return (
                          <tr key={unitIndex} style={{ borderBottom: "1px solid #f0f0f0" }}>
                            <td style={{ padding: "0.75rem", fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)" }}>
                              {unit.unitNumber}
                            </td>
                            <td style={{ padding: "0.75rem" }}>
                              {unit.lockUtid ? (
                                <div>
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
                                    fontSize: "clamp(1.2rem, 3.5vw, 1.5rem)",
                                    fontFamily: "monospace",
                                    color: "#2c2c2c",
                                    fontWeight: "700",
                                    letterSpacing: "0.05em",
                                    wordBreak: "break-all",
                                  }}>
                                    {unit.lockUtid}
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: "#999" }}>-</span>
                              )}
                            </td>
                            <td style={{ padding: "0.75rem", textAlign: "center" }}>
                              <span style={{
                                padding: "0.25rem 0.75rem",
                                borderRadius: "12px",
                                fontSize: "clamp(0.75rem, 2vw, 0.8rem)",
                                fontWeight: "600",
                                background: statusStyle.bg,
                                color: statusStyle.text,
                                display: "inline-block"
                              }}>
                                {statusStyle.label}
                              </span>
                            </td>
                            <td style={{ padding: "0.75rem", textAlign: "right", fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)", fontWeight: unit.earnings > 0 ? "600" : "400", color: unit.earnings > 0 ? "#2e7d32" : "#999" }}>
                              {unit.earnings > 0 ? formatUGX(unit.earnings) : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#f9f9f9", borderTop: "2px solid #e0e0e0" }}>
                        <td colSpan={2} style={{ padding: "0.75rem", fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)", fontWeight: "600" }}>
                          Totals
                        </td>
                        <td style={{ padding: "0.75rem", textAlign: "center", fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)" }}>
                          <span style={{ color: "#4caf50" }}>O: {listing.totals.open}</span> | 
                          <span style={{ color: "#2196f3" }}> L: {listing.totals.locked}</span> | 
                          <span style={{ color: "#2e7d32" }}> D: {listing.totals.delivered}</span>
                        </td>
                        <td style={{ padding: "0.75rem", textAlign: "right", fontSize: "clamp(0.9rem, 2.5vw, 1rem)", fontWeight: "600", color: "#2e7d32" }}>
                          {formatUGX(listing.totals.totalEarnings)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                )}
              </div>
              );
            })}
              </div>
            )}
            {ledgerTotalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                <button
                  onClick={() => setLedgerPage((p) => Math.max(0, p - 1))}
                  disabled={ledgerPage === 0}
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: ledgerPage === 0 ? "#eee" : "#f5f5f5",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    cursor: ledgerPage === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  Prev
                </button>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>
                  Page {ledgerPage + 1} of {ledgerTotalPages}
                </div>
                <button
                  onClick={() => setLedgerPage((p) => Math.min(ledgerTotalPages - 1, p + 1))}
                  disabled={ledgerPage >= ledgerTotalPages - 1}
                  style={{
                    padding: "0.4rem 0.75rem",
                    background: ledgerPage >= ledgerTotalPages - 1 ? "#eee" : "#f5f5f5",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    cursor: ledgerPage >= ledgerTotalPages - 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            )}

            {/* Grand Totals */}
            {allUnitsLedger.listings.length > 0 && (
              <div style={{
                padding: "1rem",
                background: "#e8f5e9",
                borderRadius: "8px",
                border: "2px solid #4caf50"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <div style={{ fontSize: "clamp(0.9rem, 2.5vw, 1rem)", fontWeight: "600", marginBottom: "0.5rem" }}>
                      Grand Totals (All Listings)
                    </div>
                    <div style={{ fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)", color: "#666" }}>
                      <span style={{ color: "#4caf50" }}>Open: {allUnitsLedger.grandTotals.open}</span> | 
                      <span style={{ color: "#2196f3" }}> Locked: {allUnitsLedger.grandTotals.locked}</span> | 
                      <span style={{ color: "#2e7d32" }}> Delivered: {allUnitsLedger.grandTotals.delivered}</span>
                      {allUnitsLedger.grandTotals.cancelled > 0 && (
                        <span style={{ color: "#999" }}> | Cancelled: {allUnitsLedger.grandTotals.cancelled}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "clamp(1.1rem, 3vw, 1.3rem)", fontWeight: "700", color: "#2e7d32" }}>
                      Total Earnings: {formatUGX(allUnitsLedger.grandTotals.totalEarnings)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* UTID Details Modal */}
      {selectedListing && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
          onClick={() => setSelectedListing(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "clamp(1.5rem, 4vw, 2rem)",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: "clamp(1.2rem, 4vw, 1.5rem)", 
                color: "#2c2c2c",
                fontFamily: '"Montserrat", sans-serif',
                fontWeight: "600"
              }}>
                UTID Details
              </h3>
              <button
                onClick={() => setSelectedListing(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "#666",
                  padding: "0.5rem",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* UTID */}
              <div>
                <div style={{ 
                  fontSize: "clamp(1rem, 3vw, 1.2rem)", 
                  color: "#666", 
                  marginBottom: "0.5rem", 
                  fontWeight: "600",
                  fontFamily: '"Montserrat", sans-serif',
                }}>
                  Transaction UTID
                </div>
                <div style={{ 
                  fontSize: "clamp(1.12rem, 3.5vw, 1.4rem)", 
                  fontFamily: "monospace", 
                  wordBreak: "break-all",
                  color: "#2c2c2c",
                  padding: "0.75rem",
                  background: "#f5f5f5",
                  borderRadius: "8px",
                  fontWeight: "700",
                  letterSpacing: "0.05em",
                  border: "2px solid #e0e0e0"
                }}>
                  {selectedListing.utid}
                </div>
              </div>

              {/* Produce Type */}
              <div>
                <div style={{ fontSize: "clamp(0.75rem, 2vw, 0.8rem)", color: "#666", marginBottom: "0.25rem", fontWeight: "600" }}>
                  Produce Type
                </div>
                <div style={{ fontSize: "clamp(0.9rem, 2.5vw, 1rem)", color: "#1a1a1a", fontWeight: "500" }}>
                  {getProduceEmoji(selectedListing.produceType)} {selectedListing.produceType}
                </div>
              </div>

              {/* Quantity */}
              <div>
                <div style={{ fontSize: "clamp(0.75rem, 2vw, 0.8rem)", color: "#666", marginBottom: "0.25rem", fontWeight: "600" }}>
                  Quantity
                </div>
                <div style={{ fontSize: "clamp(0.9rem, 2.5vw, 1rem)", color: "#1a1a1a", fontWeight: "500" }}>
                  {selectedListing.totalKilos} kg ({selectedListing.totalUnits} units × {selectedListing.unitSize || 10} kg)
                </div>
              </div>

              {/* Price */}
              <div>
                <div style={{ fontSize: "clamp(0.75rem, 2vw, 0.8rem)", color: "#666", marginBottom: "0.25rem", fontWeight: "600" }}>
                  Price
                </div>
                <div style={{ fontSize: "clamp(0.9rem, 2.5vw, 1rem)", color: "#1a1a1a", fontWeight: "500" }}>
                  {formatUGX(selectedListing.pricePerKilo)}/kg
                </div>
                <div style={{ fontSize: "clamp(0.8rem, 2vw, 0.85rem)", color: "#666", marginTop: "0.25rem" }}>
                  Total Value: {formatUGX(selectedListing.pricePerKilo * selectedListing.totalKilos)}
                </div>
              </div>

              {/* Quality Rating */}
              {selectedListing.qualityRating && (
                <div>
                  <div style={{ fontSize: "clamp(0.75rem, 2vw, 0.8rem)", color: "#666", marginBottom: "0.25rem", fontWeight: "600" }}>
                    Quality Rating
                  </div>
                  <div style={{ fontSize: "clamp(0.9rem, 2.5vw, 1rem)", color: "#1a1a1a", fontWeight: "500" }}>
                    {selectedListing.qualityRating}
                  </div>
                </div>
              )}

              {/* Quality Comment */}
              {selectedListing.qualityComment && (
                <div>
                  <div style={{ fontSize: "clamp(0.75rem, 2vw, 0.8rem)", color: "#666", marginBottom: "0.25rem", fontWeight: "600" }}>
                    Quality Comment
                  </div>
                  <div style={{ 
                    fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)", 
                    color: "#1a1a1a",
                    padding: "0.75rem",
                    background: "#f9f9f9",
                    borderRadius: "6px",
                    whiteSpace: "pre-wrap"
                  }}>
                    {selectedListing.qualityComment}
                  </div>
                </div>
              )}

              {/* Storage Location */}
              {selectedListing.storageLocation && (
                <div>
                  <div style={{ fontSize: "clamp(0.75rem, 2vw, 0.8rem)", color: "#666", marginBottom: "0.25rem", fontWeight: "600" }}>
                    Storage Location
                  </div>
                  <div style={{ fontSize: "clamp(0.9rem, 2.5vw, 1rem)", color: "#1a1a1a", fontWeight: "500" }}>
                    {selectedListing.storageLocation.districtName} ({selectedListing.storageLocation.code})
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <div style={{ fontSize: "clamp(0.75rem, 2vw, 0.8rem)", color: "#666", marginBottom: "0.25rem", fontWeight: "600" }}>
                  Status
                </div>
                <div style={{ fontSize: "clamp(0.9rem, 2.5vw, 1rem)", color: "#1a1a1a", fontWeight: "500", textTransform: "capitalize" }}>
                  {selectedListing.status.replace("_", " ")}
                </div>
              </div>

              {/* Unit Breakdown */}
              <div>
                <div style={{ fontSize: "clamp(0.75rem, 2vw, 0.8rem)", color: "#666", marginBottom: "0.5rem", fontWeight: "600" }}>
                  Unit Breakdown
                </div>
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", 
                  gap: "0.5rem",
                  padding: "0.75rem",
                  background: "#f9f9f9",
                  borderRadius: "6px"
                }}>
                  <div>
                    <div style={{ fontSize: "clamp(0.7rem, 2vw, 0.75rem)", color: "#666" }}>Available</div>
                    <div style={{ fontSize: "clamp(0.9rem, 2.5vw, 1rem)", fontWeight: "600", color: "#4caf50" }}>
                      {selectedListing.units.available}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "clamp(0.7rem, 2vw, 0.75rem)", color: "#666" }}>Locked</div>
                    <div style={{ fontSize: "clamp(0.9rem, 2.5vw, 1rem)", fontWeight: "600", color: "#2196f3" }}>
                      {selectedListing.units.locked}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "clamp(0.7rem, 2vw, 0.75rem)", color: "#666" }}>Delivered</div>
                    <div style={{ fontSize: "clamp(0.9rem, 2.5vw, 1rem)", fontWeight: "600", color: "#2e7d32" }}>
                      {selectedListing.units.delivered}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "clamp(0.7rem, 2vw, 0.75rem)", color: "#666" }}>Cancelled</div>
                    <div style={{ fontSize: "clamp(0.9rem, 2.5vw, 1rem)", fontWeight: "600", color: "#d32f2f" }}>
                      {selectedListing.units.cancelled}
                    </div>
                  </div>
                </div>
              </div>

              {/* Created Date */}
              <div>
                <div style={{ fontSize: "clamp(0.75rem, 2vw, 0.8rem)", color: "#666", marginBottom: "0.25rem", fontWeight: "600" }}>
                  Created Date
                </div>
                <div style={{ fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)", color: "#1a1a1a" }}>
                  {formatDate(selectedListing.createdAt)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-app Help */}
      <div style={{
        marginTop: "1.5rem",
        padding: "1rem",
        background: "#f9f9f9",
        borderRadius: "10px",
        border: "1px solid #e0e0e0",
        textAlign: "center"
      }}>
        <p style={{ margin: 0, fontSize: "0.9rem", color: "#666" }}>
          Need help? Contact Admin in-app.
        </p>
        <button
          type="button"
          onClick={() => {
            setMessageInboxOpen(true);
            if (!selectedMessageUtid && defaultSupportUtid) {
              setSelectedMessageUtid(defaultSupportUtid);
            }
            if (typeof document !== "undefined") {
              document.getElementById("message-inbox")?.scrollIntoView({ behavior: "smooth" });
            }
          }}
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 0.9rem",
            background: "#1976d2",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "0.85rem",
            fontWeight: "600",
          }}
        >
          Open Inbox
        </button>
      </div>
    </div>
  );
}
