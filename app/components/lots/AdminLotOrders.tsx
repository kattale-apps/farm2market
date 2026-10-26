"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formatUgandaDateTime } from "../../utils/timeUtils";

const formatUGX = (n: number) => `UGX ${Math.round(n).toLocaleString()}`;

/**
 * Super and finance admins: lot orders waiting for a decision (cancel
 * requests, problems, failed deliveries) and fines kept from missed
 * payments. The decision splits the escrow between seller and buyer.
 */
export function AdminLotOrders({ adminId }: { adminId: Id<"users"> }) {
  const disputed = useQuery(api.lotOrders.listDisputed, { adminId });
  const fines = useQuery(api.lotOrders.listFines, { adminId });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <h3 style={{ margin: "0 0 0.5rem" }}>Lot orders waiting for a decision</h3>
        {disputed === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : disputed.length === 0 ? (
          <p style={{ color: "#666", margin: 0 }}>Nothing waiting.</p>
        ) : (
          disputed.map((o) => <DisputeRow key={o.orderId} order={o} adminId={adminId} />)
        )}
      </div>

      <div>
        <h3 style={{ margin: "0 0 0.5rem" }}>Lot order fines (missed payments)</h3>
        {fines === undefined ? (
          <p style={{ color: "#999" }}>Loading...</p>
        ) : (
          <>
            <p style={{ margin: "0 0 0.4rem" }}>Platform share kept: <strong>{formatUGX(fines.totalToPlatform)}</strong></p>
            {fines.rows.slice(0, 50).map((r) => (
              <div key={r.orderId} style={{ fontSize: "0.85rem", color: "#444", padding: "0.25rem 0", borderBottom: "1px solid #eee" }}>
                {r.utid} · {r.produceType} · platform {formatUGX(r.fineToPlatform)} · seller {formatUGX(r.fineToSeller)} · returned {formatUGX(r.toBuyer)}
                {r.closedAt ? ` · ${formatUgandaDateTime(r.closedAt)}` : ""}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

type Disputed = NonNullable<ReturnType<typeof useDisputed>>[number];
function useDisputed(adminId: Id<"users">) {
  return useQuery(api.lotOrders.listDisputed, { adminId });
}

function DisputeRow({ order: o, adminId }: { order: Disputed; adminId: Id<"users"> }) {
  const resolve = useMutation(api.lotOrders.resolveOrder);
  const [toSeller, setToSeller] = useState(String(o.suggestedToSeller));
  const [outcome, setOutcome] = useState<"delivered" | "cancelled">(o.disputeKind === "problem" ? "delivered" : "cancelled");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seller = Math.round(Number(toSeller) || 0);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await resolve({ adminId, orderId: o.orderId, outcome, toSeller: seller, note });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div style={{ border: "1px solid #e1bee7", borderRadius: 10, padding: "0.75rem", marginBottom: "0.6rem", background: "#fff" }}>
      <div style={{ fontWeight: 700 }}>{o.produceType} · {o.lotKg.toLocaleString()} kg · {o.utid}</div>
      <div style={{ fontSize: "0.85rem", color: "#555" }}>
        Seller {o.sellerLabel} · Buyer {o.buyerLabel} · {o.disputeKind === "problem" ? "Problem reported" : "Cancel requested"} by {o.disputedBy}
      </div>
      <div style={{ fontSize: "0.88rem", margin: "0.3rem 0" }}>&ldquo;{o.disputeReason}&rdquo;</div>
      <div style={{ fontSize: "0.85rem", color: "#333" }}>
        Total {formatUGX(o.totalAmount)} · In escrow {formatUGX(o.paidAmount)} · Earned by finished steps {formatUGX(o.earnedSoFar)}
        {" "}({o.steps.filter((s) => s.doneAt).map((s) => s.name).join(", ") || "no steps done"})
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginTop: "0.5rem" }}>
        <select value={outcome} onChange={(e) => setOutcome(e.target.value as "delivered" | "cancelled")} style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #ddd" }}>
          <option value="delivered">Lot was delivered (sale stands)</option>
          <option value="cancelled">Cancel (lot back on the market)</option>
        </select>
        <label style={{ fontSize: "0.85rem" }}>
          To seller (UGX){" "}
          <input type="number" min={0} max={o.paidAmount} value={toSeller} onChange={(e) => setToSeller(e.target.value)} style={{ width: 120, padding: "0.45rem", borderRadius: 6, border: "1px solid #ddd" }} />
        </label>
        <span style={{ fontSize: "0.85rem", color: "#555" }}>To buyer: {formatUGX(Math.max(0, o.paidAmount - seller))}</span>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short note on the decision (both sides see it)" style={{ width: "100%", marginTop: "0.5rem", padding: "0.5rem", borderRadius: 6, border: "1px solid #ddd" }} />
      {error && <div style={{ color: "#c62828", fontWeight: 600, marginTop: "0.4rem" }}>{error}</div>}
      <button type="button" disabled={busy || !note.trim()} onClick={save} style={{ marginTop: "0.5rem", minHeight: 40, padding: "0 1rem", border: "none", borderRadius: 8, background: busy || !note.trim() ? "#ccc" : "#7b1fa2", color: "#fff", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}>
        {busy ? "Saving..." : "Decide"}
      </button>
    </div>
  );
}
