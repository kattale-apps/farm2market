"use client";

import React, { useRef, useState, useCallback } from "react";
import { validateImageFile, fileToBase64DataUrl } from "../utils/imageValidation";
import { getCurrentLocation } from "../utils/gps";
import { inUgandaTime } from "../utils/timeUtils";
import { readExifLocationTime } from "../utils/exif";

interface GeneralCameraCaptureProps {
  onCapture: (jsonValue: string) => void;
  /**
   * Trace-journey evidence (CLAUDESCOPE Rule 9): a gallery photo takes its GPS
   * and time from its EXIF data, and when the file has none the user types
   * them in and the photo is flagged as manually entered.
   */
  evidence?: boolean;
}

type PendingGallery = { dataUrl: string; lat: string; lng: string; when: string; missing: string[] };

/** "2026-09-27T14:05" (Uganda wall clock) for a datetime-local input. */
function ugandaLocalInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(Date.parse(iso) + 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

/** Draw the photo onto a canvas with the same GPS and time stamp as a camera photo. */
async function stampImage(dataUrl: string, stampText: string): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Could not read the image"));
    i.src = dataUrl;
  });
  const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const fontSize = Math.max(14, Math.round(canvas.width * 0.02));
  ctx.font = `${fontSize}px Arial`;
  const padding = 8;
  const boxHeight = fontSize + 10;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(6, canvas.height - boxHeight - 6, ctx.measureText(stampText).width + padding * 2, boxHeight);
  ctx.fillStyle = "white";
  ctx.fillText(stampText, 6 + padding, canvas.height - 10);
  return canvas.toDataURL("image/jpeg", 0.7);
}

/**
 * Decoupled camera component for form builder camera fields.
 * Captures a photo with GPS + timestamp stamp, returns a JSON string
 * containing the base64 data URL and metadata.
 */
export function GeneralCameraCapture({ onCapture, evidence = false }: GeneralCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingGallery, setPendingGallery] = useState<PendingGallery | null>(null);

  const finishEvidenceGallery = useCallback(
    async (dataUrl: string, lat: number, lng: number, capturedAtIso: string, manualEntry: boolean) => {
      const when = new Date(capturedAtIso).toLocaleString(undefined, inUgandaTime());
      const stamp = `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)} | ${when} | ${manualEntry ? "entered manually" : "from photo"}`;
      const stamped = await stampImage(dataUrl, stamp);
      setPreview(stamped);
      setPendingGallery(null);
      onCapture(
        JSON.stringify({
          dataUrl: stamped,
          lat,
          lng,
          accuracy: null,
          capturedAt: capturedAtIso,
          source: "gallery",
          locationSource: manualEntry ? "manual" : "exif",
          manualEntry,
        })
      );
    },
    [onCapture]
  );

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
      setPreview(null);
    } catch (err) {
      console.error("Camera access denied:", err);
      setError("Camera access is required. Please enable it in your settings.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
  }, [stream]);

  const handleGallerySelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsCapturing(true);

    try {
      // Validate file
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error || "Invalid file");
        setIsCapturing(false);
        return;
      }

      if (evidence) {
        // Where and when the photo was taken, from the file itself.
        const exif = await readExifLocationTime(file);
        const dataUrl = await fileToBase64DataUrl(file);
        if (exif.lat !== null && exif.lng !== null && exif.capturedAt) {
          await finishEvidenceGallery(dataUrl, exif.lat, exif.lng, exif.capturedAt, false);
        } else {
          const missing = [
            ...(exif.lat === null || exif.lng === null ? ["location"] : []),
            ...(!exif.capturedAt ? ["date and time"] : []),
          ];
          setPendingGallery({
            dataUrl,
            lat: exif.lat !== null ? String(exif.lat) : "",
            lng: exif.lng !== null ? String(exif.lng) : "",
            when: ugandaLocalInput(exif.capturedAt),
            missing,
          });
        }
        return;
      }

      // Get GPS location (best-effort)
      let latitude: number | null = null;
      let longitude: number | null = null;
      let accuracy: number | null = null;
      try {
        const gpsData = await getCurrentLocation();
        if (gpsData) {
          latitude = gpsData.latitude;
          longitude = gpsData.longitude;
          accuracy = gpsData.accuracy;
        }
      } catch {
        // GPS unavailable — continue without it
      }

      const capturedAt = new Date();

      // Convert image to base64 data URL
      const dataUrl = await fileToBase64DataUrl(file);

      // Build JSON value with same structure as camera capture
      const result = JSON.stringify({
        dataUrl,
        lat: latitude,
        lng: longitude,
        accuracy,
        capturedAt: capturedAt.toISOString(),
      });

      setPreview(dataUrl);
      onCapture(result);
    } catch (err) {
      console.error("Gallery upload failed:", err);
      setError(`Gallery upload failed: ${(err as Error).message}`);
    } finally {
      setIsCapturing(false);
      // Reset input
      if (galleryInputRef.current) {
        galleryInputRef.current.value = "";
      }
    }
  }, [onCapture, evidence, finishEvidenceGallery]);

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);
    setError(null);

    try {
      // 1. Get GPS location (best-effort — if denied, stamp without GPS)
      let latitude: number | null = null;
      let longitude: number | null = null;
      let accuracy: number | null = null;
      try {
        const gpsData = await getCurrentLocation();
        if (gpsData) {
          latitude = gpsData.latitude;
          longitude = gpsData.longitude;
          accuracy = gpsData.accuracy;
        }
      } catch {
        // GPS unavailable — continue without it
      }

      const capturedAt = new Date();

      // 2. Draw video frame to canvas
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const maxDimension = 1280;
      const rawWidth = video.videoWidth;
      const rawHeight = video.videoHeight;
      const scale = Math.min(1, maxDimension / Math.max(rawWidth, rawHeight));
      canvas.width = Math.round(rawWidth * scale);
      canvas.height = Math.round(rawHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 3. Stamp metadata on the image
      const gpsText = latitude !== null ? `GPS: ${latitude.toFixed(5)}, ${longitude!.toFixed(5)}` : "GPS: unavailable";
      const stampText = `${gpsText} | ${capturedAt.toLocaleString(undefined, inUgandaTime())}`;
      const fontSize = Math.max(14, Math.round(canvas.width * 0.02));
      ctx.font = `${fontSize}px Arial`;
      const textWidth = ctx.measureText(stampText).width;
      const padding = 8;
      const boxHeight = fontSize + 10;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(6, canvas.height - boxHeight - 6, textWidth + padding * 2, boxHeight);
      ctx.fillStyle = "white";
      ctx.fillText(stampText, 6 + padding, canvas.height - 10);

      // 4. Get data URL from canvas
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

      // 5. Build JSON value and pass upstream
      const result = JSON.stringify({
        dataUrl,
        lat: latitude,
        lng: longitude,
        accuracy,
        capturedAt: capturedAt.toISOString(),
        ...(evidence ? { source: "camera", locationSource: latitude !== null ? "live" : "none", manualEntry: false } : {}),
      });

      setPreview(dataUrl);
      stopCamera();
      onCapture(result);
    } catch (err) {
      console.error("Capture failed:", err);
      setError(`Capture failed: ${(err as Error).message}`);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div>
      {preview && !stream && (
        <div style={{ marginBottom: "0.5rem" }}>
          <img src={preview} alt="Captured" style={{ width: "100%", maxWidth: 400, borderRadius: 8 }} />
          <button
            type="button"
            onClick={startCamera}
            style={{
              display: "block",
              marginTop: "0.5rem",
              padding: "0.5rem 1rem",
              background: "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            📷 Retake Photo
          </button>
        </div>
      )}

      {evidence && !stream && !preview && !pendingGallery && (
        <div role="note" style={{ background: "#e3f2fd", border: "1px solid #90caf9", borderRadius: 8, padding: "0.5rem 0.7rem", fontSize: "0.8rem", color: "#0d47a1", marginBottom: "0.5rem" }}>
          ℹ️ Gallery photos must carry the location and date they were taken. Turn on location in your camera settings so your photos
          are saved with GPS. If a photo has none, you will be asked to enter them, and the photo is marked as entered by hand for review.
        </div>
      )}

      {pendingGallery && (
        <div style={{ background: "#fff8e1", border: "1px solid #ffcc80", borderRadius: 8, padding: "0.75rem", marginBottom: "0.5rem" }}>
          <img src={pendingGallery.dataUrl} alt="Selected" style={{ width: "100%", maxWidth: 240, borderRadius: 6, display: "block", marginBottom: "0.5rem" }} />
          <div style={{ fontSize: "0.82rem", color: "#e65100", marginBottom: "0.5rem" }}>
            This photo has no saved {pendingGallery.missing.join(" or ")}. Enter where and when it was taken. It will be marked
            &quot;entered manually&quot; for the reviewer.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.4rem" }}>
            <input
              inputMode="decimal"
              placeholder="Latitude, e.g. 0.3476"
              value={pendingGallery.lat}
              onChange={(e) => setPendingGallery({ ...pendingGallery, lat: e.target.value })}
              style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #ccc", fontSize: "0.9rem" }}
            />
            <input
              inputMode="decimal"
              placeholder="Longitude, e.g. 32.5825"
              value={pendingGallery.lng}
              onChange={(e) => setPendingGallery({ ...pendingGallery, lng: e.target.value })}
              style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #ccc", fontSize: "0.9rem" }}
            />
            <input
              type="datetime-local"
              aria-label="Date and time taken (Uganda time)"
              value={pendingGallery.when}
              onChange={(e) => setPendingGallery({ ...pendingGallery, when: e.target.value })}
              style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #ccc", fontSize: "0.9rem" }}
            />
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
            <button
              type="button"
              onClick={async () => {
                try {
                  const gps = await getCurrentLocation();
                  if (gps) setPendingGallery((p) => (p ? { ...p, lat: gps.latitude.toFixed(6), lng: gps.longitude.toFixed(6) } : p));
                } catch {
                  setError("Could not get your current location.");
                }
              }}
              style={{ padding: "0.45rem 0.8rem", background: "#fff", color: "#1976d2", border: "1px solid #1976d2", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}
            >
              📍 I am where it was taken: use my location
            </button>
            <button
              type="button"
              onClick={async () => {
                const lat = Number(pendingGallery.lat);
                const lng = Number(pendingGallery.lng);
                if (!pendingGallery.lat.trim() || !pendingGallery.lng.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
                  return setError("Enter a valid latitude and longitude.");
                }
                if (!pendingGallery.when) return setError("Enter the date and time the photo was taken.");
                // The input is Uganda wall-clock time (UTC+3).
                const instant = Date.parse(`${pendingGallery.when}:00Z`) - 3 * 60 * 60 * 1000;
                if (!Number.isFinite(instant) || instant > Date.now() + 5 * 60 * 1000) return setError("The date and time cannot be in the future.");
                setError(null);
                await finishEvidenceGallery(pendingGallery.dataUrl, lat, lng, new Date(instant).toISOString(), true);
              }}
              style={{ padding: "0.45rem 0.8rem", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}
            >
              Use this photo
            </button>
            <button
              type="button"
              onClick={() => setPendingGallery(null)}
              style={{ padding: "0.45rem 0.8rem", background: "#999", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!stream && !preview && !pendingGallery && (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={startCamera}
            style={{
              padding: "0.75rem 1.25rem",
              background: "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            📷 Open Camera
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={isCapturing}
            style={{
              padding: "0.75rem 1.25rem",
              background: "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: isCapturing ? "not-allowed" : "pointer",
              fontSize: "1rem",
              opacity: isCapturing ? 0.6 : 1,
            }}
          >
            📁 Choose from Gallery
          </button>
        </div>
      )}

      {/* Hidden gallery input */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleGallerySelect}
        style={{ display: "none" }}
      />

      {stream && (
        <div>
          <video ref={videoRef} autoPlay playsInline style={{ width: "100%", maxWidth: 480, borderRadius: 8 }} />
          <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={handleCapture}
              disabled={isCapturing}
              style={{
                padding: "0.5rem 1rem",
                background: isCapturing ? "#ccc" : "#16a34a",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: isCapturing ? "not-allowed" : "pointer",
                fontSize: "0.9rem",
              }}
            >
              {isCapturing ? "Capturing..." : "📸 Take Photo"}
            </button>
            <button
              type="button"
              onClick={stopCamera}
              style={{
                padding: "0.5rem 1rem",
                background: "#999",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.9rem",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />
      {error && <p style={{ color: "#d32f2f", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>}
    </div>
  );
}
