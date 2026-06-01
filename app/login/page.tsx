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
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pendingCommunitySlug, setPendingCommunitySlug] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMarketPricesLocked = true;
  const role: "farmer" = "farmer";
  
  const loginWithSession = useMutation((api as any).auth.loginWithSession);
  const signupWithSession = useMutation((api as any).auth.signupWithSession);

  // Pre-fill last used credential on mount
  useEffect(() => {
    const lastCred = getLastCredential();
    if (lastCred) {
      setLoginIdentifier(lastCred);
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

  // Handle buy intent from market price panel — pre-select signup mode
  useEffect(() => {
    if (searchParams.get("intent") === "buy") {
      setIsSignup(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const identifier = loginIdentifier.trim();
      if (!identifier) {
        setError("Email or phone number is required");
        setLoading(false);
        return;
      }
      if (!password.trim()) {
        setError("Password is required");
        setLoading(false);
        return;
      }

      const identifierLooksLikeEmail = identifier.includes("@");
      const authArgs = {
        email: identifierLooksLikeEmail ? identifier : undefined,
        phoneNumber: identifierLooksLikeEmail ? undefined : identifier,
        password: password.trim(),
      };

      if (isSignup) {
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

        const result = await signupWithSession({
          ...authArgs,
          role,
        });

        const { sessionToken, ...user } = result;
        await saveAuth(user, sessionToken);
        saveLastCredential(identifier);

        if (pendingCommunitySlug) {
          router.push(`/join/community/${pendingCommunitySlug}?from_signup=1`);
        } else {
          router.push("/");
        }
      } else {
        const loginResult = await loginWithSession(authArgs).catch((err: any) => {
          const message = typeof err === "string" ? err : err?.message || "Login failed";
          if (message === "Invalid email/phone or password") {
            setIsSignup(true);
            setError("No account found. Confirm your password to create one.");
          } else {
            setError(message);
          }
          return null;
        });

        if (loginResult) {
          const { sessionToken, ...user } = loginResult;
          await saveAuth(user, sessionToken);
          saveLastCredential(identifier);

          if (pendingCommunitySlug) {
            router.push(`/join/community/${pendingCommunitySlug}?from_signup=1`);
          } else {
            router.push("/");
          }
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
          Farm. Trace. Grow.
        </p>

        <div style={{ marginBottom: "1.25rem" }}>
          <p style={{ margin: 0, color: "#333", fontSize: "1rem", fontWeight: 600 }}>
            Login or create an account in one step.
          </p>
          <p style={{ margin: "0.5rem 0 0", color: "#666", fontSize: "0.9rem", lineHeight: "1.5" }}>
            Enter your email or phone number and password. If we don’t find an account, you’ll be guided to confirm your password and create it.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <p style={{ marginBottom: "1rem", color: "#666", fontSize: "0.9rem", lineHeight: "1.5" }}>
            Enter your email or phone number. We’ll detect the right path for you.
          </p>

          {/* Login uses a single auto-detected identifier for both login and signup */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", color: "#333", fontWeight: "500" }}>
              Email or Phone Number
            </label>
            <input
              type="text"
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1rem"
              }}
              placeholder="your@email.com or +256 7XX XXX XXX"
            />
          </div>

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
        {false && <MarketPricePanel mobileMode />}
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            padding: "1.25rem",
            width: "100%",
            border: "1px solid #dbe9db"
          }}
          aria-label="Live market prices (locked)"
        >
          <div style={{ marginBottom: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#2c2c2c" }}>
              🌿 Live Market Prices
            </p>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#666" }}>
              This feature is temporarily locked.
            </p>
          </div>
          <p style={{ margin: 0, color: "#555", lineHeight: "1.6" }}>
            Market prices will return soon. Sign in as a farmer and check back later for live updates.
          </p>
        </div>
      </div>

      {/* Desktop: price panel to the right */}
      <div className="f2m-panel-desktop">
        {false && <MarketPricePanel />}
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            padding: "1.5rem",
            width: "100%",
            border: "1px solid #dbe9db"
          }}
          aria-label="Live market prices (locked)"
        >
          <div style={{ marginBottom: "0.75rem" }}>
            <p style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#2c2c2c" }}>
              🌿 Live Market Prices
            </p>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#666" }}>
              This feature is temporarily locked.
            </p>
          </div>
          <p style={{ margin: 0, color: "#555", lineHeight: "1.6" }}>
            Market prices will return soon. Sign in as a farmer and check back later for live updates.
          </p>
        </div>
      </div>
    </main>
    </>
  );
}

