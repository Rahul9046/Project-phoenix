import {
  anonymousSession,
  emptyProfile,
  type AuthSession,
} from "@/lib/auth/types";

/**
 * Where the prototype keeps its account state.
 *
 * `localStorage` is the whole persistence layer for now — no cookies, no
 * database, no third-party auth SDK. It is namespaced and versioned so that
 * when a real session arrives this can be deleted without leaving stale data
 * behind in people's browsers.
 */

const STORAGE_KEY = "eraya.session.v1";

/** Bumped when the stored shape changes; older payloads are discarded. */
const SCHEMA_VERSION = 1;

type StoredEnvelope = {
  version: number;
  session: AuthSession;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/**
 * Reads the stored session, tolerating anything unexpected. A corrupted or
 * outdated payload signs the person out rather than crashing the app.
 */
export function readSession(): AuthSession {
  if (!isBrowser()) return anonymousSession;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return anonymousSession;

    const parsed = JSON.parse(raw) as Partial<StoredEnvelope>;
    if (parsed.version !== SCHEMA_VERSION || !parsed.session) {
      localStorage.removeItem(STORAGE_KEY);
      return anonymousSession;
    }

    const session = parsed.session;
    // Merge over the defaults so a field added later is never `undefined`.
    return {
      ...anonymousSession,
      ...session,
      profile: { ...emptyProfile, ...session.profile },
    };
  } catch {
    return anonymousSession;
  }
}

export function writeSession(session: AuthSession): void {
  if (!isBrowser()) return;
  try {
    const envelope: StoredEnvelope = { version: SCHEMA_VERSION, session };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // A full or disabled storage quota should never break the flow — the
    // session simply does not survive a reload.
  }
}

export function clearSession(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do here.
  }
}

export { STORAGE_KEY };
