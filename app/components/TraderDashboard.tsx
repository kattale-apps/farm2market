"use client";

import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { TraderListings } from "./TraderListings";
import { CreateTraderListing } from "./CreateTraderListing";
import { useEffect, useMemo, useRef, useState } from "react";
import { exportToExcel, exportToPDF, formatUTIDDataForExport } from "../utils/exportUtils";
import { exportUTIDsByCategory, exportUTIDsByCategoryPDF, exportInventoryVolume, exportCapitalVolume } from "../utils/traderReports";
import { NotificationMailbox } from "./NotificationMailbox";
import { ThreadView } from "./messages/ThreadView";
import { formatUgandaDateTime, formatUgandaTimeOnly, getUgandaTime } from "../utils/timeUtils";
import { ContactUs } from "./ContactUs";

interface TraderDashboardProps {
  userId: Id<"users">;
  userRole?: "trader" | "transporter";
}

export function TraderDashboard({ userId, userRole }: TraderDashboardProps) {
  const ledger = useQuery(api.traderDashboard.getLedgerBreakdown, { traderId: userId });
  const exposure = useQuery(api.traderDashboard.getExposureStatus, { traderId: userId });
  const inventory = useQuery(api.traderDashboard.getInventoryWithProjectedLoss, { traderId: userId });
  const activeUTIDs = useQuery(api.traderDashboard.getTraderActiveUTIDs, { traderId: userId });
  const storageFeeRate = useQuery(api.traderDashboard.getTraderStorageFeeRate, { traderId: userId });
  const initiateDeposit = useAction(api.pesapal.initiateTraderDeposit);
  const paymentTransactions = useQuery(api.pesapal.getUserPaymentTransactions, { userId });
  const buyOffers = useQuery(api.traderBuyerNegotiations.getTraderBuyOffers, { traderId: userId });
  const traderSales = useQuery(api.traderDashboard.getTraderSales, { traderId: userId });
  const messageThreads = useQuery(api.messages.getUserMessageThreads, { userId });
  const acceptBuyerOffer = useMutation(api.traderBuyerNegotiations.acceptBuyerOffer);
  const rejectBuyerOffer = useMutation(api.traderBuyerNegotiations.rejectBuyerOffer);
  const counterBuyerOffer = useMutation(api.traderBuyerNegotiations.counterBuyerOffer);
  const farmcoinSummary = useQuery(api.farmcoin.getTraderFarmcoinSummary, { traderId: userId });
  const sentifySummary = useQuery((api as any).farmcoin.getSentifyWalletSummary, { userId } as any);
  const sentifyReceipts = useQuery((api as any).farmcoin.getSentifyReceipts, { userId } as any);
  const traderDeliveryBatches = useQuery((api as any).buyers.getTraderDeliveryBatches, { traderId: userId } as any);
  const traderConfirmListingDelivery = useMutation((api as any).buyers.traderConfirmListingDelivery);
  const cashOutSentifyReceipt = useMutation((api as any).farmcoin.cashOutSentifyReceipt);
  const paginationPreferences = useQuery(
    (api as any).userSettings.getPaginationPreferences,
    { userId } as any
  );
  const updatePaginationPreferences = useMutation(
    (api as any).userSettings.updatePaginationPreferences
  );

  const [depositAmount, setDepositAmount] = useState<string>("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositMessage, setDepositMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sentifyReceiptUtid, setSentifyReceiptUtid] = useState<string>("");
  const [sentifyPhone, setSentifyPhone] = useState<string>("");
  const [sentifyMessage, setSentifyMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [proView, setProView] = useState(false);
  const [counterPrices, setCounterPrices] = useState<{ [key: string]: string }>({});
  const [processingOffers, setProcessingOffers] = useState<{ [key: string]: boolean }>({});
  const [offerMessages, setOfferMessages] = useState<{ [key: string]: { type: "success" | "error"; text: string } }>({});
  const user = useQuery(api.auth.getUser, { userId });
  const [messageInboxOpen, setMessageInboxOpen] = useState(false);
  const [selectedMessageUtid, setSelectedMessageUtid] = useState<string | null>(null);
  const SUPPORT_THREAD = "SUPPORT";
  const [isMobile, setIsMobile] = useState(false);
  const inboxRef = useRef<HTMLDivElement>(null);
  const [isInboxNarrow, setIsInboxNarrow] = useState(false);
  const isInboxStacked = isMobile || isInboxNarrow;
  const activeThreadUtid = selectedMessageUtid || messageThreads?.[0]?.utid || SUPPORT_THREAD;
  const [openListingsPage, setOpenListingsPage] = useState(1);
  const [activeUtidPage, setActiveUtidPage] = useState(1);
  const [buyOffersPage, setBuyOffersPage] = useState(1);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [todayActivityPage, setTodayActivityPage] = useState(1);
  const [openListingsPageSize, setOpenListingsPageSize] = useState(10);
  const [activeUtidPageSize, setActiveUtidPageSize] = useState(10);
  const [buyOffersPageSize, setBuyOffersPageSize] = useState(10);
  const [inventoryPageSize, setInventoryPageSize] = useState(10);
  const [todayActivityPageSize, setTodayActivityPageSize] = useState(10);
  const openListingsPageKey = "trader_open_listings";
  const activeUtidPageKey = "trader_active_utids";
  const buyOffersPageKey = "trader_buy_offers";
  const inventoryPageKey = "trader_inventory";
  const todayActivityPageKey = "trader_today_activity";

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

  useEffect(() => {
    if (!paginationPreferences) return;
    const defaultSize = paginationPreferences.defaultPageSize ?? 10;
    const nextOpenListings = paginationPreferences.list?.[openListingsPageKey] ?? defaultSize;
    const nextActiveUtids = paginationPreferences.list?.[activeUtidPageKey] ?? defaultSize;
    const nextBuyOffers = paginationPreferences.list?.[buyOffersPageKey] ?? defaultSize;
    const nextInventory = paginationPreferences.list?.[inventoryPageKey] ?? defaultSize;
    const nextToday = paginationPreferences.list?.[todayActivityPageKey] ?? defaultSize;

    if (nextOpenListings !== openListingsPageSize) {
      setOpenListingsPageSize(nextOpenListings);
      setOpenListingsPage(1);
    }
    if (nextActiveUtids !== activeUtidPageSize) {
      setActiveUtidPageSize(nextActiveUtids);
      setActiveUtidPage(1);
    }
    if (nextBuyOffers !== buyOffersPageSize) {
      setBuyOffersPageSize(nextBuyOffers);
      setBuyOffersPage(1);
    }
    if (nextInventory !== inventoryPageSize) {
      setInventoryPageSize(nextInventory);
      setInventoryPage(1);
    }
    if (nextToday !== todayActivityPageSize) {
      setTodayActivityPageSize(nextToday);
      setTodayActivityPage(1);
    }
  }, [
    paginationPreferences,
    openListingsPageKey,
    activeUtidPageKey,
    buyOffersPageKey,
    inventoryPageKey,
    todayActivityPageKey,
    openListingsPageSize,
    activeUtidPageSize,
    buyOffersPageSize,
    inventoryPageSize,
    todayActivityPageSize,
  ]);

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

  const handleTraderDeliveryConfirm = async (batchUtid: string) => {
    try {
      await traderConfirmListingDelivery({
        traderId: userId,
        listingUtid: batchUtid,
      });
      setSentifyMessage({ type: "success", text: "Delivery confirmed. Await buyer and superadmin confirmation." });
    } catch (error: any) {
      setSentifyMessage({ type: "error", text: error?.message || "Failed to confirm delivery" });
    }
  };

  const handleSentifyCashout = async () => {
    if (!sentifyReceiptUtid || !sentifyPhone.trim()) {
      setSentifyMessage({ type: "error", text: "Select a receipt and enter a phone number" });
      return;
    }

    try {
      const result = await cashOutSentifyReceipt({
        traderId: userId,
        receiptUtid: sentifyReceiptUtid,
        phoneNumber: sentifyPhone.trim(),
      });
      setSentifyMessage({ type: "success", text: `Cash-out processed. UGX ${result.payoutAmount.toFixed(2)} requested.` });
      setSentifyReceiptUtid("");
    } catch (error: any) {
      setSentifyMessage({ type: "error", text: error?.message || "Cash-out failed" });
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

  const handleExportAnalyticsPDF = () => {
    try {
      const jsPDF = require("jspdf");
      require("jspdf-autotable");
      const doc = new jsPDF.default();

      doc.setFontSize(18);
      doc.setTextColor(46, 125, 50);
      doc.text("Trader Analytics Report", 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("Know Your Numbers — Farm2Market Uganda", 14, 28);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 34);

      let y = 44;

      // Capital & Exposure
      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);
      doc.text("Capital & Exposure", 14, y);
      y += 8;

      const capitalRows: string[][] = [];
      if (ledger) {
        capitalRows.push(["Capital Balance", `UGX ${(ledger.capital?.balance || 0).toLocaleString()}`]);
        capitalRows.push(["Capital Locked", `UGX ${(ledger.capital?.locked || 0).toLocaleString()}`]);
        capitalRows.push(["Capital Available", `UGX ${(ledger.capital?.available || 0).toLocaleString()}`]);
      }


      if (capitalRows.length > 0) {
        (doc as any).autoTable({
          startY: y,
          head: [["Metric", "Value"]],
          body: capitalRows,
          theme: "grid",
          headStyles: { fillColor: [46, 125, 50], fontSize: 9 },
          bodyStyles: { fontSize: 8 },
          margin: { left: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 12;
      }

      // Inventory
      const inv = inventory?.inventory || [];
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.text("Inventory Summary", 14, y);
      y += 8;

      const totalKilos = inv.reduce((s: number, i: any) => s + (i.kilos || 0), 0);
      const totalValue = inv.reduce((s: number, i: any) => s + ((i.kilos || 0) * (i.pricePerKilo || 0)), 0);

      (doc as any).autoTable({
        startY: y,
        head: [["Metric", "Value"]],
        body: [
          ["Inventory Items", String(inv.length)],
          ["Total Kilos in Storage", `${totalKilos.toLocaleString()} kg`],
          ["Estimated Inventory Value", `UGX ${totalValue.toLocaleString()}`],
          ["Storage Fee Rate", `${storageFeeRate?.rateKgPerDay || 0} UGX/kg/day`],
        ],
        theme: "grid",
        headStyles: { fillColor: [25, 118, 210], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      // Active UTIDs
      const utids = activeUTIDs?.utids || [];
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.text("UTID Activity", 14, y);
      y += 8;

      const lockedUtids = utids.filter((u: any) => u.type === "lock" || u.status === "locked");
      const salesUtids = utids.filter((u: any) => u.type === "sale" || u.status === "sold");

      (doc as any).autoTable({
        startY: y,
        head: [["Metric", "Value"]],
        body: [
          ["Total Active UTIDs", String(utids.length)],
          ["Locked UTIDs", String(lockedUtids.length)],
          ["Sales UTIDs", String(salesUtids.length)],
        ],
        theme: "grid",
        headStyles: { fillColor: [245, 124, 0], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14 },
      });

      // FarmCoin
      if (farmcoinSummary) {
        y = (doc as any).lastAutoTable.finalY + 12;
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(13);
        doc.text("FarmCoin Tokens", 14, y);
        y += 8;

        (doc as any).autoTable({
          startY: y,
          head: [["Metric", "Value"]],
          body: [
            ["Token Balance", String(farmcoinSummary.balance || 0)],
          ],
          theme: "grid",
          headStyles: { fillColor: [0, 131, 143], fontSize: 9 },
          bodyStyles: { fontSize: 8 },
          margin: { left: 14 },
        });
      }

      doc.save(`trader_analytics_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (e) {
      alert("PDF export failed. Please try again.");
    }
  };

  // Get open listings (from farmers)
  const openListings = useQuery(api.listings.getActiveListings);
  const getSortTimestamp = (item: any) => {
    const raw =
      item?.timestamp ??
      item?.updatedAt ??
      item?.createdAt ??
      item?.lastUpdatedAt ??
      item?.storageStartTime ??
      item?._creationTime ??
      0;
    if (typeof raw === "number") {
      return raw;
    }
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const sortedOpenListings = useMemo(() => {
    if (!openListings) return [];
    return [...openListings].sort((a: any, b: any) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [openListings]);

  const sortedActiveUtids = useMemo(() => {
    if (!activeUTIDs?.utids) return [];
    return [...activeUTIDs.utids].sort((a: any, b: any) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [activeUTIDs]);
  const sortedBuyOffers = useMemo(() => {
    if (!buyOffers?.negotiations) return [];
    return [...buyOffers.negotiations].sort((a: any, b: any) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [buyOffers]);
  const sortedInventory = useMemo(() => {
    if (!inventory?.inventory) return [];
    return [...inventory.inventory].sort((a: any, b: any) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [inventory]);

  const openListingsTotal = sortedOpenListings.length;
  const openListingsTotalPages = Math.max(1, Math.ceil(openListingsTotal / openListingsPageSize));
  const openListingsStart = openListingsTotal === 0 ? 0 : (openListingsPage - 1) * openListingsPageSize + 1;
  const openListingsEnd = Math.min(openListingsPage * openListingsPageSize, openListingsTotal);
  const pagedOpenListings = sortedOpenListings.slice(
    (openListingsPage - 1) * openListingsPageSize,
    openListingsPage * openListingsPageSize
  );

  const activeUtidsTotal = sortedActiveUtids.length;
  const activeUtidsTotalPages = Math.max(1, Math.ceil(activeUtidsTotal / activeUtidPageSize));
  const activeUtidsStart = activeUtidsTotal === 0 ? 0 : (activeUtidPage - 1) * activeUtidPageSize + 1;
  const activeUtidsEnd = Math.min(activeUtidPage * activeUtidPageSize, activeUtidsTotal);
  const pagedActiveUtids = sortedActiveUtids.slice(
    (activeUtidPage - 1) * activeUtidPageSize,
    activeUtidPage * activeUtidPageSize
  );
  const buyOffersTotal = sortedBuyOffers.length;
  const buyOffersTotalPages = Math.max(1, Math.ceil(buyOffersTotal / buyOffersPageSize));
  const buyOffersStart = buyOffersTotal === 0 ? 0 : (buyOffersPage - 1) * buyOffersPageSize + 1;
  const buyOffersEnd = Math.min(buyOffersPage * buyOffersPageSize, buyOffersTotal);
  const pagedBuyOffers = sortedBuyOffers.slice(
    (buyOffersPage - 1) * buyOffersPageSize,
    buyOffersPage * buyOffersPageSize
  );
  const inventoryTotal = sortedInventory.length;
  const inventoryTotalPages = Math.max(1, Math.ceil(inventoryTotal / inventoryPageSize));
  const inventoryStart = inventoryTotal === 0 ? 0 : (inventoryPage - 1) * inventoryPageSize + 1;
  const inventoryEnd = Math.min(inventoryPage * inventoryPageSize, inventoryTotal);
  const pagedInventory = sortedInventory.slice(
    (inventoryPage - 1) * inventoryPageSize,
    inventoryPage * inventoryPageSize
  );

  useEffect(() => {
    if (openListingsPage > openListingsTotalPages) {
      setOpenListingsPage(openListingsTotalPages);
    }
  }, [openListingsPage, openListingsTotalPages]);

  useEffect(() => {
    if (activeUtidPage > activeUtidsTotalPages) {
      setActiveUtidPage(activeUtidsTotalPages);
    }
  }, [activeUtidPage, activeUtidsTotalPages]);
  useEffect(() => {
    if (buyOffersPage > buyOffersTotalPages) {
      setBuyOffersPage(buyOffersTotalPages);
    }
  }, [buyOffersPage, buyOffersTotalPages]);
  useEffect(() => {
    if (inventoryPage > inventoryTotalPages) {
      setInventoryPage(inventoryTotalPages);
    }
  }, [inventoryPage, inventoryTotalPages]);

  // Calculate today's activity with UTIDs and Purchase/Sell status
  const today = Date.now();
  const dayStart = today - (today % (24 * 60 * 60 * 1000));
  
  // Get today's purchases (from farmers - unit locks)
  const todayPurchases = (activeUTIDs?.utids || []).filter((utid: any) => {
    return utid.timestamp && utid.timestamp >= dayStart && utid.type === "unit_lock";
  }).map((utid: any) => {
    let purchaseStatus = "Confirmed";
    if (utid.status === "pending") {
      purchaseStatus = "Pending Delivery";
    } else if (utid.status === "delivered") {
      purchaseStatus = "Confirmed";
    }
    return {
      ...utid,
      transactionType: "Purchase",
      status: purchaseStatus,
    };
  });

  // Get today's sales (to buyers - buyer purchases from trader inventory)
  const todaySales = (traderSales?.sales || []).filter((sale: any) => {
    return sale.purchasedAt && sale.purchasedAt >= dayStart;
  }).map((sale: any) => {
    return {
      utid: sale.purchaseUtid,
      timestamp: sale.purchasedAt,
      transactionType: "Sell",
      status: "Confirmed", // Sales are always confirmed once purchase is made
      type: "buyer_purchase",
      produceType: sale.produceType,
      kilos: sale.kilos,
      buyerAlias: sale.buyerAlias,
    };
  });

  // Get today's trader-buyer negotiations (pending offers)
  const todayNegotiations = (buyOffers?.negotiations || []).filter((neg: any) => {
    return neg.lastUpdatedAt && neg.lastUpdatedAt >= dayStart;
  }).map((neg: any) => {
    let sellStatus = "Pending Acceptance/Rejection";
    if (neg.status === "accepted") {
      sellStatus = "Confirmed";
    } else if (neg.status === "pending" || neg.status === "countered") {
      sellStatus = "Pending Acceptance/Rejection";
    }
    return {
      utid: neg.negotiationUtid,
      timestamp: neg.lastUpdatedAt,
      transactionType: "Sell",
      status: sellStatus,
      type: "trader_buyer_negotiation",
      produceType: neg.produceType,
      kilos: neg.kilos,
      buyerAlias: neg.buyerAlias,
    };
  });

  // Combine all activities
  const todayActivity = [...todayPurchases, ...todaySales, ...todayNegotiations].sort((a, b) => b.timestamp - a.timestamp);
  const todayActivityTotal = todayActivity.length;
  const todayActivityTotalPages = Math.max(1, Math.ceil(todayActivityTotal / todayActivityPageSize));
  const todayActivityStart = todayActivityTotal === 0 ? 0 : (todayActivityPage - 1) * todayActivityPageSize + 1;
  const todayActivityEnd = Math.min(todayActivityPage * todayActivityPageSize, todayActivityTotal);
  const pagedTodayActivity = todayActivity.slice(
    (todayActivityPage - 1) * todayActivityPageSize,
    todayActivityPage * todayActivityPageSize
  );
  useEffect(() => {
    if (todayActivityPage > todayActivityTotalPages) {
      setTodayActivityPage(todayActivityTotalPages);
    }
  }, [todayActivityPage, todayActivityTotalPages]);

  return (
    <div style={{ padding: "clamp(0.75rem, 2vw, 1rem)", maxWidth: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <h2 style={{ 
              fontSize: "clamp(1.5rem, 4vw, 1.8rem)", 
              marginBottom: "0.5rem", 
              color: "#2c2c2c",
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: "700",
              letterSpacing: "-0.02em"
            }}>
              {userRole === "transporter" ? "Transporter" : "Trader"}: {user?.alias || (userRole === "transporter" ? "Transporter" : "Trader")}
            </h2>
            {(user as any)?.isVerifiedTrader && (user as any)?.verificationStatus === "verified" && (
              <span style={{
                padding: "0.25rem 0.6rem",
                borderRadius: "999px",
                fontSize: "0.8rem",
                fontWeight: "600",
                background: "#e8f5e9",
                color: "#2e7d32",
                border: "1px solid #81c784",
              }}>
                Verified
              </span>
            )}
          </div>
          <p style={{ 
            color: "#3d3d3d", 
            fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
            fontFamily: '"Montserrat", sans-serif'
          }}>
            Location: District
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <NotificationMailbox userId={userId} />
          <button
            type="button"
            onClick={() => {
              const nextOpen = !messageInboxOpen;
              setMessageInboxOpen(nextOpen);
              if (nextOpen && !selectedMessageUtid) {
                setSelectedMessageUtid(SUPPORT_THREAD);
              }
            }}
            style={{
              padding: "0.5rem 1rem",
              background: messageInboxOpen ? "#1976d2" : "#f5f5f5",
              color: messageInboxOpen ? "#fff" : "#333",
              border: "1px solid #ddd",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: "600"
            }}
          >
            ≡ƒô⌐ Inbox {messageThreads && messageThreads.length > 0
              ? `(${messageThreads.reduce((sum, t) => sum + (t.unreadCount || 0), 0)})`
              : ""}
          </button>
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
              <ThreadView userId={userId} utid={SUPPORT_THREAD} />
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

      {!proView ? (
        /* Simple View (Default) */
        <>
          {/* FarmCoin Tokens */}
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
              marginBottom: "0.75rem", 
              fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", 
              color: "#2c2c2c",
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: "600",
              letterSpacing: "-0.01em"
            }}>
              FarmCoin Tokens
            </h3>
            {farmcoinSummary === undefined ? (
              <p style={{ color: "#999" }}>Loading FarmCoin balance...</p>
            ) : (
              <div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <div style={{ color: "#666", fontSize: "0.9rem" }}>Balance</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#2e7d32" }}>
                    {farmcoinSummary.balance} Token(s)
                  </div>
                </div>
                <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Last 10 transactions</div>
                <div style={{ display: "grid", gap: "0.35rem" }}>
                  {farmcoinSummary.recent?.length ? (
                    farmcoinSummary.recent.map((entry: any, idx: number) => (
                      <div key={idx} style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.85rem",
                        color: "#4b5563",
                        borderBottom: "1px solid #f1f5f9",
                        paddingBottom: "0.3rem",
                      }}>
                        <span>{entry.source?.replace("_", " ")}</span>
                        <span style={{ fontWeight: 600 }}>
                          {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: "0.85rem", color: "#999" }}>No FarmCoin transactions yet.</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sentify Wallet */}
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
              marginBottom: "0.75rem",
              fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)",
              color: "#2c2c2c",
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: "600",
              letterSpacing: "-0.01em"
            }}>
              Sentify Wallet
            </h3>
            <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.75rem" }}>
              Sentify is to turn your FarmCoin into cash via mobile money.
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ color: "#666", fontSize: "0.9rem" }}>Balance</div>
              <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#2e7d32" }}>
                {sentifySummary?.balance ?? 0} Token(s)
              </div>
              {sentifySummary && (
                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  Cash-out rate: UGX {sentifySummary.cashoutRate} per token
                </div>
              )}
            </div>
            <div style={{ display: "grid", gap: "0.6rem", maxWidth: 520 }}>
              <select
                value={sentifyReceiptUtid}
                onChange={(e) => setSentifyReceiptUtid(e.target.value)}
                style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ddd" }}
              >
                <option value="">Select receipt to cash out</option>
                {(sentifyReceipts || []).map((receipt: any) => (
                  <option key={receipt.utid} value={receipt.utid}>
                    {receipt.utid} • {receipt.delta} token(s)
                  </option>
                ))}
              </select>
              <input
                type="tel"
                placeholder="Mobile money phone number"
                value={sentifyPhone}
                onChange={(e) => setSentifyPhone(e.target.value)}
                style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ddd" }}
              />
              <button
                type="button"
                onClick={handleSentifyCashout}
                style={{
                  padding: "0.6rem 1rem",
                  borderRadius: 8,
                  border: "none",
                  background: "#1976d2",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Sentify Cash-out
              </button>
              {sentifyMessage && (
                <div style={{
                  padding: "0.6rem",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  background: sentifyMessage.type === "success" ? "#e8f5e9" : "#ffebee",
                  color: sentifyMessage.type === "success" ? "#2e7d32" : "#c62828",
                  border: `1px solid ${sentifyMessage.type === "success" ? "#c8e6c9" : "#ffcdd2"}`
                }}>
                  {sentifyMessage.text}
                </div>
              )}
            </div>
          </div>

          {/* Delivery Confirmation (Trader) */}
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
              marginBottom: "0.75rem",
              fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)",
              color: "#2c2c2c",
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: "600",
              letterSpacing: "-0.01em"
            }}>
              Delivery Confirmations
            </h3>
            {traderDeliveryBatches === undefined ? (
              <p style={{ color: "#999" }}>Loading batches...</p>
            ) : !traderDeliveryBatches?.length ? (
              <p style={{ color: "#666" }}>No delivery batches yet</p>
            ) : (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {traderDeliveryBatches.map((batch: any) => (
                  <div key={batch.batchUtid} style={{
                    padding: "0.75rem",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    background: "#f8fafc"
                  }}>
                    <div style={{ fontWeight: 600 }}>{batch.productName || batch.produceType}</div>
                    <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                      UTID: {batch.batchUtid} • Purchases: {batch.purchaseCount}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.25rem" }}>
                      Trader confirmed: {batch.traderConfirmedAt ? "Yes" : "No"}
                    </div>
                    {!batch.traderConfirmedAt && (
                      <button
                        type="button"
                        onClick={() => handleTraderDeliveryConfirm(batch.batchUtid)}
                        style={{
                          marginTop: "0.5rem",
                          padding: "0.4rem 0.8rem",
                          background: "#2e7d32",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        Confirm Delivery
                      </button>
                    )}
                  </div>
                ))}
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
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginBottom: "0.75rem"
            }}>
              <div style={{ fontSize: "0.85rem", color: "#666" }}>Per page:</div>
              <select
                value={openListingsPageSize}
                onChange={(e) => {
                  const nextSize = Number(e.target.value);
                  setOpenListingsPageSize(nextSize);
                  setOpenListingsPage(1);
                  updatePaginationPreferences({
                    userId,
                    listKey: openListingsPageKey,
                    pageSize: nextSize,
                  } as any);
                }}
                style={{ padding: "0.4rem 0.6rem", borderRadius: 6, border: "1px solid #ddd", fontSize: "0.85rem" }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            {openListings === undefined ? (
              <p style={{ color: "#999" }}>Loading listings...</p>
            ) : openListings.length === 0 ? (
              <p style={{ color: "#666" }}>No open listings available</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {pagedOpenListings.map((listing: any, idx: number) => (
                  <div key={idx} style={{
                    padding: "0.75rem",
                    background: "#f5f5f5",
                    borderRadius: "8px",
                    fontSize: "0.9rem"
                  }}>
                    {isMobile && (
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.35rem" }}>
                        Hint: Check quantity and deadline before buying.
                      </div>
                    )}
                    <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
                      {listing.produceType} - {listing.totalKilos}kg
                    </div>
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
                    <div style={{ fontSize: "0.8rem", color: "#999", marginTop: "0.25rem" }}>
                      {listing.availableUnits} units available | {listing.farmerAlias}
                    </div>
                  </div>
                ))}
                {openListingsTotal > 0 && (
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    marginTop: "0.25rem"
                  }}>
                    <div style={{ fontSize: "0.8rem", color: "#666" }}>
                      Showing {openListingsStart}-{openListingsEnd} of {openListingsTotal}
                    </div>
                    {openListingsTotalPages > 1 && (
                      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => setOpenListingsPage((prev) => Math.max(1, prev - 1))}
                          disabled={openListingsPage === 1}
                          style={{
                            padding: "0.3rem 0.6rem",
                            background: openListingsPage === 1 ? "#e0e0e0" : "#f5f5f5",
                            color: "#333",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: openListingsPage === 1 ? "not-allowed" : "pointer",
                            fontSize: "0.8rem",
                            fontWeight: "600"
                          }}
                        >
                          Prev
                        </button>
                        {Array.from({ length: openListingsTotalPages }, (_, idx) => {
                          const page = idx + 1;
                          const isActive = page === openListingsPage;
                          return (
                            <button
                              key={page}
                              type="button"
                              onClick={() => setOpenListingsPage(page)}
                              style={{
                                padding: "0.3rem 0.6rem",
                                background: isActive ? "#1976d2" : "#f5f5f5",
                                color: isActive ? "#fff" : "#333",
                                border: "1px solid #ddd",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                                fontWeight: "600"
                              }}
                            >
                              {page}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setOpenListingsPage((prev) => Math.min(openListingsTotalPages, prev + 1))}
                          disabled={openListingsPage === openListingsTotalPages}
                          style={{
                            padding: "0.3rem 0.6rem",
                            background: openListingsPage === openListingsTotalPages ? "#e0e0e0" : "#f5f5f5",
                            color: "#333",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: openListingsPage === openListingsTotalPages ? "not-allowed" : "pointer",
                            fontSize: "0.8rem",
                            fontWeight: "600"
                          }}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
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
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginBottom: "0.75rem"
            }}>
              <div style={{ fontSize: "0.85rem", color: "#666" }}>Per page:</div>
              <select
                value={todayActivityPageSize}
                onChange={(e) => {
                  const nextSize = Number(e.target.value);
                  setTodayActivityPageSize(nextSize);
                  setTodayActivityPage(1);
                  updatePaginationPreferences({
                    userId,
                    listKey: todayActivityPageKey,
                    pageSize: nextSize,
                  } as any);
                }}
                style={{ padding: "0.4rem 0.6rem", borderRadius: 6, border: "1px solid #ddd", fontSize: "0.85rem" }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
            {todayActivity.length === 0 ? (
              <p style={{ color: "#666" }}>No activity today</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {pagedTodayActivity.map((activity: any, idx: number) => (
                  <div key={idx} style={{
                    padding: "0.75rem",
                    background: "#f5f5f5",
                    borderRadius: "8px",
                    fontSize: "0.85rem"
                  }}>
                    {isMobile && (
                      <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.35rem" }}>
                        Hint: Review each update before the day ends.
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                        <div style={{ 
                          fontFamily: "monospace", 
                          wordBreak: "break-all", 
                          fontSize: "clamp(1rem, 3vw, 1.2rem)",
                          fontWeight: "700",
                          letterSpacing: "0.05em",
                          color: "#2c2c2c",
                        }}>
                        {activity.utid}
                      </div>
                      <div style={{
                        padding: "0.25rem 0.5rem",
                        background: activity.status === "Confirmed" ? "#d4edda" : "#fff3cd",
                        color: activity.status === "Confirmed" ? "#155724" : "#856404",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                        fontWeight: "600"
                      }}>
                        {activity.status}
                      </div>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#666", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span><strong>{activity.transactionType}</strong></span>
                      {activity.produceType && (
                        <span>| {activity.produceType}</span>
                      )}
                      {activity.kilos && (
                        <span>| {activity.kilos}kg</span>
                      )}
                      {activity.buyerAlias && (
                        <span>| Buyer: {activity.buyerAlias}</span>
                      )}
                      {activity.type && (
                        <span>| Type: {activity.type}</span>
                      )}
                    </div>
                  </div>
                ))}
                {todayActivityTotal > 0 && (
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.5rem"
                  }}>
                    <div style={{ fontSize: "0.8rem", color: "#666" }}>
                      Showing {todayActivityStart}-{todayActivityEnd} of {todayActivityTotal}
                    </div>
                    {todayActivityTotalPages > 1 && (
                      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => setTodayActivityPage((prev) => Math.max(1, prev - 1))}
                          disabled={todayActivityPage === 1}
                          style={{
                            padding: "0.3rem 0.6rem",
                            background: todayActivityPage === 1 ? "#e0e0e0" : "#f5f5f5",
                            color: "#333",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: todayActivityPage === 1 ? "not-allowed" : "pointer",
                            fontSize: "0.8rem",
                            fontWeight: "600"
                          }}
                        >
                          Prev
                        </button>
                        {Array.from({ length: todayActivityTotalPages }, (_, idx) => {
                          const page = idx + 1;
                          const isActive = page === todayActivityPage;
                          return (
                            <button
                              key={page}
                              type="button"
                              onClick={() => setTodayActivityPage(page)}
                              style={{
                                padding: "0.3rem 0.6rem",
                                background: isActive ? "#1976d2" : "#f5f5f5",
                                color: isActive ? "#fff" : "#333",
                                border: "1px solid #ddd",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                                fontWeight: "600"
                              }}
                            >
                              {page}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setTodayActivityPage((prev) => Math.min(todayActivityTotalPages, prev + 1))}
                          disabled={todayActivityPage === todayActivityTotalPages}
                          style={{
                            padding: "0.3rem 0.6rem",
                            background: todayActivityPage === todayActivityTotalPages ? "#e0e0e0" : "#f5f5f5",
                            color: "#333",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: todayActivityPage === todayActivityTotalPages ? "not-allowed" : "pointer",
                            fontSize: "0.8rem",
                            fontWeight: "600"
                          }}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
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
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.5rem",
                marginBottom: "0.75rem"
              }}>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>Per page:</div>
                <select
                  value={buyOffersPageSize}
                  onChange={(e) => {
                    const nextSize = Number(e.target.value);
                    setBuyOffersPageSize(nextSize);
                    setBuyOffersPage(1);
                    updatePaginationPreferences({
                      userId,
                      listKey: buyOffersPageKey,
                      pageSize: nextSize,
                    } as any);
                  }}
                  style={{ padding: "0.4rem 0.6rem", borderRadius: 6, border: "1px solid #ddd", fontSize: "0.85rem" }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            {buyOffers === undefined ? (
              <p style={{ color: "#999" }}>Loading buy-offers...</p>
            ) : buyOffers.negotiations.length === 0 ? (
              <p style={{ color: "#666" }}>No buy-offers from buyers</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {pagedBuyOffers.map((offer: any) => {
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
                      border: offer.status === "countered" ? "2px solid #ffc107" : "1px solid #e0e0e0",
                      marginBottom: "0.5rem"
                    }}>
                      {isMobile && (
                        <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.35rem" }}>
                          Hint: Respond quickly to avoid delays.
                        </div>
                      )}
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
                        <div style={{ 
                          marginTop: "0.5rem",
                          padding: "0.5rem",
                          background: "#f5f5f5",
                          borderRadius: "6px",
                          border: "1px solid #e0e0e0",
                          marginBottom: "0.5rem",
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
                            fontSize: "clamp(1.2rem, 3.5vw, 1.5rem)",
                            color: "#2c2c2c",
                            fontFamily: "monospace",
                            fontWeight: "700",
                            letterSpacing: "0.05em",
                            wordBreak: "break-all",
                          }}>
                            {offer.negotiationUtid}
                          </div>
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
                          Waiting for buyer to respond to your counter-offer
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
                          Accepted - Buyer can now purchase
                        </div>
                      )}
                    </div>
                  );
                })}
              {buyOffersTotal > 0 && (
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.5rem"
                }}>
                  <div style={{ fontSize: "0.8rem", color: "#666" }}>
                    Showing {buyOffersStart}-{buyOffersEnd} of {buyOffersTotal}
                  </div>
                  {buyOffersTotalPages > 1 && (
                    <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => setBuyOffersPage((prev) => Math.max(1, prev - 1))}
                        disabled={buyOffersPage === 1}
                        style={{
                          padding: "0.3rem 0.6rem",
                          background: buyOffersPage === 1 ? "#e0e0e0" : "#f5f5f5",
                          color: "#333",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          cursor: buyOffersPage === 1 ? "not-allowed" : "pointer",
                          fontSize: "0.8rem",
                          fontWeight: "600"
                        }}
                      >
                        Prev
                      </button>
                      {Array.from({ length: buyOffersTotalPages }, (_, idx) => {
                        const page = idx + 1;
                        const isActive = page === buyOffersPage;
                        return (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setBuyOffersPage(page)}
                            style={{
                              padding: "0.3rem 0.6rem",
                              background: isActive ? "#1976d2" : "#f5f5f5",
                              color: isActive ? "#fff" : "#333",
                              border: "1px solid #ddd",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                              fontWeight: "600"
                            }}
                          >
                            {page}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setBuyOffersPage((prev) => Math.min(buyOffersTotalPages, prev + 1))}
                        disabled={buyOffersPage === buyOffersTotalPages}
                        style={{
                          padding: "0.3rem 0.6rem",
                          background: buyOffersPage === buyOffersTotalPages ? "#e0e0e0" : "#f5f5f5",
                          color: "#333",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          cursor: buyOffersPage === buyOffersTotalPages ? "not-allowed" : "pointer",
                          fontSize: "0.8rem",
                          fontWeight: "600"
                        }}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
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
              Deposit Funds via Pesapal
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
                            fontSize: "clamp(1.2rem, 3.5vw, 1.5rem)",
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
        </>
      ) : (
        /* Pro View */
        <>
          {/* Create Listing from Inventory */}
          <CreateTraderListing userId={userId} />

          {/* Listings & Negotiations */}
          <TraderListings userId={userId} />

          {/* FarmCoin Tokens */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
            <div style={{
              padding: "clamp(1rem, 3vw, 1.5rem)",
              background: "#fff",
              borderRadius: "12px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              border: "1px solid #e0e0e0"
            }}>
              <h3 style={{ 
                marginTop: 0, 
                marginBottom: "0.75rem", 
                fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", 
                color: "#2c2c2c",
                fontFamily: '"Montserrat", sans-serif',
                fontWeight: "600",
                letterSpacing: "-0.01em"
              }}>
                FarmCoin Tokens
              </h3>
              {farmcoinSummary === undefined ? (
                <p style={{ color: "#999" }}>Loading FarmCoin balance...</p>
              ) : (
                <div>
                  <div style={{ marginBottom: "0.75rem" }}>
                    <div style={{ color: "#666", fontSize: "0.9rem" }}>Balance</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#2e7d32" }}>
                      {farmcoinSummary.balance} Token(s)
                    </div>
                  </div>
                  <div style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>Last 10 transactions</div>
                  <div style={{ display: "grid", gap: "0.35rem" }}>
                    {farmcoinSummary.recent?.length ? (
                      farmcoinSummary.recent.map((entry: any, idx: number) => (
                        <div key={idx} style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.85rem",
                          color: "#4b5563",
                          borderBottom: "1px solid #f1f5f9",
                          paddingBottom: "0.3rem",
                        }}>
                          <span>{entry.source?.replace("_", " ")}</span>
                          <span style={{ fontWeight: 600 }}>
                            {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: "0.85rem", color: "#999" }}>No FarmCoin transactions yet.</div>
                    )}
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
            Current Kilo-Shaving Rate
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
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "0.75rem"
        }}>
          <div style={{ fontSize: "0.85rem", color: "#666" }}>Per page:</div>
          <select
            value={inventoryPageSize}
            onChange={(e) => {
              const nextSize = Number(e.target.value);
              setInventoryPageSize(nextSize);
              setInventoryPage(1);
              updatePaginationPreferences({
                userId,
                listKey: inventoryPageKey,
                pageSize: nextSize,
              } as any);
            }}
            style={{ padding: "0.4rem 0.6rem", borderRadius: 6, border: "1px solid #ddd", fontSize: "0.85rem" }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
        {inventory === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : inventory.inventory.length === 0 ? (
          <p style={{ color: "#666" }}>No inventory in storage</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {pagedInventory.map((item: any, index: number) => {
              const totalPrice = item.originalPricePerKilo * item.totalKilos;
              const projectedRemainingPrice = item.originalPricePerKilo * item.projectedKilosRemaining;
              
              return (
                <div key={index} style={{
                  padding: "clamp(1rem, 3vw, 1.5rem)",
                  background: "#f9f9f9",
                  borderRadius: "8px",
                  border: "1px solid #e0e0e0",
                  marginBottom: "0.5rem"
                }}>
                  {isMobile && (
                    <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.35rem" }}>
                      Hint: Check storage days and projected loss.
                    </div>
                  )}
                  {/* Header with UTID */}
                  <div style={{ 
                    marginBottom: "1rem", 
                    paddingBottom: "0.75rem", 
                    borderBottom: "1px solid #e0e0e0" 
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
                      fontSize: "clamp(0.98rem, 2.8vw, 1.26rem)", 
                      color: "#2c2c2c", 
                      fontFamily: "monospace",
                      fontWeight: "700",
                      letterSpacing: "0.05em",
                      wordBreak: "break-all"
                    }}>
                      {item.utid}
                    </div>
                    {/* Delivery Location - Prominently Displayed */}
                    {item.storageLocation && (
                      <div style={{
                        marginTop: "0.75rem",
                        padding: "0.75rem",
                        background: "#e3f2fd",
                        borderRadius: "8px",
                        border: "2px solid #1976d2",
                      }}>
                        <div style={{
                          fontSize: "clamp(0.85rem, 2.5vw, 0.95rem)",
                          color: "#1565c0",
                          fontWeight: "700",
                          marginBottom: "0.25rem",
                          fontFamily: '"Montserrat", sans-serif',
                          textTransform: "uppercase",
                          letterSpacing: "0.5px"
                        }}>
                          Delivery Location:
                        </div>
                        <div style={{
                          fontSize: "clamp(1rem, 3vw, 1.2rem)",
                          color: "#1976d2",
                          fontWeight: "700",
                          fontFamily: '"Montserrat", sans-serif',
                        }}>
                          {item.storageLocation.districtName} ({item.storageLocation.code})
                        </div>
                      </div>
                    )}
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
            {inventoryTotal > 0 && (
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.5rem"
              }}>
                <div style={{ fontSize: "0.8rem", color: "#666" }}>
                  Showing {inventoryStart}-{inventoryEnd} of {inventoryTotal}
                </div>
                {inventoryTotalPages > 1 && (
                  <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setInventoryPage((prev) => Math.max(1, prev - 1))}
                      disabled={inventoryPage === 1}
                      style={{
                        padding: "0.3rem 0.6rem",
                        background: inventoryPage === 1 ? "#e0e0e0" : "#f5f5f5",
                        color: "#333",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        cursor: inventoryPage === 1 ? "not-allowed" : "pointer",
                        fontSize: "0.8rem",
                        fontWeight: "600"
                      }}
                    >
                      Prev
                    </button>
                    {Array.from({ length: inventoryTotalPages }, (_, idx) => {
                      const page = idx + 1;
                      const isActive = page === inventoryPage;
                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setInventoryPage(page)}
                          style={{
                            padding: "0.3rem 0.6rem",
                            background: isActive ? "#1976d2" : "#f5f5f5",
                            color: isActive ? "#fff" : "#333",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            fontWeight: "600"
                          }}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setInventoryPage((prev) => Math.min(inventoryTotalPages, prev + 1))}
                      disabled={inventoryPage === inventoryTotalPages}
                      style={{
                        padding: "0.3rem 0.6rem",
                        background: inventoryPage === inventoryTotalPages ? "#e0e0e0" : "#f5f5f5",
                        color: "#333",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        cursor: inventoryPage === inventoryTotalPages ? "not-allowed" : "pointer",
                        fontSize: "0.8rem",
                        fontWeight: "600"
                      }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transactions Log */}
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
            Transactions Log
          </h3>
          {activeUTIDs && activeUTIDs.utids && activeUTIDs.utids.length > 0 && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
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
                Export Excel
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
                Export PDF
              </button>
            </div>
          )}
        </div>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "0.75rem"
        }}>
          <div style={{ fontSize: "0.85rem", color: "#666" }}>Per page:</div>
          <select
            value={activeUtidPageSize}
            onChange={(e) => {
              const nextSize = Number(e.target.value);
              setActiveUtidPageSize(nextSize);
              setActiveUtidPage(1);
              updatePaginationPreferences({
                userId,
                listKey: activeUtidPageKey,
                pageSize: nextSize,
              } as any);
            }}
            style={{ padding: "0.4rem 0.6rem", borderRadius: 6, border: "1px solid #ddd", fontSize: "0.85rem" }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
        {activeUTIDs === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : activeUTIDs.utids.length === 0 ? (
          <p style={{ color: "#666" }}>No active transactions</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {pagedActiveUtids.map((utid: any, index: number) => {
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
              const isInTransit = state.includes("Locked-In (In Transit)");
              
              return (
                <div key={index} style={{
                  padding: "clamp(0.75rem, 2.5vw, 1rem)",
                  background: getStateColor(state),
                  borderRadius: "8px",
                  border: `2px solid ${getStateBorderColor(state)}`,
                  fontSize: "clamp(0.8rem, 2.5vw, 0.85rem)",
                  wordBreak: "break-all",
                  position: "relative",
                  marginBottom: "0.5rem",
                  ...(isInTransit ? {
                    boxShadow: "0 0 0 2px rgba(255, 152, 0, 0.2)"
                  } : {})
                }}>
                  {isMobile && (
                    <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.35rem" }}>
                      Hint: Confirm delivery details before action.
                    </div>
                  )}
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
                        fontSize: "clamp(0.9rem, 2.5vw, 1rem)",
                        color: "#666",
                        fontWeight: "600",
                        marginBottom: "0.25rem",
                        fontFamily: '"Montserrat", sans-serif',
                      }}>
                        {isInTransit ? "Locked-In UTID (In Transit to Delivery):" : "Transaction UTID:"}
                      </div>
                      <div style={{ 
                        fontWeight: "700", 
                        fontFamily: "monospace",
                        color: isInTransit ? "#ff6f00" : "#2c2c2c",
                        fontSize: "clamp(0.98rem, 2.8vw, 1.26rem)",
                        letterSpacing: "0.05em",
                        wordBreak: "break-all"
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
                  {isInTransit && (
                    <div style={{
                      padding: "0.5rem",
                      background: "rgba(255, 152, 0, 0.1)",
                      borderRadius: "4px",
                      marginBottom: "0.5rem",
                      fontSize: "clamp(0.75rem, 2vw, 0.8rem)",
                      color: "#856404",
                      fontWeight: "500"
                    }}>
                      Awaiting farmer delivery to storage. Admin will mark as delivered once produce arrives.
                    </div>
                  )}
                  {/* Delivery Location - Prominently Displayed */}
                  {utid.entities && utid.entities.length > 0 && utid.entities[0].storageLocation && (
                    <div style={{
                      marginTop: "0.75rem",
                      padding: "0.75rem",
                      background: "#e3f2fd",
                      borderRadius: "8px",
                      border: "2px solid #1976d2",
                    }}>
                      <div style={{
                        fontSize: "clamp(0.85rem, 2.5vw, 0.95rem)",
                        color: "#1565c0",
                        fontWeight: "700",
                        marginBottom: "0.25rem",
                        fontFamily: '"Montserrat", sans-serif',
                        textTransform: "uppercase",
                        letterSpacing: "0.5px"
                      }}>
                        Delivery Location:
                      </div>
                      <div style={{
                        fontSize: "clamp(1rem, 3vw, 1.2rem)",
                        color: "#1976d2",
                        fontWeight: "700",
                        fontFamily: '"Montserrat", sans-serif',
                      }}>
                        {utid.entities[0].storageLocation.districtName} ({utid.entities[0].storageLocation.code})
                      </div>
                    </div>
                  )}
                  <div style={{ 
                    marginTop: "0.5rem",
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
            {activeUtidsTotal > 0 && (
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.5rem"
              }}>
                <div style={{ fontSize: "0.8rem", color: "#666" }}>
                  Showing {activeUtidsStart}-{activeUtidsEnd} of {activeUtidsTotal}
                </div>
                {activeUtidsTotalPages > 1 && (
                  <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setActiveUtidPage((prev) => Math.max(1, prev - 1))}
                      disabled={activeUtidPage === 1}
                      style={{
                        padding: "0.3rem 0.6rem",
                        background: activeUtidPage === 1 ? "#e0e0e0" : "#f5f5f5",
                        color: "#333",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        cursor: activeUtidPage === 1 ? "not-allowed" : "pointer",
                        fontSize: "0.8rem",
                        fontWeight: "600"
                      }}
                    >
                      Prev
                    </button>
                    {Array.from({ length: activeUtidsTotalPages }, (_, idx) => {
                      const page = idx + 1;
                      const isActive = page === activeUtidPage;
                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setActiveUtidPage(page)}
                          style={{
                            padding: "0.3rem 0.6rem",
                            background: isActive ? "#1976d2" : "#f5f5f5",
                            color: isActive ? "#fff" : "#333",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            fontWeight: "600"
                          }}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setActiveUtidPage((prev) => Math.min(activeUtidsTotalPages, prev + 1))}
                      disabled={activeUtidPage === activeUtidsTotalPages}
                      style={{
                        padding: "0.3rem 0.6rem",
                        background: activeUtidPage === activeUtidsTotalPages ? "#e0e0e0" : "#f5f5f5",
                        color: "#333",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        cursor: activeUtidPage === activeUtidsTotalPages ? "not-allowed" : "pointer",
                        fontSize: "0.8rem",
                        fontWeight: "600"
                      }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
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
            UTID Reports by Category (Separate Report for Each Category)
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
                        background: "#000000",
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
                        background: "#ffc107",
                        color: "#000",
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
            Inventory Volume Report (Separate Report: Produce In & Out)
          </h4>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => handleExportInventoryVolume("excel")}
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
              ≡ƒôè Export Excel
            </button>
            <button
              onClick={() => handleExportInventoryVolume("pdf")}
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
              ≡ƒôä Export PDF
            </button>
          </div>
        </div>

        {/* Capital Volume Report */}
        <div>
          <h4 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "clamp(1rem, 3vw, 1.1rem)", color: "#666" }}>
            Capital Volume Report (Separate Report: Capital Exposed & Revenue Earned)
          </h4>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => handleExportCapitalVolume("excel")}
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
              ≡ƒôè Export Excel
            </button>
            <button
              onClick={() => handleExportCapitalVolume("pdf")}
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
              ≡ƒôä Export PDF
            </button>
          </div>
        </div>
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
                    {pagedInventory.map((item: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "0.75rem", fontSize: "0.9rem" }}>{item.produceType}</td>
                        <td style={{ padding: "0.75rem", fontSize: "0.9rem" }}>{item.totalKilos.toFixed(2)} kg</td>
                        <td style={{ padding: "0.75rem", fontSize: "0.9rem" }}>In Storage</td>
                        <td style={{ padding: "0.75rem", fontSize: "0.9rem" }}>{item.daysInStorage.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {inventoryTotal > 0 && (
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    marginTop: "0.75rem"
                  }}>
                    <div style={{ fontSize: "0.8rem", color: "#666" }}>
                      Showing {inventoryStart}-{inventoryEnd} of {inventoryTotal}
                    </div>
                    {inventoryTotalPages > 1 && (
                      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => setInventoryPage((prev) => Math.max(1, prev - 1))}
                          disabled={inventoryPage === 1}
                          style={{
                            padding: "0.3rem 0.6rem",
                            background: inventoryPage === 1 ? "#e0e0e0" : "#f5f5f5",
                            color: "#333",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: inventoryPage === 1 ? "not-allowed" : "pointer",
                            fontSize: "0.8rem",
                            fontWeight: "600"
                          }}
                        >
                          Prev
                        </button>
                        {Array.from({ length: inventoryTotalPages }, (_, idx) => {
                          const page = idx + 1;
                          const isActive = page === inventoryPage;
                          return (
                            <button
                              key={page}
                              type="button"
                              onClick={() => setInventoryPage(page)}
                              style={{
                                padding: "0.3rem 0.6rem",
                                background: isActive ? "#1976d2" : "#f5f5f5",
                                color: isActive ? "#fff" : "#333",
                                border: "1px solid #ddd",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                                fontWeight: "600"
                              }}
                            >
                              {page}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setInventoryPage((prev) => Math.min(inventoryTotalPages, prev + 1))}
                          disabled={inventoryPage === inventoryTotalPages}
                          style={{
                            padding: "0.3rem 0.6rem",
                            background: inventoryPage === inventoryTotalPages ? "#e0e0e0" : "#f5f5f5",
                            color: "#333",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            cursor: inventoryPage === inventoryTotalPages ? "not-allowed" : "pointer",
                            fontSize: "0.8rem",
                            fontWeight: "600"
                          }}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pro View: Analytics */}
          <div style={{
            padding: "clamp(1rem, 3vw, 1.5rem)",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0",
            marginBottom: "1.5rem",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", fontWeight: "600", color: "#2c2c2c", fontFamily: '"Montserrat", sans-serif' }}>
                  📊 Trader Analytics
                </h3>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "#2e7d32", fontWeight: 600, fontStyle: "italic" }}>Know Your Numbers</p>
              </div>
              <button
                onClick={handleExportAnalyticsPDF}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#ffc107",
                  color: "#000",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                }}
              >
                📄 Export Analytics PDF
              </button>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
              gap: "0.75rem",
            }}>
              <div style={{ padding: "0.75rem", background: "#e8f5e9", borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: "0.7rem", color: "#666", fontWeight: 600 }}>Active UTIDs</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#2e7d32" }}>{activeUTIDs?.utids?.length || 0}</div>
              </div>
              <div style={{ padding: "0.75rem", background: "#e3f2fd", borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: "0.7rem", color: "#666", fontWeight: 600 }}>Inventory Items</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1976d2" }}>{inventory?.inventory?.length || 0}</div>
              </div>
              <div style={{ padding: "0.75rem", background: "#fff3e0", borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: "0.7rem", color: "#666", fontWeight: 600 }}>Buy Offers</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#f57c00" }}>{buyOffers?.negotiations?.length || 0}</div>
              </div>

            </div>
          </div>

          {/* Pro View: Analytics Placeholders */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
            gap: "1.5rem",
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

      {/* Contact Us Section */}
      <ContactUs
        isMobile={false}
        onOpenInbox={() => {
          setMessageInboxOpen(true);
          if (selectedMessageUtid === null) {
            setSelectedMessageUtid(SUPPORT_THREAD);
          }
          if (typeof document !== "undefined") {
            document.getElementById("message-inbox")?.scrollIntoView({ behavior: "smooth" });
          }
        }}
      />
    </div>
  );
}
