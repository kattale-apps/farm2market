"use client";

import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";

export default function CreateQRCommunity() {
  const router = useRouter();
  const createQRCommunity = useMutation(api.communities.createQRCommunity as any);

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

    if (!formData.name.trim() || !formData.slug.trim()) {
      setStatus({
        type: "error",
        message: "Community name and slug are required",
      });
      return;
    }

    setStatus({ type: "loading", message: "Creating community..." });

    try {
      const community = await createQRCommunity({
        adminId: undefined as any, // Will be fetched by mutation from auth context
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-gray-900">Create QR Community</h1>
          <p className="text-lg text-gray-600 mt-3">
            Set up a new community joinable via QR code with flexible monetisation controls
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-8">
          {status.type === "success" && generatedQR ? (
            // Success State
            <div className="space-y-6">
              <div className="p-5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                <p className="text-green-900 font-semibold text-lg">{status.message}</p>
              </div>

              {/* QR Code Display */}
              <div className="text-center space-y-6">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">Your QR Code</h2>
                  <div className="flex justify-center p-8 bg-gray-50 rounded-lg border-2 border-gray-200">
                    <img
                      src={generatedQR.qrDataUrl}
                      alt="Community QR Code"
                      className="w-80 h-80 border-4 border-white rounded-lg shadow-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Join Link */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-3">Join Link:</p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={generatedQR.joinLink}
                    readOnly
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-700 font-mono text-sm"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(generatedQR.joinLink)}
                    className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition min-h-[44px] flex items-center whitespace-nowrap"
                  >
                    Copy Link
                  </button>
                </div>
              </div>

              {/* Download Button */}
              <button
                onClick={handleDownloadQR}
                className="w-full px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition min-h-[44px] text-lg"
              >
                ⬇ Download QR Code (PNG)
              </button>

              {/* Done Button */}
              <button
                onClick={handleDone}
                className="w-full px-4 py-3 bg-gray-100 text-gray-900 font-semibold rounded-lg hover:bg-gray-200 transition min-h-[44px] text-lg"
              >
                Back to Dashboard
              </button>
            </div>
          ) : (
            // Form State
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Error Display */}
              {status.type === "error" && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                  <p className="text-red-800 font-semibold">{status.message}</p>
                </div>
              )}

              {/* Community Information Section */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Community Information</h2>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Community Name<span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="e.g., BioFarm Uganda"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                        disabled={status.type === "loading"}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        URL Slug<span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="slug"
                        value={formData.slug}
                        onChange={handleInputChange}
                        placeholder="e.g., biofarm-ug"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                        disabled={status.type === "loading"}
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Join link will be: <span className="font-mono text-gray-700">/join/{formData.slug}</span>
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Community Logo (Optional)
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg"
                          disabled={status.type === "loading"}
                        />
                        {formData.logoPreview && (
                          <img
                            src={formData.logoPreview}
                            alt="Logo Preview"
                            className="w-16 h-16 object-cover rounded-lg border-2 border-gray-300 flex-shrink-0"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monetisation Settings Section */}
              <div className="space-y-6 border-t-2 pt-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Monetisation Settings</h2>

                  <div className="space-y-5 bg-blue-50 p-6 rounded-lg border border-blue-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Junior Admin Free Monthly Image Quota
                        </label>
                        <input
                          type="number"
                          name="juniorAdminFreeMonthlyImageQuota"
                          value={formData.juniorAdminFreeMonthlyImageQuota}
                          onChange={handleInputChange}
                          min="0"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                          disabled={status.type === "loading"}
                        />
                        <p className="text-xs text-gray-600 mt-2">
                          Free posts per month for junior admin
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Junior Admin Image Post Price (UGX)
                        </label>
                        <input
                          type="number"
                          name="juniorAdminImagePrice"
                          value={formData.juniorAdminImagePrice}
                          onChange={handleInputChange}
                          min="0"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                          disabled={status.type === "loading"}
                        />
                        <p className="text-xs text-gray-600 mt-2">
                          Price after free quota exceeded
                        </p>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Member Image Message Price (UGX)
                        </label>
                        <input
                          type="number"
                          name="memberImageMessagePrice"
                          value={formData.memberImageMessagePrice}
                          onChange={handleInputChange}
                          min="0"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                          disabled={status.type === "loading"}
                        />
                        <p className="text-xs text-gray-600 mt-2">
                          Member messaging image fee
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={status.type === "loading"}
                className="w-full px-6 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition min-h-[44px] text-lg mt-2"
              >
                {status.type === "loading"
                  ? "Creating Community & Generating QR..."
                  : "✓ Create Community & Generate QR"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
