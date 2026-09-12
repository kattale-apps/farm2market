"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStoredUser } from "../hooks/useStoredUser";
import { ThreadView } from "../components/messages/ThreadView";

const FONT = '"Montserrat", sans-serif';
const SUPPORT_THREAD = "SUPPORT";

export default function MessagesPage() {
  const { user, status } = useStoredUser();
  const messageThreads = useQuery(
    api.messages.getUserMessageThreads,
    user?.userId ? { userId: user.userId as any } : "skip"
  );

  const [selectedUtid, setSelectedUtid] = useState<string | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setIsNarrow(window.innerWidth <= 720);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!selectedUtid && messageThreads && messageThreads.length > 0) {
      setSelectedUtid(messageThreads[0].utid);
    }
  }, [messageThreads, selectedUtid]);

  const activeUtid = selectedUtid || messageThreads?.[0]?.utid || SUPPORT_THREAD;

  if (status === "loading") {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>Loading messages...</div>;
  }
  if (status === "unauthenticated" || !user?.userId) {
    return <div style={{ padding: "2rem", fontFamily: FONT }}>Please log in to view your messages.</div>;
  }

  return (
    <div style={{ padding: "1rem", maxWidth: 960, margin: "0 auto", fontFamily: FONT }}>
      <div style={{ marginBottom: "1rem" }}>
        <a
          href="/"
          style={{
            display: "inline-block",
            color: "#1976d2",
            fontWeight: 700,
            fontSize: "0.85rem",
            background: "#e3f2fd",
            border: "1px solid #90caf9",
            borderRadius: 8,
            padding: "0.4rem 0.75rem",
            textDecoration: "none",
          }}
        >
          ← Back to Dashboard
        </a>
      </div>

      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#2c2c2c", marginBottom: "1rem" }}>
        Messages
      </h1>

      <div
        ref={containerRef}
        style={{
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          border: "1px solid #e0e0e0",
          padding: "clamp(1rem, 3vw, 1.5rem)",
        }}
      >
        {messageThreads === undefined ? (
          <p style={{ color: "#999" }}>Loading message threads...</p>
        ) : messageThreads.length === 0 ? (
          <div>
            <p style={{ color: "#666", marginBottom: "0.75rem" }}>
              No messages yet. Start a support conversation with SuperAdmin below.
            </p>
            <ThreadView userId={user.userId as any} utid={SUPPORT_THREAD} />
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isNarrow ? "1fr" : "minmax(220px, 1fr) 2fr",
              gap: "1rem",
              width: "100%",
              maxWidth: "100%",
              boxSizing: "border-box",
              overflowX: "hidden",
            }}
          >
            {!isNarrow && (
              <div style={{
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                overflow: "hidden",
                maxHeight: "70vh",
                overflowY: "auto",
                width: "100%",
                minWidth: 0,
              }}>
                {messageThreads.map((thread) => {
                  const isSelected = activeUtid === thread.utid;
                  const isSupport = thread.utid === SUPPORT_THREAD;
                  return (
                    <button
                      key={thread.utid}
                      onClick={() => setSelectedUtid(thread.utid)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "0.75rem",
                        border: "none",
                        borderBottom: "1px solid #e0e0e0",
                        background: isSelected ? "#e3f2fd" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: "600", color: "#2c2c2c" }}>
                        {isSupport ? "Support Inbox" : `UTID: ${thread.utid}`}
                      </div>
                      {isSupport && (
                        <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.25rem" }}>
                          General help with SuperAdmin
                        </div>
                      )}
                      {thread.unreadCount > 0 && (
                        <div style={{ marginTop: "0.35rem", fontSize: "0.75rem", color: "#d32f2f", fontWeight: "600" }}>
                          {thread.unreadCount} unread
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ width: "100%", minWidth: 0 }}>
              {isNarrow ? (
                <>
                  <select
                    value={activeUtid}
                    onChange={(e) => setSelectedUtid(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.6rem",
                      borderRadius: 8,
                      border: "1px solid #ccc",
                      marginBottom: "0.75rem",
                    }}
                  >
                    {messageThreads.map((thread) => (
                      <option key={thread.utid} value={thread.utid}>
                        {thread.utid === SUPPORT_THREAD ? "Support Inbox" : `UTID: ${thread.utid}`}
                        {thread.unreadCount > 0 ? ` (${thread.unreadCount} unread)` : ""}
                      </option>
                    ))}
                  </select>
                  <ThreadView userId={user.userId as any} utid={activeUtid} />
                </>
              ) : (
                <ThreadView userId={user.userId as any} utid={activeUtid} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
