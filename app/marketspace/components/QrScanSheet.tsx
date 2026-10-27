"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { PhotoPickButtons } from "../../components/PhotoPickButtons";
import { Sheet } from "./Sheets";
import { FONT } from "./shared";

/**
 * The page a scanned code opens. Farm2Market codes are product links
 * (…/marketspace/p/<id>); only paths on this site are followed, so a stray
 * code cannot send anyone to another website.
 */
function targetOf(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;
  // The code printed under a goods QR, typed in by hand
  if (/^F2M-[A-Z0-9]{6}$/i.test(raw)) return `/g/${raw.toUpperCase()}`;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin && !/farm2market/i.test(url.hostname)) return null;
    return /^\/(?![/\\])/.test(url.pathname) ? `${url.pathname}${url.search}` : null;
  } catch {
    return null;
  }
}

/** Reads a QR code from image pixels, or returns null. */
function decode(ctx: CanvasRenderingContext2D, width: number, height: number): string | null {
  const image = ctx.getImageData(0, 0, width, height);
  return jsQR(image.data, width, height, { inversionAttempts: "dontInvert" })?.data ?? null;
}

/**
 * Scan a Farm2Market QR code: a photo of it from the gallery or the phone's
 * camera (the same photo buttons as every form), or paste the link.
 */
export function QrScanSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");

  const open = (text: string) => {
    const target = targetOf(text);
    if (!target) {
      setMessage("That is not a Farm2Market product code.");
      return;
    }
    onClose();
    router.push(target);
  };

  const fromPhoto = async (file: File) => {
    setMessage(null);
    setReading(true);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = canvasRef.current ?? document.createElement("canvas");
      const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("no canvas");
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const text = decode(ctx, canvas.width, canvas.height);
      if (!text) setMessage("No QR code found in that photo. Try a closer, sharper photo.");
      else open(text);
    } catch {
      setMessage("Could not read that photo.");
    } finally {
      setReading(false);
    }
  };

  const big: React.CSSProperties = { minHeight: 50, borderRadius: 12, border: "none", background: "#2e7d32", color: "#fff", fontWeight: 800, fontFamily: FONT, cursor: "pointer", fontSize: "1rem" };

  return (
    <Sheet title="Scan a QR code" onClose={onClose}>
      <div style={{ display: "grid", gap: "0.7rem", fontFamily: FONT }}>
        <PhotoPickButtons onPick={([file]) => fromPhoto(file)} disabled={reading} label={reading ? "Reading the code…" : undefined} />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Or paste a link, or type the code (F2M-…)"
            style={{ flex: 1, minHeight: 44, borderRadius: 10, border: "1px solid #ccc", padding: "0 0.7rem", fontFamily: FONT }}
          />
          <button type="button" onClick={() => open(pasted)} disabled={!pasted.trim()} style={{ ...big, minHeight: 44, padding: "0 1rem", fontSize: "0.9rem" }}>Open</button>
        </div>
        {message && <div style={{ color: "#c62828", fontWeight: 700, fontSize: "0.9rem" }}>{message}</div>}
        <div style={{ fontSize: "0.8rem", color: "#666" }}>Farm2Market QR codes are on bags, lots and posters. Your phone&apos;s own camera app can open them too.</div>
      </div>
    </Sheet>
  );
}
