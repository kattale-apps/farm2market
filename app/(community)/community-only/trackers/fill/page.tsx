"use client";

export const dynamic = "force-dynamic";

import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { useState, useEffect, useCallback, useRef } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import CommunityTabBar from "@/app/components/CommunityTabBar";
import { GeneralCameraCapture } from "@/app/components/GeneralCameraCapture";
import { useOfflineQuery } from "@/app/hooks/useOfflineQuery";
import { useOfflineMutation } from "@/app/hooks/useOfflineMutation";
import { useFormDraftPersistence, clearFormDraft } from "@/app/hooks/useFormDraftPersistence";
import { FarmCoinReward, FarmCoinVideoPreloader } from "@/app/components/FarmCoinAnimation";
import { useStoredUser } from "@/app/hooks/useStoredUser";
import { getCurrentLocation } from "@/app/utils/gps";
import { getEffectivePaymentAmount, getPaymentEntryConfig } from "@/utils/extensionWorkForm";

const BRAND = "#2e7d32";
const BRAND_LIGHT = "#43a047";
const BRAND_BG = "#e8f5e9";
const GOLD = "#f9a825";
const GOLD_LIGHT = "#fff8e1";
const FONT = '"Montserrat", sans-serif';


// ─── Coin Plant Animation Overlay ───────────────────────────────────
// ─── Field Renderer ─────────────────────────────────────────────────
function GpsFieldInput({
  value,
  onChange,
  baseStyle,
}: {
  value: string;
  onChange: (val: string) => void;
  baseStyle: React.CSSProperties;
}) {
  const [capturing, setCapturing] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const captureGps = useCallback(async () => {
    setCapturing(true);
    setGpsError(null);
    try {
      const position = await getCurrentLocation();
      if (!position) {
        setGpsError("Geolocation not available on this device.");
        return;
      }

      const lat = position.latitude.toFixed(6);
      const lng = position.longitude.toFixed(6);
      const accuracy = Math.round(position.accuracy ?? 0);
      onChange(`${lat}, ${lng} (±${accuracy}m)`);
    } catch (err: any) {
      setGpsError(err?.message || "Unable to read GPS location.");
    } finally {
      setCapturing(false);
    }
  }, [onChange]);

  useEffect(() => {
    if (!value) {
      captureGps();
    }
  }, [value, captureGps]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="GPS coordinates"
          style={baseStyle}
        />
        <button
          type="button"
          onClick={captureGps}
          disabled={capturing}
          style={{
            padding: "0.55rem 0.8rem",
            borderRadius: 10,
            border: "1px solid #ccc",
            background: "#fff",
            color: "#333",
            fontFamily: FONT,
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: capturing ? "not-allowed" : "pointer",
            minWidth: 96,
          }}
        >
          {capturing ? "Locating..." : "📍 Refresh"}
        </button>
      </div>
      {gpsError && (
        <p style={{ margin: 0, color: "#c62828", fontSize: "0.78rem" }}>
          {gpsError}
        </p>
      )}
    </div>
  );
}

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
  if (field.fieldType === "camera") {
    // Show preview if value is already a JSON with dataUrl
    let previewUrl: string | null = null;
    if (value) {
      try {
        const parsed = JSON.parse(value);
        const candidate = typeof parsed?.dataUrl === "string" ? parsed.dataUrl : "";
        previewUrl = candidate.startsWith("data:image/") ? candidate : null;
      } catch { /* not valid JSON, ignore */ }
    }
    return (
      <div>
        {previewUrl && (
          <img src={previewUrl} alt="Captured" style={{ width: "100%", maxWidth: 400, borderRadius: 8, marginBottom: "0.5rem" }} />
        )}
        <GeneralCameraCapture key={String(field._id)} onCapture={(jsonVal) => onChange(jsonVal)} />
      </div>
    );
  }
  if (field.fieldType === "gps") {
    return <GpsFieldInput value={value} onChange={onChange} baseStyle={baseStyle} />;
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
  const planId = searchParams.get("planId") as Id<"fertilizerPlans"> | null;
  const plannedSprayDate = searchParams.get("plannedSprayDate");
  const trackedUnitIdParam = searchParams.get("trackedUnitId") as Id<"farmTrackedUnits"> | null;
  const paymentStatus = searchParams.get("paymentStatus");
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) || null;
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
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [customPaymentAmount, setCustomPaymentAmount] = useState("");
  const [selectedTrackedUnitId, setSelectedTrackedUnitId] = useState<Id<"farmTrackedUnits"> | null>(trackedUnitIdParam);

  const formDetails = useOfflineQuery((api as any).forms.getFormDetails, formId ? { formId } : "skip") as any;
  const trackedUnits = useOfflineQuery(
    (api as any).farmToolbox.listTrackedUnits,
    userId ? { farmerId: userId } : "skip"
  ) as any[] | undefined;
  const existingDraft = useOfflineQuery(
    (api as any).forms.getDraftResponse,
    formId && userId
      ? {
          formId,
          memberId: userId,
          planId: planId || undefined,
          plannedSprayDate: plannedSprayDate || undefined,
          trackedUnitId: selectedTrackedUnitId || undefined,
        }
      : "skip"
  ) as any;
  const saveDraft = useOfflineMutation((api as any).forms.saveDraftResponse);
  const submitDraft = useOfflineMutation((api as any).forms.submitDraft);
  const submitFormResponse = useOfflineMutation((api as any).forms.submitFormResponse);
  const initiateExtensionWorkPayment = useAction((api as any).pesapal.initiateExtensionWorkPayment);

  // Persist form drafts to IndexedDB for offline access
  useFormDraftPersistence(
    userId as string | null,
    "tracker",
    formId as string | null,
    fieldValues,
    (restoredData) => {
      if (!draftLoaded && Object.keys(restoredData).length > 0) {
        setFieldValues(restoredData);
      }
    },
  );

  useEffect(() => {
    if (existingDraft && !draftLoaded) {
      const values: Record<string, string> = {};
      for (const v of existingDraft.values || []) {
        values[String(v.fieldId)] = v.value;
      }
      setFieldValues(values);
      if ((existingDraft as any)?.trackedUnitId) {
        setSelectedTrackedUnitId((existingDraft as any).trackedUnitId as Id<"farmTrackedUnits">);
      }
      setDraftLoaded(true);
    }
  }, [existingDraft, draftLoaded]);

  useEffect(() => {
    if (paymentStatus === "success") {
      setMessage({ type: "success", text: "Payment completed. You can now submit the form." });
    } else if (paymentStatus === "cancelled") {
      setMessage({ type: "error", text: "Payment was cancelled. You can try again when ready." });
    }
  }, [paymentStatus]);

  const autoSave = () => {
    if (!formId || !communityId || !userId || Object.keys(fieldValues).length === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        const fvArray = Object.entries(fieldValues).map(([fieldId, value]) => ({
          fieldId: fieldId as Id<"formFields">,
          value: value || "",
        }));
        await saveDraft({
          formId,
          communityId,
          memberId: userId,
          planId: planId || undefined,
          plannedSprayDate: plannedSprayDate || undefined,
          trackedUnitId: selectedTrackedUnitId || undefined,
          fieldValues: fvArray,
        });
      } catch {}
      setSaving(false);
    }, 800);
  };

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
  }, [fieldValues, selectedTrackedUnitId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePayNow = async () => {
    if (!formId || !communityId || !userId || !formDetails?.paymentEnabled || !formDetails?.formPurpose || formDetails.formPurpose !== "extension_work") return;

    const amount = getEffectivePaymentAmount(formDetails, formDetails.paymentAmountEditable ? customPaymentAmount : undefined);
    if (!amount || amount <= 0) {
      setMessage({ type: "error", text: "Enter a valid amount before paying." });
      return;
    }

    setPaymentProcessing(true);
    setMessage(null);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const returnTo = `${origin}/community-only/trackers/fill?communityId=${communityId}&formId=${formId}`;
      const callbackUrl = `${origin}/payment/callback?returnTo=${encodeURIComponent(returnTo)}`;
      const cancelUrl = `${returnTo}&paymentStatus=cancelled`;
      const result = await initiateExtensionWorkPayment({
        userId,
        amount,
        currency: "UGX",
        callbackUrl,
        cancelUrl,
        description: formDetails?.name || "Extension work form",
      });
      if ((result as any)?.redirectUrl) {
        window.location.href = (result as any).redirectUrl;
      } else {
        throw new Error("No payment link was returned.");
      }
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Unable to start payment." });
      setPaymentProcessing(false);
    }
  };

  const handleResetForm = async () => {
    if (!formId || !communityId || !userId) return;

    const confirmed = window.confirm("Reset this form? This will clear all entered values.");
    if (!confirmed) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    setFieldValues({});
    setCurrentFieldIndex(0);
    setCustomPaymentAmount("");
    setSelectedTrackedUnitId(trackedUnitIdParam);
    setMessage({ type: "success", text: "Form reset." });

    try {
      await saveDraft({
        formId,
        communityId,
        memberId: userId,
        planId: planId || undefined,
        plannedSprayDate: plannedSprayDate || undefined,
        trackedUnitId: trackedUnitIdParam || undefined,
        fieldValues: [],
      });
    } catch {}

    await clearFormDraft(String(userId), "tracker", String(formId));
  };

  const handleSubmit = async () => {
    if (!formId || !communityId || !userId) return;

    const requiresPayment = Boolean(formDetails?.formPurpose === "extension_work" && formDetails?.paymentEnabled);
    const paymentAmount = getEffectivePaymentAmount(formDetails, formDetails?.paymentAmountEditable ? customPaymentAmount : undefined);
    if (requiresPayment && paymentStatus !== "success") {
      setMessage({ type: "error", text: "Complete the payment first, then submit the form." });
      return;
    }

    setSubmitting(true);
    try {
      let responseId: Id<"formResponses"> | undefined;
      let serverCoins = 0;
      if (existingDraft?._id) {
        const fvArray = Object.entries(fieldValues).map(([fieldId, value]) => ({
          fieldId: fieldId as Id<"formFields">,
          value: value || "",
        }));
        await saveDraft({
          formId,
          communityId,
          memberId: userId,
          planId: planId || undefined,
          plannedSprayDate: plannedSprayDate || undefined,
          trackedUnitId: selectedTrackedUnitId || undefined,
          fieldValues: fvArray,
        });
        const submitResult = await submitDraft({
          responseId: existingDraft._id,
          memberId: userId,
          planId: planId || undefined,
          plannedSprayDate: plannedSprayDate || undefined,
          trackedUnitId: selectedTrackedUnitId || undefined,
        });
        responseId = existingDraft._id;
        serverCoins = (submitResult as any)?.coinsEarned ?? 0;
        // If offline-queued, show optimistic coin animation and clear local draft
        if (submitResult && (submitResult as any).queued) {
          const fields = formDetails?.fields || [];
          const filledCount = fields.filter((f: any) => !f.isCalculated && fieldValues[String(f._id)]?.trim()).length;
          if (filledCount > 0) {
            setCoinsEarned(filledCount);
            setShowCoinAnimation(true);
          } else {
            setMessage({ type: "success", text: "Queued offline — will sync when reconnected!" });
            setTimeout(() => router.push(`/community-only/trackers/view?communityId=${communityId}`), 1500);
          }
          clearFormDraft(String(userId), "tracker", String(formId));
          setSubmitting(false);
          return;
        }
      } else {
        const fvArray = Object.entries(fieldValues)
          .filter(([_, value]) => value !== "")
          .map(([fieldId, value]) => ({ fieldId: fieldId as Id<"formFields">, value }));
        const result = await submitFormResponse({
          formId,
          communityId,
          memberId: userId,
          planId: planId || undefined,
          plannedSprayDate: plannedSprayDate || undefined,
          trackedUnitId: selectedTrackedUnitId || undefined,
          fieldValues: fvArray,
          paymentStatus: requiresPayment ? "paid" : undefined,
          paymentReference: requiresPayment ? `pesapal:${Date.now()}` : undefined,
          paymentAmount: requiresPayment ? paymentAmount ?? undefined : undefined,
        });
        // If offline-queued, show optimistic coin animation
        if (result && (result as any).queued) {
          const fields = formDetails?.fields || [];
          const filledCount = fields.filter((f: any) => !f.isCalculated && fieldValues[String(f._id)]?.trim()).length;
          if (filledCount > 0) {
            setCoinsEarned(filledCount);
            setShowCoinAnimation(true);
          } else {
            setMessage({ type: "success", text: "Queued offline — will sync when reconnected!" });
            setTimeout(() => router.push(`/community-only/trackers/view?communityId=${communityId}`), 1500);
          }
          clearFormDraft(String(userId), "tracker", String(formId));
          setSubmitting(false);
          return;
        }
        serverCoins = (result as any)?.coinsEarned ?? 0;
        responseId = result?._id || result;
      }
      // Clear local IndexedDB draft on successful submission
      clearFormDraft(String(userId), "tracker", String(formId));
      if (serverCoins > 0) {
        setCoinsEarned(serverCoins);
        setShowCoinAnimation(true);
        setSubmitting(false);
        return;
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

  if (authStatus === "loading") {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>Loading user session...</p>
      </div>
    );
  }

  if (authStatus === "unauthenticated" || !userId) {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>Your session expired. Please log in again.</p>
        <Link href="/login" style={{ color: BRAND }}>Go to Login</Link>
      </div>
    );
  }

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
  const paymentEntryConfig = getPaymentEntryConfig(formDetails);
  const requiresPayment = paymentEntryConfig.requiresPayment;
  const paymentAmount = getEffectivePaymentAmount(formDetails, paymentEntryConfig.canEditAmount ? customPaymentAmount : undefined);
  const paymentLabel = paymentAmount ? `UGX ${paymentAmount}` : formDetails?.paymentAmount ? `UGX ${formDetails.paymentAmount}` : "Payment required";

  return (
    <div style={{ fontFamily: FONT, paddingBottom: "5rem", minHeight: "100vh", background: "#f5f5f5" }}>
      {showCoinAnimation && (
        <FarmCoinReward coinsEarned={coinsEarned} onDone={handleCoinAnimationDone} />
      )}
      <FarmCoinVideoPreloader />

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
        <div style={{ padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          {formDetails?.formPurpose === "extension_work" ? (
            <button
              type="button"
              onClick={handleResetForm}
              disabled={submitting || paymentProcessing}
              style={{ background: "none", border: "1px solid #c62828", color: "#c62828", borderRadius: 8, padding: "6px 14px", fontSize: "0.78rem", fontWeight: 600, cursor: submitting || paymentProcessing ? "not-allowed" : "pointer", opacity: submitting || paymentProcessing ? 0.6 : 1, fontFamily: FONT }}
            >
              ↺ Reset form
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
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

      {requiresPayment && (
        <div style={{ margin: "0.5rem 1rem 0.75rem", padding: "0.8rem 0.9rem", borderRadius: 12, border: "1px solid #ffe0b2", background: "#fff8e1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#ef6c00" }}>💳 Payment required</div>
              <div style={{ fontSize: "0.8rem", color: "#6d4c41" }}>{paymentLabel}</div>
            </div>
            {paymentEntryConfig.showAmountInput && (
              <input
                type="number"
                value={customPaymentAmount || String(formDetails?.paymentAmount || "")}
                onChange={(e) => setCustomPaymentAmount(e.target.value)}
                placeholder="Enter amount"
                readOnly={!paymentEntryConfig.canEditAmount}
                style={{ padding: "0.45rem 0.6rem", borderRadius: 8, border: "1px solid #ccc", minWidth: 120, background: paymentEntryConfig.canEditAmount ? "#fff" : "#f5f5f5" }}
              />
            )}
            <button
              onClick={handlePayNow}
              disabled={paymentProcessing}
              style={{ padding: "0.55rem 0.8rem", borderRadius: 8, border: "none", background: paymentProcessing ? "#bbb" : "#ef6c00", color: "#fff", fontWeight: 700, cursor: paymentProcessing ? "not-allowed" : "pointer" }}
            >
              {paymentProcessing ? "Processing..." : "Pay with Pesapal"}
            </button>
          </div>
        </div>
      )}

      {!formDetails && <div style={{ padding: "3rem", textAlign: "center" }}><p style={{ color: "#888", fontSize: "1rem" }}>Loading form...</p></div>}

      {trackedUnits && trackedUnits.length > 0 && (
        <div style={{ margin: "0.5rem 1rem 0.75rem", background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, padding: "0.75rem" }}>
          <label style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.8rem", fontWeight: 700, color: "#2e7d32" }}>
            Tracked Unit (optional)
          </label>
          <select
            value={selectedTrackedUnitId || ""}
            onChange={(e) => setSelectedTrackedUnitId((e.target.value || null) as Id<"farmTrackedUnits"> | null)}
            style={{ width: "100%", padding: "0.55rem", border: "1px solid #ccc", borderRadius: 8, fontSize: "0.85rem", fontFamily: FONT }}
          >
            <option value="">-- No tracked unit --</option>
            {trackedUnits
              .filter((u: any) => u.status === "active")
              .map((u: any) => (
                <option key={u._id} value={u._id}>
                  {(u.emoji || "🌱")} {u.name || u.groupLabel || u.unitType} ({u.category})
                </option>
              ))}
          </select>
        </div>
      )}

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
              <FieldInput key={String(currentField._id)} field={currentField} value={fieldValues[String(currentField._id)] || ""} onChange={(val) => handleFieldChange(String(currentField._id), val)} isSingleView={true} />
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
