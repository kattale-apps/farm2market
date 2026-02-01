"use client";

import React from 'react';
import { Id } from "../../convex/_generated/dataModel";

interface FinanceDashboardProps {
  userId: Id<"users">;
}

export function FinanceDashboard({ userId }: FinanceDashboardProps) {
  return (
    <div style={{
      marginBottom: "2rem",
      padding: "1.5rem",
      background: "#fff",
      borderRadius: "12px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      border: "1px solid #e0e0e0"
    }}>
      <h3 style={{ marginTop: 0, color: "#2c2c2c" }}>Finance Dashboard</h3>
      <p style={{ color: "#666" }}>Financial metrics and reports will appear here.</p>
    </div>
  );
}