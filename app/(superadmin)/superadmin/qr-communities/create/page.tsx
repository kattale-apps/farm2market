"use client";

import React, { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";

const QR_JOIN_BASE_URL = "https://www.farm2marketuganda.com";

export default function CreateQRCommunity() {
  const router = useRouter();
  const createQRCommunity = useMutation(api.communities.createQRCommunity as any);
  const [userId, setUserId] = useState<Id<"users"> | null>(null);

  // Get user ID from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("pilot_user");
      if (storedUser) {
        try {
          // Parse JSON object and extract userId
          const userObj = JSON.parse(storedUser);
          if (userObj.userId) {
            setUserId(userObj.userId as Id<"users">);
          }
        } catch {
          // If parsing fails, try using directly (backward compatibility)
          setUserId(storedUser as Id<"users">);
        }
      }
    }
  }, []);

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
    type: "idle" | "loading" | "error" | "success";
    message: string;
  }>({ type: "idle", message: "" });

  const [generatedQR, setGeneratedQR] = useState<{
    qrDataUrl: string;
    joinLink: string;
  } | null>(null);

  const toUrlSafeSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "slug"
          ? toUrlSafeSlug(value)
          : name.startsWith("juniorAdmin") || name.startsWith("member")
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

    if (!userId) {
      setStatus({
        type: "error",
        message: "Not authenticated. Please log in.",
      });
      return;
    }

    const normalizedSlug = toUrlSafeSlug(formData.slug || formData.name);

    if (!formData.name.trim() || !normalizedSlug) {
      setStatus({
        type: "error",
        message: "Community name and slug are required",
      });
      return;
    }

    setStatus({ type: "loading", message: "Creating community..." });

    try {
      await createQRCommunity({
        adminId: userId, // Pass the user ID from localStorage
        name: formData.name.trim(),
        slug: normalizedSlug,
        logoUrl: formData.logoPreview,
        juniorAdminFreeMonthlyImageQuota: formData.juniorAdminFreeMonthlyImageQuota,
        juniorAdminImagePrice: formData.juniorAdminImagePrice,
        memberImageMessagePrice: formData.memberImageMessagePrice,
      });

      // Step 2: Generate QR code (import dynamically to avoid SSR issues)
      const QRCode = (await import("qrcode")).default;
      const joinLink = `${QR_JOIN_BASE_URL}/join/community/${normalizedSlug}`;
      const qrDataUrl = await QRCode.toDataURL(joinLink, {
        width: 1024,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

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
    link.download = `${toUrlSafeSlug(formData.slug || formData.name)}-qr.png`;
    link.click();
  };

  const handleDone = () => {
    router.push("/superadmin/usage");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Navigation Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create QR Community</h1>
            <p className="text-sm text-gray-600">Create joinable communities with QR codes</p>
          </div>
          <button 
            onClick={() => router.push("/superadmin/usage")}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {status.type === "success" && generatedQR ? (
          // Success State
          <div className="space-y-6">
            <div className="p-6 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-green-900 font-bold text-lg">{status.message}</p>
            </div>

            {/* QR Code Display Card */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Your QR Code</h2>
              <div className="flex justify-center p-8 bg-gray-50 rounded-lg border border-gray-200">
                <img
                  src={generatedQR.qrDataUrl}
                  alt="Community QR Code"
                  className="w-96 h-96 border-4 border-white rounded-lg shadow-lg"
                />
              </div>
            </div>

            {/* Join Link Card */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
              <p className="text-sm font-bold text-gray-700 mb-3">Join Link:</p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={generatedQR.joinLink}
                  readOnly
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-700 font-mono text-sm"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(generatedQR.joinLink)}
                  className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
                >
                  Copy Link
                </button>
              </div>
            </div>

            {/* Download & Close Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleDownloadQR}
                className="px-6 py-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition text-lg"
              >
                ⬇ Download QR Code
              </button>
              <button
                onClick={handleDone}
                className="px-6 py-4 bg-gray-200 text-gray-900 font-bold rounded-lg hover:bg-gray-300 transition text-lg"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          // Form State
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Display */}
            {status.type === "error" && (
              <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                <p className="text-red-800 font-bold">{status.message}</p>
              </div>
            )}

            {/* Community Information Card */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Community Information</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Community Name<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., BioFarm Uganda"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={status.type === "loading"}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    URL Slug<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="slug"
                    value={formData.slug}
                    onChange={handleInputChange}
                    placeholder="e.g., biofarm-ug"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={status.type === "loading"}
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    Join link: <span className="font-mono font-bold">{QR_JOIN_BASE_URL}/join/community/{formData.slug || "slug"}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Community Logo
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-white cursor-pointer"
                      disabled={status.type === "loading"}
                    />
                    {formData.logoPreview && (
                      <img
                        src={formData.logoPreview}
                        alt="Logo Preview"
                        className="w-20 h-20 object-cover rounded-lg border-2 border-gray-300 flex-shrink-0"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Monetisation Settings Card */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Monetisation Settings</h2>

              <div className="space-y-6 bg-blue-50 p-6 rounded-lg border border-blue-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Junior Admin Free Monthly Image Quota
                    </label>
                    <input
                      type="number"
                      name="juniorAdminFreeMonthlyImageQuota"
                      value={formData.juniorAdminFreeMonthlyImageQuota}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={status.type === "loading"}
                    />
                    <p className="text-xs text-gray-600 mt-2">Free posts per month</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Junior Admin Image Post Price (UGX)
                    </label>
                    <input
                      type="number"
                      name="juniorAdminImagePrice"
                      value={formData.juniorAdminImagePrice}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={status.type === "loading"}
                    />
                    <p className="text-xs text-gray-600 mt-2">After free quota</p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Member Image Message Price (UGX)
                    </label>
                    <input
                      type="number"
                      name="memberImageMessagePrice"
                      value={formData.memberImageMessagePrice}
                      onChange={handleInputChange}
                      min="0"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={status.type === "loading"}
                    />
                    <p className="text-xs text-gray-600 mt-2">Image message fee</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={status.type === "loading"}
              className="w-full px-6 py-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-lg"
            >
              {status.type === "loading"
                ? "Creating Community & Generating QR..."
                : "✓ Create Community & Generate QR"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
