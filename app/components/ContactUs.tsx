"use client";

import { useState } from "react";
import { getStoredUser } from "../utils/authStorage";

/**
 * Contact Us Component
 * 
 * Reusable contact component for dashboards
 */

interface ContactUsProps {
  isMobile?: boolean;
  onOpenInbox?: () => void;
}

export function ContactUs({ isMobile = false, onOpenInbox }: ContactUsProps) {
  const [showContact, setShowContact] = useState(false);
  const [accountLabel, setAccountLabel] = useState("");
  const handleOpenInbox = () => {
    if (onOpenInbox) {
      onOpenInbox();
      setShowContact(false);
      return;
    }
    const inboxHeading = Array.from(document.querySelectorAll("h3")).find((el) => {
      const text = el.textContent || "";
      return text.includes("Messages Inbox") || text.includes("Admin Inbox");
    });

    if (!inboxHeading) {
      const inboxButton = Array.from(document.querySelectorAll("button")).find((btn) => {
        const text = btn.textContent || "";
        return text.includes("Inbox");
      });
      inboxButton?.click();
    }

    const inboxTargets = ["message-inbox", "notification-inbox", "admin-inbox"];
    const targetId = inboxTargets.find((id) => document.getElementById(id));
    if (targetId) {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" });
      setShowContact(false);
      return;
    }

    if (inboxHeading) {
      inboxHeading.scrollIntoView({ behavior: "smooth" });
      setShowContact(false);
      return;
    }

    alert("Inbox panel not found. Please open your inbox from the dashboard.");
    setShowContact(false);
  };

  const handleShowContact = async () => {
    try {
      const stored = await getStoredUser();
      if (stored) {
        const contact = stored?.email || stored?.phoneNumber;
        const alias = stored?.alias;
        if (alias && contact) {
          setAccountLabel(`${alias} (${contact})`);
        } else if (alias) {
          setAccountLabel(alias);
        }
      }
    } catch {
      setAccountLabel("");
    }
    setShowContact(true);
  };

  if (!showContact) {
    return (
      <div style={{
        marginTop: "1rem",
        padding: "1rem",
        background: "rgba(255, 255, 255, 0.95)",
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}>
        <button
          onClick={handleShowContact}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#2e7d32",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: isMobile ? "0.9rem" : "1rem",
            fontWeight: "600",
            width: "100%",
            transition: "background 0.3s",
            fontFamily: '"Montserrat", sans-serif'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#1b5e20"}
          onMouseLeave={(e) => e.currentTarget.style.background = "#2e7d32"}
        >
          💬 Contact Us
        </button>
        <p style={{
          marginTop: "0.5rem",
          fontSize: "0.85rem",
          color: "#666",
          textAlign: "center"
        }}>
          Need help? Contact Admin in-app.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: "1rem",
      padding: "1.5rem",
      background: "rgba(255, 255, 255, 0.95)",
      borderRadius: "8px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "1rem"
      }}>
        <h3 style={{
          fontSize: isMobile ? "1.1rem" : "1.3rem",
          color: "#2e7d32",
          fontWeight: "700",
          fontFamily: '"Montserrat", sans-serif',
          margin: 0
        }}>
          Contact Us
        </h3>
        <button
          onClick={() => setShowContact(false)}
          style={{
            background: "transparent",
            border: "none",
            fontSize: "1.5rem",
            cursor: "pointer",
            color: "#666",
            padding: "0",
            width: "30px",
            height: "30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: "grid", gap: "1rem" }}>
        <p style={{ margin: 0, color: "#555", fontSize: isMobile ? "0.9rem" : "1rem" }}>
          Use the in-app inbox to contact Admin. This keeps your messages secure and UTID-linked.
        </p>
        {accountLabel && (
          <div style={{
            fontSize: isMobile ? "0.85rem" : "0.9rem",
            color: "#2c2c2c",
            background: "#f5f5f5",
            border: "1px solid #e0e0e0",
            borderRadius: "6px",
            padding: "0.5rem 0.75rem",
            fontWeight: "600",
          }}>
            Using account: {accountLabel}
          </div>
        )}
        <button
          type="button"
          onClick={handleOpenInbox}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#1976d2",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontWeight: "600",
            fontSize: isMobile ? "0.9rem" : "1rem",
            cursor: "pointer",
            transition: "background 0.3s",
            fontFamily: '"Montserrat", sans-serif'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#1565c0"}
          onMouseLeave={(e) => e.currentTarget.style.background = "#1976d2"}
        >
          Open Inbox
        </button>
      </div>
    </div>
  );
}
