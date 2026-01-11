/**
 * Export Utilities for Farm2Market Reports
 * 
 * Provides functions to export data to Excel and PDF formats
 */

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatUgandaDate, formatUgandaTimeOnly, formatUgandaDateTime, getUgandaTime } from "./timeUtils";

export interface UTIDReportData {
  utid: string;
  type: string;
  timestamp: number;
  status?: string;
  details?: any;
  entities?: any[];
}

/**
 * Export UTID data to Excel format
 */
export function exportToExcel(
  data: UTIDReportData[],
  filename: string,
  role: string
): void {
  const worksheetData = data.map((item) => {
    return {
      UTID: item.utid,
      Type: item.type,
      Date: formatUgandaDate(item.timestamp),
      Time: formatUgandaTimeOnly(item.timestamp),
      Status: item.status || "N/A",
      Details: JSON.stringify(item.details || {}),
    };
  });

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 30 }, // UTID
    { wch: 20 }, // Type
    { wch: 12 }, // Date
    { wch: 12 }, // Time
    { wch: 15 }, // Status
    { wch: 50 }, // Details
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Farm2Market Report");

  // Add summary sheet
  const summaryData = [
    { Metric: "Total UTIDs", Value: data.length },
    { Metric: "Role", Value: role },
    { Metric: "Generated", Value: formatUgandaDateTime(getUgandaTime()) },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  // Generate file and download
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Export UTID data to PDF format
 */
export function exportToPDF(
  data: UTIDReportData[],
  filename: string,
  role: string,
  userAlias?: string
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Title
  doc.setFontSize(18);
  doc.text("Farm2Market Report", pageWidth / 2, 20, { align: "center" });

  // Subtitle
  doc.setFontSize(12);
  doc.text(`Role: ${role}`, pageWidth / 2, 30, { align: "center" });
  if (userAlias) {
    doc.text(`User: ${userAlias}`, pageWidth / 2, 37, { align: "center" });
  }
  doc.text(`Generated: ${formatUgandaDateTime(getUgandaTime())}`, pageWidth / 2, 44, { align: "center" });
  doc.text(`Total UTIDs: ${data.length}`, pageWidth / 2, 51, { align: "center" });

  // Prepare table data
  const tableData = data.map((item) => {
    return [
      item.utid,
      item.type,
      formatUgandaDate(item.timestamp),
      formatUgandaTimeOnly(item.timestamp),
      item.status || "N/A",
    ];
  });

  // Add table
  autoTable(doc, {
    head: [["UTID", "Type", "Date", "Time", "Status"]],
    body: tableData,
    startY: 60,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [25, 118, 210] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  // Save PDF
  doc.save(`${filename}.pdf`);
}

/**
 * Format UTID data for export
 */
export function formatUTIDDataForExport(utids: any[]): UTIDReportData[] {
  return utids.map((utid) => ({
    utid: utid.utid || utid.purchaseUtid || utid.listingUtid || utid.lockUtid || "N/A",
    type: utid.type || "unknown",
    timestamp: utid.timestamp || utid.purchasedAt || utid.createdAt || utid.lockedAt || getUgandaTime(),
    status: utid.status || utid.deliveryStatus || "N/A",
    details: {
      ...utid,
      entities: utid.entities || [],
    },
    entities: utid.entities || [],
  }));
}
