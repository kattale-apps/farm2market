"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { AdminDashboard } from "./components/AdminDashboard";
import { TraderDashboardSafe } from "./components/TraderDashboardSafe";
import { FarmerDashboard } from "./components/FarmerDashboard";
import { BuyerDashboard } from "./components/BuyerDashboard";
import { VendorDashboard } from "./components/VendorDashboard";
import { TransporterDashboard } from "./components/TransporterDashboard";
import { StoreDashboard } from "./components/StoreDashboard";
import { Id } from "../convex/_generated/dataModel";
import { getStoredUser, clearAuth } from "./utils/authStorage";
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
  
  // Check if user is logged in — tries native Preferences first (survives
  // WebView clears on mobile), then falls back to localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    getStoredUser().then((parsed) => {
      if (parsed && parsed.userId && parsed.role && parsed.alias) {
        setUser(parsed);
      } else {
        clearAuth();
        router.push("/login");
      }
    }).catch(() => {
      clearAuth();
      router.push("/login");
    });
  }, [router]);

  // Check if farmer/vendor/store needs onboarding (hooks must be called unconditionally)
  const onboardingStatus = useQuery(
    api.farmerOnboarding.checkOnboardingStatus,
    user?.role === "farmer" && user?.userId 
      ? { farmerId: user.userId as Id<"users"> } 
      : "skip"
  );

  const vendorOnboardingStatus = useQuery(
    api.vendorOnboarding.checkOnboardingStatus,
    user?.role === "vendor" && user?.userId
      ? { userId: user.userId as Id<"users"> }
      : "skip"
  );

  const transporterOnboardingStatus = useQuery(
    api.transporterOnboarding.checkOnboardingStatus,
    user?.role === "transporter" && user?.userId
      ? { userId: user.userId as Id<"users"> }
      : "skip"
  );

  const storeOnboardingStatus = useQuery(
    api.storeOnboarding.checkOnboardingStatus,
    user?.role === "store" && user?.userId
      ? { userId: user.userId as Id<"users"> }
      : "skip"
  );

  const communities = useQuery(
    api.communities.getActiveCommunities,
    ["farmer", "trader", "buyer", "vendor", "transporter", "store"].includes(user?.role) && user?.userId ? { userId: user.userId as Id<"users"> } : "skip"
  );

  const memberCommunities = (communities || []).filter((c: any) => c.isMember);

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (user?.role === "farmer" && onboardingStatus !== undefined && !onboardingStatus.completed) {
      router.push("/onboarding/farmer");
    }
    if (user?.role === "vendor" && vendorOnboardingStatus !== undefined && !vendorOnboardingStatus.completed) {
      router.push("/onboarding/vendor");
    }
    if (user?.role === "transporter" && transporterOnboardingStatus !== undefined && !transporterOnboardingStatus.completed) {
      router.push("/onboarding/transporter");
    }
    if (user?.role === "store" && storeOnboardingStatus !== undefined && !storeOnboardingStatus.completed) {
      router.push("/onboarding/store");
    }
  }, [user?.role, onboardingStatus, vendorOnboardingStatus, transporterOnboardingStatus, storeOnboardingStatus, router]);
  
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
              href="/downloads/farm2market.apk"
              download
              style={{
                display: "inline-block",
                padding: "0.6rem 1.2rem",
                background: "#ffffff",
                color: "#111827",
                textDecoration: "none",
                borderRadius: "6px",
                fontSize: "0.9rem",
                fontWeight: "700",
                border: "1px solid #111827",
                minWidth: "130px",
                textAlign: "center",
                height: "auto",
                lineHeight: "1.5",
                transition: "background 0.3s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#ffffff"}
            >
              Download APP
            </a>
            <a
              href="/contact"
              style={{
                display: "inline-block",
                padding: "0.6rem 1.2rem",
                background: "#ffffff",
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
              onMouseEnter={(e) => e.currentTarget.style.background = "#f8fff9"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#ffffff"}
            >
              Contact Us
            </a>
            <a
              href="/privacy-policy"
              style={{
                display: "inline-block",
                padding: "0.6rem 1.2rem",
                background: "#ffffff",
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
              onMouseEnter={(e) => e.currentTarget.style.background = "#f8fff9"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#ffffff"}
            >
              Privacy Policy
            </a>
            {(user?.role === "farmer" || user?.role === "trader" || user?.role === "buyer" || user?.role === "vendor" || user?.role === "transporter" || user?.role === "store" || isSuperAdmin || (user?.role === "admin" && user?.adminCategory === "community")) && (
              <a
                href={
                  isSuperAdmin ? "/admin/communities" :
                  user?.adminCategory === "community" ? "/admin/community-dashboard" :
                  "/farmer/communities"
                }
                style={{
                  display: "inline-block",
                  padding: "0.6rem 1.2rem",
                  background: "#ffffff",
                  color: "#1976d2",
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
                  e.currentTarget.style.background = "#f5f9ff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#ffffff";
                }}
              >
                {isSuperAdmin ? "Create a Community" : user?.adminCategory === "community" ? "Community Dashboard" : "Join A Community"}
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
          {(user?.role === "farmer" || user?.role === "trader" || user?.role === "buyer" || user?.role === "vendor" || user?.role === "transporter" || user?.role === "store") && (
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
              clearAuth().finally(() => router.push("/login"));
            }}
            style={{
              padding: "0.6rem 1.2rem",
              background: "#ffffff",
              border: "1px solid #dc3545",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: "700",
              color: "#dc3545",
              display: "inline-block",
              minWidth: "130px",
              textAlign: "center",
              height: "auto",
              lineHeight: "1.5",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#fff5f5"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#ffffff"}
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
        {user?.role === "vendor" && user?.userId && <VendorDashboard userId={user.userId as Id<"users">} />}
        {user?.role === "transporter" && user?.userId && <TransporterDashboard userId={user.userId as Id<"users">} />}
        {user?.role === "store" && user?.userId && <StoreDashboard userId={user.userId as Id<"users">} />}
      </div>
    </main>
  );
}
