"use client";

/**
 * A community's own Farm Record Book forms, and the shared forms it takes from
 * other communities.
 *
 * Sharing is deliberately two-sided. The community that owns a form decides
 * whether its records may leave ("Share records"), and the community receiving
 * them decides which of those forms it actually wants. Either half alone shows
 * nothing, so no community's records arrive anywhere unasked.
 *
 * Throughout, an admin only ever sees their OWN community's members. Taking a
 * shared form adds the records this community's members logged on it - never
 * another community's members.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

const FONT = '"Montserrat", sans-serif';
const BRAND = "#1f7a3e";

type FieldDraft = {
  name: string;
  fieldType: "text" | "number" | "date" | "select" | "yesno" | "photo" | "rating" | "gps";
  required: boolean;
  options: string;
};

const FIELD_TYPES: Array<FieldDraft["fieldType"]> = [
  "text", "number", "date", "select", "yesno", "photo", "rating", "gps",
];

const panelStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "0.9rem",
  marginBottom: "1rem",
  background: "#fbfbfb",
  fontFamily: FONT,
};

const inputStyle: React.CSSProperties = {
  minHeight: 40,
  padding: "0.45rem 0.6rem",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  fontFamily: FONT,
  fontSize: "0.85rem",
};

const buttonStyle: React.CSSProperties = {
  minHeight: 40,
  padding: "0.45rem 0.9rem",
  borderRadius: 8,
  border: `1px solid ${BRAND}`,
  background: BRAND,
  color: "#fff",
  fontFamily: FONT,
  fontSize: "0.85rem",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#fff",
  color: "#374151",
  border: "1px solid #9ca3af",
};

function emptyField(): FieldDraft {
  return { name: "", fieldType: "text", required: false, options: "" };
}

/** The forms this community owns: create, edit, remove, and share outward. */
export function CommunityOwnFormsPanel({
  adminId,
  communityId,
}: {
  adminId: Id<"users">;
  communityId: Id<"communities">;
}) {
  const templates = useQuery(
    (api as any).farmToolbox.listCommunityTrackerTemplates,
    adminId && communityId ? { adminId, communityId } : "skip"
  ) as any[] | undefined;

  const createTemplate = useMutation((api as any).farmToolbox.createTemplate);
  const updateTemplate = useMutation((api as any).farmToolbox.updateTemplate);
  const deleteTemplate = useMutation((api as any).farmToolbox.deleteTemplate);
  const setSharing = useMutation((api as any).farmToolbox.setTemplateEntrySharing);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📋");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"crop" | "livestock" | "general">("crop");
  const [fields, setFields] = useState<FieldDraft[]>([emptyField()]);
  const [busy, setBusy] = useState(false);
  const [busyTemplateId, setBusyTemplateId] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const resetDraft = () => {
    setName("");
    setEmoji("📋");
    setDescription("");
    setCategory("crop");
    setFields([emptyField()]);
  };

  const handleCreate = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await createTemplate({
        ownerId: adminId,
        ownerType: "community",
        communityId,
        category,
        templateName: name.trim(),
        emoji: emoji || "📋",
        description: description.trim() || undefined,
        fields: fields.map((field, idx) => ({
          name: field.name.trim(),
          fieldType: field.fieldType,
          required: field.required,
          options:
            field.fieldType === "select"
              ? field.options.split(",").map((o) => o.trim()).filter(Boolean)
              : undefined,
          order: idx,
        })),
      });
      resetDraft();
      setShowCreate(false);
      setNotice({ tone: "ok", text: "Form created. Your members will see it in their Record Book." });
    } catch (error: any) {
      setNotice({ tone: "error", text: error?.message || "Could not create this form" });
    }
    setBusy(false);
  };

  const handleToggleActive = async (template: any) => {
    setBusyTemplateId(String(template.templateId));
    setNotice(null);
    try {
      await updateTemplate({
        requestingUserId: adminId,
        templateId: template.templateId,
        isActive: !template.isActive,
      });
    } catch (error: any) {
      setNotice({ tone: "error", text: error?.message || "Could not update this form" });
    }
    setBusyTemplateId("");
  };

  const handleDelete = async (template: any) => {
    if (!window.confirm(`Remove "${template.templateName}"? Records already logged on it are kept.`)) return;
    setBusyTemplateId(String(template.templateId));
    setNotice(null);
    try {
      await deleteTemplate({ templateId: template.templateId, requestingUserId: adminId });
      setNotice({ tone: "ok", text: "Form removed. The records logged on it are still in Active Farms." });
    } catch (error: any) {
      setNotice({ tone: "error", text: error?.message || "Could not remove this form" });
    }
    setBusyTemplateId("");
  };

  const handleShare = async (template: any, next: boolean) => {
    setBusyTemplateId(String(template.templateId));
    setNotice(null);
    try {
      await setSharing({
        adminId,
        templateId: template.templateId,
        visibleToOtherCommunities: next,
      });
    } catch (error: any) {
      setNotice({ tone: "error", text: error?.message || "Could not change sharing" });
    }
    setBusyTemplateId("");
  };

  const canCreate = name.trim().length > 0 && fields.some((f) => f.name.trim().length > 0);

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Your community&apos;s Record Book forms</div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          style={showCreate ? secondaryButtonStyle : buttonStyle}
        >
          {showCreate ? "Cancel" : "＋ New form"}
        </button>
      </div>
      <p style={{ margin: "0.3rem 0 0.7rem", fontSize: "0.8rem", color: "#666" }}>
        Forms you create here appear in the Farm Record Book of every member of this
        community. Records logged on them stay inside this community unless you share
        them, and a community you share with still has to choose to take them.
      </p>

      {notice && (
        <p style={{
          margin: "0 0 0.6rem",
          fontSize: "0.82rem",
          fontWeight: 600,
          color: notice.tone === "error" ? "#b91c1c" : BRAND,
        }}>
          {notice.text}
        </p>
      )}

      {showCreate && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "0.75rem", marginBottom: "0.8rem", background: "#fff" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.5rem" }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Form name" style={inputStyle} />
            <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="Emoji" style={inputStyle} />
            <select value={category} onChange={(e) => setCategory(e.target.value as any)} style={inputStyle}>
              <option value="crop">crop</option>
              <option value="livestock">livestock</option>
              <option value="general">general</option>
            </select>
          </div>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            style={{ ...inputStyle, width: "100%", marginTop: "0.5rem" }}
          />

          <div style={{ fontWeight: 700, fontSize: "0.82rem", margin: "0.8rem 0 0.4rem" }}>Fields</div>
          {fields.map((field, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.4rem", marginBottom: "0.4rem" }}>
              <input
                value={field.name}
                onChange={(e) => setFields((prev) => prev.map((f, i) => i === idx ? { ...f, name: e.target.value } : f))}
                placeholder={`Field ${idx + 1} name`}
                style={inputStyle}
              />
              <select
                value={field.fieldType}
                onChange={(e) => setFields((prev) => prev.map((f, i) => i === idx ? { ...f, fieldType: e.target.value as FieldDraft["fieldType"] } : f))}
                style={inputStyle}
              >
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {field.fieldType === "select" && (
                <input
                  value={field.options}
                  onChange={(e) => setFields((prev) => prev.map((f, i) => i === idx ? { ...f, options: e.target.value } : f))}
                  placeholder="Options, comma separated"
                  style={inputStyle}
                />
              )}
              <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem" }}>
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => setFields((prev) => prev.map((f, i) => i === idx ? { ...f, required: e.target.checked } : f))}
                />
                Required
              </label>
              <button
                type="button"
                onClick={() => setFields((prev) => prev.filter((_, i) => i !== idx))}
                disabled={fields.length === 1}
                style={{ ...secondaryButtonStyle, color: "#b91c1c", borderColor: "#fca5a5", cursor: fields.length === 1 ? "not-allowed" : "pointer" }}
              >
                Remove
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
            <button type="button" onClick={() => setFields((prev) => [...prev, emptyField()])} style={secondaryButtonStyle}>
              ＋ Add field
            </button>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={busy || !canCreate}
              style={{ ...buttonStyle, opacity: busy || !canCreate ? 0.6 : 1, cursor: busy || !canCreate ? "not-allowed" : "pointer" }}
            >
              {busy ? "Creating…" : "Create form"}
            </button>
          </div>
        </div>
      )}

      {templates === undefined ? (
        <p style={{ margin: 0, fontSize: "0.82rem", color: "#888" }}>Loading forms…</p>
      ) : templates.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.82rem", color: "#888" }}>
          This community has no forms of its own yet.
        </p>
      ) : (
        templates.map((template: any) => {
          const isBusy = busyTemplateId === String(template.templateId);
          return (
            <div
              key={String(template.templateId)}
              style={{ padding: "0.6rem 0", borderBottom: "1px solid #f0f0f0", opacity: isBusy ? 0.6 : 1 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.88rem", fontWeight: 600, minWidth: 0 }}>
                  {template.emoji || "📋"} {template.templateName}
                  <span style={{ color: "#888", fontWeight: 400, fontSize: "0.78rem" }}>
                    {" "}· {template.fieldCount} fields{template.isActive ? "" : " · inactive"}
                  </span>
                </span>
                <span style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: template.entriesVisibleToOtherCommunities ? BRAND : "#6b7280",
                }}>
                  {template.entriesVisibleToOtherCommunities ? "Records shared" : "This community only"}
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.45rem" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem" }}>
                  <input
                    type="checkbox"
                    checked={template.entriesVisibleToOtherCommunities}
                    disabled={isBusy}
                    onChange={(e) => void handleShare(template, e.target.checked)}
                  />
                  Share records
                </label>
                <button type="button" onClick={() => void handleToggleActive(template)} disabled={isBusy} style={secondaryButtonStyle}>
                  {template.isActive ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(template)}
                  disabled={isBusy}
                  style={{ ...secondaryButtonStyle, color: "#b91c1c", borderColor: "#fca5a5" }}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/** Shared forms offered by other communities, which this one may take or leave. */
export function SharedFormsFromOtherCommunitiesPanel({
  adminId,
  communityId,
}: {
  adminId: Id<"users">;
  communityId: Id<"communities">;
}) {
  const offers = useQuery(
    (api as any).farmToolbox.listSharedTemplatesForCommunity,
    adminId && communityId ? { adminId, communityId } : "skip"
  ) as any[] | undefined;

  const setSubscription = useMutation((api as any).farmToolbox.setSharedTemplateSubscription);
  const [busyTemplateId, setBusyTemplateId] = useState("");
  const [error, setError] = useState("");

  if (!offers || offers.length === 0) return null;

  const handleToggle = async (templateId: string, next: boolean) => {
    setBusyTemplateId(templateId);
    setError("");
    try {
      await setSubscription({
        adminId,
        communityId,
        templateId: templateId as Id<"farmTrackerTemplates">,
        subscribed: next,
      });
    } catch (err: any) {
      setError(err?.message || "Could not change this form");
    }
    setBusyTemplateId("");
  };

  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.2rem" }}>
        Forms shared by other communities
      </div>
      <p style={{ margin: "0 0 0.7rem", fontSize: "0.8rem", color: "#666" }}>
        Tick a form to include, in your Active Farms view, the records{" "}
        <strong>your own members</strong> logged on it. You never see another
        community&apos;s members.
      </p>

      {error && (
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", color: "#b91c1c", fontWeight: 600 }}>{error}</p>
      )}

      {offers.map((offer: any) => (
        <label
          key={String(offer.templateId)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            padding: "0.5rem 0",
            borderBottom: "1px solid #f0f0f0",
            fontSize: "0.85rem",
            cursor: busyTemplateId === String(offer.templateId) ? "wait" : "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={offer.subscribed}
            disabled={busyTemplateId === String(offer.templateId)}
            onChange={(e) => void handleToggle(String(offer.templateId), e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer" }}
          />
          <span style={{ flex: 1, minWidth: 0 }}>
            {offer.emoji || "📋"} {offer.templateName}
            <span style={{ color: "#888", fontSize: "0.78rem" }}> · {offer.ownerCommunityName}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
