"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

const FONT = '"Montserrat", sans-serif';
const BRAND = "#2e7d32";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.6rem", borderRadius: 8, border: "1px solid #ccc", marginBottom: "0.6rem", fontFamily: FONT, boxSizing: "border-box",
};

function ConfigBuilder({ adminId, communityId, onDone }: { adminId: Id<"users">; communityId: Id<"communities">; onDone: () => void }) {
  const createConfig = useMutation(api.advancePurchase.createConfig);
  const [name, setName] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [instructions, setInstructions] = useState("");
  const [unitOptions, setUnitOptions] = useState("seedlings, kg, bags");
  const [recurrenceOptions, setRecurrenceOptions] = useState("one_off, seasonal, production_cycle");
  const [negotiationAllowed, setNegotiationAllowed] = useState(true);
  const [buyerCanProposePrice, setBuyerCanProposePrice] = useState(false);
  const [insuranceEnabled, setInsuranceEnabled] = useState(false);
  const [insuranceLabel, setInsuranceLabel] = useState("Farm insurance");
  const [insuranceAmount, setInsuranceAmount] = useState("");
  const [milestones, setMilestones] = useState([
    { order: 1, name: "Germinate", photoRequired: true, gpsRequired: true, timestampRequired: true, releasePercent: 25, expectedDaysFromPublish: 30 },
    { order: 2, name: "Grow", photoRequired: true, gpsRequired: true, timestampRequired: true, releasePercent: 25, expectedDaysFromPublish: 90 },
    { order: 3, name: "Harden", photoRequired: true, gpsRequired: true, timestampRequired: true, releasePercent: 25, expectedDaysFromPublish: 150 },
    { order: 4, name: "Ready", photoRequired: true, gpsRequired: true, timestampRequired: true, releasePercent: 25, expectedDaysFromPublish: 180 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const updateMilestone = (i: number, patch: Partial<(typeof milestones)[number]>) => {
    setMilestones((ms) => ms.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  };
  const addMilestone = () => {
    setMilestones((ms) => [...ms, { order: ms.length + 1, name: "", photoRequired: true, gpsRequired: true, timestampRequired: true, releasePercent: 0, expectedDaysFromPublish: undefined as any }]);
  };
  const removeMilestone = (i: number) => {
    setMilestones((ms) => ms.filter((_, idx) => idx !== i).map((m, idx) => ({ ...m, order: idx + 1 })));
  };

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await createConfig({
        adminId,
        communityId,
        name,
        productCategory,
        instructions: instructions || undefined,
        customFields: [],
        unitOptions: unitOptions.split(",").map((s) => s.trim()).filter(Boolean),
        recurrenceOptions: recurrenceOptions.split(",").map((s) => s.trim()).filter(Boolean),
        negotiationAllowed,
        buyerCanProposePrice,
        insuranceEnabled,
        insuranceLabel: insuranceEnabled ? insuranceLabel : undefined,
        insuranceAmount: insuranceEnabled && insuranceAmount ? Number(insuranceAmount) : undefined,
        milestoneTemplate: milestones.map((m) => ({
          order: m.order,
          name: m.name,
          expectedDaysFromPublish: m.expectedDaysFromPublish || undefined,
          photoRequired: m.photoRequired,
          gpsRequired: m.gpsRequired,
          timestampRequired: m.timestampRequired,
          releasePercent: Number(m.releasePercent),
        })),
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const totalPercent = milestones.reduce((s, m) => s + Number(m.releasePercent || 0), 0);

  return (
    <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: "1rem", marginBottom: "1rem" }}>
      <h3 style={{ margin: "0 0 0.75rem" }}>New Advance Purchase configuration</h3>
      <input placeholder="Program name (e.g. Coffee Seedlings)" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      <input placeholder="Product category (e.g. coffee_seedlings, produce, livestock)" value={productCategory} onChange={(e) => setProductCategory(e.target.value)} style={inputStyle} />
      <textarea placeholder="Instructions shown to farmers (optional)" value={instructions} onChange={(e) => setInstructions(e.target.value)} style={inputStyle} />
      <input placeholder="Units of measure, comma-separated" value={unitOptions} onChange={(e) => setUnitOptions(e.target.value)} style={inputStyle} />
      <input placeholder="Recurrence options, comma-separated" value={recurrenceOptions} onChange={(e) => setRecurrenceOptions(e.target.value)} style={inputStyle} />

      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
        <input type="checkbox" checked={negotiationAllowed} onChange={(e) => setNegotiationAllowed(e.target.checked)} />
        Allow buyer negotiation
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
        <input type="checkbox" checked={buyerCanProposePrice} onChange={(e) => setBuyerCanProposePrice(e.target.checked)} disabled={!negotiationAllowed} />
        Allow buyer to propose a different price
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
        <input type="checkbox" checked={insuranceEnabled} onChange={(e) => setInsuranceEnabled(e.target.checked)} />
        Offer optional insurance add-on
      </label>
      {insuranceEnabled && (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input placeholder="Insurance label" value={insuranceLabel} onChange={(e) => setInsuranceLabel(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <input placeholder="Insurance amount (UGX)" type="number" value={insuranceAmount} onChange={(e) => setInsuranceAmount(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        </div>
      )}

      <h4 style={{ margin: "0.75rem 0 0.4rem" }}>Verification stages / milestones</h4>
      {milestones.map((m, i) => (
        <div key={i} style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.4rem" }}>
          <input placeholder="Stage name" value={m.name} onChange={(e) => updateMilestone(i, { name: e.target.value })} style={{ ...inputStyle, marginBottom: 0, flex: 2 }} />
          <input placeholder="% released" type="number" value={m.releasePercent} onChange={(e) => updateMilestone(i, { releasePercent: Number(e.target.value) })} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
          <input placeholder="Days" type="number" value={m.expectedDaysFromPublish ?? ""} onChange={(e) => updateMilestone(i, { expectedDaysFromPublish: Number(e.target.value) })} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
          <button onClick={() => removeMilestone(i)} style={{ background: "none", border: "none", color: "#d32f2f", cursor: "pointer" }}>✕</button>
        </div>
      ))}
      <button onClick={addMilestone} style={{ background: "none", border: "1px dashed #999", borderRadius: 8, padding: "0.4rem 0.8rem", cursor: "pointer", marginBottom: "0.5rem" }}>
        + Add stage
      </button>
      <p style={{ fontSize: "0.8rem", color: totalPercent === 100 ? "#2e7d32" : "#d32f2f" }}>
        Release percentages total: {totalPercent}% (must equal 100%)
      </p>

      {error && <p style={{ color: "#d32f2f", fontSize: "0.85rem" }}>{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={busy || !name || !productCategory || totalPercent !== 100}
        style={{ padding: "0.75rem 1.25rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
      >
        {busy ? "Saving..." : "Save configuration"}
      </button>
    </div>
  );
}

function EvidenceReview({ adminId, communityId }: { adminId: Id<"users">; communityId: Id<"communities"> }) {
  const pending = useQuery(api.advancePurchase.listPendingEvidenceForCommunity, { adminId, communityId });
  const review = useMutation(api.advancePurchase.reviewMilestoneEvidence);
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (pending === undefined) return <p>Loading evidence...</p>;
  if (pending.length === 0) {
    return <p style={{ color: "#777", fontSize: "0.9rem" }}>No evidence awaiting review.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {pending.map((e: any) => (
        <div key={e._id} style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: "1rem" }}>
          <div style={{ fontWeight: 700 }}>{e.offer?.productName} — {e.milestone?.name}</div>
          <img src={e.url} alt="Evidence" style={{ width: "100%", maxWidth: 320, borderRadius: 8, margin: "0.5rem 0" }} />
          <p style={{ fontSize: "0.8rem", color: "#666" }}>
            {e.lat != null ? `📍 ${e.lat.toFixed(5)}, ${e.lng.toFixed(5)}` : "No GPS"} · 🕒 {new Date(e.capturedAt).toLocaleString()}
          </p>
          <textarea
            placeholder="Notes (optional)"
            value={notes[e._id] || ""}
            onChange={(ev) => setNotes((n) => ({ ...n, [e._id]: ev.target.value }))}
            style={{ ...inputStyle, marginBottom: "0.5rem" }}
          />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => review({ reviewerId: adminId, evidenceId: e._id, decision: "approved", reviewNotes: notes[e._id] })}
              style={{ flex: 1, padding: "0.6rem", background: "#2e7d32", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
            >
              Approve
            </button>
            <button
              onClick={() => review({ reviewerId: adminId, evidenceId: e._id, decision: "resubmission_required", reviewNotes: notes[e._id] })}
              style={{ flex: 1, padding: "0.6rem", background: "#f57f17", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
            >
              Request resubmission
            </button>
            <button
              onClick={() => review({ reviewerId: adminId, evidenceId: e._id, decision: "rejected", reviewNotes: notes[e._id] })}
              style={{ flex: 1, padding: "0.6rem", background: "#d32f2f", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Shared Advance Purchase config + evidence-review panel for a single
 * community. Used both by the standalone /admin/advance-purchase page
 * (which adds its own community picker) and by the "Advance Purchase"
 * tab inside the per-community community-dashboard console.
 */
export function CommunityAdvancePurchasePanel({ adminId, communityId }: { adminId: Id<"users">; communityId: Id<"communities"> }) {
  const [tab, setTab] = useState<"configure" | "review">("configure");
  const [showBuilder, setShowBuilder] = useState(false);
  const configs = useQuery(api.advancePurchase.listConfigsForCommunity, { communityId });

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          onClick={() => setTab("configure")}
          style={{ flex: 1, padding: "0.6rem", background: tab === "configure" ? BRAND : "#eee", color: tab === "configure" ? "#fff" : "#333", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
        >
          Configure
        </button>
        <button
          onClick={() => setTab("review")}
          style={{ flex: 1, padding: "0.6rem", background: tab === "review" ? BRAND : "#eee", color: tab === "review" ? "#fff" : "#333", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
        >
          Review evidence
        </button>
      </div>

      {tab === "configure" && (
        <>
          {showBuilder ? (
            <ConfigBuilder adminId={adminId} communityId={communityId} onDone={() => setShowBuilder(false)} />
          ) : (
            <button onClick={() => setShowBuilder(true)} style={{ padding: "0.7rem 1.1rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", marginBottom: "1rem" }}>
              + New configuration
            </button>
          )}

          {configs === undefined ? (
            <p>Loading configurations...</p>
          ) : configs.length === 0 ? (
            <p style={{ color: "#777", fontSize: "0.9rem" }}>No advance purchase form configured.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {configs.map((c: any) => (
                <div key={c._id} style={{ padding: "0.75rem 1rem", background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10 }}>
                  <div style={{ fontWeight: 700 }}>{c.name} {c.isActive ? "" : "(inactive)"}</div>
                  <div style={{ fontSize: "0.8rem", color: "#888" }}>{c.productCategory} · {c.milestoneTemplate.length} stages</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "review" && <EvidenceReview adminId={adminId} communityId={communityId} />}
    </div>
  );
}
