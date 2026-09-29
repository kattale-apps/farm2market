"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { REPORT_REASONS } from "../../../convex/marketspaceShared";
import { FONT, SAFETY_NOTICE, whatsappLink, type AdCardData } from "./shared";

/** A bottom sheet on phones, a centred dialog on wider screens. */
export function Sheet({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "92vh",
          overflowY: "auto",
          background: "#fff",
          borderRadius: "18px 18px 0 0",
          padding: "1rem 1rem 1.4rem",
          boxSizing: "border-box",
          fontFamily: FONT,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: "none", background: "#f1f1f1", borderRadius: 999, width: 36, height: 36, fontSize: "1.1rem", cursor: "pointer" }}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SafetyNotice() {
  return (
    <div style={{ background: "#fff8e1", border: "1px solid #f6bf26", borderRadius: 10, padding: "0.6rem 0.75rem", fontSize: "0.88rem", fontWeight: 700, color: "#6d4c00" }}>
      ⚠️ {SAFETY_NOTICE}
    </div>
  );
}

const actionStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.5rem",
  minHeight: 52,
  borderRadius: 12,
  fontWeight: 800,
  fontSize: "1rem",
  textDecoration: "none",
  fontFamily: FONT,
};

/** Call or WhatsApp the advertiser, with the safety notice above. */
export function ContactSheet({ ad, onClose }: { ad: AdCardData; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} title={ad.kind === "wanted" ? "Offer to supply" : "Contact advertiser"}>
      <p style={{ margin: "0 0 0.75rem", color: "#444", fontSize: "0.9rem" }}>
        {ad.kind === "wanted" ? "Looking for: " : ""}
        <strong>{ad.title}</strong> · 📍 {ad.district}
      </p>
      <SafetyNotice />
      <div style={{ display: "grid", gap: "0.6rem", marginTop: "0.9rem" }}>
        <a href={`tel:${ad.contactPhone}`} style={{ ...actionStyle, background: "#2e7d32", color: "#fff" }}>
          📞 Call {ad.contactPhone}
        </a>
        <a href={whatsappLink(ad)} target="_blank" rel="noopener noreferrer" style={{ ...actionStyle, background: "#25d366", color: "#fff" }}>
          💬 WhatsApp
        </a>
      </div>
    </Sheet>
  );
}

export function ReportSheet({ ad, sessionToken, onClose }: { ad: AdCardData; sessionToken: string | null; onClose: () => void }) {
  const reportAd = useMutation(api.marketspace.reportAd);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]["value"]>("scam");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | string>("idle");

  const submit = async () => {
    setState("sending");
    try {
      await reportAd({ adId: ad._id as Id<"marketspaceAds">, reason, details: details.trim() || undefined, sessionToken: sessionToken ?? undefined });
      setState("done");
    } catch (e: any) {
      setState(e?.message ?? "Could not send the report.");
    }
  };

  return (
    <Sheet onClose={onClose} title="Report this ad">
      {state === "done" ? (
        <div style={{ textAlign: "center", padding: "1rem 0" }}>
          <div style={{ fontSize: "2rem" }}>✅</div>
          <p style={{ fontWeight: 700 }}>Thank you. An admin will review this ad.</p>
          <button type="button" onClick={onClose} style={{ ...actionStyle, width: "100%", border: "none", background: "#2e7d32", color: "#fff", cursor: "pointer" }}>
            Close
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {REPORT_REASONS.map((r) => (
            <label key={r.value} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.55rem 0.7rem", border: `1.5px solid ${reason === r.value ? "#c62828" : "#ddd"}`, borderRadius: 10, cursor: "pointer" }}>
              <input type="radio" name="report-reason" checked={reason === r.value} onChange={() => setReason(r.value)} />
              {r.label}
            </label>
          ))}
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={500}
            placeholder="Anything else admins should know? (optional)"
            rows={3}
            style={{ padding: "0.6rem", borderRadius: 10, border: "1px solid #ddd", fontFamily: FONT, fontSize: "0.9rem" }}
          />
          {state !== "idle" && state !== "sending" && <div style={{ color: "#c62828", fontSize: "0.85rem" }}>{state}</div>}
          <button
            type="button"
            disabled={state === "sending"}
            onClick={submit}
            style={{ ...actionStyle, border: "none", background: "#c62828", color: "#fff", cursor: "pointer", opacity: state === "sending" ? 0.6 : 1 }}
          >
            {state === "sending" ? "Sending…" : "Send report"}
          </button>
        </div>
      )}
    </Sheet>
  );
}
