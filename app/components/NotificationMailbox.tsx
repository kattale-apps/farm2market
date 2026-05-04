"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { formatUgandaDateTime } from "../utils/timeUtils";

interface NotificationMailboxProps {
  userId: Id<"users">;
}

export function NotificationMailbox({ userId }: NotificationMailboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  
  const notificationsData = useQuery(api.notifications.getUserNotifications, {
    userId,
    unreadOnly: showUnreadOnly,
    limit: 50,
  });
  
  const markAsRead = useMutation(api.notifications.markNotificationAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllNotificationsAsRead);

  const handleMarkAsRead = async (notificationId: Id<"notifications">) => {
    try {
      await markAsRead({ userId, notificationId });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead({ userId });
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const unreadCount = notificationsData?.unreadCount || 0;
  const notifications = notificationsData?.notifications || [];

  return (
    <>
      {/* Mailbox Icon Button */}
      <div style={{ position: "relative", width: "100%", minWidth: 0 }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            position: "relative",
            padding: "0.85rem 0.7rem",
            background: unreadCount > 0 ? "#e3f2fd" : "#fff",
            border: `2px solid ${unreadCount > 0 ? "#2196f3" : "#ddd"}`,
            borderRadius: "12px",
            cursor: "pointer",
            fontSize: "1.8rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: unreadCount > 0 ? "0 4px 12px rgba(33, 150, 243, 0.3)" : "0 2px 8px rgba(0,0,0,0.15)",
            transition: "all 0.2s",
            minHeight: "64px",
            width: "100%",
            minWidth: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = unreadCount > 0 ? "#bbdefb" : "#f5f5f5";
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = unreadCount > 0 ? "#e3f2fd" : "#fff";
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = unreadCount > 0 ? "0 4px 12px rgba(33, 150, 243, 0.3)" : "0 2px 8px rgba(0,0,0,0.15)";
          }}
        >
          📬
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: "-6px",
                right: "-6px",
                background: "#d32f2f",
                color: "#fff",
                borderRadius: "50%",
                width: "28px",
                height: "28px",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                border: "3px solid #fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Mailbox Modal */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "clamp(1rem, 3vw, 1.5rem)",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
                paddingBottom: "1rem",
                borderBottom: "2px solid #e0e0e0",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "clamp(1.2rem, 4vw, 1.5rem)",
                  color: "#2c2c2c",
                  fontFamily: '"Montserrat", sans-serif',
                  fontWeight: "600",
                }}
              >
                📬 Inbox
                {unreadCount > 0 && (
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      background: "#d32f2f",
                      color: "#fff",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "12px",
                      fontSize: "0.85rem",
                      fontWeight: "600",
                    }}
                  >
                    {unreadCount} new
                  </span>
                )}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "#666",
                  padding: "0.5rem",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Filters */}
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                marginBottom: "1rem",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => setShowUnreadOnly(false)}
                style={{
                  padding: "0.5rem 1rem",
                  background: !showUnreadOnly ? "#1976d2" : "#f5f5f5",
                  color: !showUnreadOnly ? "#fff" : "#333",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                }}
              >
                All
              </button>
              <button
                onClick={() => setShowUnreadOnly(true)}
                style={{
                  padding: "0.5rem 1rem",
                  background: showUnreadOnly ? "#1976d2" : "#f5f5f5",
                  color: showUnreadOnly ? "#fff" : "#333",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                }}
              >
                Unread ({unreadCount})
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  style={{
                    padding: "0.5rem 1rem",
                    background: "#4caf50",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: "600",
                    marginLeft: "auto",
                  }}
                >
                  Mark All Read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {notifications.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "2rem",
                    color: "#999",
                    fontSize: "0.9rem",
                  }}
                >
                  {showUnreadOnly
                    ? "No unread notifications"
                    : "No notifications yet"}
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.notificationId}
                    style={{
                      padding: "1rem",
                      background: notification.read ? "#f9f9f9" : "#e3f2fd",
                      border: `2px solid ${notification.read ? "#e0e0e0" : "#2196f3"}`,
                      borderRadius: "8px",
                      cursor: notification.read ? "default" : "pointer",
                      transition: "all 0.2s",
                    }}
                    onClick={() => {
                      if (!notification.read) {
                        handleMarkAsRead(notification.notificationId);
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (!notification.read) {
                        e.currentTarget.style.transform = "translateX(4px)";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateX(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          fontSize: "clamp(0.9rem, 2.5vw, 1rem)",
                          color: "#2c2c2c",
                          fontWeight: notification.read ? "500" : "600",
                          fontFamily: '"Montserrat", sans-serif',
                        }}
                      >
                        {notification.title}
                        {!notification.read && (
                          <span
                            style={{
                              marginLeft: "0.5rem",
                              display: "inline-block",
                              width: "8px",
                              height: "8px",
                              background: "#2196f3",
                              borderRadius: "50%",
                            }}
                          />
                        )}
                      </h4>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "#666",
                          whiteSpace: "nowrap",
                          marginLeft: "0.5rem",
                        }}
                      >
                        {formatUgandaDateTime(notification.createdAt)}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
                        color: "#3d3d3d",
                        lineHeight: "1.5",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {notification.message}
                    </p>
                    {notification.utid && (
                      <div
                        style={{
                          marginTop: "0.75rem",
                          padding: "0.5rem",
                          background: "#f5f5f5",
                          borderRadius: "6px",
                          border: "1px solid #e0e0e0",
                        }}
                      >
                        <div style={{
                          fontSize: "0.9rem",
                          color: "#666",
                          fontWeight: "600",
                          marginBottom: "0.25rem",
                          fontFamily: '"Montserrat", sans-serif',
                        }}>
                          UTID:
                        </div>
                        <div style={{
                          fontSize: "1.05rem",
                          color: "#2c2c2c",
                          fontFamily: "monospace",
                          fontWeight: "700",
                          letterSpacing: "0.05em",
                        }}>
                          {notification.utid}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notificationsData && notificationsData.totalCount > 0 && (
              <div
                style={{
                  marginTop: "1rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid #e0e0e0",
                  fontSize: "0.85rem",
                  color: "#666",
                  textAlign: "center",
                }}
              >
                Showing {notifications.length} of {notificationsData.totalCount}{" "}
                notifications
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
