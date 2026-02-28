"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";

/**
 * Login Page
 * 
 * User authentication and registration
 */
export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [usePhone, setUsePhone] = useState(false); // Toggle between email and phone
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"farmer" | "trader" | "buyer">("farmer");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();
  
  const login = useMutation(api.auth.login);
  const signup = useMutation(api.auth.signup);

  const getDefaultRedirectForUser = (user: any) => {
    if (user?.role === "admin" && user?.adminLevel === "super") {
      return "/superadmin/dashboard";
    }
    if (user?.role === "admin") {
      if (user?.defaultCommunityId) {
        return `/community-admin/${user.defaultCommunityId}/dashboard`;
      }
      if (user?.assignedCommunityIds?.length > 0) {
        return `/community-admin/${user.assignedCommunityIds[0]}/dashboard`;
      }
      return "/my-communities";
    }
    // Route end-users to their role-specific dashboard
    if (user?.role === "trader") {
      return "/trader/dashboard";
    }
    if (user?.role === "buyer") {
      return "/buyer/dashboard";
    }
    // Default for farmers or any other role
    return "/farmer/dashboard";
  };

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

        // Signup
        const result = await signup({
          email: usePhone ? undefined : email.trim(),
          phoneNumber: usePhone ? phoneNumber.trim() : undefined,
          password: password.trim(),
          role: role,
        });

        // Store user info in localStorage
        localStorage.setItem("pilot_user", JSON.stringify(result));
        
        // Redirect after signup/login
        const redirect = typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("redirect")
          : null;
        router.push(redirect || getDefaultRedirectForUser(result));
      } else {
        // Login
        const result = await login({
          email: usePhone ? undefined : email.trim(),
          phoneNumber: usePhone ? phoneNumber.trim() : undefined,
          password: password.trim(),
        });

        // Store user info in localStorage
        localStorage.setItem("pilot_user", JSON.stringify(result));
        
        // Redirect after signup/login
        const redirect = typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("redirect")
          : null;
        router.push(redirect || getDefaultRedirectForUser(result));
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
    <main style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      padding: "2rem",
      background: "transparent"
    }}>
      <div style={{
        background: "#fff",
        padding: "2rem",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        maxWidth: "400px",
        width: "100%"
      }}>
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
                onChange={(e) => setRole(e.target.value as "farmer" | "trader" | "buyer")}
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
    </main>
  );
}
