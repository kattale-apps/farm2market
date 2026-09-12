"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { GOODS_CATEGORIES, FARM_SERVICE_OPTIONS } from "../../utils/advancedMarketsOptions";

const FONT = '"Montserrat", sans-serif';
const BRAND = "#2e7d32";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.6rem", borderRadius: 8, border: "1px solid #ccc", marginBottom: "0.6rem", fontFamily: FONT, boxSizing: "border-box",
};

function ConfigBuilder({ adminId, communityId, onDone }: { adminId: Id<"users">; communityId: Id<"communities">; onDone: () => void }) {
  const createConfig = useMutation(api.advancePurchase.createConfig);
  const [name, setName] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [offerKind, setOfferKind] = useState<"goods" | "services">("goods");
  const [goodsCategory, setGoodsCategory] = useState<"crop" | "livestock">("crop");
  const [serviceCategory, setServiceCategory] = useState(FARM_SERVICE_OPTIONS[0]);
  const [customService, setCustomService] = useState("");
  const [usingCustomService, setUsingCustomService] = useState(false);
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
        offerKind,
        goodsCategory: offerKind === "goods" ? goodsCategory : undefined,
        serviceCategory: offerKind === "services" ? (usingCustomService ? customService.trim() : serviceCategory) : undefined,
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
      <h3 style={{ margin: "0 0 0.75rem" }}>New Advanced Markets configuration</h3>
      <input placeholder="Program name (e.g. Coffee Seedlings)" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />

      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#333", marginBottom: "0.3rem" }}>
        Offer type
      </label>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem" }}>
        <button
          type="button"
          onClick={() => setOfferKind("goods")}
          style={{
            flex: 1, padding: "0.6rem", borderRadius: 8, cursor: "pointer", fontWeight: 700,
            border: offerKind === "goods" ? `2px solid ${BRAND}` : "1px solid #ccc",
            background: offerKind === "goods" ? "#e8f5e9" : "#fff",
            color: offerKind === "goods" ? BRAND : "#666",
          }}
        >
          📦 Goods
        </button>
        <button
          type="button"
          onClick={() => setOfferKind("services")}
          style={{
            flex: 1, padding: "0.6rem", borderRadius: 8, cursor: "pointer", fontWeight: 700,
            border: offerKind === "services" ? `2px solid ${BRAND}` : "1px solid #ccc",
            background: offerKind === "services" ? "#e8f5e9" : "#fff",
            color: offerKind === "services" ? BRAND : "#666",
          }}
        >
          🧑‍🌾 Services
        </button>
      </div>

      {offerKind === "goods" ? (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem" }}>
          {GOODS_CATEGORIES.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGoodsCategory(g.value)}
              style={{
                flex: 1, padding: "0.5rem", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.85rem",
                border: goodsCategory === g.value ? `2px solid ${BRAND}` : "1px solid #ccc",
                background: goodsCategory === g.value ? "#e8f5e9" : "#fff",
                color: goodsCategory === g.value ? BRAND : "#666",
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ marginBottom: "0.6rem" }}>
          <select
            value={usingCustomService ? "__custom__" : serviceCategory}
            onChange={(e) => {
              if (e.target.value === "__custom__") {
                setUsingCustomService(true);
              } else {
                setUsingCustomService(false);
                setServiceCategory(e.target.value);
              }
            }}
            style={inputStyle}
          >
            {FARM_SERVICE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value="__custom__">+ Add a new service…</option>
          </select>
          {usingCustomService && (
            <input
              placeholder="New service name (e.g. Soil Testing)"
              value={customService}
              onChange={(e) => setCustomService(e.target.value)}
              style={inputStyle}
            />
          )}
        </div>
      )}

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
        disabled={
          busy || !name || !productCategory || totalPercent !== 100 ||
          (offerKind === "services" && usingCustomService && !customService.trim())
        }
        style={{ padding: "0.75rem 1.25rem", background: BRAND, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
      >
        {busy ? "Saving..." : "Save configuration"}
      </button>
    </div>
  );
}

function ProofPictureHistory({ adminId, communityId }: { adminId: Id<"users">; communityId: Id<"communities"> }) {
  const reviewed = useQuery(api.advancePurchase.listReviewedProofPicturesForCommunity, { adminId, communityId });

  if (reviewed === undefined) return <p>Loading proof picture history...</p>;
  if (reviewed.length === 0) {
    return <p style={{ color: "#777", fontSize: "0.9rem" }}>No reviewed proof pictures yet.</p>;
  }

  const statusColor: Record<string, string> = { approved: "#2e7d32", rejected: "#d32f2f", resubmission_required: "#f57f17" };
  const statusLabel: Record<string, string> = { approved: "✅ Approved", rejected: "❌ Rejected", resubmission_required: "🔁 Resubmission requested" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {reviewed.map((e: any) => (
        <div key={e._id} style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: "0.85rem 1rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          <img src={e.url} alt="Proof" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{e.offer?.productName} — {e.milestone?.name}</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: statusColor[e.status] || "#777", margin: "0.15rem 0" }}>
              {statusLabel[e.status] || e.status}
            </div>
            {e.reviewNotes && <div style={{ fontSize: "0.78rem", color: "#666" }}>{e.reviewNotes}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function EvidenceReview({ adminId, communityId }: { adminId: Id<"users">; communityId: Id<"communities"> }) {
  const pending = useQuery(api.advancePurchase.listPendingEvidenceForCommunity, { adminId, communityId });
  const review = useMutation(api.advancePurchase.reviewMilestoneEvidence);
  const [notes, setNotes] = useState<Record<string, string>>({});

  return (
    <div>
      <h4 style={{ margin: "0 0 0.6rem", fontSize: "0.95rem", color: "#333" }}>Awaiting review</h4>
      {pending === undefined ? (
        <p>Loading proof pictures...</p>
      ) : pending.length === 0 ? (
        <p style={{ color: "#777", fontSize: "0.9rem", marginBottom: "1.25rem" }}>No proof pictures awaiting review.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.25rem" }}>
          {pending.map((e: any) => (
            <div key={e._id} style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: "1rem" }}>
              <div style={{ fontWeight: 700 }}>{e.offer?.productName} — {e.milestone?.name}</div>
              <img src={e.url} alt="Proof" style={{ width: "100%", maxWidth: 320, borderRadius: 8, margin: "0.5rem 0" }} />
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
      )}

      <h4 style={{ margin: "0 0 0.6rem", fontSize: "0.95rem", color: "#333" }}>History</h4>
      <ProofPictureHistory adminId={adminId} communityId={communityId} />
    </div>
  );
}

/**
 * Shared Advanced Markets config + proof-picture-review panel for a single
 * community. Used both by the standalone /admin/advance-purchase page
 * (which adds its own community picker) and by the "Advanced Markets"
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
          Proof pictures
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
            <p style={{ color: "#777", fontSize: "0.9rem" }}>No Advanced Markets form configured.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {configs.map((c: any) => (
                <div key={c._id} style={{ padding: "0.75rem 1rem", background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700 }}>{c.name} {c.isActive ? "" : "(inactive)"}</div>
                    {c.offerKind && (
                      <span style={{ padding: "0.1rem 0.5rem", borderRadius: 999, fontSize: "0.7rem", fontWeight: 700, background: "#e8f5e9", color: BRAND }}>
                        {c.offerKind === "goods"
                          ? (c.goodsCategory === "livestock" ? "🐄 Livestock" : "🌾 Crop")
                          : `🧑‍🌾 ${c.serviceCategory || "Service"}`}
                      </span>
                    )}
                  </div>
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
