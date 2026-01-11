/**
 * Trader Report Utilities
 * 
 * Provides specialized report generation functions for traders
 */

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatUgandaDate, formatUgandaTimeOnly, formatUgandaDateTime, getUgandaTime } from "./timeUtils";

/**
 * Export UTIDs by category to Excel
 */
export function exportUTIDsByCategory(
  utids: any[],
  category: string,
  filename: string
): void {
  const categoryUTIDs = utids.filter((utid) => utid.type === category);
  
  if (categoryUTIDs.length === 0) {
    alert(`No ${category} UTIDs to export`);
    return;
  }

  const worksheetData = categoryUTIDs.map((item) => {
    return {
      UTID: item.utid,
      Type: item.type,
      State: item.state || "N/A",
      Status: item.status || "N/A",
      Date: formatUgandaDate(item.timestamp),
      Time: formatUgandaTimeOnly(item.timestamp),
      Details: JSON.stringify(item.entities || {}),
    };
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);

  worksheet["!cols"] = [
    { wch: 30 }, // UTID
    { wch: 20 }, // Type
    { wch: 25 }, // State
    { wch: 15 }, // Status
    { wch: 12 }, // Date
    { wch: 12 }, // Time
    { wch: 50 }, // Details
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, `${category}`);

  const summaryData = [
    { Metric: "Category", Value: category },
    { Metric: "Total UTIDs", Value: categoryUTIDs.length },
    { Metric: "Generated", Value: formatUgandaDateTime(getUgandaTime()) },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  XLSX.writeFile(workbook, `${filename}_${category}.xlsx`);
}

/**
 * Export UTIDs by category to PDF
 */
export function exportUTIDsByCategoryPDF(
  utids: any[],
  category: string,
  filename: string,
  userAlias?: string
): void {
  const categoryUTIDs = utids.filter((utid) => utid.type === category);
  
  if (categoryUTIDs.length === 0) {
    alert(`No ${category} UTIDs to export`);
    return;
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.text("Farm2Market Report", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(12);
  doc.text(`Category: ${category}`, pageWidth / 2, 30, { align: "center" });
  if (userAlias) {
    doc.text(`Trader: ${userAlias}`, pageWidth / 2, 37, { align: "center" });
  }
  doc.text(`Generated: ${formatUgandaDateTime(getUgandaTime())}`, pageWidth / 2, 44, { align: "center" });
  doc.text(`Total UTIDs: ${categoryUTIDs.length}`, pageWidth / 2, 51, { align: "center" });

  const tableData = categoryUTIDs.map((item) => {
    return [
      item.utid,
      item.state || "N/A",
      item.status || "N/A",
      formatUgandaDate(item.timestamp),
      formatUgandaTimeOnly(item.timestamp),
    ];
  });

  autoTable(doc, {
    head: [["UTID", "State", "Status", "Date", "Time"]],
    body: tableData,
    startY: 60,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [25, 118, 210] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  doc.save(`${filename}_${category}.pdf`);
}

/**
 * Export inventory volume report (produce in and out)
 */
export function exportInventoryVolume(
  inventory: any[],
  filename: string,
  format: "excel" | "pdf",
  userAlias?: string
): void {
  if (inventory.length === 0) {
    alert("No inventory data to export");
    return;
  }

  // Calculate produce in (acquired) and out (sold)
  const produceIn = inventory.filter((inv) => inv.status === "in_storage" || inv.status === "pending_delivery");
  const produceOut = inventory.filter((inv) => inv.status === "sold");

  // Group by produce type
  const inByType = new Map<string, { kilos: number; count: number }>();
  const outByType = new Map<string, { kilos: number; count: number }>();

  produceIn.forEach((inv) => {
    const current = inByType.get(inv.produceType) || { kilos: 0, count: 0 };
    inByType.set(inv.produceType, {
      kilos: current.kilos + inv.totalKilos,
      count: current.count + 1,
    });
  });

  produceOut.forEach((inv) => {
    const current = outByType.get(inv.produceType) || { kilos: 0, count: 0 };
    outByType.set(inv.produceType, {
      kilos: current.kilos + inv.totalKilos,
      count: current.count + 1,
    });
  });

  if (format === "excel") {
    const workbook = XLSX.utils.book_new();

    // Produce In sheet
    const inData = Array.from(inByType.entries()).map(([type, data]) => ({
      "Produce Type": type,
      "Total Kilos": data.kilos.toFixed(2),
      "Inventory Blocks": data.count,
    }));
    const inSheet = XLSX.utils.json_to_sheet(inData);
    XLSX.utils.book_append_sheet(workbook, inSheet, "Produce In");

    // Produce Out sheet
    const outData = Array.from(outByType.entries()).map(([type, data]) => ({
      "Produce Type": type,
      "Total Kilos": data.kilos.toFixed(2),
      "Inventory Blocks": data.count,
    }));
    const outSheet = XLSX.utils.json_to_sheet(outData);
    XLSX.utils.book_append_sheet(workbook, outSheet, "Produce Out");

    // Summary sheet
    const summaryData = [
      { Metric: "Total Produce In (kg)", Value: produceIn.reduce((sum, inv) => sum + inv.totalKilos, 0).toFixed(2) },
      { Metric: "Total Produce Out (kg)", Value: produceOut.reduce((sum, inv) => sum + inv.totalKilos, 0).toFixed(2) },
      { Metric: "Generated", Value: formatUgandaDateTime(getUgandaTime()) },
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    XLSX.writeFile(workbook, `${filename}_inventory_volume.xlsx`);
  } else {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(18);
    doc.text("Farm2Market Report", pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(14);
    doc.text("Inventory Volume Report", pageWidth / 2, 30, { align: "center" });

    doc.setFontSize(12);
    if (userAlias) {
      doc.text(`Trader: ${userAlias}`, pageWidth / 2, 40, { align: "center" });
    }
    doc.text(`Generated: ${formatUgandaDateTime(getUgandaTime())}`, pageWidth / 2, 47, { align: "center" });

    // Produce In table
    doc.setFontSize(12);
    doc.text("Produce In", pageWidth / 2, 60, { align: "center" });
    const inTableData = Array.from(inByType.entries()).map(([type, data]) => [
      type,
      data.kilos.toFixed(2) + " kg",
      data.count.toString(),
    ]);
    autoTable(doc, {
      head: [["Produce Type", "Total Kilos", "Blocks"]],
      body: inTableData,
      startY: 65,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [25, 118, 210] },
    });

    // Produce Out table
    const lastY = (doc as any).lastAutoTable.finalY || 65;
    doc.setFontSize(12);
    doc.text("Produce Out", pageWidth / 2, lastY + 20, { align: "center" });
    const outTableData = Array.from(outByType.entries()).map(([type, data]) => [
      type,
      data.kilos.toFixed(2) + " kg",
      data.count.toString(),
    ]);
    autoTable(doc, {
      head: [["Produce Type", "Total Kilos", "Blocks"]],
      body: outTableData,
      startY: lastY + 25,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [40, 167, 69] },
    });

    doc.save(`${filename}_inventory_volume.pdf`);
  }
}

/**
 * Export capital volume report (capital exposed and revenue earned)
 */
export function exportCapitalVolume(
  ledger: any,
  exposure: any,
  filename: string,
  format: "excel" | "pdf",
  userAlias?: string
): void {
  if (!ledger || !exposure) {
    alert("No capital data to export");
    return;
  }

  const formatUGX = (amount: number) => {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX" }).format(amount);
  };

  // Calculate revenue earned (profit credits)
  const revenueEarned = ledger.profit.balance;
  const capitalExposed = exposure.exposure.totalExposure;
  const capitalDeposited = ledger.capital.balance;
  const capitalLocked = exposure.exposure.lockedCapital;
  const inventoryValue = exposure.exposure.inventoryValue;

  if (format === "excel") {
    const workbook = XLSX.utils.book_new();

    // Capital Exposed sheet
    const exposedData = [
      { Metric: "Total Capital Deposited", Value: formatUGX(capitalDeposited) },
      { Metric: "Capital Locked", Value: formatUGX(capitalLocked) },
      { Metric: "Inventory Value", Value: formatUGX(inventoryValue) },
      { Metric: "Total Capital Exposed", Value: formatUGX(capitalExposed) },
      { Metric: "Spend Cap", Value: formatUGX(exposure.spendCap.maxExposure) },
      { Metric: "Cap Usage", Value: `${exposure.spendCap.usagePercent}%` },
    ];
    const exposedSheet = XLSX.utils.json_to_sheet(exposedData);
    XLSX.utils.book_append_sheet(workbook, exposedSheet, "Capital Exposed");

    // Revenue Earned sheet
    const revenueData = [
      { Metric: "Total Revenue Earned", Value: formatUGX(revenueEarned) },
      { Metric: "Profit Entries", Value: ledger.profit.totalEntries },
    ];
    const revenueSheet = XLSX.utils.json_to_sheet(revenueData);
    XLSX.utils.book_append_sheet(workbook, revenueSheet, "Revenue Earned");

    // Capital Transactions sheet
    const capitalTransactions = ledger.capital.entries.map((entry: any) => ({
      UTID: entry.utid,
      Type: entry.type,
      Amount: formatUGX(entry.amount),
      "Balance After": formatUGX(entry.balanceAfter),
      Date: formatUgandaDate(entry.timestamp),
      Time: formatUgandaTimeOnly(entry.timestamp),
    }));
    const transactionsSheet = XLSX.utils.json_to_sheet(capitalTransactions);
    XLSX.utils.book_append_sheet(workbook, transactionsSheet, "Capital Transactions");

    // Summary sheet
    const summaryData = [
      { Metric: "Generated", Value: formatUgandaDateTime(getUgandaTime()) },
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    XLSX.writeFile(workbook, `${filename}_capital_volume.xlsx`);
  } else {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(18);
    doc.text("Farm2Market Report", pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(14);
    doc.text("Capital Volume Report", pageWidth / 2, 30, { align: "center" });

    doc.setFontSize(12);
    if (userAlias) {
      doc.text(`Trader: ${userAlias}`, pageWidth / 2, 40, { align: "center" });
    }
    doc.text(`Generated: ${formatUgandaDateTime(getUgandaTime())}`, pageWidth / 2, 47, { align: "center" });

    // Capital Exposed section
    doc.setFontSize(12);
    doc.text("Capital Exposed", pageWidth / 2, 60, { align: "center" });
    const exposedData = [
      ["Total Capital Deposited", formatUGX(capitalDeposited)],
      ["Capital Locked", formatUGX(capitalLocked)],
      ["Inventory Value", formatUGX(inventoryValue)],
      ["Total Capital Exposed", formatUGX(capitalExposed)],
      ["Spend Cap", formatUGX(exposure.spendCap.maxExposure)],
      ["Cap Usage", `${exposure.spendCap.usagePercent}%`],
    ];
    autoTable(doc, {
      head: [["Metric", "Value"]],
      body: exposedData,
      startY: 65,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [25, 118, 210] },
    });

    // Revenue Earned section
    const lastY = (doc as any).lastAutoTable.finalY || 65;
    doc.setFontSize(12);
    doc.text("Revenue Earned", pageWidth / 2, lastY + 20, { align: "center" });
    const revenueData = [
      ["Total Revenue Earned", formatUGX(revenueEarned)],
      ["Profit Entries", ledger.profit.totalEntries.toString()],
    ];
    autoTable(doc, {
      head: [["Metric", "Value"]],
      body: revenueData,
      startY: lastY + 25,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [40, 167, 69] },
    });

    doc.save(`${filename}_capital_volume.pdf`);
  }
}
