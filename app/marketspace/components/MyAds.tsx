"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { daysLeft, daysText, type MarketspaceSettings } from "../../../convex/marketspaceShared";
import { FarmCoinIcon } from "../../components/icons/Brand";
import type { EditableAd } from "./AdForm";
import { FONT, formatDate, priceLine, type AdCardData } from "./shared";

type MyAd = AdCardData & { photoIds: string[]; hidden: boolean; removedReason: string | null };

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Live", color: "#1b5e20", bg: "#e8f5e9" },
  expired: { label: "Expired", color: "#6d4c00", bg: "#fff8e1" },
  sold: { label: "Sold", color: "#37474f", bg: "#eceff1" },
  removed: { label: "Removed by admin", color: "#c62828", bg: "#ffebee" },
};

/** The signed-in user's ads: edit, mark sold, delete, extend or revive. */
export function MyAds({
  sessionToken,
  now,
  farmcoinBalance,
  settings,
  onEdit,
  onPostNew,
}: {
  sessionToken: string;
  now: number;
  farmcoinBalance: number | null;
  settings: MarketspaceSettings;
  onEdit: (ad: EditableAd) => void;
  onPostNew: () => void;
}) {
  const ads = useQuery(api.marketspace.myAds, { sessionToken }) as MyAd[] | undefined;
  const extendAd = useMutation(api.marketspace.extendAd);
  const markSold = useMutation(api.marketspace.markSold);
  const deleteAd = useMutation(api.marketspace.deleteAd);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (adId: string, action: () => Promise<unknown>, done: string) => {
    setBusy(adId);
    setMessage(null);
    try {
      await action();
      setMessage({ ok: true, text: done });
    } catch (e: any) {
      setMessage({ ok: false, text: e?.message?.replace(/^.*Uncaught Error: /, "").split("\n")[0] ?? "Something went wrong." });
    } finally {
      setBusy(null);
    }
  };

  if (ads === undefined) return <p style={{ fontFamily: FONT, textAlign: "center", color: "#777" }}>Loading your ads…</p>;

  const extensionCost = settings.extensionCostFarmcoin;
  const extension = daysText(settings.extensionDays);
  const costText = extensionCost > 0 ? `${extensionCost} FarmCoin` : "free";
  const btn = (color: string, filled = false): React.CSSProperties => ({
    minHeight: 40,
    padding: "0 0.8rem",
    borderRadius: 10,
    border: `1.5px solid ${color}`,
    background: filled ? color : "#fff",
    color: filled ? "#fff" : color,
    fontWeight: 700,
    fontSize: "0.82rem",
    fontFamily: FONT,
    cursor: "pointer",
  });

  return (
    <div style={{ fontFamily: FONT, maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <div style={{ fontSize: "0.85rem", color: "#555" }}>
          Extending an ad by {extension} costs <strong>{costText}</strong>.
          {farmcoinBalance !== null && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 6 }}>
              Your balance: <FarmCoinIcon size={16} /> <strong>{farmcoinBalance}</strong>
            </span>
          )}
        </div>
        <button type="button" onClick={onPostNew} style={btn("#2e7d32", true)}>
          ＋ Post an ad
        </button>
      </div>

      {message && (
        <div style={{ marginBottom: "0.75rem", padding: "0.6rem 0.75rem", borderRadius: 10, background: message.ok ? "#e8f5e9" : "#ffebee", color: message.ok ? "#1b5e20" : "#c62828", fontWeight: 600, fontSize: "0.9rem" }}>
          {message.text}
        </div>
      )}

      {ads.length === 0 && (
        <div style={{ textAlign: "center", padding: "2rem 1rem", border: "2px dashed #c8e6c9", borderRadius: 16, color: "#555" }}>
          You have no ads yet. Post one to sell, offer a service or say what you are looking for.
        </div>
      )}

      <div style={{ display: "grid", gap: "0.75rem" }}>
        {ads.map((ad) => {
          const live = ad.status === "active" && ad.expiresAt > now;
          const statusKey = ad.status === "active" && !live ? "expired" : ad.status;
          const s = STATUS[statusKey] ?? STATUS.active;
          const canExtend = ad.status === "active" || ad.status === "expired";
          const editable: EditableAd = {
            _id: ad._id,
            kind: ad.kind,
            groupId: ad.groupId,
            categoryId: ad.categoryId,
            title: ad.title,
            description: ad.description,
            priceUGX: ad.priceUGX,
            priceUnit: ad.priceUnit,
            negotiable: ad.negotiable,
            quantity: ad.quantity,
            neededBy: ad.neededBy,
            district: ad.district,
            locationDetail: ad.locationDetail,
            contactPhone: ad.contactPhone,
            photoIds: ad.photoIds,
            photoUrls: ad.photoUrls,
          };
          return (
            <div key={ad._id} style={{ display: "flex", gap: "0.75rem", padding: "0.75rem", borderRadius: 14, background: "#fff", border: `1.5px ${ad.kind === "wanted" ? "dashed" : "solid"} ${ad.groupColor}`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ width: 76, height: 76, flexShrink: 0, borderRadius: 10, overflow: "hidden", background: "#f3f3f3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>
                {ad.photoUrls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ad.photoUrls[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  ad.categoryIcon
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ padding: "0.1rem 0.5rem", borderRadius: 999, background: s.bg, color: s.color, fontWeight: 800, fontSize: "0.7rem" }}>{s.label}</span>
                  <span style={{ padding: "0.1rem 0.5rem", borderRadius: 999, background: ad.kind === "wanted" ? "#fff3c4" : "#f1f1f1", fontWeight: 700, fontSize: "0.7rem" }}>{ad.kind === "wanted" ? "WANTED" : "OFFER"}</span>
                  <span style={{ fontSize: "0.72rem", color: "#777" }}>
                    {ad.categoryIcon} {ad.categoryName}
                  </span>
                </div>
                <div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ad.title}</div>
                <div style={{ fontSize: "0.82rem", color: "#555" }}>
                  {priceLine(ad)} · 📍 {ad.district}
                </div>
                <div style={{ fontSize: "0.78rem", color: "#777", marginTop: 2 }}>
                  {live && `${daysLeft(ad.expiresAt, now)} day${daysLeft(ad.expiresAt, now) === 1 ? "" : "s"} left (until ${formatDate(ad.expiresAt)})`}
                  {statusKey === "expired" && `Expired ${formatDate(ad.expiresAt)}. Hidden from the board.`}
                  {ad.status === "removed" && `Reason: ${ad.removedReason ?? "not given"}`}
                  {ad.hidden && live && " · Its category is hidden by the admin, so it is not on the board right now."}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.55rem" }}>
                  {canExtend && (
                    <button
                      type="button"
                      disabled={busy === ad._id}
                      onClick={() => {
                        const verb = statusKey === "expired" ? "Bring this ad back" : "Extend this ad";
                        if (!window.confirm(`${verb} for ${extension}? Cost: ${costText}.`)) return;
                        run(ad._id, () => extendAd({ sessionToken, adId: ad._id as Id<"marketspaceAds"> }), `Done. Your ad has ${extension} more.`);
                      }}
                      style={btn("#2e7d32", true)}
                    >
                      {statusKey === "expired" ? "↺ Bring back" : `⏩ Extend ${extension}`} ({costText})
                    </button>
                  )}
                  {ad.status !== "removed" && (
                    <button type="button" onClick={() => onEdit(editable)} style={btn("#1565c0")}>
                      ✏️ Edit
                    </button>
                  )}
                  {live && (
                    <button
                      type="button"
                      disabled={busy === ad._id}
                      onClick={() => {
                        if (!window.confirm("Mark this ad as sold / done? It will leave the board.")) return;
                        run(ad._id, () => markSold({ sessionToken, adId: ad._id as Id<"marketspaceAds"> }), "Marked as sold.");
                      }}
                      style={btn("#37474f")}
                    >
                      ✓ {ad.kind === "wanted" ? "Found it" : "Mark sold"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy === ad._id}
                    onClick={() => {
                      if (!window.confirm("Delete this ad and its photos? This cannot be undone.")) return;
                      run(ad._id, () => deleteAd({ sessionToken, adId: ad._id as Id<"marketspaceAds"> }), "Ad deleted.");
                    }}
                    style={btn("#c62828")}
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
