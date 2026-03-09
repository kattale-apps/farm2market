"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useEffect } from "react";

interface UserProfileCardProps {
  userId: Id<"users">;
}

/**
 * Profile card for traders and buyers to enter/update
 * location and contact details.
 */

// Convex IDs are never human-readable text — reject plain words
const isConvexId = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && !/\s/.test(v) && !/^[A-Za-z]+$/.test(v);

export function UserProfileCard({ userId }: UserProfileCardProps) {
  const profile = useQuery(api.farmerProfile.getUserProfile, { userId });
  const updateProfile = useMutation(api.farmerProfile.updateUserProfile);
  const districts = useQuery(api.locations.getActiveDistricts, {});
  const subcounties = useQuery(
    api.locations.getSubcountiesByDistrict,
    isConvexId(profile?.districtId) ? { districtId: profile.districtId } : "skip"
  );
  const parishes = useQuery(
    api.locations.getParishesBySubcounty,
    isConvexId(profile?.subcountyId) ? { subcountyId: profile.subcountyId } : "skip"
  );

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [form, setForm] = useState({
    phoneNumber: "",
    email: "",
    districtId: "" as string,
    subcountyId: "" as string,
    parishId: "" as string,
    village: "",
    region: "",
  });

  // Sync form with profile once loaded
  useEffect(() => {
    if (profile) {
      setForm({
        phoneNumber: profile.phoneNumber || "",
        email: profile.email || "",
        districtId: profile.districtId ? String(profile.districtId) : "",
        subcountyId: profile.subcountyId ? String(profile.subcountyId) : "",
        parishId: profile.parishId ? String(profile.parishId) : "",
        village: profile.village || "",
        region: profile.region || "",
      });
    }
  }, [profile]);

  // Dynamic subcounty/parish queries when district/subcounty changes in edit
  const editSubcounties = useQuery(
    api.locations.getSubcountiesByDistrict,
    isConvexId(form.districtId) ? { districtId: form.districtId as Id<"districts"> } : "skip"
  );
  const editParishes = useQuery(
    api.locations.getParishesBySubcounty,
    isConvexId(form.subcountyId) ? { subcountyId: form.subcountyId as Id<"subcounties"> } : "skip"
  );

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile({
        userId,
        phoneNumber: form.phoneNumber || undefined,
        email: form.email || undefined,
        village: form.village || undefined,
        region: form.region || undefined,
        ...(form.districtId ? { districtId: form.districtId as Id<"districts"> } : {}),
        ...(form.subcountyId ? { subcountyId: form.subcountyId as Id<"subcounties"> } : {}),
        ...(form.parishId ? { parishId: form.parishId as Id<"parishes"> } : {}),
      });
      setMessage({ type: "success", text: "Profile updated!" });
      setEditing(false);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to update" });
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <div style={{
        padding: "1.5rem",
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #e0e0e0",
        marginBottom: "1.5rem",
      }}>
        <p style={{ color: "#999", fontSize: "0.9rem" }}>Loading profile...</p>
      </div>
    );
  }

  const fieldLabel: React.CSSProperties = {
    display: "block",
    marginBottom: "0.35rem",
    fontWeight: 600,
    color: "#374151",
    fontSize: "0.85rem",
  };

  const fieldInput: React.CSSProperties = {
    width: "100%",
    padding: "0.55rem 0.75rem",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "0.9rem",
    boxSizing: "border-box" as const,
  };

  const infoRow = (label: string, value: string | undefined) => (
    <div style={{ marginBottom: "0.65rem" }}>
      <span style={{ fontSize: "0.8rem", color: "#888", display: "block" }}>{label}</span>
      <span style={{ fontSize: "0.95rem", color: value ? "#1a1a1a" : "#ccc", fontWeight: value ? 500 : 400 }}>
        {value || "Not set"}
      </span>
    </div>
  );

  return (
    <div style={{
      padding: "clamp(1rem, 3vw, 1.5rem)",
      background: "#fff",
      borderRadius: "12px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      border: "1px solid #e0e0e0",
      marginBottom: "1.5rem",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{
          margin: 0,
          fontSize: "clamp(1.05rem, 3.5vw, 1.25rem)",
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: 600,
        }}>
          👤 My Profile
        </h3>
        {!editing && (
          <button
            onClick={() => { setEditing(true); setMessage(null); }}
            style={{
              padding: "0.4rem 0.8rem",
              background: "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Edit
          </button>
        )}
      </div>

      {message && (
        <div style={{
          marginBottom: "0.75rem",
          padding: "0.6rem 0.75rem",
          borderRadius: "6px",
          background: message.type === "success" ? "#e8f5e9" : "#ffebee",
          color: message.type === "success" ? "#2e7d32" : "#c62828",
          fontSize: "0.85rem",
        }}>
          {message.text}
        </div>
      )}

      {!editing ? (
        /* ── View mode ── */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.25rem 1.5rem" }}>
          {infoRow("Phone", profile.phoneNumber)}
          {infoRow("Email", profile.email)}
          {infoRow("District", profile.districtName)}
          {infoRow("Sub-county", profile.subcountyName)}
          {infoRow("Parish", profile.parishName)}
          {infoRow("Village", profile.village)}
          {infoRow("Region", profile.region)}
        </div>
      ) : (
        /* ── Edit mode ── */
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.85rem" }}>
          {/* Phone */}
          <div>
            <label style={fieldLabel}>Phone Number</label>
            <input
              type="tel"
              placeholder="e.g. 0700123456"
              value={form.phoneNumber}
              onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
              style={fieldInput}
            />
          </div>

          {/* Email */}
          <div>
            <label style={fieldLabel}>Email</label>
            <input
              type="email"
              placeholder="your@email.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              style={fieldInput}
            />
          </div>

          {/* District */}
          <div>
            <label style={fieldLabel}>District</label>
            <select
              value={form.districtId}
              onChange={(e) => setForm({ ...form, districtId: e.target.value, subcountyId: "", parishId: "" })}
              style={fieldInput}
            >
              <option value="">Select district...</option>
              {districts?.map((d: any) => (
                <option key={d.id} value={String(d.id)}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Sub-county */}
          {form.districtId && (
            <div>
              <label style={fieldLabel}>Sub-county</label>
              <select
                value={form.subcountyId}
                onChange={(e) => setForm({ ...form, subcountyId: e.target.value, parishId: "" })}
                style={fieldInput}
              >
                <option value="">Select sub-county...</option>
                {(editSubcounties || []).map((s: any) => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Parish */}
          {form.subcountyId && (
            <div>
              <label style={fieldLabel}>Parish</label>
              <select
                value={form.parishId}
                onChange={(e) => setForm({ ...form, parishId: e.target.value })}
                style={fieldInput}
              >
                <option value="">Select parish...</option>
                {(editParishes || []).map((p: any) => (
                  <option key={p.id} value={String(p.id)}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Village */}
          <div>
            <label style={fieldLabel}>Village</label>
            <input
              type="text"
              placeholder="Village name"
              value={form.village}
              onChange={(e) => setForm({ ...form, village: e.target.value })}
              style={fieldInput}
            />
          </div>

          {/* Region */}
          <div>
            <label style={fieldLabel}>Region</label>
            <select
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              style={fieldInput}
            >
              <option value="">Select region...</option>
              <option value="Central">Central</option>
              <option value="Eastern">Eastern</option>
              <option value="Northern">Northern</option>
              <option value="Western">Western</option>
            </select>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "0.6rem 1.2rem",
                background: "#4caf50",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setMessage(null);
                // Reset form to profile values
                if (profile) {
                  setForm({
                    phoneNumber: profile.phoneNumber || "",
                    email: profile.email || "",
                    districtId: profile.districtId ? String(profile.districtId) : "",
                    subcountyId: profile.subcountyId ? String(profile.subcountyId) : "",
                    parishId: profile.parishId ? String(profile.parishId) : "",
                    village: profile.village || "",
                    region: profile.region || "",
                  });
                }
              }}
              style={{
                padding: "0.6rem 1.2rem",
                background: "#e0e0e0",
                border: "none",
                borderRadius: "8px",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
