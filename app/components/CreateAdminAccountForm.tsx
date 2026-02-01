"use client";

import React, { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface CreateAdminAccountFormProps {
  adminId: Id<"users">;
}

export function CreateAdminAccountForm({ adminId }: CreateAdminAccountFormProps) {
  const createUser = useMutation(api.auth.createUser);
  // Using the listings query to get active locations for the dropdown
  const storageLocations = useQuery(api.listings.getActiveStorageLocations, {});
  
  const [email, setEmail] = useState("");
  const [adminLevel, setAdminLevel] = useState<"super" | "junior">("junior");
  const [adminCategory, setAdminCategory] = useState<"store" | "message" | "community">("store");
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await createUser({
        email,
        role: "admin",
        adminLevel,
        adminCategory: adminLevel === "junior" ? adminCategory : undefined,
        allowedStorageLocationIds: adminLevel === "junior" && adminCategory === "store" 
          ? selectedLocationIds.map(id => id as Id<"storageLocations">) 
          : undefined,
        creatorAdminId: adminId,
      });
      setMessage({ type: "success", text: "Admin account created successfully!" });
      setEmail("");
      setSelectedLocationIds([]);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: "2rem", border: "1px solid #ccc", padding: "1rem", borderRadius: "8px", background: "#fff" }}>
      <h3>Create Admin Account</h3>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "500px" }}>
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>
        
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>Level:</label>
          <select 
            value={adminLevel} 
            onChange={(e) => setAdminLevel(e.target.value as "super" | "junior")}
            style={{ width: "100%", padding: "0.5rem" }}
          >
            <option value="junior">Junior Admin</option>
            <option value="super">Super Admin</option>
          </select>
        </div>

        {adminLevel === "junior" && (
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>Category:</label>
            <select 
              value={adminCategory} 
              onChange={(e) => setAdminCategory(e.target.value as "store" | "message" | "community")}
              style={{ width: "100%", padding: "0.5rem" }}
            >
              <option value="store">Store Admin</option>
              <option value="message">Message Admin</option>
              <option value="community">Community Admin</option>
            </select>
          </div>
        )}

        {adminLevel === "junior" && adminCategory === "store" && (
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>Assigned Locations:</label>
            <select 
              multiple
              value={selectedLocationIds}
              onChange={(e) => setSelectedLocationIds(Array.from(e.target.selectedOptions, option => option.value))}
              style={{ width: "100%", padding: "0.5rem", minHeight: "100px" }}
            >
              {storageLocations?.map((loc: any) => (
                <option key={loc.locationId} value={loc.locationId}>
                  {loc.districtName} ({loc.code})
                </option>
              ))}
            </select>
            <small style={{ color: "#666" }}>Hold Ctrl/Cmd to select multiple</small>
          </div>
        )}

        {message && (
          <div style={{ 
            padding: "0.5rem", 
            borderRadius: "4px", 
            background: message.type === "success" ? "#e8f5e9" : "#ffebee",
            color: message.type === "success" ? "#2e7d32" : "#c62828"
          }}>
            {message.text}
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            padding: "0.75rem", 
            background: "#1976d2", 
            color: "white", 
            border: "none", 
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "Creating..." : "Create Account"}
        </button>
      </form>
    </div>
  );
}