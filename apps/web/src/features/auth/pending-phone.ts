import type { PhoneNumber } from "@/features/auth/types";

/**
 * The phone number being verified, held between the phone screen and the code
 * screen.
 *
 * Deliberately *not* a database column. Until an SMS provider is chosen the
 * number is unverified and means nothing; once Supabase phone auth is live it
 * belongs to `auth.users.phone`, written by Supabase itself. Storing an
 * unverified number on the profile in the meantime would create a field that
 * has to be migrated away later.
 *
 * `sessionStorage` rather than `localStorage`: this is one attempt at one
 * verification, and it should not outlive the tab. It is also never put in the
 * URL — a phone number does not belong in a browser history entry or a server
 * log.
 */

const STORAGE_KEY = "eraya.pending-phone.v1";

let cache: PhoneNumber | null = null;
let hasRead = false;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function read(): PhoneNumber | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PhoneNumber>;
    if (!parsed.countryCode || !parsed.nationalNumber) return null;
    return {
      countryCode: parsed.countryCode,
      nationalNumber: parsed.nationalNumber,
    };
  } catch {
    return null;
  }
}

export function subscribePendingPhone(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable snapshot — parsed once, then held until something changes it. */
export function getPendingPhone(): PhoneNumber | null {
  if (!hasRead) {
    cache = read();
    hasRead = true;
  }
  return cache;
}

/** No pending verification exists on the server. */
export function getPendingPhoneServerSnapshot(): PhoneNumber | null {
  return null;
}

export function setPendingPhone(phone: PhoneNumber): void {
  cache = phone;
  hasRead = true;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(phone));
  } catch {
    // Private browsing or a full quota. The flow still works within the page;
    // only a reload loses the number, which sends them back one screen.
  }
  emit();
}

export function clearPendingPhone(): void {
  cache = null;
  hasRead = true;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do.
  }
  emit();
}

/**
 * `false` on the server and during the first client render, `true` after.
 * Screens that depend on the pending number wait for this rather than acting
 * on a null that only means "not read yet".
 */
export const pendingPhoneHydration = {
  subscribe: () => () => {},
  getSnapshot: () => true,
  getServerSnapshot: () => false,
};
