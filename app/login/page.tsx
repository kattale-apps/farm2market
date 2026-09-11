"use client";

import { useState, useEffect, Suspense } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter, useSearchParams } from "next/navigation";
import { saveAuth, getLastCredential, saveLastCredential } from "../utils/authStorage";

type IdentifierMode = "phone" | "email";
type AuthStep = "login" | "confirmSignup";
type SignupRole = "farmer" | "trader" | "buyer" | "vendor" | "transporter" | "store";

const SIGNUP_ROLES: Array<{ value: SignupRole; label: string; signupEnabled: boolean }> = [
  { value: "farmer", label: "Farmer", signupEnabled: true },
  { value: "vendor", label: "Vendor", signupEnabled: true },
  { value: "trader", label: "Trader", signupEnabled: true },
  { value: "buyer", label: "Buyer", signupEnabled: true },
  { value: "transporter", label: "Transporter", signupEnabled: true },
  { value: "store", label: "Store", signupEnabled: true },
];

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
  const [authStep, setAuthStep] = useState<AuthStep>("login");
  const [identifier, setIdentifier] = useState("");
  const [selectedRole, setSelectedRole] = useState<SignupRole>("farmer");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pendingCommunitySlug, setPendingCommunitySlug] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const loginWithSession = useMutation((api as any).auth.loginWithSession);
  const signupWithSession = useMutation((api as any).auth.signupWithSession);
  const checkAccountExists = useMutation((api as any).auth.checkAccountExists);

  const isSelectedRoleSignupEnabled = SIGNUP_ROLES.find((role) => role.value === selectedRole)?.signupEnabled ?? false;
  const selectedRoleLabel = SIGNUP_ROLES.find((role) => role.value === selectedRole)?.label || "Account";
  const activeIdentifier = identifier.trim();
  // Auto-detect: an "@" means email, anything else (digits, +, spaces) is treated as a phone number.
  const identifierMode: IdentifierMode = activeIdentifier.includes("@") ? "email" : "phone";

  // Pre-fill last used credential on mount
  useEffect(() => {
    const lastCred = getLastCredential();
    if (lastCred) {
      setIdentifier(lastCred);
    }
  }, []);

  // On mount, detect QR community join intent from URL param or localStorage
  useEffect(() => {
    const qrSlug = searchParams.get("qrCommunityId");
    if (qrSlug) {
      setPendingCommunitySlug(qrSlug);
      // Also persist in localStorage in case user refreshes
      localStorage.setItem("pending_community_join", qrSlug);
    } else {
      // Check localStorage for pending join intent
      const stored = localStorage.getItem("pending_community_join");
      if (stored) {
        setPendingCommunitySlug(stored);
      }
    }
  }, [searchParams]);

  // Handle role preselect from URL (used by market-intent entry points)
  useEffect(() => {
    const roleParam = searchParams.get("role");
    if (!roleParam) return;
    const normalized = roleParam.toLowerCase();
    if (["farmer", "trader", "buyer", "vendor", "transporter", "store"].includes(normalized)) {
      setSelectedRole(normalized as SignupRole);
    }
  }, [searchParams]);

  const handleAuthSuccess = async (result: any) => {
    const { sessionToken, ...user } = result;
    await saveAuth(user, sessionToken);
    saveLastCredential(activeIdentifier);

    if (pendingCommunitySlug) {
      router.push(`/join/community/${pendingCommunitySlug}?from_signup=1`);
    } else {
      router.push("/");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!activeIdentifier) {
        setError(identifierMode === "phone" ? "Phone number is required" : "Email is required");
        setLoading(false);
        return;
      }
      if (!password.trim()) {
        setError("Password is required");
        setLoading(false);
        return;
      }

      const authArgs = {
        email: identifierMode === "email" ? activeIdentifier : undefined,
        phoneNumber: identifierMode === "phone" ? activeIdentifier : undefined,
        password: password.trim(),
      };

      if (authStep === "confirmSignup") {
        if (!isSelectedRoleSignupEnabled) {
          setError(`New account creation is currently disabled for ${selectedRoleLabel}. Existing accounts can still log in.`);
          setLoading(false);
          return;
        }
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

        const signupResult = await signupWithSession({
          ...authArgs,
          role: selectedRole,
        });
        await handleAuthSuccess(signupResult);
      } else {
        try {
          const loginResult = await loginWithSession(authArgs);
          await handleAuthSuccess(loginResult);
        } catch (loginErr: any) {
          const message = typeof loginErr === "string" ? loginErr : loginErr?.message || "Login failed";
          const normalizedMessage = message.toLowerCase();
          const isInvalidCredentials = normalizedMessage.includes("invalid email/phone or password");

          if (isInvalidCredentials) {
            const existsResult = await checkAccountExists({
              email: identifierMode === "email" ? activeIdentifier : undefined,
              phoneNumber: identifierMode === "phone" ? activeIdentifier : undefined,
            });

            if (existsResult?.exists) {
              setError("Invalid credentials. Please try again.");
            } else {
              setAuthStep("confirmSignup");
              setConfirmPassword("");
              setError(`Confirm your password to create a new ${selectedRoleLabel} account.`);
            }
          } else {
            setError(message);
          }
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      const message = typeof err === "string" ? err : err?.message || (authStep === "confirmSignup" ? "Signup failed" : "Login failed");
      setError(message);
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
          justify-content: center;
          min-height: 100vh;
          padding: 0.75rem;
          background: transparent;
          gap: 1rem;
        }
        .f2m-login-card {
          background: #fff;
          padding: 1.1rem 1.25rem;
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
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
          <div>
            <h1 style={{
              fontSize: "1.4rem",
              margin: 0,
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
              margin: "0.15rem 0 0",
              fontSize: "0.75rem",
              fontWeight: "600",
              fontFamily: '"Montserrat", sans-serif',
              letterSpacing: "0.1em",
              textTransform: "uppercase"
            }}>
              Farm. Trace. Grow.
            </p>
          </div>
          {/* TODO: point this at the Google Play Store listing once published; for now it downloads the APK directly. */}
          <a
            href="/api/download/android"
            download="Farm2Market.apk"
            title="Download Android App"
            aria-label="Download Android App"
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "2.25rem",
              height: "2.25rem",
              borderRadius: "50%",
              background: "#e8f5e9",
              border: "1px solid #4caf50",
              fontSize: "1.1rem",
              textDecoration: "none",
            }}
          >
            📲
          </a>
        </div>

        <div style={{ margin: "0.65rem 0 0.5rem" }}>
          <p style={{ margin: 0, color: "#333", fontSize: "0.95rem", fontWeight: 600 }}>
            {authStep === "confirmSignup" ? "Confirm password to create your account." : "Log in to Farm2Market."}
          </p>
          {authStep === "confirmSignup" && (
            <p style={{ margin: "0.3rem 0 0", color: "#666", fontSize: "0.85rem", lineHeight: "1.4" }}>
              We could not find an account with this identifier.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "0.55rem" }}>
            <label style={{ display: "block", marginBottom: "0.3rem", color: "#333", fontWeight: "500", fontSize: "0.9rem" }}>
              Category
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.4rem" }}>
              {SIGNUP_ROLES.map((entry) => {
                const isSelected = selectedRole === entry.value;
                return (
                  <button
                    key={entry.value}
                    type="button"
                    disabled={!entry.signupEnabled}
                    onClick={() => setSelectedRole(entry.value)}
                    style={{
                      padding: "0.4rem 0.55rem",
                      borderRadius: "8px",
                      border: `1px solid ${isSelected ? "#1976d2" : "#ddd"}`,
                      background: !entry.signupEnabled
                        ? (isSelected ? "#fff8e1" : "#f5f5f5")
                        : (isSelected ? "#e3f2fd" : "#fff"),
                      color: !entry.signupEnabled
                        ? (isSelected ? "#ef6c00" : "#777")
                        : (isSelected ? "#1976d2" : "#333"),
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: "0.82rem",
                      cursor: !entry.signupEnabled ? "not-allowed" : "pointer",
                      opacity: !entry.signupEnabled && !isSelected ? 0.85 : 1,
                    }}
                    title={entry.signupEnabled ? "Enabled for signup" : "Signup currently disabled"}
                  >
                    {entry.label}
                  </button>
                );
              })}
            </div>
            {!isSelectedRoleSignupEnabled && (
              <p style={{ marginTop: "0.3rem", marginBottom: 0, fontSize: "0.78rem", color: "#ef6c00", fontWeight: 600 }}>
                  New account creation is currently disabled for {selectedRoleLabel}. Existing accounts can still log in.
              </p>
            )}
          </div>

          <div style={{ marginBottom: "0.55rem" }}>
            <label style={{ display: "block", marginBottom: "0.3rem", color: "#333", fontWeight: "500", fontSize: "0.9rem" }}>
              Phone Number or Email
            </label>
            <input
              type="text"
              inputMode="text"
              autoCapitalize="none"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.6rem 0.7rem",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "0.95rem",
                boxSizing: "border-box",
              }}
              placeholder="07XX XXX XXX or your@email.com"
            />
            {activeIdentifier && (
              <p style={{ marginTop: "0.4rem", marginBottom: 0, fontSize: "0.78rem", color: "#888" }}>
                Detected as {identifierMode === "email" ? "email" : "phone number"}
              </p>
            )}
          </div>

          <div style={{ marginBottom: authStep === "confirmSignup" ? "0.55rem" : "0.85rem" }}>
            <label style={{ display: "block", marginBottom: "0.3rem", color: "#333", fontWeight: "500", fontSize: "0.9rem" }}>
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
                  padding: "0.6rem 0.7rem",
                  paddingRight: "2.5rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "0.95rem",
                  boxSizing: "border-box",
                }}
                placeholder={authStep === "confirmSignup" ? "Create a password (min. 6 characters)" : "Enter your password"}
                minLength={authStep === "confirmSignup" ? 6 : undefined}
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
            {authStep === "confirmSignup" && (
              <p style={{ marginTop: "0.3rem", fontSize: "0.78rem", color: "#666" }}>
                Password must be at least 6 characters long
              </p>
            )}
          </div>

          {authStep === "confirmSignup" && (
            <div style={{ marginBottom: "0.85rem" }}>
              <label style={{ display: "block", marginBottom: "0.3rem", color: "#333", fontWeight: "500", fontSize: "0.9rem" }}>
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
                    padding: "0.6rem 0.7rem",
                    paddingRight: "2.5rem",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "0.95rem",
                    boxSizing: "border-box",
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
              padding: "0.55rem 0.65rem",
              background: error.includes("Confirm your password to create a new") ? "#fff8e1" : "#ffebee",
              border: error.includes("Confirm your password to create a new") ? "1px solid #f6bf26" : "1px solid #ef5350",
              borderRadius: "6px",
              marginBottom: "0.65rem",
              color: error.includes("Confirm your password to create a new") ? "#b26a00" : "#c62828",
              fontSize: "0.85rem",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.65rem",
              background: loading ? "#ccc" : "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: "0.95rem",
              fontWeight: "500",
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading
              ? (authStep === "confirmSignup" ? "Creating account..." : "Logging in...")
              : (authStep === "confirmSignup" ? "Create Account" : "Log in")}
          </button>
        </form>

        {authStep === "confirmSignup" && (
          <div style={{ marginTop: "0.6rem", textAlign: "center" }}>
            <button
              type="button"
              onClick={() => {
                setAuthStep("login");
                setConfirmPassword("");
                setError(null);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#1976d2",
                cursor: "pointer",
                fontSize: "0.85rem",
                textDecoration: "underline"
              }}
            >
              Back to log in
            </button>
          </div>
        )}

        {authStep === "login" && (
          <div style={{ marginTop: "0.6rem", textAlign: "center" }}>
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
                fontSize: "0.85rem"
              }}
            >
              Forgot your password?
            </a>
          </div>
        )}
      </div>
    </main>
    </>
  );
}

