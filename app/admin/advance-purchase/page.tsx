"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useStoredUser } from "../../hooks/useStoredUser";
import { CommunityAdvancePurchasePanel } from "../../components/advancePurchase/CommunityAdvancePurchasePanel";

const FONT = '"Montserrat", sans-serif';

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
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.25rem" }}>Advance Purchase — Community Admin</h1>
      <p style={{ color: "#666", fontSize: "0.88rem", marginBottom: "1rem" }}>
        Configure product fields, milestones and payment release rules, then review submitted milestone evidence.
        This is also available as an &quot;Advance Purchase&quot; tab inside each community&apos;s dashboard.
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
