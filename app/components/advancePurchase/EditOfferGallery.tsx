"use client";

import { useEffect, useRef, useState } from "react";
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

const LONG_PRESS_MS = 400;
const MOVE_CANCEL_PX = 10;
const PER_PAGE = 9;

export function EditOfferGallery({ farmerId, offerId, photos }: Props) {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const addOfferPhotos = useMutation(api.advancePurchase.addOfferPhotos);
  const removeOfferPhotos = useMutation(api.advancePurchase.removeOfferPhotos);
  const reorderOfferPhotos = useMutation(api.advancePurchase.reorderOfferPhotos);

  const [managing, setManaging] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const photoByStorageId = new Map(photos.map((p) => [String(p.storageId), p]));
  const photosKey = photos.map((p) => String(p.storageId)).join(",");
  const [order, setOrder] = useState<string[]>(photos.map((p) => String(p.storageId)));
  useEffect(() => {
    setOrder(photos.map((p) => String(p.storageId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photosKey]);
  const orderedPhotos = order.map((id) => photoByStorageId.get(id)).filter((p): p is Photo => !!p);

  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(orderedPhotos.length / PER_PAGE));
  useEffect(() => {
    if (page > totalPages - 1) setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedPhotos.length]);
  const visiblePhotos = orderedPhotos.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const tileRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent, storageId: string) => {
    if (managing) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore — capture is a reliability nice-to-have, not required
    }
    pointerStart.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = setTimeout(() => {
      setDraggingId(storageId);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerStart.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    const moved = Math.hypot(dx, dy) > MOVE_CANCEL_PX;

    if (!draggingId) {
      if (moved) clearLongPressTimer();
      return;
    }

    didDrag.current = true;
    let overId: string | null = null;
    tileRefs.current.forEach((el, id) => {
      const rect = el.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        overId = id;
      }
    });
    if (overId && overId !== draggingId) {
      setOrder((prev) => {
        const from = prev.indexOf(draggingId);
        const to = prev.indexOf(overId!);
        if (from === -1 || to === -1) return prev;
        const next = [...prev];
        next.splice(from, 1);
        next.splice(to, 0, draggingId);
        return next;
      });
    }
  };

  const handlePointerUp = async () => {
    clearLongPressTimer();
    pointerStart.current = null;
    if (draggingId) {
      const wasDrag = didDrag.current;
      setDraggingId(null);
      if (wasDrag) {
        try {
          await reorderOfferPhotos({ offerId, farmerId, storageIds: order as Id<"_storage">[] });
        } catch (err) {
          setError((err as Error).message || "Failed to save new photo order");
        }
      }
    }
  };

  const handleTileClick = (photo: Photo) => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    if (managing) {
      toggleSelect(String(photo.storageId));
    } else {
      setLightboxUrl(photo.url);
    }
  };

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
      {!managing && photos.length > 1 && (
        <p style={{ fontSize: "0.72rem", color: "#999", margin: "0 0 0.4rem" }}>
          Press and hold a photo to drag and reorder it{totalPages > 1 ? " (within the current page)" : ""}.
        </p>
      )}

      {orderedPhotos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "0.4rem", marginBottom: "0.6rem" }}>
          {visiblePhotos.map((p) => {
            const id = String(p.storageId);
            const isSelected = selected.has(id);
            const isDragging = draggingId === id;
            return (
              <div
                key={id}
                ref={(el) => {
                  if (el) tileRefs.current.set(id, el);
                  else tileRefs.current.delete(id);
                }}
                onPointerDown={(e) => handlePointerDown(e, id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={() => handleTileClick(p)}
                style={{
                  position: "relative",
                  cursor: managing ? "pointer" : "grab",
                  touchAction: managing ? "auto" : "none",
                  transform: isDragging ? "scale(1.08)" : "scale(1)",
                  zIndex: isDragging ? 10 : 1,
                  transition: "transform 0.15s ease",
                }}
              >
                <img
                  src={p.url}
                  alt="Product"
                  draggable={false}
                  style={{
                    width: "100%",
                    height: 90,
                    objectFit: "cover",
                    borderRadius: 8,
                    border: isSelected ? "2px solid #d32f2f" : isDragging ? "2px solid #2e7d32" : "1px solid #e0e0e0",
                    boxShadow: isDragging ? "0 6px 16px rgba(0,0,0,0.3)" : "none",
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

      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", marginBottom: "0.6rem" }}>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: "0.3rem 0.7rem", borderRadius: 6, border: "1px solid #ccc",
              background: page === 0 ? "#f5f5f5" : "#fff", color: page === 0 ? "#bbb" : "#1976d2",
              fontSize: "0.78rem", fontWeight: 700, cursor: page === 0 ? "not-allowed" : "pointer",
            }}
          >
            ‹ Prev
          </button>
          <span style={{ fontSize: "0.78rem", color: "#666" }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{
              padding: "0.3rem 0.7rem", borderRadius: 6, border: "1px solid #ccc",
              background: page >= totalPages - 1 ? "#f5f5f5" : "#fff", color: page >= totalPages - 1 ? "#bbb" : "#1976d2",
              fontSize: "0.78rem", fontWeight: 700, cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
            }}
          >
            Next ›
          </button>
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
