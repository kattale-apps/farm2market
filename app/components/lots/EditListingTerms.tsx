"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { PACKAGED_COMMIT_PERCENT, defaultPlan, packagedPlan, type PlanStep } from "../../../convex/lotOrdersShared";
import { PhotoSetCapture, type CapturedPhoto } from "../exportMarkets/PhotoSetCapture";
import { uploadEvidencePhotos } from "../exportMarkets/PhotoSetCapture";
import { LotTermsFields, PackagedTermsFields, planProblem } from "./LotTermsFields";

/**
 * The seller changes a listing's price, payment terms or photos. Lots
 * already in an order keep the terms they were ordered on. Packaged items
 * are priced per item and have no payment steps unless switched on.
 */
export function EditListingTerms({
  sellerId,
  sellerRole,
  listing,
  onClose,
}: {
  sellerId: Id<"users">;
  sellerRole: string;
  listing: {
    listingId: Id<"listings">;
    produceType: string;
    listingMode: string;
    pricePerKilo: number;
    unitSize?: number;
    commitPercent: number | null;
    milestonePlan: PlanStep[] | null;
    photoCount: number;
    pricePerUnit?: number | null; // Packaged items
    packagesPerBatch?: number | null;
    packageLabel?: string | null;
    takesOffers?: boolean | null;
  };
  onClose: (message?: string) => void;
}) {
  const updateTerms = useMutation(api.listings.updateListingTerms);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const packaged = listing.listingMode === "packaging";
  const startCommit = listing.commitPercent ?? (packaged ? PACKAGED_COMMIT_PERCENT : 100);
  const [commitPercent, setCommitPercent] = useState(startCommit);
  const [steps, setSteps] = useState<PlanStep[]>(listing.milestonePlan ?? (packaged ? packagedPlan(sellerRole) : defaultPlan(sellerRole, startCommit)));
  const [price, setPrice] = useState(String(packaged ? listing.pricePerUnit ?? "" : listing.pricePerKilo));
  const [takesOffers, setTakesOffers] = useState(listing.takesOffers === true);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [replacePhotos, setReplacePhotos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const byWeight = listing.listingMode !== "garden" && !packaged;
  const pricePerKilo = parseFloat(price);

  const save = async () => {
    const problem = planProblem(steps, commitPercent);
    if (problem) return setError(problem);
    if ((byWeight || packaged) && !(pricePerKilo > 0)) return setError("Enter a price above 0");
    if (replacePhotos && photos.length === 0) return setError("Add at least one photo, or keep the current photos");
    setSaving(true);
    setError(null);
    try {
      await updateTerms({
        sellerId,
        listingId: listing.listingId,
        pricePerKilo: byWeight ? pricePerKilo : undefined,
        pricePerUnit: packaged ? pricePerKilo : undefined,
        takesOffers: packaged ? takesOffers : undefined,
        commitPercent,
        milestonePlan: steps,
        photos: replacePhotos ? await uploadEvidencePhotos(() => generateUploadUrl(), photos) : undefined,
      });
      onClose("Terms saved. Lots already ordered keep their old terms.");
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Edit terms" onClick={() => onClose()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, padding: "1.25rem", maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "1.2rem" }}>Edit terms · {listing.produceType}</h3>
          <button type="button" onClick={() => onClose()} aria-label="Close" style={{ border: "none", background: "#f1f1f1", borderRadius: 999, width: 36, height: 36, cursor: "pointer" }}>✕</button>
        </div>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#666" }}>Changes apply to lots nobody has ordered yet.</p>

        {byWeight && (
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#333" }}>Price per kilo (UGX) *</label>
            <input type="number" min={1} step={1} value={price} onChange={(e) => setPrice(e.target.value)} style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: 6, fontSize: "1rem" }} />
          </div>
        )}

        {packaged && (
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#333" }}>Price per {listing.packageLabel ?? "item"} (UGX) *</label>
            <input type="number" min={1} step={1} value={price} onChange={(e) => setPrice(e.target.value)} style={{ width: "100%", padding: "0.75rem", border: "1px solid #ddd", borderRadius: 6, fontSize: "1rem" }} />
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, color: "#333", marginTop: "0.6rem" }}>
              <input type="checkbox" checked={takesOffers} onChange={(e) => setTakesOffers(e.target.checked)} />
              Take offers from buyers
            </label>
          </div>
        )}

        {packaged ? (
          <PackagedTermsFields
            sellerRole={sellerRole}
            commitPercent={commitPercent}
            steps={steps}
            lotPrice={pricePerKilo > 0 ? Math.round(pricePerKilo * (listing.packagesPerBatch ?? 1)) : null}
            onChange={(c, s) => { setCommitPercent(c); setSteps(s); }}
          />
        ) : (
          <LotTermsFields
            sellerRole={sellerRole}
            commitPercent={commitPercent}
            steps={steps}
            lotPrice={byWeight && pricePerKilo > 0 && listing.unitSize ? Math.round(pricePerKilo * listing.unitSize) : null}
            onChange={(c, s) => { setCommitPercent(c); setSteps(s); }}
          />
        )}

        <div>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, color: "#333" }}>
            <input type="checkbox" checked={replacePhotos} onChange={(e) => setReplacePhotos(e.target.checked)} />
            Replace the photos ({listing.photoCount} now)
          </label>
          {replacePhotos && <div style={{ marginTop: "0.5rem" }}><PhotoSetCapture photos={photos} onChange={setPhotos} max={6} /></div>}
        </div>

        {error && <p style={{ margin: 0, color: "#c62828", fontWeight: 600 }}>{error}</p>}
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button type="button" onClick={save} disabled={saving} style={{ flex: 1, minHeight: 48, border: "none", borderRadius: 8, background: saving ? "#ccc" : "#2e7d32", color: "#fff", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving..." : "Save terms"}
          </button>
          <button type="button" onClick={() => onClose()} style={{ minHeight: 48, padding: "0 1.25rem", border: "1px solid #ddd", borderRadius: 8, background: "#f5f5f5", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
