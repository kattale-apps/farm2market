"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { GeneralCameraCapture } from "../GeneralCameraCapture";

interface Props {
  farmerId: Id<"users">;
  milestoneId: Id<"advancePurchaseMilestones">;
  gpsRequired: boolean;
  onSubmitted: () => void;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
  const bytes = atob(base64);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
  return new Blob([array], { type: mime });
}

export function MilestoneEvidenceCapture({ farmerId, milestoneId, gpsRequired, onSubmitted }: Props) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const submitEvidence = useMutation(api.advancePurchase.submitMilestoneEvidence);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCapture, setPendingCapture] = useState<{
    dataUrl: string;
    lat: number | null;
    lng: number | null;
    accuracy: number | null;
    capturedAt: string;
  } | null>(null);

  const handleCapture = (jsonValue: string) => {
    setError(null);
    try {
      const parsed = JSON.parse(jsonValue);
      setPendingCapture(parsed);
    } catch {
      setError("Could not read the captured photo. Please try again.");
    }
  };

  const handleSubmit = async () => {
    if (!pendingCapture) return;
    if (gpsRequired && (pendingCapture.lat == null || pendingCapture.lng == null)) {
      setError("Location could not be captured. Please enable GPS and retake the photo.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const uploadUrl = await generateUploadUrl();
      const blob = dataUrlToBlob(pendingCapture.dataUrl);
      const res = await fetch(uploadUrl, { method: "POST", body: blob });
      const { storageId } = await res.json();

      await submitEvidence({
        farmerId,
        milestoneId,
        storageId,
        lat: pendingCapture.lat ?? undefined,
        lng: pendingCapture.lng ?? undefined,
        accuracy: pendingCapture.accuracy ?? undefined,
        capturedAt: pendingCapture.capturedAt,
      });

      setPendingCapture(null);
      onSubmitted();
    } catch (err) {
      setError((err as Error).message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {!pendingCapture && <GeneralCameraCapture onCapture={handleCapture} />}

      {pendingCapture && (
        <div>
          <img
            src={pendingCapture.dataUrl}
            alt="Evidence preview"
            style={{ width: "100%", maxWidth: 400, borderRadius: 8, marginBottom: "0.5rem" }}
          />
          <p style={{ fontSize: "0.8rem", color: "#555", margin: "0 0 0.5rem" }}>
            📍 {pendingCapture.lat != null ? `${pendingCapture.lat.toFixed(5)}, ${pendingCapture.lng!.toFixed(5)}` : "No GPS captured"}
            {"  ·  "}
            🕒 {new Date(pendingCapture.capturedAt).toLocaleString()}
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                padding: "0.75rem 1.25rem",
                background: submitting ? "#a5d6a7" : "#2e7d32",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer",
                flex: 1,
              }}
            >
              {submitting ? "Submitting..." : "Submit for verification"}
            </button>
            <button
              type="button"
              onClick={() => setPendingCapture(null)}
              disabled={submitting}
              style={{
                padding: "0.75rem 1rem",
                background: "#eee",
                color: "#333",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Retake
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ color: "#d32f2f", fontSize: "0.85rem" }}>{error}</p>}
    </div>
  );
}
