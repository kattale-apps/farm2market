"use client";

import React, { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import RoleGuard from "@/app/components/RoleGuard";

export const dynamic = "force-dynamic";

export default function CreateQRCommunity() {
  const router = useRouter();
  const createQRCommunity = useMutation(api.communities.createQRCommunity as any);

  const [adminId, setAdminId] = useState<Id<"users"> | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    logoFile: null as File | null,
    logoPreview: "",
    juniorAdminFreeMonthlyImageQuota: 2,
    juniorAdminImagePrice: 5000,
    memberImageMessagePrice: 1000,
  });

  const [status, setStatus] = useState<{
    type: "loading" | "error" | "success" | null;
    message: string;
  }>({ type: null, message: "" });

  const [generatedQR, setGeneratedQR] = useState<{
    qrDataUrl: string;
    joinLink: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const uid = localStorage.getItem("pilot_user");
      if (uid) setAdminId(uid as Id<"users">);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name.startsWith("juniorAdmin") || name.startsWith("member")
          ? parseInt(value, 10)
          : value,
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          logoFile: file,
          logoPreview: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!adminId) {
      setStatus({
        type: "error",
        message: "Not authenticated",
      });
      return;
    }

    if (!formData.name.trim() || !formData.slug.trim()) {
      setStatus({
        type: "error",
        message: "Community name and slug are required",
      });
      return;
    }

    setStatus({ type: "loading", message: "Creating community..." });

    try {
      // Step 1: Create the community
      const community = await createQRCommunity({
        adminId,
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        logoUrl: formData.logoPreview,
        juniorAdminFreeMonthlyImageQuota: formData.juniorAdminFreeMonthlyImageQuota,
        juniorAdminImagePrice: formData.juniorAdminImagePrice,
        memberImageMessagePrice: formData.memberImageMessagePrice,
      });

      // Step 2: Generate QR code (import dynamically to avoid SSR issues)
      const QRCode = (await import("qrcode")).default;
      const joinLink = `${window.location.origin}/join/${formData.slug}`;
      const qrDataUrl = await QRCode.toDataURL(joinLink);

      setGeneratedQR({
        qrDataUrl,
        joinLink,
      });

      setStatus({
        type: "success",
        message: `QR community "${formData.name}" created successfully!`,
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: `Error: ${(error as Error).message}`,
      });
    }
  };

  const handleDownloadQR = () => {
    if (!generatedQR) return;

    const link = document.createElement("a");
    link.href = generatedQR.qrDataUrl;
    link.download = `${formData.slug}-qr.png`;
    link.click();
  };

  const handleDone = () => {
    router.push("/superadmin");
  };

  return (
    <RoleGuard allowedRoles={["superadmin"]}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900">Create QR Community</h1>
            <p className="text-gray-600 mt-2">
              Set up a new community with monetisation controls
            </p>
          </div>

        {/* Form Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
          {status.type === "success" && generatedQR ? (
            // Success State
            <div className="space-y-6">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 font-medium">{status.message}</p>
              </div>

              {/* QR Code Display */}
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold">Your QR Code</h2>
                <img
                  src={generatedQR.qrDataUrl}
                  alt="Community QR Code"
                  className="w-64 h-64 mx-auto border-4 border-gray-200 rounded-lg"
                />
              </div>

              {/* Join Link */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Join Link:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={generatedQR.joinLink}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(generatedQR.joinLink)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Download Button */}
              <button
                onClick={handleDownloadQR}
                className="w-full px-4 py-3 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition"
              >
                Download QR Code (PNG)
              </button>

              {/* Done Button */}
              <button
                onClick={handleDone}
                className="w-full px-4 py-3 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition"
              >
                Done
              </button>
            </div>
          ) : (
            // Form State
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Display */}
              {status.type === "error" && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800">{status.message}</p>
                </div>
              )}

              {/* Community Information Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Community Information
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Community Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., BioFarm Uganda"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={status.type === "loading"}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL Slug *
                  </label>
                  <input
                    type="text"
                    name="slug"
                    value={formData.slug}
                    onChange={handleInputChange}
                    placeholder="e.g., biofarm-ug"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={status.type === "loading"}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Used in join links: /join/{formData.slug}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Community Logo
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    disabled={status.type === "loading"}
                  />
                  {formData.logoPreview && (
                    <img
                      src={formData.logoPreview}
                      alt="Logo Preview"
                      className="mt-3 w-24 h-24 object-cover rounded-lg border border-gray-200"
                    />
                  )}
                </div>
              </div>

              {/* Monetisation Settings Section */}
              <div className="space-y-4 border-t pt-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  Monetisation Settings
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Junior Admin Free Monthly Image Quota
                  </label>
                  <input
                    type="number"
                    name="juniorAdminFreeMonthlyImageQuota"
                    value={formData.juniorAdminFreeMonthlyImageQuota}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={status.type === "loading"}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Free image posts per month for junior admin
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Junior Admin Image Price (UGX)
                  </label>
                  <input
                    type="number"
                    name="juniorAdminImagePrice"
                    value={formData.juniorAdminImagePrice}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={status.type === "loading"}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Price per image post after free quota
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Member Image Message Price (UGX)
                  </label>
                  <input
                    type="number"
                    name="memberImageMessagePrice"
                    value={formData.memberImageMessagePrice}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={status.type === "loading"}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Price per image in member messages
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={status.type === "loading"}
                className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                {status.type === "loading"
                  ? "Creating Community & Generating QR..."
                  : "Create Community & Generate QR"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
    </RoleGuard>
  );
}
