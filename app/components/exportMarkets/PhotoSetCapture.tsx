"use client";

import { useState } from "react";
import { GeneralCameraCapture } from "../GeneralCameraCapture";
import { inUgandaTime } from "../../utils/timeUtils";
import { button } from "./ui";

export type CapturedPhoto = {
  dataUrl: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  capturedAt: string;
  source?: "camera" | "gallery";
  locationSource?: "live" | "exif" | "manual" | "none";
  manualEntry?: boolean;
};

/** The evidence record saved with an uploaded photo (see convex/evidencePhotos.ts). */
export function evidencePhotoPayload<S extends string>(p: CapturedPhoto, storageId: S) {
  return {
    storageId,
    lat: p.lat ?? undefined,
    lng: p.lng ?? undefined,
    accuracy: p.accuracy ?? undefined,
    capturedAt: p.capturedAt,
    source: p.source,
    locationSource: p.locationSource,
    manualEntry: p.manualEntry,
  };
}

/**
 * Collects up to `max` proof photos, each stamped with GPS and time by the
 * app's camera component. A gallery photo takes its location and time from
 * the file; without them the user enters them and the photo is flagged
 * (CLAUDESCOPE Rule 9).
 */
export function PhotoSetCapture({
  photos,
  onChange,
  max = 6,
}: {
  photos: CapturedPhoto[];
  onChange: (p: CapturedPhoto[]) => void;
  max?: number;
}) {
  const [adding, setAdding] = useState(photos.length === 0);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      {photos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "0.5rem", marginBottom: "0.5rem" }}>
          {photos.map((p, i) => (
            <div key={i} style={{ position: "relative", fontSize: "0.7rem", color: "#555" }}>
              <img src={p.dataUrl} alt={`Photo ${i + 1}`} style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 6 }} />
              <div>{p.lat != null ? `📍 ${p.lat.toFixed(4)}, ${p.lng!.toFixed(4)}` : "No GPS"}</div>
              <div>🕒 {new Date(p.capturedAt).toLocaleString(undefined, inUgandaTime({ dateStyle: "short", timeStyle: "short" }))}</div>
              {p.manualEntry && <div style={{ color: "#e65100", fontWeight: 700 }}>✍️ Entered manually</div>}
              {p.locationSource === "exif" && <div style={{ color: "#2e7d32" }}>From photo data</div>}
              <button
                type="button"
                onClick={() => onChange(photos.filter((_, j) => j !== i))}
                style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: 999, width: 22, height: 22, cursor: "pointer" }}
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <div style={{ color: "#c62828", fontSize: "0.8rem" }}>{error}</div>}
      {adding && photos.length < max ? (
        <GeneralCameraCapture
          evidence
          onCapture={(json) => {
            try {
              const parsed = JSON.parse(json) as CapturedPhoto;
              onChange([...photos, parsed]);
              setAdding(false);
              setError(null);
            } catch {
              setError("Could not read the photo. Try again.");
            }
          }}
        />
      ) : (
        photos.length < max && (
          <button type="button" style={button("secondary")} onClick={() => setAdding(true)}>
            + Add photo ({photos.length}/{max})
          </button>
        )
      )}
    </div>
  );
}
