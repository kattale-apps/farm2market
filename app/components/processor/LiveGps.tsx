"use client";

import { useEffect, useState } from "react";
import { watchLocation, GpsPosition } from "../../utils/gps";
import { FONT, button } from "../exportMarkets/ui";

type Fix = GpsPosition & { at: number };

/**
 * Live GPS reading that follows the phone as it moves. Refresh restarts the
 * reading; "use" copies the current fix into the form.
 */
export function LiveGps({ enabled, onUse, useLabel }: { enabled: boolean; onUse: (lat: string, lng: string) => void; useLabel: string }) {
  const [running, setRunning] = useState(false);
  const [session, setSession] = useState(0);
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Live from the moment the form can use it.
  useEffect(() => {
    if (enabled) setRunning(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !running) return;
    setError(null);
    return watchLocation(
      (f) => {
        setFix(f);
        setError(null);
      },
      (m) => setError(m)
    );
  }, [enabled, running, session]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const age = fix ? Math.max(0, Math.round((now - fix.at) / 1000)) : null;
  const live = running && fix && !error && age !== null && age < 30;

  return (
    <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, padding: "0.7rem", fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.85rem", fontWeight: 700 }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: live ? "#2e7d32" : running ? "#f9a825" : "#b0bec5", boxShadow: live ? "0 0 0 4px rgba(46,125,50,0.2)" : "none" }} />
        {!running ? "Live GPS is off" : error ? error : !fix ? "Finding your location..." : live ? "Live GPS" : "Waiting for a new reading..."}
      </div>
      {fix && (
        <div style={{ fontSize: "0.85rem", marginTop: "0.4rem", color: "#263238", lineHeight: 1.6 }}>
          <b>{fix.latitude.toFixed(6)}, {fix.longitude.toFixed(6)}</b>
          <span style={{ color: "#607d8b" }}>
            {" "}· accurate to about {Math.round(fix.accuracy)} m · updated {age === 0 ? "just now" : `${age}s ago`}
          </span>
        </div>
      )}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
        {!running ? (
          <button type="button" style={button("secondary", !enabled)} disabled={!enabled} onClick={() => setRunning(true)}>
            📍 Start live GPS
          </button>
        ) : (
          <>
            <button
              type="button"
              style={button("secondary")}
              onClick={() => {
                setFix(null);
                setSession((s) => s + 1);
              }}
            >
              🔄 Refresh
            </button>
            <button type="button" style={button("secondary")} onClick={() => setRunning(false)}>
              Stop
            </button>
          </>
        )}
        {fix && (
          <button type="button" style={button("primary", !enabled)} disabled={!enabled} onClick={() => onUse(fix.latitude.toFixed(6), fix.longitude.toFixed(6))}>
            {useLabel}
          </button>
        )}
      </div>
    </div>
  );
}
