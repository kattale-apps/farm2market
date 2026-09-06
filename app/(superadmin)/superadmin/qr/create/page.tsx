"use client";

export const dynamic = "force-dynamic";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useStoredUser } from "@/app/hooks/useStoredUser";
import { QR_STYLE_PRESETS } from "@/app/lib/qrStyles";
import { validateImageFile } from "@/app/utils/imageValidation";
import { QrNav } from "../QrNav";

type FieldType = "text" | "email" | "phone" | "number" | "textarea" | "select" | "radio" | "checkbox" | "date";

interface DraftField {
  fieldType: FieldType;
  label: string;
  required: boolean;
  options?: string[];
}

export default function CreateQrCodePage() {
  const router = useRouter();
  const { user } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;

  const createQrCode = useMutation(api.qrCodes.createQrCode);
  const createQrForm = useMutation(api.qrForms.createQrForm);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const campaigns = useQuery(api.campaigns.listCampaigns, userId ? { adminId: userId } : "skip");

  const [destinationUrl, setDestinationUrl] = useState("");
  const [title, setTitle] = useState("");
  const [campaignId, setCampaignId] = useState<string>("");
  const [stylePresetId, setStylePresetId] = useState(QR_STYLE_PRESETS[0].id);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [landingEnabled, setLandingEnabled] = useState(false);
  const [landingHeading, setLandingHeading] = useState("");
  const [landingDescription, setLandingDescription] = useState("");
  const [landingBackgroundColor, setLandingBackgroundColor] = useState("");

  const [activeFrom, setActiveFrom] = useState("");
  const [activeUntil, setActiveUntil] = useState("");

  const [includeForm, setIncludeForm] = useState(false);
  const [formTitle, setFormTitle] = useState("Contact form");
  const [fields, setFields] = useState<DraftField[]>([
    { fieldType: "text", label: "Full name", required: true },
  ]);

  const [status, setStatus] = useState<{ type: "idle" | "loading" | "error"; message?: string }>({ type: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addField = () => setFields((prev) => [...prev, { fieldType: "text", label: "", required: false }]);
  const removeField = (index: number) => setFields((prev) => prev.filter((_, i) => i !== index));
  const updateField = (index: number, patch: Partial<DraftField>) =>
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = validateImageFile(file);
    if (!result.valid) {
      setStatus({ type: "error", message: result.error });
      return;
    }
    setLogoFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setStatus({ type: "error", message: "You must be logged in as an admin." });
      return;
    }
    if (!destinationUrl.trim()) {
      setStatus({ type: "error", message: "Destination URL is required." });
      return;
    }
    if (includeForm && fields.some((f) => !f.label.trim())) {
      setStatus({ type: "error", message: "All form fields need a label." });
      return;
    }

    setStatus({ type: "loading" });
    try {
      let logoStorageId: Id<"_storage"> | undefined;
      if (logoFile) {
        const uploadUrl = await generateUploadUrl();
        const uploadResult = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": logoFile.type },
          body: logoFile,
        });
        const { storageId } = await uploadResult.json();
        logoStorageId = storageId;
      }

      const preset = QR_STYLE_PRESETS.find((p) => p.id === stylePresetId) ?? QR_STYLE_PRESETS[0];

      const { qrCodeId } = await createQrCode({
        adminId: userId,
        destinationUrl: destinationUrl.trim(),
        title: title.trim() || undefined,
        campaignId: campaignId ? (campaignId as Id<"campaigns">) : undefined,
        stylePresetId: preset.id,
        darkColor: preset.darkColor,
        lightColor: preset.lightColor,
        logoStorageId,
        landingEnabled,
        landingHeading: landingEnabled ? landingHeading.trim() || undefined : undefined,
        landingDescription: landingEnabled ? landingDescription.trim() || undefined : undefined,
        landingBackgroundColor: landingEnabled ? landingBackgroundColor || undefined : undefined,
        activeFrom: activeFrom ? new Date(activeFrom).getTime() : undefined,
        activeUntil: activeUntil ? new Date(activeUntil).getTime() : undefined,
      });

      if (includeForm) {
        await createQrForm({
          adminId: userId,
          qrCodeId,
          title: formTitle.trim() || "Form",
          fields: fields.map((f) => ({
            fieldType: f.fieldType,
            label: f.label.trim(),
            required: f.required,
            options: f.options,
          })),
        });
      }

      router.push(`/superadmin/qr/${qrCodeId}`);
    } catch (error) {
      setStatus({ type: "error", message: (error as Error).message || "QR code could not be generated." });
    }
  };

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem" }}>
      <QrNav />
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "1.5rem" }}>Create QR Code</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {status.type === "error" && (
          <div style={{ padding: "0.8rem 1rem", background: "#fdecea", color: "#b71c1c", borderRadius: 8 }}>
            {status.message}
          </div>
        )}

        <section style={sectionStyle}>
          <h2 style={sectionHeading}>Destination</h2>
          <label style={labelStyle}>
            Destination URL *
            <input
              type="url"
              required
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              placeholder="https://example.com/promo"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Internal name (optional)
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Product packaging Sept 2026"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Campaign (optional)
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} style={inputStyle}>
              <option value="">No campaign</option>
              {(campaigns ?? []).map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </label>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionHeading}>Style</h2>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {QR_STYLE_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.id}
                onClick={() => setStylePresetId(preset.id)}
                style={{
                  padding: "0.6rem 1rem",
                  borderRadius: 8,
                  border: stylePresetId === preset.id ? `2px solid ${preset.darkColor}` : "1px solid #ddd",
                  background: preset.lightColor,
                  color: preset.darkColor,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <label style={{ ...labelStyle, marginTop: "0.75rem" }}>
            Logo (optional, embedded in the QR)
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} style={{ marginTop: "0.4rem" }} />
          </label>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionHeading}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "1rem" }}>
              <input type="checkbox" checked={landingEnabled} onChange={(e) => setLandingEnabled(e.target.checked)} />
              Show a landing page instead of redirecting straight away
            </label>
          </h2>
          {landingEnabled && (
            <>
              <label style={labelStyle}>
                Heading
                <input type="text" value={landingHeading} onChange={(e) => setLandingHeading(e.target.value)} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Description
                <textarea value={landingDescription} onChange={(e) => setLandingDescription(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />
              </label>
              <label style={labelStyle}>
                Background color (optional)
                <input
                  type="color"
                  value={landingBackgroundColor || "#e8f5e9"}
                  onChange={(e) => setLandingBackgroundColor(e.target.value)}
                  style={{ ...inputStyle, height: 44, padding: 4 }}
                />
              </label>
            </>
          )}
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionHeading}>Scheduling (optional)</h2>
          <p style={{ fontSize: "0.8rem", color: "#666", margin: "0 0 0.75rem 0" }}>
            Leave blank for an always-on QR code. Useful for events or time-boxed campaigns.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <label style={{ ...labelStyle, flex: 1 }}>
              Active from
              <input type="datetime-local" value={activeFrom} onChange={(e) => setActiveFrom(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ ...labelStyle, flex: 1 }}>
              Active until
              <input type="datetime-local" value={activeUntil} onChange={(e) => setActiveUntil(e.target.value)} style={inputStyle} />
            </label>
          </div>
        </section>

        {landingEnabled && (
          <section style={sectionStyle}>
            <h2 style={sectionHeading}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "1rem" }}>
                <input type="checkbox" checked={includeForm} onChange={(e) => setIncludeForm(e.target.checked)} />
                Attach a form
              </label>
            </h2>
            {includeForm && (
              <>
                <label style={labelStyle}>
                  Form title
                  <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} style={inputStyle} />
                </label>
                {fields.map((field, index) => (
                  <div key={index} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                    <input
                      type="text"
                      placeholder="Field label"
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                      style={{ ...inputStyle, flex: 2, marginTop: 0 }}
                    />
                    <select
                      value={field.fieldType}
                      onChange={(e) => updateField(index, { fieldType: e.target.value as FieldType })}
                      style={{ ...inputStyle, flex: 1, marginTop: 0 }}
                    >
                      {["text", "email", "phone", "number", "textarea", "select", "radio", "checkbox", "date"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
                      <input type="checkbox" checked={field.required} onChange={(e) => updateField(index, { required: e.target.checked })} />
                      Required
                    </label>
                    <button type="button" onClick={() => removeField(index)} style={{ ...buttonStyle("#c62828"), padding: "0.4rem 0.7rem" }}>
                      Remove
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addField} style={{ ...buttonStyle("#616161"), marginTop: "0.5rem" }}>
                  + Add field
                </button>
              </>
            )}
          </section>
        )}

        <button type="submit" disabled={status.type === "loading"} style={{ ...buttonStyle("#1976d2"), padding: "0.9rem", fontSize: "1rem" }}>
          {status.type === "loading" ? "Creating..." : "Create QR Code"}
        </button>
      </form>
    </main>
  );
}

const sectionStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 12,
  padding: "1.25rem",
};

const sectionHeading: React.CSSProperties = { fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.75rem 0" };

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
  fontSize: "0.9rem",
  fontWeight: 600,
  color: "#333",
  marginTop: "0.75rem",
};

const inputStyle: React.CSSProperties = {
  padding: "0.65rem 0.8rem",
  borderRadius: 8,
  border: "1px solid #ccc",
  fontSize: "0.95rem",
  fontWeight: 400,
};

function buttonStyle(background: string): React.CSSProperties {
  return {
    padding: "0.6rem 1rem",
    background,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: "pointer",
  };
}
