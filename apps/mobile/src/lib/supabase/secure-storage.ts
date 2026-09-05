import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Where the session token lives.
 *
 * Supabase's React Native examples reach for AsyncStorage. AsyncStorage is a
 * plain unencrypted file on disk, readable by anything with access to the app's
 * sandbox -- which is fine for a theme preference and not fine for a bearer
 * token that grants access to somebody's private conversations. This uses the
 * platform keystore instead: Keychain on iOS, EncryptedSharedPreferences via the
 * Android Keystore on Android.
 *
 * The complication is that SecureStore caps a single value at 2048 bytes and a
 * Supabase session -- two JWTs plus the user object -- comfortably exceeds that.
 * So values are split into numbered chunks, with a small header recording how
 * many there are. Writing the header last and deleting it first means a write
 * interrupted halfway reads back as absent rather than as a corrupt session,
 * which the client recovers from by asking the person to sign in again.
 *
 * A read that throws returns null rather than propagating. A keystore that is
 * temporarily unavailable -- device locked during a background refresh, a
 * restored backup on a new device -- should send someone to the sign-in screen,
 * not crash the app.
 *
 * ---------------------------------------------------------------------------
 * The web branch
 * ---------------------------------------------------------------------------
 * SecureStore has no web implementation and throws if called there. Eraya does
 * not ship a web build of this app -- the web product is the Next.js one -- but
 * `expo start --web` is how the mobile layouts get inspected at a phone
 * viewport during development, and the app has to boot for that to be possible.
 *
 * So the fallback is an in-memory map, deliberately, and not `localStorage`. A
 * token in localStorage is readable by any script on the origin and survives a
 * reload, which is exactly the shipping-a-security-regression-by-accident this
 * comment exists to prevent. In memory it dies with the tab, which makes the
 * fallback useless for anything but looking at screens -- which is the point.
 */

const CHUNK_SIZE = 1800;
const HEADER_SUFFIX = "__chunks";

function chunkKey(key: string, index: number) {
  return `${key}__${index}`;
}

async function clearChunks(key: string, count: number) {
  const deletions: Promise<void>[] = [];
  for (let i = 0; i < count; i += 1) {
    deletions.push(SecureStore.deleteItemAsync(chunkKey(key, i)));
  }
  await Promise.all(deletions);
}

async function readChunkCount(key: string): Promise<number> {
  const header = await SecureStore.getItemAsync(`${key}${HEADER_SUFFIX}`);
  if (!header) return 0;
  const count = Number.parseInt(header, 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

/** Development only. See the note above: never persisted, never on a device. */
const previewStore = new Map<string, string>();

const useKeystore = Platform.OS !== "web";

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!useKeystore) return previewStore.get(key) ?? null;

    try {
      const count = await readChunkCount(key);
      if (count === 0) return null;

      const parts = await Promise.all(
        Array.from({ length: count }, (_, i) =>
          SecureStore.getItemAsync(chunkKey(key, i)),
        ),
      );

      // A missing chunk means a torn write. Treat the whole value as absent.
      if (parts.some((part) => part === null)) return null;
      return parts.join("");
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (!useKeystore) {
      previewStore.set(key, value);
      return;
    }

    try {
      const previous = await readChunkCount(key);

      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE));
      }

      await Promise.all(
        chunks.map((chunk, index) =>
          SecureStore.setItemAsync(chunkKey(key, index), chunk),
        ),
      );

      // Header last: until it lands, the value reads as absent rather than as a
      // half-written session.
      await SecureStore.setItemAsync(
        `${key}${HEADER_SUFFIX}`,
        String(chunks.length),
      );

      // A shorter value than last time leaves orphans behind it.
      if (previous > chunks.length) {
        const stale: Promise<void>[] = [];
        for (let i = chunks.length; i < previous; i += 1) {
          stale.push(SecureStore.deleteItemAsync(chunkKey(key, i)));
        }
        await Promise.all(stale);
      }
    } catch {
      // Nothing useful to do here. The next read returns null and the person is
      // asked to sign in, which is the correct failure for a keystore write.
    }
  },

  async removeItem(key: string): Promise<void> {
    if (!useKeystore) {
      previewStore.delete(key);
      return;
    }

    try {
      const count = await readChunkCount(key);
      // Header first, so a partial delete still reads as signed out.
      await SecureStore.deleteItemAsync(`${key}${HEADER_SUFFIX}`);
      await clearChunks(key, count);
    } catch {
      // Same reasoning as above.
    }
  },
};
