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
  { value: "trader", label: "Trader", signupEnabled: false },
  { value: "buyer", label: "Buyer", signupEnabled: false },
  { value: "transporter", label: "Transporter", signupEnabled: false },
  { value: "store", label: "Store", signupEnabled: false },
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
  const [identifierMode, setIdentifierMode] = useState<IdentifierMode>("phone");
  const [phoneIdentifier, setPhoneIdentifier] = useState("");
  const [emailIdentifier, setEmailIdentifier] = useState("");
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

  const isFarmerSignupEnabled = selectedRole === "farmer" || selectedRole === "vendor";
  const selectedRoleLabel = SIGNUP_ROLES.find((role) => role.value === selectedRole)?.label || "Account";
  const activeIdentifier = identifierMode === "phone"
    ? phoneIdentifier.trim()
    : emailIdentifier.trim();

  // Pre-fill last used credential on mount
  useEffect(() => {
    const lastCred = getLastCredential();
    if (lastCred) {
      if (lastCred.includes("@")) {
        setIdentifierMode("email");
        setEmailIdentifier(lastCred);
      } else {
        setIdentifierMode("phone");
        setPhoneIdentifier(lastCred);
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
        if (!isFarmerSignupEnabled) {
          setError("New account creation is currently enabled for Farmer and Vendor only. Existing accounts can still log in.");
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
            {authStep === "confirmSignup" ? "Confirm password to create your account." : "Log in to Farm2Market."}
          </p>
          <p style={{ margin: "0.5rem 0 0", color: "#666", fontSize: "0.9rem", lineHeight: "1.5" }}>
            {authStep === "confirmSignup"
              ? "We could not find an account with this identifier."
              : ""}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <p style={{ marginBottom: "1rem", color: "#666", fontSize: "0.9rem", lineHeight: "1.5" }}>
            {authStep === "confirmSignup"
              ? "Finish account creation by confirming your password."
              : ""}
          </p>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", color: "#333", fontWeight: "500" }}>
              Category
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
              {SIGNUP_ROLES.map((entry) => {
                const isSelected = selectedRole === entry.value;
                return (
                  <button
                    key={entry.value}
                    type="button"
                    disabled={!entry.signupEnabled}
                    onClick={() => setSelectedRole(entry.value)}
                    style={{
                      padding: "0.55rem 0.65rem",
                      borderRadius: "8px",
                      border: `1px solid ${isSelected ? "#1976d2" : "#ddd"}`,
                      background: !entry.signupEnabled
                        ? (isSelected ? "#fff8e1" : "#f5f5f5")
                        : (isSelected ? "#e3f2fd" : "#fff"),
                      color: !entry.signupEnabled
                        ? (isSelected ? "#ef6c00" : "#777")
                        : (isSelected ? "#1976d2" : "#333"),
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: "0.85rem",
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
            {!isFarmerSignupEnabled && (
              <p style={{ marginTop: "0.35rem", marginBottom: 0, fontSize: "0.82rem", color: "#ef6c00", fontWeight: 600 }}>
                  New account creation is currently enabled for Farmer and Vendor only. Existing accounts can still log in.
              </p>
            )}
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", color: "#333", fontWeight: "500" }}>
              {identifierMode === "phone" ? "Phone Number" : "Email Address"}
            </label>
            {identifierMode === "phone" ? (
              <input
                type="tel"
                value={phoneIdentifier}
                onChange={(e) => setPhoneIdentifier(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem"
                }}
                placeholder="07XX XXX XXX or +256 7XX XXX XXX"
              />
            ) : (
              <input
                type="email"
                value={emailIdentifier}
                onChange={(e) => setEmailIdentifier(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1rem"
                }}
                placeholder="your@email.com"
              />
            )}
            <div style={{ marginTop: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setIdentifierMode(identifierMode === "phone" ? "email" : "phone")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#1976d2",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                {identifierMode === "phone" ? "Use email instead" : "Use phone instead"}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: authStep === "confirmSignup" ? "1rem" : "1.5rem" }}>
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
              <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#666" }}>
                Password must be at least 6 characters long
              </p>
            )}
          </div>

          {authStep === "confirmSignup" && (
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
              background: error.includes("Confirm your password to create a new") ? "#fff8e1" : "#ffebee",
              border: error.includes("Confirm your password to create a new") ? "1px solid #f6bf26" : "1px solid #ef5350",
              borderRadius: "6px",
              marginBottom: "1rem",
              color: error.includes("Confirm your password to create a new") ? "#b26a00" : "#c62828"
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
            {loading
              ? (authStep === "confirmSignup" ? "Creating account..." : "Logging in...")
              : (authStep === "confirmSignup" ? "Create Account" : "Log in")}
          </button>
        </form>

        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          {authStep === "confirmSignup" ? (
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
                fontSize: "0.9rem",
                textDecoration: "underline"
              }}
            >
              Back to log in
            </button>
          ) : (
            <></>
          )}
        </div>

        {authStep === "login" && (
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
    </main>
    </>
  );
}

