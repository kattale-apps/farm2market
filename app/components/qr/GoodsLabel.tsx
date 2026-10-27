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
    [["cowpea", "pigeon"], "🫘"], // Crops, not animals: cowpeas are not cows, pigeon peas are not pigs
    // Animals (convex/produceKinds.ts)
    [["cattle", "cow", "bull", "heifer"], "🐮"],
    [["goat"], "🐐"],
    [["sheep"], "🐑"],
    [["pig"], "🐷"],
    [["chicken", "hen", "broiler", "layer", "kuroiler"], "🐔"],
    [["duck"], "🦆"],
    [["turkey"], "🦃"],
    [["rabbit"], "🐇"],
    [["fish", "tilapia", "mukene", "nile perch"], "🐟"],
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
const BANNER_PLACEHOLDER = "/backgrounds/farm-bg.jpg"; // The QR head banner's second picture (a slot that can carry a sponsor later)
const W = 800; // Label width in pixels: about 7 cm when printed at 300 dpi
const QR = 560;
const BADGE = 120; // The logo badge on the QR's free corner
const BANNER = 260; // The QR head banner: square pictures above the name and the code
const BANNER_GAP = 24;
const GREEN = "#1b5e20";
const SITE_LINES = ["Visit farm2marketuganda.com", "and check the MarketSpace"]; // The label's bottom line, in two lines to stay readable when printed
const SITE_BLOCK = 24 + 42 + 38; // Divider gap and the two lines
const PLACE_LINE = 46; // "📍 Mukono District · Goma Subcounty" under the name

/** Draws the label: the QR head banner and the name, where the goods are sold, the QR with the good's icon in the middle and the Farm2Market logo on its free corner, the code to type in, and the website to visit. */
async function drawLabel(url: string, code: string, label: string, photoUrl: string | null, bannerUrl: string, place: string | null): Promise<string> {
  const icon = goodsIcon(label);
  const name = label.trim();
  const [photo, second, logo] = await Promise.all([
    photoUrl ? loadImage(photoUrl).catch(() => null) : Promise.resolve(null),
    loadImage(bannerUrl).catch(() => null),
    loadImage(LOGO).catch(() => null),
  ]);
  // The QR head banner: the listing photo and the second picture side by side; the second picture alone when there is no photo
  const banner = [photo, second].filter((img): img is HTMLImageElement => img !== null);
  const qr = await loadImage(await QRCode.toDataURL(url, { width: QR, margin: 1, errorCorrectionLevel: "H" }));

  const canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d")!;
  measure.font = "800 56px Montserrat, Arial, sans-serif";
  const lines = nameLines(measure, name, W - 80);
  const H = 40 + (banner.length > 0 ? BANNER + 24 : 0) + lines.length * 66 + (place ? PLACE_LINE : 0) + 16 + QR + BADGE / 2 + 20 + 64 + 44 + SITE_BLOCK + 36;
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
  if (banner.length > 0) {
    // Each picture cropped to a square; the listing photo first, so people can match the label to the goods
    const rowWidth = banner.length * BANNER + (banner.length - 1) * BANNER_GAP;
    banner.forEach((img, i) => {
      const x = (W - rowWidth) / 2 + i * (BANNER + BANNER_GAP);
      const side = Math.min(img.width, img.height);
      ctx.save();
      roundRect(ctx, x, y, BANNER, BANNER, 20);
      ctx.clip();
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, x, y, BANNER, BANNER);
      ctx.restore();
    });
    y += BANNER + 24;
  }

  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "800 56px Montserrat, Arial, sans-serif";
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += 66;
  }
  // Where the goods are sold, just above the QR; a long name gets a smaller font to fit
  if (place) {
    const text = `📍 ${place}`;
    let size = 32;
    ctx.font = `700 ${size}px Montserrat, Arial, sans-serif`;
    while (size > 22 && ctx.measureText(text).width > W - 80) {
      size -= 2;
      ctx.font = `700 ${size}px Montserrat, Arial, sans-serif`;
    }
    ctx.fillStyle = "#333";
    ctx.fillText(text, W / 2, y);
    y += PLACE_LINE;
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
  y += 44;

  // The bottom line: where to find MarketSpace without scanning
  ctx.strokeStyle = "#c8e6c9";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(80, y + 6);
  ctx.lineTo(W - 80, y + 6);
  ctx.stroke();
  y += 24;
  ctx.fillStyle = GREEN;
  ctx.font = "800 32px Montserrat, Arial, sans-serif";
  ctx.fillText(SITE_LINES[0], W / 2, y);
  y += 42;
  ctx.fillStyle = "#333";
  ctx.font = "700 28px Montserrat, Arial, sans-serif";
  ctx.fillText(SITE_LINES[1], W / 2, y);

  return canvas.toDataURL("image/png");
}

/**
 * The printable label for a goods QR: the QR head banner (the listing photo
 * and a second picture side by side, the second picture alone when there is
 * no photo), the name and where the goods are sold (district and subcounty)
 * sit above the code and the good's icon in its middle, so people can tell
 * labels apart by eye; the Farm2Market logo sits
 * on the code's free corner, so they know whose code it is.
 */
export function GoodsLabel({
  code,
  name,
  photoUrl,
  place = null,
  bannerUrl = BANNER_PLACEHOLDER,
  width = 240,
}: {
  code: string;
  name: string;
  photoUrl?: string | null;
  /** The seller's district and subcounty, printed above the QR */
  place?: string | null;
  /** The QR head banner's second picture (the placeholder until a sponsor's picture is set) */
  bannerUrl?: string;
  width?: number;
}) {
  const [label, setLabel] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/g/${code}` : "";

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setFailed(false);
    drawLabel(url, code, name.trim() || "Farm2Market goods", photoUrl ?? null, bannerUrl, place)
      .then((png) => !cancelled && setLabel(png))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [url, code, name, photoUrl, bannerUrl, place]);

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
