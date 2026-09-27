"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { formLabel } from "../../../convex/processorShared";

/**
 * Deliveries a processor recorded from this farmer, for the farmer to confirm
 * or dispute. Shown only while something is waiting for an answer.
 */
export function FarmerProcessorDeliveries({ farmerId }: { farmerId: Id<"users"> }) {
  const rows = useQuery(api.processorOperations.listMyProcessorDeliveries, { farmerId });
  const respond = useMutation(api.processorOperations.respondToIntake);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = (rows ?? []).filter((r) => r.farmerConfirmation === "pending");
  if (pending.length === 0) return null;
  return (
    <div style={{ background: "#fff8e1", border: "2px solid #ffd54f", borderRadius: 12, padding: "0.9rem 1rem", margin: "0 0 1rem" }}>
      <div style={{ fontWeight: 800, color: "#6d4c00", marginBottom: "0.4rem" }}>🏭 Confirm your deliveries to processors</div>
      {error && <div style={{ color: "#c62828", fontSize: "0.85rem" }}>{error}</div>}
      {pending.map((r) => (
        <div key={r._id} style={{ borderTop: "1px solid #ffe082", padding: "0.55rem 0", fontSize: "0.9rem" }}>
          <div>
            <b>{r.kilos} kg</b> {formLabel(r.inputForm)} to <b>{r.facilityName}</b>
            {r.district ? ` (${r.district})` : ""} on {r.intakeDate}
            {r.pricePerKgUgx != null ? ` at UGX ${r.pricePerKgUgx.toLocaleString()}/kg` : ""} · {r.intakeCode}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
            {(["confirmed", "disputed"] as const).map((decision) => (
              <button
                key={decision}
                disabled={busy === r._id}
                onClick={async () => {
                  setBusy(r._id);
                  setError(null);
                  try {
                    await respond({ farmerId, intakeId: r._id, decision });
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Something went wrong");
                  } finally {
                    setBusy(null);
                  }
                }}
                style={{
                  minHeight: 40,
                  padding: "0.45rem 0.9rem",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  background: decision === "confirmed" ? "#2e7d32" : "#c62828",
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                {decision === "confirmed" ? "Yes, correct" : "Not correct"}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
