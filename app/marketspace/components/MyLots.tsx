"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { EditListingTerms } from "../../components/lots/EditListingTerms";
import { VendSheet, type MyLot } from "../../components/lots/VendSheet";
import { FONT, formatUGX } from "./shared";
import { formatUgandaDateTime } from "../../utils/timeUtils";

const SELLER_ROLES = ["farmer", "vendor", "store", "trader"];

/**
 * The seller's lot listings: put them on MarketSpace, keep them up, take
 * them off, and edit their payment steps (every poster can, bulk included).
 */
export function MyLots({ token, now }: { token: string; now: number }) {
  const info = useQuery(api.marketspace.myLots, { sessionToken: token });
  const refresh = useMutation(api.marketspace.refreshVend);
  const stop = useMutation(api.marketspace.stopVend);
  const [vending, setVending] = useState<MyLot | null>(null);
  const [editing, setEditing] = useState<MyLot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (info === undefined) return <p style={{ color: "#999" }}>Loading your lots...</p>;
  if (info === null || !SELLER_ROLES.includes(info.role)) return null;

  const act = async (listingId: string, run: () => Promise<unknown>, done: string) => {
    setBusy(listingId);
    setMsg(null);
    try {
      await run();
      setMsg({ ok: true, text: done });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };
  const button = (tone: "go" | "plain" | "warn"): React.CSSProperties => ({
    minHeight: 40,
    padding: "0 0.8rem",
    borderRadius: 8,
    border: tone === "plain" ? "1px solid #ddd" : "none",
    background: tone === "go" ? "#2e7d32" : tone === "warn" ? "#fff3e0" : "#fff",
    color: tone === "go" ? "#fff" : tone === "warn" ? "#e65100" : "#333",
    fontWeight: 700,
    fontFamily: FONT,
    cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {msg && <div style={{ fontWeight: 600, color: msg.ok ? "#2e7d32" : "#c62828" }}>{msg.text}</div>}
      {info.lots.length === 0 ? (
        <p style={{ margin: 0, color: "#666" }}>
          You have no lots for sale. <Link href="/farmer/farm2market" style={{ color: "#1b5e20", fontWeight: 700 }}>Create a lot listing →</Link>
        </p>
      ) : (
        info.lots.map((lot) => {
          const live = lot.vendExpiresAt !== null && lot.vendExpiresAt > now;
          return (
            <div key={lot.listingId} style={{ padding: "0.75rem", borderRadius: 12, border: `2px solid ${live ? "#a5d6a7" : "#e0e0e0"}`, background: "#fff" }}>
              <div style={{ fontWeight: 800 }}>
                {lot.produceType}
                {lot.stockSource && lot.stockSource !== "own_farm" && (
                  <span style={{ marginLeft: "0.4rem", padding: "0.1rem 0.5rem", borderRadius: 999, fontSize: "0.72rem", background: lot.stockSource === "in_app" ? "#e8f5e9" : "#f1f3f0", color: lot.stockSource === "in_app" ? "#1b5e20" : "#555" }}>
                    {lot.stockSource === "in_app" ? "Traced (bought in the app)" : "Off-app stock"}
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#555" }}>
                {lot.lotsLeft} lot{lot.lotsLeft === 1 ? "" : "s"} of {lot.unitSize.toLocaleString()} kg · {formatUGX(lot.pricePerKilo)}/kg · buyer pays {lot.commitPercent ?? 100}% first
              </div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: live ? "#2e7d32" : "#777", margin: "0.3rem 0" }}>
                {live
                  ? `🗺️ On MarketSpace until ${formatUgandaDateTime(lot.vendExpiresAt!)}${lot.isBulk ? " · 📦 Local Bulk" : ""}`
                  : lot.vendExpiresAt !== null
                    ? "Its MarketSpace time ran out: refresh to show it again"
                    : "Not on MarketSpace"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                <button type="button" onClick={() => setVending(lot)} style={button(live ? "plain" : "go")}>
                  {live ? "Change" : "Put on MarketSpace"}
                </button>
                {lot.vendExpiresAt !== null && (
                  <button type="button" disabled={busy === lot.listingId} onClick={() => act(lot.listingId, () => refresh({ sessionToken: token, listingId: lot.listingId }), `${lot.produceType} refreshed for ${lot.vendRefreshDays} days.`)} style={button("plain")}>
                    Refresh
                  </button>
                )}
                <button type="button" onClick={() => setEditing(lot)} style={button("plain")}>✎ Edit terms</button>
                {live && (
                  <button type="button" disabled={busy === lot.listingId} onClick={() => act(lot.listingId, () => stop({ sessionToken: token, listingId: lot.listingId }), `${lot.produceType} is off MarketSpace. It stays in your ledger.`)} style={button("warn")}>
                    Take off
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}

      {vending && (
        <VendSheet
          token={token}
          lot={vending}
          info={info}
          onClose={(text) => {
            setVending(null);
            if (text) setMsg({ ok: true, text });
          }}
        />
      )}
      {editing && (
        <EditListingTerms
          sellerId={info.userId}
          sellerRole={info.role}
          listing={editing}
          onClose={(text) => {
            setEditing(null);
            if (text) setMsg({ ok: true, text });
          }}
        />
      )}
    </div>
  );
}
