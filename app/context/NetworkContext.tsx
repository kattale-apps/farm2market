"use client";

import React, { createContext, useContext, useEffect, useRef } from "react";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { flushPendingMutations } from "../lib/syncService";

interface NetworkContextValue {
  isOnline: boolean;
}

const NetworkContext = createContext<NetworkContextValue>({ isOnline: true });

export function useNetwork() {
  return useContext(NetworkContext);
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const { isOnline } = useNetworkStatus();
  const prevOnlineRef = useRef(isOnline);

  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    const isNowOnline = isOnline;
    prevOnlineRef.current = isOnline;

    if (wasOffline && isNowOnline) {
      // Came back online — flush queued mutations
      flushPendingMutations().catch((err) => {
        console.error("[SyncService] flush failed:", err);
      });
    }
  }, [isOnline]);

  return (
    <NetworkContext.Provider value={{ isOnline }}>
      {children}
    </NetworkContext.Provider>
  );
}
