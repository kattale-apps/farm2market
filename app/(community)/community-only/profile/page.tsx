"use client";

import { useEffect, useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import CommunityTabBar from "@/app/components/CommunityTabBar";

const BRAND = "#2e7d32";
const FONT = '"Montserrat", sans-serif';

const ROLE_COLORS: Record<string, string> = {
  farmer: "#2e7d32",
  trader: "#1565c0",
  buyer: "#6a1b9a",
  vendor: "#e65100",
  transporter: "#0277bd",
  store: "#c62828",
  admin: "#37474f",
};

const SUPPLY_CHAIN_ROLES = [
  "Farmer", "Market vendor", "Trader", "Buyer", "Transporter",
  "Storage provider", "Stockist", "Agent", "Distributor",
  "Investor", "Sponsor", "Agroprocessor", "Exporter",
  "Agronomist", "VET doctor", "Agro-machinery repair",
  "Input supplier", "Financial services", "Other",
];

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed", bottom: 80, right: 16,
      background: BRAND, color: "#fff",
      padding: "0.75rem 1.25rem", borderRadius: 10,
      boxShadow: "0 4px 12px rgba(0,0,0,0.25)", zIndex: 50,
      fontFamily: FONT, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 8,
    }}>
      <span>✓</span><span>{message}</span>
    </div>
  );
}

/**
 * Live Profile Form Field — saves on blur (no submit button).
 */
function LiveProfileField({
  field,
  formId,
  communityId,
  memberId,
  initialValue,
  onSaved,
}: {
  field: any;
  formId: Id<"communityForms">;
  communityId: Id<"communities">;
  memberId: Id<"users">;
  initialValue: string;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const upsert = useMutation((api as any).forms.upsertProfileFormField);

  const handleBlur = useCallback(async () => {
    if (value === initialValue) return; // no change
    setSaving(true);
    try {
      await upsert({
        formId,
        communityId,
        memberId,
        fieldId: field._id,
        value,
      });
      onSaved();
    } catch (err) {
      console.error("Failed to save field:", err);
    } finally {
      setSaving(false);
    }
  }, [value, initialValue, formId, communityId, memberId, field._id, upsert, onSaved]);

  const fieldStyle = {
    width: "100%",
    padding: "0.7rem 0.9rem",
    border: saving ? "2px solid #66bb6a" : "1px solid #ccc",
    borderRadius: 10,
    fontSize: "clamp(0.9rem, 2.5vw, 1rem)",
    fontFamily: FONT,
    background: saving ? "#f1f8e9" : "#fff",
    color: "#333",
    boxSizing: "border-box" as const,
    transition: "border-color 0.2s, background 0.2s",
    minHeight: 44,
  };

  if (field.fieldType === "select" && field.options?.length) {
    return (
      <div style={{ marginBottom: "0.8rem" }}>
        <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: "0.9rem", color: "#333" }}>
          {field.label} {field.required && <span style={{ color: "#e53935" }}>*</span>}
        </label>
        {field.helpText && <p style={{ fontSize: "0.78rem", color: "#888", margin: "0 0 4px" }}>{field.helpText}</p>}
        <select value={value} onChange={(e) => setValue(e.target.value)} onBlur={handleBlur} style={fieldStyle}>
          <option value="">{field.placeholder || "Select..."}</option>
          {field.options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    );
  }

  if (field.fieldType === "textarea") {
    return (
      <div style={{ marginBottom: "0.8rem" }}>
        <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: "0.9rem", color: "#333" }}>
          {field.label} {field.required && <span style={{ color: "#e53935" }}>*</span>}
        </label>
        {field.helpText && <p style={{ fontSize: "0.78rem", color: "#888", margin: "0 0 4px" }}>{field.helpText}</p>}
        <textarea value={value} onChange={(e) => setValue(e.target.value)} onBlur={handleBlur}
          placeholder={field.placeholder || ""} rows={3}
          style={{ ...fieldStyle, resize: "vertical" as const }} />
      </div>
    );
  }

  if (field.fieldType === "checkbox") {
    return (
      <div style={{ marginBottom: "0.8rem", display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={value === "true"}
          onChange={(e) => {
            const newVal = e.target.checked ? "true" : "false";
            setValue(newVal);
            // Save immediately on checkbox change
            setSaving(true);
            upsert({ formId, communityId, memberId, fieldId: field._id, value: newVal })
              .then(() => onSaved())
              .catch(console.error)
              .finally(() => setSaving(false));
          }}
          style={{ width: 20, height: 20, accentColor: BRAND }} />
        <label style={{ fontWeight: 600, fontSize: "0.9rem", color: "#333" }}>
          {field.label} {field.required && <span style={{ color: "#e53935" }}>*</span>}
        </label>
      </div>
    );
  }

  // Default: text/email/phone/number/date
  return (
    <div style={{ marginBottom: "0.8rem" }}>
      <label style={{ display: "block", marginBottom: 4, fontWeight: 600, fontSize: "0.9rem", color: "#333" }}>
        {field.label} {field.required && <span style={{ color: "#e53935" }}>*</span>}
      </label>
      {field.helpText && <p style={{ fontSize: "0.78rem", color: "#888", margin: "0 0 4px" }}>{field.helpText}</p>}
      <input
        type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : field.fieldType === "email" ? "email" : "text"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder={field.placeholder || ""}
        style={fieldStyle}
      />
    </div>
  );
}

export default function CommunityProfilePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const communityId = searchParams.get("communityId") as Id<"communities"> | null;

  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [otherRoleText, setOtherRoleText] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [creatingValidation, setCreatingValidation] = useState(false);

  const updateRole = useMutation(api.farmerProfile.updateSupplyChainRole);

  // Farm Validation (only for farmer role in AgroFresh)
  const createNewValidation = useMutation(api.farmValidation.createNewDraft) as (
    args: { farmerId: Id<"users"> }
  ) => Promise<Id<"agroFreshUGFarmValidations">>;
  const myAgroFreshDrafts = useQuery(
    api.farmValidation.getMyDrafts,
    userId && userRole === "farmer" ? { farmerId: userId } : "skip"
  );

  // Community profile forms
  const profileForms = useQuery(
    (api as any).forms.getCommunityProfileForms,
    communityId ? { communityId } : "skip"
  );

  // My saved profile form responses
  const myResponses = useQuery(
    (api as any).forms.getMyProfileFormResponses,
    communityId && userId ? { communityId, memberId: userId } : "skip"
  );

  useEffect(() => {
    const raw = localStorage.getItem("pilot_user");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setUserId((parsed?.userId || parsed?._id || parsed?.id || parsed) as Id<"users">);
        setUserRole(parsed?.role || "");
      } catch {
        setUserId(raw as Id<"users">);
      }
    }
  }, []);

  const agroFreshCommunityId = process.env.NEXT_PUBLIC_AGROFRESH_COMMUNITY_ID;
  const isAgroFresh = !!(agroFreshCommunityId && communityId === agroFreshCommunityId);
  const showFarmValidation = isAgroFresh && userRole === "farmer";

  const handleSave = async () => {
    if (!userId) return;
    setIsSaving(true);
    try {
      await updateRole({
        userId,
        supplyChainRole: selectedRole || undefined,
        supplyChainRoleOther: selectedRole === "Other" ? otherRoleText : undefined,
      });
      setToastMessage("Role updated successfully");
      setSelectedRole("");
      setOtherRoleText("");
    } catch (error) {
      console.error("Failed to save role:", error);
      setToastMessage("Failed to save role. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartFarmValidation = async () => {
    if (!userId) return;
    setCreatingValidation(true);
    try {
      const latestDraft = myAgroFreshDrafts?.length
        ? [...myAgroFreshDrafts].sort((a: any, b: any) => {
            const aTime = a.updatedAt ?? a.createdAt ?? a._creationTime ?? 0;
            const bTime = b.updatedAt ?? b.createdAt ?? b._creationTime ?? 0;
            return bTime - aTime;
          })[0]
        : null;

      if (latestDraft?._id) {
        router.push(`/farm-validation/${latestDraft._id}`);
      } else {
        const newFormId = await createNewValidation({ farmerId: userId });
        router.push(`/farm-validation/${newFormId}`);
      }
    } catch (err: any) {
      setToastMessage(err?.message || "Failed to start farm validation");
    } finally {
      setCreatingValidation(false);
    }
  };

  if (!userId) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: FONT }}>
        <p style={{ color: "#999", fontSize: "1.1rem" }}>Loading...</p>
      </div>
    );
  }

  const roleBadgeColor = ROLE_COLORS[userRole] || "#555";

  return (
    <div style={{ minHeight: "100vh", padding: "1rem", paddingBottom: "5rem", fontFamily: FONT }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <h1 style={{ fontSize: "clamp(1.3rem, 4vw, 1.6rem)", fontWeight: 700, color: "#1a1a1a", marginBottom: "1rem" }}>
          Your Profile
        </h1>

        {/* Role Banner */}
        {userRole && (
          <div style={{
            background: `linear-gradient(135deg, ${roleBadgeColor}, ${roleBadgeColor}dd)`,
            color: "#fff", borderRadius: 12, padding: "0.85rem 1.1rem",
            marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: 10,
            boxShadow: `0 2px 8px ${roleBadgeColor}44`,
          }}>
            <span style={{ fontSize: "1.4rem" }}>
              {userRole === "farmer" ? "🌾" : userRole === "trader" ? "📊" : userRole === "buyer" ? "🛒" :
               userRole === "vendor" ? "🏪" : userRole === "transporter" ? "🚛" : userRole === "store" ? "🏬" : "👤"}
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "clamp(1rem, 3vw, 1.15rem)", textTransform: "capitalize" }}>
                {userRole}
              </div>
              <div style={{ fontSize: "0.78rem", opacity: 0.9 }}>Your signup role</div>
            </div>
          </div>
        )}

        {/* Supply Chain Role Card */}
        <div style={{
          background: "#fff", borderRadius: 14, padding: "clamp(1rem, 3vw, 1.5rem)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)", border: "1px solid #e0e0e0", marginBottom: "1.25rem",
        }}>
          <h2 style={{ fontSize: "clamp(1.05rem, 3vw, 1.2rem)", fontWeight: 700, color: "#1a1a1a", margin: "0 0 0.5rem" }}>
            Your role in the value chain
          </h2>
          <p style={{ fontSize: "clamp(0.9rem, 2.5vw, 1rem)", color: "#666", margin: "0 0 1rem" }}>
            Help others understand what you do in the supply chain
          </p>

          <select
            value={selectedRole}
            onChange={(e) => { setSelectedRole(e.target.value); if (e.target.value !== "Other") setOtherRoleText(""); }}
            disabled={isSaving}
            style={{
              width: "100%", padding: "0.75rem 1rem", border: "1px solid #ccc", borderRadius: 10,
              fontSize: "clamp(0.95rem, 2.5vw, 1.05rem)", fontFamily: FONT, marginBottom: "0.75rem",
              minHeight: 48, background: "#fff", color: "#333",
            }}
          >
            <option value="">Select a role...</option>
            {SUPPLY_CHAIN_ROLES.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>

          {selectedRole === "Other" && (
            <input
              type="text"
              value={otherRoleText}
              onChange={(e) => setOtherRoleText(e.target.value)}
              placeholder="Describe your role..."
              disabled={isSaving}
              style={{
                width: "100%", padding: "0.75rem 1rem", border: "1px solid #ccc", borderRadius: 10,
                fontSize: "clamp(0.95rem, 2.5vw, 1.05rem)", fontFamily: FONT, marginBottom: "0.75rem",
                minHeight: 48, boxSizing: "border-box",
              }}
            />
          )}

          <button
            onClick={handleSave}
            disabled={isSaving || !selectedRole || (selectedRole === "Other" && !otherRoleText.trim())}
            style={{
              width: "100%", padding: "0.75rem", background: BRAND, color: "#fff",
              border: "none", borderRadius: 10, fontSize: "clamp(0.95rem, 2.5vw, 1.05rem)",
              fontWeight: 600, fontFamily: FONT, cursor: isSaving ? "not-allowed" : "pointer",
              opacity: (!selectedRole || isSaving) ? 0.5 : 1, minHeight: 48,
            }}
          >
            {isSaving ? "Saving..." : "Save role"}
          </button>

          <p style={{ fontSize: "0.8rem", color: "#999", textAlign: "center", marginTop: "0.75rem" }}>
            Optional &bull; You can update this anytime
          </p>
        </div>

        {/* Farm Validation (AgroFresh + farmer only) */}
        {showFarmValidation && (
          <div style={{
            background: "#fff", borderRadius: 14, padding: "clamp(1rem, 3vw, 1.5rem)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)", border: "1px solid #e0e0e0", marginBottom: "1.25rem",
          }}>
            <h2 style={{ fontSize: "clamp(1.05rem, 3vw, 1.2rem)", fontWeight: 700, color: "#1a1a1a", margin: "0 0 0.5rem" }}>
              Farm Validation
            </h2>
            <p style={{ fontSize: "clamp(0.9rem, 2.5vw, 1rem)", color: "#555", margin: "0 0 1rem" }}>
              Submit a new farm for validation with AGROFRESH UG.
            </p>
            <button
              onClick={handleStartFarmValidation}
              disabled={creatingValidation}
              style={{
                padding: "0.75rem 1.25rem", background: BRAND, color: "#fff",
                border: "none", borderRadius: 10, fontSize: "clamp(0.95rem, 2.5vw, 1.05rem)",
                fontWeight: 600, fontFamily: FONT,
                cursor: creatingValidation ? "not-allowed" : "pointer",
                opacity: creatingValidation ? 0.7 : 1,
              }}
            >
              {creatingValidation ? "Starting..." : "Start New Farm Validation"}
            </button>
          </div>
        )}

        {/* Live Profile Forms */}
        {profileForms && profileForms.length > 0 && (
          <div style={{ marginBottom: "1.25rem" }}>
            <h2 style={{ fontSize: "clamp(1.05rem, 3vw, 1.2rem)", fontWeight: 700, color: "#1a1a1a", margin: "0 0 0.75rem" }}>
              📋 Community Profile
            </h2>
            <p style={{ fontSize: "0.85rem", color: "#777", marginBottom: "0.75rem" }}>
              Fill in your details below. Each field saves automatically when you move to the next.
            </p>
            {profileForms.map((form: any) => {
              const responsesForForm = myResponses?.[String(form._id)];
              return (
                <div
                  key={form._id}
                  style={{
                    background: "#fff",
                    borderRadius: 14,
                    padding: "clamp(1rem, 3vw, 1.25rem)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    border: "1px solid #e0e0e0",
                    marginBottom: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: "clamp(0.95rem, 2.5vw, 1.05rem)", fontWeight: 700, color: "#333" }}>
                      {form.name}
                    </h3>
                    <span style={{
                      fontSize: "0.68rem", fontWeight: 600, padding: "2px 8px",
                      borderRadius: 999, background: "#e8f5e9", color: BRAND,
                    }}>
                      {form.fields?.length || 0} fields
                    </span>
                  </div>
                  {form.description && (
                    <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", color: "#666" }}>
                      {form.description}
                    </p>
                  )}
                  {/* Render each field live */}
                  {(form.fields || []).map((field: any) => (
                    <LiveProfileField
                      key={field._id}
                      field={field}
                      formId={form._id}
                      communityId={communityId!}
                      memberId={userId!}
                      initialValue={responsesForForm?.fieldValues?.[String(field._id)] || ""}
                      onSaved={() => setToastMessage("Saved")}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
      <CommunityTabBar />
    </div>
  );
}
