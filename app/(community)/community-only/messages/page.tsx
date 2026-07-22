"use client";

export const dynamic = "force-dynamic";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import CommunityTabBar from "@/app/components/CommunityTabBar";
import { useOfflineQuery } from "@/app/hooks/useOfflineQuery";
import { useStoredUser } from "@/app/hooks/useStoredUser";

const COMMUNITY_TAB_BAR_HEIGHT = 84;

function formatMessageDayLabel(timestamp: number) {
  const messageDate = new Date(timestamp);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfMessageDay = new Date(
    messageDate.getFullYear(),
    messageDate.getMonth(),
    messageDate.getDate(),
  ).getTime();
  const diffDays = Math.round((startOfToday - startOfMessageDay) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return messageDate.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: messageDate.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

function formatMessageTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupMessagesByDay(messages: any[]) {
  const newestFirst = [...messages].sort((left, right) => right.createdAt - left.createdAt);
  const groups: Array<{ key: string; label: string; messages: any[] }> = [];

  for (const message of newestFirst) {
    const messageDate = new Date(message.createdAt);
    const key = `${messageDate.getFullYear()}-${messageDate.getMonth()}-${messageDate.getDate()}`;
    const currentGroup = groups[groups.length - 1];

    if (!currentGroup || currentGroup.key !== key) {
      groups.push({
        key,
        label: formatMessageDayLabel(message.createdAt),
        messages: [message],
      });
      continue;
    }

    currentGroup.messages.push(message);
  }

  return groups;
}

function Skeleton({ className = "" }: { className?: string } = {}) {
  return <div className={`h-4 bg-gray-200 rounded animate-pulse ${className}`} />;
}

function SkeletonMessage() {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-2 w-48 space-y-2">
        <Skeleton />
        <Skeleton />
        <Skeleton className="w-32" />
      </div>
    </div>
  );
}

function BottomSheet({ isOpen, onClose, onSelectImage }: { isOpen: boolean; onClose: () => void; onSelectImage: (file: File) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectImage(file);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-30 z-40"
        onClick={onClose}
      />
      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 animate-in slide-in-from-bottom-5">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-center">
            <div className="w-12 h-1 bg-gray-300 rounded-full" />
          </div>
        </div>

        <div className="p-4 space-y-2">
          <button
            onClick={handleImageClick}
            className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-lg transition flex items-center gap-3"
          >
            <span className="text-xl">📷</span>
            <span className="font-medium text-gray-700">Upload image</span>
          </button>

          <button
            onClick={onClose}
            className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-lg transition text-red-600 font-medium"
          >
            Cancel
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </>
  );
}

function MessageComposer({ communityId, userId, replyToMessage, onClearReply }: { communityId: Id<"communities">; userId: Id<"users"> | null; replyToMessage?: any; onClearReply: () => void }) {
  const [text, setText] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sendTextMessage = useMutation(api.messages.sendTextMessage);
  const sendTargetedMessage = useMutation(api.messages.sendTargetedCommunityMessage);

  const handleImageSelect = (file: File) => {
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreviewUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || (!text.trim() && !selectedImage)) return;

    setIsSubmitting(true);
    try {
      const messageText = selectedImage && !text.trim() ? "📷 [Image attached]" : `${text.trim()}${selectedImage ? " 📷" : ""}`;
      if (replyToMessage) {
        await sendTargetedMessage({
          communityId,
          userId,
          text: messageText,
          targetType: "individual",
          targetUserIds: [replyToMessage.userId],
          replyToPostId: replyToMessage._id,
        });
        onClearReply();
      } else {
        await sendTextMessage({
          communityId,
          userId,
          text: messageText,
          replyToPostId: undefined,
        });
      }

      setText("");
      clearImage();
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="rounded-2xl border border-emerald-100 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.12)]"
      style={{ zIndex: 2 }}
    >
      {/* Image Preview Section */}
      {selectedImage && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-end gap-3">
            {imagePreviewUrl && (
              <div className="relative">
                <img
                  src={imagePreviewUrl}
                  alt="Preview"
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 transition"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">{selectedImage.name}</p>
              <p className="text-xs text-orange-600 font-medium mt-1">Image messages are billable.</p>
            </div>
          </div>
        </div>
      )}

      {/* Composer Section */}
      <form onSubmit={handleSubmit} className="p-3 pb-4">
        {replyToMessage && (
          <div className="mb-2 p-2 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-800 flex items-center justify-between">
            <div>
              Replying to <strong>{replyToMessage.userAlias || replyToMessage.userId}</strong>: {String(replyToMessage.text || '').slice(0, 60)}
            </div>
            <button type="button" onClick={onClearReply} className="text-blue-600 font-semibold underline">Cancel</button>
          </div>
        )}
        {/* Free Text Label */}
        <p style={{ fontSize: "0.75rem", color: "#666", fontWeight: 600, marginBottom: 6, fontFamily: '"Montserrat", sans-serif' }}>
          Text messages are free
        </p>

        {/* Input Row */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your message..."
            rows={2}
            style={{
              flex: 1,
              padding: "12px 16px",
              border: "2px solid #ccc",
              borderRadius: 16,
              fontSize: "1rem",
              fontFamily: '"Montserrat", sans-serif',
              resize: "none",
              minHeight: 56,
              maxHeight: 120,
              outline: "none",
              background: isSubmitting ? "#f5f5f5" : "#fff",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#2e7d32")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#ccc")}
            disabled={isSubmitting}
          />

          {/* Camera / Attach Button */}
          <label
            style={{
              width: 48,
              height: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #ff9800, #f57c00)",
              borderRadius: "50%",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.5 : 1,
              flexShrink: 0,
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            }}
          >
            <span style={{ fontSize: "1.3rem" }}>📷</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageSelect(file);
                e.target.value = "";
              }}
              disabled={isSubmitting}
              style={{ display: "none" }}
            />
          </label>

          {/* Send Button */}
          <button
            type="submit"
            disabled={isSubmitting || (!text.trim() && !selectedImage)}
            style={{
              width: 48,
              height: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isSubmitting || (!text.trim() && !selectedImage)
                ? "#ccc"
                : "linear-gradient(135deg, #43a047, #2e7d32)",
              color: "#fff",
              borderRadius: "50%",
              border: "none",
              cursor: isSubmitting || (!text.trim() && !selectedImage) ? "not-allowed" : "pointer",
              flexShrink: 0,
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              fontSize: "1.3rem",
            }}
          >
            {isSubmitting ? "⏳" : "➤"}
          </button>
        </div>
      </form>
    </div>
  );
}

function MessagesList({ communityId, userId, onReply }: { communityId: Id<"communities">; userId: Id<"users"> | null; onReply: (message: any) => void }) {
  const messages = useOfflineQuery(api.messages.getCommunityMessages, {
    communityId,
    userId: userId || undefined,
  }) as any[] | undefined;

  // Optimistic state for engagement
  const [engagementState, setEngagementState] = useState<
    Record<string, { liked: boolean; disliked: boolean; likeCount: number; dislikeCount: number }>
  >({});
  const [animatingId, setAnimatingId] = useState<string | null>(null);

  const likePostMutation = useMutation(api.messages.likeNoticeboardPost);
  const unlikePostMutation = useMutation(api.messages.unlikeNoticeboardPost);
  const dislikePostMutation = useMutation(api.messages.dislikeNoticeboardPost);
  const undislikePostMutation = useMutation(api.messages.undislikeNoticeboardPost);
  const groupedMessages = messages ? groupMessagesByDay(messages) : [];

  const handleLikeClick = async (messageId: string) => {
    if (!userId) return;

    setAnimatingId(messageId);
    setTimeout(() => setAnimatingId(null), 200);

    const currentState = engagementState[messageId] || { liked: false, disliked: false, likeCount: 0, dislikeCount: 0 };
    const isCurrentlyLiked = currentState.liked;

    // Optimistic update
    setEngagementState((prev) => ({
      ...prev,
      [messageId]: {
        ...currentState,
        liked: !isCurrentlyLiked,
        likeCount: isCurrentlyLiked ? currentState.likeCount - 1 : currentState.likeCount + 1,
      },
    }));

    try {
      if (isCurrentlyLiked) {
        await unlikePostMutation({
          communityId,
          postId: messageId as Id<"noticeboardPosts">,
          userId,
        });
      } else {
        await likePostMutation({
          communityId,
          postId: messageId as Id<"noticeboardPosts">,
          userId,
        });
      }
    } catch (error) {
      // Revert on error
      setEngagementState((prev) => ({
        ...prev,
        [messageId]: currentState,
      }));
      console.error("Failed to toggle like:", error);
    }
  };

  const handleDislikeClick = async (messageId: string) => {
    if (!userId) return;

    setAnimatingId(messageId);
    setTimeout(() => setAnimatingId(null), 200);

    const currentState = engagementState[messageId] || { liked: false, disliked: false, likeCount: 0, dislikeCount: 0 };
    const isCurrentlyDisliked = currentState.disliked;

    // Optimistic update
    setEngagementState((prev) => ({
      ...prev,
      [messageId]: {
        ...currentState,
        disliked: !isCurrentlyDisliked,
        dislikeCount: isCurrentlyDisliked ? currentState.dislikeCount - 1 : currentState.dislikeCount + 1,
      },
    }));

    try {
      if (isCurrentlyDisliked) {
        await undislikePostMutation({
          communityId,
          postId: messageId as Id<"noticeboardPosts">,
          userId,
        });
      } else {
        await dislikePostMutation({
          communityId,
          postId: messageId as Id<"noticeboardPosts">,
          userId,
        });
      }
    } catch (error) {
      // Revert on error
      setEngagementState((prev) => ({
        ...prev,
        [messageId]: currentState,
      }));
      console.error("Failed to toggle dislike:", error);
    }
  };

  if (!messages) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <SkeletonMessage key={i} />
        ))}
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div style={{
        textAlign: "center", padding: "2rem", margin: "1rem",
        background: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        color: "#666", fontFamily: '"Montserrat", sans-serif',
      }}>
        <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>💬</p>
        <p style={{ fontSize: "clamp(1rem, 3vw, 1.1rem)", fontWeight: 600 }}>No messages yet</p>
        <p style={{ fontSize: "clamp(0.85rem, 2.5vw, 0.95rem)", color: "#999" }}>Start the conversation!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedMessages.map((group) => (
        <section key={group.key} className="space-y-3">
          <div className="sticky top-0 z-10 flex justify-center py-1">
            <span
              className="rounded-full border border-emerald-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800"
              style={{ background: "rgba(240, 253, 244, 0.95)", backdropFilter: "blur(8px)" }}
            >
              {group.label}
            </span>
          </div>

          <div className="space-y-4">
            {group.messages.map((message) => {
              const engagement = engagementState[message._id] || { liked: false, disliked: false, likeCount: 0, dislikeCount: 0 };
              const isAnimating = animatingId === message._id;

              return (
                <article key={message._id} className="flex justify-start">
                  <div className="w-full max-w-sm space-y-2">
                    <div
                      className="rounded-[22px] rounded-tl-md border border-slate-200 px-4 py-3 break-words"
                      style={{
                        background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          From {message.userAlias || message.userId || "Unknown"}
                        </p>
                        <span className="text-[11px] text-slate-400">
                          {formatMessageTimestamp(message.createdAt)}
                        </span>
                      </div>

                      {message.text && (
                        <p className="text-sm leading-6 text-slate-800">{message.text}</p>
                      )}

                      {message.imageStorageId && (
                        <div className="mt-3 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                          📸 Image attached
                        </div>
                      )}

                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                        <span className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                          {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <button
                          onClick={() => onReply(message)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                          style={{ background: "transparent", border: "none", padding: 0 }}
                        >
                          ↩ Reply
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 px-1">
                      <button
                        onClick={() => handleLikeClick(message._id)}
                        className={`flex items-center gap-1 px-3 py-2 rounded-full transition-all min-h-[44px] ${
                          isAnimating ? "scale-90" : "scale-100"
                        } ${
                          engagement.liked
                            ? "bg-blue-100 text-blue-600"
                            : "text-gray-500 hover:bg-gray-100"
                        }`}
                        style={{
                          transitionProperty: "transform",
                          transitionDuration: "150ms",
                        }}
                      >
                        <span>👍</span>
                        {engagement.likeCount > 0 && (
                          <span className="text-xs font-medium">{engagement.likeCount}</span>
                        )}
                      </button>

                      <button
                        onClick={() => handleDislikeClick(message._id)}
                        className={`flex items-center gap-1 px-3 py-2 rounded-full transition-all min-h-[44px] ${
                          isAnimating ? "scale-90" : "scale-100"
                        } ${
                          engagement.disliked
                            ? "bg-red-100 text-red-600"
                            : "text-gray-500 hover:bg-gray-100"
                        }`}
                        style={{
                          transitionProperty: "transform",
                          transitionDuration: "150ms",
                        }}
                      >
                        <span>👎</span>
                        {engagement.dislikeCount > 0 && (
                          <span className="text-xs font-medium">{engagement.dislikeCount}</span>
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function CommunityMessagingPage() {
  const searchParams = useSearchParams();
  const communityIdParam = searchParams.get("communityId") || "";

  const [communityId, setCommunityId] = useState<Id<"communities"> | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<any>(null);
  const { user, status: authStatus } = useStoredUser();
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;

  useEffect(() => {
    if (communityIdParam) {
      setCommunityId(communityIdParam as Id<"communities">);
    }
  }, [communityIdParam]);

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div style={{
          textAlign: "center", padding: "2rem", margin: "1rem",
          background: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          color: "#888", fontFamily: '"Montserrat", sans-serif',
        }}>
          <p style={{ fontSize: "clamp(0.95rem, 2.5vw, 1.05rem)" }}>Loading your session...</p>
        </div>
      </div>
    );
  }

  if (!communityId || !userId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div style={{
          textAlign: "center", padding: "2rem", margin: "1rem",
          background: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          color: "#888", fontFamily: '"Montserrat", sans-serif',
        }}>
          <p style={{ fontSize: "clamp(0.95rem, 2.5vw, 1.05rem)" }}>Loading messaging...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#f6f8f7]">
      <div style={{
        background: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)",
        padding: "1.25rem 1rem",
        color: "#fff",
      }}>
        <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700, fontFamily: '"Montserrat", sans-serif' }}>
          💬 Messages
        </h1>
      </div>

      <div className="px-4 pb-2 pt-3 bg-[#f6f8f7]">
        <MessageComposer communityId={communityId} userId={userId} replyToMessage={replyToMessage} onClearReply={() => setReplyToMessage(null)} />
      </div>

      <div
        className="flex-1 overflow-y-auto px-4 pt-2"
        style={{
          paddingBottom: `calc(${COMMUNITY_TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px) + 14px)`,
        }}
      >
        <MessagesList communityId={communityId} userId={userId} onReply={setReplyToMessage} />
      </div>

      <CommunityTabBar />
    </div>
  );
}
