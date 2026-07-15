"use client";

import { useQuery } from "convex/react";
import { useEffect, useState, useRef } from "react";
import { useNetwork } from "../context/NetworkContext";
import { offlineDb } from "../lib/offlineDb";
import type { FunctionReference } from "convex/server";

function normalizeActiveCommunitiesResult<T>(data: T, fnName: string): T {
  if (!fnName.includes("getActiveCommunities")) return data;
  if (!Array.isArray(data)) return data;

  let changed = false;
  const normalized = data.map((item: any) => {
    if (!item || typeof item !== "object") return item;
    if (item.id !== undefined || item._id === undefined) return item;
    changed = true;
    return { ...item, id: item._id };
  });

  return (changed ? normalized : data) as T;
}

/**
 * Drop-in replacement for Convex `useQuery` that caches results in IndexedDB
 * and serves cached data when offline.
 *
 * @param queryFn  Convex query reference, e.g. api.farmerDashboard.getFarmerListings
 * @param args     Args object, or "skip" to skip the query
 * @param cacheKey A stable string key for IndexedDB (auto-generated if omitted)
 */
export function useOfflineQuery<Query extends FunctionReference<"query">>(
  queryFn: Query,
  args: Query["_args"] | "skip",
  cacheKey?: string,
): Query["_returnType"] | undefined {
  type T = Query["_returnType"];
  const { isOnline } = useNetwork();
  const [cachedData, setCachedData] = useState<T | undefined>(undefined);
  const cachedDataLoadedRef = useRef(false);

  // Build a stable cache key from the query function name + args
  const fnName = (() => {
    try {
      const n = (queryFn as any)?._name ?? (queryFn as any)?.functionName;
      if (typeof n === "string" && n) return n;
      return JSON.stringify(queryFn) ?? "query";
    } catch {
      return "query";
    }
  })();
  const effectiveKey =
    cacheKey ??
    (queryFn
      ? `${fnName}__${args === "skip" ? "skip" : JSON.stringify(args)}`
      : "");

  // Attempt Convex query (will return undefined when offline / WS disconnected)
  const shouldSkip = args === "skip";
  const liveData = useQuery(queryFn as any, shouldSkip ? "skip" : (args as any)) as T | undefined;

  // Load cached data on mount (and when key changes)
  useEffect(() => {
    if (!effectiveKey) return;
    let cancelled = false;
    offlineDb.queryCache
      .get(effectiveKey)
      .then((entry) => {
        if (!cancelled && entry && entry.data != null) {
          setCachedData(normalizeActiveCommunitiesResult(entry.data as T, fnName));
          cachedDataLoadedRef.current = true;
        }
      })
      .catch(() => {
        // IndexedDB not available — degrade gracefully
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveKey, fnName]);

  // When we get live data, write it to cache
  useEffect(() => {
    if (liveData !== undefined && effectiveKey) {
      const normalizedLiveData = normalizeActiveCommunitiesResult(liveData, fnName);
      offlineDb.queryCache
        .put({
          key: effectiveKey,
          data: normalizedLiveData,
          cachedAt: Date.now(),
        })
        .catch(() => {
          // Silently fail cache write
        });
    }
  }, [liveData, effectiveKey, fnName]);

  // If we have live data, always prefer it (coerce null → undefined for consistency)
  if (liveData !== undefined) {
    const normalizedLiveData = normalizeActiveCommunitiesResult(liveData, fnName);
    return normalizedLiveData ?? undefined;
  }

  // Offline or still loading — return cached data
  if (!isOnline || cachedDataLoadedRef.current) {
    return cachedData ?? undefined;
  }

  // Still loading and online — return undefined (Convex loading state)
  return undefined;
}
