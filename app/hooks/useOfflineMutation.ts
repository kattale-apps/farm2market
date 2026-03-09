"use client";

import { useMutation } from "convex/react";
import { useCallback, useRef } from "react";
import { useNetwork } from "../context/NetworkContext";
import { offlineDb } from "../lib/offlineDb";

/**
 * Drop-in replacement for Convex `useMutation` that queues mutations
 * in IndexedDB when offline and executes them normally when online.
 *
 * @param mutationFn Convex mutation reference
 * @param meta       Optional metadata to store with the pending mutation (e.g. { expectedCoins: 5 })
 * @returns          A function with the same signature as the mutation, plus `{ queued: true }` when offline
 */
export function useOfflineMutation<Args extends Record<string, any>, Result = any>(
  mutationFn: any,
  meta?: Record<string, any>,
): (args: Args) => Promise<Result | { queued: true }> {
  const { isOnline } = useNetwork();
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  const liveMutation = useMutation(mutationFn);
  const mutationPath =
    (mutationFn as any)?._name ??
    (mutationFn as any)?.name ??
    String(mutationFn);

  const execute = useCallback(
    async (args: Args): Promise<Result | { queued: true }> => {
      if (isOnlineRef.current) {
        // Online: execute immediately as normal
        return liveMutation(args) as Promise<Result>;
      }

      // Offline: queue in IndexedDB
      await offlineDb.pendingMutations.add({
        mutationPath,
        args,
        timestamp: Date.now(),
        status: "pending",
        meta: meta ?? undefined,
      });

      return { queued: true };
    },
    [liveMutation, mutationPath, meta],
  );

  return execute;
}
