"use client";

import React, { useRef, useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface Props {
  formId: Id<"agroFreshUGFarmValidations">;
  field: string; // e.g., "section1.farmerPhoto"
  onUploadComplete: (metadata: any) => void;
}

export function CameraCapture({ formId, field, onUploadComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const attachImage = useMutation(api.farmValidation.attachImage);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // Prefer back camera
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
    } catch (err) {
      console.error("Camera access denied:", err);
      setError("Camera access is required. Please enable it in your browser settings.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
  }, [stream]);

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);
    setError(null);

    try {
      // 1. Get GPS location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });
      const { latitude, longitude, accuracy } = position.coords;
      const capturedAt = new Date();

      // 2. Draw video frame to canvas
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 3. Stamp metadata on the image
      const stampText = `GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} | ${capturedAt.toLocaleString()}`;
      ctx.font = "16px Arial";
      ctx.fillStyle = "white";
      ctx.strokeStyle = "black";
      ctx.lineWidth = 3;
      ctx.strokeText(stampText, 10, canvas.height - 10);
      ctx.fillText(stampText, 10, canvas.height - 10);

      // 4. Get blob from canvas and upload
      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error("Canvas to Blob conversion failed");

        const postUrl = await generateUploadUrl();
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": blob.type },
          body: blob,
        });
        const { storageId } = await result.json();

        // 5. Update the form with the new image metadata
        const imageMetadata = {
          storageId,
          lat: latitude,
          lng: longitude,
          accuracy,
          capturedAt: capturedAt.toISOString(),
        };

        const finalMetadata = await attachImage({
          formId,
          field,
          metadata: imageMetadata,
        });

        onUploadComplete(finalMetadata);
        stopCamera();
      }, "image/jpeg");
    } catch (err) {
      console.error("Capture failed:", err);
      setError(`Capture failed: ${(err as Error).message}`);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div>
      {!stream && <button onClick={startCamera}>Start Camera</button>}
      {stream && (
        <div>
          <video ref={videoRef} autoPlay playsInline style={{ width: "100%", borderRadius: 8 }} />
          <button onClick={handleCapture} disabled={isCapturing}>
            {isCapturing ? "Capturing..." : "Take Photo Now"}
          </button>
          <button onClick={stopCamera} style={{ marginLeft: 8 }}>Cancel</button>
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}