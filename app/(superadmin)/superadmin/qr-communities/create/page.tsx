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

  const handleDownloadQR = async () => {
    if (!generatedQR) return;

    try {
      const filename = `${toUrlSafeSlug(formData.slug || formData.name)}-qr.png`;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

      const response = await fetch(generatedQR.qrDataUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (isMobile) {
        setTimeout(() => {
          window.open(url, "_blank");
        }, 500);
      }

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 2000);
    } catch {
      window.open(generatedQR.qrDataUrl, "_blank");
    }
  };

  const handleDone = () => {
    router.push("/superadmin/usage");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 overflow-x-hidden">
      {/* Navigation Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Create QR Community</h1>
            <p className="text-sm text-gray-600">Create joinable communities with QR codes</p>
          </div>
          <button 
            onClick={() => router.push("/superadmin/usage")}
            className="w-full sm:w-auto px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition text-left sm:text-center"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {status.type === "success" && generatedQR ? (
          // Success State
          <div className="space-y-4 sm:space-y-6">
            <div className="p-4 sm:p-6 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-green-900 font-bold text-base sm:text-lg break-words">{status.message}</p>
            </div>

            {/* QR Code Display Card */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 sm:p-8">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">Your QR Code</h2>
              <div className="flex justify-center p-3 sm:p-6 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                <img
                  src={generatedQR.qrDataUrl}
                  alt="Community QR Code"
                  className="w-[80vw] max-w-[280px] sm:max-w-[360px] h-auto aspect-square border-4 border-white rounded-lg shadow-lg"
                />
              </div>
              <p className="text-xs text-gray-600 mt-3 text-center">
                On mobile, tap Download and long-press the image if needed to save.
              </p>
            </div>

            {/* Join Link Card */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 sm:p-6">
              <p className="text-sm font-bold text-gray-700 mb-3">Join Link:</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={generatedQR.joinLink}
                  readOnly
                  className="w-full min-w-0 px-3 sm:px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-700 font-mono text-xs sm:text-sm"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(generatedQR.joinLink)}
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
                >
                  Copy Link
                </button>
              </div>
            </div>

            {/* Download & Close Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <button
                onClick={handleDownloadQR}
                className="w-full px-6 py-3 sm:py-4 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition text-base sm:text-lg min-h-12"
              >
                ⬇ Download QR Code
              </button>
              <button
                onClick={handleDone}
                className="w-full px-6 py-3 sm:py-4 bg-gray-200 text-gray-900 font-bold rounded-lg hover:bg-gray-300 transition text-base sm:text-lg min-h-12"
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
                <p className="text-red-800 font-bold break-words">{status.message}</p>
              </div>
            )}

            {/* Community Information Card */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 sm:p-8">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Community Information</h2>

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
                    Join link: <span className="font-mono font-bold break-all">{QR_JOIN_BASE_URL}/join/community/{formData.slug || "slug"}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Community Logo
                  </label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="w-full sm:flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-white cursor-pointer"
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
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 sm:p-8">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Monetisation Settings</h2>

              <div className="space-y-6 bg-blue-50 p-4 sm:p-6 rounded-lg border border-blue-100">
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
              className="w-full px-6 py-3 sm:py-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-base sm:text-lg min-h-12"
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
