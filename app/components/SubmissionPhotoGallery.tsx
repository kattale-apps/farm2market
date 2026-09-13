"use client";

import React, { useState } from "react";

type SubmissionPhotoGalleryProps = {
  photos: string[];
  minTileWidth?: number;
  tileHeight?: number;
};

export default function SubmissionPhotoGallery({
  photos,
  minTileWidth = 100,
  tileHeight = 90,
}: SubmissionPhotoGalleryProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (!photos?.length) return null;

  const handleDownload = async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "photo.jpg";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, minmax(${minTileWidth}px, 1fr))`,
          gap: "0.4rem",
        }}
      >
        {photos.map((url, idx) => (
          <img
            key={`${url}-${idx}`}
            src={url}
            alt={`Submission photo ${idx + 1}`}
            onClick={() => setLightboxUrl(url)}
            style={{
              width: "100%",
              height: tileHeight,
              objectFit: "cover",
              borderRadius: 8,
              border: "1px solid #e0e0e0",
              cursor: "zoom-in",
            }}
          />
        ))}
      </div>

      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1.5rem",
          }}
        >
          <img
            src={lightboxUrl}
            alt="Photo enlarged"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", borderRadius: 8 }}
          />
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(lightboxUrl);
              }}
              style={{
                padding: "0.6rem 1rem",
                background: "#2e7d32",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              ⬇ Download
            </button>
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              style={{
                padding: "0.6rem 1rem",
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.5)",
                color: "#fff",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
