"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "@/convex/_generated/dataModel";

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
      <span>✓</span>
      <span>{message}</span>
    </div>
  );
}

function SkeletonButton() {
  return (
    <div className="h-10 bg-gray-200 rounded-lg animate-pulse w-full"></div>
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
  }, [selectedCommunity?._id, selectedCommunity?.juniorAdminFreeMonthlyImageQuota, selectedCommunity?.juniorAdminImagePrice, selectedCommunity?.memberImageMessagePrice]);
  const [showToast, setShowToast] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updatePricing = useMutation(api.communities.updateCommunityPricing);

  const validateInputs = () => {
    const newErrors: Record<string, string> = {};

    // Validate juniorAdminFreeMonthlyImageQuota
    if (isNaN(juniorAdminFreeMonthlyImageQuota) || juniorAdminFreeMonthlyImageQuota < 0) {
      newErrors.juniorAdminFreeMonthlyImageQuota = "Must be a non-negative number";
    }

    // Validate juniorAdminImagePrice
    if (isNaN(juniorAdminImagePrice) || juniorAdminImagePrice < 0) {
      newErrors.juniorAdminImagePrice = "Must be a non-negative number";
    }

    // Validate memberImageMessagePrice
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

    // Clear error for this field when user starts typing
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
    <div className="bg-white rounded-lg shadow-lg p-6 mt-6 pb-32 md:pb-6">
      <h2 className="text-xl font-bold mb-6">Pricing Settings</h2>

      {/* Card 1: Free Image Quota */}
      <div className="border border-gray-200 rounded-lg p-4 mb-3">
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Free Image Quota Per Month
        </label>
        <input
          type="number"
          value={juniorAdminFreeMonthlyImageQuota}
          onChange={(e) => handleInputChange("juniorAdminFreeMonthlyImageQuota", e.target.value)}
          disabled={isSaving}
          min="0"
          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition min-h-[44px] ${
            errors.juniorAdminFreeMonthlyImageQuota
              ? "border-red-400 focus:ring-red-500 bg-red-50"
              : "border-gray-300 focus:ring-blue-500"
          } disabled:opacity-50 disabled:bg-gray-50`}
          placeholder="0"
        />
        <p className="text-xs text-gray-500 mt-2">Posts per month allowed for free</p>
        {errors.juniorAdminFreeMonthlyImageQuota && (
          <p className="text-xs text-red-600 mt-1 font-medium">{errors.juniorAdminFreeMonthlyImageQuota}</p>
        )}
      </div>

      {/* Card 2: Noticeboard Image Price */}
      <div className="border border-gray-200 rounded-lg p-4 mb-3">
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Noticeboard Image Price (UGX)
        </label>
        <input
          type="number"
          value={juniorAdminImagePrice}
          onChange={(e) => handleInputChange("juniorAdminImagePrice", e.target.value)}
          disabled={isSaving}
          min="0"
          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition min-h-[44px] ${
            errors.juniorAdminImagePrice
              ? "border-red-400 focus:ring-red-500 bg-red-50"
              : "border-gray-300 focus:ring-blue-500"
          } disabled:opacity-50 disabled:bg-gray-50`}
          placeholder="0"
        />
        <p className="text-xs text-gray-500 mt-2">Charge per image posted over quota</p>
        {errors.juniorAdminImagePrice && (
          <p className="text-xs text-red-600 mt-1 font-medium">{errors.juniorAdminImagePrice}</p>
        )}
      </div>

      {/* Card 3: Message Image Price */}
      <div className="border border-gray-200 rounded-lg p-4 mb-6">
        <label className="block text-sm font-semibold text-gray-900 mb-2">
          Message Image Price (UGX)
        </label>
        <input
          type="number"
          value={memberImageMessagePrice}
          onChange={(e) => handleInputChange("memberImageMessagePrice", e.target.value)}
          disabled={isSaving}
          min="0"
          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition min-h-[44px] ${
            errors.memberImageMessagePrice
              ? "border-red-400 focus:ring-red-500 bg-red-50"
              : "border-gray-300 focus:ring-blue-500"
          } disabled:opacity-50 disabled:bg-gray-50`}
          placeholder="0"
        />
        <p className="text-xs text-gray-500 mt-2">Charge per image sent in messages</p>
        {errors.memberImageMessagePrice && (
          <p className="text-xs text-red-600 mt-1 font-medium">{errors.memberImageMessagePrice}</p>
        )}
      </div>

      {/* Sticky Footer with Save Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:static md:border-t-0 md:p-0 pb-safe">
        {isSaving ? (
          <SkeletonButton />
        ) : (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition min-h-[44px]"
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
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-6">{selectedCommunity.name} - Monthly Usage Summary</h2>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">Total Noticeboard Images</div>
            <div className="text-2xl font-bold">{usageSummary.totalNoticeboardImagePosts}</div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="text-sm text-gray-600">Billable Noticeboard</div>
            <div className="text-2xl font-bold">{usageSummary.totalBillableNoticeboardImagePosts}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">Total Message Images</div>
            <div className="text-2xl font-bold">{usageSummary.totalMessageImages}</div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="text-sm text-gray-600">Billable Messages</div>
            <div className="text-2xl font-bold">{usageSummary.totalBillableMessageImages}</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-gray-600">Total Amount</div>
            <div className="text-2xl font-bold">UGX {usageSummary.totalAmount.toLocaleString()}</div>
          </div>
        </div>

        {usageSummary.breakdown.length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-4">Breakdown by Type</h3>
            <div className="space-y-3">
              {usageSummary.breakdown.map((item) => (
                <div key={item.type} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-semibold capitalize">{item.type.replace(/_/g, " ")}</div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">{item.count} total</div>
                      <div className="text-sm text-orange-600">{item.billableCount} billable</div>
                    </div>
                  </div>
                  <div className="text-lg font-bold text-blue-600">UGX {item.totalAmount.toLocaleString()}</div>
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
      <div className="grid grid-cols-1 gap-4 mb-8">
        {communities?.map((community) => (
          <button
            key={community._id}
            onClick={() => setSelectedCommunityId(community._id)}
            className={`p-4 rounded-lg border-2 text-left transition-all min-h-[44px] flex items-center ${
              selectedCommunityId === community._id
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-4">
              {community.logo && (
                <img
                  src={community.logo}
                  alt={community.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              )}
              <div className="flex-1">
                <h2 className="font-semibold text-lg">{community.name}</h2>
                <div className="text-sm text-gray-600 mt-1">
                  <div>Image Post: UGX {community.juniorAdminImagePrice}</div>
                  <div>Message Image: UGX {community.memberImageMessagePrice}</div>
                  <div>Free Quota: {community.juniorAdminFreeMonthlyImageQuota} posts/month</div>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedCommunity && selectedCommunityId ? (
        <UsageSummaryPanel
          selectedCommunity={selectedCommunity}
          selectedCommunityId={selectedCommunityId}
          adminId={adminId}
        />
      ) : (
        <div className="text-center text-gray-500 p-8">
          Select a community to view usage details
        </div>
      )}
    </>
  );
}

export default function SuperadminUsagePage() {
  const [adminId, setAdminId] = useState<Id<"users"> | null>(null);

  useEffect(() => {
    // Get current user ID from localStorage (pilot_user for testing)
    try {
      const stored = localStorage.getItem("pilot_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.userId) {
          setAdminId(parsed.userId as Id<"users">);
        }
      }
    } catch {
      // If stored value is a raw ID string (legacy), use directly
      const stored = localStorage.getItem("pilot_user");
      if (stored) setAdminId(stored as Id<"users">);
    }
  }, []);

  return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8 pb-safe">
        <div className="max-w-md mx-auto md:max-w-none">
          <h1 className="text-2xl md:text-3xl font-bold mb-8">Superadmin Usage Dashboard</h1>

          {adminId ? (
            <CommunitiesList adminId={adminId} />
          ) : (
            <div className="text-center text-gray-500 p-8">
              Loading user information...
            </div>
          )}
        </div>
      </div>
  );
}
