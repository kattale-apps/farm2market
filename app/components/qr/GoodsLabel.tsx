"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** A picture for the good, read without words: the emoji the seller chose, or one for common produce. */
export function goodsIcon(label: string): string {
  const lead = label.trim().match(/^\p{Extended_Pictographic}️?/u)?.[0];
  if (lead) return lead;
  const key = label.toLowerCase();
  const icons: [string[], string][] = [
    [["maize", "corn"], "🌽"],
    [["rice"], "🍚"],
    [["coffee", "arabica", "robusta", "faq"], "☕"],
    [["cocoa"], "🍫"],
    [["banana", "matooke", "plantain"], "🍌"],
    [["beans", "soy"], "🫘"],
    [["groundnut", "peanut"], "🥜"],
    [["millet", "sorghum", "wheat"], "🌾"],
    [["sunflower"], "🌻"],
    [["potato"], "🥔"],
    [["tomato"], "🍅"],
    [["onion"], "🧅"],
    [["cabbage"], "🥬"],
    [["avocado"], "🥑"],
    [["mango"], "🥭"],
    [["pineapple"], "🍍"],
    [["watermelon"], "🍉"],
    [["cassava"], "🌿"],
    [["egg"], "🥚"],
    [["milk"], "🥛"],
    [["honey"], "🍯"],
  ];
  return icons.find(([words]) => words.some((w) => key.includes(w)))?.[1] ?? "🌾";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Splits the name into at most two lines that fit the label. */
function nameLines(ctx: CanvasRenderingContext2D, name: string, maxWidth: number): string[] {
  const words = name.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= 2) return lines;
  return [lines[0], `${lines.slice(1).join(" ").slice(0, 24)}…`];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const LOGO = "/icons/farm2market-logo.png";
const W = 800; // Label width in pixels: about 7 cm when printed at 300 dpi
const QR = 560;
const BADGE = 120; // The logo badge on the QR's free corner
const GREEN = "#1b5e20";

/** Draws the label: photo and name, the QR with the good's icon in the middle and the Farm2Market logo on its free corner, and the code to type in. */
async function drawLabel(url: string, code: string, label: string, photoUrl: string | null): Promise<string> {
  const icon = goodsIcon(label);
  const name = label.trim();
  const [photo, logo] = await Promise.all([
    photoUrl ? loadImage(photoUrl).catch(() => null) : Promise.resolve(null),
    loadImage(LOGO).catch(() => null),
  ]);
  const qr = await loadImage(await QRCode.toDataURL(url, { width: QR, margin: 1, errorCorrectionLevel: "H" }));

  const canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d")!;
  measure.font = "800 56px Montserrat, Arial, sans-serif";
  const lines = nameLines(measure, name, W - 80);
  const photoH = photo ? 260 : 0;
  const H = 40 + (photo ? photoH + 24 : 0) + lines.length * 66 + 16 + QR + BADGE / 2 + 20 + 64 + 44 + 36;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 8;
  roundRect(ctx, 4, 4, W - 8, H - 8, 28);
  ctx.stroke();

  let y = 40;
  if (photo) {
    // The photo, cropped to a square, so people can match the label to the goods
    const side = Math.min(photo.width, photo.height);
    ctx.save();
    roundRect(ctx, (W - photoH) / 2, y, photoH, photoH, 20);
    ctx.clip();
    ctx.drawImage(photo, (photo.width - side) / 2, (photo.height - side) / 2, side, side, (W - photoH) / 2, y, photoH, photoH);
    ctx.restore();
    y += photoH + 24;
  }

  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "800 56px Montserrat, Arial, sans-serif";
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += 66;
  }
  y += 16;

  // The QR, with the good's icon on a white plate in the middle (high error correction keeps it
  // scannable with the middle covered)
  const qrX = (W - QR) / 2;
  ctx.drawImage(qr, qrX, y, QR, QR);
  const plate = Math.round(QR * 0.2);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, W / 2 - plate / 2, y + QR / 2 - plate / 2, plate, plate, 18);
  ctx.fill();
  ctx.font = `${Math.round(plate * 0.72)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(icon, W / 2, y + QR / 2 + 4);
  // The Farm2Market logo as a round badge on the bottom-right corner, the one corner without a
  // finder square, so people know it is a Farm2Market code
  if (logo) {
    const cx = qrX + QR - 6;
    const cy = y + QR - 6;
    ctx.beginPath();
    ctx.arc(cx, cy, BADGE / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = GREEN;
    ctx.stroke();
    const mark = BADGE * 0.74;
    ctx.drawImage(logo, cx - mark / 2, cy - mark / 2, mark, mark);
  }
  y += QR + BADGE / 2 + 20;

  // The code, for typing in when a phone cannot scan
  ctx.textBaseline = "top";
  ctx.fillStyle = GREEN;
  ctx.font = "800 54px 'Courier New', monospace";
  ctx.fillText(code, W / 2, y);
  y += 64;
  ctx.fillStyle = "#444";
  ctx.font = "600 26px Montserrat, Arial, sans-serif";
  ctx.fillText("Scan to see where it comes from · Farm2Market", W / 2, y);

  return canvas.toDataURL("image/png");
}

/**
 * The printable label for a goods QR: the product photo and name sit above
 * the code and the good's icon in its middle, so people can tell labels apart
 * by eye; the Farm2Market logo sits on the code's free corner, so they know
 * whose code it is. The photo is left out when there is none or it cannot be
 * loaded.
 */
export function GoodsLabel({ code, name, photoUrl, width = 240 }: { code: string; name: string; photoUrl?: string | null; width?: number }) {
  const [label, setLabel] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/g/${code}` : "";

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setFailed(false);
    drawLabel(url, code, name.trim() || "Farm2Market goods", photoUrl ?? null)
      .then((png) => !cancelled && setLabel(png))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [url, code, name, photoUrl]);

  const download = () => {
    if (!label) return;
    const link = document.createElement("a");
    link.href = label;
    link.download = `farm2market-${code}.png`;
    link.click();
  };

  if (failed) return <p style={{ fontSize: "0.85rem", color: "#c62828" }}>Could not draw the label. Try again.</p>;
  return (
    <div style={{ textAlign: "center" }}>
      {label ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={label} alt={`QR label for ${name}`} style={{ width, maxWidth: "100%", borderRadius: 8 }} />
      ) : (
        <div style={{ width, maxWidth: "100%", height: width * 1.3, margin: "0 auto", background: "#f3f4f6", borderRadius: 8, display: "grid", placeItems: "center", color: "#999" }}>
          Making the label…
        </div>
      )}
      <div style={{ marginTop: "0.6rem" }}>
        <button
          type="button"
          onClick={download}
          disabled={!label}
          style={{ minHeight: 44, padding: "0 1.1rem", borderRadius: 10, border: "none", background: label ? "#2e7d32" : "#ccc", color: "#fff", fontWeight: 800, cursor: label ? "pointer" : "not-allowed" }}
        >
          ⬇️ Download Label to Print
        </button>
      </div>
    </div>
  );
}
