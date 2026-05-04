"use client";

export const dynamic = "force-dynamic";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "@/convex/_generated/dataModel";
import CommunityTabBar from "@/app/components/CommunityTabBar";
import { useSearchParams } from "next/navigation";
import { useOfflineQuery } from "@/app/hooks/useOfflineQuery";
import { useStoredUser } from "@/app/hooks/useStoredUser";

function QuotaWidget({ communityId }: { communityId: Id<"communities"> }) {
  const quotaStatus = useOfflineQuery(api.noticeboard.getAdminNoticeboardQuotaStatus, {
    communityId,
  }) as any;

  if (!quotaStatus) {
    return (
      <div className="mobile-sticky p-3 bg-gray-100 animate-pulse">
        <div className="h-20"></div>
      </div>
    );
  }

  const percentageUsed = quotaStatus.quota > 0 ? (quotaStatus.used / quotaStatus.quota) * 100 : 0;
  const isQuotaFull = quotaStatus.remaining === 0;
  
  // Color theme based on remaining quota
  const bgColor = isQuotaFull ? "bg-orange-50" : "bg-green-50";
  const borderColor = isQuotaFull ? "border-orange-200" : "border-green-200";
  const titleColor = isQuotaFull ? "text-orange-900" : "text-green-900";
  const barColor = isQuotaFull ? "bg-orange-500" : "bg-green-500";
  const textColor = isQuotaFull ? "text-orange-700" : "text-green-700";

  return (
    <div className="mobile-sticky p-3 md:p-4 mb-6 md:mb-8">
      <div className={`rounded-lg border-2 ${borderColor} ${bgColor} shadow-sm`}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-opacity-30">
          <h3 className={`text-sm font-bold ${titleColor} uppercase tracking-wide`}>
            Monthly Free Image Posts
          </h3>
        </div>

        {/* Progress Bar */}
        <div className="px-4 py-3">
          <div className="mb-3">
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 ${barColor} transition-all duration-300`}
                style={{ width: `${Math.min(percentageUsed, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className={`text-xs font-semibold ${textColor} mb-0.5`}>Used</p>
              <p className={`text-lg font-bold ${titleColor}`}>
                {quotaStatus.used} <span className="text-xs opacity-70">of {quotaStatus.quota}</span>
              </p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-semibold ${textColor} mb-0.5`}>Remaining</p>
              <p className={`text-lg font-bold ${titleColor}`}>{quotaStatus.remaining}</p>
            </div>
          </div>

          {/* Status Message */}
          {isQuotaFull ? (
            <div className="bg-orange-100 border border-orange-300 rounded px-3 py-2">
              <p className="text-xs text-orange-900 font-medium">
                ⚠️ New image posts will be billable
              </p>
            </div>
          ) : (
            <div className="bg-green-100 border border-green-300 rounded px-3 py-2">
              <p className="text-xs text-green-900 font-medium">
                ✓ {quotaStatus.remaining} free posts remaining
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Post Card — renders one noticeboard post (image + caption + like) */
/* ------------------------------------------------------------------ */
function PostCard({
  post,
  userId,
  communityId,
}: {
  post: {
    _id: Id<"noticeboardPosts">;
    imageUrl: string | null;
    caption?: string;
    postedByAlias: string;
    likeCount: number;
    likedByUserIds: Id<"users">[];
    createdAt: number;
  };
  userId: Id<"users">;
  communityId: Id<"communities">;
}) {
  const toggleLike = useMutation(api.noticeboard.togglePostLike);
  const [busy, setBusy] = useState(false);
  const liked = (post.likedByUserIds ?? []).includes(userId);

  const handleLike = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await toggleLike({ postId: post._id, communityId, userId });
    } catch {
      /* silently ignore */
    } finally {
      setBusy(false);
    }
  };

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        marginBottom: 16,
      }}
    >
      {/* Image */}
      {post.imageUrl && (
        <img
          src={post.imageUrl}
          alt={post.caption || "Post image"}
          style={{
            width: "100%",
            maxHeight: 360,
            objectFit: "cover",
            display: "block",
          }}
        />
      )}

      {/* Body */}
      <div style={{ padding: "12px 16px" }}>
        {post.caption && (
          <p style={{ margin: "0 0 8px", fontSize: 14, color: "#222", lineHeight: 1.45 }}>
            {post.caption}
          </p>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
            color: "#888",
          }}
        >
          <span>
            Posted by <b style={{ color: "#2e7d32" }}>{post.postedByAlias}</b> · {timeAgo(post.createdAt)}
          </span>

          <button
            onClick={handleLike}
            disabled={busy}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 13,
              color: liked ? "#e53935" : "#aaa",
              padding: "4px 8px",
              borderRadius: 8,
              transition: "color 0.2s",
            }}
          >
            {liked ? "❤️" : "🤍"} {post.likeCount}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
export default function CommunityNoticeboardPage() {
  const searchParams = useSearchParams();
  const communityIdParam = searchParams.get("communityId") || "";
  const { user, status: authStatus } = useStoredUser();
  
  const [communityId, setCommunityId] = useState<Id<"communities"> | null>(null);
  const userId = (user?.userId as Id<"users"> | undefined) ?? null;
  const userRole = user?.role ?? null;

  useEffect(() => {
    if (communityIdParam) {
      setCommunityId(communityIdParam as Id<"communities">);
    }
  }, [communityIdParam]);

  // Fetch posts
  const posts = useOfflineQuery(
    api.noticeboard.getCommunityNoticeboardPosts,
    communityId ? { communityId } : "skip"
  ) as any;

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="text-center text-gray-500 p-8">
          Loading your session...
        </div>
      </div>
    );
  }

  if (!communityId || !userId) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="text-center text-gray-500 p-8">
          Loading noticeboard...
        </div>
      </div>
    );
  }

  const isAdmin = userRole === "admin" || userRole === "superadmin";

  return (
    <div className="min-h-screen bg-gray-50 pb-safe" style={{ paddingBottom: "5rem" }}>
      <div className="max-w-md mx-auto md:max-w-none md:p-8">
        <h1
          className="font-bold mb-4 px-4 md:px-0 pt-4 md:pt-0"
          style={{ fontSize: 22, color: "#2e7d32" }}
        >
          📌 Community Posts
        </h1>

        {/* Quota widget only for admins */}
        {isAdmin && <QuotaWidget communityId={communityId} />}

        {/* Posts feed */}
        <div className="px-4 md:px-0">
          {posts === undefined && (
            <div style={{ textAlign: "center", padding: "2rem", color: "#888", background: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              <p style={{ fontSize: "clamp(0.95rem, 2.5vw, 1.05rem)", fontFamily: '"Montserrat", sans-serif' }}>Loading posts...</p>
            </div>
          )}

          {posts && posts.length === 0 && (
            <div style={{
              textAlign: "center", padding: "2rem", color: "#666",
              background: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              fontFamily: '"Montserrat", sans-serif',
            }}>
              <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📌</p>
              <p style={{ fontSize: "clamp(1rem, 3vw, 1.1rem)", fontWeight: 600 }}>No posts yet</p>
              <p style={{ fontSize: "clamp(0.85rem, 2.5vw, 0.95rem)", color: "#999" }}>The community admin will share updates here.</p>
            </div>
          )}

          {posts &&
            posts.map((post: any) => (
              <PostCard
                key={post._id}
                post={post as any}
                userId={userId}
                communityId={communityId}
              />
            ))}
        </div>
      </div>

      <style>{`
        .mobile-sticky {
          position: sticky;
          top: 0;
          z-index: 10;
        }
        @media (min-width: 768px) {
          .mobile-sticky {
            position: static;
            z-index: auto;
          }
        }
      `}</style>
      <CommunityTabBar />
    </div>
  );
}
