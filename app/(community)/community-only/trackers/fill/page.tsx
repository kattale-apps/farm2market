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
const FONT = '"Montserrat", sans-serif';

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pilot_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.userId) setUserId(parsed.userId as Id<"users">);
      }
    } catch {}
  }, []);

  const formDetails = useQuery(
    (api as any).forms.getFormDetails,
    formId ? { formId } : "skip"
  );

  const existingDraft = useQuery(
    (api as any).forms.getDraftResponse,
    formId && userId ? { formId, memberId: userId } : "skip"
  );

  const saveDraft = useMutation((api as any).forms.saveDraftResponse);
  const submitDraft = useMutation((api as any).forms.submitDraft);
  const submitFormResponse = useMutation((api as any).forms.submitFormResponse);

  // Load existing draft
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

  // Auto-save debounced
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
        await saveDraft({
          formId,
          communityId,
          memberId: userId,
          fieldValues: fvArray,
        });
      } catch {
        // silent fail on auto-save
      }
      setSaving(false);
    }, 500);
  }, [fieldValues, formId, communityId, userId, saveDraft]);

  const handleFieldChange = (fieldId: string, value: string) => {
    const next = { ...fieldValues, [fieldId]: value };

    // Compute calculated fields client-side for instant feedback
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
        } catch {
          // keep existing
        }
      }
    }

    setFieldValues(next);
  };

  // Trigger auto-save on value changes
  useEffect(() => {
    if (draftLoaded || Object.keys(fieldValues).length > 0) {
      autoSave();
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fieldValues]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!formId || !communityId || !userId) return;
    setSubmitting(true);
    try {
      // If we have a draft, submit it
      if (existingDraft?._id) {
        // First save latest values
        const fvArray = Object.entries(fieldValues).map(([fieldId, value]) => ({
          fieldId: fieldId as Id<"formFields">,
          value: value || "",
        }));
        await saveDraft({ formId, communityId, memberId: userId, fieldValues: fvArray });
        await submitDraft({ responseId: existingDraft._id, memberId: userId });
      } else {
        // Direct submit (no draft exists)
        const fvArray = Object.entries(fieldValues)
          .filter(([_, value]) => value !== "")
          .map(([fieldId, value]) => ({
            fieldId: fieldId as Id<"formFields">,
            value,
          }));
        await submitFormResponse({
          formId,
          communityId,
          memberId: userId,
          fieldValues: fvArray,
        });
      }
      setMessage({ type: "success", text: "Submitted successfully!" });
      setTimeout(() => {
        router.push(`/community-only/trackers/view?communityId=${communityId}`);
      }, 1500);
    } catch (e: any) {
      setMessage({ type: "error", text: e.message });
    }
    setSubmitting(false);
  };

  if (!communityId || !formId) {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>Missing parameters.</p>
        <Link href="/my-communities" style={{ color: BRAND }}>Back to Communities</Link>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: FONT, paddingBottom: "5rem" }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)",
        padding: "1rem",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
      }}>
        <Link
          href={`/community-only/trackers?communityId=${communityId}`}
          style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}
        >
          ←
        </Link>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
            {formDetails?.name || "Loading..."}
          </h1>
          <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.85 }}>
            {saving ? "Saving draft..." : "Auto-saved"}
          </p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          margin: "0.75rem 1rem",
          padding: "0.6rem 0.75rem",
          borderRadius: 8,
          background: message.type === "success" ? "#e8f5e9" : "#ffebee",
          color: message.type === "success" ? "#2e7d32" : "#c62828",
          fontSize: "0.85rem",
          fontWeight: 500,
        }}>
          {message.text}
        </div>
      )}

      {/* Form Fields */}
      <div style={{ padding: "1rem" }}>
        {!formDetails && <p style={{ color: "#888", textAlign: "center" }}>Loading form...</p>}
        {formDetails?.fields?.map((field: any) => (
          <div key={field._id} style={{ marginBottom: "1rem" }}>
            <label style={{
              display: "block",
              marginBottom: "0.3rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#333",
            }}>
              {field.label}
              {field.required && <span style={{ color: "#d32f2f", marginLeft: "0.25rem" }}>*</span>}
              {field.isCalculated && (
                <span style={{
                  marginLeft: "0.5rem",
                  fontSize: "0.65rem",
                  color: "#1976d2",
                  fontWeight: 500,
                  background: "#e3f2fd",
                  padding: "0.1rem 0.3rem",
                  borderRadius: 3,
                }}>
                  Auto
                </span>
              )}
            </label>
            {field.helpText && (
              <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.72rem", color: "#888" }}>{field.helpText}</p>
            )}

            {field.fieldType === "select" ? (
              <select
                value={fieldValues[String(field._id)] || ""}
                onChange={(e) => handleFieldChange(String(field._id), e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.55rem",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  fontSize: "0.9rem",
                  fontFamily: FONT,
                  boxSizing: "border-box",
                }}
              >
                <option value="">Select...</option>
                {field.options?.map((opt: string) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.fieldType === "textarea" ? (
              <textarea
                value={fieldValues[String(field._id)] || ""}
                onChange={(e) => handleFieldChange(String(field._id), e.target.value)}
                placeholder={field.placeholder || ""}
                rows={3}
                style={{
                  width: "100%",
                  padding: "0.55rem",
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  fontSize: "0.9rem",
                  fontFamily: FONT,
                  boxSizing: "border-box",
                }}
              />
            ) : field.fieldType === "checkbox" ? (
              <div>
                {field.options?.map((opt: string) => (
                  <label key={opt} style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem", fontSize: "0.85rem" }}>
                    <input
                      type="checkbox"
                      checked={(fieldValues[String(field._id)] || "").split(",").includes(opt)}
                      onChange={(e) => {
                        const current = (fieldValues[String(field._id)] || "").split(",").filter(Boolean);
                        const next = e.target.checked
                          ? [...current, opt]
                          : current.filter((v) => v !== opt);
                        handleFieldChange(String(field._id), next.join(","));
                      }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : (
              <input
                type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : field.fieldType === "email" ? "email" : "text"}
                value={fieldValues[String(field._id)] || ""}
                onChange={(e) => handleFieldChange(String(field._id), e.target.value)}
                placeholder={field.placeholder || ""}
                readOnly={!!field.isCalculated}
                style={{
                  width: "100%",
                  padding: "0.55rem",
                  borderRadius: 8,
                  border: `1px solid ${field.isCalculated ? "#90caf9" : "#ccc"}`,
                  fontSize: "0.9rem",
                  fontFamily: FONT,
                  boxSizing: "border-box",
                  background: field.isCalculated ? "#e3f2fd" : "#fff",
                  color: field.isCalculated ? "#1565c0" : "#1a1a1a",
                  fontWeight: field.isCalculated ? 600 : 400,
                }}
              />
            )}
          </div>
        ))}

        {/* Submit Button */}
        {formDetails && (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: submitting ? "#999" : BRAND,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: "1rem",
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              fontFamily: FONT,
              marginTop: "0.5rem",
            }}
          >
            {submitting ? "Submitting..." : "✓ Submit Entry"}
          </button>
        )}
      </div>

      <CommunityTabBar />
    </div>
  );
}
