"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { FarmCoinIcon } from "../../components/icons/Brand";
import { FONT, useMarketspaceSession } from "./shared";

/**
 * Super admin / Finance admin: the FarmCoin cost of keeping a Marketspace ad
 * up for another 30 days. Shown on the Finance page and the Marketspace admin page.
 */
export function ExtensionCostCard() {
  const { token } = useMarketspaceSession();
  const me = useQuery(api.marketspace.getMyContext, token ? { sessionToken: token } : "skip");
  const setExtensionCost = useMutation(api.marketspace.setExtensionCost);
  const [cost, setCost] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!token || !me?.canSetPrice) return null;

  const save = async () => {
    setMessage(null);
    const value = Number(cost);
    if (cost.trim() === "" || !Number.isInteger(value) || value < 0) {
      setMessage({ ok: false, text: "Enter a whole number of FarmCoin, 0 or more." });
      return;
    }
    try {
      await setExtensionCost({ sessionToken: token, cost: value, reason });
      setMessage({ ok: true, text: `Extension cost set to ${value} FarmCoin per 30 days.` });
      setCost("");
      setReason("");
    } catch (e: any) {
      setMessage({ ok: false, text: e?.message?.replace(/^.*Uncaught Error: /, "").split("\n")[0] ?? "Could not save." });
    }
  };

  return (
    <div style={{ padding: "1.25rem", background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "2rem", fontFamily: FONT }}>
      <h2 style={{ fontSize: "1.15rem", margin: "0 0 0.4rem" }}>Marketspace ad extension</h2>
      <p style={{ margin: "0 0 0.75rem", color: "#555", fontSize: "0.88rem" }}>
        Posting an ad is free for 30 days. This is what an advertiser pays to keep an ad up for another 30 days, or to bring back an expired ad. 0 means extending is free.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "1.1rem", color: "#2e7d32", fontWeight: 700, marginBottom: "0.75rem" }}>
        Current: <FarmCoinIcon size={18} /> {me.extensionCostFarmcoin} FarmCoin per 30 days
      </div>
      <div style={{ display: "grid", gap: "0.6rem", maxWidth: 420 }}>
        <input type="number" min={0} step={1} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="New cost (FarmCoin per 30 days)" style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ddd" }} />
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for change" style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ddd" }} />
        <button type="button" onClick={save} style={{ padding: "0.7rem 1rem", background: "#1976d2", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
          Save extension cost
        </button>
        {message && <div style={{ color: message.ok ? "#1b5e20" : "#c62828", fontWeight: 600, fontSize: "0.88rem" }}>{message.text}</div>}
      </div>
    </div>
  );
}
