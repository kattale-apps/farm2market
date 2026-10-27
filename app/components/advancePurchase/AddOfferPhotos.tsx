"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { validateImageFile } from "../../utils/imageValidation";
import { PhotoPickButtons } from "../PhotoPickButtons";

export function AddOfferPhotos({ farmerId, offerId }: { farmerId: Id<"users">; offerId: Id<"advancePurchaseOffers"> }) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const addOfferPhotos = useMutation(api.advancePurchase.addOfferPhotos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (files: File[]) => {
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
    <div style={{ marginTop: "0.6rem", maxWidth: 320 }}>
      <PhotoPickButtons multiple size="small" onPick={handleSelect} disabled={busy} label={busy ? "Uploading…" : "🖼️ Add photos"} />
      {error && <p style={{ color: "#d32f2f", fontSize: "0.75rem", margin: "0.3rem 0 0" }}>{error}</p>}
    </div>
  );
}
