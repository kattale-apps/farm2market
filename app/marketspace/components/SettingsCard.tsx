"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { SETTING_LIMITS, validateSettings, type MarketspaceSettings } from "../../../convex/marketspaceShared";
import { FONT, formatDate } from "./shared";

type Key = keyof MarketspaceSettings;

const SECTIONS: { title: string; note: string; keys: { key: Key; unit: string }[] }[] = [
  {
    title: "Free ads",
    note: "Each account gets this many free ads over its lifetime. Deleting an ad does not give a free ad back.",
    keys: [
      { key: "freeAdsPerAccount", unit: "ads" },
      { key: "freeAdDays", unit: "days" },
    ],
  },
  {
    title: "Paid ads",
    note: "Ads posted after an account's free ads are used up.",
    keys: [
      { key: "paidAdCostFarmcoin", unit: "FarmCoin" },
      { key: "paidAdDays", unit: "days" },
    ],
  },
  {
    title: "Extensions",
    note: "Keeping an ad up longer, or bringing an expired ad back.",
    keys: [
      { key: "extensionCostFarmcoin", unit: "FarmCoin" },
      { key: "extensionDays", unit: "days" },
    ],
  },
  {
    title: "Limits",
    note: "Anti-spam and photo limits for every advertiser.",
    keys: [
      { key: "maxPhotosPerAd", unit: "photos" },
      { key: "maxAdsPerDay", unit: "ads" },
    ],
  },
];

const errorText = (e: any) => e?.message?.replace(/^.*Uncaught Error: /, "").split("\n")[0] ?? "Could not save.";

/** Super admin: every Marketspace period, price and limit. */
export function SettingsCard({ token }: { token: string }) {
  const data = useQuery(api.marketspace.adminSettings, { sessionToken: token });
  const saveSettings = useMutation(api.marketspace.saveSettings);
  const [draft, setDraft] = useState<Record<Key, string> | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (data && !draft) {
      setDraft(Object.fromEntries(Object.entries(data.settings).map(([k, v]) => [k, String(v)])) as Record<Key, string>);
    }
  }, [data, draft]);

  if (data === undefined || (data && !draft)) return <p>Loading…</p>;
  if (data === null || !draft) return <p>Only the super admin can change Marketspace settings.</p>;

  const values = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim() === "" ? NaN : Number(v)])) as MarketspaceSettings;
  const changed = (Object.keys(draft) as Key[]).some((k) => values[k] !== data.settings[k]);

  const save = async () => {
    setMessage(null);
    const problem = validateSettings(values);
    if (problem) return setMessage({ ok: false, text: problem });
    try {
      await saveSettings({ sessionToken: token, reason, ...values });
      setMessage({ ok: true, text: "Settings saved. They apply to new ads and extensions from now on; ads already live keep their end dates." });
      setReason("");
    } catch (e) {
      setMessage({ ok: false, text: errorText(e) });
    }
  };

  return (
    <div style={{ fontFamily: FONT, display: "grid", gap: "0.9rem", maxWidth: 640 }}>
      <p style={{ margin: 0, color: "#555", fontSize: "0.9rem" }}>
        Every Marketspace period, price and limit is set here. Changes apply to new ads and extensions; ads already live keep their end dates.
        {data.updatedAt ? ` Last saved ${formatDate(data.updatedAt)}.` : " Nothing saved yet: the values below are the starting defaults."}
      </p>
      {SECTIONS.map((section) => (
        <div key={section.title} style={{ background: "#fff", borderRadius: 12, padding: "0.9rem 1rem", boxShadow: "0 1px 6px rgba(0,0,0,0.08)" }}>
          <h3 style={{ margin: "0 0 0.2rem", fontSize: "1rem" }}>{section.title}</h3>
          <p style={{ margin: "0 0 0.7rem", color: "#666", fontSize: "0.82rem" }}>{section.note}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "0.7rem" }}>
            {section.keys.map(({ key, unit }) => {
              const limit = SETTING_LIMITS[key];
              return (
                <label key={key} style={{ display: "grid", gap: 4, fontSize: "0.85rem", fontWeight: 700, color: "#333" }}>
                  <span>
                    {limit.label}
                    {!data.saved[key] && <span style={{ marginLeft: 6, fontWeight: 600, fontSize: "0.7rem", color: "#8a6d00", background: "#fff8e1", borderRadius: 999, padding: "0.05rem 0.4rem" }}>default</span>}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={limit.min}
                      max={limit.max}
                      step={1}
                      value={draft[key]}
                      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                      style={{ width: 110, padding: "0.55rem", borderRadius: 8, border: "1px solid #ccc", fontSize: "1rem", fontFamily: FONT }}
                    />
                    <span style={{ fontWeight: 500, color: "#666" }}>{unit}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for change (kept in the admin log)" style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ccc", fontFamily: FONT }} />
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" disabled={!changed} onClick={save} style={{ minHeight: 44, padding: "0 1.2rem", borderRadius: 10, border: "none", background: "#2e7d32", color: "#fff", fontWeight: 800, fontFamily: FONT, cursor: changed ? "pointer" : "default", opacity: changed ? 1 : 0.5 }}>
          Save settings
        </button>
        {changed && (
          <button
            type="button"
            onClick={() => setDraft(Object.fromEntries(Object.entries(data.settings).map(([k, v]) => [k, String(v)])) as Record<Key, string>)}
            style={{ minHeight: 44, padding: "0 1rem", borderRadius: 10, border: "1.5px solid #ccc", background: "#fff", fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}
          >
            Undo changes
          </button>
        )}
      </div>
      {message && <div style={{ padding: "0.6rem 0.75rem", borderRadius: 10, background: message.ok ? "#e8f5e9" : "#ffebee", color: message.ok ? "#1b5e20" : "#c62828", fontWeight: 600 }}>{message.text}</div>}
    </div>
  );
}
