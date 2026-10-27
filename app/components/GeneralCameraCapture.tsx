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

// A photo back from the camera is minutes old at most; an older file was picked from storage
const CAMERA_FRESH_MS = 10 * 60 * 1000;

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
 * Photo input for forms and evidence: Gallery first, and a camera button that
 * opens the phone's own camera (no in-page camera permission needed, so it
 * works inside the app). A camera photo is stamped with the live GPS position
 * and the time; returns a JSON string with the data URL and its metadata.
 */
export function GeneralCameraCapture({ onCapture, evidence = false }: GeneralCameraCaptureProps) {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
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

  /** A gallery photo: evidence takes where and when from the file itself; other forms add the current GPS. */
  const addGalleryFile = useCallback(
    async (file: File) => {
      if (evidence) {
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
      const dataUrl = await fileToBase64DataUrl(file);
      setPreview(dataUrl);
      onCapture(JSON.stringify({ dataUrl, lat: latitude, lng: longitude, accuracy, capturedAt: new Date().toISOString() }));
    },
    [onCapture, evidence, finishEvidenceGallery]
  );

  /** A photo just taken with the phone's camera: stamped with the live GPS position and the time. */
  const addCameraFile = useCallback(
    async (file: File) => {
      // Not taken just now (picked from storage instead): it goes the gallery way
      if (evidence && Date.now() - file.lastModified > CAMERA_FRESH_MS) return addGalleryFile(file);

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
        // GPS unavailable — stamp without it
      }
      const capturedAt = new Date();
      const gpsText = latitude !== null ? `GPS: ${latitude.toFixed(5)}, ${longitude!.toFixed(5)}` : "GPS: unavailable";
      const dataUrl = await stampImage(await fileToBase64DataUrl(file), `${gpsText} | ${capturedAt.toLocaleString(undefined, inUgandaTime())}`);
      setPreview(dataUrl);
      onCapture(
        JSON.stringify({
          dataUrl,
          lat: latitude,
          lng: longitude,
          accuracy,
          capturedAt: capturedAt.toISOString(),
          ...(evidence ? { source: "camera", locationSource: latitude !== null ? "live" : "none", manualEntry: false } : {}),
        })
      );
    },
    [onCapture, evidence, addGalleryFile]
  );

  const handleFile = (use: (file: File) => Promise<unknown>) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setError(null);
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || "Invalid file");
      input.value = "";
      return;
    }
    setIsCapturing(true);
    try {
      await use(file);
    } catch (err) {
      console.error("Photo failed:", err);
      setError(`Could not add the photo: ${(err as Error).message}`);
    } finally {
      setIsCapturing(false);
      input.value = "";
    }
  };

  return (
    <div>
      {preview && (
        <div style={{ marginBottom: "0.5rem" }}>
          <img src={preview} alt="Captured" style={{ width: "100%", maxWidth: 400, borderRadius: 8 }} />
        </div>
      )}

      {evidence && !preview && !pendingGallery && (
        <div role="note" style={{ background: "#e3f2fd", border: "1px solid #90caf9", borderRadius: 8, padding: "0.5rem 0.7rem", fontSize: "0.9rem", fontWeight: 600, color: "#0d47a1", marginBottom: "0.5rem" }}>
          📍 Post a timestamped picture.
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

      {!pendingGallery && (
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={isCapturing}
            style={{
              flex: 1,
              minHeight: 52,
              background: "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              cursor: isCapturing ? "not-allowed" : "pointer",
              fontSize: "1.05rem",
              fontWeight: 700,
              opacity: isCapturing ? 0.6 : 1,
            }}
          >
            {isCapturing ? "Adding photo…" : preview ? "🖼️ Change photo" : "🖼️ Gallery"}
          </button>
          <button
            type="button"
            aria-label="Take a photo with the camera"
            title="Camera"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isCapturing}
            style={{
              width: 64,
              minHeight: 52,
              background: "#fff",
              border: "2px solid #1976d2",
              borderRadius: 10,
              cursor: isCapturing ? "not-allowed" : "pointer",
              fontSize: "1.6rem",
              opacity: isCapturing ? 0.6 : 1,
            }}
          >
            📷
          </button>
        </div>
      )}

      {/* Hidden inputs: the gallery, and the phone's own camera app */}
      <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleFile(addGalleryFile)} style={{ display: "none" }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFile(addCameraFile)} style={{ display: "none" }} />

      {error && <p style={{ color: "#d32f2f", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>}
    </div>
  );
}
