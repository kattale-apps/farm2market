"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { FONT, formatDate } from "./shared";

const errorText = (e: unknown) => ((e as Error)?.message ?? "Something went wrong.").replace(/^.*Uncaught Error: /, "").split("\n")[0];

/**
 * Super admin: check farmers' and vendors' commercial documents. A verified farmer's lots
 * show to everyone on MarketSpace with the Commercial Farmer badge; a verified
 * vendor is verified (can buy lots) and shows the Verified Vendor badge; a
 * rejected one is told why (preset reasons) and can send it again.
 */
export function CommercialReview({ token }: { token: string }) {
  const queue = useQuery(api.commercialFarmers.reviewQueue, { sessionToken: token });
  const review = useMutation(api.commercialFarmers.review);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (queue === undefined) return <p>Loading…</p>;

  const decide = async (profileId: Id<"commercialProfiles">, decision: "verified" | "rejected", reason?: string) => {
    setBusy(profileId);
    setMessage(null);
    try {
      await review({ sessionToken: token, profileId, decision, reason });
      setMessage({ ok: true, text: decision === "verified" ? "Verified. They were told." : "Not accepted. They were told why." });
      setRejecting(null);
    } catch (e) {
      setMessage({ ok: false, text: errorText(e) });
    } finally {
      setBusy(null);
    }
  };
  const button = (tone: "go" | "warn" | "plain"): React.CSSProperties => ({
    minHeight: 40,
    padding: "0 0.9rem",
    borderRadius: 10,
    border: tone === "plain" ? "1.5px solid #ccc" : "none",
    background: tone === "go" ? "#2e7d32" : tone === "warn" ? "#c62828" : "#fff",
    color: tone === "plain" ? "#333" : "#fff",
    fontWeight: 800,
    fontFamily: FONT,
    cursor: "pointer",
  });

  return (
    <div>
      {message && (
        <div style={{ marginBottom: "0.75rem", padding: "0.6rem 0.75rem", borderRadius: 10, background: message.ok ? "#e8f5e9" : "#ffebee", color: message.ok ? "#1b5e20" : "#c62828", fontWeight: 600 }}>
          {message.text}
        </div>
      )}
      <p style={{ marginTop: 0, color: "#555", fontSize: "0.9rem" }}>
        Farmers need a commercial profile to put lots on MarketSpace. Vendors send one to be verified: verifying it lets them buy lots and gives their posts the Verified Vendor badge. Check that the name matches the document. The name is never shown on MarketSpace.
      </p>
      <h2 style={{ fontSize: "1.05rem" }}>Waiting to be checked ({queue.waiting.length})</h2>
      {queue.waiting.length === 0 && <p style={{ color: "#666" }}>Nothing waiting.</p>}
      <div style={{ display: "grid", gap: "0.9rem" }}>
        {queue.waiting.map((p) => (
          <div key={p.profileId} style={{ display: "grid", gridTemplateColumns: "minmax(0, 180px) 1fr", gap: "0.9rem", background: "#fff", borderRadius: 14, padding: "0.8rem", border: "1.5px solid #ffe082" }}>
            {p.photoUrl ? (
              <a href={p.photoUrl} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.photoUrl} alt={`${p.document} of ${p.tradingName}`} style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 10 }} />
              </a>
            ) : (
              <div style={{ height: 140, borderRadius: 10, background: "#f3f4f6", display: "grid", placeItems: "center", color: "#888", fontSize: "0.85rem" }}>No photo</div>
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>{p.tradingName}</div>
              <div style={{ fontSize: "0.88rem", color: "#444", margin: "0.2rem 0 0.6rem" }}>
                {p.document}
                {p.number ? ` · ${p.number}` : ""} · {p.seller} · {p.district ?? "District not set"} · sent {formatDate(p.updatedAt)}
              </div>
              {rejecting === p.profileId ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {queue.rejectReasons.map((r) => (
                    <button key={r} type="button" disabled={busy === p.profileId} onClick={() => decide(p.profileId, "rejected", r)} style={button("warn")}>
                      {r}
                    </button>
                  ))}
                  <button type="button" onClick={() => setRejecting(null)} style={button("plain")}>
                    Back
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  <button type="button" disabled={busy === p.profileId} onClick={() => decide(p.profileId, "verified")} style={button("go")}>
                    ✔ Verify
                  </button>
                  <button type="button" disabled={busy === p.profileId} onClick={() => setRejecting(p.profileId)} style={button("plain")}>
                    Not Accepted…
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: "1.05rem", marginTop: "1.5rem" }}>Latest decisions</h2>
      {queue.decided.length === 0 && <p style={{ color: "#666" }}>None yet.</p>}
      <ul style={{ paddingLeft: "1.1rem", fontSize: "0.9rem" }}>
        {queue.decided.map((p) => (
          <li key={p.profileId} style={{ marginBottom: "0.3rem" }}>
            <strong>{p.tradingName}</strong> · {p.seller} · {p.status === "verified" ? "✔ verified" : `not accepted (${p.reviewNote})`} · {formatDate(p.updatedAt)}
          </li>
        ))}
      </ul>
    </div>
  );
}
