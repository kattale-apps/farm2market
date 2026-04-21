"use client";

import { useEffect, useState } from "react";

const PERMISSIONS_KEY = "app_permissions_v1";

type PermState = "unknown" | "granted" | "denied" | "dismissed";

/**
 * PermissionGate — one-time camera + GPS permission request.
 *
 * Shown once per device on first load after install/deploy.
 * State stored in localStorage so already-installed apps see it on next open.
 * Requests BOTH camera and GPS in a single user interaction to satisfy browser rules.
 */
export function PermissionGate() {
  const [show, setShow] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [cameraState, setCameraState] = useState<PermState>("unknown");
  const [gpsState, setGpsState] = useState<PermState>("unknown");
  const [step, setStep] = useState<"prompt" | "result">("prompt");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(PERMISSIONS_KEY);
    if (!stored) {
      // First time — show after a short delay so main UI loads first
      const t = setTimeout(() => setShow(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify({ dismissed: true, at: Date.now() }));
    setShow(false);
  };

  const requestPermissions = async () => {
    setRequesting(true);
    let camOk: PermState = "unknown";
    let gpsOk: PermState = "unknown";

    // 1. Camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      // Stop immediately — we just needed the prompt
      stream.getTracks().forEach((t) => t.stop());
      camOk = "granted";
    } catch {
      camOk = "denied";
    }

    // 2. GPS
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => { gpsOk = "granted"; resolve(); },
        () => { gpsOk = "denied"; resolve(); },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });

    setCameraState(camOk);
    setGpsState(gpsOk);
    setStep("result");
    setRequesting(false);

    // Persist result so we never prompt again
    localStorage.setItem(
      PERMISSIONS_KEY,
      JSON.stringify({ camera: camOk, gps: gpsOk, grantedAt: Date.now() })
    );
  };

  if (!show) return null;

  const CARD: React.CSSProperties = {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    background: "#fff",
    borderTop: "3px solid #2e7d32",
    borderRadius: "20px 20px 0 0",
    padding: "clamp(1.2rem, 4vw, 2rem)",
    boxShadow: "0 -4px 24px rgba(0,0,0,0.18)",
    fontFamily: '"Montserrat", sans-serif',
    maxWidth: 520,
    margin: "0 auto",
  };

  const BTN: React.CSSProperties = {
    width: "100%",
    padding: "0.9rem",
    background: "#2e7d32",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: "1rem",
    fontWeight: 700,
    cursor: requesting ? "not-allowed" : "pointer",
    opacity: requesting ? 0.7 : 1,
    fontFamily: "inherit",
    marginTop: "1rem",
  };

  const SKIP: React.CSSProperties = {
    width: "100%",
    padding: "0.6rem",
    background: "transparent",
    color: "#888",
    border: "none",
    fontSize: "0.85rem",
    cursor: "pointer",
    fontFamily: "inherit",
    marginTop: "0.4rem",
  };

  const badge = (state: PermState) =>
    state === "granted" ? "✅" : state === "denied" ? "❌" : "⏳";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.4)" }}>
      <div style={CARD}>
        {step === "prompt" ? (
          <>
            <div style={{ fontSize: "2rem", textAlign: "center", marginBottom: "0.5rem" }}>🌾</div>
            <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#1a1a1a", textAlign: "center" }}>
              Enable Farm Features
            </h2>
            <p style={{ color: "#555", fontSize: "0.9rem", textAlign: "center", margin: "0.75rem 0 0.25rem" }}>
              To track your farm with photos and GPS, this app needs:
            </p>
            <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center", margin: "1rem 0", fontSize: "0.9rem", color: "#333" }}>
              <span>📸 Camera</span>
              <span>📍 Location</span>
            </div>
            <p style={{ color: "#888", fontSize: "0.75rem", textAlign: "center", margin: 0 }}>
              You only need to allow this once. Your data stays private.
            </p>
            <button style={BTN} onClick={requestPermissions} disabled={requesting}>
              {requesting ? "Requesting…" : "✅ Allow Camera & Location"}
            </button>
            <button style={SKIP} onClick={dismiss}>Not now</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: "2rem", textAlign: "center", marginBottom: "0.5rem" }}>
              {cameraState === "granted" && gpsState === "granted" ? "🎉" : "⚠️"}
            </div>
            <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, textAlign: "center", color: "#1a1a1a" }}>
              {cameraState === "granted" && gpsState === "granted"
                ? "All set! You can now track your farm."
                : "Some permissions were not granted"}
            </h2>
            <div style={{ margin: "1rem 0", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0.8rem", background: "#f5f5f5", borderRadius: 8 }}>
                <span>📸 Camera</span>
                <span>{badge(cameraState)} {cameraState}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.6rem 0.8rem", background: "#f5f5f5", borderRadius: 8 }}>
                <span>📍 Location</span>
                <span>{badge(gpsState)} {gpsState}</span>
              </div>
            </div>
            {(cameraState === "denied" || gpsState === "denied") && (
              <p style={{ color: "#c62828", fontSize: "0.8rem", textAlign: "center" }}>
                To enable later: go to your browser/phone Settings → Permissions for this site.
              </p>
            )}
            <button style={BTN} onClick={dismiss}>Continue to App →</button>
          </>
        )}
      </div>
    </div>
  );
}
