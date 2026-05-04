"use client";

export const dynamic = "force-dynamic";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useStoredUser } from "../hooks/useStoredUser";

type RoleCategory = "farmer" | "trader" | "buyer" | "admin";

export default function LearnPage() {
  const { user, status: authStatus } = useStoredUser();
  const userRole = (user?.role as RoleCategory | undefined) ?? null;
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<Id<"tutorialVideos"> | null>(null);

  const incrementView = useMutation(api.tutorials.incrementViewCount);

  const tutorials = useQuery(
    api.tutorials.getTutorialsByRole,
    userRole ? { roleCategory: userRole } : "skip"
  );

  const handleWatch = async (videoId: string, tutorialId: Id<"tutorialVideos">) => {
    setSelectedVideo(videoId);
    setSelectedVideoId(tutorialId);
    try {
      await incrementView({ videoId: tutorialId });
    } catch {}
  };

  if (authStatus === "loading") {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "'Montserrat', sans-serif",
        background: "#f5f5f5",
      }}>
        <p style={{ color: "#999" }}>Loading your session...</p>
      </div>
    );
  }

  if (!userRole) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "'Montserrat', sans-serif",
        background: "#f5f5f5",
      }}>
        <p style={{ color: "#999" }}>Please log in to view tutorials.</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f5f5f5",
      fontFamily: "'Montserrat', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        background: "#2e7d32",
        color: "#fff",
        padding: "1.5rem 2rem",
      }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>
          📚 Learn
        </h1>
        <p style={{ margin: "0.25rem 0 0 0", opacity: 0.85, fontSize: "0.9rem" }}>
          Training videos to help you get the most out of AgroFresh
        </p>
      </div>

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "1.5rem" }}>
        {/* Video player modal */}
        {selectedVideo && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "1rem",
          }}>
            <div style={{ width: "100%", maxWidth: "720px" }}>
              <div style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: "0.5rem",
              }}>
                <button
                  onClick={() => { setSelectedVideo(null); setSelectedVideoId(null); }}
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    border: "none",
                    color: "#fff",
                    fontSize: "1.25rem",
                    padding: "0.4rem 0.8rem",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  ✕ Close
                </button>
              </div>
              <div style={{
                position: "relative",
                paddingBottom: "56.25%", /* 16:9 aspect ratio */
                height: 0,
                borderRadius: "12px",
                overflow: "hidden",
                background: "#000",
              }}>
                <iframe
                  src={`https://www.youtube.com/embed/${selectedVideo}?autoplay=1&rel=0`}
                  title="Tutorial video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    border: "none",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tutorial list */}
        {!tutorials ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#999" }}>Loading tutorials...</div>
        ) : tutorials.length === 0 ? (
          <div style={{
            padding: "3rem",
            textAlign: "center",
            color: "#999",
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid #e0e0e0",
          }}>
            <p style={{ fontSize: "2rem", margin: "0 0 0.5rem 0" }}>🎓</p>
            <p style={{ fontSize: "1rem", margin: "0 0 0.25rem 0", fontWeight: 600, color: "#555" }}>
              No tutorials available yet
            </p>
            <p style={{ fontSize: "0.85rem", margin: 0, color: "#999" }}>
              Check back soon for training videos
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {tutorials.map((video: any, idx: number) => (
              <div
                key={video._id}
                onClick={() => handleWatch(video.youtubeVideoId, video._id)}
                style={{
                  display: "flex",
                  gap: "1rem",
                  background: "#fff",
                  borderRadius: "12px",
                  padding: "0.75rem",
                  border: "1px solid #e0e0e0",
                  cursor: "pointer",
                  transition: "box-shadow 0.2s",
                  alignItems: "center",
                }}
              >
                {/* Thumbnail with play overlay */}
                <div style={{
                  width: "130px",
                  minWidth: "130px",
                  height: "73px",
                  borderRadius: "8px",
                  overflow: "hidden",
                  background: "#eee",
                  flexShrink: 0,
                  position: "relative",
                }}>
                  {video.thumbnailUrl && (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}
                  <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    background: "rgba(0,0,0,0.6)",
                    borderRadius: "50%",
                    width: "32px",
                    height: "32px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}>
                    <span style={{ color: "#fff", fontSize: "0.9rem", marginLeft: "2px" }}>▶</span>
                  </div>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{
                    margin: "0 0 0.25rem 0",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: "#333",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {video.title}
                  </h4>

                  {video.description && (
                    <p style={{
                      margin: "0 0 0.25rem 0",
                      fontSize: "0.8rem",
                      color: "#777",
                      lineHeight: 1.4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}>
                      {video.description}
                    </p>
                  )}

                  <span style={{ fontSize: "0.7rem", color: "#aaa" }}>
                    👁 {video.viewCount || 0} views
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
