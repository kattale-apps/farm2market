"use client";

import React, { useRef, useState, useCallback } from "react";
import { validateImageFile, fileToBase64DataUrl, getGPSLocation } from "../utils/imageValidation";

interface GeneralCameraCaptureProps {
  onCapture: (jsonValue: string) => void;
}

/**
 * Decoupled camera component for form builder camera fields.
 * Captures a photo with GPS + timestamp stamp, returns a JSON string
 * containing the base64 data URL and metadata.
 */
export function GeneralCameraCapture({ onCapture }: GeneralCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

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

      // Get GPS location (best-effort)
      let latitude: number | null = null;
      let longitude: number | null = null;
      let accuracy: number | null = null;
      try {
        const gpsData = await getGPSLocation();
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
  }, [onCapture]);

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
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        accuracy = position.coords.accuracy;
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
      const stampText = `${gpsText} | ${capturedAt.toLocaleString()}`;
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

      {!stream && !preview && (
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
