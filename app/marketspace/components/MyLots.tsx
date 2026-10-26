"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { EditListingTerms } from "../../components/lots/EditListingTerms";
import { VendSheet, type MyLot } from "../../components/lots/VendSheet";
import { ugandaDateFromInstant } from "../../../convex/exportMarketsShared";
import { QuestionsSheet } from "./Questions";
import { FONT, formatUGX } from "./shared";
import { PACKAGED_COMMIT_PERCENT, isPackagedPlan, packagesText } from "../../../convex/lotOrdersShared";
import { formatUgandaDateTime } from "../../utils/timeUtils";
import { GoodsQr } from "../../components/qr/GoodsQr";
import { CommercialProfileSheet, commercialStatusText } from "./CommercialProfile";

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
  const [questionsFor, setQuestionsFor] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));
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
      {info.commercialStatus && (
        <div style={{ padding: "0.7rem 0.8rem", borderRadius: 12, background: info.commercialStatus === "verified" ? "#e8f5e9" : "#fff8e1", border: `1px solid ${info.commercialStatus === "verified" ? "#a5d6a7" : "#ffe082"}` }}>
          <div style={{ fontSize: "0.88rem", color: "#333" }}>{commercialStatusText(info.commercialStatus)}</div>
          <button type="button" onClick={() => setProfileOpen(true)} style={{ ...button(info.commercialStatus === "none" || info.commercialStatus === "rejected" ? "go" : "plain"), marginTop: "0.5rem" }}>
            {info.commercialStatus === "none" ? "Add Commercial Profile" : info.commercialStatus === "rejected" ? "Fix My Profile" : "My Commercial Profile"}
          </button>
        </div>
      )}
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
                {lot.packaged ? (
                  <>
                    {(lot.packagesPerBatch ?? 1) > 1
                      ? `${lot.lotsLeft} batch${lot.lotsLeft === 1 ? "" : "es"} of ${packagesText(lot.packagesPerBatch ?? 1, lot.packageLabel ?? "item")}`
                      : packagesText(lot.lotsLeft, lot.packageLabel ?? "item")}{" "}
                    · {formatUGX(lot.pricePerUnit ?? 0)} per {lot.packageLabel ?? "item"} ·{" "}
                    {isPackagedPlan(lot.milestonePlan, lot.commitPercent ?? PACKAGED_COMMIT_PERCENT) ? "paid in full, no steps" : `buyer pays ${lot.commitPercent}% first`}
                    {lot.takesOffers ? " · takes offers" : ""}
                  </>
                ) : (
                  <>
                    {lot.lotsLeft} lot{lot.lotsLeft === 1 ? "" : "s"} of {lot.unitSize.toLocaleString()} kg · {formatUGX(lot.pricePerKilo)}/kg · buyer pays {lot.commitPercent ?? 100}% first
                  </>
                )}
              </div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: live ? "#2e7d32" : "#777", margin: "0.3rem 0" }}>
                {live
                  ? `🗺️ On MarketSpace until ${formatUgandaDateTime(lot.vendExpiresAt!)}${lot.isBulk ? " · 📦 Local Bulk" : ""}`
                  : lot.vendExpiresAt !== null
                    ? "Its MarketSpace time ran out: refresh to show it again"
                    : "Not on MarketSpace"}
                {lot.farmGate && (
                  <div style={{ fontWeight: 400, color: "#8d5300" }}>🚜 Verified processors and exporters still see it, to buy at the farm gate.</div>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                <button
                  type="button"
                  // Farmers need a commercial profile to put lots on MarketSpace
                  onClick={() => (info.commercialStatus === "none" || info.commercialStatus === "rejected" ? setProfileOpen(true) : setVending(lot))}
                  style={button(live ? "plain" : "go")}
                >
                  {live ? "Change" : "Put on MarketSpace"}
                </button>
                {lot.vendExpiresAt !== null && (
                  <button type="button" disabled={busy === lot.listingId} onClick={() => act(lot.listingId, () => refresh({ sessionToken: token, listingId: lot.listingId }), `${lot.produceType} refreshed for ${lot.vendRefreshDays} days.`)} style={button("plain")}>
                    Refresh
                  </button>
                )}
                <button type="button" onClick={() => setEditing(lot)} style={button("plain")}>✎ Edit terms</button>
                {lot.cardId && (
                  <button type="button" onClick={() => setQuestionsFor(lot.cardId)} style={button(lot.waitingQuestions > 0 ? "warn" : "plain")}>
                    ❓ Questions{lot.waitingQuestions > 0 ? ` (${lot.waitingQuestions} waiting)` : ""}
                  </button>
                )}
                {live && (
                  <button type="button" disabled={busy === lot.listingId} onClick={() => act(lot.listingId, () => stop({ sessionToken: token, listingId: lot.listingId }), `${lot.produceType} is off MarketSpace. It stays in your ledger.`)} style={button("warn")}>
                    Take off
                  </button>
                )}
              </div>
              <GoodsQr goodsCode={lot.goodsCode} sessionToken={token} />
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
      {profileOpen && (
        <CommercialProfileSheet
          token={token}
          onClose={(done) => {
            setProfileOpen(false);
            if (done) setMsg({ ok: true, text: done });
          }}
        />
      )}
      {questionsFor && <QuestionsSheet cardId={questionsFor} token={token} today={today} now={now} onClose={() => setQuestionsFor(null)} />}
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
