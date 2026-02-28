"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";

export default function LogoMigrationPage() {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const navContext = useQuery(api.communities.getMyNavigationContext);
  const runMigration = useMutation(api.admin.runLogoMigration);

  const handleRunMigration = async () => {
    if (!navContext?.userId) {
      setError("No user ID found");
      return;
    }

    try {
      setIsRunning(true);
      setError(null);
      const migrationResult = await runMigration({
        adminId: navContext.userId,
      });
      setResult(migrationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsRunning(false);
    }
  };

  // Loading state
  if (!navContext) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user is superadmin
  if (!navContext.isSuperadmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">SuperAdmin Only</h1>
            <p className="text-gray-600 mb-6">
              This page is only accessible to superadmins.
            </p>
            <button
              onClick={() => router.push("/")}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Community Logo Migration
          </h1>
          <p className="text-gray-600">
            This tool updates community records with the correct logo paths from the /public folder.
          </p>
        </div>

        {/* Logo Mapping Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Logo Mappings</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="font-medium text-gray-900">BioFarm</span>
              <span className="text-sm text-gray-600 font-mono">/biofarmlogo.jpeg</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="font-medium text-gray-900">DEI CASSAVA GROWERS</span>
              <span className="text-sm text-gray-600 font-mono">/deilogo.png</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
              <span className="font-medium text-gray-900">AgroFresh</span>
              <span className="text-sm text-gray-600 font-mono">/agrofreshlogo.png</span>
            </div>
          </div>
        </div>

        {/* Migration Button */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Run Migration</h2>
          <p className="text-gray-600 mb-4">
            Click the button below to update all community records with their correct logo paths.
            This will only update communities that don&apos;t already have logos assigned.
          </p>
          <button
            onClick={handleRunMigration}
            disabled={isRunning}
            className={`
              px-8 py-4 rounded-lg font-semibold text-white transition-colors w-full md:w-auto
              ${
                isRunning
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }
            `}
          >
            {isRunning ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Running Migration...
              </span>
            ) : (
              "Run Logo Migration"
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-red-900 mb-1">Error</h3>
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success Result */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <svg
                className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-900 mb-1">Migration Complete</h3>
                <p className="text-green-800 mb-4">{result.message}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div className="bg-white rounded-lg p-4 border border-green-200">
                    <div className="text-sm text-gray-600 mb-1">Total Communities</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {result.totalCommunities}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-green-200">
                    <div className="text-sm text-gray-600 mb-1">Updated</div>
                    <div className="text-2xl font-bold text-green-600">
                      {result.updatedCount}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-green-200">
                    <div className="text-sm text-gray-600 mb-1">Skipped</div>
                    <div className="text-2xl font-bold text-gray-600">
                      {result.totalCommunities - result.updatedCount}
                    </div>
                  </div>
                </div>

                {/* Detailed Results */}
                {result.results && result.results.length > 0 && (
                  <div className="bg-white rounded-lg border border-green-200 p-4 max-h-96 overflow-y-auto">
                    <h4 className="font-semibold text-gray-900 mb-3">Community Details</h4>
                    <div className="space-y-2">
                      {result.results.map((item: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded"
                        >
                          <span className="text-sm font-medium text-gray-900">
                            {item.name}
                          </span>
                          <div className="flex items-center gap-2">
                            {item.logoPath && (
                              <span className="text-xs text-gray-600 font-mono px-2 py-1 bg-white rounded border border-gray-200">
                                {item.logoPath}
                              </span>
                            )}
                            <span className="text-xs font-medium">
                              {item.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => router.push("/superadmin/dashboard")}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Run Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
