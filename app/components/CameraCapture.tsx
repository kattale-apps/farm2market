"use client";

import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { fileToBase64DataUrl, validateImageFile } from "../utils/imageValidation";
import { getCurrentLocation } from "../utils/gps";
import { inUgandaTime } from "../utils/timeUtils";
import { stampImage } from "./GeneralCameraCapture";
import { PhotoPickButtons } from "./PhotoPickButtons";

interface Props {
  formId: Id<"agroFreshUGFarmValidations">;
  field: string; // e.g., "section1.farmerPhoto"
  onUploadComplete: (metadata: any) => void;
}

/**
 * A farm validation photo: Gallery, or 📷 for the phone's own camera. A camera
 * photo is stamped with the live GPS position and the time before upload.
 */
export function CameraCapture({ formId, field, onUploadComplete }: Props) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const attachImage = useMutation(api.farmValidation.attachImage);

  const handlePick = async ([file]: File[], source: "gallery" | "camera") => {
    setError(null);
    const validation = validateImageFile(file);
    if (!validation.valid) return setError(validation.error || "Invalid file");
    setIsCapturing(true);
    try {
      // GPS location (best-effort)
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

      // A camera photo carries the GPS and time stamp on the picture
      let body: Blob = file;
      if (source === "camera") {
        const gpsText = latitude !== null ? `GPS: ${latitude.toFixed(5)}, ${longitude!.toFixed(5)}` : "GPS: unavailable";
        const stamped = await stampImage(await fileToBase64DataUrl(file), `${gpsText} | ${capturedAt.toLocaleString(undefined, inUgandaTime())}`);
        body = await (await fetch(stamped)).blob();
      }

      const postUrl = await generateUploadUrl();
      const uploadResult = await fetch(postUrl, { method: "POST", headers: { "Content-Type": body.type || "image/jpeg" }, body });
      const { storageId } = await uploadResult.json();

      const finalMetadata = await attachImage({
        formId,
        field,
        metadata: {
          storageId,
          lat: latitude ?? undefined,
          lng: longitude ?? undefined,
          accuracy: accuracy ?? undefined,
          capturedAt: capturedAt.toISOString(),
        },
      });
      onUploadComplete(finalMetadata);
    } catch (err) {
      console.error("Photo upload failed:", err);
      setError(`Could not add the photo: ${(err as Error).message}`);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div>
      <PhotoPickButtons onPick={handlePick} disabled={isCapturing} label={isCapturing ? "Adding photo…" : undefined} />
      {error && <p style={{ color: "#d32f2f", fontSize: "0.85rem", marginTop: "0.5rem" }}>{error}</p>}
    </div>
  );
}
