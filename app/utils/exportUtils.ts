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

/**
 * Export farm toolbox submissions to PDF (single or batch)
 * Embeds photos as base64 for offline readability
 */
export async function exportSubmissionsToPDF(
  entries: any[],
  filename: string,
  userAlias?: string
): Promise<void> {
  if (entries.length === 0) {
    console.warn("No entries to export");
    return;
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - 2 * margin;
  let currentY = margin;

  // Title page
  doc.setFontSize(20);
  doc.text("Farm Toolbox Submissions", pageWidth / 2, currentY + 15, { align: "center" });

  doc.setFontSize(11);
  currentY += 35;
  doc.text(`Total Submissions: ${entries.length}`, margin, currentY);
  currentY += 6;
  doc.text(`Generated: ${formatUgandaDateTime(getUgandaTime())}`, margin, currentY);
  if (userAlias) {
    currentY += 6;
    doc.text(`User: ${userAlias}`, margin, currentY);
  }

  // Add each submission
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    currentY += 20;

    // Check if we need a new page
    if (currentY > pageHeight - 30) {
      doc.addPage();
      currentY = margin;
    }

    // Submission header
    doc.setFontSize(13);
    doc.setFont(undefined, "bold");
    const templateName = entry.templateDetails?.templateName || "Unknown Template";
    doc.text(
      `Submission ${index + 1}: ${templateName}`,
      margin,
      currentY
    );
    currentY += 6;

    // Metadata
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    const submittedDate = formatUgandaDate(entry.submittedAt || entry.createdAt);
    doc.text(`Date: ${submittedDate}`, margin, currentY);
    currentY += 4;

    if (entry.unitDetails) {
      doc.text(
        `Unit: ${entry.unitDetails.name || entry.unitDetails.unitType || "N/A"}`,
        margin,
        currentY
      );
      currentY += 4;
    }

    if (entry.gpsLat && entry.gpsLng) {
      doc.text(
        `GPS: ${entry.gpsLat.toFixed(4)}, ${entry.gpsLng.toFixed(4)}`,
        margin,
        currentY
      );
      currentY += 4;
    }

    currentY += 2;

    // Field values
    if (entry.fieldValues && entry.fieldValues.length > 0) {
      doc.setFontSize(10);
      doc.setFont(undefined, "bold");
      doc.text("Field Values:", margin, currentY);
      currentY += 4;

      doc.setFontSize(9);
      doc.setFont(undefined, "normal");
      entry.fieldValues.forEach((fv: any) => {
        const fieldText = `${fv.fieldName}: ${fv.value || "—"}`;
        const lines = doc.splitTextToSize(fieldText, contentWidth - 10);
        lines.forEach((line: string) => {
          if (currentY > pageHeight - 20) {
            doc.addPage();
            currentY = margin;
          }
          doc.text(line, margin + 5, currentY);
          currentY += 3;
        });
      });
    }

    currentY += 3;

    // Photos (if any) - embed as base64
    if (entry.photoUrls && entry.photoUrls.length > 0) {
      doc.setFontSize(10);
      doc.setFont(undefined, "bold");
      doc.text(`Photos (${entry.photoUrls.length}):`, margin, currentY);
      currentY += 5;

      // Add photos inline (max 3 per row for readability)
      const photoWidth = (contentWidth - 6) / 3;
      const photoHeight = 35;
      let photosInRow = 0;
      let photoRowStartY = currentY;

      for (const photoUrl of entry.photoUrls) {
        if (!photoUrl) continue;

        if (photosInRow > 0 && photosInRow % 3 === 0) {
          currentY = photoRowStartY + photoHeight + 3;
          photoRowStartY = currentY;
          photosInRow = 0;

          if (currentY > pageHeight - 20) {
            doc.addPage();
            currentY = margin;
            photoRowStartY = currentY;
          }
        }

        const xPos = margin + photosInRow * (photoWidth + 2);

        // Convert URL to base64 and embed image
        try {
          const base64Image = await urlToBase64(photoUrl);
          if (base64Image) {
            doc.addImage(base64Image, "JPEG", xPos, photoRowStartY, photoWidth, photoHeight);
          } else {
            doc.rect(xPos, photoRowStartY, photoWidth, photoHeight);
            doc.setFontSize(7);
            doc.text("[Photo unavailable]", xPos + photoWidth / 2, photoRowStartY + photoHeight / 2, { align: "center" });
          }
        } catch {
          doc.rect(xPos, photoRowStartY, photoWidth, photoHeight);
          doc.setFontSize(7);
          doc.text("[Photo unavailable]", xPos + photoWidth / 2, photoRowStartY + photoHeight / 2, { align: "center" });
        }

        photosInRow++;
      }

      currentY = photoRowStartY + photoHeight + 5;
    }

    // Divider
    if (index < entries.length - 1) {
      currentY += 3;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 3;
    }
  }

  doc.save(`${filename}.pdf`);
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
  if (submissions.length === 0) {
    console.warn("No submissions to export");
    return;
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - 2 * margin;
  let currentY = margin;

  // Title page
  doc.setFontSize(20);
  doc.text("Form Submissions", pageWidth / 2, currentY + 15, { align: "center" });

  doc.setFontSize(11);
  currentY += 35;
  doc.text(`Total Submissions: ${submissions.length}`, margin, currentY);
  currentY += 6;
  doc.text(`Generated: ${formatUgandaDateTime(getUgandaTime())}`, margin, currentY);
  if (userAlias) {
    currentY += 6;
    doc.text(`User: ${userAlias}`, margin, currentY);
  }

  // Add each submission
  for (let index = 0; index < submissions.length; index++) {
    const submission = submissions[index];
    currentY += 20;

    // Check if we need a new page
    if (currentY > pageHeight - 30) {
      doc.addPage();
      currentY = margin;
    }

    // Submission header
    doc.setFontSize(13);
    doc.setFont(undefined, "bold");
    const formName = submission.formName || "Unknown Form";
    doc.text(`${index + 1}. ${formName}`, margin, currentY);
    currentY += 6;

    // Metadata
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    const createdDate = formatUgandaDate(submission.createdAt);
    doc.text(`Submitted: ${createdDate}`, margin, currentY);
    currentY += 4;

    currentY += 2;

    // Field values
    if (submission.values && submission.values.length > 0) {
      doc.setFontSize(10);
      doc.setFont(undefined, "bold");
      doc.text("Responses:", margin, currentY);
      currentY += 4;

      doc.setFontSize(9);
      doc.setFont(undefined, "normal");
      submission.values.forEach((value: any) => {
        const fieldLabel = value.fieldLabel || "Field";
        const fieldValue = value.value || "—";
        const fieldText = `${fieldLabel}: ${fieldValue}`;
        const lines = doc.splitTextToSize(fieldText, contentWidth - 10);

        lines.forEach((line: string) => {
          if (currentY > pageHeight - 20) {
            doc.addPage();
            currentY = margin;
          }
          doc.text(line, margin + 5, currentY);
          currentY += 3;
        });
      });
    }

    // Photo values (if any)
    const submissionPhotos = (submission.values || []).filter((value: any) => value.fieldType === "photo" && value.photoUrl);
    if (submissionPhotos.length > 0) {
      doc.setFontSize(10);
      doc.setFont(undefined, "bold");
      doc.text(`Photos (${submissionPhotos.length}):`, margin, currentY);
      currentY += 5;

      const photoWidth = (contentWidth - 6) / 3;
      const photoHeight = 35;
      let photosInRow = 0;
      let photoRowStartY = currentY;

      for (const photoValue of submissionPhotos) {
        if (photosInRow > 0 && photosInRow % 3 === 0) {
          currentY = photoRowStartY + photoHeight + 3;
          photoRowStartY = currentY;
          photosInRow = 0;

          if (currentY > pageHeight - 20) {
            doc.addPage();
            currentY = margin;
            photoRowStartY = currentY;
          }
        }

        const xPos = margin + photosInRow * (photoWidth + 2);

        try {
          const base64Image = await urlToBase64(photoValue.photoUrl);
          if (base64Image) {
            doc.addImage(base64Image, "JPEG", xPos, photoRowStartY, photoWidth, photoHeight);
          } else {
            doc.rect(xPos, photoRowStartY, photoWidth, photoHeight);
            doc.setFontSize(7);
            doc.text("[Photo unavailable]", xPos + photoWidth / 2, photoRowStartY + photoHeight / 2, { align: "center" });
          }
        } catch {
          doc.rect(xPos, photoRowStartY, photoWidth, photoHeight);
          doc.setFontSize(7);
          doc.text("[Photo unavailable]", xPos + photoWidth / 2, photoRowStartY + photoHeight / 2, { align: "center" });
        }

        photosInRow++;
      }

      currentY = photoRowStartY + photoHeight + 5;
    }

    currentY += 3;

    // Divider
    if (index < submissions.length - 1) {
      currentY += 3;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 3;
    }
  }

  doc.save(`${filename}.pdf`);
}
