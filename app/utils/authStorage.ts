/**
 * authStorage — dual-layer auth persistence
 *
 * On web: reads and writes to localStorage (origin-scoped WebView storage).
 * On Capacitor native (Android/iOS): also writes to @capacitor/preferences
 * (backed by SharedPreferences / NSUserDefaults), which survives WebView data
 * clears and is more durable than the embedded browser cache.
 *
 * All other pages in the app continue to read `pilot_user` from localStorage
 * unchanged — this utility simply adds a durable backup layer on native.
 */

import { Capacitor } from "@capacitor/core";

const KEY_USER = "pilot_user";          // keep same key — backward compat
const KEY_TOKEN = "fm_session_token";   // session token for server re-auth
const KEY_LAST_CRED = "fm_last_cred";   // email or phone for login prefill

export type StoredUser = {
  userId: string;
  alias: string;
  role: string;
  adminLevel?: string | null;
  adminCategory?: string | null;
  assignedCommunityIds?: string[];
  sessionToken?: string;
};

/** Lazy-loads the Capacitor Preferences plugin (native only). */
async function getPrefs() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { Preferences } = await import(
      /* webpackIgnore: true */ "@capacitor/preferences"
    );
    return Preferences;
  } catch (error) {
    console.warn("[authStorage] Native Preferences plugin unavailable; falling back to localStorage");
    return null;
  }
}

/**
 * Persist user object and session token to all available storage layers.
 * Call this immediately after a successful login or signup.
 */
export async function saveAuth(user: StoredUser, sessionToken: string): Promise<void> {
  const userWithToken = { ...user, sessionToken };
  const json = JSON.stringify(userWithToken);

  // Always write to localStorage (fast, synchronous, read by all existing pages)
  localStorage.setItem(KEY_USER, json);
  localStorage.setItem(KEY_TOKEN, sessionToken);

  // On native: also write to Preferences (durable storage)
  const prefs = await getPrefs();
  if (prefs) {
    await prefs.set({ key: KEY_USER, value: json });
    await prefs.set({ key: KEY_TOKEN, value: sessionToken });
  }
}

/**
 * Read stored user data.
 * On native, tries Preferences first (survives WebView clears), then localStorage.
 * Restores to localStorage if only found in Preferences (so other pages see it).
 */
export async function getStoredUser(): Promise<StoredUser | null> {
  const prefs = await getPrefs();
  if (prefs) {
    try {
      const { value } = await prefs.get({ key: KEY_USER });
      if (value) {
        const parsed = JSON.parse(value) as StoredUser;
        // Restore to localStorage for backward compat with pages that read it directly
        if (!localStorage.getItem(KEY_USER)) {
          localStorage.setItem(KEY_USER, value);
          if (parsed.sessionToken) {
            localStorage.setItem(KEY_TOKEN, parsed.sessionToken);
          }
        }
        return parsed;
      }
    } catch (error) {
      console.warn("[authStorage] Failed to read/parse native stored user; falling back to localStorage");
    }
  }

  const raw = localStorage.getItem(KEY_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch (error) {
    console.warn("[authStorage] Failed to parse local stored user; returning unauthenticated state");
    return null;
  }
}

/**
 * Read the stored session token only (used for server-side re-validation).
 */
export async function getStoredToken(): Promise<string | null> {
  const prefs = await getPrefs();
  if (prefs) {
    try {
      const { value } = await prefs.get({ key: KEY_TOKEN });
      if (value) return value;
    } catch { /* ignore */ }
  }
  return localStorage.getItem(KEY_TOKEN);
}

/**
 * Clear all stored auth data.
 * Call this on logout or when the server reports the session is invalid.
 */
export async function clearAuth(): Promise<void> {
  localStorage.removeItem(KEY_USER);
  localStorage.removeItem(KEY_TOKEN);

  const prefs = await getPrefs();
  if (prefs) {
    await prefs.remove({ key: KEY_USER });
    await prefs.remove({ key: KEY_TOKEN });
  }
}

/**
 * Save the credential (email or phone) used for the most recent login.
 * Stored in localStorage only — used to pre-fill the login form.
 */
export function saveLastCredential(credential: string): void {
  localStorage.setItem(KEY_LAST_CRED, credential);
}

/** Return the most recently used login credential for pre-fill. */
export function getLastCredential(): string {
  return localStorage.getItem(KEY_LAST_CRED) ?? "";
}
