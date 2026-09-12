"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { validateImageFile } from "../../utils/imageValidation";

export function AddOfferPhotos({ farmerId, offerId }: { farmerId: Id<"users">; offerId: Id<"advancePurchaseOffers"> }) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const addOfferPhotos = useMutation(api.advancePurchase.addOfferPhotos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const storageIds: Id<"_storage">[] = [];
      for (const file of files) {
        const result = validateImageFile(file);
        if (!result.valid) {
          setError(result.error || "Invalid photo");
          continue;
        }
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        const { storageId } = await res.json();
        storageIds.push(storageId);
      }
      if (storageIds.length > 0) {
        await addOfferPhotos({ offerId, farmerId, storageIds });
      }
    } catch (err) {
      setError((err as Error).message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: "0.6rem" }}>
      <label style={{
        display: "inline-block",
        padding: "0.4rem 0.75rem",
        background: busy ? "#eee" : "#e8f5e9",
        border: "1px solid #a5d6a7",
        borderRadius: 8,
        color: "#2e7d32",
        fontSize: "0.78rem",
        fontWeight: 700,
        cursor: busy ? "not-allowed" : "pointer",
      }}>
        {busy ? "Uploading…" : "+ Add gallery photos"}
        <input type="file" accept="image/*" multiple disabled={busy} onChange={handleSelect} style={{ display: "none" }} />
      </label>
      {error && <p style={{ color: "#d32f2f", fontSize: "0.75rem", margin: "0.3rem 0 0" }}>{error}</p>}
    </div>
  );
}
