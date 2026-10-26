"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ugandaDateFromInstant } from "../../../convex/exportMarketsShared";
import { commitAmount } from "../../../convex/lotOrdersShared";

const formatUGX = (n: number) => `UGX ${Math.round(n).toLocaleString()}`;

/** A Convex error's readable message (ConvexError data first). */
function errorMessage(e: unknown): { text: string; needsTopUp: boolean } {
  const data = (e as { data?: { message?: string; code?: string } })?.data;
  if (data?.message) return { text: data.message, needsTopUp: data.code === "INSUFFICIENT_WALLET_BALANCE" };
  return { text: (e as Error)?.message ?? "Something went wrong", needsTopUp: false };
}

/**
 * Lots for sale from farmers, vendors and processors, for verified
 * processors, vendors and business buyers (exporters use their own
 * screen). Buy at the posted price or make an offer; either way the buyer
 * commits the seller's share into escrow and the rest follows the seller's
 * steps.
 */
export function LotMarket({ userId }: { userId: Id<"users"> }) {
  const [today] = useState(() => ugandaDateFromInstant(Date.now()));
  const market = useQuery(api.lotOrders.marketLots, { userId, today });
  const accepted = useQuery(api.negotiations.getAcceptedNegotiations, market?.eligible ? { traderId: userId } : "skip");
  const commit = useMutation(api.lotOrders.commit);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; topUp?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (market === undefined) return <p style={{ color: "#999" }}>Loading lots for sale...</p>;
  if (!market.eligible) {
    return (
      <div style={{ padding: "0.9rem", borderRadius: 10, background: "#fff8e1", border: "1px solid #ffe082", color: "#6d4c00" }}>
        {market.reason}
      </div>
    );
  }

  const commitAccepted = async (unitId: Id<"listingUnits">) => {
    setBusy(unitId);
    setMsg(null);
    try {
      const r = await commit({ buyerId: userId, unitIds: [unitId] });
      setMsg({ ok: true, text: `Committed ${formatUGX(r.committedTotal)} into escrow. Follow the steps in "My lot orders".` });
    } catch (e) {
      const { text, needsTopUp } = errorMessage(e);
      setMsg({ ok: false, text, topUp: needsTopUp });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {msg && (
        <div style={{ fontWeight: 600, color: msg.ok ? "#2e7d32" : "#c62828" }}>
          {msg.text} {msg.topUp && <a href="/wallet" style={{ color: "#c62828" }}>Top up →</a>}
        </div>
      )}

      {(accepted?.negotiations?.length ?? 0) > 0 && (
        <div style={{ padding: "0.75rem", borderRadius: 10, background: "#e8f5e9", border: "1px solid #a5d6a7" }}>
          <div style={{ fontWeight: 700, marginBottom: "0.4rem" }}>Offers the seller accepted</div>
          {accepted!.negotiations.map((n: any) => (
            <div key={n.negotiationId} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", padding: "0.3rem 0" }}>
              <span>{n.produceType} · {n.unitSize} kg at {formatUGX(n.finalPricePerKilo)}/kg</span>
              <button type="button" disabled={busy === n.unitId} onClick={() => commitAccepted(n.unitId)} style={{ minHeight: 40, padding: "0 0.9rem", borderRadius: 8, border: "none", background: "#2e7d32", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                Commit {n.commitPercent ?? 100}% ({formatUGX(commitAmount(n.totalPrice, n.commitPercent ?? 100))})
              </button>
            </div>
          ))}
        </div>
      )}

      {market.lots.length === 0 ? (
        <p style={{ color: "#666", margin: 0 }}>No lots for sale right now.</p>
      ) : (
        market.lots.map((lot) => <LotCard key={lot.listingId} lot={lot} userId={userId} onMessage={setMsg} />)
      )}
    </div>
  );
}

type Lot = NonNullable<ReturnType<typeof useMarket>>["lots"][number];
function useMarket(userId: Id<"users">, today: string) {
  return useQuery(api.lotOrders.marketLots, { userId, today });
}

function LotCard({ lot, userId, onMessage }: { lot: Lot; userId: Id<"users">; onMessage: (m: { ok: boolean; text: string; topUp?: boolean }) => void }) {
  const commit = useMutation(api.lotOrders.commit);
  const makeOffer = useMutation(api.negotiations.makeOffer);
  const [count, setCount] = useState("1");
  const [offering, setOffering] = useState(false);
  const [offerPrice, setOfferPrice] = useState(String(lot.pricePerKilo));
  const [busy, setBusy] = useState(false);

  const free = lot.freeUnitIds.length;
  const n = Math.min(free, Math.max(1, parseInt(count, 10) || 1));
  const lotPrice = Math.round(lot.pricePerKilo * lot.lotKg);
  const commitNow = commitAmount(lotPrice, lot.commitPercent) * n;

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    try {
      onMessage({ ok: true, text: await action() });
      setOffering(false);
    } catch (e) {
      const { text, needsTopUp } = errorMessage(e);
      onMessage({ ok: false, text, topUp: needsTopUp });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: "1px solid #e0e0e0", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
      {lot.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={lot.photoUrl} alt={lot.produceType} style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
      )}
      <div style={{ padding: "0.85rem", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
          <strong style={{ fontSize: "1.05rem" }}>{lot.produceType}</strong>
          {lot.stockSource && (
            <span style={{ padding: "0.15rem 0.55rem", borderRadius: 999, fontSize: "0.72rem", fontWeight: 700, background: lot.stockSource === "off_app" ? "#fff3e0" : "#e8f5e9", color: lot.stockSource === "off_app" ? "#e65100" : "#1b5e20" }}>
              {lot.stockSource === "own_farm" ? "From the farm" : lot.stockSource === "in_app" ? "Traced" : "Off-app stock"}
            </span>
          )}
        </div>
        <div style={{ fontSize: "0.85rem", color: "#666" }}>{lot.sellerLabel}{lot.qualityRating ? ` · ${lot.qualityRating}` : ""}</div>
        <div style={{ fontSize: "0.92rem", color: "#333" }}>
          {lot.lotsAvailable} lot{lot.lotsAvailable === 1 ? "" : "s"} of {lot.lotKg.toLocaleString()} kg
          {lot.bagKg ? ` (${lot.bagsPerLot ?? 1} × ${lot.bagKg} kg bags)` : ""} · {formatUGX(lot.pricePerKilo)}/kg · {formatUGX(lotPrice)} a lot
        </div>
        <div style={{ fontSize: "0.85rem", color: "#555" }}>
          You commit {lot.commitPercent}% now; the rest is charged at: {lot.steps.filter((s) => !s.handover && s.payPercent > 0).map((s) => s.name).join(", ") || "collection"}.
        </div>

        {free === 0 ? (
          <div style={{ fontSize: "0.85rem", color: "#8d6e00" }}>Every free lot has an offer waiting for the seller.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <label style={{ fontSize: "0.85rem", color: "#333" }}>
              Lots{" "}
              <input type="number" inputMode="numeric" min={1} max={free} value={count} onChange={(e) => setCount(e.target.value)} style={{ width: 64, padding: "0.45rem", border: "1px solid #ddd", borderRadius: 6 }} />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(async () => {
                const r = await commit({ buyerId: userId, unitIds: lot.freeUnitIds.slice(0, n) });
                return `Committed ${formatUGX(r.committedTotal)} into escrow for ${n} lot(s). Follow the steps in "My lot orders".`;
              })}
              style={{ minHeight: 44, padding: "0 1rem", borderRadius: 8, border: "none", background: busy ? "#ccc" : "#2e7d32", color: "#fff", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}
            >
              Buy · commit {formatUGX(commitNow)}
            </button>
            <button type="button" onClick={() => setOffering((v) => !v)} style={{ minHeight: 44, padding: "0 1rem", borderRadius: 8, border: "1px solid #ddd", background: "#fff", fontWeight: 700, cursor: "pointer" }}>
              Make an offer
            </button>
          </div>
        )}

        {offering && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", padding: "0.6rem", borderRadius: 8, background: "#f9f9f9" }}>
            <label style={{ fontSize: "0.85rem" }}>
              Your price per kg (UGX){" "}
              <input type="number" min={1} value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} style={{ width: 110, padding: "0.45rem", border: "1px solid #ddd", borderRadius: 6 }} />
            </label>
            <button
              type="button"
              disabled={busy || !(parseFloat(offerPrice) > 0)}
              onClick={() => run(async () => {
                await makeOffer({ traderId: userId, unitIds: lot.freeUnitIds.slice(0, n), offerPricePerKilo: parseFloat(offerPrice) });
                return "Offer sent. When the seller accepts, commit it from \"Offers the seller accepted\" above.";
              })}
              style={{ minHeight: 40, padding: "0 0.9rem", borderRadius: 8, border: "none", background: "#1565c0", color: "#fff", fontWeight: 700, cursor: "pointer" }}
            >
              Send offer for {n} lot{n === 1 ? "" : "s"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
