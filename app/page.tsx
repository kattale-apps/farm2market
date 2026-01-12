"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminDashboard } from "./components/AdminDashboard";
import { TraderDashboard } from "./components/TraderDashboard";
import { FarmerDashboard } from "./components/FarmerDashboard";
import { BuyerDashboard } from "./components/BuyerDashboard";
import { Id } from "../convex/_generated/dataModel";
// import { useMutation } from "convex/react";
// import { api } from "../convex/_generated/api";
// import { initializePushNotifications } from "./utils/pushNotifications";

/**
 * Farm2Market Uganda - Live Dashboard
 * 
 * Shows real-time system status including:
 * - System operational status
 * - System statistics
 */

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  
  // TODO: Initialize push notifications when pushNotifications API is available
  // Push notifications will be enabled once the API is properly generated
  // useEffect(() => {
  //   if (user?.userId && typeof window !== "undefined") {
  //     // Initialize push notifications here
  //   }
  // }, [user?.userId]);
  
  // Check if user is logged in (pilot mode)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("pilot_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          // Validate user object has required properties
          if (parsed && parsed.userId && parsed.role && parsed.alias) {
            setUser(parsed);
          } else {
            // Invalid user data, clear and redirect
            localStorage.removeItem("pilot_user");
            router.push("/login");
          }
        } else {
          // Redirect to login if not logged in
          router.push("/login");
        }
      } catch (error) {
        // JSON parse failed, clear corrupted data
        console.error("Failed to parse user data:", error);
        localStorage.removeItem("pilot_user");
        router.push("/login");
      }
    }
  }, [router]);

  
  // Show loading if checking auth
  if (!user || !user.userId || !user.role || !user.alias) {
    return (
      <main style={{ 
        padding: "2rem", 
        textAlign: "center",
        background: "rgba(255, 255, 255, 0.95)",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        margin: "2rem auto",
        maxWidth: "400px"
      }}>
        <p style={{ color: "#2c2c2c", fontSize: "1rem", fontWeight: "500" }}>Loading...</p>
      </main>
    );
  }


  return (
    <main style={{ 
      padding: "clamp(1rem, 3vw, 2rem)", 
      maxWidth: "1200px", 
      margin: "0 auto",
      minHeight: "100vh",
      boxSizing: "border-box"
    }}>
      <div style={{ 
        marginBottom: "2rem", 
        display: "flex", 
        flexDirection: isMobile ? "column" : "row",
        justifyContent: "space-between", 
        alignItems: isMobile ? "flex-start" : "center",
        gap: isMobile ? "1rem" : "0",
        padding: "clamp(1rem, 3vw, 1.5rem)",
        background: "rgba(255, 255, 255, 0.95)",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ 
            fontSize: "clamp(1.5rem, 5vw, 2.5rem)", 
            marginBottom: "0.5rem", 
            color: "#2c2c2c",
            fontWeight: "800",
            fontFamily: '"Montserrat", sans-serif',
            letterSpacing: "-0.03em",
            textTransform: "uppercase",
            textShadow: "0 1px 2px rgba(255,255,255,0.8)"
          }}>
            Farm2Market Uganda
          </h1>
          <p style={{ 
            color: "#2e7d32", 
            fontSize: "clamp(0.9rem, 3vw, 1.2rem)",
            fontWeight: "600",
            fontFamily: '"Montserrat", sans-serif',
            letterSpacing: "0.1em",
            textTransform: "uppercase"
          }}>
            Farm. Trade. Grow.
          </p>
          <div style={{
            marginTop: "1rem",
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap"
          }}>
            <a
              href="/contact"
              style={{
                display: "inline-block",
                padding: "0.5rem 1rem",
                background: "#2e7d32",
                color: "white",
                textDecoration: "none",
                borderRadius: "6px",
                fontSize: isMobile ? "0.85rem" : "0.9rem",
                fontWeight: "600",
                transition: "background 0.3s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#1b5e20"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#2e7d32"}
            >
              Contact Us
            </a>
            <a
              href="/privacy-policy"
              style={{
                display: "inline-block",
                padding: "0.5rem 1rem",
                background: "transparent",
                color: "#2e7d32",
                textDecoration: "none",
                borderRadius: "6px",
                fontSize: isMobile ? "0.85rem" : "0.9rem",
                fontWeight: "600",
                border: "1px solid #2e7d32",
                transition: "background 0.3s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#2e7d32";
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#2e7d32";
              }}
            >
              Privacy Policy
            </a>
          </div>
        </div>
        <div style={{ 
          textAlign: isMobile ? "left" : "right",
          width: isMobile ? "100%" : "auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem"
        }}>
          <p style={{ 
            color: "#333", 
            fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)", 
            marginBottom: "0",
            fontWeight: "500"
          }}>
            Logged in as: <strong style={{ color: "#1a1a1a" }}>{user?.alias || "Unknown"}</strong>
          </p>
          <p style={{ 
            color: "#555", 
            fontSize: "clamp(0.8rem, 2.5vw, 0.85rem)", 
            marginBottom: "0",
            textTransform: "capitalize"
          }}>
            Role: {user?.role || "unknown"}
          </p>
          <button
            onClick={() => {
              localStorage.removeItem("pilot_user");
              router.push("/login");
            }}
            style={{
              padding: "clamp(0.6rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)",
              background: "#dc3545",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "clamp(0.85rem, 2.5vw, 0.9rem)",
              fontWeight: "600",
              color: "#fff",
              width: isMobile ? "100%" : "auto",
              minWidth: "120px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#c82333"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#dc3545"}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Role-Based Dashboard */}
      <div style={{
        marginTop: "1rem"
      }}>
        {user?.role === "admin" && user?.userId && <AdminDashboard userId={user.userId as Id<"users">} />}
        {user?.role === "trader" && user?.userId && <TraderDashboard userId={user.userId as Id<"users">} />}
        {user?.role === "farmer" && user?.userId && <FarmerDashboard userId={user.userId as Id<"users">} />}
        {user?.role === "buyer" && user?.userId && <BuyerDashboard userId={user.userId as Id<"users">} />}
      </div>
    </main>
  );
}
