"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function LogoMigrationPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const navContext = useQuery(api.communities.getMyNavigationContext);
  const runMigration = useMutation(api.admin.runLogoMigration);

  const [loadingStatus, setLoadingStatus] = useState<string>("");

  const handleRunMigration = async () => {
    if (!navContext?.userId) {
      setError("No user ID found. Please ensure you are logged in as a superadmin.");
      return;
    }

    try {
      setIsRunning(true);
      setError(null);
      setResult(null);
      setLoadingStatus("Initializing...");
      
      console.log("🚀 [1/3] Starting migration with adminId:", navContext.userId);
      setLoadingStatus("Calling migration mutation...");
      
      console.log("👤 User is superadmin:", navContext.isSuperadmin);
      console.log("[2/3] About to call runMigration mutation...");
      
      const migrationResult = await runMigration({
        adminId: navContext.userId,
      });
      
      console.log("✅ [3/3] Migration result received:", migrationResult);
      setLoadingStatus("Processing results...");
      
      if (!migrationResult) {
        console.warn("⚠️ Migration returned null/undefined");
        setError("Migration completed but returned no data. Check console for details.");
        return;
      }
      
      console.log("✨ Setting result state with:", migrationResult);
      setLoadingStatus("Complete!");
      setResult(migrationResult);
      
      // Show success banner
      setTimeout(() => {
        if (!result) {
          console.log("✅ Result should now be displayed");
        }
      }, 500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("❌ [ERROR] Migration failed:", errorMessage);
      console.error("Full error object:", err);
      console.error("Stack:", err instanceof Error ? err.stack : "No stack");
      setLoadingStatus(`ERROR: ${errorMessage}`);
      setError(`Migration failed: ${errorMessage}`);
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

        {!navContext.isSuperadmin && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-amber-800 text-sm">
              Superadmin verification is not detected for this session. The migration button is visible, but execution will still be validated by backend permissions.
            </p>
          </div>
        )}

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
          <div className="flex flex-col gap-4">
            <button
              onClick={handleRunMigration}
              disabled={isRunning}
              className={`
                px-8 py-4 rounded-lg font-semibold text-white transition-colors w-full
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
                  Running Migration... (check console for details)
                </span>
              ) : (
                "Run Logo Migration"
              )}
            </button>
            {isRunning && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{loadingStatus || 'Processing...'}</span>
                </div>
                <p className="text-xs text-blue-700">Check your browser console (F12) to see detailed logs</p>
              </div>
            )}
          </div>
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
                onClick={() => {
                  window.location.href = "/superadmin/dashboard";
                }}
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
