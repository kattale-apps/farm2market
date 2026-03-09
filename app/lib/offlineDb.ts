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

class FarmCoinOfflineDB extends Dexie {
  queryCache!: Table<QueryCacheEntry, string>;
  formDrafts!: Table<FormDraftEntry, number>;
  pendingMutations!: Table<PendingMutationEntry, number>;

  constructor() {
    super("FarmCoinOfflineDB");
    this.version(1).stores({
      queryCache: "key",
      formDrafts: "++id, compositeKey, userId, formType",
      pendingMutations: "++id, status, timestamp",
    });
  }
}

export const offlineDb = new FarmCoinOfflineDB();
