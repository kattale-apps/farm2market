"use client";

import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useEffect, useMemo, useRef, useState } from "react";
import { exportToExcel, exportToPDF, formatUTIDDataForExport } from "../utils/exportUtils";
import { formatUgandaDateTime, getUgandaTime } from "../utils/timeUtils";
import { NotificationMailbox } from "./NotificationMailbox";
import { ThreadView } from "./messages/ThreadView";
import { ContactUs } from "./ContactUs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resolveCommunityLogo } from "../lib/communityLogos";
import { UserProfileCard } from "./UserProfileCard";
import { savePdfFromJsPDF } from "../utils/pdfDownload";

interface BuyerDashboardProps {
  userId: Id<"users">;
}

export function BuyerDashboard({ userId }: BuyerDashboardProps) {
  const router = useRouter();
  const inventory = useQuery(api.buyerDashboard.getAvailableInventory, { buyerId: userId });
  const traderListings = useQuery(api.buyerDashboard.getAvailableTraderListingsForBuyers, { buyerId: userId });
  const vendorStoreListings = useQuery(api.buyerDashboard.getVendorStoreListings, { buyerId: userId });
  const windowStatus = useQuery(api.buyerDashboard.getPurchaseWindowStatus, { buyerId: userId });
  const orders = useQuery(api.buyerDashboard.getBuyerOrders, { buyerId: userId });
  const listingOrders = useQuery(api.buyerDashboard.getBuyerListingOrders, { buyerId: userId });
  const walletBalance = useQuery(api.buyerDashboard.getBuyerWalletBalance, { buyerId: userId });
  const storageFeeRate = useQuery(api.buyerDashboard.getBuyerStorageFeeRate, { buyerId: userId });
  const serviceFeePercentage = useQuery(api.buyerDashboard.getBuyerServiceFeePercentageQuery, { buyerId: userId });
  const transactionLedger = useQuery(api.buyerDashboard.getBuyerTransactionLedger, { buyerId: userId });
  const walletReport = useQuery(api.buyerDashboard.getBuyerWalletReport, { buyerId: userId });
  const buyerRewardSummary = useQuery((api as any).farmcoin.getBuyerRewardSummary, { userId } as any);
  const buyerRewardReceipts = useQuery((api as any).farmcoin.getBuyerRewardReceipts, { userId } as any);
  const createPurchase = useMutation(api.buyers.createBuyerPurchase);
  const createListingPurchase = useMutation((api as any).buyers.createBuyerListingPurchase);
  const createVendorStorePurchase = useMutation((api as any).buyers.createBuyerVendorStorePurchase);
  const buyerConfirmListingDelivery = useMutation((api as any).buyers.buyerConfirmListingDelivery);
  const cashOutBuyerRewardReceipt = useMutation((api as any).farmcoin.cashOutBuyerRewardReceipt);
  const messageThreads = useQuery(api.messages.getUserMessageThreads, { userId });
  const communities = useQuery(api.communities.getActiveCommunities, { userId });
  const memberCommunities = (Array.isArray(communities) ? communities : []).filter((c: any) => c.isMember);
  const paginationPreferences = useQuery(
    (api as any).userSettings.getPaginationPreferences,
    { userId } as any
  );
  const updatePaginationPreferences = useMutation(
    (api as any).userSettings.updatePaginationPreferences
  );
  
  const initiateDeposit = useAction(api.pesapal.initiateBuyerDeposit);
  const paymentTransactions = useQuery(api.pesapal.getUserPaymentTransactions, { userId });

  // ── Market price reports ──────────────────────────────────────────────────
  const priceSheetPricing = useQuery((api as any).marketPrices.getPriceSheetPricing);
  const buyerFarmcoinBalance = useQuery((api as any).marketPrices.getBuyerRewardBalance, { buyerId: userId } as any);
  const [priceDownloadRequest, setPriceDownloadRequest] = useState<{
    productType: "daily" | "weekly" | "monthly";
    scopeDateKey: string;
  } | null>(null);
  const priceSheetRows = useQuery(
    (api as any).marketPrices.getSnapshotRowsForDownload,
    priceDownloadRequest
      ? { userId, productType: priceDownloadRequest.productType, scopeDateKey: priceDownloadRequest.scopeDateKey }
      : "skip"
  );
  const purchasePriceSheetFarmcoin = useMutation((api as any).marketPrices.purchasePriceSheetFarmcoin);
  const recordPriceDownloadAudit = useMutation((api as any).marketPrices.recordDownloadAudit);
  const initiatePriceSheetPesapal = useAction((api as any).marketPrices.purchasePriceSheetPesapal);
  const [priceReportMessage, setPriceReportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [priceReportLoading, setPriceReportLoading] = useState<string | null>(null);

  // Trigger XLSX download when rows arrive
  useEffect(() => {
    if (!priceSheetRows || !priceDownloadRequest) return;
    const { rows, scopeDateKey } = priceSheetRows as any;
    if (!rows || rows.length === 0) {
      setPriceReportMessage({ type: "error", text: "No published price data available for this period yet." });
      setPriceDownloadRequest(null);
      return;
    }
    // Build XLSX using existing xlsx library (same pattern as AdminDashboard)
    const XLSX = require("xlsx");
    const worksheetData = rows.map((r: any) => ({
      Date: r.date,
      Commodity: r.commodity,
      Unit: r.unit,
      Market: r.marketName,
      "Min Price (UGX)": r.minPriceUGX,
      "Median Price (UGX)": r.medianPriceUGX,
      "Max Price (UGX)": r.maxPriceUGX,
      "Latest Price (UGX)": r.latestPriceUGX,
      Source: r.source,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(worksheetData);
    ws["!cols"] = [
      { wch: 12 }, { wch: 20 }, { wch: 8 }, { wch: 22 },
      { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Market Prices");
    XLSX.writeFile(wb, `Farm2Market_Prices_${scopeDateKey}.xlsx`);
    recordPriceDownloadAudit({ userId, productType: priceDownloadRequest.productType, scopeDateKey });
    setPriceDownloadRequest(null);
    setPriceReportLoading(null);
    // Deliberately keyed only on the query result: this effect should fire
    // exactly once per download request, when its data arrives. Adding
    // userId/priceDownloadRequest/recordPriceDownloadAudit as deps risks
    // re-firing (duplicate file download + duplicate audit record) if any
    // of those references change before the next request is made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceSheetRows]);
  
  const [purchasing, setPurchasing] = useState<Id<"traderInventory"> | null>(null);
  const [purchaseMessage, setPurchaseMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [kilosInput, setKilosInput] = useState<{ [key: string]: string }>({});
  const [listingUnitsInput, setListingUnitsInput] = useState<{ [key: string]: string }>({});
  const [vendorStoreUnitsInput, setVendorStoreUnitsInput] = useState<{ [key: string]: string }>({});
  const [vendorStorePurchaseMessage, setVendorStorePurchaseMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositMessage, setDepositMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [listingPurchaseMessage, setListingPurchaseMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [rewardCashoutPhone, setRewardCashoutPhone] = useState<string>("");
  const [rewardReceiptUtid, setRewardReceiptUtid] = useState<string>("");
  const [rewardCashoutMessage, setRewardCashoutMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [messageInboxOpen, setMessageInboxOpen] = useState(false);
  const [selectedMessageUtid, setSelectedMessageUtid] = useState<string | null>(null);
  const SUPPORT_THREAD = "SUPPORT";
  const [isMobile, setIsMobile] = useState(false);
  const inboxRef = useRef<HTMLDivElement>(null);
  const [isInboxNarrow, setIsInboxNarrow] = useState(false);
  const isInboxStacked = isMobile || isInboxNarrow;
  const activeThreadUtid = selectedMessageUtid || messageThreads?.[0]?.utid || SUPPORT_THREAD;
  const [inventoryPage, setInventoryPage] = useState(1);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [listingOrdersPage, setListingOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(10);
  const [ledgerPageSize, setLedgerPageSize] = useState(10);
  const [listingOrdersPageSize, setListingOrdersPageSize] = useState(10);
  const INVENTORY_PAGE_SIZE = 10;

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
    const nextOrders = paginationPreferences.list?.["buyer_orders"] ?? defaultSize;
    const nextLedger = paginationPreferences.list?.["buyer_ledger"] ?? defaultSize;
    const nextListingOrders = paginationPreferences.list?.["buyer_listing_orders"] ?? defaultSize;
    if (nextOrders !== ordersPageSize) {
      setOrdersPageSize(nextOrders);
      setOrdersPage(1);
    }
    if (nextLedger !== ledgerPageSize) {
      setLedgerPageSize(nextLedger);
      setLedgerPage(1);
    }
    if (nextListingOrders !== listingOrdersPageSize) {
      setListingOrdersPageSize(nextListingOrders);
      setListingOrdersPage(1);
    }
  }, [paginationPreferences, ordersPageSize, ledgerPageSize, listingOrdersPageSize]);

  useEffect(() => {
    if (!inboxRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width || 0;
      setIsInboxNarrow(width <= 720);
    });
    observer.observe(inboxRef.current);
    return () => observer.disconnect();
  }, []);

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

  const formatEtaLabel = (order: any) => {
    if (!order?.etaType || order?.etaValue == null) return "ETA not provided";
    if (order.etaType === "arrival_time") {
      return `ETA: ${formatDate(order.etaValue)}`;
    }
    return `ETA: ${order.etaValue}h`;
  };

  const formatEtaValue = (etaType: "arrival_time" | "duration" | null, value: number | null) => {
    if (!etaType || value == null) return "N/A";
    if (etaType === "arrival_time") {
      return formatDate(value);
    }
    return `${value}h`;
  };

  const formatTimeRemaining = (deadline: number) => {
    const now = getUgandaTime();
    const diff = deadline - now;
    if (diff <= 0) return "OVERDUE";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m remaining`;
  };

  const getSortTimestamp = (item: any) => {
    const raw =
      item?.timestamp ??
      item?.updatedAt ??
      item?.createdAt ??
      item?.purchasedAt ??
      item?.purchaseAt ??
      item?.storageStartTime ??
      item?._creationTime ??
      0;
    if (typeof raw === "number") {
      return raw;
    }
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const sortedInventory = useMemo(() => {
    if (!inventory?.inventory) return [];
    return [...inventory.inventory].sort((a: any, b: any) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [inventory]);

  const sortedOrders = useMemo(() => {
    if (!orders?.orders) return [];
    return [...orders.orders].sort((a: any, b: any) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [orders]);

  const sortedListingOrders = useMemo(() => {
    if (!listingOrders?.orders) return [];
    return [...listingOrders.orders].sort((a: any, b: any) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [listingOrders]);

  const sortedTransactions = useMemo(() => {
    if (!transactionLedger?.transactions) return [];
    return [...transactionLedger.transactions].sort((a: any, b: any) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [transactionLedger]);

  const inventoryTotal = sortedInventory.length;
  const inventoryTotalPages = Math.max(1, Math.ceil(inventoryTotal / INVENTORY_PAGE_SIZE));
  const inventoryStart = inventoryTotal === 0 ? 0 : (inventoryPage - 1) * INVENTORY_PAGE_SIZE + 1;
  const inventoryEnd = Math.min(inventoryPage * INVENTORY_PAGE_SIZE, inventoryTotal);
  const pagedInventory = sortedInventory.slice(
    (inventoryPage - 1) * INVENTORY_PAGE_SIZE,
    inventoryPage * INVENTORY_PAGE_SIZE
  );

  const ordersTotal = sortedOrders.length;
  const ordersTotalPages = Math.max(1, Math.ceil(ordersTotal / ordersPageSize));
  const ordersStart = ordersTotal === 0 ? 0 : (ordersPage - 1) * ordersPageSize + 1;
  const ordersEnd = Math.min(ordersPage * ordersPageSize, ordersTotal);
  const pagedOrders = sortedOrders.slice(
    (ordersPage - 1) * ordersPageSize,
    ordersPage * ordersPageSize
  );

  const ledgerTotal = sortedTransactions.length;
  const ledgerTotalPages = Math.max(1, Math.ceil(ledgerTotal / ledgerPageSize));
  const ledgerStart = ledgerTotal === 0 ? 0 : (ledgerPage - 1) * ledgerPageSize + 1;
  const ledgerEnd = Math.min(ledgerPage * ledgerPageSize, ledgerTotal);
  const pagedTransactions = sortedTransactions.slice(
    (ledgerPage - 1) * ledgerPageSize,
    ledgerPage * ledgerPageSize
  );

  const listingOrdersTotal = sortedListingOrders.length;
  const listingOrdersTotalPages = Math.max(1, Math.ceil(listingOrdersTotal / listingOrdersPageSize));
  const listingOrdersStart = listingOrdersTotal === 0 ? 0 : (listingOrdersPage - 1) * listingOrdersPageSize + 1;
  const listingOrdersEnd = Math.min(listingOrdersPage * listingOrdersPageSize, listingOrdersTotal);
  const pagedListingOrders = sortedListingOrders.slice(
    (listingOrdersPage - 1) * listingOrdersPageSize,
    listingOrdersPage * listingOrdersPageSize
  );

  useEffect(() => {
    if (inventoryPage > inventoryTotalPages) {
      setInventoryPage(inventoryTotalPages);
    }
  }, [inventoryPage, inventoryTotalPages]);

  useEffect(() => {
    if (ordersPage > ordersTotalPages) {
      setOrdersPage(ordersTotalPages);
    }
  }, [ordersPage, ordersTotalPages]);

  useEffect(() => {
    if (ledgerPage > ledgerTotalPages) {
      setLedgerPage(ledgerTotalPages);
    }
  }, [ledgerPage, ledgerTotalPages]);

  useEffect(() => {
    if (listingOrdersPage > listingOrdersTotalPages) {
      setListingOrdersPage(listingOrdersTotalPages);
    }
  }, [listingOrdersPage, listingOrdersTotalPages]);

  const exportTransactionLedgerToExcel = () => {
    if (!transactionLedger || transactionLedger.transactions.length === 0) return;

    const worksheetData = transactionLedger.transactions.map((tx: any) => ({
      Date: formatDate(tx.timestamp),
      "Produce Type": tx.produceType || "N/A",
      "Quantity (kg)": tx.quantityKilos.toFixed(2),
      "Unit Price/kg (UGX)": tx.unitPricePerKilo.toFixed(2),
      "Service Fee (UGX)": tx.serviceFee.toFixed(2),
      "Service Fee %": `${tx.serviceFeePercentage}%`,
      "Total Cost (UGX)": tx.totalCost.toFixed(2),
      UTID: tx.utid,
    }));

    const XLSX = require("xlsx");
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transaction Ledger");

    // Set column widths
    worksheet["!cols"] = [
      { wch: 20 }, // Date
      { wch: 15 }, // Produce Type
      { wch: 15 }, // Quantity
      { wch: 18 }, // Unit Price
      { wch: 18 }, // Service Fee
      { wch: 15 }, // Service Fee %
      { wch: 18 }, // Total Cost
      { wch: 35 }, // UTID
    ];

    XLSX.writeFile(workbook, `Buyer_Transaction_Ledger_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportTransactionLedgerToPDF = () => {
    if (!transactionLedger || transactionLedger.transactions.length === 0) return;

    const jsPDF = require("jspdf");
    require("jspdf-autotable");

    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.text("Transaction Ledger - Buyer Report", 14, 20);

    // Add summary
    doc.setFontSize(12);
    doc.text(`Total Transactions: ${transactionLedger.totals.totalTransactions}`, 14, 30);
    doc.text(`Total Quantity: ${transactionLedger.totals.totalQuantityKilos.toFixed(2)} kg`, 14, 38);
    doc.text(`Total Cost: UGX ${transactionLedger.totals.totalCost.toFixed(2)}`, 14, 46);

    // Add transactions table
    const tableData = transactionLedger.transactions.map((tx: any) => [
      formatDate(tx.timestamp),
      tx.produceType || "N/A",
      tx.quantityKilos.toFixed(2),
      tx.unitPricePerKilo.toFixed(2),
      `${tx.serviceFee.toFixed(2)} (${tx.serviceFeePercentage}%)`,
      tx.totalCost.toFixed(2),
      tx.utid,
    ]);

    (doc as any).autoTable({
      startY: 54,
      head: [["Date", "Produce", "Qty (kg)", "Price/kg", "Service Fee", "Total Cost", "UTID"]],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 15 },
        3: { cellWidth: 18 },
        4: { cellWidth: 25 },
        5: { cellWidth: 18 },
        6: { cellWidth: 45 },
      },
    });

    void savePdfFromJsPDF(doc, `Buyer_Transaction_Ledger_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const exportWalletReportToExcel = () => {
    if (!walletReport) return;

    const XLSX = require("xlsx");
    const workbook = XLSX.utils.book_new();

    // Money In sheet
    if (walletReport.moneyIn.length > 0) {
      const moneyInData = walletReport.moneyIn.map((entry: any) => ({
        Date: formatDate(entry.timestamp),
        Type: entry.type,
        "Amount (UGX)": entry.amount.toFixed(2),
        UTID: entry.utid,
      }));

      const moneyInSheet = XLSX.utils.json_to_sheet(moneyInData);
      moneyInSheet["!cols"] = [
        { wch: 20 }, // Date
        { wch: 20 }, // Type
        { wch: 15 }, // Amount
        { wch: 35 }, // UTID
      ];
      XLSX.utils.book_append_sheet(workbook, moneyInSheet, "Money In");
    }

    // Money Out sheet
    if (walletReport.moneyOut.length > 0) {
      const moneyOutData = walletReport.moneyOut.map((entry: any) => ({
        Date: formatDate(entry.timestamp),
        Type: entry.type,
        "Amount (UGX)": entry.amount.toFixed(2),
        UTID: entry.utid,
      }));

      const moneyOutSheet = XLSX.utils.json_to_sheet(moneyOutData);
      moneyOutSheet["!cols"] = [
        { wch: 20 }, // Date
        { wch: 20 }, // Type
        { wch: 15 }, // Amount
        { wch: 35 }, // UTID
      ];
      XLSX.utils.book_append_sheet(workbook, moneyOutSheet, "Money Out");
    }

    // Summary sheet
    const summaryData = [
      { Metric: "Total Money In", "Amount (UGX)": walletReport.totals.totalMoneyIn.toFixed(2) },
      { Metric: "Total Money Out", "Amount (UGX)": walletReport.totals.totalMoneyOut.toFixed(2) },
      { Metric: "Current Balance", "Amount (UGX)": walletReport.totals.currentBalance.toFixed(2) },
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    XLSX.writeFile(workbook, `Buyer_Wallet_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportWalletReportToPDF = () => {
    if (!walletReport) return;

    const jsPDF = require("jspdf");
    require("jspdf-autotable");

    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.text("Wallet Report - Buyer", 14, 20);

    // Add summary
    doc.setFontSize(12);
    doc.text(`Total Money In: UGX ${walletReport.totals.totalMoneyIn.toFixed(2)}`, 14, 30);
    doc.text(`Total Money Out: UGX ${walletReport.totals.totalMoneyOut.toFixed(2)}`, 14, 38);
    doc.text(`Current Balance: UGX ${walletReport.totals.currentBalance.toFixed(2)}`, 14, 46);

    let startY = 54;

    // Money In table
    if (walletReport.moneyIn.length > 0) {
      doc.setFontSize(14);
      doc.text("Money In (Deposits)", 14, startY);
      startY += 6;

      const moneyInData = walletReport.moneyIn.map((entry: any) => [
        formatDate(entry.timestamp),
        entry.type,
        entry.amount.toFixed(2),
        entry.utid,
      ]);

      (doc as any).autoTable({
        startY,
        head: [["Date", "Type", "Amount (UGX)", "UTID"]],
        body: moneyInData,
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 30 },
          2: { cellWidth: 25 },
          3: { cellWidth: 45 },
        },
      });

      startY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Money Out table
    if (walletReport.moneyOut.length > 0) {
      if (startY > 250) {
        doc.addPage();
        startY = 20;
      }

      doc.setFontSize(14);
      doc.text("Money Out (Payments)", 14, startY);
      startY += 6;

      const moneyOutData = walletReport.moneyOut.map((entry: any) => [
        formatDate(entry.timestamp),
        entry.type,
        entry.amount.toFixed(2),
        entry.utid,
      ]);

      (doc as any).autoTable({
        startY,
        head: [["Date", "Type", "Amount (UGX)", "UTID"]],
        body: moneyOutData,
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 30 },
          2: { cellWidth: 25 },
          3: { cellWidth: 45 },
        },
      });
    }

    void savePdfFromJsPDF(doc, `Buyer_Wallet_Report_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const handleExportAnalyticsPDF = () => {
    try {
      const jsPDF = require("jspdf");
      require("jspdf-autotable");
      const doc = new jsPDF.default();

      doc.setFontSize(18);
      doc.setTextColor(46, 125, 50);
      doc.text("Buyer Analytics Report", 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("Know Your Numbers — Farm2Market Uganda", 14, 28);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 34);

      let y = 44;

      // Wallet Summary
      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);
      doc.text("Wallet Summary", 14, y);
      y += 8;

      (doc as any).autoTable({
        startY: y,
        head: [["Metric", "Value"]],
        body: [
          ["Available Balance", `UGX ${(walletBalance?.balance || 0).toLocaleString()}`],
          ["Total Deposits", `UGX ${(walletBalance?.totalDeposits || 0).toLocaleString()}`],
        ],
        theme: "grid",
        headStyles: { fillColor: [46, 125, 50], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      // Transaction Summary
      if (transactionLedger) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(13);
        doc.text("Transaction Summary", 14, y);
        y += 8;

        (doc as any).autoTable({
          startY: y,
          head: [["Metric", "Value"]],
          body: [
            ["Total Transactions", String(transactionLedger.totals?.totalTransactions || 0)],
            ["Total Quantity", `${(transactionLedger.totals?.totalQuantityKilos || 0).toFixed(2)} kg`],
            ["Total Cost", `UGX ${(transactionLedger.totals?.totalCost || 0).toLocaleString()}`],
          ],
          theme: "grid",
          headStyles: { fillColor: [25, 118, 210], fontSize: 9 },
          bodyStyles: { fontSize: 8 },
          margin: { left: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 12;
      }

      // Wallet Report
      if (walletReport) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFontSize(13);
        doc.text("Cash Flow Summary", 14, y);
        y += 8;

        (doc as any).autoTable({
          startY: y,
          head: [["Metric", "Value"]],
          body: [
            ["Total Money In", `UGX ${(walletReport.totals?.totalMoneyIn || 0).toLocaleString()}`],
            ["Total Money Out", `UGX ${(walletReport.totals?.totalMoneyOut || 0).toLocaleString()}`],
            ["Current Balance", `UGX ${(walletReport.totals?.currentBalance || 0).toLocaleString()}`],
          ],
          theme: "grid",
          headStyles: { fillColor: [245, 124, 0], fontSize: 9 },
          bodyStyles: { fontSize: 8 },
          margin: { left: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 12;
      }

      // Orders
      const allOrders = orders?.orders || [];
      const allListingOrders = listingOrders?.orders || [];
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.text("Orders Overview", 14, y);
      y += 8;

      (doc as any).autoTable({
        startY: y,
        head: [["Metric", "Value"]],
        body: [
          ["Direct Orders", String(allOrders.length)],
          ["Listing Orders", String(allListingOrders.length)],
          ["FarmCoin Rewards", String(buyerRewardSummary?.balance || 0)],
        ],
        theme: "grid",
        headStyles: { fillColor: [0, 131, 143], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14 },
      });

      void savePdfFromJsPDF(doc, `buyer_analytics_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (e) {
      alert("PDF export failed. Please try again.");
    }
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

  const handleListingPurchase = async (listingId: string, availableUnits: number) => {
    const unitsStr = listingUnitsInput[listingId] || "";
    const units = parseInt(unitsStr, 10);

    if (!unitsStr || Number.isNaN(units) || units <= 0) {
      setListingPurchaseMessage({ type: "error", text: "Please enter a valid number of units" });
      return;
    }

    if (units > availableUnits) {
      setListingPurchaseMessage({ type: "error", text: `Requested units (${units}) exceed available units (${availableUnits})` });
      return;
    }

    setListingPurchaseMessage(null);

    try {
      const result = await createListingPurchase({
        buyerId: userId,
        listingId: listingId as any,
        unitCount: units,
      });

      setListingPurchaseMessage({
        type: "success",
        text: `Purchase successful. UTID: ${result.purchaseUtid}. Await delivery confirmation flow.`,
      });
      setListingUnitsInput({ ...listingUnitsInput, [listingId]: "" });
    } catch (error: any) {
      setListingPurchaseMessage({
        type: "error",
        text: `Purchase failed: ${error.message}`,
      });
    }
  };

  const handleVendorStorePurchase = async (listingId: string, availableUnits: number) => {
    const unitsStr = vendorStoreUnitsInput[listingId] || "";
    const units = parseInt(unitsStr, 10);

    if (!unitsStr || Number.isNaN(units) || units <= 0) {
      setVendorStorePurchaseMessage({ type: "error", text: "Please enter a valid number of units" });
      return;
    }

    if (units > availableUnits) {
      setVendorStorePurchaseMessage({ type: "error", text: `Requested units (${units}) exceed available units (${availableUnits})` });
      return;
    }

    setVendorStorePurchaseMessage(null);

    try {
      const result = await createVendorStorePurchase({
        buyerId: userId,
        listingId: listingId as any,
        unitCount: units,
      });

      setVendorStorePurchaseMessage({
        type: "success",
        text: `Purchase successful! UTID: ${(result as any).purchaseUtid}. Collect from the seller's location.`,
      });
      setVendorStoreUnitsInput({ ...vendorStoreUnitsInput, [listingId]: "" });
    } catch (error: any) {
      setVendorStorePurchaseMessage({
        type: "error",
        text: `Purchase failed: ${error.message}`,
      });
    }
  };

  const handleBuyerConfirmDelivery = async (purchaseId: string) => {
    try {
      await buyerConfirmListingDelivery({
        buyerId: userId,
        purchaseId: purchaseId as any,
      });
      setListingPurchaseMessage({ type: "success", text: "Delivery confirmed. You received a FarmCoin reward." });
    } catch (error: any) {
      setListingPurchaseMessage({ type: "error", text: error?.message || "Failed to confirm delivery" });
    }
  };

  const handleBuyerRewardCashout = async () => {
    if (!rewardReceiptUtid || !rewardCashoutPhone.trim()) {
      setRewardCashoutMessage({ type: "error", text: "Select a receipt and enter a phone number" });
      return;
    }

    try {
      const result = await cashOutBuyerRewardReceipt({
        buyerId: userId,
        receiptUtid: rewardReceiptUtid,
        phoneNumber: rewardCashoutPhone.trim(),
      });
      setRewardCashoutMessage({ type: "success", text: `Cash-out processed. UGX ${result.payoutAmount.toFixed(2)} requested.` });
      setRewardReceiptUtid("");
    } catch (error: any) {
      setRewardCashoutMessage({ type: "error", text: error?.message || "Cash-out failed" });
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
            📩 Inbox {messageThreads && messageThreads.length > 0
              ? `(${messageThreads.reduce((sum, t) => sum + (t.unreadCount || 0), 0)})`
              : ""}
          </button>
        </div>
      </div>

      {/* Profile Card */}
      <UserProfileCard userId={userId} />

      {/* Advance Purchase Market quick link */}
      <Link href="/buyer/advance-purchase" style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "1rem 1.25rem",
        background: "#f3e5f5",
        border: "1.5px solid #ce93d8",
        borderRadius: "14px",
        textDecoration: "none",
        color: "#6a1b9a",
        fontFamily: '"Montserrat", sans-serif',
        fontWeight: 700,
        fontSize: "clamp(0.9rem,2.5vw,1rem)",
        boxShadow: "0 0 0 1px rgba(106,27,154,0.20), 0 0 16px rgba(106,27,154,0.18), 0 2px 8px rgba(106,27,154,0.14)",
        marginBottom: "1.5rem",
      }}>
        <span style={{ fontSize: "1.8rem" }}>🌱</span>
        <div>
          <div>Advance Purchase Market</div>
          <div style={{ fontSize: "0.78rem", fontWeight: 500, color: "#8e24aa" }}>
            Fund a farmer&apos;s next harvest ahead of delivery
          </div>
        </div>
      </Link>

      {/* Communities Section */}
      <div style={{
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        marginBottom: "1.5rem"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
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
          <Link
            href="/farmer/communities"
            style={{
              padding: "0.4rem 0.8rem",
              background: "#1976d2",
              color: "#fff",
              textDecoration: "none",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: "600",
              transition: "background 0.2s",
            }}
          >
            Browse All
          </Link>
        </div>
        {communities === undefined ? (
          <p style={{ color: "#999", fontSize: "0.9rem" }}>Loading communities...</p>
        ) : memberCommunities.length === 0 ? (
          <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
            You haven&apos;t joined any communities yet.{" "}
            <Link href="/farmer/communities" style={{ color: "#1976d2", fontWeight: 600 }}>Browse communities</Link>
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
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
                    {/* Card Header */}
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
                    {/* Card Body */}
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
                        onClick={() => router.push(`/community-only/messages?communityId=${c.id}`)}
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
                        🌾 View Community
                      </button>
                    </div>
                  </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Trader Listing Orders */}
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
          Trader Listing Orders
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
            value={listingOrdersPageSize}
            onChange={(e) => {
              const nextSize = Number(e.target.value);
              setListingOrdersPageSize(nextSize);
              setListingOrdersPage(1);
              updatePaginationPreferences({
                userId,
                listKey: "buyer_listing_orders",
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
        {listingOrders === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : !listingOrders?.orders?.length ? (
          <p style={{ color: "#666" }}>No trader listing orders yet</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {pagedListingOrders.map((order: any) => {
              const canConfirm = order.traderConfirmedAt && !order.buyerConfirmedAt;
              return (
                <div key={order.purchaseId} style={{
                  padding: "1rem",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0"
                }}>
                  <div style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
                    {order.productName || order.produceType} • {order.unitCount} unit(s) ({order.totalKilos} kg)
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>
                    Price per unit: {formatUGX(order.pricePerUnit)} • Total: {formatUGX(order.totalCost)}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>
                    ETA: {order.etaType ? formatEtaLabel(order) : "N/A"}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#475569", marginBottom: "0.5rem" }}>
                    Trader confirmed: {order.traderConfirmedAt ? "Yes" : "No"} • Buyer confirmed: {order.buyerConfirmedAt ? "Yes" : "No"} • Superadmin confirmed: {order.superadminConfirmedAt ? "Yes" : "No"}
                  </div>
                  {isMobile && (
                    <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.5rem" }}>
                      Hint: Confirm after you receive the items.
                    </div>
                  )}
                  {canConfirm && (
                    <button
                      type="button"
                      onClick={() => handleBuyerConfirmDelivery(order.purchaseId)}
                      style={{
                        padding: "0.5rem 1rem",
                        background: "#1976d2",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "0.85rem",
                        fontWeight: "600",
                        cursor: "pointer"
                      }}
                    >
                      Confirm Delivery (Earn FarmCoin)
                    </button>
                  )}
                  <div style={{ marginTop: "0.75rem", fontFamily: "monospace", fontSize: "0.85rem", color: "#475569" }}>
                    UTID: {order.purchaseUtid}
                  </div>
                </div>
              );
            })}
            {listingOrdersTotal > 0 && (
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.5rem"
              }}>
                <div style={{ fontSize: "0.85rem", color: "#666" }}>
                  Showing {listingOrdersStart}-{listingOrdersEnd} of {listingOrdersTotal}
                </div>
                {listingOrdersTotalPages > 1 && (
                  <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setListingOrdersPage((prev) => Math.max(1, prev - 1))}
                      disabled={listingOrdersPage === 1}
                      style={{
                        padding: "0.3rem 0.6rem",
                        background: listingOrdersPage === 1 ? "#e0e0e0" : "#f5f5f5",
                        color: "#333",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        cursor: listingOrdersPage === 1 ? "not-allowed" : "pointer",
                        fontSize: "0.8rem",
                        fontWeight: "600"
                      }}
                    >
                      Prev
                    </button>
                    {Array.from({ length: listingOrdersTotalPages }, (_, idx) => {
                      const page = idx + 1;
                      const isActive = page === listingOrdersPage;
                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setListingOrdersPage(page)}
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
                      onClick={() => setListingOrdersPage((prev) => Math.min(listingOrdersTotalPages, prev + 1))}
                      disabled={listingOrdersPage === listingOrdersTotalPages}
                      style={{
                        padding: "0.3rem 0.6rem",
                        background: listingOrdersPage === listingOrdersTotalPages ? "#e0e0e0" : "#f5f5f5",
                        color: "#333",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        cursor: listingOrdersPage === listingOrdersTotalPages ? "not-allowed" : "pointer",
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

        {/* Buyer Reward Cash-out */}
        <div style={{
          padding: "clamp(1rem, 3vw, 1.5rem)",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          border: "1px solid #e0e0e0"
        }}>
          <h3 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "clamp(1rem, 3vw, 1.2rem)", color: "#1a1a1a" }}>
            Buyer FarmCoin Rewards
          </h3>
          <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.75rem" }}>
            Sentify is to turn your FarmCoin into cash via mobile money.
          </div>
          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ color: "#666", fontSize: "0.9rem" }}>Reward Balance</div>
            <div style={{ fontSize: "1.25rem", fontWeight: "600", color: "#1976d2" }}>
              {buyerRewardSummary?.balance ?? 0} Token(s)
            </div>
            {buyerRewardSummary && (
              <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                Cash-out rate: UGX {buyerRewardSummary.cashoutRate} per token
              </div>
            )}
          </div>
          {buyerRewardSummary?.recent?.length ? (
            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: "0.35rem" }}>
                Recent rewards
              </div>
              <div style={{ display: "grid", gap: "0.35rem" }}>
                {buyerRewardSummary.recent.map((entry: any, idx: number) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#475569" }}>
                    <span>{entry.source?.replace("_", " ")}</span>
                    <span style={{ fontWeight: 600 }}>{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.85rem", color: "#666" }}>
                Select Reward Receipt
              </label>
              <select
                value={rewardReceiptUtid}
                onChange={(e) => setRewardReceiptUtid(e.target.value)}
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid #ddd" }}
              >
                <option value="">Select receipt</option>
                {(buyerRewardReceipts || []).map((receipt: any) => (
                  <option key={receipt.utid} value={receipt.utid}>
                    {receipt.utid} • {receipt.delta} token(s)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.85rem", color: "#666" }}>
                Mobile Money Phone Number
              </label>
              <input
                type="tel"
                value={rewardCashoutPhone}
                onChange={(e) => setRewardCashoutPhone(e.target.value)}
                placeholder="e.g., 2567XXXXXXXX"
                style={{ width: "100%", padding: "0.6rem", borderRadius: "6px", border: "1px solid #ddd" }}
              />
            </div>
            <button
              type="button"
              onClick={handleBuyerRewardCashout}
              style={{
                padding: "0.6rem 1rem",
                background: "#1976d2",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              Sentify Cash-out
            </button>
            {rewardCashoutMessage && (
              <div style={{
                padding: "0.6rem",
                borderRadius: "6px",
                fontSize: "0.85rem",
                background: rewardCashoutMessage.type === "success" ? "#e8f5e9" : "#ffebee",
                color: rewardCashoutMessage.type === "success" ? "#2e7d32" : "#c62828",
                border: `1px solid ${rewardCashoutMessage.type === "success" ? "#c8e6c9" : "#ffcdd2"}`
              }}>
                {rewardCashoutMessage.text}
              </div>
            )}
          </div>
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

      {/* Trader-sourced Listings */}
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
          Trader-sourced Listings (Fixed Price)
        </h3>
        <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1rem" }}>
          Traders set a fixed price per unit. Buy any number of units during the purchase window.
        </p>

        {listingPurchaseMessage && (
          <div style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            background: listingPurchaseMessage.type === "success" ? "#e8f5e9" : "#ffebee",
            borderRadius: "8px",
            border: `1px solid ${listingPurchaseMessage.type === "success" ? "#4caf50" : "#ef5350"}`,
            color: listingPurchaseMessage.type === "success" ? "#2e7d32" : "#c62828",
          }}>
            {listingPurchaseMessage.text}
          </div>
        )}

        {traderListings === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : !traderListings?.listings?.length ? (
          <p style={{ color: "#666" }}>No trader listings available</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e0e0e0", background: "#f9f9f9" }}>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>UTID</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Product</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Units</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Unit Size</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Price / Unit</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>ETA</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {traderListings.listings.map((listing: any) => {
                  const unitsAvailable = listing.availableUnits ?? 0;
                  const etaLabel = listing.etaType && listing.etaValue
                    ? listing.etaType === "arrival_time"
                      ? formatDate(listing.etaValue)
                      : `${listing.etaValue}h`
                    : "N/A";

                  return (
                    <tr key={listing.listingId} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "0.75rem", fontFamily: "monospace", fontWeight: 700 }}>{listing.listingUtid}</td>
                      <td style={{ padding: "0.75rem" }}>
                        <div>{listing.productName || listing.produceType}</div>
                        <div style={{ fontSize: "0.75rem", color: "#666" }}>{listing.traderAlias || "Trader"}</div>
                      </td>
                      <td style={{ padding: "0.75rem" }}>{unitsAvailable}</td>
                      <td style={{ padding: "0.75rem" }}>{listing.unitSize} unit</td>
                      <td style={{ padding: "0.75rem" }}>{formatUGX(listing.pricePerUnit)}</td>
                      <td style={{ padding: "0.75rem" }}>{etaLabel}</td>
                      <td style={{ padding: "0.75rem" }}>
                        {windowStatus?.isOpen ? (
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <input
                              type="number"
                              min="1"
                              max={unitsAvailable}
                              value={listingUnitsInput[listing.listingId] || ""}
                              onChange={(e) => setListingUnitsInput({ ...listingUnitsInput, [listing.listingId]: e.target.value })}
                              placeholder="Units"
                              style={{
                                padding: "0.5rem",
                                border: "1px solid #ddd",
                                borderRadius: "4px",
                                fontSize: "0.85rem",
                                width: "80px"
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setListingUnitsInput({ ...listingUnitsInput, [listing.listingId]: String(unitsAvailable) })}
                              disabled={unitsAvailable <= 0}
                              style={{
                                padding: "0.5rem 0.75rem",
                                background: "#f5f5f5",
                                color: "#333",
                                border: "1px solid #ddd",
                                borderRadius: "4px",
                                fontSize: "0.8rem",
                                cursor: unitsAvailable <= 0 ? "not-allowed" : "pointer"
                              }}
                            >
                              Buy All
                            </button>
                            <button
                              onClick={() => handleListingPurchase(listing.listingId, unitsAvailable)}
                              disabled={!listingUnitsInput[listing.listingId] || unitsAvailable <= 0}
                              style={{
                                padding: "0.5rem 1rem",
                                background: !listingUnitsInput[listing.listingId] || unitsAvailable <= 0 ? "#ccc" : "#1976d2",
                                color: "#fff",
                                border: "none",
                                borderRadius: "4px",
                                fontSize: "0.85rem",
                                fontWeight: "600",
                                cursor: !listingUnitsInput[listing.listingId] || unitsAvailable <= 0 ? "not-allowed" : "pointer"
                              }}
                            >
                              Purchase
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
        )}
      </div>

      {/* Vendor & Store Listings */}
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
          🏪 Shop from Vendors &amp; Stores
        </h3>
        <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1rem" }}>
          Browse packaged produce from verified vendors and stores. Collect from their location after purchase.
        </p>

        {vendorStorePurchaseMessage && (
          <div style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            background: vendorStorePurchaseMessage.type === "success" ? "#e8f5e9" : "#ffebee",
            borderRadius: "8px",
            border: `1px solid ${vendorStorePurchaseMessage.type === "success" ? "#4caf50" : "#ef5350"}`,
            color: vendorStorePurchaseMessage.type === "success" ? "#2e7d32" : "#c62828",
          }}>
            {vendorStorePurchaseMessage.text}
          </div>
        )}

        {vendorStoreListings === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : !vendorStoreListings?.listings?.length ? (
          <p style={{ color: "#666" }}>No vendor or store listings available right now.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e0e0e0", background: "#f9f9f9" }}>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>UTID</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Product</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Packaging</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Available</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Price / Unit</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Seller</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Collection Point</th>
                  <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: "600", color: "#333" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {(vendorStoreListings.listings as any[]).map((listing: any) => {
                  const unitsAvailable = listing.availableUnits ?? 0;
                  const isVendor = listing.sellerRole === "vendor";
                  const badgeColor = isVendor ? "#e65100" : "#c62828";
                  const badgeLabel = isVendor ? "Vendor" : "Store";

                  return (
                    <tr key={listing.listingId} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "0.75rem", fontFamily: "monospace", fontWeight: 700 }}>{listing.utid}</td>
                      <td style={{ padding: "0.75rem" }}>{listing.produceType}</td>
                      <td style={{ padding: "0.75rem" }}>
                        {listing.packagingTypeEnum
                          ? listing.packagingTypeEnum.replace(/_/g, " ")
                          : listing.pricingUnit || "unit"}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {unitsAvailable > 0 ? (
                          unitsAvailable
                        ) : (
                          <span style={{
                            padding: "0.2rem 0.5rem",
                            background: "#ffebee",
                            color: "#c62828",
                            borderRadius: "4px",
                            fontSize: "0.8rem",
                            fontWeight: "600"
                          }}>
                            Out of Stock
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {listing.pricePerUnit
                          ? formatUGX(listing.pricePerUnit)
                          : listing.pricePerKilo
                          ? formatUGX(listing.pricePerKilo)
                          : "N/A"}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        <div>{listing.sellerAlias || "Seller"}</div>
                        <span style={{
                          display: "inline-block",
                          marginTop: "0.2rem",
                          padding: "0.15rem 0.4rem",
                          background: badgeColor,
                          color: "#fff",
                          borderRadius: "4px",
                          fontSize: "0.7rem",
                          fontWeight: "600",
                          textTransform: "uppercase"
                        }}>
                          {badgeLabel}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem", fontSize: "0.85rem", color: "#555" }}>
                        {listing.collectionLocationText || "Ask seller"}
                      </td>
                      <td style={{ padding: "0.75rem" }}>
                        {windowStatus?.isOpen ? (
                          unitsAvailable > 0 ? (
                            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                              <input
                                type="number"
                                min="1"
                                max={unitsAvailable}
                                value={vendorStoreUnitsInput[listing.listingId] || ""}
                                onChange={(e) => setVendorStoreUnitsInput({ ...vendorStoreUnitsInput, [listing.listingId]: e.target.value })}
                                placeholder="Units"
                                style={{
                                  padding: "0.5rem",
                                  border: "1px solid #ddd",
                                  borderRadius: "4px",
                                  fontSize: "0.85rem",
                                  width: "80px"
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => setVendorStoreUnitsInput({ ...vendorStoreUnitsInput, [listing.listingId]: String(unitsAvailable) })}
                                style={{
                                  padding: "0.5rem 0.75rem",
                                  background: "#f5f5f5",
                                  color: "#333",
                                  border: "1px solid #ddd",
                                  borderRadius: "4px",
                                  fontSize: "0.8rem",
                                  cursor: "pointer"
                                }}
                              >
                                Buy All
                              </button>
                              <button
                                onClick={() => handleVendorStorePurchase(listing.listingId, unitsAvailable)}
                                disabled={!vendorStoreUnitsInput[listing.listingId]}
                                style={{
                                  padding: "0.5rem 1rem",
                                  background: !vendorStoreUnitsInput[listing.listingId] ? "#ccc" : "#e65100",
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: "4px",
                                  fontSize: "0.85rem",
                                  fontWeight: "600",
                                  cursor: !vendorStoreUnitsInput[listing.listingId] ? "not-allowed" : "pointer"
                                }}
                              >
                                Purchase
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: "#999", fontSize: "0.85rem" }}>Sold Out</span>
                          )
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
        )}
      </div>

      {/* Farmer-sourced Inventory - Institutional Table View */}
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
          Farmer-sourced Inventory (100kg Bags)
        </h3>
        <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1rem" }}>
          All inventory is listed in 100kg bags. Purchase any quantity or buy the full bag.
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
            {/* Table View for Desktop */}
            <div style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e0e0e0", background: "#f9f9f9" }}>
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
                  {pagedInventory.map((item: any, index: number) => {
                    const itemId = item.inventoryId;
                    const isPurchasing = purchasing === itemId;
                    const canPurchase = windowStatus?.isOpen && !isPurchasing;
                    const storageAge = item.storageStartTime 
                      ? Math.floor((getUgandaTime() - item.storageStartTime) / (1000 * 60 * 60 * 24))
                      : 0;
                    return (
                      <tr key={index} style={{ borderBottom: "1px solid #f0f0f0" }}>
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
                                onClick={() => setKilosInput({ ...kilosInput, [itemId]: String(item.totalKilos) })}
                                disabled={isPurchasing}
                                style={{
                                  padding: "0.5rem 0.75rem",
                                  background: "#f5f5f5",
                                  color: "#333",
                                  border: "1px solid #ddd",
                                  borderRadius: "4px",
                                  fontSize: "0.8rem",
                                  cursor: isPurchasing ? "not-allowed" : "pointer"
                                }}
                              >
                                Buy All
                              </button>
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

            {inventoryTotal > 0 && (
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.5rem",
                marginBottom: "1.5rem"
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
            
            {/* Card View for Mobile (fallback) */}
            <div style={{ display: "none", flexDirection: "column", gap: "1rem" }}>
            {pagedInventory.map((item: any, index: number) => {
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
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                          <div style={{ fontWeight: "600", color: "#1a1a1a", fontSize: "clamp(0.9rem, 3vw, 1rem)" }}>{item.traderAlias}</div>
                          {item.traderIsVerified && (
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
                        fontSize: "clamp(0.98rem, 2.8vw, 1.26rem)", 
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

      {/* Buyer Analytics Summary */}
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
              📊 Buyer Analytics
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
            <div style={{ fontSize: "0.7rem", color: "#666", fontWeight: 600 }}>Balance</div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#2e7d32" }}>
              UGX {(walletBalance?.balance || 0).toLocaleString()}
            </div>
          </div>
          <div style={{ padding: "0.75rem", background: "#e3f2fd", borderRadius: 8, textAlign: "center" }}>
            <div style={{ fontSize: "0.7rem", color: "#666", fontWeight: 600 }}>Transactions</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1976d2" }}>{transactionLedger?.totals?.totalTransactions || 0}</div>
          </div>
          <div style={{ padding: "0.75rem", background: "#fff3e0", borderRadius: 8, textAlign: "center" }}>
            <div style={{ fontSize: "0.7rem", color: "#666", fontWeight: 600 }}>Total Spent</div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#f57c00" }}>
              UGX {(transactionLedger?.totals?.totalCost || 0).toLocaleString()}
            </div>
          </div>
          <div style={{ padding: "0.75rem", background: "#fce4ec", borderRadius: 8, textAlign: "center" }}>
            <div style={{ fontSize: "0.7rem", color: "#666", fontWeight: 600 }}>FarmCoin</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#d32f2f" }}>{buyerRewardSummary?.balance || 0}</div>
          </div>
        </div>
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
              value={ordersPageSize}
              onChange={(e) => {
                const nextSize = Number(e.target.value);
                setOrdersPageSize(nextSize);
                setOrdersPage(1);
                updatePaginationPreferences({
                  userId,
                  listKey: "buyer_orders",
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
        {orders === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : !orders || !orders.orders || orders.orders.length === 0 ? (
          <p style={{ color: "#666" }}>No orders yet</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {pagedOrders.map((order: any, index: number) => (
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
                {(order.etaType || order.deliveryStatus || order.progressStage) && (
                  <div style={{
                    marginBottom: "0.35rem",
                    padding: "0.5rem",
                    background: "#f8fafc",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    fontSize: "0.85rem",
                    color: "#475569"
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{formatEtaLabel(order)}</div>
                    {order.etaLastUpdatedAt && (
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                        Updated: {formatDate(order.etaLastUpdatedAt)}
                      </div>
                    )}
                    {(order.deliveryStatus || order.progressStage) && (
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        Status: {order.deliveryStatus || "in_transit"}{order.progressStage ? ` • ${order.progressStage}` : ""}
                      </div>
                    )}
                    {(order.departureLocation || order.destinationLocation) && (
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        Route: {order.departureLocation || "N/A"} → {order.destinationLocation || "N/A"}
                      </div>
                    )}
                    {order.etaTimestamp && (
                      <div style={{ fontSize: "0.75rem", color: order.etaIsPast ? "#b91c1c" : "#0f766e" }}>
                        ETA Countdown: {order.etaIsPast
                          ? `${(order.etaHoursOverdue || 0).toFixed(1)}h overdue`
                          : `${(order.etaHoursRemaining || 0).toFixed(1)}h remaining`}
                      </div>
                    )}
                    {order.latestEtaChange && (
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        ETA Update: {formatEtaValue(order.latestEtaChange.etaType, order.latestEtaChange.oldEtaValue)} → {formatEtaValue(order.latestEtaChange.etaType, order.latestEtaChange.newEtaValue)}
                        {order.latestEtaChange.reason ? ` • Reason: ${order.latestEtaChange.reason}` : ""}
                      </div>
                    )}
                  </div>
                )}
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
                  {isMobile && (
                    <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.35rem" }}>
                      Hint: Check the deadline before pickup.
                    </div>
                  )}
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
            {ordersTotal > 0 && (
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.5rem",
                marginTop: "0.25rem"
              }}>
                <div style={{ fontSize: "0.8rem", color: "#666" }}>
                  Showing {ordersStart}-{ordersEnd} of {ordersTotal}
                </div>
                {ordersTotalPages > 1 && (
                  <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setOrdersPage((prev) => Math.max(1, prev - 1))}
                      disabled={ordersPage === 1}
                      style={{
                        padding: "0.3rem 0.6rem",
                        background: ordersPage === 1 ? "#e0e0e0" : "#f5f5f5",
                        color: "#333",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        cursor: ordersPage === 1 ? "not-allowed" : "pointer",
                        fontSize: "0.8rem",
                        fontWeight: "600"
                      }}
                    >
                      Prev
                    </button>
                    {Array.from({ length: ordersTotalPages }, (_, idx) => {
                      const page = idx + 1;
                      const isActive = page === ordersPage;
                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setOrdersPage(page)}
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
                      onClick={() => setOrdersPage((prev) => Math.min(ordersTotalPages, prev + 1))}
                      disabled={ordersPage === ordersTotalPages}
                      style={{
                        padding: "0.3rem 0.6rem",
                        background: ordersPage === ordersTotalPages ? "#e0e0e0" : "#f5f5f5",
                        color: "#333",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        cursor: ordersPage === ordersTotalPages ? "not-allowed" : "pointer",
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

      {/* Transaction Ledger */}
      <div style={{
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        marginBottom: "1.5rem"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <h3 style={{ margin: 0, fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", color: "#1a1a1a" }}>
            Transaction Ledger
          </h3>
          {transactionLedger && transactionLedger.transactions.length > 0 && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => exportTransactionLedgerToExcel()}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#000000",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: "600"
                }}
              >
                Export Excel
              </button>
              <button
                onClick={() => exportTransactionLedgerToPDF()}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#ffc107",
                  color: "#000",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: "600"
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
            value={ledgerPageSize}
            onChange={(e) => {
              const nextSize = Number(e.target.value);
              setLedgerPageSize(nextSize);
              setLedgerPage(1);
              updatePaginationPreferences({
                userId,
                listKey: "buyer_ledger",
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
                  {pagedTransactions.map((tx: any, index: number) => (
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
            {ledgerTotal > 0 && (
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.5rem",
                marginTop: "0.75rem"
              }}>
                <div style={{ fontSize: "0.8rem", color: "#666" }}>
                  Showing {ledgerStart}-{ledgerEnd} of {ledgerTotal}
                </div>
                {ledgerTotalPages > 1 && (
                  <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => setLedgerPage((prev) => Math.max(1, prev - 1))}
                      disabled={ledgerPage === 1}
                      style={{
                        padding: "0.3rem 0.6rem",
                        background: ledgerPage === 1 ? "#e0e0e0" : "#f5f5f5",
                        color: "#333",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        cursor: ledgerPage === 1 ? "not-allowed" : "pointer",
                        fontSize: "0.8rem",
                        fontWeight: "600"
                      }}
                    >
                      Prev
                    </button>
                    {Array.from({ length: ledgerTotalPages }, (_, idx) => {
                      const page = idx + 1;
                      const isActive = page === ledgerPage;
                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setLedgerPage(page)}
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
                      onClick={() => setLedgerPage((prev) => Math.min(ledgerTotalPages, prev + 1))}
                      disabled={ledgerPage === ledgerTotalPages}
                      style={{
                        padding: "0.3rem 0.6rem",
                        background: ledgerPage === ledgerTotalPages ? "#e0e0e0" : "#f5f5f5",
                        color: "#333",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        cursor: ledgerPage === ledgerTotalPages ? "not-allowed" : "pointer",
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <h3 style={{ margin: 0, fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", color: "#1a1a1a" }}>
            Wallet Report
          </h3>
          {walletReport && (walletReport.moneyIn.length > 0 || walletReport.moneyOut.length > 0) && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => exportWalletReportToExcel()}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#000000",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: "600"
                }}
              >
                📊 Export Excel
              </button>
              <button
                onClick={() => exportWalletReportToPDF()}
                style={{
                  padding: "0.5rem 1rem",
                  background: "#ffc107",
                  color: "#000",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: "600"
                }}
              >
                📄 Export PDF
              </button>
            </div>
          )}
        </div>
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

      {/* Market Price Reports Section */}
      <div style={{
        marginTop: "2rem",
        padding: "1.5rem",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
        border: "1px solid #e8f5e9",
      }}>
        <h3 style={{
          fontSize: "1.1rem",
          fontWeight: "700",
          color: "#2c2c2c",
          marginBottom: "0.25rem",
          fontFamily: '"Montserrat", sans-serif',
        }}>
          📊 Market Price Reports
        </h3>
        <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: "1.25rem" }}>
          Download daily, weekly or monthly market price sheets as Excel files.
          Pay with FarmCoin or via Pesapal.
        </p>

        {priceReportMessage && (
          <div style={{
            padding: "0.75rem",
            borderRadius: "8px",
            marginBottom: "1rem",
            background: priceReportMessage.type === "success" ? "#e8f5e9" : "#ffebee",
            color: priceReportMessage.type === "success" ? "#2e7d32" : "#c62828",
            fontSize: "0.9rem",
          }}>
            {priceReportMessage.text}
            <button
              onClick={() => setPriceReportMessage(null)}
              style={{ background: "none", border: "none", cursor: "pointer", float: "right", fontWeight: "700" }}
            >×</button>
          </div>
        )}

        {priceSheetPricing === undefined ? (
          <p style={{ color: "#999", fontSize: "0.9rem" }}>Loading pricing…</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
            {([
              { type: "daily" as const, label: "Today\'s Prices", emoji: "📅", scopeKey: priceSheetPricing.currentDailyKey, priceUGX: priceSheetPricing.dailyPriceUGX },
              { type: "weekly" as const, label: "This Week", emoji: "📆", scopeKey: priceSheetPricing.currentWeeklyKey, priceUGX: priceSheetPricing.weeklyPriceUGX },
              { type: "monthly" as const, label: "This Month", emoji: "🗓️", scopeKey: priceSheetPricing.currentMonthlyKey, priceUGX: priceSheetPricing.monthlyPriceUGX },
            ]).map(({ type, label, emoji, scopeKey, priceUGX }) => (
              <div key={type} style={{
                background: "#f9fbf9",
                border: "1px solid #e0ece0",
                borderRadius: "10px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}>
                <div style={{ fontWeight: "700", fontSize: "1rem", color: "#1b5e20" }}>
                  {emoji} {label}
                </div>
                <div style={{ fontSize: "0.78rem", color: "#666" }}>{scopeKey}</div>
                <div style={{ fontWeight: "700", color: "#2e7d32", fontSize: "1rem" }}>
                  {priceUGX > 0 ? `UGX ${priceUGX.toLocaleString("en-UG")}` : "Free"}
                </div>
                {priceUGX > 0 && (
                  <div style={{ fontSize: "0.75rem", color: "#888" }}>
                    FarmCoin balance: {(buyerFarmcoinBalance as any)?.balance?.toLocaleString("en-UG") ?? "0"}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.25rem" }}>
                  {/* FarmCoin payment */}
                  <button
                    disabled={priceReportLoading === `${type}-fc`}
                    onClick={async () => {
                      setPriceReportMessage(null);
                      setPriceReportLoading(`${type}-fc`);
                      try {
                        const result = await purchasePriceSheetFarmcoin({ buyerId: userId, productType: type, scopeDateKey: scopeKey } as any);
                        setPriceReportMessage({ type: "success", text: "Paid! Preparing download…" });
                        setPriceDownloadRequest({ productType: type, scopeDateKey: scopeKey });
                      } catch (e: any) {
                        // If already owned, allow direct download
                        if (e.message?.includes("already have")) {
                          setPriceDownloadRequest({ productType: type, scopeDateKey: scopeKey });
                        } else {
                          setPriceReportMessage({ type: "error", text: e.message || "Payment failed" });
                          setPriceReportLoading(null);
                        }
                      }
                    }}
                    style={{
                      padding: "0.5rem",
                      background: priceReportLoading === `${type}-fc` ? "#c8e6c9" : "#2e7d32",
                      color: "#fff",
                      border: "none",
                      borderRadius: "7px",
                      cursor: priceReportLoading === `${type}-fc` ? "not-allowed" : "pointer",
                      fontSize: "0.82rem",
                      fontWeight: "600",
                    }}
                  >
                    {priceReportLoading === `${type}-fc` ? "⏳ Processing…" : "🪙 Pay with FarmCoin"}
                  </button>
                  {/* Pesapal payment */}
                  {priceUGX > 0 && (
                    <button
                      disabled={priceReportLoading === `${type}-pp`}
                      onClick={async () => {
                        setPriceReportMessage(null);
                        setPriceReportLoading(`${type}-pp`);
                        try {
                          const callbackUrl = `${window.location.origin}/payment/callback?type=price_sheet`;
                          const cancelUrl = `${window.location.origin}/`;
                          const result: any = await initiatePriceSheetPesapal({
                            buyerId: userId,
                            productType: type,
                            scopeDateKey: scopeKey,
                            callbackUrl,
                            cancelUrl,
                          } as any);
                          if (result?.redirectUrl) window.location.href = result.redirectUrl;
                        } catch (e: any) {
                          setPriceReportMessage({ type: "error", text: e.message || "Payment initiation failed" });
                          setPriceReportLoading(null);
                        }
                      }}
                      style={{
                        padding: "0.5rem",
                        background: priceReportLoading === `${type}-pp` ? "#bbdefb" : "#1976d2",
                        color: "#fff",
                        border: "none",
                        borderRadius: "7px",
                        cursor: priceReportLoading === `${type}-pp` ? "not-allowed" : "pointer",
                        fontSize: "0.82rem",
                        fontWeight: "600",
                      }}
                    >
                      {priceReportLoading === `${type}-pp` ? "⏳ Redirecting…" : "💳 Pay via Pesapal"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: "0.72rem", color: "#aaa", marginTop: "1rem" }}>
          Downloads include indicative prices only. Includes N days of available published market data.
        </p>
      </div>

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
