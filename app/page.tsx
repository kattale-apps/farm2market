"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { AdminDashboard } from "./components/AdminDashboard";
import { TraderDashboardSafe } from "./components/TraderDashboardSafe";
import { FarmerDashboard } from "./components/FarmerDashboard";
import { BuyerDashboard } from "./components/BuyerDashboard";
import { Id } from "../convex/_generated/dataModel";
// import { useMutation } from "convex/react";
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
  const [showCommunityTooltip, setShowCommunityTooltip] = useState(false);
  const isSuperAdmin = user?.role === "admin" && user?.adminLevel !== "junior";
  
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
            // Invalid user data, clear to remain public
            localStorage.removeItem("pilot_user");
          }
        }
      } catch (error) {
        // JSON parse failed, clear corrupted data
        console.error("Failed to parse user data:", error);
        localStorage.removeItem("pilot_user");
      }
    }
  }, [router]);

  // Check if farmer needs onboarding (hooks must be called unconditionally)
  const onboardingStatus = useQuery(
    api.farmerOnboarding.checkOnboardingStatus,
    user?.role === "farmer" && user?.userId 
      ? { farmerId: user.userId as Id<"users"> } 
      : "skip"
  );

  const communities = useQuery(
    api.communities.getActiveCommunities,
    user?.role === "farmer" && user?.userId ? { userId: user.userId as Id<"users"> } : "skip"
  );

  const memberCommunities = (communities || []).filter((c: any) => c.isMember);

  // Redirect farmers to onboarding if not completed
  useEffect(() => {
    if (user?.role === "farmer" && onboardingStatus !== undefined && !onboardingStatus.completed) {
      router.push("/onboarding/farmer");
    }
  }, [user?.role, onboardingStatus, router]);
  
  // Public homepage for non-authenticated users
  if (!user || !user.userId || !user.role || !user.alias) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ textAlign: "center", background: "rgba(255, 255, 255, 0.95)", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", padding: "2rem", maxWidth: "520px", width: "100%" }}>
          <h1 style={{ fontSize: "2rem", color: "#2c2c2c", marginBottom: "0.75rem", fontWeight: "800" }}>Farm2Market Uganda</h1>
          <p style={{ color: "#555", marginBottom: "1.5rem" }}>Welcome. Sign in to access your dashboard, communities, and messaging.</p>
          <button
            onClick={() => router.push("/login")}
            style={{ padding: "0.75rem 1.25rem", borderRadius: "8px", background: "#1976d2", color: "#fff", border: "none", fontWeight: "600", cursor: "pointer" }}
          >
            Go to Login
          </button>
        </div>
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
              href="/downloads/farm2market.apk"
              download
              style={{
                display: "inline-block",
                padding: "0.6rem 1.2rem",
                background: "#111827",
                color: "white",
                textDecoration: "none",
                borderRadius: "6px",
                fontSize: "0.9rem",
                fontWeight: "700",
                minWidth: "130px",
                textAlign: "center",
                height: "auto",
                lineHeight: "1.5",
                transition: "background 0.3s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#0f172a"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#111827"}
            >
              Download APP
            </a>
            <a
              href="/contact"
              style={{
                display: "inline-block",
                padding: "0.6rem 1.2rem",
                background: "#2e7d32",
                color: "white",
                textDecoration: "none",
                borderRadius: "6px",
                fontSize: "0.9rem",
                fontWeight: "700",
                minWidth: "130px",
                textAlign: "center",
                height: "auto",
                lineHeight: "1.5",
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
                padding: "0.6rem 1.2rem",
                background: "transparent",
                color: "#2e7d32",
                textDecoration: "none",
                borderRadius: "6px",
                fontSize: "0.9rem",
                fontWeight: "700",
                border: "1px solid #2e7d32",
                minWidth: "130px",
                textAlign: "center",
                height: "auto",
                lineHeight: "1.5",
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
            {(user?.role === "farmer" || isSuperAdmin || (user?.role === "admin" && user?.adminCategory === "community")) && (
              <a
                href={
                  isSuperAdmin ? "/admin/communities" :
                  user?.adminCategory === "community" ? "/admin/community-dashboard" :
                  "/farmer/communities"
                }
                style={{
                  display: "inline-block",
                  padding: "0.6rem 1.2rem",
                  background: "#1976d2",
                  color: "#ffffff",
                  textDecoration: "none",
                  borderRadius: "6px",
                  fontSize: "0.9rem",
                  fontWeight: "700",
                  border: "1px solid #1565c0",
                  minWidth: "130px",
                  textAlign: "center",
                  height: "auto",
                  lineHeight: "1.5",
                  transition: "background 0.3s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#1565c0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#1976d2";
                }}
              >
                {isSuperAdmin ? "Create a Community" : user?.adminCategory === "community" ? "Community Dashboard" : "Join A Growers Community"}
              </a>
            )}
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
          {user?.role === "farmer" && (
            <div style={{ position: "relative", alignSelf: isMobile ? "flex-start" : "flex-end" }}>
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={showCommunityTooltip}
                onClick={() => setShowCommunityTooltip((prev) => !prev)}
                onMouseEnter={() => setShowCommunityTooltip(true)}
                onMouseLeave={() => setShowCommunityTooltip(false)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: isMobile ? "0.5rem 0.85rem" : "0.35rem 0.6rem",
                  borderRadius: "999px",
                  background: "#eef7ff",
                  color: "#1e5aa7",
                  fontSize: isMobile ? "0.9rem" : "0.8rem",
                  fontWeight: 600,
                  border: "1px solid #cfe3ff",
                  cursor: "pointer",
                  width: isMobile ? "100%" : "auto",
                  justifyContent: "center",
                }}
              >
                Communities ({memberCommunities.length}) ⓘ
              </button>
              {showCommunityTooltip && (
                <div
                  onMouseEnter={() => setShowCommunityTooltip(true)}
                  onMouseLeave={() => setShowCommunityTooltip(false)}
                  style={{
                    position: "absolute",
                    top: "120%",
                    right: isMobile ? "auto" : 0,
                    left: isMobile ? 0 : "auto",
                    zIndex: 10,
                    minWidth: isMobile ? "100%" : "220px",
                    maxWidth: isMobile ? "90vw" : "320px",
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "10px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    padding: "0.75rem",
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#1b5e20" }}>
                    Your Communities
                  </div>
                  {memberCommunities.length === 0 ? (
                    <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>No memberships yet.</div>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: "1rem", fontSize: "0.85rem", color: "#374151" }}>
                      {memberCommunities.map((c: any) => (
                        <li key={c.id}>{c.name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => {
              localStorage.removeItem("pilot_user");
              router.push("/login");
            }}
            style={{
              padding: "0.6rem 1.2rem",
              background: "#dc3545",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: "700",
              color: "#fff",
              display: "inline-block",
              minWidth: "130px",
              textAlign: "center",
              height: "auto",
              lineHeight: "1.5",
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
        {user?.role === "trader" && user?.userId && <TraderDashboardSafe userId={user.userId as Id<"users">} />}
        {user?.role === "farmer" && user?.userId && <FarmerDashboard userId={user.userId as Id<"users">} />}
        {user?.role === "buyer" && user?.userId && <BuyerDashboard userId={user.userId as Id<"users">} />}
      </div>
    </main>
  );
}
