"use client";

import { useEffect } from "react";

const RELOAD_GUARD_KEY = "f2m_chunk_reload_guard";

function isChunkLoadError(message: unknown): boolean {
  if (typeof message !== "string") return false;
  return (
    message.includes("ChunkLoadError") ||
    message.includes("Loading chunk") ||
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed")
  );
}

/**
 * This app is installed as a PWA (next-pwa/Workbox service worker) and also
 * wrapped as a mobile APK pointed at the live site. After a new deploy, an
 * already-installed app can be left holding a stale cached page shell that
 * references JS chunk files no longer served by the server, which throws a
 * ChunkLoadError the user sees as a generic "Application error: a
 * client-side exception has occurred" — reproducible on the installed app
 * but not a fresh browser tab (which has no stale cache to hit).
 *
 * This recovers automatically: on the first such error, do one hard reload
 * (bypassing this run's stale cache) instead of leaving the user stuck.
 * A sessionStorage guard prevents a reload loop if the error persists.
 */
export function ChunkErrorRecovery() {
  useEffect(() => {
    const recover = () => {
      try {
        if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return;
        sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
      } catch {
        // sessionStorage unavailable — still attempt one reload
      }
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.message) || isChunkLoadError(event.error?.message)) {
        recover();
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = typeof reason === "string" ? reason : reason?.message;
      if (isChunkLoadError(message)) {
        recover();
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    // If the app is still running fine a few seconds after mount, clear the
    // guard so a *later* genuine chunk error (e.g. after the next deploy)
    // can still trigger one more automatic recovery this session.
    const clearGuardTimer = setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_GUARD_KEY);
      } catch {
        // ignore
      }
    }, 10000);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      clearTimeout(clearGuardTimer);
    };
  }, []);

  return null;
}
