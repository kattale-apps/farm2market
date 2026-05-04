"use client";

export const dynamic = "force-dynamic";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useStoredUser } from "../../hooks/useStoredUser";

const BRAND = "#2e7d32";
const FONT = '"Montserrat", sans-serif';

const CATEGORY_LABELS: Record<string, string> = {
  revenue: "Revenue",
  expense: "Expense",
  inventory: "Inventory",
  profit_loss: "Profit & Loss",
  cashflow: "Cash Flow",
  custom: "Custom",
};

const CATEGORY_COLORS: Record<string, string> = {
  revenue: "#2e7d32",
  expense: "#d32f2f",
  inventory: "#1976d2",
  profit_loss: "#f57c00",
  cashflow: "#00838f",
  custom: "#7b1fa2",
};

export default function BusinessTrackersPage() {
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  const [selectedCommunityId, setSelectedCommunityId] = useState<Id<"communities"> | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderName, setBuilderName] = useState("");
  const [builderDescription, setBuilderDescription] = useState("");
  const [builderCategory, setBuilderCategory] = useState("custom");
  const [builderFields, setBuilderFields] = useState<any[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [managingFormId, setManagingFormId] = useState<Id<"communityForms"> | null>(null);

  // (replaced by useStoredUser above)

  const currentUser = useQuery(api.auth.getUser, userId ? { userId } : "skip");
  const isSuperAdmin = currentUser?.role === "admin" && (
    currentUser?.adminLevel === "super" ||
    (currentUser?.adminLevel === undefined && !currentUser?.adminCategory)
  );

  const communities = useQuery(
    api.introspection.getCommunitiesForAdmin,
    userId && isSuperAdmin ? { adminId: userId } : "skip"
  );

  const forms = useQuery(
    (api as any).forms.getCommunityForms,
    selectedCommunityId ? { communityId: selectedCommunityId } : "skip"
  );

  const templates = useQuery((api as any).forms.getTrackerTemplates, {});

  const seedTemplates = useMutation((api as any).forms.seedTrackerTemplates);
  const createTrackerFromTemplate = useMutation((api as any).forms.createTrackerFromTemplate);
  const createForm = useMutation((api as any).forms.createForm);
  const addFormField = useMutation((api as any).forms.addFormField);
  const updateForm = useMutation((api as any).forms.updateForm);
  const deleteForm = useMutation((api as any).forms.deleteForm);

  // Managing form details
  const managingFormDetails = useQuery(
    (api as any).forms.getFormDetails,
    managingFormId ? { formId: managingFormId } : "skip"
  );
  const formResponses = useQuery(
    (api as any).forms.getFormResponses,
    managingFormId ? { formId: managingFormId } : "skip"
  );

  // Auto-seed templates on first load
  useEffect(() => {
    if (templates && templates.length === 0) {
      seedTemplates({}).catch(() => {});
    }
  }, [templates, seedTemplates]);

  // Auto-select first community
  useEffect(() => {
    if (communities && communities.length > 0 && !selectedCommunityId) {
      setSelectedCommunityId(communities[0]._id);
    }
  }, [communities, selectedCommunityId]);

  const handleCreateFromTemplate = async (templateId: Id<"trackerTemplates">) => {
    if (!selectedCommunityId || !userId) return;
    try {
      await createTrackerFromTemplate({
        templateId,
        communityId: selectedCommunityId,
        adminId: userId,
      });
      setMessage({ type: "success", text: "Tracker created from template!" });
      setTimeout(() => setMessage(null), 4000);
    } catch (e: any) {
      setMessage({ type: "error", text: e.message });
    }
  };

  const handleCreateCustom = async () => {
    if (!selectedCommunityId || !userId || !builderName.trim()) return;
    try {
      const result = await createForm({
        communityId: selectedCommunityId,
        adminId: userId,
        name: builderName,
        description: builderDescription || undefined,
        category: builderCategory,
      });
      // Add fields
      for (const f of builderFields) {
        await addFormField({
          formId: result._id,
          fieldType: f.fieldType,
          label: f.label,
          required: f.required,
          helpText: f.helpText || undefined,
          placeholder: f.placeholder || undefined,
          options: f.options?.length > 0 ? f.options : undefined,
          isCalculated: f.isCalculated || undefined,
          formula: f.formula || undefined,
        });
      }
      setMessage({ type: "success", text: "Custom tracker created!" });
      setShowBuilder(false);
      setBuilderName("");
      setBuilderDescription("");
      setBuilderCategory("custom");
      setBuilderFields([]);
      setTimeout(() => setMessage(null), 4000);
    } catch (e: any) {
      setMessage({ type: "error", text: e.message });
    }
  };

  const handleToggleActive = async (formId: Id<"communityForms">, isActive: boolean) => {
    try {
      await updateForm({ formId, isActive: !isActive });
    } catch (e: any) {
      setMessage({ type: "error", text: e.message });
    }
  };

  const handleDelete = async (formId: Id<"communityForms">) => {
    if (!confirm("Delete this tracker and all its data? This cannot be undone.")) return;
    try {
      await deleteForm({ formId });
      if (managingFormId === formId) setManagingFormId(null);
      setMessage({ type: "success", text: "Tracker deleted" });
      setTimeout(() => setMessage(null), 4000);
    } catch (e: any) {
      setMessage({ type: "error", text: e.message });
    }
  };

  const addBuilderField = () => {
    setBuilderFields([...builderFields, {
      fieldType: "text",
      label: "",
      required: true,
      helpText: "",
      placeholder: "",
      options: [],
      isCalculated: false,
      formula: "",
    }]);
  };

  const updateBuilderField = (index: number, updates: any) => {
    const next = [...builderFields];
    next[index] = { ...next[index], ...updates };
    setBuilderFields(next);
  };

  const removeBuilderField = (index: number) => {
    setBuilderFields(builderFields.filter((_, i) => i !== index));
  };

  if (!userId) {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isSuperAdmin && currentUser) {
    return (
      <div style={{ padding: "2rem", fontFamily: FONT, textAlign: "center" }}>
        <p>Access denied. SuperAdmin only.</p>
        <Link href="/" style={{ color: BRAND }}>Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem", fontFamily: FONT, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/" style={{ color: BRAND, textDecoration: "none", fontSize: "0.9rem" }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ margin: "0.75rem 0 0.25rem 0", fontSize: "clamp(1.4rem, 4vw, 2rem)", fontWeight: 700, color: "#1a1a1a" }}>
          📊 Financial Overview
        </h1>
        <p style={{
          margin: 0,
          fontSize: "1rem",
          color: BRAND,
          fontWeight: 600,
          fontStyle: "italic",
          letterSpacing: "0.02em",
        }}>
          Know Your Numbers
        </p>
        <Link href="/admin/performance-insights" style={{
          display: "inline-block",
          marginTop: "0.75rem",
          padding: "0.5rem 1.2rem",
          background: BRAND,
          color: "#fff",
          borderRadius: 8,
          textDecoration: "none",
          fontWeight: 600,
          fontSize: "0.9rem",
        }}>
          📈 View Performance Insights
        </Link>
      </div>

      {/* Status message */}
      {message && (
        <div style={{
          padding: "0.75rem 1rem",
          borderRadius: 8,
          marginBottom: "1rem",
          background: message.type === "success" ? "#e8f5e9" : "#ffebee",
          color: message.type === "success" ? "#2e7d32" : "#c62828",
          fontWeight: 500,
          fontSize: "0.9rem",
        }}>
          {message.text}
        </div>
      )}

      {/* Community Selector */}
      {communities && communities.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ fontWeight: 600, fontSize: "0.9rem", display: "block", marginBottom: "0.5rem" }}>
            Select Community
          </label>
          <select
            value={selectedCommunityId || ""}
            onChange={(e) => {
              setSelectedCommunityId(e.target.value as Id<"communities">);
              setManagingFormId(null);
            }}
            style={{
              padding: "0.6rem 1rem",
              borderRadius: 8,
              border: "1px solid #ccc",
              fontSize: "0.95rem",
              fontFamily: FONT,
              minWidth: 220,
            }}
          >
            {communities.map((c: any) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Template Gallery */}
      {selectedCommunityId && (
        <>
          <div style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.75rem", color: "#333" }}>
              Quick Start Templates
            </h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))",
              gap: "1rem",
            }}>
              {templates && templates.map((t: any) => (
                <div key={t._id} style={{
                  padding: "1rem",
                  borderRadius: 12,
                  border: `2px solid ${CATEGORY_COLORS[t.category] || "#999"}`,
                  background: "#fff",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}>
                  <div style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: CATEGORY_COLORS[t.category] || "#666",
                    marginBottom: "0.4rem",
                  }}>
                    {CATEGORY_LABELS[t.category] || t.category}
                  </div>
                  <h3 style={{ margin: "0 0 0.3rem 0", fontSize: "0.95rem", fontWeight: 600 }}>{t.name}</h3>
                  <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.8rem", color: "#666" }}>
                    {t.description} • {t.fields.length} fields
                  </p>
                  <button
                    onClick={() => handleCreateFromTemplate(t._id)}
                    style={{
                      padding: "0.4rem 0.85rem",
                      background: CATEGORY_COLORS[t.category] || BRAND,
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    + Use Template
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Builder Toggle */}
          <div style={{ marginBottom: "1.5rem" }}>
            <button
              onClick={() => setShowBuilder(!showBuilder)}
              style={{
                padding: "0.6rem 1.2rem",
                background: showBuilder ? "#666" : BRAND,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 600,
              }}
            >
              {showBuilder ? "Cancel" : "🛠 Build Custom Tracker"}
            </button>
          </div>

          {/* Custom Builder */}
          {showBuilder && (
            <div style={{
              padding: "1.25rem",
              borderRadius: 12,
              background: "#f8f9fa",
              border: "1px solid #e0e0e0",
              marginBottom: "1.5rem",
            }}>
              <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: 700 }}>Build Custom Tracker</h3>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                <input
                  value={builderName}
                  onChange={(e) => setBuilderName(e.target.value)}
                  placeholder="Tracker Name"
                  style={{ flex: "1 1 200px", padding: "0.5rem", borderRadius: 6, border: "1px solid #ccc", fontFamily: FONT }}
                />
                <select
                  value={builderCategory}
                  onChange={(e) => setBuilderCategory(e.target.value)}
                  style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #ccc", fontFamily: FONT }}
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <input
                value={builderDescription}
                onChange={(e) => setBuilderDescription(e.target.value)}
                placeholder="Description (optional)"
                style={{ width: "100%", padding: "0.5rem", borderRadius: 6, border: "1px solid #ccc", fontFamily: FONT, marginBottom: "1rem", boxSizing: "border-box" }}
              />

              {/* Fields */}
              {builderFields.map((field, i) => (
                <div key={i} style={{
                  padding: "0.75rem",
                  borderRadius: 8,
                  background: "#fff",
                  border: "1px solid #ddd",
                  marginBottom: "0.5rem",
                }}>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      value={field.label}
                      onChange={(e) => updateBuilderField(i, { label: e.target.value })}
                      placeholder="Field Label"
                      style={{ flex: "1 1 120px", padding: "0.4rem", borderRadius: 4, border: "1px solid #ccc", fontSize: "0.85rem" }}
                    />
                    <select
                      value={field.fieldType}
                      onChange={(e) => updateBuilderField(i, { fieldType: e.target.value })}
                      style={{ padding: "0.4rem", borderRadius: 4, border: "1px solid #ccc", fontSize: "0.85rem" }}
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="select">Select</option>
                      <option value="textarea">Textarea</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="checkbox">Checkbox</option>
                      <option value="camera">Camera</option>
                      <option value="gps">GPS Location</option>
                    </select>
                    <label style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateBuilderField(i, { required: e.target.checked })}
                      />
                      Required
                    </label>
                    <label style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <input
                        type="checkbox"
                        checked={field.isCalculated || false}
                        onChange={(e) => updateBuilderField(i, { isCalculated: e.target.checked, fieldType: e.target.checked ? "number" : field.fieldType })}
                      />
                      Auto-calc
                    </label>
                    <button
                      onClick={() => removeBuilderField(i)}
                      style={{ padding: "0.3rem 0.5rem", background: "#ef5350", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.8rem" }}
                    >
                      ✕
                    </button>
                  </div>
                  {field.isCalculated && (
                    <input
                      value={field.formula || ""}
                      onChange={(e) => updateBuilderField(i, { formula: e.target.value })}
                      placeholder="Formula: e.g. revenue - expenses (use field labels)"
                      style={{ marginTop: "0.4rem", width: "100%", padding: "0.35rem", borderRadius: 4, border: "1px solid #ccc", fontSize: "0.8rem", boxSizing: "border-box" }}
                    />
                  )}
                  {field.fieldType === "select" && (
                    <input
                      value={(field.options || []).join(", ")}
                      onChange={(e) => updateBuilderField(i, { options: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                      placeholder="Options (comma-separated)"
                      style={{ marginTop: "0.4rem", width: "100%", padding: "0.35rem", borderRadius: 4, border: "1px solid #ccc", fontSize: "0.8rem", boxSizing: "border-box" }}
                    />
                  )}
                </div>
              ))}

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
                <button
                  onClick={addBuilderField}
                  style={{ padding: "0.4rem 0.8rem", background: "#1976d2", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}
                >
                  + Add Field
                </button>
                <button
                  onClick={handleCreateCustom}
                  disabled={!builderName.trim() || builderFields.length === 0}
                  style={{
                    padding: "0.4rem 0.8rem",
                    background: builderName.trim() && builderFields.length > 0 ? BRAND : "#ccc",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    cursor: builderName.trim() && builderFields.length > 0 ? "pointer" : "not-allowed",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                >
                  Create Tracker
                </button>
              </div>
            </div>
          )}

          {/* Active Trackers List */}
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.75rem", color: "#333" }}>
            Active Business Trackers
          </h2>
          {forms && forms.length === 0 && (
            <p style={{ color: "#888", fontSize: "0.9rem" }}>No trackers yet. Use a template or build a custom one above.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2rem" }}>
            {forms && forms.map((form: any) => (
              <div key={form._id} style={{
                padding: "1rem",
                borderRadius: 10,
                background: "#fff",
                border: "1px solid #e0e0e0",
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <span style={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: CATEGORY_COLORS[form.category] || "#666",
                      background: `${CATEGORY_COLORS[form.category] || "#666"}15`,
                      padding: "0.15rem 0.4rem",
                      borderRadius: 4,
                    }}>
                      {CATEGORY_LABELS[form.category] || form.category || "Custom"}
                    </span>
                    <h3 style={{ margin: "0.3rem 0 0.2rem 0", fontSize: "1rem", fontWeight: 600 }}>{form.name}</h3>
                    {form.description && <p style={{ margin: 0, fontSize: "0.8rem", color: "#666" }}>{form.description}</p>}
                    <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.75rem", color: "#999" }}>
                      {form.responseCount || 0} submissions • {form.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    <button
                      onClick={() => setManagingFormId(managingFormId === form._id ? null : form._id)}
                      style={{ padding: "0.35rem 0.7rem", background: "#1976d2", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 }}
                    >
                      {managingFormId === form._id ? "Close" : "View Data"}
                    </button>
                    <button
                      onClick={() => handleToggleActive(form._id, form.isActive)}
                      style={{ padding: "0.35rem 0.7rem", background: form.isActive ? "#f57c00" : BRAND, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 }}
                    >
                      {form.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleDelete(form._id)}
                      style={{ padding: "0.35rem 0.7rem", background: "#d32f2f", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Inline Data View */}
                {managingFormId === form._id && formResponses && (
                  <div style={{ marginTop: "1rem", borderTop: "1px solid #eee", paddingTop: "1rem" }}>
                    <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", fontWeight: 600 }}>
                      Submissions ({formResponses.responses?.length || 0})
                    </h4>
                    {formResponses.responses?.length === 0 && (
                      <p style={{ color: "#888", fontSize: "0.85rem" }}>No submissions yet.</p>
                    )}
                    {formResponses.responses?.length > 0 && (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                          <thead>
                            <tr style={{ background: "#f5f5f5" }}>
                              <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", borderBottom: "2px solid #ddd" }}>Member</th>
                              {formResponses.fields?.map((field: any) => (
                                <th key={field._id} style={{ padding: "0.4rem 0.6rem", textAlign: "left", borderBottom: "2px solid #ddd" }}>
                                  {field.label}
                                </th>
                              ))}
                              <th style={{ padding: "0.4rem 0.6rem", textAlign: "left", borderBottom: "2px solid #ddd" }}>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formResponses.responses.map((resp: any) => {
                              const valMap = new Map(resp.values.map((v: any) => [String(v.fieldId), v.value]));
                              return (
                                <tr key={resp._id} style={{ borderBottom: "1px solid #eee" }}>
                                  <td style={{ padding: "0.4rem 0.6rem" }}>{resp.member?.alias || "Unknown"}</td>
                                  {formResponses.fields?.map((field: any) => {
                                    const rawVal = valMap.get(String(field._id));
                                    let cellContent: React.ReactNode = String(rawVal ?? "—");
                                    if (field.fieldType === "camera" && rawVal) {
                                      try {
                                        const parsed = JSON.parse(String(rawVal));
                                        if (parsed.dataUrl) {
                                          cellContent = (
                                            <img
                                              src={parsed.dataUrl}
                                              alt="Photo"
                                              style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 4, cursor: "pointer" }}
                                              onClick={() => window.open(parsed.dataUrl, "_blank")}
                                            />
                                          );
                                        }
                                      } catch { /* not valid JSON, show raw */ }
                                    }
                                    return (
                                      <td key={field._id} style={{ padding: "0.4rem 0.6rem" }}>
                                        {cellContent}
                                      </td>
                                    );
                                  })}
                                  <td style={{ padding: "0.4rem 0.6rem", whiteSpace: "nowrap" }}>
                                    {new Date(resp.createdAt).toLocaleDateString()}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
