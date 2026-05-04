"use client";

import { useEffect, useMemo, useState } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { useOfflineQuery } from "../../hooks/useOfflineQuery";
import { useOfflineMutation } from "../../hooks/useOfflineMutation";

const BRAND = "#2e7d32";
const BRAND_BG = "#e8f5e9";
const GOLD = "#f9a825";
const FONT = '"Montserrat", sans-serif';

export default function FarmNeedsPage() {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [activeTab, setActiveTab] = useState<"crops" | "livestock">("crops");
  const [selectedForm, setSelectedForm] = useState<any | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("pilot_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUserId(parsed.userId);
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const forms = useOfflineQuery(
    api.farmNeeds.getFarmNeedsFormsForFarmer,
    userId ? { farmerId: userId } : "skip"
  );

  const myResponses = useOfflineQuery(
    api.farmNeeds.getMyFarmNeedsResponses,
    userId ? { farmerId: userId } : "skip"
  );

  const submitResponse = useOfflineMutation(api.farmNeeds.submitFarmNeedsResponse);

  const activeForms = useMemo(() => {
    const cropsForms = Array.isArray(forms?.crops) ? forms.crops : [];
    const livestockForms = Array.isArray(forms?.livestock) ? forms.livestock : [];
    return activeTab === "crops" ? cropsForms : livestockForms;
  }, [forms, activeTab]);

  const handleFillForm = (form: any) => {
    setSelectedForm(form);
    setFormValues({});
    setMessage(null);
  };

  const handleFieldChange = (fieldId: string, value: string) => {
    setFormValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async () => {
    if (!selectedForm || !userId) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const selectedFields = Array.isArray(selectedForm.fields) ? selectedForm.fields : [];
      const fieldValues = selectedFields.map((field: any) => ({
        fieldId: field._id,
        value: formValues[field._id] || "",
      }));

      await submitResponse({
        farmerId: userId,
        formId: selectedForm.formId,
        communityId: selectedForm.communityId,
        fieldValues,
      });

      setMessage({ type: "success", text: "Form submitted successfully!" });
      setSelectedForm(null);
      setFormValues({});
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: "error", text: `Failed to submit: ${error.message}` });
    } finally {
      setSubmitting(false);
    }
  };

  if (!userId) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ color: "#666" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", fontFamily: FONT }}>
      {/* Header */}
      <div style={{
        background: BRAND,
        color: "#fff",
        padding: "0.75rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }}>
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.3rem", lineHeight: 1 }}>←</Link>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.4rem" }}>🌱</span>
          <h1 style={{ margin: 0, fontSize: "clamp(1rem, 4vw, 1.2rem)", fontWeight: 700, fontFamily: FONT }}>
            Farm Needs
          </h1>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "1rem", maxWidth: "900px", margin: "0 auto" }}>
        {message && (
          <div style={{
            padding: "1rem",
            marginBottom: "1rem",
            background: message.type === "success" ? "#e8f5e9" : "#ffebee",
            border: `1px solid ${message.type === "success" ? "#4caf50" : "#ef5350"}`,
            borderRadius: "8px",
            color: message.type === "success" ? "#2e7d32" : "#c62828",
            fontWeight: 600,
          }}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "2px solid #e0e0e0" }}>
          <button
            onClick={() => setActiveTab("crops")}
            style={{
              padding: "0.75rem 1.5rem",
              background: activeTab === "crops" ? BRAND : "transparent",
              color: activeTab === "crops" ? "#fff" : "#666",
              border: "none",
              borderBottom: activeTab === "crops" ? `3px solid ${GOLD}` : "none",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: activeTab === "crops" ? 700 : 600,
              fontFamily: FONT,
            }}>
            🌾 Crops
          </button>
          <button
            onClick={() => setActiveTab("livestock")}
            style={{
              padding: "0.75rem 1.5rem",
              background: activeTab === "livestock" ? BRAND : "transparent",
              color: activeTab === "livestock" ? "#fff" : "#666",
              border: "none",
              borderBottom: activeTab === "livestock" ? `3px solid ${GOLD}` : "none",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: activeTab === "livestock" ? 700 : 600,
              fontFamily: FONT,
            }}>
            🐄 Livestock
          </button>
        </div>

        {/* Forms List */}
        {forms === undefined ? (
          <p style={{ color: "#999" }}>Loading forms...</p>
        ) : activeForms.length === 0 ? (
          <div style={{ padding: "2rem", background: "#fff", borderRadius: "12px", textAlign: "center", border: "1px solid #e0e0e0" }}>
            <p style={{ color: "#666", fontSize: "1rem", marginBottom: 0 }}>
              No {activeTab} forms available yet.
            </p>
            <p style={{ color: "#999", fontSize: "0.9rem", marginTop: "0.5rem" }}>
              Check back soon or contact your community admin.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {activeForms.map((form: any) => {
              const formFields = Array.isArray(form.fields) ? form.fields : [];
              return (
                <div key={form.formId} style={{
                  padding: "1.25rem",
                  background: "#fff",
                  borderRadius: "12px",
                  border: `1px solid ${form.category === "crops" ? "#a5d6a7" : "#ffe0b2"}`,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: "0 0 0.25rem", fontSize: "1.1rem", color: "#2c2c2c", fontWeight: 700, fontFamily: FONT }}>
                        {form.name}
                      </h3>
                      {form.description && (
                        <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", color: "#666" }}>{form.description}</p>
                      )}
                      <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "#999" }}>
                        {form.communityName} • {formFields.length} fields
                      </p>
                    </div>
                    <button
                      onClick={() => handleFillForm(form)}
                      style={{
                        padding: "0.6rem 1.2rem",
                        background: BRAND,
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}>
                      Fill Form →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Past Submissions */}
        {myResponses && myResponses.length > 0 && (
          <div style={{ marginTop: "2rem", padding: "1.25rem", background: "#fff", borderRadius: "12px", border: "1px solid #e0e0e0" }}>
            <h3 style={{ margin: "0 0 1rem", fontSize: "1.1rem", color: "#2c2c2c", fontWeight: 700, fontFamily: FONT }}>
              📋 Your Submissions ({myResponses.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {myResponses.map((response: any) => (
                <div key={response.responseId} style={{
                  padding: "0.75rem 1rem",
                  background: "#f9f9f9",
                  borderRadius: "8px",
                  border: "1px solid #e0e0e0",
                  fontSize: "0.9rem",
                }}>
                  <div style={{ fontWeight: 600, color: "#2c2c2c", marginBottom: "0.25rem" }}>
                    {response.formName}
                  </div>
                  <div style={{ color: "#666", fontSize: "0.85rem" }}>
                    {response.communityName} • {new Date(response.submittedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {selectedForm && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "1rem",
        }} onClick={() => setSelectedForm(null)}>
          <div style={{
            background: "#fff",
            borderRadius: "12px",
            padding: isMobile ? "1.5rem" : "2rem",
            maxWidth: "600px",
            width: "100%",
            maxHeight: "90vh",
            overflowY: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.3rem", color: "#2c2c2c", fontWeight: 700, fontFamily: FONT }}>
                {selectedForm.name}
              </h2>
              <button
                onClick={() => setSelectedForm(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "#999",
                  padding: "0.2rem",
                }}>
                ✕
              </button>
            </div>

            {selectedForm.description && (
              <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "1.5rem" }}>
                {selectedForm.description}
              </p>
            )}

            <form style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {(Array.isArray(selectedForm.fields) ? selectedForm.fields : []).map((field: any) => (
                <div key={field._id}>
                  <label style={{
                    display: "block",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: "#2c2c2c",
                    marginBottom: "0.35rem",
                    fontFamily: FONT,
                  }}>
                    {field.label}
                    {field.required && <span style={{ color: "#d32f2f" }}> *</span>}
                  </label>
                  {field.helpText && (
                    <p style={{ fontSize: "0.8rem", color: "#999", margin: "0.25rem 0 0.5rem" }}>
                      {field.helpText}
                    </p>
                  )}

                  {field.fieldType === "text" || field.fieldType === "email" || field.fieldType === "phone" || field.fieldType === "number" ? (
                    <input
                      type={field.fieldType === "number" ? "number" : field.fieldType === "phone" ? "tel" : field.fieldType}
                      value={formValues[field._id] || ""}
                      onChange={(e) => handleFieldChange(field._id, e.target.value)}
                      placeholder={field.placeholder}
                      required={field.required}
                      style={{
                        width: "100%",
                        padding: "0.6rem 0.8rem",
                        borderRadius: "8px",
                        border: "1px solid #ddd",
                        fontSize: "0.95rem",
                        fontFamily: FONT,
                        boxSizing: "border-box",
                      }} />
                  ) : field.fieldType === "textarea" ? (
                    <textarea
                      value={formValues[field._id] || ""}
                      onChange={(e) => handleFieldChange(field._id, e.target.value)}
                      placeholder={field.placeholder}
                      required={field.required}
                      rows={4}
                      style={{
                        width: "100%",
                        padding: "0.6rem 0.8rem",
                        borderRadius: "8px",
                        border: "1px solid #ddd",
                        fontSize: "0.95rem",
                        fontFamily: FONT,
                        boxSizing: "border-box",
                        resize: "vertical",
                      }} />
                  ) : field.fieldType === "select" ? (
                    <select
                      value={formValues[field._id] || ""}
                      onChange={(e) => handleFieldChange(field._id, e.target.value)}
                      required={field.required}
                      style={{
                        width: "100%",
                        padding: "0.6rem 0.8rem",
                        borderRadius: "8px",
                        border: "1px solid #ddd",
                        fontSize: "0.95rem",
                        fontFamily: FONT,
                        boxSizing: "border-box",
                      }}>
                      <option value="">-- Select --</option>
                      {field.options && field.options.map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.fieldType === "checkbox" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {field.options && field.options.map((opt: string) => (
                        <label key={opt} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            value={opt}
                            checked={(formValues[field._id] || "").split(",").includes(opt)}
                            onChange={(e) => {
                              const current = (formValues[field._id] || "").split(",").filter(v => v);
                              if (e.target.checked) {
                                current.push(opt);
                              } else {
                                current.splice(current.indexOf(opt), 1);
                              }
                              handleFieldChange(field._id, current.join(","));
                            }} />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  ) : field.fieldType === "date" ? (
                    <input
                      type="date"
                      value={formValues[field._id] || ""}
                      onChange={(e) => handleFieldChange(field._id, e.target.value)}
                      required={field.required}
                      style={{
                        width: "100%",
                        padding: "0.6rem 0.8rem",
                        borderRadius: "8px",
                        border: "1px solid #ddd",
                        fontSize: "0.95rem",
                        fontFamily: FONT,
                        boxSizing: "border-box",
                      }} />
                  ) : (
                    <input
                      type="text"
                      value={formValues[field._id] || ""}
                      onChange={(e) => handleFieldChange(field._id, e.target.value)}
                      placeholder={field.placeholder}
                      required={field.required}
                      style={{
                        width: "100%",
                        padding: "0.6rem 0.8rem",
                        borderRadius: "8px",
                        border: "1px solid #ddd",
                        fontSize: "0.95rem",
                        fontFamily: FONT,
                        boxSizing: "border-box",
                      }} />
                  )}
                </div>
              ))}

              <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    background: submitting ? "#ccc" : BRAND,
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    cursor: submitting ? "not-allowed" : "pointer",
                    fontSize: "1rem",
                    fontWeight: 700,
                    fontFamily: FONT,
                  }}>
                  {submitting ? "Submitting..." : "Submit Form"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedForm(null)}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    background: "#f5f5f5",
                    color: "#666",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "1rem",
                    fontWeight: 700,
                    fontFamily: FONT,
                  }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
