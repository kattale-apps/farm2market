"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { commitAmount } from "../../../convex/lotOrdersShared";

const formatUGX = (n: number) => `UGX ${Math.round(n).toLocaleString()}`;

/** A Convex error's readable message (ConvexError data first). */
function errorMessage(e: unknown): { text: string; needsTopUp: boolean } {
  const data = (e as { data?: { message?: string; code?: string } })?.data;
  if (data?.message) return { text: data.message, needsTopUp: data.code === "INSUFFICIENT_WALLET_BALANCE" };
  return { text: (e as Error)?.message ?? "Something went wrong", needsTopUp: false };
}

/**
 * Offers a seller accepted, waiting for the buyer to commit their share of
 * the price into escrow. Shown to verified purchasers on MarketSpace.
 */
export function AcceptedOffers({ userId }: { userId: Id<"users"> }) {
  const accepted = useQuery(api.negotiations.getAcceptedNegotiations, { traderId: userId });
  const commit = useMutation(api.lotOrders.commit);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; topUp?: boolean } | null>(null);
  if (!accepted?.negotiations?.length && !msg) return null;

  const commitOne = async (unitId: Id<"listingUnits">) => {
    setBusy(unitId);
    setMsg(null);
    try {
      const r = await commit({ buyerId: userId, unitIds: [unitId] });
      setMsg({ ok: true, text: `Committed ${formatUGX(r.committedTotal)} into escrow. Follow the steps in your lot orders.` });
    } catch (e) {
      const { text, needsTopUp } = errorMessage(e);
      setMsg({ ok: false, text, topUp: needsTopUp });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ padding: "0.75rem", borderRadius: 12, background: "#e8f5e9", border: "1px solid #a5d6a7", marginBottom: "0.8rem" }}>
      {(accepted?.negotiations?.length ?? 0) > 0 && <div style={{ fontWeight: 800, marginBottom: "0.4rem" }}>Offers the seller accepted</div>}
      {accepted?.negotiations?.map((n: any) => (
        <div key={n.negotiationId} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap", alignItems: "center", padding: "0.3rem 0" }}>
          <span>{n.produceType} · {n.unitSize} kg at {formatUGX(n.finalPricePerKilo)}/kg</span>
          <button type="button" disabled={busy === n.unitId} onClick={() => commitOne(n.unitId)} style={{ minHeight: 40, padding: "0 0.9rem", borderRadius: 8, border: "none", background: "#2e7d32", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            Commit {n.commitPercent ?? 100}% ({formatUGX(commitAmount(n.totalPrice, n.commitPercent ?? 100))})
          </button>
        </div>
      ))}
      {msg && (
        <div style={{ fontWeight: 600, color: msg.ok ? "#2e7d32" : "#c62828", marginTop: "0.3rem" }}>
          {msg.text} {msg.topUp && <a href="/wallet" style={{ color: "#c62828" }}>Top up →</a>}
        </div>
      )}
    </div>
  );
}
