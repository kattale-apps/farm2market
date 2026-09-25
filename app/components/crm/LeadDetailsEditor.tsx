"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { fromStoredUgandaTime, UGANDA_TIME_ZONE } from "../../utils/timeUtils";

/**
 * Lets a supervisor correct what was captured on a lead at intake. Location is
 * stored on the submission as names, so the dropdowns work in names too and a
 * value that is no longer in the location list stays selectable as it is.
 */

const CROP_OPTIONS = ["Coffee", "Maize", "Beans", "Groundnuts", "Rice", "Tomatoes", "Pineapple", "Bananas", "Other"];
const MONTH_OPTIONS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const inputStyle: CSSProperties = {
  width: "100%", padding: "0.4rem 0.55rem", borderRadius: 8, border: "1px solid #d1d5db",
  fontSize: "0.82rem", background: "#fff", boxSizing: "border-box",
};

const labelStyle: CSSProperties = { display: "block", fontSize: "0.74rem", color: "#666", marginBottom: "0.15rem" };

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The date the details panel shows for a stored spray appointment, as YYYY-MM-DD.
function sprayDateInputValue(ts: number | null | undefined): string {
  if (!ts) return "";
  return new Date(fromStoredUgandaTime(Number(ts))).toLocaleDateString("en-CA", { timeZone: UGANDA_TIME_ZONE });
}

function clean(value: unknown): string {
  const text = String(value ?? "").trim();
  return text === "-" ? "" : text;
}

export function LeadDetailsEditor({
  row,
  requesterId,
  onDone,
}: {
  row: any;
  requesterId: Id<"users">;
  onDone: () => void;
}) {
  const purchase = row.purchase || {};
  const initial = useMemo(
    () => ({
      clientName: clean(row.clientName === "Unknown" ? "" : row.clientName),
      phoneNumber: clean(row.phoneNumber),
      district: clean(row.district),
      subCounty: clean(row.subCounty),
      parish: clean(row.parish),
      productName: clean(purchase.productName),
      purchaseQuantity: clean(purchase.purchaseQuantity),
      purchaseDate: clean(purchase.purchaseDate),
      cropGrown: clean(purchase.cropGrown),
      monthOfPlanting: clean(purchase.monthOfPlanting),
      pastSprayDates: ((purchase.pastSprayDates || []) as string[]).join(", "),
      upcomingSprayDate: sprayDateInputValue(purchase.upcomingSprayScheduleAt),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [row.responseId]
  );

  const [form, setForm] = useState(initial);
  const hasFarmDetails = !!(initial.cropGrown || initial.monthOfPlanting || initial.pastSprayDates || initial.upcomingSprayDate);
  const [showFarm, setShowFarm] = useState(hasFarmDetails);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateDetails = useMutation((api as any).crmForms.updateCrmSubmissionDetails);

  const districts = useQuery(api.locations.getActiveDistricts, {});
  const districtId = (districts || []).find((d: any) => sameName(d.name, form.district))?.id;
  const subcounties = useQuery(
    api.locations.getSubcountiesByDistrict,
    districtId ? { districtId } : "skip"
  );
  const subcountyId = (subcounties || []).find((s: any) => sameName(s.name, form.subCounty))?.id;
  const parishes = useQuery(
    api.locations.getParishesBySubcounty,
    subcountyId ? { subcountyId } : "skip"
  );

  const set = (key: keyof typeof initial) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    if (initial.phoneNumber && !form.phoneNumber.trim()) {
      setError("A lead needs a phone number.");
      return;
    }
    setSaving(true);
    setError("");

    // Only what changed is sent, so an untouched field is never rewritten.
    const changes: Record<string, any> = {};
    const textKeys = [
      "clientName", "phoneNumber", "district", "subCounty", "parish", "productName",
      "purchaseQuantity", "purchaseDate", "cropGrown", "monthOfPlanting",
    ] as const;
    for (const key of textKeys) {
      if (form[key].trim() !== initial[key]) changes[key] = form[key].trim();
    }
    if (form.pastSprayDates.trim() !== initial.pastSprayDates) {
      changes.pastSprayDates = form.pastSprayDates.split(",").map((d) => d.trim()).filter(Boolean);
    }
    if (form.upcomingSprayDate !== initial.upcomingSprayDate) {
      // Stored the same way intake stores it.
      changes.upcomingSprayScheduleAt = form.upcomingSprayDate
        ? new Date(`${form.upcomingSprayDate}T09:00:00`).getTime()
        : null;
    }

    if (Object.keys(changes).length === 0) {
      setSaving(false);
      onDone();
      return;
    }

    try {
      await updateDetails({
        responseId: row.responseId as Id<"crmFormResponses">,
        requesterId,
        ...changes,
      });
      setSaving(false);
      onDone();
    } catch (err: any) {
      setError(err?.data || err?.message || "Failed to save these details");
      setSaving(false);
    }
  };

  // A stored name missing from the location list (older or typed-in data) is
  // still offered, so opening the editor never silently drops it.
  const withCurrent = (names: string[], current: string) =>
    current && !names.some((n) => sameName(n, current)) ? [current, ...names] : names;

  const districtNames = withCurrent((districts || []).map((d: any) => d.name), form.district);
  const subcountyNames = withCurrent((subcounties || []).map((s: any) => s.name), form.subCounty);
  const parishNames = withCurrent((parishes || []).map((p: any) => p.name), form.parish);

  const pick = (names: string[], current: string) =>
    names.find((n) => sameName(n, current)) ?? current;

  const grid: CSSProperties = {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.5rem", marginBottom: "0.6rem",
  };

  return (
    <div style={{ border: "1px solid #d7ecdd", background: "#f8fcf9", borderRadius: 10, padding: "0.7rem" }}>
      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#374151", marginBottom: "0.5rem" }}>
        Edit lead details
      </div>

      <div style={grid}>
        <div>
          <label style={labelStyle}>Client name</label>
          <input value={form.clientName} onChange={set("clientName")} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Phone number</label>
          <input value={form.phoneNumber} onChange={set("phoneNumber")} inputMode="tel" style={inputStyle} />
          {form.phoneNumber.trim() !== initial.phoneNumber && (
            <span style={{ display: "block", fontSize: "0.72rem", color: "#92400e", marginTop: "0.2rem" }}>
              This is the member&apos;s login, so it changes for them everywhere.
            </span>
          )}
        </div>
      </div>

      <div style={grid}>
        <div>
          <label style={labelStyle}>District</label>
          <select
            value={pick(districtNames, form.district)}
            onChange={(e) => setForm((prev) => ({ ...prev, district: e.target.value, subCounty: "", parish: "" }))}
            style={inputStyle}
          >
            <option value="">Not recorded</option>
            {districtNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Sub-county</label>
          <select
            value={pick(subcountyNames, form.subCounty)}
            onChange={(e) => setForm((prev) => ({ ...prev, subCounty: e.target.value, parish: "" }))}
            disabled={!form.district}
            style={inputStyle}
          >
            <option value="">Not recorded</option>
            {subcountyNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Parish</label>
          <select
            value={pick(parishNames, form.parish)}
            onChange={set("parish")}
            disabled={!form.subCounty}
            style={inputStyle}
          >
            <option value="">Not recorded</option>
            {parishNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      </div>

      <div style={grid}>
        <div>
          <label style={labelStyle}>Product</label>
          <input value={form.productName} onChange={set("productName")} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Quantity</label>
          <input value={form.purchaseQuantity} onChange={set("purchaseQuantity")} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Purchase date</label>
          <input value={form.purchaseDate} onChange={set("purchaseDate")} type="date" style={inputStyle} />
        </div>
      </div>

      {!showFarm ? (
        <button
          onClick={() => setShowFarm(true)}
          style={{ border: "none", background: "none", color: "#1f7a3e", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: "0.6rem" }}
        >
          + Farm details (crop, planting, spraying)
        </button>
      ) : (
        <>
          <div style={grid}>
            <div>
              <label style={labelStyle}>Crop grown</label>
              <select value={form.cropGrown} onChange={set("cropGrown")} style={inputStyle}>
                <option value="">Not recorded</option>
                {withCurrent(CROP_OPTIONS, form.cropGrown).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Month of planting</label>
              <select value={form.monthOfPlanting} onChange={set("monthOfPlanting")} style={inputStyle}>
                <option value="">Not recorded</option>
                {withCurrent(MONTH_OPTIONS, form.monthOfPlanting).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div style={grid}>
            <div>
              <label style={labelStyle}>Past spray dates (comma-separated)</label>
              <input value={form.pastSprayDates} onChange={set("pastSprayDates")} placeholder="e.g. 2026-04-10, 2026-05-02" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Next spray / visit</label>
              <input value={form.upcomingSprayDate} onChange={set("upcomingSprayDate")} type="date" style={inputStyle} />
            </div>
          </div>
        </>
      )}

      {error && (
        <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.78rem", color: "#b91c1c", fontWeight: 600 }}>{error}</p>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.4rem" }}>
        <button
          onClick={onDone}
          disabled={saving}
          style={{ padding: "0.3rem 0.7rem", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: "0.3rem 0.7rem", borderRadius: 8, border: "1px solid #1f7a3e", background: "#1f7a3e", color: "#fff", fontSize: "0.78rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}
