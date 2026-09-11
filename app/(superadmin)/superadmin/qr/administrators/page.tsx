"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useStoredUser } from "@/app/hooks/useStoredUser";
import { QrNav } from "../QrNav";
import { sectionStyle, sectionHeading } from "../qrUiStyles";

export default function QrAdministratorsPage() {
  const { user } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;

  const admins = useQuery(api.qrAdmins.listQrAdmins, userId ? { adminId: userId } : "skip");
  const permissionOptions = useQuery(api.qrAdmins.listQrPermissionOptions, {});
  const setQrPermissions = useMutation(api.qrAdmins.setQrPermissions);

  const [savingId, setSavingId] = useState<string | null>(null);

  const handleToggle = async (targetUserId: Id<"users">, current: string[], permission: string, checked: boolean) => {
    if (!userId) return;
    const next = checked ? [...current, permission] : current.filter((p) => p !== permission);
    setSavingId(targetUserId);
    try {
      await setQrPermissions({ adminId: userId, targetUserId, qrPermissions: next });
    } finally {
      setSavingId(null);
    }
  };

  if (admins === undefined || permissionOptions === undefined) {
    return <main style={{ padding: "2rem" }}>Loading...</main>;
  }

  const isSuperAdmin = user?.adminLevel === "super" || user?.adminLevel === undefined;
  if (!isSuperAdmin) {
    return (
      <main style={{ maxWidth: 700, margin: "0 auto", padding: "1.5rem" }}>
        <QrNav />
        <p style={{ color: "#666" }}>Only a super admin can manage QR permissions.</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "1.5rem" }}>
      <QrNav />
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "0.5rem" }}>Administrators</h1>
      <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "1.25rem" }}>
        Super admins always have full QR access. Junior admins need individual permissions below.
        Admin accounts themselves are created/edited from{" "}
        <a href="/admin/role-management" style={{ color: "#1976d2" }}>Role Management</a>.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {admins.map((admin) => {
          const isSuper = admin.adminLevel === "super" || admin.adminLevel === undefined;
          return (
            <section key={admin._id} style={sectionStyle}>
              <h2 style={sectionHeading}>
                {admin.alias} {admin.email ? `(${admin.email})` : ""}
              </h2>
              {isSuper ? (
                <p style={{ color: "#666", fontSize: "0.85rem" }}>Super admin — full access, no per-permission control needed.</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
                  {permissionOptions.map((permission) => (
                    <label
                      key={permission}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        fontSize: "0.85rem",
                        padding: "0.35rem 0.6rem",
                        borderRadius: 8,
                        background: "#f3f4f6",
                        opacity: savingId === admin._id ? 0.6 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={admin.qrPermissions.includes(permission)}
                        disabled={savingId === admin._id}
                        onChange={(e) => handleToggle(admin._id, admin.qrPermissions, permission, e.target.checked)}
                      />
                      {permission}
                    </label>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
