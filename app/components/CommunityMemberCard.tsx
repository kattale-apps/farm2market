"use client";

import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface CommunityMemberCardProps {
  member: {
    _id: Id<"communityImportedMembers">;
    fullName: string;
    phoneNumber: string;
    email: string;
    communityRole?: string;
    status: "IMPORTED" | "PENDING_ACTIVATION" | "ACTIVATED";
    accountUserId?: Id<"users">;
    notes?: string;
    additionalData?: Record<string, any>;
  };
  adminId: Id<"users">;
  onActivationComplete?: () => void;
}

/**
 * Card component for displaying imported or activated community members
 * Shows member details and activation controls for imported members
 */
export function CommunityMemberCard({
  member,
  adminId,
  onActivationComplete,
}: CommunityMemberCardProps) {
  const [isActivating, setIsActivating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const activateMember = useMutation(api.communityImports.activateImportedCommunityMember);

  const handleActivate = async () => {
    setIsActivating(true);
    setMessage(null);
    try {
      await activateMember({
        adminId,
        importedMemberId: member._id,
      });
      setMessage({
        type: "success",
        text: `Account created for ${member.fullName}. They can now log in with their phone number.`,
      });
      if (onActivationComplete) {
        onActivationComplete();
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.message || "Failed to activate member",
      });
    } finally {
      setIsActivating(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    padding: "1rem",
    background: member.status === "ACTIVATED" ? "#e8f5e9" : "#fff",
    borderRadius: "8px",
    border: `2px solid ${member.status === "ACTIVATED" ? "#2e7d32" : "#ddd"}`,
    marginBottom: "0.75rem",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "0.5rem",
    flexWrap: "wrap",
    gap: "0.5rem",
  };

  const nameStyle: React.CSSProperties = {
    fontSize: "1rem",
    fontWeight: 600,
    color: "#1a1a1a",
    margin: 0,
  };

  const statusBadgeStyle: React.CSSProperties = {
    display: "inline-block",
    padding: "0.25rem 0.6rem",
    borderRadius: "12px",
    fontSize: "0.75rem",
    fontWeight: 600,
    background:
      member.status === "ACTIVATED" ? "#2e7d32" : member.status === "PENDING_ACTIVATION" ? "#1976d2" : "#ff9800",
    color: "#fff",
  };

  const statusLabel =
    member.status === "ACTIVATED"
      ? "✓ Activated"
      : member.status === "PENDING_ACTIVATION"
      ? "Pending Activation"
      : "Imported";

  const detailsStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "0.75rem",
    marginBottom: "0.75rem",
    fontSize: "0.9rem",
  };

  const detailRowStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    color: "#888",
    fontWeight: 600,
    textTransform: "uppercase",
  };

  const valueStyle: React.CSSProperties = {
    color: "#2c2c2c",
    wordBreak: "break-word",
  };

  const additionalFields = member.additionalData
    ? Object.entries(member.additionalData)
        .filter(([, value]) => value !== null && value !== undefined && value !== "")
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    : [];

  const messageStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem",
    borderRadius: "6px",
    marginBottom: "0.5rem",
    fontSize: "0.85rem",
    background: message?.type === "success" ? "#e8f5e9" : "#ffebee",
    color: message?.type === "success" ? "#2e7d32" : "#c62828",
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <h3 style={nameStyle}>{member.fullName}</h3>
        <span style={statusBadgeStyle}>{statusLabel}</span>
      </div>

      {message && <div style={messageStyle}>{message.text}</div>}

      <div style={detailsStyle}>
        <div style={detailRowStyle}>
          <span style={labelStyle}>Phone</span>
          <span style={valueStyle}>{member.phoneNumber}</span>
        </div>

        <div style={detailRowStyle}>
          <span style={labelStyle}>Email</span>
          <span style={valueStyle}>{member.email}</span>
        </div>

        {member.communityRole && (
          <div style={detailRowStyle}>
            <span style={labelStyle}>Community Role</span>
            <span style={valueStyle}>{member.communityRole}</span>
          </div>
        )}

        {member.notes && (
          <div style={detailRowStyle}>
            <span style={labelStyle}>Notes</span>
            <span style={valueStyle}>{member.notes}</span>
          </div>
        )}

        {additionalFields.length > 0 && (
          <>
            {additionalFields.map(([key, value]) => {
              const displayKey = key
                .replace(/_/g, " ")
                .replace(/([A-Z])/g, " $1")
                .replace(/^./, (char) => char.toUpperCase())
                .trim();
              const displayValue = typeof value === "object" ? JSON.stringify(value) : String(value);
              return (
                <div key={key} style={detailRowStyle}>
                  <span style={labelStyle}>{displayKey}</span>
                  <span style={valueStyle}>{displayValue}</span>
                </div>
              );
            })}
          </>
        )}

        {member.status !== "IMPORTED" && member.accountUserId && (
          <div style={detailRowStyle}>
            <span style={labelStyle}>Account ID</span>
            <span style={valueStyle}>{String(member.accountUserId).substring(0, 12)}...</span>
          </div>
        )}
      </div>

      {member.status === "PENDING_ACTIVATION" && (
        <p style={{ fontSize: "0.8rem", color: "#1976d2", margin: 0 }}>
          Account created. Waiting for {member.fullName} to log in for the first time.
        </p>
      )}

      {member.status === "IMPORTED" && (
        <div style={{ marginTop: "0.75rem" }}>
          <button
            onClick={handleActivate}
            disabled={isActivating}
            style={{
              padding: "0.5rem 1rem",
              background: "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: isActivating ? "not-allowed" : "pointer",
              opacity: isActivating ? 0.6 : 1,
              width: "100%",
            }}
          >
            {isActivating ? "Creating Account..." : "Create Account"}
          </button>
          <p style={{ fontSize: "0.75rem", color: "#888", marginTop: "0.5rem", margin: 0 }}>
            Account will log in with phone number {member.phoneNumber} (used as both username and password).
          </p>
        </div>
      )}
    </div>
  );
}
