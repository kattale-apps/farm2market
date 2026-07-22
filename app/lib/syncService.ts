import { ConvexReactClient } from "convex/react";
import { offlineDb, type MutationStatus } from "./offlineDb";
import { api } from "../../convex/_generated/api";

type ApiType = typeof api;
type NestedValue<T, P extends string> = P extends `${infer K}.${infer R}`
  ? K extends keyof T
    ? NestedValue<T[K], R>
    : never
  : P extends keyof T
    ? T[P]
    : never;

function resolveMutationFn(path: string): any {
  const normalizedPath = path.includes(":") ? path.replace(":", ".") : path;
  const parts = normalizedPath.split(".");
  let ref: any = api;
  for (const p of parts) {
    ref = ref?.[p];
    if (!ref) return undefined;
  }
  return ref;
}

let _convexClient: ConvexReactClient | null = null;

/**
 * Call once at app startup to give the sync service access to the Convex client.
 */
export function setSyncClient(client: ConvexReactClient) {
  _convexClient = client;
}

/**
 * Replay all pending mutations in order. Safe to call multiple times;
 * already-synced rows are skipped.
 */
export async function flushPendingMutations(): Promise<{
  synced: number;
  failed: number;
}> {
  if (!_convexClient) {
    console.warn("[SyncService] No Convex client set — skipping flush");
    return { synced: 0, failed: 0 };
  }

  const pending = await offlineDb.pendingMutations
    .where("status")
    .equals("pending")
    .sortBy("timestamp");

  let synced = 0;
  let failed = 0;

  for (const entry of pending) {
    const mutationFn = resolveMutationFn(entry.mutationPath);
    if (!mutationFn) {
      await offlineDb.pendingMutations.update(entry.id!, {
        status: "failed" as MutationStatus,
        errorMsg: `Unknown mutation path: ${entry.mutationPath}`,
      });
      failed++;
      continue;
    }

    try {
      const result = await (_convexClient as any).mutation(mutationFn, entry.args);
      await offlineDb.pendingMutations.update(entry.id!, {
        status: "synced" as MutationStatus,
        meta: { ...entry.meta, serverResult: result },
      });
      synced++;
    } catch (err: any) {
      await offlineDb.pendingMutations.update(entry.id!, {
        status: "failed" as MutationStatus,
        errorMsg: err?.message || String(err),
      });
      failed++;
    }
  }

  if (synced > 0 || failed > 0) {
    console.log(`[SyncService] Flush complete: ${synced} synced, ${failed} failed`);
  }

  return { synced, failed };
}

/**
 * Get recently-synced mutations that have server results (e.g. for showing
 * post-sync FarmCoin toasts).
 */
export async function getRecentlySyncedWithMeta(
  since: number,
): Promise<Array<{ mutationPath: string; meta?: Record<string, any> }>> {
  const rows = await offlineDb.pendingMutations
    .where("status")
    .equals("synced")
    .filter((row) => row.timestamp >= since)
    .toArray();
  return rows.map((r) => ({ mutationPath: r.mutationPath, meta: r.meta }));
}

/**
 * Clean up old synced/failed entries (older than 24h by default).
 */
export async function cleanupOldEntries(maxAgeMs = 86_400_000): Promise<number> {
  const cutoff = Date.now() - maxAgeMs;
  const old = await offlineDb.pendingMutations
    .where("timestamp")
    .below(cutoff)
    .filter((row) => row.status !== "pending")
    .toArray();
  const ids = old.map((r) => r.id!).filter(Boolean);
  await offlineDb.pendingMutations.bulkDelete(ids);
  return ids.length;
}
