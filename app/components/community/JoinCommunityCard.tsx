"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Join a Community Card Component
 * 
 * Provides entry point for users to join communities via:
 * 1. Manual slug/URL input
 * 2. QR code (opens input modal)
 */
export function JoinCommunityCard() {
  const router = useRouter();
  const [showInput, setShowInput] = useState(false);
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setSlug(value);
    setError("");
  };

  const extractSlugFromUrl = (input: string): string | null => {
    // Try to extract slug from full URL
    const urlMatch = input.match(/\/join\/community\/([a-z0-9\-]+)/i);
    if (urlMatch) {
      return urlMatch[1].toLowerCase();
    }

    // Check if it's already a slug (alphanumeric with hyphens)
    if (/^[a-z0-9\-]+$/.test(input.toLowerCase())) {
      return input.toLowerCase();
    }

    return null;
  };

  const handleJoin = async () => {
    if (!slug.trim()) {
      setError("Please enter a community slug or join link");
      return;
    }

    const extractedSlug = extractSlugFromUrl(slug);
    if (!extractedSlug) {
      setError("Invalid slug or link. Please check and try again.");
      return;
    }

    // Redirect to join page
    router.push(`/join/community/${extractedSlug}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleJoin();
    }
  };

  if (showInput) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 max-w-md mx-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Join a Community</h2>
        <p className="text-sm text-gray-600 mb-6">
          Enter the community slug or paste a join link below
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Community Slug or Join Link
          </label>
          <input
            type="text"
            value={slug}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="e.g., dei-farm or https://farm2marketuganda.com/join/community/dei-farm"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            autoFocus
          />
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleJoin}
            className="flex-1 px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            Join Community
          </button>
          <button
            onClick={() => {
              setShowInput(false);
              setSlug("");
              setError("");
            }}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6 max-w-md mx-auto">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Join a Community</h2>
        <p className="text-sm text-gray-600 mb-6">
          Scan a QR or enter a join link to access trading, updates, and messaging.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => setShowInput(true)}
            className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Enter Join Code
          </button>

          <button
            onClick={() => setShowInput(true)}
            className="w-full px-4 py-3 bg-white text-gray-700 font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Scan QR
          </button>
        </div>
      </div>
    </div>
  );
}
