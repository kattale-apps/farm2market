"use client";

import { useEffect, useRef, useCallback } from "react";
import { offlineDb } from "../lib/offlineDb";

/**
 * Auto-save form data to IndexedDB and restore on mount.
 *
 * @param userId      Current user ID
 * @param formType    A category string, e.g. "tracker", "profile", "agrofresh"
 * @param formId      Specific form/template ID (or communityId as fallback)
 * @param data        Current form data (serialisable object)
 * @param onRestore   Callback receiving restored data if a draft exists
 * @param debounceMs  Debounce interval for saves (default 2000ms)
 */
export function useFormDraftPersistence(
  userId: string | null | undefined,
  formType: string,
  formId: string | null | undefined,
  data: any,
  onRestore: (data: any) => void,
  debounceMs = 2000,
) {
  const compositeKey = userId && formId ? `${userId}_${formType}_${formId}` : "";
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  // Restore on mount
  useEffect(() => {
    if (!compositeKey || restoredRef.current) return;
    let cancelled = false;
    offlineDb.formDrafts
      .where("compositeKey")
      .equals(compositeKey)
      .first()
      .then((entry) => {
        if (!cancelled && entry) {
          onRestoreRef.current(entry.data);
        }
        restoredRef.current = true;
      })
      .catch(() => {
        restoredRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [compositeKey]);

  // Debounced save whenever data changes
  useEffect(() => {
    if (!compositeKey || !restoredRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      offlineDb.formDrafts
        .where("compositeKey")
        .equals(compositeKey)
        .first()
        .then((existing) => {
          const entry = {
            compositeKey,
            formType,
            userId: userId!,
            formId: formId ?? undefined,
            data,
            savedAt: Date.now(),
          };
          if (existing?.id) {
            return offlineDb.formDrafts.update(existing.id, entry);
          } else {
            return offlineDb.formDrafts.add(entry);
          }
        })
        .catch(() => {
          // Silently fail
        });
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [compositeKey, data, formType, userId, formId, debounceMs]);
}

/**
 * Remove a form draft from IndexedDB after successful submission.
 */
export async function clearFormDraft(
  userId: string,
  formType: string,
  formId: string,
): Promise<void> {
  const compositeKey = `${userId}_${formType}_${formId}`;
  const entry = await offlineDb.formDrafts
    .where("compositeKey")
    .equals(compositeKey)
    .first();
  if (entry?.id) {
    await offlineDb.formDrafts.delete(entry.id);
  }
}
