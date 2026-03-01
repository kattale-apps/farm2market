"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";

interface CommunityQRCodeProps {
  communityId: Id<"communities">;
  /** Render mode: "inline" shows a small QR; "fullscreen" shows a modal overlay */
  mode?: "inline" | "button";
  /** Button label when mode="button" */
  buttonLabel?: string;
}

/**
 * Renders a QR code for any community.
 * Uses getCommunityQrData to get the join slug (qrSlug or _id fallback).
 *
 * - mode="inline": renders the QR image directly (200x200)
 * - mode="button": renders a button that opens a fullscreen QR modal
 */
export function CommunityQRCode({
  communityId,
  mode = "button",
  buttonLabel = "Show QR Code",
}: CommunityQRCodeProps) {
  const qrData = useQuery(api.communities.getCommunityQrData, { communityId });
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate QR code when data is available
  useEffect(() => {
    if (!qrData?.joinPath) return;

    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const fullUrl = `${baseUrl}${qrData.joinPath}`;

    QRCode.toDataURL(fullUrl, {
      width: 512,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "H",
    })
      .then((url: string) => setQrDataUrl(url))
      .catch((err: any) => console.error("QR generation failed:", err));
  }, [qrData?.joinPath]);

  if (!qrData) {
    return null;
  }

  const handleDownload = () => {
    if (!qrDataUrl || !qrData) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${qrData.name.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
    link.click();
  };

  const handleCopyLink = () => {
    if (!qrData?.joinPath) return;
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    navigator.clipboard.writeText(`${baseUrl}${qrData.joinPath}`);
  };

  // Inline mode: just show the QR image
  if (mode === "inline") {
    return (
      <div style={{ textAlign: "center" }}>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR code for ${qrData.name}`}
            style={{ width: 200, height: 200, borderRadius: 8 }}
          />
        ) : (
          <div style={{ width: 200, height: 200, background: "#f3f4f6", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#999" }}>
            Generating...
          </div>
        )}
      </div>
    );
  }

  // Button mode: show a button that opens a fullscreen modal
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        style={{
          padding: "0.5rem 1rem",
          background: "#1976d2",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          fontSize: "0.85rem",
          fontWeight: "600",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#1565c0")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#1976d2")}
      >
        📱 {buttonLabel}
      </button>

      {/* Fullscreen QR Modal — rendered via portal to avoid card z-index issues */}
      {showModal && typeof document !== "undefined" && createPortal(
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: "2rem",
              maxWidth: 420,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            {/* Community name */}
            <h2 style={{
              margin: "0 0 0.5rem 0",
              fontSize: "1.4rem",
              fontFamily: '"Montserrat", sans-serif',
              fontWeight: 700,
              color: "#2c2c2c",
            }}>
              {qrData.name}
            </h2>
            <p style={{ color: "#666", fontSize: "0.9rem", margin: "0 0 1.5rem 0" }}>
              Scan to join this community
            </p>

            {/* QR Code */}
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code for ${qrData.name}`}
                style={{
                  width: "min(300px, 80vw)",
                  height: "min(300px, 80vw)",
                  borderRadius: 12,
                  border: "3px solid #e0e0e0",
                }}
              />
            ) : (
              <div style={{
                width: 300,
                height: 300,
                background: "#f3f4f6",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#999",
                margin: "0 auto",
              }}>
                Generating QR...
              </div>
            )}

            {/* Actions */}
            <div style={{
              display: "flex",
              gap: "0.75rem",
              marginTop: "1.5rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}>
              <button
                onClick={handleDownload}
                style={{
                  padding: "0.6rem 1.2rem",
                  background: "#2e7d32",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.9rem",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                ⬇️ Download PNG
              </button>
              <button
                onClick={() => {
                  handleCopyLink();
                  // Flash feedback
                  const btn = document.activeElement as HTMLButtonElement;
                  if (btn) {
                    const orig = btn.textContent;
                    btn.textContent = "✓ Copied!";
                    setTimeout(() => { btn.textContent = orig; }, 1500);
                  }
                }}
                style={{
                  padding: "0.6rem 1.2rem",
                  background: "#1976d2",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.9rem",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                🔗 Copy Link
              </button>
            </div>

            {/* Join URL preview */}
            <p style={{
              marginTop: "1rem",
              fontSize: "0.75rem",
              color: "#999",
              wordBreak: "break-all",
            }}>
              {typeof window !== "undefined" ? window.location.origin : ""}{qrData.joinPath}
            </p>

            {/* Close */}
            <button
              onClick={() => setShowModal(false)}
              style={{
                marginTop: "1rem",
                padding: "0.5rem 1.5rem",
                background: "#f3f4f6",
                color: "#333",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
