"use client";

export const dynamic = "force-dynamic";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useStoredUser } from "../../hooks/useStoredUser";

export default function TraderSettingsPage() {
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  const preferences = useQuery(
    api.userSettings.getNotificationPreferences,
    userId ? { userId } : "skip"
  );
  const updatePreferences = useMutation(api.userSettings.updateNotificationPreferences);
  const [newListings, setNewListings] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Update local state when preferences load
  useEffect(() => {
    if (preferences) {
      setNewListings(preferences.newListings ?? true);
    }
  }, [preferences]);

  const handleSave = async () => {
    if (!userId) return;

    setLoading(true);
    setMessage(null);

    try {
      await updatePreferences({
        userId,
        preferences: {
          newListings,
        },
      });
      setMessage({ type: "success", text: "Settings saved successfully!" });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to save settings" });
    } finally {
      setLoading(false);
    }
  };

  if (authStatus === "loading") {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading your session...</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Please log in to access settings.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "clamp(1rem, 4vw, 2rem)", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1rem" }}>
        <Link href="/" style={{ color: "#1976d2", fontWeight: 600, fontSize: "0.9rem", textDecoration: "none" }}>← Back to Dashboard</Link>
      </div>
      <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", marginBottom: "1.5rem" }}>
        Notification Settings
      </h1>
      <p style={{ marginBottom: "2rem", color: "#666" }}>
        Manage your notification preferences. Critical transaction alerts cannot be disabled.
      </p>

      {message && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            borderRadius: "8px",
            background: message.type === "success" ? "#d4edda" : "#f8d7da",
            color: message.type === "success" ? "#155724" : "#721c24",
          }}
        >
          {message.text}
        </div>
      )}

      <div
        style={{
          padding: "1.5rem",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>Notification Preferences</h2>

        <div style={{ marginBottom: "1.5rem" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              cursor: "pointer",
              padding: "1rem",
              background: "#f5f5f5",
              borderRadius: "8px",
            }}
          >
            <input
              type="checkbox"
              checked={newListings}
              onChange={(e) => setNewListings(e.target.checked)}
              style={{ width: "20px", height: "20px", cursor: "pointer" }}
            />
            <div>
              <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
                New Listing Notifications
              </div>
              <div style={{ fontSize: "0.9rem", color: "#666" }}>
                Get notified when farmers create new listings
              </div>
            </div>
          </label>
        </div>

        <div style={{ padding: "1rem", background: "#e8f5e9", borderRadius: "8px", marginBottom: "1rem" }}>
          <div style={{ fontWeight: "600", marginBottom: "0.5rem", color: "#2e7d32" }}>
            Always Enabled (Critical Alerts)
          </div>
          <ul style={{ margin: 0, paddingLeft: "1.5rem", color: "#666" }}>
            <li>Offer notifications (when farmers respond to your offers)</li>
            <li>Counter-offer notifications (when farmers make counter-offers)</li>
            <li>Transaction alerts (payments, deliveries, etc.)</li>
          </ul>
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          style={{
            width: "100%",
            padding: "1rem",
            fontSize: "1.1rem",
            fontWeight: "600",
            background: loading ? "#ccc" : "#4caf50",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
