"use client";

export const dynamic = "force-dynamic";

import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useSearchParams } from "next/navigation";
import CommunitySwitcher from "@/app/components/CommunitySwitcher";
import RoleGuard from "@/app/components/RoleGuard";

export default function MemberMessagingFeed() {
  const searchParams = useSearchParams();
  const communityId = (searchParams.get("communityId") || "") as Id<"communities">;
  
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [messageText, setMessageText] = useState("");
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState("");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingImageMessage, setPendingImageMessage] = useState<{
    file: File;
    caption: string;
    replyToPostId?: Id<"noticeboardPosts">;
  } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Get user ID from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const uid = localStorage.getItem("pilot_user");
      const email = localStorage.getItem("pilot_email") || "member@farm2market.ug";
      if (uid) {
        setUserId(uid as Id<"users">);
        setUserEmail(email);
      }
      setIsLoading(false);
    }
  }, []);

  // Fetch messaging feed data
  const feedData = useQuery(
    api.monetisation.getMemberMessagingFeed,
    communityId && userId ? { communityId } : "skip"
  );

  // Mutations
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const sendTextMessage = useMutation(api.noticeboard.sendNoticeboardTextMessage);
  const sendImageMessage = useMutation(api.noticeboard.sendImageMessage);
  const togglePostLike = useMutation(api.noticeboard.togglePostLike);
  const togglePostDislike = useMutation(api.noticeboard.togglePostDislike);
  const createPayment = useMutation(api.monetisation.createPayment);
  const confirmPayment = useMutation(api.monetisation.confirmPayment);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [feedData?.replies]);

  if (isLoading || !userId || !communityId) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!feedData) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading feed...</p>
        </div>
      </div>
    );
  }

  const { community, noticeboardPosts, replies, messageImagePrice, postInteractions } = feedData;

  if (!community) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900 font-semibold">Community Not Found</p>
          <p className="text-gray-600 mt-2">The community you are looking for does not exist.</p>
        </div>
      </div>
    );
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendText = async () => {
    if (!messageText.trim()) return;

    setIsSending(true);
    try {
      await sendTextMessage({
        communityId: communityId,
        text: messageText.trim(),
      });
      setMessageText("");
    } catch (error) {
      console.error("Error sending message:", error);
      alert(`Error: ${(error as Error).message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleImageSelected = () => {
    if (!selectedImageFile) {
      alert("Please select an image");
      return;
    }

    setPendingImageMessage({
      file: selectedImageFile,
      caption: messageText,
      replyToPostId: undefined,
    });
    setShowPaymentModal(true);
  };

  const handlePaymentInitiate = async () => {
    if (!pendingImageMessage) return;

    try {
      // Create payment
      const paymentId = await createPayment({
        communityId: communityId,
        userId: userId,
        paymentType: "memberImageMessage",
        payableAmount: messageImagePrice,
      });

      // For demo purposes, confirm payment immediately
      // In production, integrate with Pesapal for actual payment processing
      await confirmPayment({
        paymentId: paymentId as Id<"payments">,
        billedAmount: messageImagePrice,
      });

      // Upload image
      const uploadUrl = await generateUploadUrl();
      const formData = new FormData();
      formData.append("file", pendingImageMessage.file);

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image");
      }

      const { storageId } = await uploadResponse.json();

      // Send image message
      await sendImageMessage({
        communityId: communityId,
        imageStorageId: storageId as Id<"_storage">,
        caption: pendingImageMessage.caption || undefined,
        paymentId: paymentId as Id<"payments">,
      });

      setShowPaymentModal(false);
      setSelectedImageFile(null);
      setSelectedImagePreview("");
      setMessageText("");
      setPendingImageMessage(null);
    } catch (error) {
      console.error("Payment error:", error);
      alert(`Payment error: ${(error as Error).message}`);
    }
  };

  const handleToggleLike = async (postId: Id<"noticeboardPosts">) => {
    try {
      await togglePostLike({
        postId,
        communityId,
      });
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleToggleDislike = async (postId: Id<"noticeboardPosts">) => {
    try {
      await togglePostDislike({
        postId,
        communityId,
      });
    } catch (error) {
      console.error("Error toggling dislike:", error);
    }
  };

  const getRepliesForPost = (postId: Id<"noticeboardPosts">) => {
    return replies.filter((r) => r.replyToPostId === postId).sort((a, b) => a.createdAt - b.createdAt);
  };

  return (
    <RoleGuard
      allowedRoles={["member", "communityAdmin"]}
      communityId={communityId}
    >
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-32">
        {/* Header with Community Switcher */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-40 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{community.name}</h1>
            <p className="text-xs text-gray-500">Community Messaging</p>
        </div>
        <CommunitySwitcher variant="tabs" />
      </div>

      {/* Feed */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {noticeboardPosts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">This community has no noticeboard updates yet.</p>
          </div>
        ) : (
          noticeboardPosts.map((post) => (
            <div key={post._id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Post Header */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  {community.logoPath && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">
                      {community.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">Admin</p>
                    <p className="text-xs text-gray-500">{new Date(post.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Post Image */}
              {post.imageStorageId && (
                <div className="bg-gray-100 w-full h-64 flex items-center justify-center text-gray-500">
                  <span>Image Post</span>
                </div>
              )}

              {/* Post Caption */}
              {post.caption && <div className="px-4 py-3 text-gray-800 text-sm">{post.caption}</div>}

              {/* Like/Dislike Buttons */}
              <div className="px-4 py-2 border-t border-gray-100 flex gap-4 text-sm">
                <button
                  onClick={() => handleToggleLike(post._id)}
                  className={`flex items-center gap-2 px-3 py-1 rounded hover:bg-gray-100 transition ${
                    postInteractions[post._id]?.userLiked ? "text-blue-600 font-semibold" : "text-gray-600"
                  }`}
                >
                  👍 {postInteractions[post._id]?.likeCount || 0}
                </button>
                <button
                  onClick={() => handleToggleDislike(post._id)}
                  className={`flex items-center gap-2 px-3 py-1 rounded hover:bg-gray-100 transition ${
                    postInteractions[post._id]?.userDisliked ? "text-red-600 font-semibold" : "text-gray-600"
                  }`}
                >
                  👎 {postInteractions[post._id]?.dislikeCount || 0}
                </button>
              </div>

              {/* Replies */}
              <div className="px-4 py-3 bg-gray-50 space-y-3">
                {getRepliesForPost(post._id).length === 0 ? (
                  <p className="text-xs text-gray-500 italic text-center py-2">Be the first to reply.</p>
                ) : (
                  getRepliesForPost(post._id).map((reply) => (
                    <div key={reply._id} className="flex justify-start">
                      <div className="bg-gray-200 rounded-2xl rounded-tl px-4 py-2 max-w-xs">
                        <p className="text-xs text-gray-600 font-medium mb-1">Member</p>
                        {reply.text && <p className="text-sm text-gray-900">{reply.text}</p>}
                        {reply.imageStorageId && (
                          <div className="mt-2 bg-gray-300 rounded w-32 h-32 flex items-center justify-center text-xs text-gray-600">
                            Image
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-1">{new Date(reply.createdAt).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sticky Composer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-2xl mx-auto flex gap-2 items-end">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition flex-shrink-0"
            title="Attach image (payment required)"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />

          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type a message... (Images cost UGX)"
            className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none max-h-24 text-sm"
            rows={1}
          />

          {selectedImageFile && (
            <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0">
              <img src={selectedImagePreview} alt="Preview" className="w-full h-full object-cover" />
              <button
                onClick={() => {
                  setSelectedImageFile(null);
                  setSelectedImagePreview("");
                }}
                className="absolute inset-0 bg-black bg-opacity-50 text-white opacity-0 hover:opacity-100 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>
          )}

          <button
            onClick={selectedImageFile ? handleImageSelected : handleSendText}
            disabled={!messageText.trim() || isSending}
            className="px-4 py-3 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition flex-shrink-0"
          >
            {isSending ? "..." : selectedImageFile ? "💰" : "➤"}
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end md:items-center md:justify-center">
          <div className="bg-white rounded-t-lg md:rounded-lg w-full md:max-w-md p-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Send Image</h3>
              <p className="text-gray-600 mb-6">
                Sending an image costs UGX <span className="font-bold text-blue-600">{messageImagePrice.toLocaleString()}</span>.<br />
                Complete payment to continue.
              </p>

              <div className="bg-blue-50 rounded p-4 mb-6">
                {selectedImagePreview && (
                  <img src={selectedImagePreview} alt="Preview" className="w-full rounded max-h-48 object-cover" />
                )}
              </div>

              <div className="space-y-3">
                <button
                  onClick={handlePaymentInitiate}
                  disabled={isSending}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition"
                >
                  {isSending ? "Processing..." : "Pay with Pesapal"}
                </button>

                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPendingImageMessage(null);
                  }}
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
