"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { COMMERCIAL_DOCUMENTS, commercialProfileProblem, type CommercialDocumentKind } from "../../../convex/commercialFarmersShared";
import { PhotoSetCapture, uploadEvidencePhotos, type CapturedPhoto } from "../../components/exportMarkets/PhotoSetCapture";
import { FONT } from "./shared";

export type CommercialStatus = "none" | "pending" | "verified" | "rejected";

/** One line on where the farmer's commercial profile stands, and what it means for their lots. */
export function commercialStatusText(status: CommercialStatus): string {
  switch (status) {
    case "verified":
      return "✔ Commercial Farmer: everyone on MarketSpace can see your lots.";
    case "pending":
      return "⏳ Farm2Market is checking your document. Vendors and business buyers already see your lots on MarketSpace; visitors will once it is verified.";
    case "rejected":
      return "Your commercial profile was not accepted. Fix it and send it again to show your lots to vendors and visitors.";
    default:
      return "To put lots on MarketSpace, add your commercial profile: your trading name and one document. Without it, verified processors and exporters still see your lots, and you can answer vendors' buying prices.";
  }
}

/**
 * The farmer's commercial profile: a trading name and one commercial
 * document (trading licence, business registration or TIN). Only
 * Farm2Market sees the trading name; MarketSpace shows the alias and a
 * "Commercial Farmer" badge once it is verified.
 */
export function CommercialProfileSheet({ token, onClose }: { token: string; onClose: (message?: string) => void }) {
  const data = useQuery(api.commercialFarmers.myProfile, { sessionToken: token });
  const save = useMutation(api.commercialFarmers.saveProfile);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const [tradingName, setTradingName] = useState("");
  const [kind, setKind] = useState<CommercialDocumentKind>("trading_licence");
  const [number, setNumber] = useState("");
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [filled, setFilled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile = data?.profile ?? null;
  // Start from what the farmer sent before
  useEffect(() => {
    if (filled || !profile) return;
    setTradingName(profile.tradingName);
    if (profile.kind) setKind(profile.kind);
    setNumber(profile.number ?? "");
    setFilled(true);
  }, [profile, filled]);

  const keptPhoto = profile?.kind === kind ? profile.photoUrl : null;
  const doc = COMMERCIAL_DOCUMENTS.find((d) => d.key === kind)!;

  const send = async () => {
    const problem = commercialProfileProblem({ tradingName, kind, number, hasPhoto: photos.length > 0 || !!keptPhoto });
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const [photo] = photos.length > 0 ? await uploadEvidencePhotos(() => generateUploadUrl(), photos) : [];
      await save({ sessionToken: token, tradingName, kind, number: number.trim() || undefined, photo });
      onClose("Commercial profile sent. You can put your lots on MarketSpace now.");
    } catch (e) {
      setError((e as Error).message.replace(/^.*Uncaught Error: /, "").split("\n")[0]);
      setBusy(false);
    }
  };

  const chip = (on: boolean): React.CSSProperties => ({
    minHeight: 44,
    padding: "0 0.9rem",
    borderRadius: 999,
    border: `2px solid ${on ? "#2e7d32" : "#ddd"}`,
    background: on ? "#e8f5e9" : "#fff",
    color: "#222",
    fontWeight: 700,
    fontFamily: FONT,
    cursor: "pointer",
  });
  const input: React.CSSProperties = { width: "100%", minHeight: 46, padding: "0 0.75rem", border: "1.5px solid #ccc", borderRadius: 10, fontSize: "1rem", fontFamily: FONT, boxSizing: "border-box" };
  const label: React.CSSProperties = { display: "block", fontWeight: 700, marginBottom: "0.35rem" };

  return (
    <div role="dialog" aria-modal="true" aria-label="Commercial profile" onClick={() => onClose()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: "1.25rem", maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem", fontFamily: FONT }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "1.15rem" }}>🧑‍🌾 Commercial Profile</h3>
          <button type="button" onClick={() => onClose()} aria-label="Close" style={{ border: "none", background: "#f1f1f1", borderRadius: 999, width: 36, height: 36, cursor: "pointer" }}>✕</button>
        </div>
        {data === undefined ? (
          <p style={{ margin: 0, color: "#777" }}>Loading…</p>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#444" }}>{commercialStatusText(profile?.status ?? "none")}</p>
            {profile?.status === "rejected" && profile.reviewNote && (
              <p style={{ margin: 0, padding: "0.6rem 0.75rem", borderRadius: 10, background: "#ffebee", color: "#c62828", fontWeight: 600 }}>Reason: {profile.reviewNote}</p>
            )}
            <div>
              <label style={label}>Trading Name</label>
              <input value={tradingName} onChange={(e) => setTradingName(e.target.value)} maxLength={80} placeholder="The name on your document" style={input} />
              <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.3rem" }}>🔒 Only Farm2Market sees it. MarketSpace shows your alias.</div>
            </div>
            <div>
              <label style={label}>Your Document</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                {COMMERCIAL_DOCUMENTS.map((d) => (
                  <button key={d.key} type="button" onClick={() => { setKind(d.key); setPhotos([]); }} style={chip(kind === d.key)}>
                    {d.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.35rem" }}>{doc.hint}</div>
            </div>
            <div>
              <label style={label}>{kind === "tin" ? "TIN" : "Number on the document (if any)"}</label>
              <input value={number} onChange={(e) => setNumber(e.target.value)} inputMode={kind === "tin" ? "numeric" : "text"} maxLength={40} style={input} />
            </div>
            <div>
              <label style={label}>{kind === "tin" ? "Photo of your TIN certificate (helps us check)" : `Photo of your ${doc.label.toLowerCase()}`}</label>
              {keptPhoto && photos.length === 0 && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={keptPhoto} alt="Your document" style={{ width: 160, height: 120, objectFit: "cover", borderRadius: 8, display: "block", marginBottom: "0.5rem" }} />
              )}
              <PhotoSetCapture photos={photos} onChange={setPhotos} max={1} />
            </div>
            {error && <div style={{ color: "#c62828", fontWeight: 600 }}>{error}</div>}
            <button type="button" onClick={send} disabled={busy} style={{ minHeight: 50, borderRadius: 12, border: "none", background: busy ? "#ccc" : "#2e7d32", color: "#fff", fontWeight: 800, fontSize: "1rem", fontFamily: FONT, cursor: busy ? "not-allowed" : "pointer" }}>
              {busy ? "Sending…" : profile ? "Send Again" : "Send for Checking"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
