"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect, useRef } from "react";

interface ThreadViewProps {
  userId: Id<"users">;
  utid: string;
  onClose?: () => void;
}

export function ThreadView({ userId, utid, onClose }: ThreadViewProps) {
  const thread = useQuery(api.messages.getMessageThread, { userId, utid });
  const sendMessage = useMutation(api.messages.sendMessage);
  const markAsRead = useMutation(api.messages.markMessagesAsRead);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSupportThread = utid === "SUPPORT";

  // Get SuperAdmin ID (users can only message SuperAdmin)
  const superAdmin = useQuery(api.messages.getSuperAdmin, {});

  // Mark messages as read when thread loads
  useEffect(() => {
    if (thread && thread.length > 0) {
      markAsRead({ userId, utid }).catch(console.error);
    }
  }, [thread, userId, utid, markAsRead]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !superAdmin) return;

    setLoading(true);
    try {
      await sendMessage({
        fromUserId: userId,
        toUserId: superAdmin.id,
        utid,
        message: messageText.trim(),
      });
      setMessageText("");
    } catch (error: any) {
      alert(error.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  if (!superAdmin) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>SuperAdmin not found. Cannot send messages.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "min(420px, 60vh)",
        border: "1px solid #ddd",
        borderRadius: "8px",
        overflow: "hidden",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: "clamp(0.6rem, 2.5vw, 1rem)",
          background: "#f5f5f5",
          borderBottom: "1px solid #ddd",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
            {isSupportThread ? "Support Inbox" : "Message Thread"}
          </h3>
          {isSupportThread ? (
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
              General support with SuperAdmin
            </p>
          ) : (
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
              UTID: {utid}
            </p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              padding: "0.5rem 1rem",
              background: "#f5f5f5",
              border: "1px solid #ddd",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        )}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "clamp(0.6rem, 2.5vw, 1rem)",
          background: "#fafafa",
        }}
      >
        {thread === undefined ? (
          <p style={{ textAlign: "center", color: "#999", background: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid #e0e0e0", margin: "1rem 0" }}>Loading messages...</p>
        ) : thread.length === 0 ? (
          <p style={{ textAlign: "center", color: "#666", background: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid #e0e0e0", margin: "1rem 0" }}>No messages yet. Start the conversation!</p>
        ) : (
          thread.map((msg: any) => (
            <div
              key={msg.id}
              style={{
                marginBottom: "1rem",
                display: "flex",
                justifyContent: msg.isFromMe ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "85%",
                  padding: "0.75rem 1rem",
                  borderRadius: "12px",
                  background: msg.isFromMe ? "#45a049" : "#fff",
                  color: msg.isFromMe ? "white" : "#333",
                  border: msg.isFromMe ? "1px solid #45a049" : "1px solid #e0e0e0",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  wordBreak: "break-word",
                }}
              >
                <div style={{ fontSize: "0.85rem", marginBottom: "0.25rem", opacity: 0.9, fontWeight: msg.isFromMe ? "normal" : "600" }}>
                  {msg.isFromMe ? "You" : msg.fromAlias}
                </div>
                <div style={{ fontSize: "0.95rem", lineHeight: "1.4" }}>{msg.message}</div>
                <div style={{ fontSize: "0.75rem", marginTop: "0.25rem", opacity: msg.isFromMe ? 0.8 : 0.6 }}>
                  {new Date(msg.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSend}
        style={{
          padding: "clamp(0.6rem, 2.5vw, 1rem)",
          background: "#fff",
          borderTop: "1px solid #ddd",
          display: "flex",
          gap: "0.4rem",
          alignItems: "stretch",
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
            style={{
              padding: "clamp(0.6rem, 2.5vw, 0.85rem)",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: "clamp(0.9rem, 3vw, 1rem)",
              minHeight: "clamp(2.4rem, 6vh, 3rem)",
              lineHeight: "1.4",
            }}
          />
          <div style={{ fontSize: "clamp(0.75rem, 2.6vw, 0.85rem)", color: "#777" }}>
            Press Enter to send
          </div>
        </div>
        <button
          type="submit"
          disabled={loading || !messageText.trim()}
          style={{
            padding: "clamp(0.6rem, 2.5vw, 0.85rem) clamp(1rem, 4vw, 1.25rem)",
            background: loading || !messageText.trim() ? "#ccc" : "#4caf50",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: loading || !messageText.trim() ? "not-allowed" : "pointer",
            fontWeight: "600",
            fontSize: "clamp(0.85rem, 2.8vw, 0.95rem)",
            alignSelf: "flex-start",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
