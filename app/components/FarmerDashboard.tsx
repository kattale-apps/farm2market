"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatUgandaDateTime, getUgandaTime } from "../utils/timeUtils";
import { NotificationMailbox } from "./NotificationMailbox";
import { ThreadView } from "./messages/ThreadView";
import { ContactUs } from "./ContactUs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resolveCommunityLogo } from "../lib/communityLogos";
import { useOfflineQuery } from "../hooks/useOfflineQuery";
import { useOfflineMutation } from "../hooks/useOfflineMutation";
import { savePdfFromJsPDF } from "../utils/pdfDownload";

interface FarmerDashboardProps {
  userId: Id<"users">;
  userRole?: "farmer" | "vendor" | "store";
}

export function FarmerDashboard({ userId, userRole }: FarmerDashboardProps) {
  const listings = useOfflineQuery(api.farmerDashboard.getFarmerListings, { farmerId: userId });
  const negotiations = useOfflineQuery(api.negotiations.getFarmerNegotiations, { farmerId: userId });
  const confirmations = useOfflineQuery(api.farmerDashboard.getPayToLockConfirmations, { farmerId: userId });
  const deliveryDeadlines = useOfflineQuery(api.farmerDashboard.getDeliveryDeadlines, { farmerId: userId });
  const expiredUTIDs = useOfflineQuery(api.farmerDashboard.getExpiredUTIDs, { farmerId: userId });
  const transactionsLedger = useOfflineQuery(api.farmerDashboard.getSuccessfulTransactionsLedger, { farmerId: userId });
  const allUnitsLedger = useOfflineQuery(api.farmerDashboard.getAllUnitsLedger, { farmerId: userId });
  const communities = useOfflineQuery(api.communities.getActiveCommunities, { userId });
  const effectiveRole = userRole || "farmer";
  const myAgroFreshDrafts = useOfflineQuery(
    api.farmValidation.getMyDrafts,
    effectiveRole === "farmer" ? { farmerId: userId } : "skip"
  );
  const farmerFarmcoinBalance = useOfflineQuery(
    (api as any).farmcoin.getFarmerFarmcoinBalance,
    { farmerId: userId }
  ) as any;
  const farm2MarketAccess = useOfflineQuery(
    (api as any).farmcoin.getFarm2MarketAccess,
    { farmerId: userId }
  ) as any;
  const paginationPreferences = useOfflineQuery(
    (api as any).userSettings.getPaginationPreferences,
    { userId } as any
  ) as any;
  
  const acceptOffer = useOfflineMutation(api.negotiations.acceptOffer);
  const rejectOffer = useOfflineMutation(api.negotiations.rejectOffer);
  const counterOffer = useOfflineMutation(api.negotiations.counterOffer);
  const archiveUTID = useOfflineMutation(api.farmerDashboard.archiveUTID);
  const cancelOverdueUTID = useOfflineMutation(api.farmerDashboard.cancelOverdueUTID);
  const cancelListing = useOfflineMutation(api.farmerDashboard.cancelListing);
  const farmerConfirmDelivery = useOfflineMutation(api.farmerDashboard.farmerConfirmDelivery);
  const clearConcludedNegotiations = useOfflineMutation(api.negotiations.clearConcludedNegotiations);
  const deleteSingleNegotiation = useOfflineMutation(api.negotiations.deleteSingleNegotiation);
  const messageThreads = useOfflineQuery(api.messages.getUserMessageThreads, { userId });
  const updatePaginationPreferences = useOfflineMutation(
    (api as any).userSettings.updatePaginationPreferences
  );
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
  const [transactionsPageSize, setTransactionsPageSize] = useState(5);
  const [ledgerPageSize, setLedgerPageSize] = useState(5);
  const transactionsPageKey = "farmer_transactions";
  const ledgerPageKey = "farmer_ledger";
  const ITEMS_PER_PAGE = 5;
  const SUPPORT_THREAD = "SUPPORT";
  const [isMobile, setIsMobile] = useState(false);
  const [transactionsExpanded, setTransactionsExpanded] = useState(true);
  const [ledgerExpanded, setLedgerExpanded] = useState(true);
  const [communitiesExpanded, setCommunitiesExpanded] = useState(true);
  const [clearingConcluded, setClearingConcluded] = useState(false);
  const [deletingNegId, setDeletingNegId] = useState<string | null>(null);
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
    if (!paginationPreferences) return;
    const defaultSize = paginationPreferences.defaultPageSize ?? 10;
    const nextTransactions = paginationPreferences.list?.[transactionsPageKey] ?? defaultSize;
    const nextLedger = paginationPreferences.list?.[ledgerPageKey] ?? defaultSize;
    if (nextTransactions !== transactionsPageSize) {
      setTransactionsPageSize(nextTransactions);
      setTransactionsPage(0);
    }
    if (nextLedger !== ledgerPageSize) {
      setLedgerPageSize(nextLedger);
      setLedgerPage(0);
    }
  }, [paginationPreferences, transactionsPageKey, ledgerPageKey, transactionsPageSize, ledgerPageSize]);

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

  const getTotalPages = (items: any[], pageSize = ITEMS_PER_PAGE) => Math.max(1, Math.ceil(items.length / pageSize));
  const getPageItems = (items: any[], page: number, pageSize = ITEMS_PER_PAGE) =>
    items.slice(page * pageSize, page * pageSize + pageSize);

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

  const handleExportAnalyticsPDF = async () => {
    try {
      const jsPDF = require("jspdf");
      require("jspdf-autotable");
      const doc = new jsPDF.default();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // --- Load logo for watermark ---
      let logoDataUrl: string | null = null;
      try {
        const resp = await fetch("/farm2marketlogo.jpeg");
        if (resp.ok) {
          const blob = await resp.blob();
          logoDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        }
      } catch { /* logo not available — skip watermark image */ }

      // --- Helper: add watermark + footer to current page ---
      const addWatermarkAndFooter = () => {
        // Watermark: centered, faint logo
        if (logoDataUrl) {
          const savedGState = (doc as any).internal.getCurrentPageInfo?.();
          doc.saveGraphicsState();
          (doc as any).setGState(new (doc as any).GState({ opacity: 0.08 }));
          const logoW = 70;
          const logoH = 70;
          doc.addImage(logoDataUrl, "JPEG", (pageWidth - logoW) / 2, (pageHeight - logoH) / 2, logoW, logoH);
          doc.restoreGraphicsState();
        }
        // Footer line + text on every page
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);
        doc.setFontSize(7);
        doc.setTextColor(140, 140, 140);
        doc.text("Report compiled by farm2marketuganda.com", pageWidth / 2, pageHeight - 9, { align: "center" });
      };

      // autoTable hook for pages added by tables
      const autoTableHooks = {
        didDrawPage: () => addWatermarkAndFooter(),
      };

      // --- Page 1: Title ---
      addWatermarkAndFooter();

      doc.setFontSize(18);
      doc.setTextColor(46, 125, 50);
      doc.text("Farmer Analytics Report", 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("Know Your Numbers — Farm2Market Uganda", 14, 28);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 34);

      let y = 44;

      // Listings summary
      const allListings = listings?.listings || [];
      const activeListings = allListings.filter((l: any) => l.status === "active");
      const lockedListings = allListings.filter((l: any) => l.status === "locked");

      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);
      doc.text("Listings Overview", 14, y);
      y += 8;

      (doc as any).autoTable({
        startY: y,
        head: [["Metric", "Value"]],
        body: [
          ["Total Listings", String(allListings.length)],
          ["Active Listings", String(activeListings.length)],
          ["Locked Listings", String(lockedListings.length)],
        ],
        theme: "grid",
        headStyles: { fillColor: [46, 125, 50], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14 },
        ...autoTableHooks,
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      // Negotiations summary
      const allNegotiations = negotiations?.negotiations || [];
      const activeNegs = allNegotiations.filter((n: any) => n.status === "pending" || n.status === "countered");
      const acceptedNegs = allNegotiations.filter((n: any) => n.status === "accepted");

      if (y > 240) { doc.addPage(); y = 20; addWatermarkAndFooter(); }
      doc.setFontSize(13);
      doc.text("Negotiations Summary", 14, y);
      y += 8;

      (doc as any).autoTable({
        startY: y,
        head: [["Metric", "Value"]],
        body: [
          ["Total Negotiations", String(allNegotiations.length)],
          ["Active Negotiations", String(activeNegs.length)],
          ["Accepted Negotiations", String(acceptedNegs.length)],
        ],
        theme: "grid",
        headStyles: { fillColor: [46, 125, 50], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14 },
        ...autoTableHooks,
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      // Transactions Ledger summary
      const txs = transactionsLedger?.transactions || [];
      const totalEarnings = txs.reduce((sum: number, tx: any) => sum + (tx.totalEarned || 0), 0);
      const totalKilos = txs.reduce((sum: number, tx: any) => sum + (tx.kilos || 0), 0);

      if (y > 240) { doc.addPage(); y = 20; addWatermarkAndFooter(); }
      doc.setFontSize(13);
      doc.text("Earnings Summary", 14, y);
      y += 8;

      (doc as any).autoTable({
        startY: y,
        head: [["Metric", "Value"]],
        body: [
          ["Successful Transactions", String(txs.length)],
          ["Total Kilos Sold", `${totalKilos.toLocaleString()} kg`],
          ["Total Earnings", `UGX ${totalEarnings.toLocaleString()}`],
          ["Overdue Deliveries", String(deliveryDeadlines?.overdue?.deadlines?.length || 0)],
          ["Expired UTIDs", String(expiredUTIDs?.expiredUTIDs?.length || 0)],
        ],
        theme: "grid",
        headStyles: { fillColor: [46, 125, 50], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14 },
        ...autoTableHooks,
      });

      void savePdfFromJsPDF(doc, `farmer_analytics_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (e) {
      alert("PDF export failed. Please try again.");
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
  const pagedTransactions = getPageItems(transactionItems, transactionsPage, transactionsPageSize);
  const transactionTotalPages = getTotalPages(transactionItems, transactionsPageSize);

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
    ? [...(deliveryDeadlines.overdue?.deadlines || []), ...(deliveryDeadlines.pending?.deadlines || [])].filter(
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
  const pagedLedgerItems = getPageItems(sortedLedgerItems, ledgerPage, ledgerPageSize);
  const ledgerTotalPages = getTotalPages(sortedLedgerItems, ledgerPageSize);

  const user = useOfflineQuery(api.auth.getUser, { userId });
  const profile = useOfflineQuery(api.farmerProfile.getFarmerProfile, { farmerId: userId });

  // Format location display
  const locationDisplay = profile
    ? [profile.districtName, profile.subcountyName, profile.parishName]
        .filter(Boolean)
        .join(", ") || "Location not set"
    : "Loading...";

  const normalizeCommunityKey = (value?: string) =>
    (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const agroFreshCommunityId = process.env.NEXT_PUBLIC_AGROFRESH_COMMUNITY_ID;

  const isAgroFreshMember = effectiveRole === "farmer" &&
    (Array.isArray(communities) && communities.some((c: any) => {
      if (agroFreshCommunityId && c.id === agroFreshCommunityId) return !!c.isMember;
      const nameKey = normalizeCommunityKey(c.name);
      const descriptionKey = normalizeCommunityKey(c.description);
      return (nameKey.includes("agrofresh") || descriptionKey.includes("agrofresh")) && c.isMember;
    }));

  const memberCommunities = (Array.isArray(communities) ? communities : []).filter((c: any) => c.isMember);

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

  const communitiesSection = (
    <div style={{
      marginTop: "1.5rem",
      padding: "clamp(1rem, 3vw, 1.5rem)",
      background: "#fff",
      borderRadius: "12px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      border: "1px solid #e0e0e0",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: communitiesExpanded ? "1rem" : 0 }}>
        <h3 style={{
          margin: 0,
          fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)",
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "600",
          letterSpacing: "-0.01em"
        }}>
          🌾 My Communities
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => setCommunitiesExpanded((prev) => !prev)}
            style={{
              padding: "0.4rem 0.8rem",
              background: "#f5f5f5",
              color: "#4b5563",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
              minWidth: isMobile ? "auto" : "108px",
            }}
            aria-expanded={communitiesExpanded}
            aria-label={communitiesExpanded ? "Hide communities" : "Show communities"}
          >
            {communitiesExpanded ? "Hide ▲" : "Show ▼"}
          </button>
          <Link
            href="/farmer/communities"
            style={{
              padding: "0.4rem 0.8rem",
              background: "#fff",
              color: "#1976d2",
              textDecoration: "none",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: "600",
              border: "1px solid #1976d2",
              transition: "background 0.2s",
            }}
          >
            Browse All
          </Link>
        </div>
      </div>
      {!communitiesExpanded ? (
        <p style={{ color: "#9ca3af", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
          Communities list hidden.
        </p>
      ) : !communities ? (
        <p style={{ color: "#999", fontSize: "0.9rem" }}>Loading communities...</p>
      ) : memberCommunities.length === 0 ? (
        <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
          You haven&apos;t joined any communities yet.{" "}
          <Link href="/farmer/communities" style={{ color: "#1976d2", fontWeight: 600 }}>Browse communities</Link>
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
          {memberCommunities.map((c: any) => {
            const logo = resolveCommunityLogo(c);
            return (
              <div key={c.id} style={{
                  borderRadius: "14px",
                  overflow: "hidden",
                  border: "1px solid #c8e6c9",
                  boxShadow: "0 2px 10px rgba(46,125,50,0.08)",
                  background: logo
                    ? `linear-gradient(rgba(255,255,255,0.92),rgba(255,255,255,0.92)), url('${logo}')`
                    : "#fff",
                  backgroundRepeat: "repeat",
                  backgroundSize: "120px",
                  transition: "box-shadow 0.2s",
                  position: "relative",
                }}>
                  <div style={{
                    padding: "1rem 1.25rem",
                    background: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)",
                    borderBottom: "2px solid #a5d6a7",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: "50%",
                      background: "#fff", border: "2px solid #43a047",
                      boxShadow: "0 2px 8px rgba(67,160,71,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      overflow: "hidden", flexShrink: 0,
                    }}>
                      {logo ? (
                        <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      ) : (
                        <span style={{ fontSize: "1.3rem", fontWeight: 800, color: "#43a047" }}>
                          {c.name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h4 style={{
                        margin: 0, fontSize: "0.95rem", fontWeight: 700,
                        color: "#1b5e20", textTransform: "uppercase",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{c.name}</h4>
                      {c.description && (
                        <p style={{
                          margin: "0.15rem 0 0", fontSize: "0.78rem", color: "#555",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{c.description}</p>
                      )}
                    </div>
                  </div>
                  <div style={{ padding: "0.75rem 1.25rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{
                      padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem",
                      fontWeight: 600, background: "#e8f5e9", color: "#2e7d32", border: "1px solid #c8e6c9",
                    }}>
                      ✅ Member
                    </span>
                    {c.isGlobal && (
                      <span style={{
                        padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem",
                        fontWeight: 600, background: "#e3f2fd", color: "#1565c0", border: "1px solid #90caf9",
                      }}>
                        Global
                      </span>
                    )}
                    {c.showMemberCount !== false && c.memberCount !== undefined && (
                      <span style={{
                        padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.75rem",
                        fontWeight: 600, background: "#f5f5f5", color: "#666", border: "1px solid #e0e0e0",
                      }}>
                        {c.memberCount} members
                      </span>
                    )}
                  </div>
                  <div style={{ padding: "0 1.25rem 1rem" }}>
                    <button
                      onClick={() => router.push(`/community-only/noticeboard?communityId=${c.id}`)}
                      style={{
                        width: "100%",
                        padding: "0.7rem 1rem",
                        background: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "10px",
                        fontSize: "0.9rem",
                        fontWeight: 700,
                        fontFamily: '"Montserrat", sans-serif',
                        cursor: "pointer",
                        minHeight: "44px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        transition: "opacity 0.2s",
                      }}
                    >
                      🌾 Open Community
                    </button>
                  </div>
                </div>
            );
          })}
        </div>
      )}
    </div>
  );

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
          <div style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h2 style={{ 
              fontSize: "clamp(1.5rem, 4vw, 1.8rem)", 
              margin: 0, 
              color: "#2c2c2c",
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: "700",
              letterSpacing: "-0.02em"
            }}>
              Hello, {effectiveRole === "vendor" ? "Vendor 🏪" : effectiveRole === "store" ? "Store 🏬" : "Farmer 👩🏾‍🌾"}
            </h2>
            {typeof farmerFarmcoinBalance === "number" && (
              <div style={{
                background: "linear-gradient(135deg, #fff8e1, #ffecb3)",
                border: "1.5px solid #f9a825",
                borderRadius: 20,
                padding: "4px 12px",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "#f57f17",
                fontFamily: '"Montserrat", sans-serif',
                boxShadow: "0 2px 6px rgba(249,168,37,0.25)",
              }}>
                🪙 {farmerFarmcoinBalance}
              </div>
            )}
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
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "0.75rem",
          alignItems: "stretch",
          width: isMobile ? "100%" : "min(460px, 100%)",
          minWidth: 0,
        }}>
          <Link
            href="/farmer/profile"
            style={{
              padding: "0.85rem 0.7rem",
              background: "#e3f2fd",
              color: "#1565c0",
              textDecoration: "none",
              borderRadius: "12px",
              border: "2px solid #2196f3",
              boxShadow: "0 4px 12px rgba(33, 150, 243, 0.28)",
              fontSize: "clamp(0.92rem, 2.8vw, 1rem)",
              fontWeight: "600",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "64px",
              width: "100%",
              minWidth: 0,
              textAlign: "center",
            }}
          >
            Profile
          </Link>
          <div id="notification-inbox" style={{ width: "100%", minWidth: 0 }}>
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
              padding: "0.85rem 0.7rem",
              background: messageInboxOpen ? "#1976d2" : "#e3f2fd",
              color: messageInboxOpen ? "#fff" : "#1565c0",
              border: "2px solid #2196f3",
              boxShadow: messageInboxOpen
                ? "0 6px 16px rgba(25, 118, 210, 0.35)"
                : "0 4px 12px rgba(33, 150, 243, 0.28)",
              borderRadius: "12px",
              cursor: "pointer",
              fontSize: "clamp(0.92rem, 2.8vw, 1rem)",
              fontWeight: "600",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "64px",
              width: "100%",
              minWidth: 0,
              textAlign: "center",
            }}
          >
            📩 Inbox {Array.isArray(messageThreads) && messageThreads.length > 0
              ? `(${messageThreads.reduce((sum: number, t: any) => sum + (t.unreadCount || 0), 0)})`
              : ""}
          </button>
        </div>
      </div>

      {/* 4-card 2x2 Dashboard Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0.8rem",
        marginBottom: "1.25rem",
        alignItems: "stretch",
      }}>
        <Link href="/farmer/farm-needs" style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.45rem",
          padding: "0.95rem",
          background: "#d32f2f",
          border: "2px solid #c62828",
          borderRadius: "14px",
          textDecoration: "none",
          color: "#fff",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: 700,
          fontSize: "clamp(0.8rem,2.4vw,0.95rem)",
          boxShadow: "0 0 0 2px rgba(244,67,54,0.22), 0 8px 18px rgba(183,28,28,0.28)",
          minHeight: 88,
          minWidth: 0,
          textAlign: "center",
          overflowWrap: "anywhere",
        }}>
          <span style={{ fontSize: "1.9rem", textShadow: "0 0 10px rgba(255,255,255,0.55), 0 0 16px rgba(255,205,210,0.65)" }}>🌱</span>
          Farm Needs
        </Link>
        <Link href="/farmer/toolbox" style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.45rem",
          padding: "0.95rem",
          background: "#2e7d32",
          border: "2px solid #2e7d32",
          borderRadius: "14px",
          textDecoration: "none",
          color: "#fff",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: 700,
          fontSize: "clamp(0.8rem,2.4vw,0.95rem)",
          boxShadow: "0 0 0 2px rgba(102,187,106,0.24), 0 8px 18px rgba(27,94,32,0.26)",
          minHeight: 88,
          minWidth: 0,
          textAlign: "center",
          overflowWrap: "anywhere",
        }}>
          <span style={{ fontSize: "1.9rem", textShadow: "0 0 10px rgba(255,255,255,0.5), 0 0 16px rgba(200,230,201,0.65)" }}>🧰</span>
          Farm Toolbox
        </Link>
        <Link href="/farmer/planner" style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.45rem",
          padding: "0.95rem",
          background: "#1565c0",
          border: "2px solid #1565c0",
          borderRadius: "14px",
          textDecoration: "none",
          color: "#fff",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: 700,
          fontSize: "clamp(0.8rem,2.4vw,0.95rem)",
          boxShadow: "0 0 0 2px rgba(100,181,246,0.25), 0 8px 18px rgba(13,71,161,0.27)",
          minHeight: 88,
          minWidth: 0,
          textAlign: "center",
          overflowWrap: "anywhere",
        }}>
          <span style={{ fontSize: "1.9rem", textShadow: "0 0 10px rgba(255,255,255,0.55), 0 0 16px rgba(187,222,251,0.7)" }}>🗓️</span>
          Farm Calender
        </Link>
        <Link href="/farmer/farm2market" style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.45rem",
          padding: "0.95rem",
          background: "#fbc02d",
          border: "2px solid #f9a825",
          borderRadius: "14px",
          textDecoration: "none",
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: 700,
          fontSize: "clamp(0.8rem,2.4vw,0.95rem)",
          boxShadow: "0 0 0 2px rgba(255,224,130,0.35), 0 8px 18px rgba(249,168,37,0.3)",
          minHeight: 88,
          minWidth: 0,
          textAlign: "center",
          overflowWrap: "anywhere",
          position: "relative",
          opacity: 1,
        }}>
          {/* Lock badge — shown only when access is blocked */}
          {farm2MarketAccess?.allowed === false && (
            <span
              title={farm2MarketAccess.reason ?? "Unlock Farm 2 Market by earning more FarmCoins"}
              style={{
                position: "absolute",
                top: 6,
                right: 8,
                fontSize: "1rem",
                lineHeight: 1,
                cursor: "help",
              }}
              aria-label="Locked"
            >
              🔒
            </span>
          )}
          <span style={{ fontSize: "1.9rem", textShadow: "0 0 10px rgba(255,255,255,0.55), 0 0 16px rgba(255,241,118,0.8)" }}>🛒</span>
          Farm 2 Market
          {/* Informer handle — shows progress toward 500 FarmCoins threshold */}
          {farm2MarketAccess?.allowed === false && (
            <span style={{
              fontSize: "0.65rem",
              fontWeight: 600,
              color: "#795548",
              lineHeight: 1.2,
              marginTop: "0.1rem",
            }}>
              🪙 {farm2MarketAccess.balance ?? 0} / 500
            </span>
          )}
        </Link>
      </div>

      {communitiesSection}

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
          {messageThreads === undefined || !Array.isArray(messageThreads) ? (
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
