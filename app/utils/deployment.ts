/**
 * Deployment Mode Utilities
 * 
 * Provides utilities for detecting and working with deployment modes.
 * Supports "production" (FarmCoin) and "dev" (F2M) deployment modes with separate URLs and databases.
 */

export type DeploymentMode = "production" | "dev";

/**
 * Get the current deployment mode from environment variable
 * 
 * @returns "production" | "dev" (defaults to "production")
 */
export function getDeploymentMode(): DeploymentMode {
  const mode = process.env.NEXT_PUBLIC_DEPLOYMENT_MODE;
  if (mode === "dev" || mode === "production") {
    return mode as DeploymentMode;
  }
  return "production";
}

/**
 * Check if the current deployment is in production mode
 */
export function isProductionMode(): boolean {
  return getDeploymentMode() === "production";
}

/**
 * Check if the current deployment is in dev mode
 */
export function isDevMode(): boolean {
  return getDeploymentMode() === "dev";
}

/**
 * Get a human-readable label for the current deployment mode
 */
export function getDeploymentModeLabel(): string {
  const mode = getDeploymentMode();
  return mode === "dev" ? "F2M (Dev)" : "FarmCoin (Prod)";
}

/**
 * Get the Convex URL from environment variable
 * Each deployment mode should have its own Convex URL configured
 */
export function getConvexUrl(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_CONVEX_URL || "";
  }
  return process.env.NEXT_PUBLIC_CONVEX_URL || "";
}
