"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useStoredUser } from "@/app/hooks/useStoredUser";
import { validateImageFile } from "@/app/utils/imageValidation";
import { QrNav } from "../QrNav";
import { sectionStyle, sectionHeading, inputStyle, labelStyle, buttonStyle } from "../qrUiStyles";

export default function BrandingPage() {
  const { user } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;

  const branding = useQuery(api.branding.getBranding, userId ? { adminId: userId } : "skip");
  const updateBranding = useMutation(api.branding.updateBranding);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [orgName, setOrgName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1976d2");
  const [secondaryColor, setSecondaryColor] = useState("#2e7d32");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ type: "idle" | "saving" | "error"; message?: string }>({ type: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!branding) return;
    setOrgName(branding.orgName ?? "");
    setPrimaryColor(branding.primaryColor ?? "#1976d2");
    setSecondaryColor(branding.secondaryColor ?? "#2e7d32");
  }, [branding]);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setStatus({ type: "saving" });
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

      await updateBranding({
        adminId: userId,
        orgName: orgName.trim() || undefined,
        primaryColor,
        secondaryColor,
        logoStorageId,
      });
      setLogoFile(null);
      setStatus({ type: "idle" });
    } catch (error) {
      setStatus({ type: "error", message: (error as Error).message });
    }
  };

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: "1.5rem" }}>
      <QrNav />
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "1.25rem" }}>Branding</h1>
      <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1.25rem" }}>
        Default logo and colors used as a starting point for new QR codes and landing pages.
      </p>

      <form onSubmit={handleSave} style={{ ...sectionStyle, display: "flex", flexDirection: "column", gap: "1rem" }}>
        {status.type === "error" && <p style={{ color: "#c62828", fontSize: "0.85rem" }}>{status.message}</p>}

        {branding?.logoUrl && !logoFile && (
          <img src={branding.logoUrl} alt="Current logo" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "contain" }} />
        )}

        <label style={labelStyle}>
          Organization name
          <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Logo
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} />
        </label>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <label style={{ ...labelStyle, flex: 1 }}>
            Primary color
            <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ ...inputStyle, height: 44, padding: 4 }} />
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>
            Secondary color
            <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} style={{ ...inputStyle, height: 44, padding: 4 }} />
          </label>
        </div>

        <button type="submit" disabled={status.type === "saving"} style={{ ...buttonStyle("#1976d2"), alignSelf: "flex-start" }}>
          {status.type === "saving" ? "Saving..." : "Save branding"}
        </button>
      </form>
    </main>
  );
}
