"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { validateImageFile } from "../../utils/imageValidation";

interface Photo {
  storageId: Id<"_storage">;
  url: string;
}

interface Props {
  farmerId: Id<"users">;
  offerId: Id<"advancePurchaseOffers">;
  photos: Photo[];
}

export function EditOfferGallery({ farmerId, offerId, photos }: Props) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const addOfferPhotos = useMutation(api.advancePurchase.addOfferPhotos);
  const removeOfferPhotos = useMutation(api.advancePurchase.removeOfferPhotos);

  const [managing, setManaging] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const toggleSelect = (storageId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(storageId)) next.delete(storageId); else next.add(storageId);
      return next;
    });
  };

  const stopManaging = () => {
    setManaging(false);
    setSelected(new Set());
    setError(null);
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    if (selected.size >= photos.length) {
      setError("At least one photo must remain — deselect one to keep.");
      return;
    }
    if (!window.confirm(`Delete ${selected.size} photo(s)? This can't be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await removeOfferPhotos({
        offerId,
        farmerId,
        storageIds: Array.from(selected) as Id<"_storage">[],
      });
      stopManaging();
    } catch (err) {
      setError((err as Error).message || "Failed to delete photos");
    } finally {
      setDeleting(false);
    }
  };

  const handleAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
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
      setUploading(false);
    }
  };

  return (
    <div>
      {photos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "0.4rem", marginBottom: "0.6rem" }}>
          {photos.map((p) => {
            const isSelected = selected.has(String(p.storageId));
            return (
              <div
                key={String(p.storageId)}
                onClick={() => (managing ? toggleSelect(String(p.storageId)) : setLightboxUrl(p.url))}
                style={{ position: "relative", cursor: "pointer" }}
              >
                <img
                  src={p.url}
                  alt="Product"
                  style={{
                    width: "100%",
                    height: 90,
                    objectFit: "cover",
                    borderRadius: 8,
                    border: isSelected ? "2px solid #d32f2f" : "1px solid #e0e0e0",
                    opacity: managing && !isSelected ? 0.6 : 1,
                  }}
                />
                {managing && (
                  <div style={{
                    position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%",
                    background: isSelected ? "#d32f2f" : "rgba(255,255,255,0.85)",
                    border: "1.5px solid #fff", color: "#fff", fontSize: "0.75rem", fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {isSelected ? "✓" : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && <p style={{ color: "#d32f2f", fontSize: "0.78rem", margin: "0 0 0.5rem" }}>{error}</p>}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {!managing ? (
          <>
            <label style={{
              display: "inline-block", padding: "0.4rem 0.75rem",
              background: uploading ? "#eee" : "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 8,
              color: "#2e7d32", fontSize: "0.78rem", fontWeight: 700, cursor: uploading ? "not-allowed" : "pointer",
            }}>
              {uploading ? "Uploading…" : "+ Add gallery photos"}
              <input type="file" accept="image/*" multiple disabled={uploading} onChange={handleAdd} style={{ display: "none" }} />
            </label>
            {photos.length > 1 && (
              <button
                type="button"
                onClick={() => setManaging(true)}
                style={{ padding: "0.4rem 0.75rem", background: "#fff5f5", border: "1px solid #ef9a9a", borderRadius: 8, color: "#d32f2f", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}
              >
                🗑️ Delete photos
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || selected.size === 0}
              style={{
                padding: "0.4rem 0.75rem", background: selected.size === 0 ? "#eee" : "#d32f2f",
                border: "none", borderRadius: 8, color: selected.size === 0 ? "#999" : "#fff",
                fontSize: "0.78rem", fontWeight: 700, cursor: selected.size === 0 || deleting ? "not-allowed" : "pointer",
              }}
            >
              {deleting ? "Deleting…" : `Delete selected (${selected.size})`}
            </button>
            <button
              type="button"
              onClick={stopManaging}
              disabled={deleting}
              style={{ padding: "0.4rem 0.75rem", background: "#eee", border: "none", borderRadius: 8, color: "#333", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: "1.5rem",
          }}
        >
          <img
            src={lightboxUrl}
            alt="Photo enlarged"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", borderRadius: 8 }}
          />
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            style={{
              marginTop: "1rem", padding: "0.6rem 1rem", background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.5)", color: "#fff", borderRadius: 8, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
