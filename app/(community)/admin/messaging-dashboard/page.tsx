"use client";

export const dynamic = "force-dynamic";

import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import CommunitySwitcher from "@/app/components/CommunitySwitcher";
import RoleGuard from "@/app/components/RoleGuard";

export default function MessagingDashboard() {
  const searchParams = useSearchParams();
  const communityIdParam = (searchParams.get("communityId") || "") as Id<"communities">;
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [caption, setCaption] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingPost, setPendingPost] = useState<{
    file: File;
    caption: string;
  } | null>(null);

  // Get user ID from localStorage (set during auth)
  useEffect(() => {
    if (typeof window !== "undefined") {
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
      setIsLoading(false);
    }
  }, []);

  // Fetch dashboard data
  const dashboardData = useQuery(
    api.monetisation.getJuniorAdminMessagingDashboard,
    userId ? { adminId: userId } : "skip"
  );

  // Mutations
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createNoticeboardPost = useMutation(api.noticeboard.createNoticeboardImagePost);
  const createPayment = useMutation(api.monetisation.createPayment);
  const confirmPayment = useMutation(api.monetisation.confirmPayment);
  const decrementQuota = useMutation(api.monetisation.decrementQuota);

  if (isLoading || !userId) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user is community admin
  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading community data...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData.community) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900 font-semibold">Access Denied</p>
          <p className="text-gray-600 mt-2">You must be a community admin to access this page.</p>
        </div>
      </div>
    );
  }

  const {
    community,
    quota,
    pricing,
    payableAmount,
    billedAmount,
    noticeboardPosts,
    communityMessages,
    quotaTrackerId,
  } = dashboardData;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePostClick = () => {
    if (!imageFile) {
      alert("Please select an image to post");
      return;
    }

    if (quota.remaining > 0) {
      // Can post for free
      handleSubmitPost();
    } else {
      // Need payment
      setPendingPost({ file: imageFile, caption });
      setShowPaymentModal(true);
    }
  };

  const handleSubmitPost = async () => {
    if (!imageFile) return;

    setIsPosting(true);
    try {
      // Upload image
      const uploadUrl = await generateUploadUrl();
      const formData = new FormData();
      formData.append("file", imageFile);

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image");
      }

      const { storageId } = await uploadResponse.json();

      // Create post (will auto-decrement quota if creating and under quota)
      const post = await createNoticeboardPost({
        communityId: (community as any)._id as Id<"communities">,
        userId: userId,
        imageStorageId: storageId as Id<"_storage">,
        caption: caption || undefined,
      });

      // If quota was used, decrement it
      if (quota.remaining > 0 && quotaTrackerId) {
        await decrementQuota({
          trackerId: quotaTrackerId,
        });
      }

      // Success
      setImageFile(null);
      setImagePreview("");
      setCaption("");
      alert("Post created successfully!");
    } catch (error) {
      console.error("Error posting:", error);
      alert(`Error: ${(error as Error).message}`);
    } finally {
      setIsPosting(false);
    }
  };

  const handlePesapalPayment = async () => {
    if (!pendingPost) return;

    try {
      // Create payment record
      const paymentId = await createPayment({
        communityId: community._id as Id<"communities">,
        userId: userId,
        paymentType: "juniorAdminImagePost",
        payableAmount: pricing.imagePostPrice,
      });

      // For demo purposes, confirm payment immediately
      // In production, integrate with Pesapal for actual payment processing
      await confirmPayment({
        paymentId: paymentId as Id<"payments">,
        billedAmount: pricing.imagePostPrice,
      });
      setShowPaymentModal(false);
      await handleSubmitPost();
    } catch (error) {
      console.error("Payment error:", error);
      alert(`Payment error: ${(error as Error).message}`);
    }
  };

  return (
    <RoleGuard
      allowedRoles={["communityAdmin"]}
      communityId={communityIdParam}
    >
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header with Community Switcher */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{(community as any)?.name || "Community"}</h1>
            <p className="text-gray-600">Community Admin Dashboard</p>
          </div>
          <CommunitySwitcher variant="dropdown" />
        </div>

        {/* Status Bar - 4 Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {/* Card 1: Free Remaining */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-blue-600">{quota.remaining}</div>
            <div className="text-sm text-gray-600 mt-1">Free Posts Remaining</div>
          </div>

          {/* Card 2: Used This Month */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-gray-700">{quota.usedThisMonth}</div>
            <div className="text-sm text-gray-600 mt-1">Posts Used</div>
          </div>

          {/* Card 3: Payable Amount */}
          <div className={`rounded-lg shadow p-4 ${payableAmount > 0 ? "bg-yellow-50" : "bg-white"}`}>
            <div className={`text-3xl font-bold ${payableAmount > 0 ? "text-yellow-600" : "text-gray-700"}`}>
              UGX {payableAmount.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600 mt-1">Amount to Pay</div>
          </div>

          {/* Card 4: Billed Amount */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-green-600">UGX {billedAmount.toLocaleString()}</div>
            <div className="text-sm text-gray-600 mt-1">Already Billed</div>
          </div>
        </div>

        {/* Noticeboard Post Creator */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Create Noticeboard Post</h2>

          {/* Image Upload Box */}
          <div className="mb-4">
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full max-h-96 object-cover rounded-lg"
                />
                <button
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview("");
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition"
              >
                <div className="text-4xl mb-2">📸</div>
                <p className="text-gray-600">Click to upload an image</p>
                <p className="text-xs text-gray-500 mt-2">PNG, JPG, GIF up to 10MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>

          {/* Caption Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Caption (optional)</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption to your post..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          {/* Quota Status Message */}
          {quota.remaining === 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
              <p className="text-red-800 font-medium">⚠️ Free quota exhausted</p>
              <p className="text-red-700 text-sm">
                You can still post, but each additional post will cost UGX {pricing.imagePostPrice.toLocaleString()}
              </p>
            </div>
          )}

          {/* Post Button */}
          <button
            onClick={handlePostClick}
            disabled={!imageFile || isPosting}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition"
          >
            {isPosting ? "Posting..." : `${quota.remaining > 0 ? "Post for Free" : "Continue to Payment"}`}
          </button>
        </div>

        {/* Community Conversation Thread */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">Community Conversation</h2>

          {noticeboardPosts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">You have not posted any noticeboard updates yet.</p>
              <p className="text-gray-500 text-sm mt-2">Create your first post above to get started!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {noticeboardPosts.map((post) => (
                <div key={post._id} className="border-b pb-6 last:border-b-0">
                  {/* Noticeboard Post */}
                  <div className="mb-4">
                    <div className="text-sm text-gray-500 mb-2">Your post • {new Date(post.createdAt).toLocaleDateString()}</div>
                    {post.imageStorageId && (
                      <div className="mb-3 bg-gray-100 rounded-lg overflow-hidden max-h-64">
                        {/* Image would be rendered here with proper URL */}
                        <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-500">Image</span>
                        </div>
                      </div>
                    )}
                    {post.caption && <p className="text-gray-800">{post.caption}</p>}
                  </div>

                  {/* Replies Section */}
                  <div className="ml-4 border-l-2 border-gray-200 pl-4">
                    <p className="text-xs text-gray-500 mb-3">Replies from members</p>

                    {/* Filter messages for this post */}
                    {communityMessages
                      .filter((msg) => msg.replyToPostId === post._id)
                      .slice(0, 3)
                      .map((reply) => (
                        <div key={reply._id} className="mb-3 pb-3 border-b border-gray-100 last:border-b-0">
                          <div className="flex justify-between items-start">
                            <div className="text-xs font-semibold text-gray-700">Member</div>
                            <div className="text-xs text-gray-500">{new Date(reply.createdAt).toLocaleDateString()}</div>
                          </div>
                          <p className="text-sm text-gray-800 mt-1">{reply.text}</p>
                          {reply.imageStorageId && (
                            <div className="mt-2 bg-gray-100 rounded h-20 w-20 flex items-center justify-center text-xs text-gray-500">
                              Image
                            </div>
                          )}
                        </div>
                      ))}

                    {communityMessages.filter((msg) => msg.replyToPostId === post._id).length === 0 && (
                      <p className="text-xs text-gray-500 italic">No replies yet</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
          <div className="bg-white rounded-t-lg w-full p-6 max-w-md mx-auto">
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Payment Required</h3>
              <p className="text-gray-600 mb-4">
                You have exhausted your free monthly quota. Pay UGX {pricing.imagePostPrice.toLocaleString()} to post this image.
              </p>

              <div className="bg-blue-50 rounded p-4 mb-6">
                <div className="text-2xl font-bold text-blue-600">UGX {pricing.imagePostPrice.toLocaleString()}</div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handlePesapalPayment}
                  disabled={isPosting}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition"
                >
                  {isPosting ? "Processing..." : "Pay with Pesapal"}
                </button>

                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </RoleGuard>
  );
}
