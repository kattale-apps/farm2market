"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface HeaderProps {
  userId: Id<"users">;
}

export function Header({ userId }: HeaderProps) {
  // ✅ Use auth.getUser (correct source of truth)
  const user = useQuery(api.auth.getUser, { userId });

  if (user === undefined || user === null) {
    return (
      <div style={{ padding: "1rem 2rem", marginBottom: "2rem" }}>
        <p>Loading user information...</p>
      </div>
    );
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getRoleGreeting = () => {
    const greeting = getGreeting();

    switch (user.role) {
      case "farmer":
        return `${greeting}, Farmer ${user.alias}`;
      case "trader":
        return `${greeting}, Trader ${user.alias}`;
      case "buyer":
        return `${greeting}, Buyer ${user.alias}`;
      case "admin":
        return `${greeting}, ${
          user.adminLevel === "junior" ? "StoreAdmin" : "SuperAdmin"
        } ${user.alias}`;
      default:
        return `${greeting}, ${user.alias ?? "User"}`;
    }
  };

  return (
    <div
      style={{
        padding: "1rem 2rem",
        background: "#fff",
        borderBottom: "1px solid #e0e0e0",
        marginBottom: "2rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "1.5rem",
              fontWeight: "600",
              color: "#1a1a1a",
            }}
          >
            {getRoleGreeting()}
          </h1>
          <p
            style={{
              margin: "0.25rem 0 0 0",
              fontSize: "0.9rem",
              color: "#666",
            }}
          >
            {user.role === "farmer" &&
              "Manage your listings and track deliveries"}
            {user.role === "trader" &&
              "Browse listings, make offers, and manage inventory"}
            {user.role === "buyer" &&
              "Purchase produce during open windows"}
            {user.role === "admin" &&
              user.adminLevel === "junior" &&
              "Verify deliveries for your assigned locations"}
            {user.role === "admin" &&
              user.adminLevel !== "junior" &&
              "Manage platform operations and oversight"}
          </p>
        </div>

        <div style={{ fontSize: "0.9rem", color: "#666" }}>
          Role: <strong>{user.role}</strong>
        </div>
      </div>
    </div>
  );
}
