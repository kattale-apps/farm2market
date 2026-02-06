"use client";

import React, { useState } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface FinanceDashboardProps {
  userId: Id<"users">;
}

/* ───────────────── Styles ───────────────── */

const formStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '1rem' };
const inputStyle: React.CSSProperties = { 
  padding: '0.75rem', 
  borderRadius: '6px', 
  border: '1px solid #ccc', 
  fontSize: '1rem',
  boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem', display: 'block' };
const buttonStyle: React.CSSProperties = { 
  padding: '0.75rem 1.5rem', 
  borderRadius: '6px', border: 'none', 
  background: '#2e7d32', color: '#fff', 
  fontSize: '1rem', cursor: 'pointer', fontWeight: 600 
};

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
      <AddFundsForm adminId={userId} />
    </div>
  );
}

/* ───────────────── Sub-component for Adding Funds ───────────────── */

function AddFundsForm({ adminId }: { adminId: Id<"users"> }) {
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | "">("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const traderBalances = useQuery(api.farmcoin.getFarmcoinTraderBalances, { adminId });
  const grantTokens = useMutation(api.farmcoin.grantFarmcoinTokens);

  const allUsers = traderBalances ? [...traderBalances.traders] : [];
  allUsers.sort((a, b) => (a.alias || "").localeCompare(b.alias || ""));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !amount || !reason) {
      setStatusMessage({ type: 'error', message: 'Please fill all fields.' });
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setStatusMessage({ type: 'error', message: 'Please enter a valid positive amount.' });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const result = await grantTokens({
        adminId,
        traderId: selectedUserId,
        amount: numericAmount,
        reason,
      });
      const targetUser = allUsers.find(u => u._id === selectedUserId);
      setStatusMessage({ type: 'success', message: `Successfully granted ${numericAmount} FarmCoin Tokens to trader '${targetUser?.alias}'. New balance: ${result.traderBalance} Token(s).` });
      setSelectedUserId("");
      setAmount("");
      setReason("");
    } catch (error) {
      console.error("Failed to deposit funds:", error);
      setStatusMessage({ type: 'error', message: (error as Error).message || 'Failed to grant FarmCoin Tokens.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
      <h4 style={{ marginTop: 0, color: "#2c2c2c" }}>Add FarmCoin Tokens to User Account</h4>
      <p style={{ color: "#666", marginTop: 0, fontSize: '0.9rem' }}>
        This action grants FarmCoin Tokens to a trader or buyer account for operational use.
      </p>
      <form onSubmit={handleSubmit} style={formStyle}>
        <div>
          <label htmlFor="user-select" style={labelStyle}>Select Trader</label>
          <select
            id="user-select"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value as Id<"users">)}
            style={{ ...inputStyle, width: '100%' }}
            required
          >
            <option value="" disabled>
              {traderBalances === undefined ? "Loading traders..." : "Select a trader"}
            </option>
            {allUsers.map(user => (
              <option key={user._id} value={user._id}>
                {user.alias} (trader) - Bal: {user.farmcoinBalance} Token(s)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="amount-input" style={labelStyle}>Amount (FarmCoin Tokens)</label>
          <input
            id="amount-input"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g., 25"
            style={{ ...inputStyle, width: '100%' }}
            required
          />
        </div>

        <div>
          <label htmlFor="reason-input" style={labelStyle}>Reason for Grant</label>
          <input
            id="reason-input"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Initial FarmCoin allocation"
            style={{ ...inputStyle, width: '100%' }}
            required
          />
        </div>

        <button type="submit" style={buttonStyle} disabled={isLoading}>
          {isLoading ? 'Granting...' : 'Grant Tokens'}
        </button>
      </form>

      {statusMessage && (
        <div style={{
          padding: '1rem',
          marginTop: '1.5rem',
          borderRadius: '8px',
          border: `1px solid ${statusMessage.type === 'success' ? '#2e7d32' : '#d32f2f'}`,
          background: `${statusMessage.type === 'success' ? '#e8f5e9' : '#ffebee'}`,
          color: `${statusMessage.type === 'success' ? '#1b5e20' : '#c62828'}`
        }}>
          <strong>{statusMessage.type === 'success' ? 'Success' : 'Error'}:</strong> {statusMessage.message}
        </div>
      )}
    </div>
  );
}