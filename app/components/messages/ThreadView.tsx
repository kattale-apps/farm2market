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
        height: "min(500px, 70vh)",
        border: "1px solid #ddd",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "1rem",
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
          padding: "1rem",
          background: "#fafafa",
        }}
      >
        {thread === undefined ? (
          <p style={{ textAlign: "center", color: "#999" }}>Loading messages...</p>
        ) : thread.length === 0 ? (
          <p style={{ textAlign: "center", color: "#666" }}>No messages yet. Start the conversation!</p>
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
                  maxWidth: "70%",
                  padding: "0.75rem 1rem",
                  borderRadius: "12px",
                  background: msg.isFromMe ? "#4caf50" : "#fff",
                  color: msg.isFromMe ? "white" : "#333",
                  border: msg.isFromMe ? "none" : "1px solid #ddd",
                }}
              >
                <div style={{ fontSize: "0.85rem", marginBottom: "0.25rem", opacity: 0.8 }}>
                  {msg.isFromMe ? "You" : msg.fromAlias}
                </div>
                <div>{msg.message}</div>
                <div style={{ fontSize: "0.75rem", marginTop: "0.25rem", opacity: 0.7 }}>
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
          padding: "1rem",
          background: "#fff",
          borderTop: "1px solid #ddd",
          display: "flex",
          gap: "0.5rem",
        }}
      >
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Type your message..."
          disabled={loading}
          style={{
            flex: 1,
            padding: "0.75rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "1rem",
          }}
        />
        <button
          type="submit"
          disabled={loading || !messageText.trim()}
          style={{
            padding: "0.75rem 1.5rem",
            background: loading || !messageText.trim() ? "#ccc" : "#4caf50",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: loading || !messageText.trim() ? "not-allowed" : "pointer",
            fontWeight: "600",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
