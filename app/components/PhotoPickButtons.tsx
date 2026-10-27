"use client";

import { useRef } from "react";

const GREEN = "#2e7d32";

/**
 * The one way to add a photo anywhere in the app: 🖼️ Gallery is the main
 * button and 📷 opens the phone's own camera app (an image input with
 * `capture`), which works inside the app without an in-page camera
 * permission. `documents` also takes PDFs, and the main button reads 📄 File.
 */
export function PhotoPickButtons({
  onPick,
  multiple = false,
  documents = false,
  disabled = false,
  label,
  size = "large",
}: {
  onPick: (files: File[], source: "gallery" | "camera") => void;
  /** The gallery may pick several photos at once */
  multiple?: boolean;
  documents?: boolean;
  disabled?: boolean;
  /** The main button's words, e.g. "Uploading…" or "🖼️ Add photos (2/6)" */
  label?: string;
  /** "icon": two small round buttons (🖼️ then 📷), for chat composers */
  size?: "large" | "small" | "icon";
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const height = size === "large" ? 52 : size === "small" ? 42 : 46;
  const pick = (source: "gallery" | "camera") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length > 0) onPick(files, source);
  };
  const state = { cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 } as const;
  const icon = size === "icon";

  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch", flexShrink: icon ? 0 : undefined }}>
      <button
        type="button"
        aria-label={icon ? "Choose a photo from the gallery" : undefined}
        title={icon ? "Gallery" : undefined}
        disabled={disabled}
        onClick={() => galleryRef.current?.click()}
        style={
          icon
            ? { width: height, height, flexShrink: 0, border: "none", borderRadius: "50%", background: GREEN, fontSize: "1.25rem", ...state }
            : { flex: 1, minHeight: height, padding: "0 1rem", border: "none", borderRadius: 10, background: GREEN, color: "#fff", fontWeight: 700, fontSize: size === "small" ? "0.92rem" : "1.05rem", ...state }
        }
      >
        {icon ? "🖼️" : label ?? (documents ? "📄 File" : "🖼️ Gallery")}
      </button>
      <button
        type="button"
        aria-label="Take a photo with the camera"
        title="Camera"
        disabled={disabled}
        onClick={() => cameraRef.current?.click()}
        style={{
          width: icon ? height : height + 12,
          minHeight: height,
          flexShrink: 0,
          border: `2px solid ${GREEN}`,
          borderRadius: icon ? "50%" : 10,
          background: "#fff",
          fontSize: size === "large" ? "1.6rem" : "1.3rem",
          ...state,
        }}
      >
        📷
      </button>
      <input ref={galleryRef} type="file" accept={documents ? "image/*,application/pdf" : "image/*"} multiple={multiple} onChange={pick("gallery")} style={{ display: "none" }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={pick("camera")} style={{ display: "none" }} />
    </div>
  );
}
