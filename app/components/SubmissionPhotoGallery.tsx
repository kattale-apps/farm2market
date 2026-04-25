"use client";

import React from "react";

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
  if (!photos?.length) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${minTileWidth}px, 1fr))`,
        gap: "0.4rem",
      }}
    >
      {photos.map((url, idx) => (
        <a key={`${url}-${idx}`} href={url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
          <img
            src={url}
            alt={`Submission photo ${idx + 1}`}
            style={{
              width: "100%",
              height: tileHeight,
              objectFit: "cover",
              borderRadius: 8,
              border: "1px solid #e0e0e0",
            }}
          />
        </a>
      ))}
    </div>
  );
}
