"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo, useEffect } from "react";
import { getDeploymentMode, getConvexUrl } from "./utils/deployment";
import { NetworkProvider } from "./context/NetworkContext";
import { OfflineBanner } from "./components/OfflineBanner";
import { setSyncClient } from "./lib/syncService";

export function Providers({ children }: { children: ReactNode }) {
  const deploymentMode = useMemo(() => getDeploymentMode(), []);
  const convexUrl = useMemo(() => getConvexUrl(), []);
  
  const convex = useMemo(() => {
    if (!convexUrl) {
      console.warn("NEXT_PUBLIC_CONVEX_URL is not set. Convex features will not work.");
      return null;
    }
    try {
      console.log(`[${deploymentMode.toUpperCase()}] Creating Convex client with URL:`, convexUrl);
      const client = new ConvexReactClient(convexUrl);
      console.log(`[${deploymentMode.toUpperCase()}] Convex client created successfully`);
      return client;
    } catch (error) {
      console.error(`[${deploymentMode.toUpperCase()}] Failed to create Convex client:`, error);
      return null;
    }
  }, [convexUrl, deploymentMode]);

  // Register the Convex client with the sync service for offline mutation replay
  useEffect(() => {
    if (convex) {
      setSyncClient(convex);
    }
  }, [convex]);

  // Early GPS permission prompt — ask once on app load so location is ready when needed
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => { /* permission granted, no-op */ },
        () => { /* denied or unavailable, no-op */ },
        { timeout: 5000 }
      );
    }
  }, []);

  if (!convex) {
    console.warn(`[${deploymentMode.toUpperCase()}] Convex client is null - rendering without provider`);
    return (
      <NetworkProvider>
        {children}
        <OfflineBanner />
      </NetworkProvider>
    );
  }
  
  console.log(`[${deploymentMode.toUpperCase()}] Rendering with ConvexProvider`);
  return (
    <ConvexProvider client={convex}>
      <NetworkProvider>
        {children}
        <OfflineBanner />
      </NetworkProvider>
    </ConvexProvider>
  );
}
