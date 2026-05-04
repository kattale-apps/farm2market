"use client";

import { useEffect, useState } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { useOfflineQuery } from "../../hooks/useOfflineQuery";
import { useOfflineMutation } from "../../hooks/useOfflineMutation";
import { useStoredUser } from "../../hooks/useStoredUser";

const BRAND = "#2e7d32";
const FONT = '"Montserrat", sans-serif';

export default function AdminFarmNeedsPage() {
  const { user, status: authStatus } = useStoredUser();
  const adminId = (user?.userId as Id<"users"> | undefined) ?? null;
  const adminRole = (user?.role as "super" | "community" | undefined) ?? null;
  const [communities, setCommunities] = useState<any[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<Id<"communities"> | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState<"crops" | "livestock">("crops");
  const [fields, setFields] = useState<Array<{
    fieldType: string;
    label: string;
    required: boolean;
    placeholder?: string;
    helpText?: string;
    options?: string[];
    order: number;
  }>>([{ fieldType: "text", label: "", required: true, order: 0 }]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Get admin user
  // (replaced by useStoredUser above)

  // Fetch communities
  useEffect(() => {
    if (!adminId) return;
    const loadCommunities = async () => {
      try {
        const response = await fetch("/api/admin/communities", {
          method: "POST",
          body: JSON.stringify({ adminId }),
        });
        if (response.ok) {
          const data = await response.json();
          setCommunities(data.communities || []);
        }
      } catch (error) {
        console.error("Failed to load communities:", error);
      }
    };
    loadCommunities();
  }, [adminId]);

  const enableFarmNeeds = useOfflineMutation(api.farmNeeds.enableCommunityFarmNeeds);
  const createFarmNeedsForm = useOfflineMutation(api.farmNeeds.createFarmNeedsForm);
  const getCommunityForms = useOfflineQuery(
    api.farmNeeds.getCommunityFarmNeedsForms,
    adminId && selectedCommunity ? { adminId, communityId: selectedCommunity } : "skip"
  );

  const handleToggleFarmNeeds = async (communityId: Id<"communities">, currentState: boolean) => {
    if (!adminId || adminRole !== "super") return;
    try {
      await enableFarmNeeds({
        adminId,
        communityId,
        enabled: !currentState,
      });
      setCommunities(prev => prev.map(c => 
        c._id === communityId ? { ...c, farmNeedsEnabled: !currentState } : c
      ));
      setMessage({ type: "success", text: "Farm Needs feature updated!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: "error", text: `Failed: ${error.message}` });
    }
  };

  const handleAddField = () => {
    setFields([...fields, {
      fieldType: "text",
      label: "",
      required: true,
      order: fields.length,
    }]);
  };

  const handleRemoveField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, key: string, value: any) => {
    const newFields = [...fields];
    (newFields[index] as any)[key] = value;
    setFields(newFields);
  };

  const handleCreateForm = async () => {
    if (!adminId || !selectedCommunity || !formName.trim()) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
      return;
    }

    const requiredFields = fields.filter(f => !f.label.trim());
    if (requiredFields.length > 0) {
      setMessage({ type: "error", text: "All fields must have labels" });
      return;
    }

    setSubmitting(true);
    try {
      await createFarmNeedsForm({
        adminId,
        communityId: selectedCommunity,
        name: formName,
        description: formDescription,
        category: formCategory,
        fields: fields.map((f, i) => ({ ...f, order: i })),
      });

      setMessage({ type: "success", text: "Farm Needs form created successfully!" });
      setFormName("");
      setFormDescription("");
      setFormCategory("crops");
      setFields([{ fieldType: "text", label: "", required: true, order: 0 }]);
      setShowCreateForm(false);
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: "error", text: `Failed: ${error.message}` });
    } finally {
      setSubmitting(false);
    }
  };

  if (!adminId) {
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
      }}>
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.3rem", lineHeight: 1 }}>←</Link>
        <h1 style={{ margin: 0, fontSize: "clamp(1rem, 4vw, 1.2rem)", fontWeight: 700 }}>
          🌱 Farm Needs Administration
        </h1>
      </div>

      {/* Content */}
      <div style={{ padding: "1.5rem", maxWidth: "1000px", margin: "0 auto" }}>
        {message && (
          <div style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            background: message.type === "success" ? "#e8f5e9" : "#ffebee",
            border: `1px solid ${message.type === "success" ? "#4caf50" : "#ef5350"}`,
            borderRadius: "8px",
            color: message.type === "success" ? "#2e7d32" : "#c62828",
            fontWeight: 600,
          }}>
            {message.text}
          </div>
        )}

        {/* SuperAdmin Section */}
        {adminRole === "super" && (
          <div style={{
            padding: "1.5rem",
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid #e0e0e0",
            marginBottom: "2rem",
          }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.2rem", color: "#2c2c2c", fontWeight: 700 }}>
              👑 SuperAdmin: Enable Farm Needs per Community
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 250px), 1fr))", gap: "1rem" }}>
              {communities.map((community: any) => (
                <div key={community._id} style={{
                  padding: "1rem",
                  background: "#f9f9f9",
                  borderRadius: "8px",
                  border: "1px solid #e0e0e0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                }}>
                  <div>
                    <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.95rem", fontWeight: 600 }}>
                      {community.name}
                    </h4>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "#999" }}>
                      ID: {String(community._id).slice(0, 8)}...
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleFarmNeeds(community._id, community.farmNeedsEnabled)}
                    style={{
                      padding: "0.4rem 0.8rem",
                      background: community.farmNeedsEnabled ? "#4caf50" : "#bbb",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}>
                    {community.farmNeedsEnabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Community Admin Section */}
        <div style={{
          padding: "1.5rem",
          background: "#fff",
          borderRadius: "12px",
          border: "1px solid #e0e0e0",
        }}>
          <h2 style={{ margin: "0 0 1rem", fontSize: "1.2rem", color: "#2c2c2c", fontWeight: 700 }}>
            {adminRole === "super" ? "👥 Community Admin: Manage Forms" : "🌱 Manage Farm Needs Forms"}
          </h2>

          {/* Community Selection */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              Select Community:
            </label>
            <select
              value={selectedCommunity || ""}
              onChange={(e) => setSelectedCommunity(e.target.value as any)}
              style={{
                width: "100%",
                padding: "0.6rem 0.8rem",
                borderRadius: "8px",
                border: "1px solid #ddd",
                fontSize: "0.95rem",
                boxSizing: "border-box",
              }}>
              <option value="">-- Select a community --</option>
              {communities.map((community: any) => (
                <option key={community._id} value={String(community._id)}>
                  {community.name}
                </option>
              ))}
            </select>
          </div>

          {/* Create Form Button */}
          {selectedCommunity && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              style={{
                padding: "0.6rem 1.2rem",
                background: BRAND,
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "0.95rem",
                fontWeight: 600,
                marginBottom: "1rem",
              }}>
              {showCreateForm ? "Cancel" : "+ Create New Form"}
            </button>
          )}

          {/* Create Form Section */}
          {showCreateForm && selectedCommunity && (
            <div style={{
              padding: "1.5rem",
              background: "#f5f5f5",
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              marginBottom: "1.5rem",
            }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: "1.05rem", fontWeight: 700 }}>
                Create New Farm Needs Form
              </h3>

              {/* Form Name */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Form Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Crop Health Survey"
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.8rem",
                    borderRadius: "8px",
                    border: "1px solid #ddd",
                    fontSize: "0.95rem",
                    boxSizing: "border-box",
                  }} />
              </div>

              {/* Form Description */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description for farmers"
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.8rem",
                    borderRadius: "8px",
                    border: "1px solid #ddd",
                    fontSize: "0.95rem",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }} />
              </div>

              {/* Category */}
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Category *
                </label>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="radio"
                      checked={formCategory === "crops"}
                      onChange={() => setFormCategory("crops")} />
                    <span>🌾 Crops</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                    <input
                      type="radio"
                      checked={formCategory === "livestock"}
                      onChange={() => setFormCategory("livestock")} />
                    <span>🐄 Livestock</span>
                  </label>
                </div>
              </div>

              {/* Fields */}
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem" }}>
                  Form Fields *
                </label>
                {fields.map((field, index) => (
                  <div key={index} style={{
                    padding: "1rem",
                    background: "#fff",
                    borderRadius: "8px",
                    border: "1px solid #e0e0e0",
                    marginBottom: "0.75rem",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: "0.75rem",
                  }}>
                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#666" }}>Type</label>
                      <select
                        value={field.fieldType}
                        onChange={(e) => handleFieldChange(index, "fieldType", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "0.4rem",
                          borderRadius: "6px",
                          border: "1px solid #ddd",
                          fontSize: "0.85rem",
                          boxSizing: "border-box",
                        }}>
                        <option value="text">Text</option>
                        <option value="email">Email</option>
                        <option value="number">Number</option>
                        <option value="textarea">Textarea</option>
                        <option value="select">Select</option>
                        <option value="checkbox">Checkbox</option>
                        <option value="date">Date</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#666" }}>Label *</label>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => handleFieldChange(index, "label", e.target.value)}
                        placeholder="Field label"
                        style={{
                          width: "100%",
                          padding: "0.4rem",
                          borderRadius: "6px",
                          border: "1px solid #ddd",
                          fontSize: "0.85rem",
                          boxSizing: "border-box",
                        }} />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#666" }}>Required</label>
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => handleFieldChange(index, "required", e.target.checked)}
                        style={{ marginTop: "0.4rem" }} />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveField(index)}
                      style={{
                        padding: "0.4rem",
                        background: "#ffebee",
                        color: "#c62828",
                        border: "1px solid #ef9a9a",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                      }}>
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddField}
                  style={{
                    padding: "0.5rem 1rem",
                    background: "#f5f5f5",
                    color: BRAND,
                    border: `1px solid ${BRAND}`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                  }}>
                  + Add Field
                </button>
              </div>

              {/* Submit */}
              <div style={{ display: "flex", gap: "1rem" }}>
                <button
                  onClick={handleCreateForm}
                  disabled={submitting}
                  style={{
                    padding: "0.75rem 1.5rem",
                    background: submitting ? "#ccc" : BRAND,
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    cursor: submitting ? "not-allowed" : "pointer",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                  }}>
                  {submitting ? "Creating..." : "Create Form"}
                </button>
              </div>
            </div>
          )}

          {/* List Forms */}
          {selectedCommunity && getCommunityForms && !showCreateForm && (
            <div>
              <h3 style={{ margin: "0 0 1rem", fontSize: "1.05rem", fontWeight: 700 }}>
                Existing Forms ({getCommunityForms.length})
              </h3>
              {getCommunityForms.length === 0 ? (
                <p style={{ color: "#666" }}>No forms yet. Create one above.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {getCommunityForms.map((form: any) => (
                    <div key={form.formId} style={{
                      padding: "1rem",
                      background: "#f9f9f9",
                      borderRadius: "8px",
                      border: "1px solid #e0e0e0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}>
                      <div>
                        <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.95rem", fontWeight: 600 }}>
                          {form.name}
                        </h4>
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "#666" }}>
                          {form.category === "crops" ? "🌾" : "🐄"} {form.category.toUpperCase()} • {form.fieldCount} fields • {form.responseCount} responses
                        </p>
                      </div>
                      <span style={{
                        padding: "0.3rem 0.8rem",
                        borderRadius: "999px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        background: form.isActive ? "#e8f5e9" : "#f5f5f5",
                        color: form.isActive ? "#2e7d32" : "#999",
                      }}>
                        {form.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
