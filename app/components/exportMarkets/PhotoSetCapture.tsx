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
};

/**
 * Collects up to `max` proof photos, each stamped with GPS and time by the
 * app's camera component (which also accepts a gallery photo).
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
