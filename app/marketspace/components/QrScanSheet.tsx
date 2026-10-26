"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
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
 * Scan a Farm2Market QR code: with the camera, from a photo in the gallery,
 * or by pasting the link. Camera and gallery always come together.
 */
export function QrScanSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const open = useCallback(
    (text: string) => {
      const target = targetOf(text);
      if (!target) {
        setMessage("That is not a Farm2Market product code.");
        return false;
      }
      stopCamera();
      onClose();
      router.push(target);
      return true;
    },
    [onClose, router, stopCamera]
  );

  // Read camera frames a few times a second until a code is found.
  useEffect(() => {
    if (!scanning) return;
    const id = window.setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const text = decode(ctx, canvas.width, canvas.height);
      if (text) open(text);
    }, 300);
    return () => window.clearInterval(id);
  }, [scanning, open]);

  useEffect(() => stopCamera, [stopCamera]);

  const startCamera = async () => {
    setMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setMessage("The camera is not available. Choose a photo of the QR code instead.");
    }
  };

  const fromPhoto = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
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
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  const big: React.CSSProperties = { minHeight: 50, borderRadius: 12, border: "none", background: "#2e7d32", color: "#fff", fontWeight: 800, fontFamily: FONT, cursor: "pointer", fontSize: "1rem" };

  return (
    <Sheet
      title="Scan a QR code"
      onClose={() => {
        stopCamera();
        onClose();
      }}
    >
      <div style={{ display: "grid", gap: "0.7rem", fontFamily: FONT }}>
        {scanning ? (
          <>
            <video ref={videoRef} playsInline muted style={{ width: "100%", borderRadius: 12, background: "#000" }} />
            <button type="button" onClick={stopCamera} style={{ ...big, background: "#757575" }}>Stop camera</button>
          </>
        ) : (
          <button type="button" onClick={startCamera} style={big}>📷 Open camera</button>
        )}
        <button type="button" onClick={() => galleryRef.current?.click()} style={{ ...big, background: "#1565c0" }}>📁 Choose a photo of a QR code</button>
        <input ref={galleryRef} type="file" accept="image/*" onChange={(e) => fromPhoto(e.target.files?.[0])} style={{ display: "none" }} />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Or paste a MarketSpace link"
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
