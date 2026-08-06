"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import QRCode from "qrcode";
import { useStoredUser } from "@/app/hooks/useStoredUser";

type CommunityFormData = {
  name: string;
  slug: string;
                    {/* Community Type */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Community Type
                      </label>
                      <select
                        value={formData.communityType}
                        onChange={(e) => setFormData((prev) => ({ ...prev, communityType: e.target.value as "farmer" | "vendor" }))}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      >
                        <option value="farmer">Farmer</option>
                        <option value="vendor">Vendor</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-2">Vendor communities will default QR signups to the vendor role.</p>
                    </div>
  organizationName: string;
  description: string;
  primaryColor: string;
  communityType: "farmer" | "vendor";
  freeImageQuotaPerMonth: number;
  imagePostPrice: number;
  messageImagePrice: number;
  assignedAdminId: string | null;
};

type CreateStatus = "idle" | "loading" | "success" | "error";

export default function CreateCommunityPage() {
  const router = useRouter();
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  const [status, setStatus] = useState<CreateStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [successCommunityId, setSuccessCommunityId] = useState<string>("");
  
  const [formData, setFormData] = useState<CommunityFormData>({
    name: "",
    slug: "",
    organizationName: "",
    description: "",
    primaryColor: "#10b981",
    communityType: "farmer",
    freeImageQuotaPerMonth: 5,
    imagePostPrice: 2000,
    messageImagePrice: 1000,
    assignedAdminId: null,
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);
  const [assignLater, setAssignLater] = useState(true);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Fetch users for admin assignment
  const users = useQuery(
    api.introspection.getAllUsers,
    userId ? { adminId: userId } : "skip"
  ) || [];
  const createCommunity = useMutation(api.communities.createCommunity);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const setMonetisationSettings = useMutation(api.monetisation.setMonetisationSettings);

  // Filter users for dropdown
  const filteredUsers = users
    ?.filter((user) => user.role === "admin" || user.adminLevel === "junior")
    .filter((user) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        (user.email?.toLowerCase().includes(searchLower) || false) ||
        (user.phoneNumber?.includes(searchQuery) || false)
      );
    })
    .slice(0, 5) || [];

  // Auto-generate slug from name
  useEffect(() => {
    if (formData.name) {
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setFormData((prev) => ({ ...prev, slug }));
    }
  }, [formData.name]);

  // Handle logo upload and color extraction
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const preview = reader.result as string;
        setLogoPreview(preview);
        // Extract primary color from image (simplified)
        extractColorFromImage(preview);
      };
      reader.readAsDataURL(file);
    }
  };

  // Simplified color extraction
  const extractColorFromImage = (imageDataUrl: string) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width > 100 ? 100 : img.width;
        canvas.height = img.height > 100 ? 100 : img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, 10, 10).data;
          // Get average color from top-left corner
          let r = 0,
            g = 0,
            b = 0;
          for (let i = 0; i < imageData.length; i += 4) {
            r += imageData[i];
            g += imageData[i + 1];
            b += imageData[i + 2];
          }
          const pixelCount = imageData.length / 4;
          r = Math.round(r / pixelCount);
          g = Math.round(g / pixelCount);
          b = Math.round(b / pixelCount);
          const hex = "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
          setFormData((prev) => ({ ...prev, primaryColor: hex }));
        }
      } catch (error) {
        console.error("Error extracting color:", error);
      }
    };
    img.src = imageDataUrl;
  };

  // Generate QR code
  useEffect(() => {
    const generateQR = async () => {
      if (formData.slug && qrCanvasRef.current) {
        try {
          const joinUrl = `${window.location.origin}/join/community/${formData.slug}`;
          const canvas = qrCanvasRef.current;
          await QRCode.toCanvas(canvas, joinUrl, {
            errorCorrectionLevel: "H",
            type: "image/png",
            quality: 0.95,
            margin: 2,
            width: 300,
            color: {
              dark: formData.primaryColor,
              light: "#ffffff",
            },
          });
          const dataUrl = canvas.toDataURL("image/png");
          setQrDataUrl(dataUrl);
        } catch (error) {
          console.error("Error generating QR:", error);
        }
      }
    };
    generateQR();
  }, [formData.slug, formData.primaryColor]);

  // Check if form is valid
  const isFormValid =
    formData.name.trim().length > 0 &&
    logoFile !== null &&
    formData.freeImageQuotaPerMonth >= 0 &&
    formData.imagePostPrice >= 0 &&
    formData.messageImagePrice >= 0;

  // Handle community creation
  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !userId) {
      setErrorMessage("Please fill in all required fields");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      // 1. Upload logo
      let logoStorageId = "";
      if (logoFile) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": logoFile.type },
          body: logoFile,
        });
        const { storageId } = await result.json();
        logoStorageId = storageId;
      }

      // 2. Create community
      const communityResult = await createCommunity({
        adminId: userId,
        name: formData.name,
        description: formData.description || undefined,
        logoPath: logoStorageId || undefined,
        isGlobal: true,
        geoLocked: false,
        communityType: formData.communityType,
        ...(formData.assignedAdminId ? { assignAdminId: formData.assignedAdminId as Id<"users"> } : {}),
      });

      // 3. Save monetisation settings
      await setMonetisationSettings({
        communityId: communityResult.communityId,
        adminId: userId,
        juniorAdminFreeMonthlyImageQuota: formData.freeImageQuotaPerMonth,
        juniorAdminImagePrice: formData.imagePostPrice,
        memberImageMessagePrice: formData.messageImagePrice,
      });

      // 4. Update community with QR metadata
      // TODO: Store QR code and primary color in community record

      setSuccessCommunityId(communityResult.communityId as string);
      setStatus("success");
    } catch (error) {
      setErrorMessage((error as Error).message || "Failed to create community");
      setStatus("error");
    }
  };

  // Success state
  if (status === "success") {
    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            {/* Success Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500 rounded-full mb-6">
                <svg
                  className="text-white w-10 h-10"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Community Created Successfully!</h1>
              <p className="text-xl text-gray-700 mb-8">{formData.name} is ready to use</p>
            </div>

            {/* QR Preview Card */}
            <div className="bg-white rounded-lg shadow-xl p-8 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Share Your QR Code</h2>
              <div className="flex flex-col md:flex-row gap-8 items-center justify-center">
                {qrDataUrl && (
                  <div className="flex flex-col items-center gap-4">
                    <div className="bg-white p-4 rounded-lg border-4 border-gray-200">
                      <img
                        src={qrDataUrl}
                        alt="Community QR Code"
                        className="w-64 h-64"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = qrDataUrl;
                        link.download = `${formData.slug}-qr.png`;
                        link.click();
                      }}
                      className="inline-flex items-center px-6 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors"
                    >
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      Download PNG
                    </button>
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Join Link</h3>
                  <div className="bg-gray-100 p-4 rounded-lg mb-4 break-all font-mono text-sm text-gray-700">
                    {`${window.location.origin}/join/community/${formData.slug}`}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/join/community/${formData.slug}`
                      );
                      alert("Link copied to clipboard!");
                    }}
                    className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => router.push(`/community-admin/${successCommunityId}/dashboard`)}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors text-center"
              >
                → Go to Community Dashboard
              </button>
              <button
                onClick={() => {
                  setStatus("idle");
                  setFormData({
                    name: "",
                    slug: "",
                    organizationName: "",
                    description: "",
                    primaryColor: "#10b981",
                    communityType: "farmer",
                    freeImageQuotaPerMonth: 5,
                    imagePostPrice: 2000,
                    messageImagePrice: 1000,
                    assignedAdminId: null,
                  });
                  setLogoFile(null);
                  setLogoPreview("");
                  setQrDataUrl("");
                }}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors text-center"
              >
                → Create Another Community
              </button>
            </div>
          </div>
        </div>
    );
  }

  // Loading state
  if (status === "loading") {
    return (
        <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-xl font-semibold text-gray-700">Creating your community...</p>
          </div>
        </div>
    );
  }

  // Main form
  return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Create Community</h1>
            <p className="text-lg text-gray-600">Set up a new community with branded QR code</p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
              {errorMessage}
            </div>
          )}

          {/* Main Content - 2 Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Form (2/3 width) */}
            <div className="lg:col-span-2">
              <form onSubmit={handleCreateCommunity} className="space-y-6">
                {/* Community Setup Section */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex items-center mb-6">
                    <svg
                      className="w-6 h-6 text-blue-600 mr-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                    </svg>
                    <h2 className="text-2xl font-bold text-gray-900">Community Setup</h2>
                  </div>

                  <div className="space-y-4">
                    {/* Community Name */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Community Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, name: e.target.value }))
                        }
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        placeholder="e.g., Kampala Farmers"
                      />
                    </div>

                    {/* Slug */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        URL Slug (auto-generated, editable)
                      </label>
                      <input
                        type="text"
                        value={formData.slug}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, slug: e.target.value }))
                        }
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
                        placeholder="kampala-farmers"
                      />
                      {formData.slug && (
                        <p className="text-sm text-gray-600 mt-2">
                          Join URL: {`${window.location.origin}/join/community/${formData.slug}`}
                        </p>
                      )}
                    </div>

                    {/* Organization Name */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Organization Name
                      </label>
                      <input
                        type="text"
                        value={formData.organizationName}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, organizationName: e.target.value }))
                        }
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        placeholder="Optional organization name"
                      />
                    </div>

                    {/* Logo Upload — Gallery or Camera */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Community Logo *
                      </label>
                      {/* Hidden file inputs */}
                      <input
                        ref={galleryInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        style={{ display: "none" }}
                      />
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleLogoUpload}
                        style={{ display: "none" }}
                      />
                      <div className="flex gap-3 items-start">
                        <div className="flex flex-col gap-2 flex-1">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => galleryInputRef.current?.click()}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors cursor-pointer"
                            >
                              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-sm font-semibold text-gray-600">Gallery</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => cameraInputRef.current?.click()}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
                            >
                              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="text-sm font-semibold text-gray-600">Camera</span>
                            </button>
                          </div>
                          {logoFile && (
                            <p className="text-sm text-green-600">✓ {logoFile.name}</p>
                          )}
                          {!logoFile && (
                            <p className="text-xs text-gray-400">Pick from gallery or take a photo</p>
                          )}
                        </div>
                        {logoPreview ? (
                          <div className="w-20 h-20 bg-gray-100 rounded-lg p-1 flex items-center justify-center flex-shrink-0 border-2 border-green-400">
                            <img
                              src={logoPreview}
                              alt="Logo preview"
                              className="max-w-full max-h-full object-contain rounded"
                            />
                          </div>
                        ) : (
                          <div className="w-20 h-20 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 border-2 border-dashed border-gray-200">
                            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Primary Color */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Primary Color (auto-extracted, editable)
                      </label>
                      <div className="flex gap-4 items-center">
                        <input
                          type="color"
                          value={formData.primaryColor}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))
                          }
                          className="w-16 h-10 rounded-lg cursor-pointer"
                        />
                        <input
                          type="text"
                          value={formData.primaryColor}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))
                          }
                          className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, description: e.target.value }))
                        }
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        rows={3}
                        placeholder="Optional community description"
                      />
                    </div>
                  </div>
                </div>

                {/* Monetisation Settings Section */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex items-center mb-6">
                    <svg
                      className="w-6 h-6 text-green-600 mr-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M8.16 2.75a.75.75 0 00-1.32 0l-.5 1.5A2.25 2.25 0 004.25 7.5h-1.5a.75.75 0 000 1.5h1.5a2.25 2.25 0 002.09 2.25v2.25h-2.5a.75.75 0 000 1.5h2.5v2.25a2.25 2.25 0 00-2.09 2.25h-1.5a.75.75 0 000 1.5h1.5a2.25 2.25 0 002.09 2.25l.5 1.5a.75.75 0 001.32 0l.5-1.5a2.25 2.25 0 002.09-2.25h1.5a.75.75 0 000-1.5h-1.5a2.25 2.25 0 00-2.09-2.25v-2.25h2.5a.75.75 0 000-1.5h-2.5V7.5a2.25 2.25 0 002.09-2.25h1.5a.75.75 0 000-1.5h-1.5a2.25 2.25 0 00-2.09-2.25l-.5-1.5z" />
                    </svg>
                    <h2 className="text-2xl font-bold text-gray-900">Community Pricing Controls</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Free Monthly Quota */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Free Image Posts per Month *
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={formData.freeImageQuotaPerMonth}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            freeImageQuotaPerMonth: parseInt(e.target.value) || 0,
                          }))
                        }
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Image Post Price */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Image Post Price (UGX) *
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={formData.imagePostPrice}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            imagePostPrice: parseInt(e.target.value) || 0,
                          }))
                        }
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Message Image Price */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Member Message Image Price (UGX) *
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={formData.messageImagePrice}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            messageImagePrice: parseInt(e.target.value) || 0,
                          }))
                        }
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Admin Assignment Section */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex items-center mb-6">
                    <svg
                      className="w-6 h-6 text-purple-600 mr-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                    </svg>
                    <h2 className="text-2xl font-bold text-gray-900">Community Admin Assignment</h2>
                  </div>

                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="assignLater"
                      checked={assignLater}
                      onChange={(e) => setAssignLater(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="assignLater" className="ml-3 text-gray-700">
                      Assign admin later
                    </label>
                  </div>

                  {!assignLater && (
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search by email or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setShowAdminDropdown(true)}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                      {showAdminDropdown && filteredUsers.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white border-2 border-gray-300 rounded-lg mt-2 z-10 shadow-lg">
                          {filteredUsers.map((user) => (
                            <button
                              key={user.userId}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  assignedAdminId: user.userId,
                                }));
                                setSearchQuery(user.email || user.phoneNumber || "");
                                setShowAdminDropdown(false);
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-b-0"
                            >
                              <div className="font-semibold text-gray-900">
                                {user.email || user.phoneNumber}
                              </div>
                              <div className="text-sm text-gray-600">
                                {user.adminLevel === "junior" ? "Junior Admin" : "Admin"}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {formData.assignedAdminId && (
                        <p className="text-sm text-green-600 mt-2">✓ Admin selected</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Access Type Section */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex items-center mb-6">
                    <svg
                      className="w-6 h-6 text-orange-600 mr-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <h2 className="text-2xl font-bold text-gray-900">Access Type</h2>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center p-4 border-2 border-blue-500 rounded-lg cursor-pointer bg-blue-50">
                      <input
                        type="radio"
                        name="accessType"
                        checked={true}
                        readOnly
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="ml-3">
                        <span className="font-semibold text-gray-900">Open Community (QR only)</span>
                        <p className="text-sm text-gray-600">Anyone with QR can join</p>
                      </span>
                    </label>
                    <div className="p-4 border-2 border-gray-300 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="accessType"
                          disabled
                          className="w-4 h-4 text-gray-400"
                        />
                        <span className="ml-3">
                          <span className="font-semibold text-gray-600">Private (approval required)</span>
                          <p className="text-sm text-gray-500">Coming soon</p>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Create Button */}
                <div className="md:hidden sticky bottom-4">
                  <button
                    type="submit"
                    disabled={!isFormValid}
                    className={`w-full px-6 py-4 font-bold text-lg rounded-lg transition-all ${
                      isFormValid
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:scale-105"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    Create Community
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column - QR Preview (1/3 width) */}
            <div>
              <div className="sticky top-4 bg-white rounded-lg shadow-xl p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">QR Preview</h3>

                {qrDataUrl ? (
                  <div className="space-y-4">
                    <div className="bg-gray-100 p-4 rounded-lg flex items-center justify-center">
                      <canvas
                        ref={qrCanvasRef}
                        className="max-w-full h-auto"
                        style={{ display: "none" }}
                      />
                      <img
                        src={qrDataUrl}
                        alt="QR Code Preview"
                        className="w-full max-w-xs"
                      />
                    </div>

                    <button
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = qrDataUrl;
                        link.download = `${formData.slug || "community"}-qr.png`;
                        link.click();
                      }}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center"
                    >
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      Download PNG
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (qrCanvasRef.current) {
                          const canvas = qrCanvasRef.current;
                          const joinUrl = `${window.location.origin}/join/community/${formData.slug}`;
                          QRCode.toCanvas(canvas, joinUrl, {
                            errorCorrectionLevel: "H",
                            type: "image/png",
                            quality: 0.95,
                            margin: 2,
                            width: 300,
                            color: {
                              dark: formData.primaryColor,
                              light: "#ffffff",
                            },
                          }).then(() => {
                            setQrDataUrl(canvas.toDataURL("image/png"));
                          });
                        }
                      }}
                      className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      Regenerate QR
                    </button>

                    {formData.slug && (
                      <div className="bg-gray-50 p-4 rounded-lg text-center">
                        <p className="text-xs text-gray-600 mb-2">Join URL</p>
                        <p className="text-xs font-mono text-gray-700 break-all">
                          {`${window.location.origin}/join/community/${formData.slug}`}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500 text-center">
                      Fill in community details to generate QR code
                    </p>
                  </div>
                )}

                {/* Create Button - Desktop */}
                <button
                  type="submit"
                  form="community-form"
                  disabled={!isFormValid}
                  onClick={handleCreateCommunity}
                  className={`w-full mt-6 px-6 py-4 font-bold text-lg rounded-lg transition-all hidden md:block ${
                    isFormValid
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:scale-105"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Create Community
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
