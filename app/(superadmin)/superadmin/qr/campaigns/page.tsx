"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { useStoredUser } from "@/app/hooks/useStoredUser";
import { QrNav } from "../QrNav";
import { sectionStyle, sectionHeading, inputStyle, labelStyle, buttonStyle } from "../qrUiStyles";

export default function CampaignsPage() {
  const { user } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;

  const campaigns = useQuery(api.campaigns.listCampaigns, userId ? { adminId: userId } : "skip");
  const createCampaign = useMutation(api.campaigns.createCampaign);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<{ type: "idle" | "saving" | "error"; message?: string }>({ type: "idle" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !name.trim()) return;
    setStatus({ type: "saving" });
    try {
      await createCampaign({
        adminId: userId,
        name: name.trim(),
        description: description.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setName("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setStatus({ type: "idle" });
    } catch (error) {
      setStatus({ type: "error", message: (error as Error).message });
    }
  };

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "1.5rem" }}>
      <QrNav />
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "1.25rem" }}>Campaigns</h1>

      <section style={sectionStyle}>
        <h2 style={sectionHeading}>New campaign</h2>
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {status.type === "error" && <p style={{ color: "#c62828", fontSize: "0.85rem" }}>{status.message}</p>}
          <label style={labelStyle}>
            Name *
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Description
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
          </label>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <label style={{ ...labelStyle, flex: 1 }}>
              Start date
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ ...labelStyle, flex: 1 }}>
              End date
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
            </label>
          </div>
          <button type="submit" disabled={status.type === "saving"} style={{ ...buttonStyle("#1976d2"), alignSelf: "flex-start" }}>
            {status.type === "saving" ? "Creating..." : "Create campaign"}
          </button>
        </form>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        {campaigns === undefined ? (
          <p>Loading...</p>
        ) : campaigns.length === 0 ? (
          <p style={{ color: "#666" }}>No campaigns yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {campaigns.map((c) => (
              <Link
                key={c._id}
                href={`/superadmin/qr/campaigns/${c._id}`}
                style={{
                  display: "block",
                  padding: "1rem 1.25rem",
                  background: "#fff",
                  border: "1px solid #eee",
                  borderRadius: 12,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                {c.description && <div style={{ fontSize: "0.85rem", color: "#666" }}>{c.description}</div>}
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
