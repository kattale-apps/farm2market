"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { AdminDashboard } from "./components/AdminDashboard";
import { TraderDashboard } from "./components/TraderDashboard";
import { FarmerDashboard } from "./components/FarmerDashboard";
import { BuyerDashboard } from "./components/BuyerDashboard";
import { VendorDashboard } from "./components/VendorDashboard";
import { TransporterDashboard } from "./components/TransporterDashboard";
import { StoreDashboard } from "./components/StoreDashboard";
import { Id } from "../convex/_generated/dataModel";
import { getStoredUser, clearAuth } from "./utils/authStorage";
import { NotificationMailbox } from "./components/NotificationMailbox";
// import { useMutation } from "convex/react";
// import { initializePushNotifications } from "./utils/pushNotifications";

/**
 * Farm2Market Uganda - Live Dashboard
 * 
 * Shows real-time system status including:
 * - System operational status
 * - System statistics
 */

const profileMenuLinkStyle: CSSProperties = {
  display: "block",
  padding: "0.45rem 0.6rem",
  borderRadius: "6px",
  background: "#f5f5f5",
  color: "#1a1a1a",
  textDecoration: "none",
  fontSize: "0.85rem",
  fontWeight: 600,
};

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const isSuperAdmin = user?.role === "admin" && user?.adminLevel !== "junior";
  const isCrmCommunityAdmin =
    user?.role === "admin" &&
    user?.adminLevel === "junior" &&
    user?.adminCategory === "community_crm";
  const crmCommunityId = isCrmCommunityAdmin ? user?.assignedCommunityIds?.[0] : null;

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

  const traderOnboardingStatus = useQuery(
    api.traderOnboarding.checkOnboardingStatus,
    user?.role === "trader" && user?.userId
      ? { userId: user.userId as Id<"users"> }
      : "skip"
  );

  const buyerOnboardingStatus = useQuery(
    api.buyerOnboarding.checkOnboardingStatus,
    user?.role === "buyer" && user?.userId
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
  const currentUser = useQuery(
    api.auth.getUser,
    user?.userId ? { userId: user.userId as Id<"users"> } : "skip"
  );

  const effectiveUser = currentUser ?? user;
  const isEffectiveSuperAdmin =
    effectiveUser?.role === "admin" && effectiveUser?.adminLevel !== "junior";
  const isEffectiveCrmCommunityAdmin =
    effectiveUser?.role === "admin" &&
    effectiveUser?.adminLevel === "junior" &&
    effectiveUser?.adminCategory === "community_crm";
  const effectiveCrmCommunityId = isEffectiveCrmCommunityAdmin
    ? effectiveUser?.assignedCommunityIds?.[0]
    : null;

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
    if (user?.role === "trader" && traderOnboardingStatus !== undefined && !traderOnboardingStatus.completed) {
      router.push("/onboarding/trader");
    }
    if (user?.role === "buyer" && buyerOnboardingStatus !== undefined && !buyerOnboardingStatus.completed) {
      router.push("/onboarding/buyer");
    }
  }, [
    user?.role,
    onboardingStatus,
    vendorOnboardingStatus,
    transporterOnboardingStatus,
    storeOnboardingStatus,
    traderOnboardingStatus,
    buyerOnboardingStatus,
    router,
  ]);
  
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
      <style>{`
        .f2m-banner {
          position: relative;
          display: grid;
          grid-template-columns: 1fr auto auto;
          column-gap: 6px;
          row-gap: 4px;
          align-items: center;
          margin-bottom: 1rem;
          padding: 0.5rem 0.6rem;
          background: linear-gradient(160deg, #8a5a2b 0%, #6b4423 100%);
          border-radius: 10px;
        }
        .f2m-slot-brand { grid-area: brand; justify-self: start; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
        .f2m-slot-title { grid-area: title; justify-self: start; min-width: 0; overflow: hidden; }
        .f2m-slot-title h2 { overflow: hidden; text-overflow: ellipsis; }
        .f2m-slot-bell { grid-area: bell; justify-self: center; }
        .f2m-slot-msg { grid-area: msg; justify-self: center; }
        .f2m-slot-profile { grid-area: profile; justify-self: center; }
        .f2m-slot-more { grid-area: more; justify-self: center; }
        .f2m-icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          padding: 0;
          background: none;
          border: none;
          color: #fff;
          font-size: 2rem;
          line-height: 1;
          cursor: pointer;
          flex-shrink: 0;
        }
        .f2m-dropdown {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          top: calc(100% + 0.4rem);
          width: min(340px, calc(100vw - 2rem));
          max-height: 70vh;
          overflow-y: auto;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
          padding: 0.75rem;
          text-align: left;
          z-index: 20;
        }
        .f2m-banner.has-dashboard-row {
          grid-template-areas:
            "brand   bell    msg"
            "title   profile more";
        }
        @media (min-width: 700px) {
          .f2m-banner.has-dashboard-row {
            grid-template-columns: auto auto 1fr auto auto auto auto;
            grid-template-areas: "brand title . bell profile msg more";
            column-gap: 20px;
          }
        }
      `}</style>
      <div className="f2m-banner has-dashboard-row">
        <div className="f2m-slot-brand" style={{
            fontWeight: 800,
            color: "#fff",
            fontSize: "clamp(0.85rem, 2.5vw, 1.15rem)",
            fontFamily: '"Montserrat", sans-serif',
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}>
            Farm2Market
          </div>

          <div id="dashboard-title-slot" className="f2m-slot-title" />

          <div className="f2m-slot-bell">
            {user?.userId && <NotificationMailbox userId={user.userId as Id<"users">} compact />}
          </div>

          <div id="dashboard-msg-slot" className="f2m-slot-msg" />

          <div className="f2m-slot-profile">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((v) => !v)}
                title={effectiveUser?.alias || user?.alias || "Profile"}
                aria-label="Profile menu"
                className="f2m-icon-btn"
              >
                👤
              </button>
              {profileMenuOpen && (
                <>
                  <div onClick={() => setProfileMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 19 }} />
                  <div className="f2m-dropdown">
                  <p style={{ margin: "0 0 0.15rem", fontSize: "0.85rem", color: "#333" }}>
                    Logged in as: <strong style={{ color: "#1a1a1a" }}>{effectiveUser?.alias || user?.alias || "Unknown"}</strong>
                  </p>
                  <p style={{ margin: "0 0 0.6rem", fontSize: "0.8rem", color: "#666", textTransform: "capitalize" }}>
                    Role: {effectiveUser?.role || user?.role || "unknown"}
                  </p>

                  {(effectiveUser?.role === "farmer" || effectiveUser?.role === "trader" || effectiveUser?.role === "buyer" || effectiveUser?.role === "vendor" || effectiveUser?.role === "transporter" || effectiveUser?.role === "store") && (
                    <div style={{ marginBottom: "0.6rem", paddingBottom: "0.6rem", borderBottom: "1px solid #eee" }}>
                      <div style={{ fontWeight: 700, marginBottom: "0.3rem", color: "#1b5e20", fontSize: "0.8rem" }}>
                        Communities ({memberCommunities.length})
                      </div>
                      {memberCommunities.length === 0 ? (
                        <div style={{ color: "#6b7280", fontSize: "0.8rem" }}>No memberships yet.</div>
                      ) : (
                        <ul style={{ margin: 0, paddingLeft: "1rem", fontSize: "0.8rem", color: "#374151" }}>
                          {memberCommunities.map((c: any) => (
                            <li key={c.id}>{c.name}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  <div id="dashboard-profile-extra-slot" />

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <a href="/api/download/android" download="Farm2Market.apk" style={profileMenuLinkStyle}>
                      Download App
                    </a>
                    <a href="/contact" style={profileMenuLinkStyle}>Contact Us</a>
                    <a href="/privacy-policy" style={profileMenuLinkStyle}>Privacy Policy</a>
                    {(effectiveUser?.role === "farmer" || effectiveUser?.role === "trader" || effectiveUser?.role === "buyer" || effectiveUser?.role === "vendor" || effectiveUser?.role === "transporter" || effectiveUser?.role === "store" || isEffectiveSuperAdmin || (effectiveUser?.role === "admin" && effectiveUser?.adminCategory === "community") || isEffectiveCrmCommunityAdmin) && (
                      <a
                        href={
                          isEffectiveSuperAdmin ? "/admin/communities" :
                          isEffectiveCrmCommunityAdmin && effectiveCrmCommunityId ? `/community-only/crm-agent?communityId=${effectiveCrmCommunityId}` :
                          effectiveUser?.adminCategory === "community" ? "/admin/community-dashboard" :
                          "/farmer/communities"
                        }
                        style={profileMenuLinkStyle}
                      >
                        {isEffectiveSuperAdmin ? "Create a Community" : isEffectiveCrmCommunityAdmin ? "CRM Agent Workspace" : effectiveUser?.adminCategory === "community" ? "Community Dashboard" : "Join A Community"}
                      </a>
                    )}
                    <button
                      onClick={() => clearAuth().finally(() => router.push("/login"))}
                      style={{
                        marginTop: "0.3rem",
                        padding: "0.5rem 0.75rem",
                        background: "#fff5f5",
                        border: "1px solid #dc3545",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        color: "#dc3545",
                        textAlign: "left",
                      }}
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Dashboard components portal their title / inbox / more-menu here so
              they render as part of this one grid instead of a separate box. */}
          <div id="dashboard-more-slot" className="f2m-slot-more" />
      </div>

      {/* Role-Based Dashboard */}
      <div style={{
        marginTop: "1rem"
      }}>
        {effectiveUser?.role === "admin" && user?.userId && !isEffectiveCrmCommunityAdmin && <AdminDashboard userId={user.userId as Id<"users">} />}
        {isEffectiveCrmCommunityAdmin && effectiveCrmCommunityId && (
          <div style={{ background: "#ffffff", borderRadius: "16px", padding: "1.25rem", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}>
            <h2 style={{ marginTop: 0, marginBottom: "0.5rem" }}>CRM Agent Workspace</h2>
            <p style={{ marginTop: 0, color: "#555" }}>This account is limited to CRM follow-up work for its assigned community.</p>
            <a href={`/community-only/crm-agent?communityId=${effectiveCrmCommunityId}`} style={{ color: "#1565c0", fontWeight: 700, textDecoration: "none" }}>
              Open CRM agent page →
            </a>
          </div>
        )}
        {user?.role === "trader" && user?.userId && <TraderDashboard userId={user.userId as Id<"users">} userRole="trader" />}
        {user?.role === "farmer" && user?.userId && <FarmerDashboard userId={user.userId as Id<"users">} />}
        {user?.role === "buyer" && user?.userId && <BuyerDashboard userId={user.userId as Id<"users">} />}
        {user?.role === "vendor" && user?.userId && <VendorDashboard userId={user.userId as Id<"users">} />}
        {user?.role === "transporter" && user?.userId && <TransporterDashboard userId={user.userId as Id<"users">} />}
        {user?.role === "store" && user?.userId && <StoreDashboard userId={user.userId as Id<"users">} />}
      </div>
    </main>
  );
}
