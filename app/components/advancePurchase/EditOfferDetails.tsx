"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

const FONT = '"Montserrat", sans-serif';

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.6rem", borderRadius: 8, border: "1px solid #ccc", marginBottom: "0.6rem", fontFamily: FONT, boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#333", marginBottom: "0.3rem",
};

interface Props {
  farmerId: Id<"users">;
  offer: {
    _id: Id<"advancePurchaseOffers">;
    productName: string;
    variety?: string;
    description?: string;
    unit: string;
    unitPrice: number;
    totalQuantity: number;
    quantityCommitted: number;
    productionLocation?: string;
    deliveryLocation?: string;
  };
}

export function EditOfferDetails({ farmerId, offer }: Props) {
  const updateOffer = useMutation(api.advancePurchase.updateOffer);
  const [editing, setEditing] = useState(false);
  const [productName, setProductName] = useState(offer.productName);
  const [variety, setVariety] = useState(offer.variety || "");
  const [description, setDescription] = useState(offer.description || "");
  const [unitPrice, setUnitPrice] = useState(String(offer.unitPrice));
  const [totalQuantity, setTotalQuantity] = useState(String(offer.totalQuantity));
  const [productionLocation, setProductionLocation] = useState(offer.productionLocation || "");
  const [deliveryLocation, setDeliveryLocation] = useState(offer.deliveryLocation || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await updateOffer({
        offerId: offer._id,
        farmerId,
        productName,
        variety: variety || undefined,
        description,
        unitPrice: Number(unitPrice),
        totalQuantity: Number(totalQuantity),
        productionLocation: productionLocation || undefined,
        deliveryLocation: deliveryLocation || undefined,
      });
      setSaved(true);
      setEditing(false);
    } catch (err) {
      setError((err as Error).message || "Failed to save changes");
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <div style={{ marginTop: "0.4rem" }}>
        <button
          type="button"
          onClick={() => { setEditing(true); setSaved(false); }}
          style={{
            padding: "0.4rem 0.75rem",
            background: "#eef4ff",
            border: "1px solid #90caf9",
            borderRadius: 8,
            color: "#1565c0",
            fontSize: "0.78rem",
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: FONT,
          }}
        >
          ✏️ Edit offer details
        </button>
        {saved && <span style={{ marginLeft: "0.5rem", fontSize: "0.78rem", color: "#2e7d32", fontWeight: 600 }}>Saved</span>}
      </div>
    );
  }

  return (
    <div style={{ marginTop: "0.6rem", padding: "0.85rem", background: "#f8fafc", border: "1px solid #e0e0e0", borderRadius: 10, fontFamily: FONT }}>
      <label style={labelStyle}>Product name</label>
      <input value={productName} onChange={(e) => setProductName(e.target.value)} style={inputStyle} />

      <label style={labelStyle}>Variety / type</label>
      <input value={variety} onChange={(e) => setVariety(e.target.value)} style={inputStyle} />

      <label style={labelStyle}>Description</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Unit price (UGX)</label>
          <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Total quantity ({offer.unit})</label>
          <input type="number" value={totalQuantity} onChange={(e) => setTotalQuantity(e.target.value)} style={inputStyle} />
          {offer.quantityCommitted > 0 && (
            <p style={{ fontSize: "0.7rem", color: "#888", margin: "-0.4rem 0 0.6rem" }}>
              Can't go below {offer.quantityCommitted} {offer.unit} already committed
            </p>
          )}
        </div>
      </div>

      <label style={labelStyle}>Production location</label>
      <input value={productionLocation} onChange={(e) => setProductionLocation(e.target.value)} style={inputStyle} />

      <label style={labelStyle}>Delivery location</label>
      <input value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} style={inputStyle} />

      {error && <p style={{ color: "#d32f2f", fontSize: "0.82rem", margin: "0 0 0.5rem" }}>{error}</p>}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || !productName.trim() || !description.trim() || Number(unitPrice) <= 0 || Number(totalQuantity) <= 0}
          style={{
            flex: 1, padding: "0.65rem", background: "#2e7d32", color: "#fff", border: "none", borderRadius: 8,
            fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={busy}
          style={{ padding: "0.65rem 1rem", background: "#eee", color: "#333", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
