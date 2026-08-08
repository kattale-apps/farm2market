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
  const communities = useQuery(api.communities.getActiveCommunities, { userId: adminId });
  
  const [email, setEmail] = useState("");
  const [adminLevel, setAdminLevel] = useState<"super" | "junior">("junior");
  const [adminCategory, setAdminCategory] = useState<"store" | "message" | "community" | "community_crm">("store");
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [selectedCommunityIds, setSelectedCommunityIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (adminLevel === "junior" && adminCategory === "community_crm") {
        if (!email.trim().toLowerCase().endsWith(".crm")) {
          throw new Error("Community CRM admins must use an email ending in .crm");
        }

        if (selectedCommunityIds.length !== 1) {
          throw new Error("Community CRM admins must be assigned to exactly one community");
        }
      }

      await createUser({
        email,
        role: "admin",
        adminLevel,
        adminCategory: adminLevel === "junior" ? adminCategory : undefined,
        allowedStorageLocationIds: adminLevel === "junior" && adminCategory === "store" && selectedLocationIds.length > 0
          ? selectedLocationIds.map(id => id as Id<"storageLocations">) 
          : undefined,
        assignedCommunityIds: adminLevel === "junior" && (adminCategory === "community" || adminCategory === "community_crm") && selectedCommunityIds.length > 0
          ? selectedCommunityIds.map(id => id as Id<"communities">)
          : undefined,
        creatorAdminId: adminId,
      });
      setMessage({ type: "success", text: "Admin account created successfully!" });
      setEmail("");
      setSelectedLocationIds([]);
      setSelectedCommunityIds([]);
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
              onChange={(e) => setAdminCategory(e.target.value as "store" | "message" | "community" | "community_crm")}
              style={{ width: "100%", padding: "0.5rem" }}
            >
              <option value="store">Store Admin</option>
              <option value="message">Message Admin</option>
              <option value="community">Community Admin</option>
              <option value="community_crm">Community CRM</option>
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

        {adminLevel === "junior" && (adminCategory === "community" || adminCategory === "community_crm") && (
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              {adminCategory === "community_crm" ? "Assigned Community:" : "Assigned Communities (Optional):"}
            </label>
            <select 
              multiple
              value={selectedCommunityIds}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions, option => option.value);
                setSelectedCommunityIds(adminCategory === "community_crm" ? values.slice(-1) : values);
              }}
              style={{ width: "100%", padding: "0.5rem", minHeight: "100px" }}
            >
              {communities?.map((comm: any) => (
                <option key={comm._id} value={comm._id}>
                  {comm.name}
                </option>
              ))}
            </select>
            <small style={{ color: "#666" }}>
              {adminCategory === "community_crm"
                ? "Select exactly one community. Use a .crm email for this account."
                : "Hold Ctrl/Cmd to select multiple. Leave empty to assign later."}
            </small>
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