import {
  clearSession,
  readSession,
  writeSession,
  STORAGE_KEY,
} from "@/lib/auth/session-storage";
import { anonymousSession, type AuthSession } from "@/lib/auth/types";

/**
 * `localStorage` treated as what it is — an external store React subscribes to
 * rather than state React owns.
 *
 * This shape is what `useSyncExternalStore` expects, which means the session
 * survives a reload, stays consistent across tabs, and renders correctly on the
 * server without any state being copied around inside an effect.
 */

/**
 * The snapshot must be referentially stable between reads or React will loop.
 * It is parsed once and then held until something changes it.
 */
let cache: AuthSession | null = null;

const listeners = new Set<() => void>();
let storageListenerAttached = false;

function emit(): void {
  for (const listener of listeners) listener();
}

function handleStorageEvent(event: StorageEvent): void {
  // `key === null` means the whole store was cleared.
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  cache = null;
  emit();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (!storageListenerAttached && typeof window !== "undefined") {
    window.addEventListener("storage", handleStorageEvent);
    storageListenerAttached = true;
  }

  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): AuthSession {
  if (cache === null) cache = readSession();
  return cache;
}

/**
 * There is no session on the server — it lives in the browser. Rendering as
 * signed-out is correct, and the client corrects it immediately after
 * hydration.
 */
export function getServerSnapshot(): AuthSession {
  return anonymousSession;
}

/** Writes through to storage and tells every subscriber. */
export function setStoredSession(next: AuthSession): AuthSession {
  cache = next;
  writeSession(next);
  emit();
  return next;
}

export function resetStoredSession(): AuthSession {
  cache = anonymousSession;
  clearSession();
  emit();
  return cache;
}

/**
 * `false` while rendering on the server and during the very first client
 * render, `true` afterwards. Lets a screen wait for the real session instead of
 * acting on the signed-out placeholder.
 */
export const hydration = {
  subscribe: () => () => {},
  getSnapshot: () => true,
  getServerSnapshot: () => false,
};
