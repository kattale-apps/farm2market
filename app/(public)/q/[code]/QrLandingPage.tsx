"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

interface FormFieldData {
  _id: string;
  fieldType: string;
  label: string;
  required: boolean;
  helpText?: string;
  options?: string[];
}

interface LandingData {
  landingEnabled?: boolean;
  destinationUrl: string;
  qrCodeId?: string;
  landingHeading?: string;
  landingDescription?: string;
  landingBackgroundColor?: string;
  landingLogoUrl?: string;
  landingHeroImageUrl?: string;
  landingButtons?: { label: string; url: string }[];
  landingSocialLinks?: { platform: string; url: string }[];
  form?: { formId: string; title: string; fields: FormFieldData[] } | null;
}

export function QrLandingPage({ code, data }: { code: string; data: LandingData }) {
  const trackRedirect = useMutation(api.qrPublic.trackRedirect);
  const submitQrForm = useMutation(api.qrForms.submitQrForm);

  const [values, setValues] = useState<Record<string, string>>({});
  const [submitState, setSubmitState] = useState<{ type: "idle" | "submitting" | "done" | "error"; message?: string }>({
    type: "idle",
  });

  const handleButtonClick = async (url: string) => {
    try {
      await trackRedirect({ code, destinationUrl: url, referrer: document.referrer || undefined });
    } finally {
      window.location.href = url;
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.form || !data.qrCodeId) return;

    setSubmitState({ type: "submitting" });
    try {
      await submitQrForm({
        formId: data.form.formId as any,
        qrCodeId: data.qrCodeId as any,
        values: data.form.fields.map((f) => ({ fieldId: f._id as any, value: values[f._id] ?? "" })),
      });
      setSubmitState({ type: "done" });
    } catch (error) {
      setSubmitState({ type: "error", message: (error as Error).message });
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        minHeight: "100vh",
        background: data.landingBackgroundColor || "linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%)",
        padding: "1.5rem 1rem",
      }}
    >
      <div style={{ maxWidth: 480, width: "100%" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "2rem 1.5rem",
            textAlign: "center",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}
        >
          {data.landingLogoUrl && (
            <img
              src={data.landingLogoUrl}
              alt=""
              style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", margin: "0 auto 1rem auto" }}
            />
          )}

          {data.landingHeroImageUrl && (
            <img
              src={data.landingHeroImageUrl}
              alt=""
              style={{ width: "100%", borderRadius: 12, marginBottom: "1rem", objectFit: "cover" }}
            />
          )}

          {data.landingHeading && (
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>{data.landingHeading}</h1>
          )}
          {data.landingDescription && (
            <p style={{ color: "#666", fontSize: "0.95rem", lineHeight: 1.5, margin: "0 0 1.25rem 0" }}>
              {data.landingDescription}
            </p>
          )}

          {(data.landingButtons ?? []).map((button, i) => (
            <button
              key={i}
              onClick={() => handleButtonClick(button.url)}
              style={{
                display: "block",
                width: "100%",
                padding: "0.9rem 1.25rem",
                background: i === 0 ? "linear-gradient(135deg, #2e7d32, #43a047)" : "#f3f4f6",
                color: i === 0 ? "#fff" : "#333",
                border: "none",
                borderRadius: 12,
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                marginBottom: "0.75rem",
              }}
            >
              {button.label}
            </button>
          ))}

          {(data.landingSocialLinks ?? []).length > 0 && (
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "0.5rem" }}>
              {(data.landingSocialLinks ?? []).map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" style={{ color: "#1976d2", fontSize: "0.85rem" }}>
                  {link.platform}
                </a>
              ))}
            </div>
          )}
        </div>

        {data.form && (
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "1.75rem 1.5rem",
              marginTop: "1.25rem",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            }}
          >
            {submitState.type === "done" ? (
              <p style={{ textAlign: "center", color: "#2e7d32", fontWeight: 600 }}>Thank you — your submission was received.</p>
            ) : (
              <form onSubmit={handleFormSubmit}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem 0" }}>{data.form.title}</h2>
                {data.form.fields.map((field) => (
                  <FormFieldInput
                    key={field._id}
                    field={field}
                    value={values[field._id] ?? ""}
                    onChange={(v) => setValues((prev) => ({ ...prev, [field._id]: v }))}
                  />
                ))}
                {submitState.type === "error" && (
                  <p style={{ color: "#c62828", fontSize: "0.85rem", marginBottom: "0.75rem" }}>{submitState.message}</p>
                )}
                <button
                  type="submit"
                  disabled={submitState.type === "submitting"}
                  style={{
                    width: "100%",
                    padding: "0.9rem",
                    background: "#1976d2",
                    color: "#fff",
                    border: "none",
                    borderRadius: 12,
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    marginTop: "0.5rem",
                  }}
                >
                  {submitState.type === "submitting" ? "Submitting..." : "Submit"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FormFieldInput({
  field,
  value,
  onChange,
}: {
  field: FormFieldData;
  value: string;
  onChange: (value: string) => void;
}) {
  const label = (
    <span style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.35rem", color: "#333" }}>
      {field.label}
      {field.required && <span style={{ color: "#c62828" }}> *</span>}
    </span>
  );

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.7rem 0.9rem",
    borderRadius: 10,
    border: "1px solid #ccc",
    fontSize: "1rem",
    marginBottom: "1rem",
  };

  if (field.fieldType === "textarea") {
    return (
      <label>
        {label}
        <textarea
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, minHeight: 90 }}
        />
      </label>
    );
  }

  if (field.fieldType === "select" || field.fieldType === "radio") {
    return (
      <label>
        {label}
        <select required={field.required} value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
          <option value="" disabled>
            Select...
          </option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.fieldType === "checkbox") {
    return (
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <input type="checkbox" checked={value === "true"} onChange={(e) => onChange(e.target.checked ? "true" : "false")} />
        <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#333" }}>{field.label}</span>
      </label>
    );
  }

  const htmlType =
    field.fieldType === "email"
      ? "email"
      : field.fieldType === "phone"
        ? "tel"
        : field.fieldType === "number"
          ? "number"
          : field.fieldType === "date"
            ? "date"
            : "text";

  return (
    <label>
      {label}
      <input
        type={htmlType}
        required={field.required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  );
}
