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
import {
  isCommunityDetailsGpsRow,
  isCommunityResponseGpsRow,
  isFarmToolboxGpsField,
} from "./pdfGpsUtils";

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
  addPageNumbersIfNeeded(doc);
  void savePdfFromJsPDF(doc, `${filename}.pdf`);
}

/**
 * Format UTID data for export
 */
function formatFarmAddress(address: any): string {
  if (!address || typeof address !== "object") return "";

  const parts = [
    address.village,
    address.parish,
    address.subcounty,
    address.district,
    address.county,
    address.region,
  ].filter(Boolean).map((part: any) => String(part).trim()).filter(Boolean);

  return parts.join(", ");
}

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
 * Crop an image to a target aspect ratio from the center and return a JPEG data URL.
 * This is used for cover-fit rendering in PDF boxes without letterboxing.
 */
async function cropBase64ToAspect(base64: string, targetAspect: number): Promise<string> {
  if (!base64 || !Number.isFinite(targetAspect) || targetAspect <= 0) return base64;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      if (!iw || !ih) {
        resolve(base64);
        return;
      }

      const inputAspect = iw / ih;
      let sx = 0;
      let sy = 0;
      let sw = iw;
      let sh = ih;

      if (inputAspect > targetAspect) {
        // Input is wider than target: crop left and right.
        sw = Math.round(ih * targetAspect);
        sx = Math.max(0, Math.round((iw - sw) / 2));
      } else if (inputAspect < targetAspect) {
        // Input is taller than target: crop top and bottom.
        sh = Math.round(iw / targetAspect);
        sy = Math.max(0, Math.round((ih - sh) / 2));
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, sw);
      canvas.height = Math.max(1, sh);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(base64);
        return;
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

function addReportHeader(doc: jsPDF, title: string, subtitle?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(34, 100, 55);
  doc.rect(0, 0, pageWidth, 26, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  (doc as any).setFont(undefined, "bold");
  doc.text(title, 10, 12);

  if (subtitle) {
    doc.setFontSize(10);
    (doc as any).setFont(undefined, "normal");
    doc.text(subtitle, 10, 19);
  }

  doc.setTextColor(30, 30, 30);
}

function addSectionTitle(doc: jsPDF, y: number, title: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(244, 247, 245);
  doc.rect(10, y - 4, pageWidth - 20, 8, "F");
  doc.setFontSize(11);
  (doc as any).setFont(undefined, "bold");
  doc.text(title, 12, y + 1);
  (doc as any).setFont(undefined, "normal");
  return y + 8;
}

function autoTableEndY(doc: jsPDF): number {
  return ((doc as any).lastAutoTable?.finalY ?? 30) as number;
}

function imageFormatFromBase64(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
}

type PhotoLayoutChoice = {
  cols: number;
  rows: number;
  cell: number;
  items: number;
};

function choosePhotoLayout(
  remaining: number,
  availableHeight: number,
  contentWidth: number,
  gap: number,
  minCell: number
): PhotoLayoutChoice | null {
  let best: PhotoLayoutChoice | null = null;

  for (let cols = 1; cols <= 4; cols++) {
    const cellWidth = (contentWidth - (cols - 1) * gap) / cols;
    if (cellWidth < minCell) continue;

    const maxRows = Math.floor((availableHeight + gap) / (minCell + gap));
    if (maxRows < 1) continue;

    const capacity = cols * maxRows;
    const items = Math.min(remaining, capacity);
    const rows = Math.ceil(items / cols);
    const cellHeight = (availableHeight - (rows - 1) * gap) / rows;
    const cell = Math.min(cellWidth, cellHeight);

    if (cell < minCell) continue;

    if (
      !best ||
      items > best.items ||
      (items === best.items && cell > best.cell)
    ) {
      best = { cols, rows, cell, items };
    }
  }

  return best;
}

async function renderPhotosAdaptivePaged(params: {
  doc: jsPDF;
  photos: string[];
  startY: number;
  margin: number;
  contentWidth: number;
  pageHeight: number;
  sectionTitle: string;
  prepareContinuationPage: () => Promise<number>;
}): Promise<void> {
  const {
    doc,
    photos,
    startY,
    margin,
    contentWidth,
    pageHeight,
    sectionTitle,
    prepareContinuationPage,
  } = params;

  if (!photos.length) return;

  const gap = 4;
  const minCell = 18;

  let photoIndex = 0;
  let isFirstPage = true;
  let sectionStartY = startY;

  while (photoIndex < photos.length) {
    if (!isFirstPage) {
      sectionStartY = await prepareContinuationPage();
    }

    const sectionY = addSectionTitle(doc, sectionStartY, `${sectionTitle} (${photos.length})`);
    const availableHeight = Math.max(pageHeight - margin - 30, minCell + gap);

    let layout = choosePhotoLayout(
      photos.length - photoIndex,
      availableHeight,
      contentWidth,
      gap,
      minCell
    );

    if (!layout) {
      // Fallback to smaller minimum cell size
      layout = choosePhotoLayout(
        photos.length - photoIndex,
        availableHeight,
        contentWidth,
        gap,
        12
      );
      if (!layout) break;
    }

    const gridWidth = layout.cols * layout.cell + (layout.cols - 1) * gap;
    const startX = margin + (contentWidth - gridWidth) / 2;

    for (let p = 0; p < layout.items; p++) {
      const absoluteIndex = photoIndex + p;
      const col = p % layout.cols;
      const row = Math.floor(p / layout.cols);
      const x = startX + col * (layout.cell + gap);
      const y = sectionY + row * (layout.cell + gap);

      try {
        const base64 = await urlToBase64(photos[absoluteIndex]);
        if (!base64) throw new Error("Empty image");

        const props = (doc as any).getImageProperties(base64);
        const iw = Number(props?.width || 1);
        const ih = Number(props?.height || 1);
        const scale = Math.min(layout.cell / iw, layout.cell / ih);
        const drawW = iw * scale;
        const drawH = ih * scale;
        const dx = x + (layout.cell - drawW) / 2;
        const dy = y + (layout.cell - drawH) / 2;

        doc.setDrawColor(180);
        doc.rect(x, y, layout.cell, layout.cell);
        doc.addImage(base64, imageFormatFromBase64(base64), dx, dy, drawW, drawH);
      } catch {
        doc.setDrawColor(180);
        doc.rect(x, y, layout.cell, layout.cell);
        doc.setFontSize(8);
        doc.text("Photo unavailable", x + layout.cell / 2, y + layout.cell / 2, {
          align: "center",
        });
      }
    }

    photoIndex += layout.items;
    isFirstPage = false;
    sectionStartY = 34;
  }
}

function addPageNumbersIfNeeded(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();
  if (totalPages <= 1) return;

  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Page ${page} of ${totalPages}`, pageWidth / 2, pageHeight - 5, {
      align: "center",
    });
  }

  doc.setTextColor(30, 30, 30);
}

// ── Farm Toolbox PDF branding constants ────────────────────────────────
const TOOLBOX_LOGO_PATH = "/farm2marketlogo.jpeg";
const TOOLBOX_QR_PATH   = "/farmcoin-community-qr.png";
const TOOLBOX_SITE_URL  = "https://www.farm2marketuganda.com";

/**
 * Draw the farm2market logo as a tiled background watermark across the entire page.
 */
async function addWatermark(doc: jsPDF, logoBase64: string): Promise<void> {
  if (!logoBase64) return;
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  try {
    const gstate = new (doc as any).GState({ opacity: 0.09 });
    doc.saveGraphicsState();
    (doc as any).setGState(gstate);
    // Tiled watermark across entire page
    const tileW = 48;
    const tileH = 48;
    const gapX = 20;
    const gapY = 26;
    for (let y = -tileH * 0.5; y < ph + tileH; y += tileH + gapY) {
      for (let x = -tileW * 0.5; x < pw + tileW; x += tileW + gapX) {
        doc.addImage(logoBase64, "JPEG", x, y, tileW, tileH);
      }
    }
    doc.restoreGraphicsState();
  } catch {
    // GState not available in this build — skip watermark rather than crash
  }
}

/**
 * Export farm toolbox submissions to PDF.
 * - Single entry  → exactly ONE page with watermark, photo, QR, website link.
 * - Multiple entries → original multi-page layout (unchanged) plus branding on cover.
 */
export async function exportSubmissionsToPDF(
  entries: any[],
  filename: string,
  userAlias?: string
): Promise<void> {
  if (!entries.length) return;

  // Pre-load brand assets (fail silently — they are decorative)
  const [logoBase64, qrBase64] = await Promise.all([
    urlToBase64(TOOLBOX_LOGO_PATH),
    urlToBase64(TOOLBOX_QR_PATH),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth  = doc.internal.pageSize.getWidth();   // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight();  // 297 mm
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;           // 190 mm

  // ── SINGLE-ENTRY: compact one-page layout ───────────────────────────
  if (entries.length === 1) {
    const entry = entries[0];
    const submittedDate = formatUgandaDate(entry.submittedAt || entry.createdAt);

    // Watermark behind everything
    await addWatermark(doc, logoBase64);

    // Green header bar
    addReportHeader(
      doc,
      "Traceability Report",
      `${entry.templateDetails?.templateName || "Unknown Template"}  |  ${submittedDate}`
    );

    // ── Metadata lines (compact, fixed Y, no autoTable) ─────────────
    const metaLines: Array<[string, string]> = [
      ["Template",  entry.templateDetails?.templateName || "Unknown Template"],
      ["Submitted", submittedDate],
      ["User",      userAlias || "N/A"],
      ["Unit",      entry.unitDetails?.name || entry.unitDetails?.unitType || "N/A"],
      ["Farm address", formatFarmAddress(entry.farmAddress) || "N/A"],
      ["GPS",       entry.gpsLat && entry.gpsLng
                      ? `${Number(entry.gpsLat).toFixed(5)}, ${Number(entry.gpsLng).toFixed(5)}`
                      : "N/A"],
      ["Notes",     String(entry.notes || "N/A").slice(0, 90)],
    ];
    const fieldValues: Array<[string, string]> = (entry.fieldValues || []).slice(0, 8).map((fv: any) => [
      String(fv.fieldName || "Field").slice(0, 28),
      fv.value == null || fv.value === "" ? "-" : String(fv.value).slice(0, 60),
    ]);

    let y = 32;
    doc.setFontSize(8.5);
    const labelX = margin + 2;
    const valueX = margin + 46;
    const lineH  = 4.6;

    // Section: submission details
    doc.setFillColor(244, 247, 245);
    doc.rect(margin, y - 3, contentWidth, 6, "F");
    (doc as any).setFont(undefined, "bold");
    doc.setFontSize(9);
    doc.text("Submission Details", labelX, y + 0.5);
    (doc as any).setFont(undefined, "normal");
    y += 7;

    doc.setFontSize(8.5);
    for (const [label, value] of metaLines) {
      const isGpsRow = isFarmToolboxGpsField(label);
      if (isGpsRow) {
        // Emphasize captured GPS row for fast visual scanning.
        doc.setFillColor(255, 246, 179);
        doc.rect(margin, y - 3.4, contentWidth, 4.8, "F");
      }
      (doc as any).setFont(undefined, "bold");
      doc.text(label, labelX, y);
      (doc as any).setFont(undefined, "normal");
      if (isGpsRow) {
        doc.setTextColor(34, 100, 55);
      }
      doc.text(value, valueX, y, { maxWidth: contentWidth - 48 });
      if (isGpsRow) {
        doc.setTextColor(30, 30, 30);
      }
      y += lineH;
    }

    // Section: field values
    if (fieldValues.length) {
      y += 2;
      doc.setFillColor(244, 247, 245);
      doc.rect(margin, y - 3, contentWidth, 6, "F");
      (doc as any).setFont(undefined, "bold");
      doc.setFontSize(9);
      doc.text("Field Values", labelX, y + 0.5);
      (doc as any).setFont(undefined, "normal");
      y += 7;
      doc.setFontSize(8.5);
      for (const [label, value] of fieldValues) {
        (doc as any).setFont(undefined, "bold");
        doc.text(label, labelX, y);
        (doc as any).setFont(undefined, "normal");
        doc.text(value, valueX, y, { maxWidth: contentWidth - 48 });
        y += lineH;
      }
    }

    // ── Photo box (larger, still centered; QR block remains unchanged) ────
    const photoBoxY  = 132;
    const photoBoxW  = 120;
    const photoBoxH  = 80;
    const photoBoxX  = (pageWidth - photoBoxW) / 2;

    doc.setDrawColor(180);
    doc.setLineWidth(0.4);
    doc.rect(photoBoxX, photoBoxY, photoBoxW, photoBoxH);

    const firstPhoto: string | undefined = (entry.photoUrls || []).find(Boolean);
    if (firstPhoto) {
      try {
        const photoB64 = await urlToBase64(firstPhoto);
        if (photoB64) {
          const innerW = photoBoxW - 1;
          const innerH = photoBoxH - 1;
          const targetAspect = innerW / innerH;
          const croppedB64 = await cropBase64ToAspect(photoB64, targetAspect);
          const dx = photoBoxX + 0.5;
          const dy = photoBoxY + 0.5;
          doc.addImage(croppedB64, imageFormatFromBase64(croppedB64), dx, dy, innerW, innerH);
        } else {
          doc.setFontSize(8);
          doc.text("Photo unavailable", pageWidth / 2, photoBoxY + photoBoxH / 2, { align: "center" });
        }
      } catch {
        doc.setFontSize(8);
        doc.text("Photo unavailable", pageWidth / 2, photoBoxY + photoBoxH / 2, { align: "center" });
      }
    } else {
      doc.setFontSize(8);
      doc.setTextColor(170, 170, 170);
      doc.text("No photo attached", pageWidth / 2, photoBoxY + photoBoxH / 2, { align: "center" });
      doc.setTextColor(30, 30, 30);
    }

    // ── Farmcoin community QR (static image provided by user) ───────
    const qrSize = 32;
    const qrX = (pageWidth - qrSize) / 2;
    const qrY = photoBoxY + photoBoxH + 7;

    if (qrBase64) {
      try {
        doc.addImage(qrBase64, "PNG", qrX, qrY, qrSize, qrSize);
      } catch {
        doc.setDrawColor(150);
        doc.rect(qrX, qrY, qrSize, qrSize);
      }
    } else {
      doc.setDrawColor(150);
      doc.rect(qrX, qrY, qrSize, qrSize);
      doc.setFontSize(7);
      doc.text("QR", pageWidth / 2, qrY + qrSize / 2, { align: "center" });
    }

    // "FARMCOIN" label + caption
    doc.setFontSize(8.5);
    (doc as any).setFont(undefined, "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("FARMCOIN", pageWidth / 2, qrY + qrSize + 5, { align: "center" });
    (doc as any).setFont(undefined, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text("Scan to join this community", pageWidth / 2, qrY + qrSize + 9.5, { align: "center" });

    // ── Website link ─────────────────────────────────────────────────
    const linkY = qrY + qrSize + 15;
    doc.setFontSize(8);
    doc.setTextColor(34, 100, 55);
    const anyDoc = doc as any;
    if (typeof anyDoc.textWithLink === "function") {
      anyDoc.textWithLink(TOOLBOX_SITE_URL, pageWidth / 2, linkY, {
        align: "center",
        url: TOOLBOX_SITE_URL,
      });
    } else {
      doc.text(TOOLBOX_SITE_URL, pageWidth / 2, linkY, { align: "center" });
    }
    doc.setTextColor(30, 30, 30);

    void savePdfFromJsPDF(doc, `${filename}.pdf`);
    return;
  }

  // ── BATCH: original multi-page layout ───────────────────────────────
  addReportHeader(doc, "Traceability Report", "Readable export report");
  await addWatermark(doc, logoBase64);
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
    await addWatermark(doc, logoBase64);

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
      ["Farm address", formatFarmAddress(entry.farmAddress) || "N/A"],
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
      didParseCell: (data: any) => {
        if (data.section !== "body") return;
        const row = detailsRows[data.row.index];
        if (!row) return;
        const isGpsRow = isFarmToolboxGpsField(row[0]);
        if (!isGpsRow) return;
        if (data.column.index === 1) {
          data.cell.styles.fillColor = [255, 246, 179];
          data.cell.styles.textColor = [34, 100, 55];
        } else if (data.column.index === 0) {
          data.cell.styles.fillColor = [255, 246, 179];
        }
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
      await renderPhotosAdaptivePaged({
        doc,
        photos,
        startY: y,
        margin,
        contentWidth,
        pageHeight,
        sectionTitle: "Photos",
        prepareContinuationPage: async () => {
          doc.addPage();
          await addWatermark(doc, logoBase64);
          addReportHeader(doc, `Submission ${i + 1} Photos (cont.)`);
          return 34;
        },
      });

      // QR + link on last photo page of each submission
      const qrS = 22;
      const qrXb = pageWidth - margin - qrS;
      const qrYb = pageHeight - margin - qrS;
      if (qrBase64) {
        try { doc.addImage(qrBase64, "PNG", qrXb, qrYb, qrS, qrS); } catch { /* decorative */ }
      }
      doc.setFontSize(7);
      doc.setTextColor(34, 100, 55);
      const ad = doc as any;
      if (typeof ad.textWithLink === "function") {
        ad.textWithLink(TOOLBOX_SITE_URL, margin, pageHeight - margin - 1, {
          url: TOOLBOX_SITE_URL,
        });
      } else {
        doc.text(TOOLBOX_SITE_URL, margin, pageHeight - margin - 1);
      }
      doc.setTextColor(30, 30, 30);
    }
  }

  addPageNumbersIfNeeded(doc);
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

  addReportHeader(doc, "Traceability Report", "Readable export report");
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
      didParseCell: (data: any) => {
        if (data.section !== "body") return;
        const row = detailsRows[data.row.index];
        if (!row) return;
        const isGpsRow = isCommunityDetailsGpsRow(String(row[0] || ""), String(row[1] || ""));
        if (!isGpsRow) return;
        if (data.column.index === 1) {
          data.cell.styles.fillColor = [255, 246, 179];
          data.cell.styles.textColor = [34, 100, 55];
        } else if (data.column.index === 0) {
          data.cell.styles.fillColor = [255, 246, 179];
        }
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
      didParseCell: (data: any) => {
        if (data.section !== "body") return;
        const row = (submission.values || [])[data.row.index];
        const label = String(responseRows[data.row.index]?.[0] || "").toLowerCase();
        const response = String(responseRows[data.row.index]?.[1] || "");
        const isGpsRow = isCommunityResponseGpsRow({
          fieldType: String(row?.fieldType || ""),
          label,
          response,
        });
        if (!isGpsRow) return;
        if (data.column.index === 1) {
          data.cell.styles.fillColor = [255, 246, 179];
          data.cell.styles.textColor = [34, 100, 55];
        } else if (data.column.index === 0) {
          data.cell.styles.fillColor = [255, 246, 179];
        }
      },
    });

    y = autoTableEndY(doc) + 6;
    const photos = (submission.values || [])
      .filter((value: any) => ["photo", "camera"].includes(String(value.fieldType || "").toLowerCase()) && value.photoUrl)
      .map((value: any) => value.photoUrl);

    if (photos.length) {
      await renderPhotosAdaptivePaged({
        doc,
        photos,
        startY: y,
        margin,
        contentWidth,
        pageHeight,
        sectionTitle: "Photos",
        prepareContinuationPage: async () => {
          doc.addPage();
          addReportHeader(doc, `Submission ${i + 1} Photos (cont.)`);
          return 34;
        },
      });
    }
  }

  addPageNumbersIfNeeded(doc);
  void savePdfFromJsPDF(doc, `${filename}.pdf`);
}

// =====================================================================
// Advanced Markets — buyer's order record
// =====================================================================

type CaptionedPhoto = {
  url: string;
  caption: string;
  sub?: string;
};

/**
 * Photo grid where every tile carries its own caption — used for milestone
 * proof pictures, which are meaningless without the stage they belong to.
 * Unlike renderPhotosAdaptivePaged the cell size is fixed so captions stay
 * readable; it returns the Y it finished at so the caller can keep going.
 */
async function renderCaptionedPhotoGrid(params: {
  doc: jsPDF;
  photos: CaptionedPhoto[];
  startY: number;
  margin: number;
  contentWidth: number;
  pageHeight: number;
  sectionTitle: string;
  prepareContinuationPage: () => number;
}): Promise<number> {
  const { doc, photos, margin, contentWidth, pageHeight, sectionTitle, prepareContinuationPage } = params;
  if (!photos.length) return params.startY;

  const cols = 3;
  const gap = 5;
  const cellW = (contentWidth - gap * (cols - 1)) / cols;
  const imgH = 42;
  const capH = 9;
  const rowH = imgH + capH + gap;

  let y = addSectionTitle(doc, params.startY, `${sectionTitle} (${photos.length})`);
  let col = 0;

  for (const photo of photos) {
    if (col === 0 && y + rowH > pageHeight - 15) {
      y = addSectionTitle(doc, prepareContinuationPage(), `${sectionTitle} (cont.)`);
    }

    const x = margin + col * (cellW + gap);

    doc.setDrawColor(200);
    doc.rect(x, y, cellW, imgH);
    try {
      const base64 = await urlToBase64(photo.url);
      if (!base64) throw new Error("Empty image");
      const fitted = await cropBase64ToAspect(base64, cellW / imgH);
      doc.addImage(fitted, imageFormatFromBase64(fitted), x, y, cellW, imgH);
    } catch {
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 140);
      doc.text("Photo unavailable", x + cellW / 2, y + imgH / 2, { align: "center" });
      doc.setTextColor(30, 30, 30);
    }

    doc.setFontSize(7);
    (doc as any).setFont(undefined, "bold");
    doc.text(photo.caption.slice(0, 60), x, y + imgH + 3.6, { maxWidth: cellW });
    (doc as any).setFont(undefined, "normal");
    if (photo.sub) {
      doc.setTextColor(110, 110, 110);
      doc.text(photo.sub.slice(0, 60), x, y + imgH + 7, { maxWidth: cellW });
      doc.setTextColor(30, 30, 30);
    }

    col += 1;
    if (col === cols) {
      col = 0;
      y += rowH;
    }
  }

  return col === 0 ? y : y + rowH;
}

/** Milestone/offer dates arrive as ISO strings; commitment dates as epoch ms. */
function formatLooseDate(value: unknown): string {
  if (value == null || value === "") return "N/A";
  if (typeof value === "number") return formatUgandaDate(value);
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? String(value) : formatUgandaDate(parsed);
}

function milestoneStatusLabel(status: string): string {
  switch (status) {
    case "approved": return "Approved";
    case "submitted": return "Awaiting review";
    case "rejected": return "Rejected";
    case "resubmission_required": return "Resubmission required";
    default: return "Pending";
  }
}

/**
 * The buyer's downloadable record of one Advanced Markets order: what was
 * bought, what it cost, how much has been released to the farmer, the product
 * gallery, and every production milestone with the proof pictures the farmer
 * submitted for it.
 *
 * Takes the shape advancePurchase.getCommitmentDetail returns.
 */
export async function exportAdvanceMarketCommitmentToPDF(
  detail: any,
  buyerName?: string
): Promise<void> {
  if (!detail) return;

  const offer = detail.offer || {};
  const milestones: any[] = detail.milestones || [];

  const logoBase64 = await urlToBase64(TOOLBOX_LOGO_PATH);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  const newPage = (title: string) => {
    doc.addPage();
    addReportHeader(doc, title);
    return 34;
  };

  await addWatermark(doc, logoBase64);
  addReportHeader(
    doc,
    "Advanced Markets Order",
    `${offer.productName || "Order"}  |  ${detail.utid || ""}`
  );

  // Order summary
  const deliveryOption = (offer.deliveryOptions || []).find(
    (o: any) => o.key === detail.deliveryOptionKey
  );

  const orderRows: Array<[string, string]> = [
    ["Order UTID", String(detail.utid || "N/A")],
    ["Buyer", buyerName || "N/A"],
    ["Product", String(offer.productName || "N/A") + (offer.variety ? ` (${offer.variety})` : "")],
    ["Quantity", `${detail.quantity} ${offer.unit || ""}`.trim()],
    ["Unit price", `UGX ${Number(detail.unitPriceAtCommit || 0).toLocaleString()}`],
    ["Order status", String(detail.status || "").replace(/_/g, " ")],
    ["Committed on", formatLooseDate(detail.createdAt)],
    ["Funded on", detail.fundedAt ? formatLooseDate(detail.fundedAt) : "N/A"],
    ["Recurrence", String(offer.recurrence || "N/A").replace(/_/g, " ")],
    ["Production location", String(offer.productionLocation || "N/A")],
    ["Delivery location", String(offer.deliveryLocation || "N/A")],
    ["Expected delivery", formatLooseDate(offer.expectedDeliveryDate)],
    ["Delivery option", deliveryOption ? deliveryOption.label : "N/A"],
    ["Delivered so far", `${detail.quantityDelivered || 0} ${offer.unit || ""}`.trim()],
    [
      "Insurance",
      detail.insuranceOpted
        ? `${offer.insuranceLabel || "Insured"} — UGX ${Number(detail.insuranceAmount || 0).toLocaleString()}`
        : "Not taken",
    ],
  ];

  autoTable(doc, {
    startY: 32,
    head: [["Order details", ""]],
    body: orderRows,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.8 },
    headStyles: { fillColor: [34, 100, 55], textColor: 255, fontSize: 9 },
    columnStyles: { 0: { cellWidth: 48, fontStyle: "bold" }, 1: { cellWidth: contentWidth - 48 } },
    margin: { left: margin, right: margin },
  });

  // Payment
  const paymentRows: Array<[string, string]> = [
    ["Produce value", `UGX ${Number((detail.unitPriceAtCommit || 0) * (detail.quantity || 0)).toLocaleString()}`],
    ["Cash component", `UGX ${Number(detail.cashAmount || 0).toLocaleString()}`],
    ["In-kind component", `UGX ${Number(detail.inKindAmount || 0).toLocaleString()}`],
    ["Delivery fee", `UGX ${Number(detail.deliveryFeeAmount || 0).toLocaleString()}`],
    ["Insurance", `UGX ${Number(detail.insuranceAmount || 0).toLocaleString()}`],
    ["Total committed", `UGX ${Number(detail.totalAmount || 0).toLocaleString()}`],
    ["Released to farmer", `UGX ${Number(detail.releasedAmount || 0).toLocaleString()}`],
    [
      "Still held",
      `UGX ${Number(
        detail.pendingAmount != null
          ? detail.pendingAmount
          : (detail.totalAmount || 0) - (detail.releasedAmount || 0)
      ).toLocaleString()}`,
    ],
  ];

  autoTable(doc, {
    startY: autoTableEndY(doc) + 6,
    head: [["Payment", "Amount"]],
    body: paymentRows,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.8 },
    headStyles: { fillColor: [34, 100, 55], textColor: 255, fontSize: 9 },
    columnStyles: { 0: { cellWidth: 48, fontStyle: "bold" }, 1: { cellWidth: contentWidth - 48 } },
    margin: { left: margin, right: margin },
  });

  // Whatever extra fields the community admin configured on the offer
  const customFields: any[] = offer.customFieldValues || [];
  if (customFields.length) {
    autoTable(doc, {
      startY: autoTableEndY(doc) + 6,
      head: [["Offer details", ""]],
      body: customFields.map((f: any) => [String(f.label || f.key), String(f.value ?? "-")]),
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 1.8 },
      headStyles: { fillColor: [34, 100, 55], textColor: 255, fontSize: 9 },
      columnStyles: { 0: { cellWidth: 48, fontStyle: "bold" }, 1: { cellWidth: contentWidth - 48 } },
      margin: { left: margin, right: margin },
    });
  }

  // Milestone progress
  if (milestones.length) {
    const approvedCount = milestones.filter((m: any) => m.status === "approved").length;
    autoTable(doc, {
      startY: autoTableEndY(doc) + 6,
      head: [["#", "Milestone", "Expected", "Release %", "Status", "Proofs"]],
      body: milestones.map((m: any) => [
        String(m.order),
        String(m.name || ""),
        formatLooseDate(m.expectedDate),
        `${Number(m.releasePercent || 0)}%`,
        milestoneStatusLabel(String(m.status || "")),
        String((m.proofPictures || []).length),
      ]),
      foot: [["", `${approvedCount} of ${milestones.length} milestones approved`, "", "", "", ""]],
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 1.8 },
      headStyles: { fillColor: [34, 100, 55], textColor: 255, fontSize: 9 },
      footStyles: { fillColor: [244, 247, 245], textColor: [34, 100, 55], fontStyle: "bold" },
      margin: { left: margin, right: margin },
    });
  }

  // Product gallery
  const galleryPhotos: string[] = offer.photoUrls || [];
  if (galleryPhotos.length) {
    let y = autoTableEndY(doc) + 8;
    if (y > pageHeight - 70) y = newPage("Advanced Markets Order — Product Photos");
    await renderPhotosAdaptivePaged({
      doc,
      photos: galleryPhotos,
      startY: y,
      margin,
      contentWidth,
      pageHeight,
      sectionTitle: "Product photos",
      prepareContinuationPage: async () => newPage("Advanced Markets Order — Product Photos (cont.)"),
    });
  }

  // Milestone proof pictures, flattened but captioned with their stage so the
  // grid still reads as the production timeline.
  const proofPhotos: CaptionedPhoto[] = [];
  for (const m of milestones) {
    const proofs: any[] = m.proofPictures || [];
    proofs.forEach((p: any, index: number) => {
      if (!p?.url) return;
      const capturedOn = formatLooseDate(p.capturedAt || p.submittedAt);
      const gps =
        p.lat != null && p.lng != null
          ? ` · ${Number(p.lat).toFixed(4)}, ${Number(p.lng).toFixed(4)}`
          : "";
      proofPhotos.push({
        url: p.url,
        caption: `${m.order}. ${m.name}${index > 0 ? " (earlier)" : ""}`,
        sub: `${capturedOn}${gps}`,
      });
    });
  }

  if (proofPhotos.length) {
    await renderCaptionedPhotoGrid({
      doc,
      photos: proofPhotos,
      startY: newPage("Advanced Markets Order — Milestone Proof Pictures"),
      margin,
      contentWidth,
      pageHeight,
      sectionTitle: "Milestone proof pictures",
      prepareContinuationPage: () => newPage("Advanced Markets Order — Milestone Proof Pictures (cont.)"),
    });
  }

  addPageNumbersIfNeeded(doc);

  const safeProduct = String(offer.productName || "Order")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .slice(0, 40);
  await savePdfFromJsPDF(doc, `Advanced_Market_Order_${safeProduct}_${detail.utid || ""}.pdf`);
}
