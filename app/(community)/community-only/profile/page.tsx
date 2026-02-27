"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

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
    <div className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50">
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

export default function CommunityProfilePage() {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [otherRoleText, setOtherRoleText] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Mutation for updating supply chain role
  const updateRole = useMutation(api.farmerProfile.updateSupplyChainRole);

  // Get user ID from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("pilot_user");
    if (storedUser) {
      try {
        const userObj = JSON.parse(storedUser);
        if (userObj.userId) {
          setUserId(userObj.userId as Id<"users">);
        }
      } catch {
        setUserId(storedUser as Id<"users">);
      }
    }
  }, []);

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

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Profile</h1>

        {/* Role Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Your role in the value chain
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Help others understand what you do in the supply chain
          </p>

          {/* Dropdown */}
          <div className="mb-4">
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                if (e.target.value !== "Other") {
                  setOtherRoleText("");
                }
              }}
              disabled={isSaving}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-50 disabled:bg-gray-50 bg-white min-h-[44px]"
            >
              <option value="">Select a role...</option>
              {SUPPLY_CHAIN_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          {/* Other Role Text Input */}
          {selectedRole === "Other" && (
            <div className="mb-4">
              <input
                type="text"
                value={otherRoleText}
                onChange={(e) => setOtherRoleText(e.target.value)}
                placeholder="Describe your role..."
                disabled={isSaving}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm placeholder-gray-500 disabled:opacity-50 disabled:bg-gray-50 min-h-[44px]"
              />
            </div>
          )}

          {/* Save Button */}
          {isSaving ? (
            <SkeletonButton />
          ) : (
            <button
              onClick={handleSave}
              disabled={isSaving || !selectedRole || (selectedRole === "Other" && !otherRoleText.trim())}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition min-h-[44px]"
            >
              Save role
            </button>
          )}

          {/* Helper text */}
          <p className="text-xs text-gray-500 mt-4 text-center">
            Optional • You can update this anytime
          </p>
        </div>
      </div>

      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
