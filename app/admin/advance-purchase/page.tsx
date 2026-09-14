"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import Link from "next/link";
import { useStoredUser } from "../../hooks/useStoredUser";
import { CommunityAdvancePurchasePanel } from "../../components/advancePurchase/CommunityAdvancePurchasePanel";

const FONT = '"Montserrat", sans-serif';

/**
 * This header sits directly on the app's photographic background with no card
 * behind it, where mid-grey text disappears against the leaves. A white halo
 * keeps it readable over both the bright and the dark parts of the photo
 * without putting a panel behind it.
 */
const ON_PHOTO_SHADOW = "0 1px 2px rgba(255,255,255,0.95), 0 0 8px rgba(255,255,255,0.9)";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.6rem", borderRadius: 8, border: "1px solid #ccc", marginBottom: "0.6rem", fontFamily: FONT, boxSizing: "border-box",
};

export default function AdvancePurchaseAdminPage() {
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  const [selectedCommunityId, setSelectedCommunityId] = useState<Id<"communities"> | null>(null);

  const communities = useQuery(api.introspection.getCommunitiesForAdmin, userId ? { adminId: userId } : "skip");

  if (authStatus === "loading") return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading...</div>;
  if (!user || user.role !== "admin") {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>Admin access required.</div>;
  }

  return (
    <div style={{ padding: "1rem", maxWidth: 720, margin: "0 auto", fontFamily: FONT }}>
      <div style={{ marginBottom: "1rem" }}>
        <Link href="/" style={{ color: "#0d47a1", fontWeight: 700, fontSize: "0.9rem", textDecoration: "none", textShadow: ON_PHOTO_SHADOW }}>← Back to Dashboard</Link>
      </div>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.25rem", color: "#1a1a1a", textShadow: ON_PHOTO_SHADOW }}>Advanced Markets — Community Admin</h1>
      <p style={{ color: "#333", fontWeight: 600, fontSize: "0.88rem", marginBottom: "1rem", textShadow: ON_PHOTO_SHADOW }}>
        Configure product fields, milestones and payment release rules, then review submitted milestone proof pictures.
        This is also available as an &quot;Advanced Markets&quot; tab inside each community&apos;s dashboard.
      </p>

      <select
        value={selectedCommunityId || ""}
        onChange={(e) => setSelectedCommunityId(e.target.value ? (e.target.value as Id<"communities">) : null)}
        style={inputStyle}
      >
        <option value="">Select a community</option>
        {communities?.map((c: any) => (
          <option key={c._id} value={c._id}>{c.name}</option>
        ))}
      </select>

      {selectedCommunityId && (
        <CommunityAdvancePurchasePanel adminId={userId!} communityId={selectedCommunityId} />
      )}
    </div>
  );
}
