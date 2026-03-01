"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resetUrl, setResetUrl] = useState("");
  const [needsEmail, setNeedsEmail] = useState(false);

  const requestReset = useMutation(api.auth.requestPasswordReset);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload: { identifier: string; recoveryEmail?: string } = {
        identifier,
      };
      if (needsEmail && recoveryEmail) {
        payload.recoveryEmail = recoveryEmail;
      }

      const result = await requestReset(payload);

      if (result.success) {
        setSuccess(true);
        setNeedsEmail(false);
        if ((result as any).resetUrl) {
          setResetUrl((result as any).resetUrl);
        }
      } else if ((result as any).needsEmail) {
        setNeedsEmail(true);
        setError(result.message || "Please provide a recovery email.");
      } else {
        setError(result.message || "Failed to send reset link");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Reset Link Ready
            </h1>
            <p className="text-gray-600">
              If an account exists with that information, a password reset link has been generated.
            </p>
          </div>

          {/* Pilot mode: Show reset URL directly */}
          {resetUrl && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm font-semibold text-yellow-800 mb-2">
                🚧 Pilot Mode - Development Only
              </p>
              <p className="text-xs text-yellow-700 mb-2">
                Click below to reset your password:
              </p>
              <Link
                href={resetUrl}
                className="text-xs text-blue-600 hover:underline break-all"
              >
                {resetUrl}
              </Link>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => router.push("/login")}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
            >
              Back to Login
            </button>
            <button
              onClick={() => {
                setSuccess(false);
                setIdentifier("");
                setRecoveryEmail("");
                setResetUrl("");
                setNeedsEmail(false);
              }}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🔑</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Forgot Password?
          </h1>
          <p className="text-gray-600">
            Enter your phone number or email and we&apos;ll help you reset your password
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number or Email
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="0771234567 or your@email.com"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {needsEmail && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recovery Email
              </label>
              <p className="text-xs text-gray-500 mb-1">
                Your account has no email on file. Provide one to receive your reset link.
              </p>
              <input
                type="email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !identifier || (needsEmail && !recoveryEmail)}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-green-600 hover:text-green-700 font-medium"
            >
              ← Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
