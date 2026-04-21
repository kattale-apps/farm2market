"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const REWARD_VIDEO_SRC = "/videos/COIN-2-SOIL.mp4";
const GOLD = "#f9a825";
const FONT = '"Montserrat", sans-serif';

// ── Preloader: mounts a hidden video element to prime the browser cache ──────
// Render this once early in any page that might show the reward animation.
export function FarmCoinVideoPreloader() {
  return (
    <video
      src={REWARD_VIDEO_SRC}
      preload="auto"
      muted
      playsInline
      style={{ display: "none", position: "absolute", pointerEvents: "none" }}
      aria-hidden="true"
    />
  );
}

// ── Video overlay (primary) ───────────────────────────────────────────────────
export function FarmCoinRewardVideo({
  coinsEarned,
  onDone,
  onFallback,
}: {
  coinsEarned: number;
  onDone: () => void;
  onFallback: () => void;
}) {
  const [showContinue, setShowContinue] = useState(false);
  const [needsUserStart, setNeedsUserStart] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const tryPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
      setNeedsUserStart(false);
    } catch {
      setNeedsUserStart(true);
    }
  }, []);

  useEffect(() => {
    // Small rAF delay ensures the overlay is painted before play() is called,
    // which gives smoother first-frame rendering.
    const raf = requestAnimationFrame(() => { tryPlay(); });
    return () => cancelAnimationFrame(raf);
  }, [tryPlay]);

  // Safety: always show Continue after 12 s in case playback stalls
  useEffect(() => {
    const t = setTimeout(() => setShowContinue(true), 12000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.87)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={() => showContinue && onDone()}
    >
      <div style={{ width: "100%", maxWidth: 540, textAlign: "center", color: "#fff", fontFamily: FONT }}>
        <video
          ref={videoRef}
          src={REWARD_VIDEO_SRC}
          playsInline
          preload="auto"
          onEnded={onDone}
          onError={onFallback}
          style={{
            width: "100%",
            borderRadius: 14,
            boxShadow: "0 8px 28px rgba(0,0,0,0.55)",
            background: "#000",
            display: "block",
          }}
        />
        {needsUserStart && (
          <button
            onClick={(e) => { e.stopPropagation(); tryPlay(); }}
            style={{
              marginTop: "0.7rem",
              padding: "0.7rem 1.8rem",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            ▶ Play with sound
          </button>
        )}
        <p style={{ margin: "0.75rem 0 0", fontSize: "1.2rem", fontWeight: 700, color: GOLD }}>
          +{coinsEarned} FarmCoin{coinsEarned !== 1 ? "s" : ""}
        </p>
        {showContinue && (
          <button
            onClick={onDone}
            style={{
              marginTop: "0.6rem",
              padding: "0.7rem 1.8rem",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #43a047, #2e7d32)",
              color: "#fff",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

// ── CSS coin-plant fallback animation ─────────────────────────────────────────
export function CoinPlantAnimation({
  coinsEarned,
  onDone,
}: {
  coinsEarned: number;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState(0);
  const [coinsFallen, setCoinsFallen] = useState(0);

  useEffect(() => {
    const t0 = setTimeout(() => setPhase(1), 600);
    const coinTimers: ReturnType<typeof setTimeout>[] = [];
    const cap = Math.min(coinsEarned, 12);
    for (let i = 0; i < cap; i++) {
      coinTimers.push(setTimeout(() => setCoinsFallen((p) => p + 1), 800 + i * 250));
    }
    const totalCoinTime = 800 + cap * 250 + 400;
    const t2 = setTimeout(() => setPhase(2), totalCoinTime);
    const t3 = setTimeout(() => setPhase(3), totalCoinTime + 800);
    const t4 = setTimeout(() => setPhase(4), totalCoinTime + 1600);
    return () => {
      clearTimeout(t0);
      coinTimers.forEach(clearTimeout);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [coinsEarned]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.87)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
      }}
    >
      <div style={{ position: "relative", width: 220, height: 220, marginBottom: 24 }}>
        {/* Soil mound */}
        <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 180, height: 70, borderRadius: "50%", background: "radial-gradient(ellipse at center, #5d4037 0%, #3e2723 100%)", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }} />
        <div style={{ position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)", width: 140, height: 40, borderRadius: "50%", background: "radial-gradient(ellipse at center, #795548 0%, #4e342e 100%)" }} />
        {/* Coins */}
        {Array.from({ length: Math.min(coinsFallen, 12) }).map((_, i) => (
          <div key={i} style={{ position: "absolute", bottom: 40 + (i % 3) * 8, left: 60 + (i % 5) * 22, fontSize: "1.6rem", animation: "fcaCoinDrop 0.5s ease-in forwards", filter: "drop-shadow(0 0 6px rgba(249,168,37,0.8))" }}>
            🪙
          </div>
        ))}
        {/* Sprout */}
        {phase >= 2 && (
          <div style={{ position: "absolute", bottom: 55, left: "50%", transform: "translateX(-50%)", fontSize: phase >= 3 ? "3rem" : "1.8rem", transition: "font-size 0.8s cubic-bezier(.34,1.56,.64,1)", filter: "drop-shadow(0 0 8px rgba(46,125,50,0.6))" }}>
            {phase >= 3 ? "🌱" : "🌿"}
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", color: "#fff" }}>
        {phase < 1 && <p style={{ fontSize: "1.1rem", fontWeight: 600, opacity: 0.8 }}>Preparing soil...</p>}
        {phase >= 1 && phase < 4 && <p style={{ fontSize: "1.1rem", fontWeight: 600, color: GOLD }}>Planting your FarmCoins...</p>}
        {phase >= 4 && (
          <div style={{ animation: "fcaFadeUp 0.5s ease-out" }}>
            <p style={{ fontSize: "2rem", fontWeight: 800, color: GOLD, margin: "0 0 4px 0" }}>
              🪙 +{coinsEarned} FarmCoin{coinsEarned !== 1 ? "s" : ""}!
            </p>
            <p style={{ fontSize: "0.95rem", color: "#a5d6a7", margin: "0 0 24px 0" }}>
              Your compliance investment is growing 🌱
            </p>
            <button
              onClick={onDone}
              style={{ padding: "14px 48px", background: "linear-gradient(135deg, #43a047, #2e7d32)", color: "#fff", border: "none", borderRadius: 14, fontSize: "1.1rem", fontWeight: 700, cursor: "pointer", fontFamily: FONT, boxShadow: "0 4px 16px rgba(46,125,50,0.4)" }}
            >
              ✓ Continue
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fcaCoinDrop {
          0%   { transform: translateY(-120px) rotate(0deg);   opacity: 0; }
          60%  { opacity: 1; }
          100% { transform: translateY(0)     rotate(360deg); opacity: 1; }
        }
        @keyframes fcaFadeUp {
          0%   { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Composite: try video, fall back to CSS animation ─────────────────────────
export function FarmCoinReward({
  coinsEarned,
  onDone,
}: {
  coinsEarned: number;
  onDone: () => void;
}) {
  const [useFallback, setUseFallback] = useState(false);

  if (useFallback) {
    return <CoinPlantAnimation coinsEarned={coinsEarned} onDone={onDone} />;
  }
  return (
    <FarmCoinRewardVideo
      coinsEarned={coinsEarned}
      onDone={onDone}
      onFallback={() => setUseFallback(true)}
    />
  );
}
