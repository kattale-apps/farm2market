"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QrCodeDisplayProps {
  targetUrl: string;
  darkColor?: string;
  lightColor?: string;
  logoUrl?: string;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  size?: number;
  fileName?: string;
  frame?: boolean;
}

/**
 * Generic QR preview + download component (color/logo/frame styling only).
 * Generalized from app/components/CommunityQRCode.tsx — that component stays
 * untouched since the community-join QR feature is separate from this one.
 */
export function QrCodeDisplay({
  targetUrl,
  darkColor = "#000000",
  lightColor = "#ffffff",
  logoUrl,
  errorCorrectionLevel = "M",
  size = 280,
  fileName = "qr-code",
  frame = false,
}: QrCodeDisplayProps) {
  const [pngDataUrl, setPngDataUrl] = useState<string | null>(null);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);

  useEffect(() => {
    if (!targetUrl) return;
    let cancelled = false;

    (async () => {
      try {
        const baseDataUrl = await QRCode.toDataURL(targetUrl, {
          width: 512,
          margin: 2,
          color: { dark: darkColor, light: lightColor },
          errorCorrectionLevel,
        });
        if (!logoUrl) {
          if (!cancelled) setPngDataUrl(baseDataUrl);
        } else {
          const composited = await compositeLogo(baseDataUrl, logoUrl, 512);
          if (!cancelled) setPngDataUrl(composited);
        }

        const svg = await QRCode.toString(targetUrl, {
          type: "svg",
          width: 512,
          margin: 2,
          color: { dark: darkColor, light: lightColor },
          errorCorrectionLevel,
        });
        if (!cancelled) setSvgMarkup(svg);
      } catch (err) {
        console.error("QR generation failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targetUrl, darkColor, lightColor, logoUrl, errorCorrectionLevel]);

  const handleDownloadPng = () => {
    if (!pngDataUrl) return;
    const link = document.createElement("a");
    link.href = pngDataUrl;
    link.download = `${fileName}.png`;
    link.click();
  };

  const handleDownloadSvg = () => {
    if (!svgMarkup) return;
    const blob = new Blob([svgMarkup], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(targetUrl);
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          display: "inline-block",
          padding: frame ? "16px" : 0,
          border: frame ? `3px solid ${darkColor}` : "none",
          borderRadius: frame ? 12 : 0,
          background: lightColor,
        }}
      >
        {pngDataUrl ? (
          <img
            src={pngDataUrl}
            alt="QR code"
            style={{ width: size, height: size, borderRadius: frame ? 0 : 8 }}
          />
        ) : (
          <div
            style={{
              width: size,
              height: size,
              background: "#f3f4f6",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#999",
            }}
          >
            Generating...
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "1rem", flexWrap: "wrap" }}>
        <button onClick={handleDownloadPng} style={buttonStyle("#2e7d32")}>
          ⬇️ PNG
        </button>
        <button onClick={handleDownloadSvg} style={buttonStyle("#1976d2")}>
          ⬇️ SVG
        </button>
        <button onClick={handleCopyLink} style={buttonStyle("#616161")}>
          🔗 Copy Link
        </button>
      </div>
    </div>
  );
}

function buttonStyle(background: string): React.CSSProperties {
  return {
    padding: "0.5rem 1rem",
    background,
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: "pointer",
  };
}

/** Draws the base QR image onto a canvas and composites a logo in the center. */
async function compositeLogo(baseDataUrl: string, logoUrl: string, canvasSize: number): Promise<string> {
  const [qrImage, logoImage] = await Promise.all([loadImage(baseDataUrl), loadImage(logoUrl)]);

  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return baseDataUrl;

  ctx.drawImage(qrImage, 0, 0, canvasSize, canvasSize);

  const logoSize = Math.round(canvasSize * 0.22);
  const logoX = (canvasSize - logoSize) / 2;
  const logoY = (canvasSize - logoSize) / 2;

  // White backing plate so the logo stays legible against QR modules.
  const padding = Math.round(logoSize * 0.12);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(logoX - padding, logoY - padding, logoSize + padding * 2, logoSize + padding * 2);
  ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);

  return canvas.toDataURL("image/png");
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
