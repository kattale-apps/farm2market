"use client";

export const dynamic = "force-dynamic";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useCallback, useRef } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import CommunityTabBar from "@/app/components/CommunityTabBar";

const BRAND = "#2e7d32";
const BRAND_LIGHT = "#43a047";
const BRAND_BG = "#e8f5e9";
const GOLD = "#f9a825";
const GOLD_LIGHT = "#fff8e1";
const FONT = '"Montserrat", sans-serif';

// ─── Coin Plant Animation Overlay ───────────────────────────────────
function CoinPlantAnimation({
  coinsEarned,
  onDone,
}: {
  coinsEarned: number;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState(0);
  const [coinsFallen, setCoinsFallen] = useState(0);

  useEffect(() => {
    const t0 = setTimeout(() => setPhase(1), 600);
    const coinTimers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < Math.min(coinsEarned, 12); i++) {
      coinTimers.push(
        setTimeout(() => setCoinsFallen((prev) => prev + 1), 800 + i * 250)
      );
    }
    const totalCoinTime = 800 + Math.min(coinsEarned, 12) * 250 + 400;
    const t2 = setTimeout(() => setPhase(2), totalCoinTime);
    const t3 = setTimeout(() => setPhase(3), totalCoinTime + 800);
    const t4 = setTimeout(() => setPhase(4), totalCoinTime + 1600);
    return () => {
      clearTimeout(t0);
      coinTimers.forEach(clearTimeout);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [coinsEarned]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
      }}
    >
      <div style={{ position: "relative", width: 220, height: 220, marginBottom: 24 }}>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 180,
            height: 70,
            borderRadius: "50%",
            background: "radial-gradient(ellipse at center, #5d4037 0%, #3e2723 100%)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 30,
            left: "50%",
            transform: "translateX(-50%)",
            width: 140,
            height: 40,
            borderRadius: "50%",
            background: "radial-gradient(ellipse at center, #795548 0%, #4e342e 100%)",
          }}
        />
        {Array.from({ length: Math.min(coinsFallen, 12) }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              bottom: 40 + (i % 3) * 8,
              left: 60 + (i % 5) * 22,
              fontSize: "1.6rem",
              animation: "coinDrop 0.5s ease-in forwards",
              opacity: phase >= 1 ? 1 : 0,
              filter: "drop-shadow(0 0 6px rgba(249,168,37,0.8))",
            }}
          >
            🪙
          </div>
        ))}
        {phase >= 2 && (
          <div
            style={{
              position: "absolute",
              bottom: 55,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: phase >= 3 ? "3rem" : "1.8rem",
              transition: "font-size 0.8s cubic-bezier(.34,1.56,.64,1)",
              filter: "drop-shadow(0 0 8px rgba(46,125,50,0.6))",
            }}
          >
            {phase >= 3 ? "🌱" : "🌿"}
          </div>
        )}
      </div>
      <div style={{ textAlign: "center", color: "#fff" }}>
        {phase < 1 && (
          <p style={{ fontSize: "1.1rem", fontWeight: 600, opacity: 0.8 }}>
            Preparing soil...
          </p>
        )}
        {phase >= 1 && phase < 4 && (
          <p style={{ fontSize: "1.1rem", fontWeight: 600, color: GOLD }}>
            Planting your FarmCoins...
          </p>
        )}
        {phase >= 4 && (
          <div style={{ animation: "fadeUp 0.5s ease-out" }}>
            <p style={{ fontSize: "2rem", fontWeight: 800, color: GOLD, margin: "0 0 4px 0" }}>
              🪙 +{coinsEarned} FarmCoin{coinsEarned > 1 ? "s" : ""}!
            </p>
            <p style={{ fontSize: "0.95rem", color: "#a5d6a7", margin: "0 0 24px 0" }}>
              Your compliance investment is growing 🌱
            </p>
            <button
              onClick={onDone}
              style={{
                padding: "14px 48px",
                background: "linear-gradient(135deg, #43a047, #2e7d32)",
                color: "#fff",
                border: "none",
                borderRadius: 14,
                fontSize: "1.1rem",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: FONT,
                boxShadow: "0 4px 16px rgba(46,125,50,0.4)",
              }}
            >
              ✓ Continue
            </button>
          </div>
        )}
      </div>
      <style>{`
        @keyframes coinDrop {
          0% { transform: translateY(-120px) rotate(0deg); opacity: 0; }
          60% { opacity: 1; }
          100% { transform: translateY(0) rotate(360deg); opacity: 1; }
        }
        @keyframes fadeUp {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Field Renderer ─────────────────────────────────────────────────
function FieldInput({
  field,
  value,
  onChange,
  isSingleView,
}: {
  field: any;
  value: string;
  onChange: (val: string) => void;
  isSingleView: boolean;
}) {
  const baseStyle: React.CSSProperties = {
    width: "100%",
    padding: isSingleView ? "16px 18px" : "12px 14px",
    borderRadius: 14,
    border: `2px solid ${field.isCalculated ? "#90caf9" : "#ddd"}`,
    fontSize: isSingleView ? "1.15rem" : "1rem",
    fontFamily: FONT,
    boxSizing: "border-box" as const,
    background: field.isCalculated ? "#e3f2fd" : "#fff",
    color: field.isCalculated ? "#1565c0" : "#1a1a1a",
    fontWeight: field.isCalculated ? 600 : 400,
    minHeight: isSingleView ? 58 : 48,
    outline: "none",
    transition: "border-color 0.2s",
  };

  if (field.fieldType === "select") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} style={baseStyle}>
        <option value="">Select...</option>
        {field.options?.map((opt: string) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }
  if (field.fieldType === "textarea") {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || "Type here..."}
        rows={isSingleView ? 4 : 3}
        style={{ ...baseStyle, resize: "vertical" as const }}
      />
    );
  }
  if (field.fieldType === "checkbox") {
    const selected = (value || "").split(",").filter(Boolean);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {field.options?.map((opt: string) => (
          <label
            key={opt}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              background: selected.includes(opt) ? BRAND_BG : "#f9f9f9",
              borderRadius: 12,
              border: `2px solid ${selected.includes(opt) ? BRAND : "#e0e0e0"}`,
              cursor: "pointer",
              fontSize: isSingleView ? "1.05rem" : "0.95rem",
              fontFamily: FONT,
              transition: "all 0.2s",
            }}
          >
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...selected, opt]
                  : selected.filter((v) => v !== opt);
                onChange(next.join(","));
              }}
              style={{ width: 22, height: 22, accentColor: BRAND }}
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }
  return (
    <input
      type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : field.fieldType === "email" ? "email" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder || "Type here..."}
      readOnly={!!field.isCalculated}
      style={baseStyle}
      onFocus={(e) => { if (!field.isCalculated) e.currentTarget.style.borderColor = BRAND; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = field.isCalculated ? "#90caf9" : "#ddd"; }}
    />
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function TrackerFillPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const communityId = searchParams.get("communityId") as Id<"communities"> | null;
  const formId = searchParams.get("formId") as Id<"communityForms"> | null;
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [seeAllFields, setSeeAllFields] = useState(false);
  const [showCoinAnimation, setShowCoinAnimation] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pilot_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.userId) setUserId(parsed.userId as Id<"users">);
      }
    } catch {}
  }, []);

  const formDetails = useQuery((api as any).forms.getFormDetails, formId ? { formId } : "skip");
  const existingDraft = useQuery((api as any).forms.getDraftResponse, formId && userId ? { formId, memberId: userId } : "skip");
  const saveDraft = useMutation((api as any).forms.saveDraftResponse);
  const submitDraft = useMutation((api as any).forms.submitDraft);
  const submitFormResponse = useMutation((api as any).forms.submitFormResponse);
  const mintFarmerFormCoin = useMutation((api as any).farmcoin.mintFarmerFormCoin);

  useEffect(() => {
    if (existingDraft && !draftLoaded) {
      const values: Record<string, string> = {};
      for (const v of existingDraft.values || []) {
        values[String(v.fieldId)] = v.value;
      }
      setFieldValues(values);
      setDraftLoaded(true);
    }
  }, [existingDraft, draftLoaded]);

  const autoSave = useCallback(() => {
    if (!formId || !communityId || !userId || Object.keys(fieldValues).length === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        const fvArray = Object.entries(fieldValues).map(([fieldId, value]) => ({
          fieldId: fieldId as Id<"formFields">,
          value: value || "",
        }));
        await saveDraft({ formId, communityId, memberId: userId, fieldValues: fvArray });
      } catch {}
      setSaving(false);
    }, 800);
  }, [fieldValues, formId, communityId, userId, saveDraft]);

  const handleFieldChange = (fieldId: string, value: string) => {
    const next = { ...fieldValues, [fieldId]: value };
    if (formDetails?.fields) {
      const labelMap: Record<string, number> = {};
      for (const f of formDetails.fields) {
        if (f.isCalculated) continue;
        const key = f.label.toLowerCase().replace(/\s+/g, "_");
        const num = parseFloat(next[String(f._id)] || "0");
        labelMap[key] = isNaN(num) ? 0 : num;
      }
      for (const f of formDetails.fields) {
        if (!f.isCalculated || !f.formula) continue;
        try {
          let expr = f.formula.toLowerCase().replace(/\s+/g, "_");
          for (const [label, val] of Object.entries(labelMap)) {
            const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            expr = expr.replace(new RegExp(escaped, "g"), String(val));
          }
          const sanitized = expr.replace(/[^0-9+\-*/().]/g, "");
          if (sanitized.length > 0) {
            const result = Function('"use strict"; return (' + sanitized + ")")();
            next[String(f._id)] = String(Math.round(result * 100) / 100);
          }
        } catch {}
      }
    }
    setFieldValues(next);
  };

  useEffect(() => {
    if (draftLoaded || Object.keys(fieldValues).length > 0) autoSave();
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fieldValues]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!formId || !communityId || !userId) return;
    setSubmitting(true);
    try {
      let responseId: Id<"formResponses"> | undefined;
      if (existingDraft?._id) {
        const fvArray = Object.entries(fieldValues).map(([fieldId, value]) => ({
          fieldId: fieldId as Id<"formFields">,
          value: value || "",
        }));
        await saveDraft({ formId, communityId, memberId: userId, fieldValues: fvArray });
        await submitDraft({ responseId: existingDraft._id, memberId: userId });
        responseId = existingDraft._id;
      } else {
        const fvArray = Object.entries(fieldValues)
          .filter(([_, value]) => value !== "")
          .map(([fieldId, value]) => ({ fieldId: fieldId as Id<"formFields">, value }));
        const result = await submitFormResponse({ formId, communityId, memberId: userId, fieldValues: fvArray });
        responseId = result?._id || result;
      }
      const fields = formDetails?.fields || [];
      const filledCount = fields.filter((f: any) => !f.isCalculated && fieldValues[String(f._id)]?.trim()).length;
      if (filledCount > 0 && responseId) {
        try {
          const fieldLabels = fields
            .filter((f: any) => !f.isCalculated && fieldValues[String(f._id)]?.trim())
            .map((f: any) => f.label);
          const mintResult = await mintFarmerFormCoin({
            farmerId: userId,
            formResponseId: responseId,
            communityId,
            fieldCount: filledCount,
            fieldLabels,
          });
          if (mintResult?.success) {
            setCoinsEarned(mintResult.coinsEarned);
            setShowCoinAnimation(true);
            setSubmitting(false);
            return;
          }
        } catch {}
      }
      setMessage({ type: "success", text: "Submitted successfully!" });
      setTimeout(() => router.push(`/community-only/trackers/view?communityId=${communityId}`), 1500);
    } catch (e: any) {
      setMessage({ type: "error", text: e.message });
    }
    setSubmitting(false);
  };

  const handleCoinAnimationDone = () => {
    setShowCoinAnimation(false);
    router.push(`/community-only/trackers/view?communityId=${communityId}`);
  };

  if (!communityId || !formId) {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>Missing parameters.</p>
        <Link href="/my-communities" style={{ color: BRAND }}>Back to Communities</Link>
      </div>
    );
  }

  const allFields = formDetails?.fields || [];
  const editableFields = allFields.filter((f: any) => !f.isCalculated);
  const totalFields = editableFields.length;
  const filledFields = editableFields.filter((f: any) => fieldValues[String(f._id)]?.trim()).length;
  const progressPercent = totalFields > 0 ? (filledFields / totalFields) * 100 : 0;
  const currentField = editableFields[currentFieldIndex];

  return (
    <div style={{ fontFamily: FONT, paddingBottom: "5rem", minHeight: "100vh", background: "#f5f5f5" }}>
      {showCoinAnimation && <CoinPlantAnimation coinsEarned={coinsEarned} onDone={handleCoinAnimationDone} />}

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)", padding: "1rem 1rem 0.75rem", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: 8 }}>
          <Link
            href={`/community-only/trackers?communityId=${communityId}`}
            style={{ color: "#fff", textDecoration: "none", fontSize: "1.4rem", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            ←
          </Link>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>{formDetails?.name || "Loading..."}</h1>
            <p style={{ margin: 0, fontSize: "0.72rem", opacity: 0.85 }}>{saving ? "💾 Saving..." : "✓ Auto-saved"}</p>
          </div>
          <div style={{ background: GOLD_LIGHT, color: "#f57f17", borderRadius: 20, padding: "4px 12px", fontSize: "0.8rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 4, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
            🪙 {filledFields}
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 6, height: 8, overflow: "hidden" }}>
          <div style={{ width: `${progressPercent}%`, height: "100%", background: `linear-gradient(90deg, ${GOLD}, #ffca28)`, borderRadius: 6, transition: "width 0.4s ease-out" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginTop: 4, opacity: 0.85 }}>
          <span>{filledFields} / {totalFields} fields</span>
          <span>🪙 {filledFields} coins pending</span>
        </div>
      </div>

      {/* View Toggle */}
      {totalFields > 1 && (
        <div style={{ padding: "8px 16px", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => setSeeAllFields(!seeAllFields)}
            style={{ background: "none", border: `1px solid ${BRAND}`, color: BRAND, borderRadius: 8, padding: "6px 14px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: FONT }}
          >
            {seeAllFields ? "📋 One at a time" : "📑 See all fields"}
          </button>
        </div>
      )}

      {message && (
        <div style={{ margin: "0.5rem 1rem", padding: "0.6rem 0.75rem", borderRadius: 10, background: message.type === "success" ? BRAND_BG : "#ffebee", color: message.type === "success" ? BRAND : "#c62828", fontSize: "0.9rem", fontWeight: 600 }}>
          {message.text}
        </div>
      )}

      {!formDetails && <div style={{ padding: "3rem", textAlign: "center" }}><p style={{ color: "#888", fontSize: "1rem" }}>Loading form...</p></div>}

      {/* ALL FIELDS VIEW */}
      {formDetails && seeAllFields && (
        <div style={{ padding: "0.75rem 1rem" }}>
          {allFields.map((field: any, index: number) => {
            const hasValue = !!fieldValues[String(field._id)]?.trim();
            return (
              <div key={field._id} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 12, border: `2px solid ${hasValue ? "#a5d6a7" : "#eee"}`, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: hasValue ? `linear-gradient(135deg, ${BRAND_LIGHT}, ${BRAND})` : "#e0e0e0", color: hasValue ? "#fff" : "#999", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, flexShrink: 0 }}>
                    {hasValue ? "✓" : index + 1}
                  </span>
                  <label style={{ fontSize: "0.9rem", fontWeight: 600, color: "#333", flex: 1 }}>
                    {field.label}
                    {field.required && <span style={{ color: "#d32f2f", marginLeft: 4 }}>*</span>}
                    {field.isCalculated && <span style={{ marginLeft: 8, fontSize: "0.6rem", color: "#1976d2", fontWeight: 500, background: "#e3f2fd", padding: "2px 6px", borderRadius: 4 }}>Auto</span>}
                  </label>
                  {hasValue && !field.isCalculated && <span style={{ fontSize: "0.85rem", opacity: 0.6 }}>🪙</span>}
                </div>
                {field.helpText && <p style={{ margin: "0 0 6px 36px", fontSize: "0.72rem", color: "#888" }}>{field.helpText}</p>}
                <FieldInput field={field} value={fieldValues[String(field._id)] || ""} onChange={(val) => handleFieldChange(String(field._id), val)} isSingleView={false} />
              </div>
            );
          })}
          <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: "16px", background: submitting ? "#999" : `linear-gradient(135deg, ${BRAND_LIGHT}, ${BRAND})`, color: "#fff", border: "none", borderRadius: 14, fontSize: "1.1rem", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", fontFamily: FONT, marginTop: 8, boxShadow: "0 4px 12px rgba(46,125,50,0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {submitting ? "⏳ Submitting..." : `🌱 Submit & Earn ${filledFields} FarmCoin${filledFields !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      {/* ONE-FIELD-PER-PAGE VIEW */}
      {formDetails && !seeAllFields && currentField && (
        <div style={{ padding: "1.5rem 1rem" }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: "24px 20px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", border: "2px solid #e8f5e9", minHeight: 240, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ background: `linear-gradient(135deg, ${BRAND_LIGHT}, ${BRAND})`, color: "#fff", borderRadius: 12, padding: "6px 14px", fontSize: "0.8rem", fontWeight: 700 }}>
                Field {currentFieldIndex + 1} of {totalFields}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: fieldValues[String(currentField._id)]?.trim() ? GOLD : "#ccc", fontSize: "1.2rem", transition: "color 0.3s" }}>
                🪙<span style={{ fontSize: "0.75rem", fontWeight: 600 }}>{fieldValues[String(currentField._id)]?.trim() ? "+1" : ""}</span>
              </div>
            </div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#222", margin: "0 0 6px 0", fontFamily: FONT }}>
              {currentField.label}
              {currentField.required && <span style={{ color: "#d32f2f", marginLeft: 4 }}>*</span>}
            </h2>
            {currentField.helpText && <p style={{ margin: "0 0 16px 0", fontSize: "0.82rem", color: "#888", lineHeight: 1.4 }}>{currentField.helpText}</p>}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <FieldInput field={currentField} value={fieldValues[String(currentField._id)] || ""} onChange={(val) => handleFieldChange(String(currentField._id), val)} isSingleView={true} />
            </div>
          </div>

          {/* Nav Buttons */}
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            {currentFieldIndex > 0 && (
              <button onClick={() => setCurrentFieldIndex(currentFieldIndex - 1)} style={{ flex: 1, padding: "16px", background: "#fff", color: BRAND, border: `2px solid ${BRAND}`, borderRadius: 14, fontSize: "1rem", fontWeight: 700, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                ← Back
              </button>
            )}
            {currentFieldIndex < totalFields - 1 ? (
              <button onClick={() => setCurrentFieldIndex(currentFieldIndex + 1)} style={{ flex: 2, padding: "16px", background: `linear-gradient(135deg, ${BRAND_LIGHT}, ${BRAND})`, color: "#fff", border: "none", borderRadius: 14, fontSize: "1rem", fontWeight: 700, cursor: "pointer", fontFamily: FONT, boxShadow: "0 4px 12px rgba(46,125,50,0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                Next →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting} style={{ flex: 2, padding: "16px", background: submitting ? "#999" : `linear-gradient(135deg, ${GOLD}, #f57f17)`, color: "#fff", border: "none", borderRadius: 14, fontSize: "1.05rem", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", fontFamily: FONT, boxShadow: "0 4px 12px rgba(249,168,37,0.4)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {submitting ? "⏳" : `🌱 Submit & Earn ${filledFields} 🪙`}
              </button>
            )}
          </div>

          {/* Dot Progress */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 20, flexWrap: "wrap" }}>
            {editableFields.map((f: any, i: number) => {
              const hasValue = !!fieldValues[String(f._id)]?.trim();
              const isCurrent = i === currentFieldIndex;
              return (
                <button key={f._id} onClick={() => setCurrentFieldIndex(i)} style={{ width: isCurrent ? 28 : 12, height: 12, borderRadius: 6, border: "none", background: isCurrent ? BRAND : hasValue ? "#a5d6a7" : "#ddd", cursor: "pointer", padding: 0, transition: "all 0.3s" }} title={f.label} />
              );
            })}
          </div>
        </div>
      )}

      {/* Calculated Fields Summary */}
      {formDetails && !seeAllFields && allFields.some((f: any) => f.isCalculated) && (
        <div style={{ padding: "0 1rem 1rem" }}>
          <div style={{ background: "#e3f2fd", borderRadius: 14, padding: "12px 16px", border: "1px solid #bbdefb" }}>
            <p style={{ margin: "0 0 8px", fontSize: "0.8rem", fontWeight: 700, color: "#1565c0" }}>📊 Calculated Fields</p>
            {allFields.filter((f: any) => f.isCalculated).map((f: any) => (
              <div key={f._id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "4px 0", color: "#1565c0" }}>
                <span>{f.label}</span>
                <span style={{ fontWeight: 700 }}>{fieldValues[String(f._id)] || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <CommunityTabBar />
    </div>
  );
}
