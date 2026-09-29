"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { TITLE_MAX, DESCRIPTION_MAX, daysText, validateAd, normalizeUgandaPhone, type MarketspaceSettings } from "../../../convex/marketspaceShared";
import { FarmCoinIcon } from "../../components/icons/Brand";
import { compressImage, uploadToConvex } from "../../utils/imageCompress";
import { DISTRICTS, FONT, tint } from "./shared";

type Group = { _id: string; name: string; icon: string; color: string; categories: { _id: string; name: string; icon: string }[] };

export type EditableAd = {
  _id: string;
  kind: "offer" | "wanted";
  groupId: string;
  categoryId: string;
  title: string;
  description: string;
  priceUGX: number | null;
  priceUnit: string | null;
  negotiable: boolean;
  quantity: string | null;
  neededBy: string | null;
  district: string;
  locationDetail: string | null;
  contactPhone: string;
  photoIds: string[];
  photoUrls: string[];
};

/** Moves one photo to a new position; the first photo is the ad's cover. */
function movePhoto<T>(photos: T[], from: number, to: number): T[] {
  if (to < 0 || to >= photos.length || from === to) return photos;
  const next = [...photos];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function orderButton(disabled: boolean): React.CSSProperties {
  return {
    minWidth: 26,
    height: 26,
    padding: 0,
    borderRadius: 8,
    border: `1.5px solid ${disabled ? "#e0e0e0" : "#2e7d32"}`,
    background: "#fff",
    color: disabled ? "#ccc" : "#1b5e20",
    fontWeight: 800,
    fontSize: "1rem",
    lineHeight: 1,
    cursor: disabled ? "default" : "pointer",
  };
}

const PRICE_UNITS =["per kg", "per bag", "per tonne", "per animal", "per bird", "each", "per acre", "per hour", "per day", "per trip", "per visit"];

const label: React.CSSProperties = { display: "block", fontWeight: 700, fontSize: "0.85rem", margin: "0.9rem 0 0.35rem", color: "#333" };
const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "0.7rem", borderRadius: 10, border: "1.5px solid #d6d6d6", fontSize: "1rem", fontFamily: FONT, background: "#fff" };

/** Post a new ad or edit one of your own. Photos can come from the camera or the gallery. */
export function AdForm({
  sessionToken,
  groups,
  defaultPhone,
  settings,
  nextAd,
  farmcoinBalance,
  editing,
  onDone,
  onCancel,
}: {
  sessionToken: string;
  groups: Group[];
  defaultPhone: string | null;
  settings: MarketspaceSettings;
  nextAd: { free: boolean; freeAdsLeft: number; cost: number; days: number };
  farmcoinBalance: number | null;
  editing?: EditableAd | null;
  onDone: (message: string) => void;
  onCancel?: () => void;
}) {
  const createAd = useMutation(api.marketspace.createAd);
  const updateAd = useMutation(api.marketspace.updateAd);
  const generateUploadUrl = useMutation(api.marketspace.generatePhotoUploadUrl);

  const [kind, setKind] = useState<"offer" | "wanted">(editing?.kind ?? "offer");
  const [groupId, setGroupId] = useState<string>(editing?.groupId ?? groups[0]?._id ?? "");
  const [categoryId, setCategoryId] = useState<string>(editing?.categoryId ?? "");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [price, setPrice] = useState(editing?.priceUGX != null ? String(editing.priceUGX) : "");
  const [priceUnit, setPriceUnit] = useState(editing?.priceUnit ?? "");
  const [negotiable, setNegotiable] = useState(editing?.negotiable ?? false);
  const [quantity, setQuantity] = useState(editing?.quantity ?? "");
  const [neededBy, setNeededBy] = useState(editing?.neededBy ?? "");
  const [district, setDistrict] = useState(editing?.district ?? "");
  const [locationDetail, setLocationDetail] = useState(editing?.locationDetail ?? "");
  const [phone, setPhone] = useState(editing?.contactPhone ?? defaultPhone ?? "");
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>(
    editing ? editing.photoIds.map((id, i) => ({ id, url: editing.photoUrls[i] ?? "" })) : []
  );
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const group = groups.find((g) => g._id === groupId);
  const wanted = kind === "wanted";
  const maxPhotos = settings.maxPhotosPerAd;
  const cannotAfford = !editing && nextAd.cost > 0 && (farmcoinBalance ?? 0) < nextAd.cost;

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = maxPhotos - photos.length;
    const picked = Array.from(files).slice(0, room);
    if (files.length > room) setError(`You can add up to ${maxPhotos} photo${maxPhotos === 1 ? "" : "s"}.`);
    setUploading((n) => n + picked.length);
    for (const file of picked) {
      try {
        const blob = await compressImage(file, 1280, 0.75);
        const uploadUrl = await generateUploadUrl({ sessionToken });
        const id = await uploadToConvex(uploadUrl, blob);
        setPhotos((p) => [...p, { id, url: URL.createObjectURL(blob) }]);
      } catch (e: any) {
        setError(e?.message ?? "A photo could not be added.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const submit = async () => {
    setError(null);
    if (!categoryId) return setError("Choose a category.");
    const priceUGX = price.trim() === "" ? undefined : Number(price);
    const problem = validateAd({
      kind,
      title,
      description,
      priceUGX,
      priceUnit,
      negotiable,
      quantity,
      neededBy: wanted ? neededBy : undefined,
      district,
      locationDetail,
      contactPhone: phone,
      photoCount: photos.length,
    }, maxPhotos);
    if (problem) return setError(problem);
    if (!editing && nextAd.cost > 0 && !window.confirm(`Post this ad for ${nextAd.cost} FarmCoin? It stays up for ${daysText(nextAd.days)}.`)) return;
    const payload = {
      sessionToken,
      kind,
      categoryId: categoryId as Id<"marketspaceCategories">,
      title,
      description,
      photoIds: photos.map((p) => p.id as Id<"_storage">),
      priceUGX,
      priceUnit: priceUnit || undefined,
      negotiable,
      quantity: quantity || undefined,
      neededBy: wanted && neededBy ? neededBy : undefined,
      district,
      locationDetail: locationDetail || undefined,
      contactPhone: phone,
    };
    setSaving(true);
    try {
      if (editing) {
        await updateAd({ ...payload, adId: editing._id as Id<"marketspaceAds"> });
        onDone("Your ad was updated.");
      } else {
        const result = await createAd({ ...payload, expectedCostFarmcoin: nextAd.cost });
        onDone(`Your ad is live on Marketspace for ${daysText(result.days)}${result.cost > 0 ? ` (${result.cost} FarmCoin paid)` : ""}.`);
      }
    } catch (e: any) {
      setError(e?.message?.replace(/^.*Uncaught Error: /, "").split("\n")[0] ?? "Could not save the ad.");
    } finally {
      setSaving(false);
    }
  };

  const kindButton = (value: "offer" | "wanted", title: string, sub: string) => {
    const active = kind === value;
    const color = value === "wanted" ? "#b8860b" : "#2e7d32";
    return (
      <button
        type="button"
        onClick={() => setKind(value)}
        style={{
          flex: 1,
          padding: "0.75rem 0.5rem",
          borderRadius: 12,
          border: `2px ${value === "wanted" ? "dashed" : "solid"} ${active ? color : "#ddd"}`,
          background: active ? (value === "wanted" ? "#fff8e1" : "#e8f5e9") : "#fff",
          fontFamily: FONT,
          cursor: "pointer",
          textAlign: "center",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: "1rem", color: active ? color : "#333" }}>{title}</div>
        <div style={{ fontSize: "0.75rem", color: "#666", marginTop: 2 }}>{sub}</div>
      </button>
    );
  };

  return (
    <div style={{ fontFamily: FONT, maxWidth: 560, margin: "0 auto" }}>
      <span style={label}>What kind of ad?</span>
      <div style={{ display: "flex", gap: "0.6rem" }}>
        {kindButton("offer", "I'm offering", "Selling goods or providing a service")}
        {kindButton("wanted", "I'm looking for", "I need goods or a service")}
      </div>

      <span style={label}>Group</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {groups.map((g) => (
          <button
            key={g._id}
            type="button"
            onClick={() => {
              setGroupId(g._id);
              setCategoryId("");
            }}
            style={{
              padding: "0.55rem 0.9rem",
              borderRadius: 999,
              border: `2px solid ${groupId === g._id ? g.color : "#ddd"}`,
              background: groupId === g._id ? tint(g.color, 0.12) : "#fff",
              color: groupId === g._id ? g.color : "#333",
              fontWeight: 700,
              fontFamily: FONT,
              cursor: "pointer",
            }}
          >
            {g.icon} {g.name}
          </button>
        ))}
      </div>

      {group && (
        <>
          <span style={label}>Category</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {group.categories.map((c) => (
              <button
                key={c._id}
                type="button"
                onClick={() => setCategoryId(c._id)}
                style={{
                  padding: "0.5rem 0.8rem",
                  borderRadius: 10,
                  border: `2px solid ${categoryId === c._id ? group.color : "#ddd"}`,
                  background: categoryId === c._id ? tint(group.color, 0.12) : "#fff",
                  fontWeight: 600,
                  fontFamily: FONT,
                  cursor: "pointer",
                }}
              >
                {c.icon} {c.name}
              </button>
            ))}
            {group.categories.length === 0 && <span style={{ color: "#888", fontSize: "0.85rem" }}>No categories in this group yet.</span>}
          </div>
        </>
      )}

      <label style={label} htmlFor="ms-title">
        {wanted ? "What are you looking for?" : "What are you offering?"}
      </label>
      <input
        id="ms-title"
        value={title}
        maxLength={TITLE_MAX}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={wanted ? "e.g. 2 tonnes of dry maize" : "e.g. Tractor for hire, with driver"}
        style={input}
      />

      <label style={label} htmlFor="ms-desc">
        Details <span style={{ fontWeight: 400, color: "#888" }}>(optional)</span>
      </label>
      <textarea
        id="ms-desc"
        value={description}
        maxLength={DESCRIPTION_MAX}
        rows={4}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={wanted ? "Quality, variety, delivery needs…" : "Condition, variety, what is included…"}
        style={{ ...input, resize: "vertical" }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
        <div>
          <label style={label} htmlFor="ms-price">
            {wanted ? "Budget (UGX)" : "Price (UGX)"} {wanted && <span style={{ fontWeight: 400, color: "#888" }}>(optional)</span>}
          </label>
          <input id="ms-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} placeholder="e.g. 900" style={input} />
        </div>
        <div>
          <label style={label} htmlFor="ms-unit">
            Per
          </label>
          <input id="ms-unit" list="ms-units" value={priceUnit} onChange={(e) => setPriceUnit(e.target.value)} placeholder="per kg" style={input} />
          <datalist id="ms-units">
            {PRICE_UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.6rem", fontSize: "0.92rem" }}>
        <input type="checkbox" checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)} style={{ width: 20, height: 20 }} />
        Price is negotiable
      </label>

      <div style={{ display: "grid", gridTemplateColumns: wanted ? "1fr 1fr" : "1fr", gap: "0.6rem" }}>
        <div>
          <label style={label} htmlFor="ms-qty">
            {wanted ? "Quantity needed" : "Quantity available"} <span style={{ fontWeight: 400, color: "#888" }}>(optional)</span>
          </label>
          <input id="ms-qty" value={quantity} maxLength={60} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 20 bags" style={input} />
        </div>
        {wanted && (
          <div>
            <label style={label} htmlFor="ms-needed">
              Needed by <span style={{ fontWeight: 400, color: "#888" }}>(optional)</span>
            </label>
            <input id="ms-needed" type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} style={input} />
          </div>
        )}
      </div>

      <label style={label} htmlFor="ms-district">
        District
      </label>
      <select id="ms-district" value={district} onChange={(e) => setDistrict(e.target.value)} style={input}>
        <option value="">Choose district…</option>
        {DISTRICTS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <label style={label} htmlFor="ms-loc">
        Village / town <span style={{ fontWeight: 400, color: "#888" }}>(optional)</span>
      </label>
      <input id="ms-loc" value={locationDetail} maxLength={120} onChange={(e) => setLocationDetail(e.target.value)} placeholder="e.g. Nakaloke trading centre" style={input} />

      <label style={label} htmlFor="ms-phone">
        Contact phone for this ad
      </label>
      <input id="ms-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0772 123456" style={input} />
      <div style={{ fontSize: "0.78rem", color: phone && !normalizeUgandaPhone(phone) ? "#c62828" : "#777", marginTop: 4 }}>
        {phone && !normalizeUgandaPhone(phone) ? "Enter a Ugandan number, e.g. 0772 123456." : "Shown publicly on the ad with Call and WhatsApp buttons."}
      </div>

      <span style={label}>
        Photos <span style={{ fontWeight: 400, color: "#888" }}>(up to {maxPhotos})</span>
      </span>
      {photos.length > 1 && (
        <div style={{ fontSize: "0.78rem", color: "#777", margin: "-0.1rem 0 0.5rem" }}>The first photo is the cover on the ad card. Use ‹ › to change the order, or ★ to make a photo the cover.</div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {photos.map((p, i) => (
          <div key={p.id} style={{ width: 84 }}>
            <div style={{ position: "relative", width: 84, height: 84 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`Photo ${i + 1}`} style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10, background: "#eee", outline: i === 0 ? "3px solid #f6bf26" : "none" }} />
              {i === 0 && (
                <span style={{ position: "absolute", left: 4, bottom: 4, background: "#f6bf26", color: "#1a1a1a", borderRadius: 999, padding: "0.05rem 0.4rem", fontSize: "0.65rem", fontWeight: 800 }}>★ Cover</span>
              )}
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => setPhotos((all) => all.filter((x) => x.id !== p.id))}
                style={{ position: "absolute", top: -8, right: -8, width: 26, height: 26, borderRadius: 999, border: "none", background: "#c62828", color: "#fff", cursor: "pointer", fontWeight: 800 }}
              >
                ×
              </button>
            </div>
            {photos.length > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 4, marginTop: 4 }}>
                <button type="button" aria-label={`Move photo ${i + 1} left`} disabled={i === 0} onClick={() => setPhotos((all) => movePhoto(all, i, i - 1))} style={orderButton(i === 0)}>
                  ‹
                </button>
                {i > 0 && (
                  <button type="button" aria-label={`Make photo ${i + 1} the cover`} title="Make cover" onClick={() => setPhotos((all) => movePhoto(all, i, 0))} style={{ ...orderButton(false), flex: 1, fontSize: "0.8rem" }}>
                    ★
                  </button>
                )}
                <button type="button" aria-label={`Move photo ${i + 1} right`} disabled={i === photos.length - 1} onClick={() => setPhotos((all) => movePhoto(all, i, i + 1))} style={orderButton(i === photos.length - 1)}>
                  ›
                </button>
              </div>
            )}
          </div>
        ))}
        {uploading > 0 && (
          <div style={{ width: 84, height: 84, borderRadius: 10, background: "#f1f8e9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", color: "#2e7d32" }}>Uploading…</div>
        )}
      </div>
      {photos.length + uploading < maxPhotos && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
          <button type="button" onClick={() => cameraRef.current?.click()} style={{ flex: 1, minHeight: 46, borderRadius: 10, border: "1.5px solid #2e7d32", background: "#fff", color: "#1b5e20", fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}>
            📷 Take photo
          </button>
          <button type="button" onClick={() => galleryRef.current?.click()} style={{ flex: 1, minHeight: 46, borderRadius: 10, border: "1.5px solid #2e7d32", background: "#fff", color: "#1b5e20", fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}>
            🖼️ From gallery
          </button>
        </div>
      )}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {!editing && (
        <div
          style={{
            marginTop: "1.1rem",
            padding: "0.7rem 0.85rem",
            borderRadius: 12,
            background: nextAd.free ? "#e8f5e9" : "#fff8e1",
            border: `1.5px solid ${nextAd.free ? "#a5d6a7" : "#f6bf26"}`,
            fontSize: "0.9rem",
            color: "#333",
            lineHeight: 1.45,
          }}
        >
          {nextAd.free ? (
            <>
              <strong>Free ad.</strong> You have {nextAd.freeAdsLeft} of {settings.freeAdsPerAccount} free ad{settings.freeAdsPerAccount === 1 ? "" : "s"} left. It stays up for {daysText(nextAd.days)}.
            </>
          ) : (
            <>
              <strong>Paid ad.</strong> You have used your {settings.freeAdsPerAccount} free ad{settings.freeAdsPerAccount === 1 ? "" : "s"}.{" "}
              {nextAd.cost > 0 ? (
                <>
                  This ad costs <FarmCoinIcon size={15} /> <strong>{nextAd.cost} FarmCoin</strong> and stays up for {daysText(nextAd.days)}.
                  {farmcoinBalance !== null && <> Your balance: {farmcoinBalance}.</>}
                </>
              ) : (
                <>Posting is free for now and the ad stays up for {daysText(nextAd.days)}.</>
              )}
            </>
          )}
          {cannotAfford && (
            <div style={{ marginTop: 6, color: "#c62828", fontWeight: 700 }}>
              Not enough FarmCoin. <a href="/wallet" style={{ color: "#1b5e20" }}>Buy FarmCoin in My Wallet →</a>
            </div>
          )}
        </div>
      )}

      {error && <div style={{ marginTop: "1rem", padding: "0.6rem 0.75rem", borderRadius: 10, background: "#ffebee", color: "#c62828", fontWeight: 600, fontSize: "0.9rem" }}>{error}</div>}

      <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.2rem" }}>
        {onCancel && (
          <button type="button" onClick={onCancel} style={{ flex: 1, minHeight: 52, borderRadius: 12, border: "1.5px solid #ccc", background: "#fff", fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}>
            Cancel
          </button>
        )}
        <button
          type="button"
          disabled={saving || uploading > 0 || cannotAfford}
          onClick={submit}
          style={{ flex: 2, minHeight: 52, borderRadius: 12, border: "none", background: "#2e7d32", color: "#fff", fontWeight: 800, fontSize: "1.05rem", fontFamily: FONT, cursor: "pointer", opacity: saving || uploading > 0 || cannotAfford ? 0.6 : 1 }}
        >
          {saving
            ? "Saving…"
            : editing
              ? "Save changes"
              : nextAd.cost > 0
                ? `Post ad for ${nextAd.cost} FarmCoin`
                : `Post ad${nextAd.free ? " free" : ""} (${daysText(nextAd.days)})`}
        </button>
      </div>
    </div>
  );
}
