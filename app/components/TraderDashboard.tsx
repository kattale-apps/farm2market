"use client";

import { useQuery, useMutation } from "convex/react";
import { EnvelopeIcon, MenuIcon } from "./icons/HeaderIcons";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { exportToExcel, exportToPDF, formatUTIDDataForExport } from "../utils/exportUtils";
import { exportUTIDsByCategory, exportUTIDsByCategoryPDF, exportInventoryVolume, exportCapitalVolume } from "../utils/traderReports";
import { getUgandaTime, inUgandaTime } from "../utils/timeUtils";
import { ContactUs } from "./ContactUs";
import { TraceRecords } from "./records/TraceRecords";
import { savePdfFromJsPDF } from "../utils/pdfDownload";
import { useRouter } from "next/navigation";
import { menuAccentColor } from "../utils/menuAccentColors";
import { VerifiedBadge, FarmCoinIcon } from "./icons/Brand";

interface TraderDashboardProps {
  userId: Id<"users">;
  userRole?: "trader" | "transporter";
}

export function TraderDashboard({ userId, userRole }: TraderDashboardProps) {
  const router = useRouter();
  const ledger = useQuery(api.traderDashboard.getLedgerBreakdown, { traderId: userId });
  const exposure = useQuery(api.traderDashboard.getExposureStatus, { traderId: userId });
  const inventory = useQuery(api.traderDashboard.getInventoryWithProjectedLoss, { traderId: userId });
  const activeUTIDs = useQuery(api.traderDashboard.getTraderActiveUTIDs, { traderId: userId });
  // Export Markets card: for traders admitted as exporters, or who joined an
  // exporter community and are waiting to be admitted.
  const exportAccess = useQuery(api.exportMarkets.getMyExportAccess, userId ? { userId } : "skip");
  const buyOffers = useQuery(api.traderBuyerNegotiations.getTraderBuyOffers, { traderId: userId });
  const messageThreads = useQuery(api.messages.getUserMessageThreads, { userId });
  const acceptBuyerOffer = useMutation(api.traderBuyerNegotiations.acceptBuyerOffer);
  const rejectBuyerOffer = useMutation(api.traderBuyerNegotiations.rejectBuyerOffer);
  const counterBuyerOffer = useMutation(api.traderBuyerNegotiations.counterBuyerOffer);
  const farmcoinSummary = useQuery(api.farmcoin.getTraderFarmcoinSummary, { traderId: userId });
  const traderDeliveryBatches = useQuery((api as any).buyers.getTraderDeliveryBatches, { traderId: userId } as any);
  const traderConfirmListingDelivery = useMutation((api as any).buyers.traderConfirmListingDelivery);
  const paginationPreferences = useQuery(
    (api as any).userSettings.getPaginationPreferences,
    { userId } as any
  );
  const updatePaginationPreferences = useMutation(
    (api as any).userSettings.updatePaginationPreferences
  );

  const [deliveryMessage, setDeliveryMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [proView, setProView] = useState(false);
  const [counterPrices, setCounterPrices] = useState<{ [key: string]: string }>({});
  const [processingOffers, setProcessingOffers] = useState<{ [key: string]: boolean }>({});
  const [offerMessages, setOfferMessages] = useState<{ [key: string]: { type: "success" | "error"; text: string } }>({});
  const user = useQuery(api.auth.getUser, { userId });
  const [isMobile, setIsMobile] = useState(false);
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

  // Section collapse state — every major dashboard section is reached only
  // via the "☰ More" menu. The wallet (Sentify and deposits) opens from the
  // Wallet button.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  const isSectionOpen = (key: string) => Boolean(openSections[key]);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);
  const [msgSlot, setMsgSlot] = useState<HTMLElement | null>(null);
  const [moreSlot, setMoreSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTitleSlot(document.getElementById("dashboard-title-slot"));
    setMsgSlot(document.getElementById("dashboard-msg-slot"));
    setMoreSlot(document.getElementById("dashboard-more-slot"));
  }, []);
  // Universal items first (MarketSpace, My Wallet and FarmCoin, Book Transport,
  // My Communities), then the role's own. Older trading screens show only
  // while something in them is still open.
  const isTransporter = userRole === "transporter";
  const olderPending =
    (buyOffers?.negotiations ?? []).some((n: any) => n.status === "pending" || n.status === "countered") ||
    (Array.isArray(traderDeliveryBatches) && traderDeliveryBatches.some((b: any) => !b.traderConfirmedAt));
  const walletLabel = (
    <>
      💰 My Wallet and FarmCoin
      {typeof farmcoinSummary?.balance === "number" ? <> (<FarmCoinIcon size={16} /> {farmcoinSummary.balance})</> : null}
    </>
  );
  const MORE_MENU_SECTIONS: Array<{ key: string; label: React.ReactNode }> = isTransporter
    ? [
        { key: "transportServices", label: "🚚 Register Transport Services" },
        { key: "marketspace", label: "🗺️ MarketSpace" },
        { key: "myWallet", label: walletLabel },
        { key: "communities", label: "🌾 My Communities" },
        { key: "transportRecords", label: "📊 Records and Reports" },
      ]
    : [
        { key: "marketspace", label: "🗺️ MarketSpace" },
        { key: "myWallet", label: walletLabel },
        { key: "bookTransport", label: "🚚 Book Transport" },
        { key: "communities", label: "🌾 My Communities" },
        { key: "globalBulk", label: "🌍 Global Bulk Markets" },
        { key: "documentsVault", label: "📄 Documents Vault" },
        { key: "myDeals", label: "🤝 My Deals" },
        { key: "myLots", label: "📒 My Lots and Ledgers" },
        { key: "postPrices", label: "🧺 Post Price to Farmers" },
        { key: "records", label: "📊 Records and Reports" },
        ...(olderPending ? [{ key: "older", label: "🗂️ Older Listings and Offers" }] : []),
      ];
  const MENU_ROUTES: Record<string, string> = {
    marketspace: "/marketspace",
    myWallet: "/wallet",
    bookTransport: "/transport",
    communities: "/farmer/communities",
    globalBulk: "/trader/export",
    documentsVault: "/trader/export?tab=documents",
    myDeals: "/trader/export?tab=deals",
    myLots: "/farmer/farm2market", // The same lot form, ledger and payment steps as every seller
    postPrices: "/vendor/buying", // The same price board processors and vendors use
    transportServices: "/transporter/services",
    transportRecords: "/records",
  };
  // Menu entries that open several sections of this page together
  const MENU_GROUPS: Record<string, string[]> = {
    records: ["traceRecords", "transactionsLog", "reports", "analytics", "analyticsCharts"],
    older: ["deliveryConfirmations", "buyOffers"],
  };
  // A handful of sections only exist in the DOM for one of the two view modes
  // (Simple vs Pro) — switch the view automatically so the menu always finds
  // the section it just opened, instead of silently doing nothing.
  const SIMPLE_VIEW_ONLY_KEYS = ["buyOffers", "deliveryConfirmations"];
  const PRO_VIEW_ONLY_KEYS = ["traceRecords", "transactionsLog", "reports", "analytics", "analyticsCharts"];
  const openSectionFromMenu = (key: string) => {
    if (MENU_ROUTES[key]) {
      setMoreMenuOpen(false);
      router.push(MENU_ROUTES[key]);
      return;
    }
    const keys = MENU_GROUPS[key] ?? [key];
    if (SIMPLE_VIEW_ONLY_KEYS.includes(keys[0])) {
      setProView(false);
    } else if (PRO_VIEW_ONLY_KEYS.includes(keys[0])) {
      setProView(true);
    }
    setOpenSections((prev) => ({ ...prev, ...Object.fromEntries(keys.map((k) => [k, true])) }));
    setMoreMenuOpen(false);
    setTimeout(() => {
      document.getElementById(`section-${keys[0]}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };
  const hideSectionButtonStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "0.75rem",
    background: "none",
    border: "none",
    color: "#1976d2",
    fontWeight: 700,
    fontSize: "0.8rem",
    cursor: "pointer",
    padding: 0,
    fontFamily: '"Montserrat", sans-serif',
  };
  const renderHideControl = (key: string) => (
    <button type="button" onClick={() => toggleSection(key)} style={hideSectionButtonStyle}>▲ Hide</button>
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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

  const handleTraderDeliveryConfirm = async (batchUtid: string) => {
    try {
      await traderConfirmListingDelivery({
        traderId: userId,
        listingUtid: batchUtid,
      });
      setDeliveryMessage({ type: "success", text: "Delivery confirmed. Await buyer and superadmin confirmation." });
    } catch (error: any) {
      setDeliveryMessage({ type: "error", text: error?.message || "Failed to confirm delivery" });
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
      exportToExcel(formattedData, filename, "Exporter");
    } else {
      exportToPDF(formattedData, filename, "Exporter", user?.alias);
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
      doc.text("Exporter Analytics Report", 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("Know Your Numbers — Farm2Market Uganda", 14, 28);
      doc.text(`Generated: ${new Date().toLocaleDateString(undefined, inUgandaTime())}`, 14, 34);

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

      void savePdfFromJsPDF(doc, `trader_analytics_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (e) {
      alert("PDF export failed. Please try again.");
    }
  };

  // Get open listings (from farmers)
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

  const sortedActiveUtids = useMemo(() => {
    if (!activeUTIDs?.utids) return [];
    return [...activeUTIDs.utids].sort((a: any, b: any) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [activeUTIDs]);
  const sortedBuyOffers = useMemo(() => {
    if (!buyOffers?.negotiations) return [];
    return [...buyOffers.negotiations].sort((a: any, b: any) => getSortTimestamp(b) - getSortTimestamp(a));
  }, [buyOffers]);

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

  const unreadMessageCount = messageThreads
    ? messageThreads.reduce((sum, t) => sum + (t.unreadCount || 0), 0)
    : 0;

  const titleContent = (
    <h2 style={{
      fontSize: "clamp(0.98rem, 4vw, 1.4rem)",
      margin: 0,
      color: "#fff",
      fontFamily: '"Montserrat", sans-serif',
      fontWeight: "700",
      letterSpacing: "-0.02em",
      whiteSpace: "nowrap",
      display: "flex",
      alignItems: "center",
      gap: "0.4rem",
      minWidth: 0,
    }}>
      Hello, {userRole === "transporter" ? "Transporter 🚛" : "Exporter 🚚"}
      {(user as any)?.isVerifiedTrader && (user as any)?.verificationStatus === "verified" && (
        <VerifiedBadge size={26} title="Verified trader" />
      )}
    </h2>
  );

  const msgContent = (
    <button
      type="button"
      onClick={() => router.push("/messages")}
      title="Messages"
      className="f2m-icon-btn"
      style={{ position: "relative" }}
    >
      <EnvelopeIcon />
      {unreadMessageCount > 0 && (
        <span style={{
          position: "absolute",
          top: "-2px",
          right: "-2px",
          background: "#d32f2f",
          color: "#fff",
          borderRadius: "50%",
          width: "20px",
          height: "20px",
          fontSize: "0.7rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "bold",
          border: "1.5px solid #fff",
        }}>
          {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
        </span>
      )}
    </button>
  );

  const moreContent = (
    <div style={{ display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setMoreMenuOpen((v) => !v)}
        title="More"
        aria-label="More menu"
        className={`f2m-icon-btn${moreMenuOpen ? " is-active" : ""}`}
        aria-expanded={moreMenuOpen}
      >
        <MenuIcon />
      </button>
      {moreMenuOpen && (
        <>
          <div
            onClick={() => setMoreMenuOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 999 }}
          />
          <div
            className="f2m-dropdown"
            style={{ padding: "0.4rem" }}
          >
            {MORE_MENU_SECTIONS.map(({ key, label }, idx) => (
              <button
                key={key}
                type="button"
                onClick={() => openSectionFromMenu(key)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  padding: "0.6rem 0.75rem",
                  marginBottom: "0.25rem",
                  background: isSectionOpen(key) ? "#e3f2fd" : "transparent",
                  border: "none",
                  borderLeft: `4px solid ${menuAccentColor(idx)}`,
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontFamily: '"Montserrat", sans-serif',
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "#2c2c2c",
                  textAlign: "left",
                }}
              >
                <span>{label}</span>
                {isSectionOpen(key) && <span style={{ color: "#1976d2", fontSize: "0.78rem" }}>Open</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div style={{ padding: "clamp(0.75rem, 2vw, 1rem)", maxWidth: "100%", boxSizing: "border-box" }}>
      {titleSlot && createPortal(titleContent, titleSlot)}
      {msgSlot && createPortal(msgContent, msgSlot)}
      {moreSlot && createPortal(moreContent, moreSlot)}

      {(exportAccess?.hasModule || exportAccess?.pending) && (
        <a
          href="/trader/export"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "1rem 1.25rem",
            background: "linear-gradient(135deg, #e1f5fe 0%, #b3e5fc 100%)",
            border: "2px solid #0288d1",
            borderRadius: "14px",
            textDecoration: "none",
            color: "#01579b",
            fontFamily: '"Montserrat", sans-serif',
            fontWeight: 700,
            fontSize: "clamp(0.9rem,2.5vw,1rem)",
            boxShadow: "0 4px 16px rgba(2,136,209,0.25)",
            marginBottom: "1rem",
          }}
        >
          <img src="/icons/cargo-ship.svg" alt="" width={44} height={44} style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div>GLOBAL BULK MARKETS</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 500, color: "#0277bd" }}>
              {!exportAccess.hasModule
                ? `Awaiting acceptance by the community admin (${exportAccess.communityNames.join(", ")})`
                : exportAccess.awaiting === "verification"
                  ? `Accepted · awaiting super admin verification (${exportAccess.communityNames.join(", ")})`
                  : `Bulk lots for global buyers, from licensed exporters: your profile, documents and deals (${exportAccess.communityNames.join(", ")})`}
            </div>
          </div>
        </a>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <button
          type="button"
          onClick={() => router.push("/wallet")}
          style={{
            padding: "0.5rem 1rem",
            background: "#e8f5e9",
            color: "#1b5e20",
            border: "1px solid #a5d6a7",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "0.9rem",
            fontWeight: "700",
          }}
        >
          💰 My Wallet and FarmCoin
        </button>
      </div>

      {!proView ? (
        /* Simple View (Default) */
        <>

          {/* Delivery Confirmation (Trader) */}
          {isSectionOpen("deliveryConfirmations") && (
          <div id="section-deliveryConfirmations" style={{
            marginBottom: "1.5rem",
            padding: "clamp(1rem, 3vw, 1.5rem)",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0"
          }}>
            {renderHideControl("deliveryConfirmations")}
            {deliveryMessage && (
              <div style={{ marginBottom: "0.75rem", padding: "0.6rem 0.75rem", borderRadius: 8, background: deliveryMessage.type === "success" ? "#e8f5e9" : "#ffebee", color: deliveryMessage.type === "success" ? "#1b5e20" : "#c62828", fontSize: "0.88rem" }}>
                {deliveryMessage.text}
              </div>
            )}
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
          )}

          {/* Buy-Offers from Buyers */}
          {isSectionOpen("buyOffers") && (
          <div id="section-buyOffers" style={{
            padding: "clamp(1rem, 3vw, 1.5rem)",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0",
            marginBottom: "1.5rem"
          }}>
            {renderHideControl("buyOffers")}
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
          )}

        </>
      ) : (
        /* Pro View */
        <>

      {/* Trace records: every lot bought, sold or held, back to the farms */}
      {isSectionOpen("traceRecords") && (
      <div id="section-traceRecords" style={{ marginBottom: "1.5rem", padding: "clamp(1rem, 3vw, 1.5rem)", background: "#fff", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", border: "1px solid #e0e0e0" }}>
        {renderHideControl("traceRecords")}
        <h3 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "clamp(1.1rem, 3.5vw, 1.3rem)", color: "#1a1a1a" }}>🌱 Trace Records</h3>
        <p style={{ marginTop: 0, fontSize: "0.85rem", color: "#607d8b" }}>Every lot you bought or sold in the app, and your stock, traced back to the farms it came from.</p>
        <TraceRecords userId={userId} />
      </div>
      )}

      {/* Transactions Log */}
      {isSectionOpen("transactionsLog") && (
      <div id="section-transactionsLog" style={{
        marginBottom: "1.5rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0"
      }}>
        {renderHideControl("transactionsLog")}
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
                  {utid.entities && utid.entities.length > 0 && utid.entities[0].deliveryPoint && (
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
                        {utid.entities[0].deliveryPoint.name}, {utid.entities[0].deliveryPoint.district}
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
      )}

      {/* Comprehensive Reports Section */}
      {isSectionOpen("reports") && (
      <div id="section-reports" style={{
        marginBottom: "1.5rem",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0"
      }}>
        {renderHideControl("reports")}
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
      )}

          {/* Pro View: Analytics */}
          {isSectionOpen("analytics") && (
          <div id="section-analytics" style={{
            padding: "clamp(1rem, 3vw, 1.5rem)",
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0",
            marginBottom: "1.5rem",
          }}>
            {renderHideControl("analytics")}
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
          )}

          {/* Pro View: Analytics Placeholders */}
          {isSectionOpen("analyticsCharts") && (
          <div id="section-analyticsCharts" style={{ marginBottom: "1.5rem" }}>
            {renderHideControl("analyticsCharts")}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
              gap: "1.5rem",
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
          </div>
          )}
        </>
      )}

      {/* Contact Us Section */}
      <ContactUs
        isMobile={false}
        onOpenInbox={() => router.push("/messages")}
      />
    </div>
  );
}
