import Dexie, { type Table } from "dexie";

export interface QueryCacheEntry {
  key: string;
  data: any;
  cachedAt: number;
}

export interface FormDraftEntry {
  id?: number;
  compositeKey: string; // `${userId}_${formType}_${formId || communityId}`
  formType: string;
  userId: string;
  communityId?: string;
  formId?: string;
  data: any;
  savedAt: number;
}

export type MutationStatus = "pending" | "synced" | "failed";

export interface PendingMutationEntry {
  id?: number;
  mutationPath: string;
  args: any;
  timestamp: number;
  status: MutationStatus;
  errorMsg?: string;
  meta?: Record<string, any>; // e.g. { expectedCoins: 5 }
}

/**
 * A crop check done without network. It holds the photo itself, which the
 * generic pendingMutations queue cannot, and is sent by the Diagnostics page
 * once the phone is back online.
 */
export interface DiagnosticDraftEntry {
  clientId: string;
  userId: string;
  communityId: string;
  host: string;
  symptomTags: string[];
  checkedAt: number; // getUgandaTime() on the phone
  photo?: Blob;
  status: "pending" | "failed";
  errorMsg?: string;
}

class FarmCoinOfflineDB extends Dexie {
  queryCache!: Table<QueryCacheEntry, string>;
  formDrafts!: Table<FormDraftEntry, number>;
  pendingMutations!: Table<PendingMutationEntry, number>;
  diagnosticDrafts!: Table<DiagnosticDraftEntry, string>;

  constructor() {
    super("FarmCoinOfflineDB");
    this.version(1).stores({
      queryCache: "key",
      formDrafts: "++id, compositeKey, userId, formType",
      pendingMutations: "++id, status, timestamp",
    });
    // Version 2 only adds a table; data saved under version 1 is kept.
    this.version(2).stores({
      diagnosticDrafts: "clientId, userId, status",
    });
  }
}

export const offlineDb = new FarmCoinOfflineDB();
