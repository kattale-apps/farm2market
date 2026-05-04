"use client";

import { useState, useEffect, Suspense } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter, useSearchParams } from "next/navigation";
import MarketPricePanel from "../components/MarketPricePanel";
import { saveAuth, getLastCredential, saveLastCredential } from "../utils/authStorage";

/**
 * Login Page
 * 
 * User authentication and registration
 */
export default function LoginPage() {
  return (
    <Suspense fallback={
      <main style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <p>Loading...</p>
      </main>
    }>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [usePhone, setUsePhone] = useState(false); // Toggle between email and phone
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"farmer" | "trader" | "buyer" | "vendor" | "transporter" | "store">("farmer");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pendingCommunitySlug, setPendingCommunitySlug] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const loginWithSession = useMutation((api as any).auth.loginWithSession);
  const signupWithSession = useMutation((api as any).auth.signupWithSession);

  // Pre-fill last used credential on mount
  useEffect(() => {
    const lastCred = getLastCredential();
    if (lastCred) {
      if (lastCred.includes("@")) {
        setEmail(lastCred);
      } else {
        setPhoneNumber(lastCred);
        setUsePhone(true);
      }
    }
  }, []);

  // On mount, detect QR community join intent from URL param or localStorage
  useEffect(() => {
    const qrSlug = searchParams.get("qrCommunityId");
    if (qrSlug) {
      setPendingCommunitySlug(qrSlug);
      // Also persist in localStorage in case user refreshes
      localStorage.setItem("pending_community_join", qrSlug);
      // Default to signup tab when coming from QR scan
      setIsSignup(true);
    } else {
      // Check localStorage for pending join intent
      const stored = localStorage.getItem("pending_community_join");
      if (stored) {
        setPendingCommunitySlug(stored);
      }
    }
  }, [searchParams]);

  // Handle buy intent from market price panel — pre-select buyer signup
  useEffect(() => {
    if (searchParams.get("intent") === "buy") {
      setIsSignup(true);
      setRole("buyer");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate inputs
      if (!usePhone && !email.trim()) {
        setError("Email is required");
        setLoading(false);
        return;
      }
      if (usePhone && !phoneNumber.trim()) {
        setError("Phone number is required");
        setLoading(false);
        return;
      }
      if (!password.trim()) {
        setError("Password is required");
        setLoading(false);
        return;
      }

      if (isSignup) {
        // Signup validation
        if (password.length < 6) {
          setError("Password must be at least 6 characters long");
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwords do not match");
          setLoading(false);
          return;
        }

        // Signup with session
        const result = await signupWithSession({
          email: usePhone ? undefined : email.trim(),
          phoneNumber: usePhone ? phoneNumber.trim() : undefined,
          password: password.trim(),
          role: role,
        });

        // Persist to all storage layers (localStorage + native Preferences)
        const { sessionToken, ...user } = result;
        await saveAuth(user, sessionToken);
        saveLastCredential(usePhone ? phoneNumber.trim() : email.trim());

        // Redirect: if pending community join, go back to join page; otherwise go home
        if (pendingCommunitySlug) {
          router.push(`/join/community/${pendingCommunitySlug}?from_signup=1`);
        } else {
          router.push("/");
        }
      } else {
        // Login with session
        const result = await loginWithSession({
          email: usePhone ? undefined : email.trim(),
          phoneNumber: usePhone ? phoneNumber.trim() : undefined,
          password: password.trim(),
        });

        // Persist to all storage layers (localStorage + native Preferences)
        const { sessionToken, ...user } = result;
        await saveAuth(user, sessionToken);
        saveLastCredential(usePhone ? phoneNumber.trim() : email.trim());

        // Redirect: if pending community join, go back to join page; otherwise go home
        if (pendingCommunitySlug) {
          router.push(`/join/community/${pendingCommunitySlug}?from_signup=1`);
        } else {
          router.push("/");
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      const errorMessage = err.message || (isSignup ? "Signup failed" : "Login failed");
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .f2m-login-grid {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-height: 100vh;
          padding: 2rem 1rem;
          background: transparent;
          gap: 1.5rem;
        }
        .f2m-login-card {
          background: #fff;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          max-width: 400px;
          width: 100%;
        }
        .f2m-panel-desktop { display: none; }
        .f2m-panel-mobile { max-width: 400px; width: 100%; }
        @media (min-width: 900px) {
          .f2m-login-grid {
            flex-direction: row;
            align-items: flex-start;
            justify-content: center;
            padding: 2rem;
          }
          .f2m-login-card { max-width: 400px; flex-shrink: 0; }
          .f2m-panel-desktop { display: block; max-width: 460px; width: 100%; align-self: flex-start; }
          .f2m-panel-mobile { display: none; }
        }
      `}</style>
    <main className="f2m-login-grid">
      <div className="f2m-login-card">
        <h1 style={{ 
          fontSize: "1.8rem", 
          marginBottom: "0.5rem", 
          color: "#2c2c2c",
          fontFamily: '"Montserrat", sans-serif',
          fontWeight: "800",
          letterSpacing: "-0.02em",
          textTransform: "uppercase"
        }}>
          Farm2Market Uganda
        </h1>
        <p style={{ 
          color: "#2e7d32", 
          marginBottom: "1.5rem", 
          fontSize: "0.9rem", 
          fontWeight: "600",
          fontFamily: '"Montserrat", sans-serif',
          letterSpacing: "0.1em",
          textTransform: "uppercase"
        }}>
          Farm. Trade. Grow.
        </p>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid #e0e0e0" }}>
          <button
            type="button"
            onClick={() => {
              setIsSignup(false);
              setError(null);
            }}
            style={{
              padding: "0.5rem 1rem",
              background: "transparent",
              border: "none",
              borderBottom: isSignup ? "none" : "2px solid #1976d2",
              color: isSignup ? "#666" : "#1976d2",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: isSignup ? "400" : "600"
            }}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignup(true);
              setError(null);
            }}
            style={{
              padding: "0.5rem 1rem",
              background: "transparent",
              border: "none",
              borderBottom: isSignup ? "2px solid #1976d2" : "none",
              color: isSignup ? "#1976d2" : "#666",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: isSignup ? "600" : "400"
            }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Toggle between email and phone */}
          <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => {
                setUsePhone(false);
                setError(null);
              }}
              style={{
                flex: 1,
                padding: "0.5rem",
                background: !usePhone ? "#e3f2fd" : "transparent",
                border: "1px solid",
                borderColor: !usePhone ? "#1976d2" : "#ddd",
                borderRadius: "6px",
                color: !usePhone ? "#1976d2" : "#666",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: !usePhone ? "600" : "400"
              }}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => {
                setUsePhone(true);
                setError(null);
              }}
              style={{
                flex: 1,
                padding: "0.5rem",
                background: usePhone ? "#e3f2fd" : "transparent",
                border: "1px solid",
                borderColor: usePhone ? "#1976d2" : "#ddd",
                borderRadius: "6px",
                color: usePhone ? "#1976d2" : "#666",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: usePhone ? "600" : "400"
              }}
            >
              Phone
            </button>
          </div>

          {/* Email or Phone input */}
          {!usePhone ? (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", color: "#333", fontWeight: "500" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required={!usePhone}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem"
                }}
                placeholder="your@email.com"
              />
            </div>
          ) : (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", color: "#333", fontWeight: "500" }}>
                Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required={usePhone}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem"
                }}
                placeholder="+256 7XX XXX XXX or 07XX XXX XXX"
              />
              <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#666" }}>
                Enter your phone number with country code (+256) or local format (07XX)
              </p>
            </div>
          )}

          {isSignup && (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", color: "#333", fontWeight: "500" }}>
                I am a
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "farmer" | "trader" | "buyer" | "vendor" | "transporter" | "store")}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem",
                  background: "#fff"
                }}
              >
                <option value="farmer">Farmer</option>
                <option value="trader">Trader</option>
                <option value="buyer">Buyer</option>
                <option value="vendor">Vendor</option>
                <option value="transporter">Transporter</option>
                <option value="store">Store</option>
              </select>
            </div>
          )}

          <div style={{ marginBottom: isSignup ? "1rem" : "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", color: "#333", fontWeight: "500" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  paddingRight: "2.5rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem"
                }}
                placeholder={isSignup ? "Create a password (min. 6 characters)" : "Enter your password"}
                minLength={isSignup ? 6 : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "0.5rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1rem",
                  padding: "0.25rem",
                  color: "#666"
                }}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
            {isSignup && (
              <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#666" }}>
                Password must be at least 6 characters long
              </p>
            )}
          </div>

          {isSignup && (
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", color: "#333", fontWeight: "500" }}>
                Confirm Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    paddingRight: "2.5rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "1rem"
                  }}
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: "absolute",
                    right: "0.5rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1rem",
                    padding: "0.25rem",
                    color: "#666"
                  }}
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div style={{
              padding: "0.75rem",
              background: "#ffebee",
              border: "1px solid #ef5350",
              borderRadius: "6px",
              marginBottom: "1rem",
              color: "#c62828"
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: loading ? "#ccc" : "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: "1rem",
              fontWeight: "500",
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? (isSignup ? "Creating account..." : "Logging in...") : (isSignup ? "Create Account" : "Login")}
          </button>
        </form>

        {!isSignup && (
          <div style={{ marginTop: "1rem", textAlign: "center" }}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                // TODO: Implement forgot password functionality
                alert("Forgot password functionality will be available soon. Please contact support at kattaleglobal@gmail.com");
              }}
              style={{
                color: "#1976d2",
                textDecoration: "none",
                fontSize: "0.9rem"
              }}
            >
              Forgot your password?
            </a>
          </div>
        )}

        {/* Android App Download Section */}
        <div
          style={{
            marginTop: "2rem",
            padding: "1.5rem",
            background: "#e8f5e9",
            borderRadius: "12px",
            border: "2px solid #4caf50",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📱</div>
          <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem", color: "#2e7d32", fontWeight: "600" }}>
            Download Our Android App
          </h3>
          <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "1rem" }}>
            Get the full mobile experience on your Android device
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <a
              href="/downloads/farm2market.apk"
              download
              style={{
                display: "inline-block",
                padding: "0.75rem 1.5rem",
                background: "#4caf50",
                color: "white",
                textDecoration: "none",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "0.95rem",
                transition: "background 0.3s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#2e7d32")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#4caf50")}
            >
              📥 Download APP
            </a>
          </div>
          <p style={{ fontSize: "0.8rem", color: "#666", marginTop: "1rem" }}>
            Version 1.2.0 • Android 5.0+
          </p>
        </div>

      </div>

      {/* Mobile: price panel below login card */}
      <div className="f2m-panel-mobile">
        <MarketPricePanel mobileMode />
      </div>

      {/* Desktop: price panel to the right */}
      <div className="f2m-panel-desktop">
        <MarketPricePanel />
      </div>
    </main>
    </>
  );
}

