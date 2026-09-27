"use client";

import { useState } from "react";
import jsPDF from "jspdf";
import type { Doc } from "../../../convex/_generated/dataModel";
import { formLabel } from "../../../convex/processorShared";
import { vendorCropLabel } from "../../../convex/marketOffersShared";
import { EXPORT_CROPS } from "../../../convex/exportMarketsShared";
import { savePdfFromJsPDF } from "../../utils/pdfDownload";

type Receipt = Doc<"purchaseReceipts">;

export function cropName(crop: string): string {
  return EXPORT_CROPS.find((c) => c.key === crop)?.label ?? vendorCropLabel(crop);
}

function ugx(n: number) {
  return `UGX ${Math.round(n).toLocaleString()}`;
}

/** Plain-text receipt, used for WhatsApp and as the PDF body. */
export function receiptLines(r: Receipt): string[] {
  return [
    `Receipt ${r.receiptNumber}`,
    `Date paid: ${r.paidOn}`,
    `Paid by: ${r.buyerName}${r.buyerDistrict ? `, ${r.buyerDistrict}` : ""} (${r.buyerKind})`,
    `Paid to: ${r.farmerName}`,
    `Produce: ${cropName(r.crop)}${r.form ? ` (${formLabel(r.form)})` : ""}`,
    `Quantity: ${r.quantity.toLocaleString()} ${r.unit}`,
    `Price: ${ugx(r.priceUgx)} per ${r.unit}`,
    `Total paid in cash: ${ugx(r.totalUgx)}`,
  ];
}

function receiptPdf(r: Receipt): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  doc.setFontSize(16);
  doc.text("Farm2Market - Cash receipt", 12, 16);
  doc.setFontSize(11);
  let y = 28;
  for (const line of receiptLines(r)) {
    doc.text(line, 12, y);
    y += 8;
  }
  doc.setFontSize(8);
  doc.text("Issued in the Farm2Market app by the buyer. Keep it as your record of this sale.", 12, y + 6);
  return doc;
}

/**
 * One cash receipt: the key figures, download as PDF, and share (the phone's
 * share sheet, so WhatsApp, or a WhatsApp text on browsers without it). It
 * stays in the dashboard as a transaction record.
 */
export function ReceiptCard({ receipt }: { receipt: Receipt }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const filename = `receipt-${receipt.receiptNumber}.pdf`;
  const share = async () => {
    setMsg(null);
    const text = receiptLines(receipt).join("\n");
    try {
      const blob: Blob = receiptPdf(receipt).output("blob");
      const file = new File([blob], filename, { type: "application/pdf" });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: `Receipt ${receipt.receiptNumber}`, text });
        return;
      }
    } catch {
      // Dismissed or not supported: fall back to a WhatsApp text below.
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };
  return (
    <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, marginBottom: 8 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{ all: "unset", cursor: "pointer", boxSizing: "border-box", width: "100%", padding: "0.7rem 0.85rem", display: "flex", gap: 10, alignItems: "center", minHeight: 44 }}
      >
        <span style={{ fontSize: "1.4rem" }}>🧾</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: "0.92rem" }}>{ugx(receipt.totalUgx)}</b>{" "}
          <span style={{ fontSize: "0.85rem", color: "#455a64" }}>
            · {receipt.quantity.toLocaleString()} {receipt.unit} {cropName(receipt.crop)}
          </span>
          <span style={{ display: "block", fontSize: "0.75rem", color: "#78909c" }}>
            {receipt.paidOn} · {receipt.buyerName} · {receipt.receiptNumber}
          </span>
        </span>
        <span style={{ color: "#9ca3af" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 0.85rem 0.8rem", fontSize: "0.86rem", lineHeight: 1.6 }}>
          {receiptLines(receipt).map((l) => (
            <div key={l}>{l}</div>
          ))}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button
              type="button"
              onClick={async () => {
                const r = await savePdfFromJsPDF(receiptPdf(receipt), filename);
                setMsg(r.ok ? (r.method === "saved" ? "Saved to Documents." : null) : r.error);
              }}
              style={btn("#2e7d32")}
            >
              ⬇ Download PDF
            </button>
            <button type="button" onClick={share} style={btn("#25d366")}>
              Share (WhatsApp)
            </button>
          </div>
          {msg && <div style={{ fontSize: "0.8rem", color: "#607d8b", marginTop: 6 }}>{msg}</div>}
        </div>
      )}
    </div>
  );
}

function btn(bg: string): React.CSSProperties {
  return { minHeight: 40, padding: "0.45rem 0.9rem", borderRadius: 8, border: "none", background: bg, color: "#fff", fontWeight: 700, cursor: "pointer" };
}
