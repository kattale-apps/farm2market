"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import CommunityTabBar from "@/app/components/CommunityTabBar";

const BRAND = "#2e7d32";
const FONT = '"Montserrat", sans-serif';

const SUPPLY_CHAIN_ROLES = [
  "Farmer",
  "Market vendor",
  "Trader",
  "Buyer",
  "Transporter",
  "Storage provider",
  "Stockist",
  "Agent",
  "Distributor",
  "Investor",
  "Sponsor",
  "Agroprocessor",
  "Exporter",
  "Agronomist",
  "VET doctor",
  "Agro-machinery repair",
  "Input supplier",
  "Financial services",
  "Other",
];

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed", bottom: 80, right: 16,
      background: BRAND, color: "#fff",
      padding: "0.75rem 1.25rem", borderRadius: 10,
      boxShadow: "0 4px 12px rgba(0,0,0,0.25)", zIndex: 50,
      fontFamily: FONT, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 8,
    }}>
      <span>✓</span><span>{message}</span>
    </div>
  );
}

export default function CommunityProfilePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const communityId = searchParams.get("communityId") as Id<"communities"> | null;

  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [otherRoleText, setOtherRoleText] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [creatingValidation, setCreatingValidation] = useState(false);

  const updateRole = useMutation(api.farmerProfile.updateSupplyChainRole);

  // Farm Validation mutations/queries (for AgroFresh)
  const createNewValidation = useMutation(api.farmValidation.createNewDraft) as (
    args: { farmerId: Id<"users"> }
  ) => Promise<Id<"agroFreshUGFarmValidations">>;
  const myAgroFreshDrafts = useQuery(
    api.farmValidation.getMyDrafts,
    userId ? { farmerId: userId } : "skip"
  );

  useEffect(() => {
    const raw = localStorage.getItem("pilot_user");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setUserId((parsed?._id || parsed?.id || parsed) as Id<"users">);
      } catch {
        setUserId(raw as Id<"users">);
      }
    }
  }, []);

  const agroFreshCommunityId = process.env.NEXT_PUBLIC_AGROFRESH_COMMUNITY_ID;
  const isAgroFresh = !!(agroFreshCommunityId && communityId === agroFreshCommunityId);

  const handleSave = async () => {
    if (!userId) return;
    setIsSaving(true);
    try {
      await updateRole({
        userId,
        supplyChainRole: selectedRole || undefined,
        supplyChainRoleOther: selectedRole === "Other" ? otherRoleText : undefined,
      });
      setToastMessage("Role updated successfully");
      setSelectedRole("");
      setOtherRoleText("");
    } catch (error) {
      console.error("Failed to save role:", error);
      setToastMessage("Failed to save role. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartFarmValidation = async () => {
    if (!userId) return;
    setCreatingValidation(true);
    try {
      const latestDraft = myAgroFreshDrafts?.length
        ? [...myAgroFreshDrafts].sort((a: any, b: any) => {
            const aTime = a.updatedAt ?? a.createdAt ?? a._creationTime ?? 0;
            const bTime = b.updatedAt ?? b.createdAt ?? b._creationTime ?? 0;
            return bTime - aTime;
          })[0]
        : null;

      if (latestDraft?._id) {
        router.push(`/farm-validation/${latestDraft._id}`);
      } else {
        const newFormId = await createNewValidation({ farmerId: userId });
        router.push(`/farm-validation/${newFormId}`);
      }
    } catch (err: any) {
      setToastMessage(err?.message || "Failed to start farm validation");
    } finally {
      setCreatingValidation(false);
    }
  };

  if (!userId) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: FONT }}>
        <p style={{ color: "#999", fontSize: "1.1rem" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "1rem", paddingBottom: "5rem", fontFamily: FONT }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <h1 style={{ fontSize: "clamp(1.3rem, 4vw, 1.6rem)", fontWeight: 700, color: "#1a1a1a", marginBottom: "1.25rem" }}>
          Your Profile
        </h1>

        {/* Role Card */}
        <div style={{
          background: "#fff", borderRadius: 14, padding: "clamp(1rem, 3vw, 1.5rem)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)", border: "1px solid #e0e0e0", marginBottom: "1.25rem",
        }}>
          <h2 style={{ fontSize: "clamp(1.05rem, 3vw, 1.2rem)", fontWeight: 700, color: "#1a1a1a", margin: "0 0 0.5rem" }}>
            Your role in the value chain
          </h2>
          <p style={{ fontSize: "clamp(0.9rem, 2.5vw, 1rem)", color: "#666", margin: "0 0 1rem" }}>
            Help others understand what you do in the supply chain
          </p>

          <select
            value={selectedRole}
            onChange={(e) => { setSelectedRole(e.target.value); if (e.target.value !== "Other") setOtherRoleText(""); }}
            disabled={isSaving}
            style={{
              width: "100%", padding: "0.75rem 1rem", border: "1px solid #ccc", borderRadius: 10,
              fontSize: "clamp(0.95rem, 2.5vw, 1.05rem)", fontFamily: FONT, marginBottom: "0.75rem",
              minHeight: 48, background: "#fff", color: "#333",
            }}
          >
            <option value="">Select a role...</option>
            {SUPPLY_CHAIN_ROLES.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>

          {selectedRole === "Other" && (
            <input
              type="text"
              value={otherRoleText}
              onChange={(e) => setOtherRoleText(e.target.value)}
              placeholder="Describe your role..."
              disabled={isSaving}
              style={{
                width: "100%", padding: "0.75rem 1rem", border: "1px solid #ccc", borderRadius: 10,
                fontSize: "clamp(0.95rem, 2.5vw, 1.05rem)", fontFamily: FONT, marginBottom: "0.75rem",
                minHeight: 48, boxSizing: "border-box",
              }}
            />
          )}

          <button
            onClick={handleSave}
            disabled={isSaving || !selectedRole || (selectedRole === "Other" && !otherRoleText.trim())}
            style={{
              width: "100%", padding: "0.75rem", background: BRAND, color: "#fff",
              border: "none", borderRadius: 10, fontSize: "clamp(0.95rem, 2.5vw, 1.05rem)",
              fontWeight: 600, fontFamily: FONT, cursor: isSaving ? "not-allowed" : "pointer",
              opacity: (!selectedRole || isSaving) ? 0.5 : 1, minHeight: 48,
            }}
          >
            {isSaving ? "Saving..." : "Save role"}
          </button>

          <p style={{ fontSize: "0.8rem", color: "#999", textAlign: "center", marginTop: "0.75rem" }}>
            Optional &bull; You can update this anytime
          </p>
        </div>

        {/* Farm Validation (AgroFresh only) */}
        {isAgroFresh && (
          <div style={{
            background: "#fff", borderRadius: 14, padding: "clamp(1rem, 3vw, 1.5rem)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)", border: "1px solid #e0e0e0", marginBottom: "1.25rem",
          }}>
            <h2 style={{ fontSize: "clamp(1.05rem, 3vw, 1.2rem)", fontWeight: 700, color: "#1a1a1a", margin: "0 0 0.5rem" }}>
              Farm Validation
            </h2>
            <p style={{ fontSize: "clamp(0.9rem, 2.5vw, 1rem)", color: "#555", margin: "0 0 1rem" }}>
              Submit a new farm for validation with AGROFRESH UG.
            </p>
            <button
              onClick={handleStartFarmValidation}
              disabled={creatingValidation}
              style={{
                padding: "0.75rem 1.25rem", background: BRAND, color: "#fff",
                border: "none", borderRadius: 10, fontSize: "clamp(0.95rem, 2.5vw, 1.05rem)",
                fontWeight: 600, fontFamily: FONT,
                cursor: creatingValidation ? "not-allowed" : "pointer",
                opacity: creatingValidation ? 0.7 : 1,
              }}
            >
              {creatingValidation ? "Starting..." : "Start New Farm Validation"}
            </button>
          </div>
        )}
      </div>

      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
      <CommunityTabBar />
    </div>
  );
}
