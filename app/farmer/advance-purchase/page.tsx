"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import Link from "next/link";
import { useStoredUser } from "../../hooks/useStoredUser";
import { validateImageFile } from "../../utils/imageValidation";

const FONT = '"Montserrat", sans-serif';

interface PendingPhoto {
  previewUrl: string;
  storageId: Id<"_storage"> | null;
  uploading: boolean;
  error?: string;
}

function CreateOfferForm({ farmerId, config, onDone }: { farmerId: Id<"users">; config: any; onDone: () => void }) {
  const createOffer = useMutation(api.advancePurchase.createOffer);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const [productName, setProductName] = useState("");
  const [variety, setVariety] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [unit, setUnit] = useState(config.unitOptions?.[0] || "");
  const [unitPrice, setUnitPrice] = useState("");
  const [totalQuantity, setTotalQuantity] = useState("");
  const [recurrence, setRecurrence] = useState(config.recurrenceOptions?.[0] || "");
  const [cashComponent, setCashComponent] = useState("");
  const [inKindComponent, setInKindComponent] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editableFields = (config.customFields || []).filter((f: any) => f.farmerEditable);
  const uploadedPhotoIds = photos.map((p) => p.storageId).filter((id): id is Id<"_storage"> => !!id);
  const stillUploading = photos.some((p) => p.uploading);
  const canSubmit = !!productName.trim() && !!description.trim() && uploadedPhotoIds.length > 0 && !stillUploading;

  const MAX_PHOTOS = 4;

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, Math.max(0, MAX_PHOTOS - photos.length));
    e.target.value = "";
    for (const file of files) {
      const result = validateImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      if (!result.valid) {
        setPhotos((prev) => [...prev, { previewUrl, storageId: null, uploading: false, error: result.error }]);
        continue;
      }
      setPhotos((prev) => [...prev, { previewUrl, storageId: null, uploading: true }]);
      try {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        const { storageId } = await res.json();
        setPhotos((prev) => prev.map((p) => (p.previewUrl === previewUrl ? { ...p, storageId, uploading: false } : p)));
      } catch (err) {
        setPhotos((prev) => prev.map((p) => (p.previewUrl === previewUrl ? { ...p, uploading: false, error: "Upload failed" } : p)));
      }
    }
  };

  const removePhoto = (previewUrl: string) => {
    setPhotos((prev) => prev.filter((p) => p.previewUrl !== previewUrl));
  };

  const handleSubmit = async (publish: boolean) => {
    if (!canSubmit) {
      setError("Add a product name, description and at least one photo before saving");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createOffer({
        farmerId,
        configId: config._id,
        productName,
        variety: variety || undefined,
        description,
        photoStorageIds: uploadedPhotoIds,
        unit,
        unitPrice: Number(unitPrice),
        totalQuantity: Number(totalQuantity),
        recurrence,
        cashComponent: cashComponent ? Number(cashComponent) : undefined,
        inKindComponent: inKindComponent ? Number(inKindComponent) : undefined,
        customFieldValues: Object.entries(customValues).map(([key, value]) => {
          const field = editableFields.find((f: any) => f.key === key) || config.customFields.find((f: any) => f.key === key);
          return { key, label: field?.label || key, value };
        }),
        publish,
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: "1rem", marginBottom: "1rem" }}>
      <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>New offer — {config.name}</h3>
      {config.instructions && <p style={{ fontSize: "0.82rem", color: "#666", marginBottom: "0.75rem" }}>{config.instructions}</p>}

      <input placeholder="Product name" value={productName} onChange={(e) => setProductName(e.target.value)} style={inputStyle} />
      <input placeholder="Variety / type (optional)" value={variety} onChange={(e) => setVariety(e.target.value)} style={inputStyle} />

      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#333", marginBottom: "0.3rem" }}>
        Description *
      </label>
      <textarea
        placeholder="Describe and specify the product being offered (variety, quality, size, condition, etc.)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
        style={inputStyle}
      />

      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#333", marginBottom: "0.3rem" }}>
        Photo gallery of the finished product / offering * ({photos.length}/{MAX_PHOTOS})
      </label>
      <input
        type="file"
        accept="image/*"
        multiple
        disabled={photos.length >= MAX_PHOTOS}
        onChange={handlePhotoSelect}
        style={{ marginBottom: "0.5rem" }}
      />
      {photos.length >= MAX_PHOTOS && (
        <p style={{ fontSize: "0.78rem", color: "#888", margin: "0 0 0.5rem" }}>
          Maximum of {MAX_PHOTOS} photos reached. Remove one to add another.
        </p>
      )}
      {photos.length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
          {photos.map((p) => (
            <div key={p.previewUrl} style={{ position: "relative", width: 84, height: 84 }}>
              <img
                src={p.previewUrl}
                alt="Product"
                style={{
                  width: 84, height: 84, objectFit: "cover", borderRadius: 8,
                  border: p.error ? "2px solid #d32f2f" : "1px solid #ccc",
                  opacity: p.uploading ? 0.5 : 1,
                }}
              />
              {p.uploading && (
                <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "#333" }}>
                  Uploading…
                </span>
              )}
              <button
                type="button"
                onClick={() => removePhoto(p.previewUrl)}
                style={{
                  position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%",
                  border: "none", background: "#d32f2f", color: "#fff", fontSize: "0.7rem", cursor: "pointer", lineHeight: "20px", padding: 0,
                }}
              >
                ✕
              </button>
              {p.error && (
                <span style={{ position: "absolute", bottom: -18, left: 0, fontSize: "0.65rem", color: "#d32f2f", whiteSpace: "nowrap" }}>
                  {p.error}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <select value={unit} onChange={(e) => setUnit(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
          <option value="">Unit</option>
          {(config.unitOptions || []).map((u: string) => <option key={u} value={u}>{u}</option>)}
        </select>
        <input placeholder="Total quantity" type="number" value={totalQuantity} onChange={(e) => setTotalQuantity(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
      </div>
      <input placeholder="Unit price (UGX)" type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} style={inputStyle} />

      <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} style={inputStyle}>
        {(config.recurrenceOptions || []).map((r: string) => (
          <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
        ))}
      </select>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input placeholder="Cash component (optional)" type="number" value={cashComponent} onChange={(e) => setCashComponent(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        <input placeholder="In-kind component (optional)" type="number" value={inKindComponent} onChange={(e) => setInKindComponent(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
      </div>

      {editableFields.map((f: any) => (
        <input
          key={f.key}
          placeholder={f.label}
          value={customValues[f.key] || ""}
          onChange={(e) => setCustomValues((v) => ({ ...v, [f.key]: e.target.value }))}
          style={inputStyle}
        />
      ))}

      {!canSubmit && !stillUploading && (
        <p style={{ fontSize: "0.78rem", color: "#888", margin: "0 0 0.4rem" }}>
          Product name, description and at least one photo are required.
        </p>
      )}
      {error && <p style={{ color: "#d32f2f", fontSize: "0.85rem" }}>{error}</p>}

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button disabled={busy || !canSubmit} onClick={() => handleSubmit(true)} style={{ ...primaryBtn, opacity: busy || !canSubmit ? 0.6 : 1, cursor: busy || !canSubmit ? "not-allowed" : "pointer" }}>
          Publish offer
        </button>
        <button disabled={busy || !canSubmit} onClick={() => handleSubmit(false)} style={{ ...secondaryBtn, opacity: busy || !canSubmit ? 0.6 : 1, cursor: busy || !canSubmit ? "not-allowed" : "pointer" }}>
          Save as draft
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem",
  borderRadius: 8,
  border: "1px solid #ccc",
  marginBottom: "0.6rem",
  fontFamily: FONT,
  boxSizing: "border-box",
};
const primaryBtn: React.CSSProperties = {
  flex: 1, padding: "0.75rem", background: "#2e7d32", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer",
};
const secondaryBtn: React.CSSProperties = {
  flex: 1, padding: "0.75rem", background: "#eee", color: "#333", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer",
};

export default function FarmerAdvancePurchasePage() {
  const { user, status } = useStoredUser();
  const configs = useQuery(
    api.advancePurchase.listConfigsAvailableToFarmer,
    user ? { farmerId: user.userId as any } : "skip"
  );
  const myOffers = useQuery(
    api.advancePurchase.listMyOffers,
    user ? { farmerId: user.userId as any } : "skip"
  );
  const publishOffer = useMutation(api.advancePurchase.publishOffer);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);

  if (status === "loading" || configs === undefined || myOffers === undefined) {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading Advance Purchase...</div>;
  }
  if (!user || !["farmer", "vendor", "store"].includes(user.role)) {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>Please log in as a farmer.</div>;
  }

  const activeConfig = configs.find((c: any) => c._id === creatingFor);

  return (
    <div style={{ padding: "1rem", maxWidth: 640, margin: "0 auto", fontFamily: FONT }}>
      <div style={{ marginBottom: "1rem" }}>
        <Link href="/" style={{ color: "#1976d2", fontWeight: 600, fontSize: "0.9rem" }}>← Back to Dashboard</Link>
      </div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}>🌱 Advance Purchase</h1>
      <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1.25rem" }}>
        Publish a recurring advance-purchase offer using your community&apos;s configuration, then track buyer commitments and milestone payments.
      </p>

      {activeConfig ? (
        <CreateOfferForm farmerId={user.userId as any} config={activeConfig} onDone={() => setCreatingFor(null)} />
      ) : (
        <div style={{ marginBottom: "1.25rem" }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.5rem" }}>Create a new offer</h2>
          {configs.length === 0 && (
            <div style={{ padding: "1rem", background: "#fafafa", border: "1px dashed #ccc", borderRadius: 10, color: "#777", fontSize: "0.88rem" }}>
              No advance purchase form configured for your communities yet.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {configs.map((c: any) => (
              <button
                key={c._id}
                onClick={() => setCreatingFor(c._id)}
                style={{
                  textAlign: "left",
                  padding: "0.85rem 1rem",
                  background: "#e8f5e9",
                  border: "1px solid #a5d6a7",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: FONT,
                }}
              >
                <div style={{ fontWeight: 700, color: "#2e7d32" }}>{c.name}</div>
                <div style={{ fontSize: "0.8rem", color: "#666" }}>{c.communityName} · {c.productCategory}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <h2 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.5rem" }}>My offers</h2>
      {myOffers.length === 0 ? (
        <div style={{ padding: "1rem", background: "#fafafa", border: "1px dashed #ccc", borderRadius: 10, color: "#777", fontSize: "0.88rem" }}>
          You have no active advance purchase offers.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {myOffers.map((o: any) => (
            <div key={o._id} style={{ padding: "0.85rem 1rem", background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  {o.photoUrls?.[0] && (
                    <img src={o.photoUrls[0]} alt={o.productName} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 700 }}>{o.productName}</div>
                    <div style={{ fontSize: "0.8rem", color: "#888" }}>
                      {o.quantityCommitted}/{o.totalQuantity} {o.unit} committed · {o.status}
                    </div>
                  </div>
                </div>
                {o.status === "draft" ? (
                  <button
                    onClick={() => publishOffer({ offerId: o._id, farmerId: user.userId as any })}
                    style={{ padding: "0.5rem 0.9rem", background: "#2e7d32", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
                  >
                    Publish
                  </button>
                ) : (
                  <Link href={`/farmer/advance-purchase/${o._id}/progress`} style={{ color: "#1976d2", fontWeight: 700, fontSize: "0.85rem" }}>
                    View progress →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
