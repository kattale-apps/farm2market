"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useStoredUser } from "@/app/hooks/useStoredUser";

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
  padding: "1.5rem",
};

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1rem",
        right: "1rem",
        background: "#16a34a",
        color: "#fff",
        padding: "0.75rem 1.5rem",
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      <span>✓</span>
      <span>{message}</span>
    </div>
  );
}

function SkeletonButton() {
  return (
    <div
      style={{
        height: 44,
        background: "#e5e7eb",
        borderRadius: 8,
        width: "100%",
      }}
    />
  );
}

function PricingField({
  label,
  hint,
  value,
  error,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div
      style={{
        border: `1px solid ${error ? "#f87171" : "#e5e7eb"}`,
        borderRadius: 8,
        padding: "1rem",
        marginBottom: "0.75rem",
        background: error ? "#fef2f2" : "transparent",
      }}
    >
      <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min="0"
        placeholder="0"
        style={{
          width: "100%",
          padding: "0.75rem 1rem",
          borderRadius: 8,
          border: `1px solid ${error ? "#f87171" : "#d1d5db"}`,
          minHeight: 44,
          fontSize: "1rem",
          opacity: disabled ? 0.5 : 1,
        }}
      />
      <p style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "0.5rem" }}>{hint}</p>
      {error && <p style={{ fontSize: "0.8rem", color: "#dc2626", marginTop: "0.25rem", fontWeight: 500 }}>{error}</p>}
    </div>
  );
}

function PricingEditor({
  selectedCommunity,
  selectedCommunityId,
  adminId,
}: {
  selectedCommunity: any;
  selectedCommunityId: Id<"communities">;
  adminId: Id<"users">;
}) {
  const [juniorAdminFreeMonthlyImageQuota, setJuniorAdminFreeMonthlyImageQuota] = useState(0);
  const [juniorAdminImagePrice, setJuniorAdminImagePrice] = useState(0);
  const [memberImageMessagePrice, setMemberImageMessagePrice] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Seed state from selected community when it changes
  useEffect(() => {
    if (selectedCommunity) {
      setJuniorAdminFreeMonthlyImageQuota(selectedCommunity.juniorAdminFreeMonthlyImageQuota ?? 0);
      setJuniorAdminImagePrice(selectedCommunity.juniorAdminImagePrice ?? 0);
      setMemberImageMessagePrice(selectedCommunity.memberImageMessagePrice ?? 0);
    }
    // Deliberately depend on the specific fields we seed from, not the whole
    // `selectedCommunity` object — that reference changes on every parent
    // re-render and would keep resetting these editable fields while the
    // admin is mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCommunity?._id, selectedCommunity?.juniorAdminFreeMonthlyImageQuota, selectedCommunity?.juniorAdminImagePrice, selectedCommunity?.memberImageMessagePrice]);
  const [showToast, setShowToast] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updatePricing = useMutation(api.communities.updateCommunityPricing);

  const validateInputs = () => {
    const newErrors: Record<string, string> = {};

    if (isNaN(juniorAdminFreeMonthlyImageQuota) || juniorAdminFreeMonthlyImageQuota < 0) {
      newErrors.juniorAdminFreeMonthlyImageQuota = "Must be a non-negative number";
    }

    if (isNaN(juniorAdminImagePrice) || juniorAdminImagePrice < 0) {
      newErrors.juniorAdminImagePrice = "Must be a non-negative number";
    }

    if (isNaN(memberImageMessagePrice) || memberImageMessagePrice < 0) {
      newErrors.memberImageMessagePrice = "Must be a non-negative number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!adminId) return;

    if (!validateInputs()) {
      return;
    }

    setIsSaving(true);
    try {
      await updatePricing({
        communityId: selectedCommunityId,
        juniorAdminFreeMonthlyImageQuota: juniorAdminFreeMonthlyImageQuota,
        juniorAdminImagePrice: juniorAdminImagePrice,
        memberImageMessagePrice: memberImageMessagePrice,
        adminId,
      });
      setShowToast(true);
    } catch (error) {
      console.error("Failed to update pricing:", error);
      alert("Failed to update pricing. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    const numValue = parseInt(value) || 0;

    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    if (field === "juniorAdminFreeMonthlyImageQuota") {
      setJuniorAdminFreeMonthlyImageQuota(numValue);
    } else if (field === "juniorAdminImagePrice") {
      setJuniorAdminImagePrice(numValue);
    } else if (field === "memberImageMessagePrice") {
      setMemberImageMessagePrice(numValue);
    }
  };

  return (
    <div style={{ ...card, marginTop: "1.5rem" }}>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1.5rem" }}>Pricing Settings</h2>

      <PricingField
        label="Free Image Quota Per Month"
        hint="Posts per month allowed for free"
        value={juniorAdminFreeMonthlyImageQuota}
        error={errors.juniorAdminFreeMonthlyImageQuota}
        disabled={isSaving}
        onChange={(v) => handleInputChange("juniorAdminFreeMonthlyImageQuota", v)}
      />

      <PricingField
        label="Noticeboard Image Price (UGX)"
        hint="Charge per image posted over quota"
        value={juniorAdminImagePrice}
        error={errors.juniorAdminImagePrice}
        disabled={isSaving}
        onChange={(v) => handleInputChange("juniorAdminImagePrice", v)}
      />

      <PricingField
        label="Message Image Price (UGX)"
        hint="Charge per image sent in messages"
        value={memberImageMessagePrice}
        error={errors.memberImageMessagePrice}
        disabled={isSaving}
        onChange={(v) => handleInputChange("memberImageMessagePrice", v)}
      />

      <div style={{ marginTop: "0.5rem" }}>
        {isSaving ? (
          <SkeletonButton />
        ) : (
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              width: "100%",
              padding: "0.9rem 1.5rem",
              background: "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: "1rem",
              minHeight: 44,
              cursor: isSaving ? "not-allowed" : "pointer",
              opacity: isSaving ? 0.5 : 1,
            }}
          >
            Save Pricing
          </button>
        )}
      </div>

      {showToast && (
        <Toast
          message="Community pricing updated"
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}

function StatTile({ label, value, background }: { label: string; value: React.ReactNode; background: string }) {
  return (
    <div style={{ padding: "1rem", background, borderRadius: 8 }}>
      <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function UsageSummaryPanel({
  selectedCommunity,
  selectedCommunityId,
  adminId,
}: {
  selectedCommunity: any;
  selectedCommunityId: Id<"communities">;
  adminId: Id<"users">;
}) {
  const usageSummary = useQuery(api.usageEvents.getCommunityUsageSummary, {
    communityId: selectedCommunityId,
  });

  if (!usageSummary) return null;

  return (
    <>
      <div style={card}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1.5rem" }}>
          {selectedCommunity.name} - Monthly Usage Summary
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <StatTile label="Total Noticeboard Images" value={usageSummary.totalNoticeboardImagePosts} background="#f9fafb" />
          <StatTile label="Billable Noticeboard" value={usageSummary.totalBillableNoticeboardImagePosts} background="#fff7ed" />
          <StatTile label="Total Message Images" value={usageSummary.totalMessageImages} background="#f9fafb" />
          <StatTile label="Billable Messages" value={usageSummary.totalBillableMessageImages} background="#fff7ed" />
          <StatTile label="Total Amount" value={`UGX ${usageSummary.totalAmount.toLocaleString()}`} background="#eff6ff" />
        </div>

        {(usageSummary.breakdown || []).length > 0 && (
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>Breakdown by Type</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {(usageSummary.breakdown || []).map((item) => (
                <div key={item.type} style={{ padding: "1rem", background: "#f9fafb", borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <div style={{ fontWeight: 600, textTransform: "capitalize" }}>{item.type.replace(/_/g, " ")}</div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>{item.count} total</div>
                      <div style={{ fontSize: "0.85rem", color: "#ea580c" }}>{item.billableCount} billable</div>
                    </div>
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1976d2" }}>
                    UGX {item.totalAmount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <PricingEditor
        selectedCommunity={selectedCommunity}
        selectedCommunityId={selectedCommunityId}
        adminId={adminId}
      />
    </>
  );
}

function CommunitiesList({ adminId }: { adminId: Id<"users"> }) {
  const communities = useQuery(api.communities.getCommunitiesWithUsageForSuperadmin, { adminId });
  const [selectedCommunityId, setSelectedCommunityId] = useState<Id<"communities"> | null>(null);

  const selectedCommunity = communities?.find((c) => c._id === selectedCommunityId);

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
        {communities?.map((community) => {
          const isSelected = selectedCommunityId === community._id;
          return (
            <button
              key={community._id}
              onClick={() => setSelectedCommunityId(community._id)}
              style={{
                padding: "1rem",
                borderRadius: 8,
                border: `2px solid ${isSelected ? "#3b82f6" : "#e5e7eb"}`,
                background: isSelected ? "#eff6ff" : "#fff",
                textAlign: "left",
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                width: "100%",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", width: "100%" }}>
                {community.logo && (
                  <img
                    src={community.logo}
                    alt={community.name}
                    style={{
                      width: 48,
                      height: 48,
                      minWidth: 48,
                      borderRadius: "50%",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontWeight: 600, fontSize: "1.1rem" }}>{community.name}</h2>
                  <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "0.25rem" }}>
                    <div>Image Post: UGX {community.juniorAdminImagePrice}</div>
                    <div>Message Image: UGX {community.memberImageMessagePrice}</div>
                    <div>Free Quota: {community.juniorAdminFreeMonthlyImageQuota} posts/month</div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedCommunity && selectedCommunityId ? (
        <UsageSummaryPanel
          selectedCommunity={selectedCommunity}
          selectedCommunityId={selectedCommunityId}
          adminId={adminId}
        />
      ) : (
        <div style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>
          Select a community to view usage details
        </div>
      )}
    </>
  );
}

export default function SuperadminUsagePage() {
  const { user, status: authStatus } = useStoredUser();
  const adminId = (user?.userId as Id<"users"> | undefined) ?? null;

  if (authStatus === "loading") {
    return <div style={{ padding: "2rem", textAlign: "center" }}><p>Loading your session...</p></div>;
  }

  if (authStatus === "unauthenticated" || user?.role !== "admin") {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>You must be an admin to view this page.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "1.5rem" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "2rem" }}>Superadmin Usage Dashboard</h1>

        {adminId ? (
          <CommunitiesList adminId={adminId} />
        ) : (
          <div style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>
            Loading user information...
          </div>
        )}
      </div>
    </div>
  );
}
