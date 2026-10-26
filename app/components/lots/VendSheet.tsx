"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { PlanStep } from "../../../convex/lotOrdersShared";
import { LotTermsFields, planProblem } from "./LotTermsFields";

type MyLots = NonNullable<FunctionReturnType<typeof api.marketspace.myLots>>;
export type MyLot = MyLots["lots"][number];

/**
 * Put a lot listing on MarketSpace: how long it stays up before it must be
 * refreshed, whether it sells in bulk (verified sellers), and its payment
 * steps, which every poster can change here before vending.
 */
export function VendSheet({ token, lot, info, onClose }: { token: string; lot: MyLot; info: MyLots; onClose: (message?: string) => void }) {
  const vend = useMutation(api.marketspace.vendListing);
  const updateTerms = useMutation(api.listings.updateListingTerms);
  const [days, setDays] = useState(lot.vendRefreshDays && info.dayChoices.includes(lot.vendRefreshDays) ? lot.vendRefreshDays : info.dayChoices[Math.min(1, info.dayChoices.length - 1)]);
  const kgForSale = lot.lotsLeft * lot.unitSize;
  const fits = info.bulkRanges.filter((r) => kgForSale >= r.minKg && (r.maxKg === null || kgForSale <= r.maxKg));
  const [bulk, setBulk] = useState(lot.isBulk);
  const [range, setRange] = useState(lot.bulkRange ?? fits[0]?.key ?? "");
  const [commitPercent, setCommitPercent] = useState(lot.commitPercent ?? 100);
  const [steps, setSteps] = useState<PlanStep[]>(lot.milestonePlan);
  const [termsChanged, setTermsChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bulkCost = bulk && !lot.isBulk ? info.bulkCostFarmcoin : 0;

  const save = async () => {
    const problem = planProblem(steps, commitPercent);
    if (problem) return setError(`Payment steps: ${problem}`);
    if (bulk && !range) return setError("Choose a bulk range");
    setBusy(true);
    setError(null);
    try {
      if (termsChanged || lot.commitPercent === null) {
        await updateTerms({ sellerId: info.userId, listingId: lot.listingId, commitPercent, milestonePlan: steps });
      }
      await vend({ sessionToken: token, listingId: lot.listingId, days, bulkRange: bulk ? range : undefined, expectedBulkCostFarmcoin: bulkCost });
      onClose(`${lot.produceType} is on MarketSpace for ${days} days${bulk ? " in Local Bulk" : ""}.`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const chip = (on: boolean, disabled = false): React.CSSProperties => ({
    minHeight: 44,
    padding: "0 0.9rem",
    borderRadius: 999,
    border: `2px solid ${on ? "#2e7d32" : "#ddd"}`,
    background: on ? "#e8f5e9" : "#fff",
    color: disabled ? "#aaa" : "#222",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  return (
    <div role="dialog" aria-modal="true" aria-label="Vend on MarketSpace" onClick={() => onClose()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: "1.25rem", maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "1.15rem" }}>🗺️ Vend on MarketSpace · {lot.produceType}</h3>
          <button type="button" onClick={() => onClose()} aria-label="Close" style={{ border: "none", background: "#f1f1f1", borderRadius: 999, width: 36, height: 36, cursor: "pointer" }}>✕</button>
        </div>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#555" }}>
          {lot.lotsLeft} lot{lot.lotsLeft === 1 ? "" : "s"} of {lot.unitSize.toLocaleString()} kg for sale. Your listing stays in your ledger; only its MarketSpace card hides when its time runs out.
        </p>

        <div>
          <div style={{ fontWeight: 700, marginBottom: "0.4rem" }}>Stays up for *</div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {info.dayChoices.map((d) => (
              <button key={d} type="button" onClick={() => setDays(d)} style={chip(days === d)}>{d} days</button>
            ))}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.3rem" }}>Tap Refresh in My posts to keep it up longer.</div>
        </div>

        <div>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, color: info.canSellBulk ? "#222" : "#999" }}>
            <input type="checkbox" checked={bulk} disabled={!info.canSellBulk} onChange={(e) => setBulk(e.target.checked)} />
            📦 Sell in bulk (Local Bulk)
          </label>
          {!info.canSellBulk && <div style={{ fontSize: "0.8rem", color: "#8d6e00", marginTop: "0.3rem" }}>{info.bulkReason}</div>}
          {bulk && (
            <div style={{ marginTop: "0.5rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {info.bulkRanges.map((r) => {
                  const ok = fits.some((f) => f.key === r.key);
                  return (
                    <button key={r.key} type="button" disabled={!ok} onClick={() => setRange(r.key)} style={chip(range === r.key, !ok)}>{r.label}</button>
                  );
                })}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.3rem" }}>
                Only ranges that fit your {kgForSale.toLocaleString()} kg can be chosen.
                {bulkCost > 0 ? ` Selling in bulk costs ${bulkCost} FarmCoin.` : ""}
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px solid #eee", paddingTop: "0.9rem" }}>
          <LotTermsFields
            sellerRole={info.role}
            commitPercent={commitPercent}
            steps={steps}
            lotPrice={Math.round(lot.pricePerKilo * lot.unitSize)}
            onChange={(c, s) => {
              setCommitPercent(c);
              setSteps(s);
              setTermsChanged(true);
            }}
          />
          <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.4rem" }}>Lots already ordered keep the steps they were ordered on.</div>
        </div>

        {error && <p style={{ margin: 0, color: "#c62828", fontWeight: 600 }}>{error}</p>}
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button type="button" onClick={save} disabled={busy} style={{ flex: 1, minHeight: 48, border: "none", borderRadius: 8, background: busy ? "#ccc" : "#2e7d32", color: "#fff", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}>
            {busy ? "Saving..." : lot.vendExpiresAt ? "Save and keep on MarketSpace" : "Put on MarketSpace"}
          </button>
          <button type="button" onClick={() => onClose()} style={{ minHeight: 48, padding: "0 1.25rem", border: "1px solid #ddd", borderRadius: 8, background: "#f5f5f5", cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
