/**
 * Export Utilities for Farm2Market Reports
 * 
 * Provides functions to export data to Excel and PDF formats
 */

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatUgandaDate, formatUgandaTimeOnly, formatUgandaDateTime, getUgandaTime } from "./timeUtils";
import { savePdfFromJsPDF } from "./pdfDownload";

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
  void savePdfFromJsPDF(doc, `${filename}.pdf`);
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

/**
 * Convert image URL to base64 string
 */
async function urlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return ""; // Return empty string if fetch fails
  }
}

function addReportHeader(doc: jsPDF, title: string, subtitle?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(34, 100, 55);
  doc.rect(0, 0, pageWidth, 26, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text(title, 10, 12);

  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.text(subtitle, 10, 19);
  }

  doc.setTextColor(30, 30, 30);
}

function addSectionTitle(doc: jsPDF, y: number, title: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(244, 247, 245);
  doc.rect(10, y - 4, pageWidth - 20, 8, "F");
  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.text(title, 12, y + 1);
  doc.setFont(undefined, "normal");
  return y + 8;
}

function autoTableEndY(doc: jsPDF): number {
  return ((doc as any).lastAutoTable?.finalY ?? 30) as number;
}

function imageFormatFromBase64(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
}

/**
 * Export farm toolbox submissions to PDF (single or batch)
 * Embeds photos as base64 for offline readability
 */
export async function exportSubmissionsToPDF(
  entries: any[],
  filename: string,
  userAlias?: string
): Promise<void> {
  if (!entries.length) return;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  addReportHeader(doc, "Farm Toolbox Submissions", "Readable export report");
  let y = 38;
  doc.setFontSize(12);
  doc.text(`Total Submissions: ${entries.length}`, margin, y);
  y += 8;
  doc.text(`Generated: ${formatUgandaDateTime(getUgandaTime())}`, margin, y);
  if (userAlias) {
    y += 8;
    doc.text(`User: ${userAlias}`, margin, y);
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    doc.addPage();

    const submittedDate = formatUgandaDate(entry.submittedAt || entry.createdAt);
    addReportHeader(
      doc,
      `Submission ${i + 1} of ${entries.length}`,
      `${entry.templateDetails?.templateName || "Unknown Template"} - ${submittedDate}`
    );

    y = 34;
    y = addSectionTitle(doc, y, "Submission Details");
    const detailsRows: string[][] = [
      ["Template", entry.templateDetails?.templateName || "Unknown Template"],
      ["Submitted", submittedDate],
      ["Unit", entry.unitDetails?.name || entry.unitDetails?.unitType || "N/A"],
      [
        "GPS",
        entry.gpsLat && entry.gpsLng
          ? `${Number(entry.gpsLat).toFixed(5)}, ${Number(entry.gpsLng).toFixed(5)}`
          : "N/A",
      ],
      ["Notes", entry.notes || "N/A"],
    ];

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Field", "Value"]],
      body: detailsRows,
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 2.2, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: [46, 125, 50], textColor: 255, fontSize: 10.5 },
      columnStyles: {
        0: { cellWidth: 48, fontStyle: "bold", fillColor: [247, 250, 248] },
        1: { cellWidth: contentWidth - 48 },
      },
    });

    y = autoTableEndY(doc) + 4;
    y = addSectionTitle(doc, y, "Field Values");
    const fieldRows: string[][] = (entry.fieldValues || []).map((fv: any) => [
      String(fv.fieldName || "Field"),
      fv.value == null || fv.value === "" ? "-" : String(fv.value),
    ]);

    if (!fieldRows.length) fieldRows.push(["No fields", "No values recorded"]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Field", "Response"]],
      body: fieldRows,
      theme: "striped",
      styles: { fontSize: 10, cellPadding: 2.1, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: [62, 140, 76], textColor: 255, fontSize: 10.5 },
      alternateRowStyles: { fillColor: [249, 251, 250] },
      columnStyles: {
        0: { cellWidth: 56, fontStyle: "bold" },
        1: { cellWidth: contentWidth - 56 },
      },
    });

    y = autoTableEndY(doc) + 6;
    const photos: string[] = (entry.photoUrls || []).filter(Boolean);
    if (photos.length) {
      if (y > pageHeight - 80) {
        doc.addPage();
        addReportHeader(doc, `Submission ${i + 1} Photos`);
        y = 34;
      }

      y = addSectionTitle(doc, y, `Photos (${photos.length})`);
      const gap = 4;
      const photoWidth = (contentWidth - gap) / 2;
      const photoHeight = 62;

      for (let p = 0; p < photos.length; p++) {
        const col = p % 2;
        const row = Math.floor(p / 2);
        const x = margin + col * (photoWidth + gap);
        const py = y + row * (photoHeight + 6);

        if (py + photoHeight > pageHeight - margin) {
          doc.addPage();
          addReportHeader(doc, `Submission ${i + 1} Photos (cont.)`);
          y = addSectionTitle(doc, 34, `Photos (${photos.length})`);
          p--;
          continue;
        }

        try {
          const base64 = await urlToBase64(photos[p]);
          if (base64) {
            doc.addImage(base64, imageFormatFromBase64(base64), x, py, photoWidth, photoHeight);
          } else {
            doc.setDrawColor(180);
            doc.rect(x, py, photoWidth, photoHeight);
            doc.setFontSize(9);
            doc.text("Photo unavailable", x + photoWidth / 2, py + photoHeight / 2, { align: "center" });
          }
        } catch {
          doc.setDrawColor(180);
          doc.rect(x, py, photoWidth, photoHeight);
          doc.setFontSize(9);
          doc.text("Photo unavailable", x + photoWidth / 2, py + photoHeight / 2, { align: "center" });
        }
      }
    }
  }

  void savePdfFromJsPDF(doc, `${filename}.pdf`);
}

/**
 * Export community form submissions to PDF (single or batch)
 * Similar to exportSubmissionsToPDF but handles variable field layouts
 */
export async function exportFormSubmissionsToPDF(
  submissions: any[],
  filename: string,
  userAlias?: string
): Promise<void> {
  if (!submissions.length) return;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  addReportHeader(doc, "Community Form Submissions", "Readable export report");
  let y = 38;
  doc.setFontSize(12);
  doc.text(`Total Submissions: ${submissions.length}`, margin, y);
  y += 8;
  doc.text(`Generated: ${formatUgandaDateTime(getUgandaTime())}`, margin, y);
  if (userAlias) {
    y += 8;
    doc.text(`User: ${userAlias}`, margin, y);
  }

  for (let i = 0; i < submissions.length; i++) {
    const submission = submissions[i];
    doc.addPage();

    addReportHeader(
      doc,
      `Submission ${i + 1} of ${submissions.length}`,
      `${submission.formName || "Unknown Form"} - ${formatUgandaDate(submission.createdAt)}`
    );

    y = 34;
    y = addSectionTitle(doc, y, "Submission Details");
    const detailsRows: string[][] = [
      ["Form", submission.formName || "Unknown Form"],
      ["Category", submission.category || "N/A"],
      ["Submitted", formatUgandaDate(submission.createdAt)],
      [
        "Tracked Unit",
        submission.trackedUnit
          ? `${submission.trackedUnit.emoji || ""} ${submission.trackedUnit.name || submission.trackedUnit.unitType || ""}`.trim()
          : "N/A",
      ],
    ];

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Field", "Value"]],
      body: detailsRows,
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 2.2, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: [46, 125, 50], textColor: 255, fontSize: 10.5 },
      columnStyles: {
        0: { cellWidth: 48, fontStyle: "bold", fillColor: [247, 250, 248] },
        1: { cellWidth: contentWidth - 48 },
      },
    });

    y = autoTableEndY(doc) + 4;
    y = addSectionTitle(doc, y, "Responses");
    const responseRows: string[][] = (submission.values || []).map((value: any) => [
      String(value.fieldLabel || "Field"),
      value.value == null || value.value === "" ? "-" : String(value.value),
    ]);

    if (!responseRows.length) responseRows.push(["No responses", "No values recorded"]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Field", "Response"]],
      body: responseRows,
      theme: "striped",
      styles: { fontSize: 10, cellPadding: 2.1, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: [62, 140, 76], textColor: 255, fontSize: 10.5 },
      alternateRowStyles: { fillColor: [249, 251, 250] },
      columnStyles: {
        0: { cellWidth: 56, fontStyle: "bold" },
        1: { cellWidth: contentWidth - 56 },
      },
    });

    y = autoTableEndY(doc) + 6;
    const photos = (submission.values || [])
      .filter((value: any) => value.fieldType === "photo" && value.photoUrl)
      .map((value: any) => value.photoUrl);

    if (photos.length) {
      if (y > pageHeight - 80) {
        doc.addPage();
        addReportHeader(doc, `Submission ${i + 1} Photos`);
        y = 34;
      }

      y = addSectionTitle(doc, y, `Photos (${photos.length})`);
      const gap = 4;
      const photoWidth = (contentWidth - gap) / 2;
      const photoHeight = 62;

      for (let p = 0; p < photos.length; p++) {
        const col = p % 2;
        const row = Math.floor(p / 2);
        const x = margin + col * (photoWidth + gap);
        const py = y + row * (photoHeight + 6);

        if (py + photoHeight > pageHeight - margin) {
          doc.addPage();
          addReportHeader(doc, `Submission ${i + 1} Photos (cont.)`);
          y = addSectionTitle(doc, 34, `Photos (${photos.length})`);
          p--;
          continue;
        }

        try {
          const base64 = await urlToBase64(photos[p]);
          if (base64) {
            doc.addImage(base64, imageFormatFromBase64(base64), x, py, photoWidth, photoHeight);
          } else {
            doc.setDrawColor(180);
            doc.rect(x, py, photoWidth, photoHeight);
            doc.setFontSize(9);
            doc.text("Photo unavailable", x + photoWidth / 2, py + photoHeight / 2, { align: "center" });
          }
        } catch {
          doc.setDrawColor(180);
          doc.rect(x, py, photoWidth, photoHeight);
          doc.setFontSize(9);
          doc.text("Photo unavailable", x + photoWidth / 2, py + photoHeight / 2, { align: "center" });
        }
      }
    }
  }

  void savePdfFromJsPDF(doc, `${filename}.pdf`);
}
