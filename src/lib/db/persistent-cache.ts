import { getCached, setCached } from "@/lib/cache";
import { getStoredApi, setStoredApi } from "@/lib/db/api-cache";
import { isMongoConfigured } from "@/lib/db/client";

/**
 * Memory → MongoDB → loader.
 * Cuts redundant FPL / API-Football calls across restarts and serverless invocations.
 */
export async function withPersistentCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const mem = getCached<T>(key);
  if (mem !== null) return mem;

  if (isMongoConfigured()) {
    try {
      const stored = await getStoredApi<T>(key);
      if (stored !== null) {
        return setCached(key, stored, ttlMs);
      }
    } catch {
      // Mongo optional — fall through to network
    }
  }

  const value = await loader();
  setCached(key, value, ttlMs);

  if (isMongoConfigured()) {
    await setStoredApi(key, value, ttlMs).catch(() => undefined);
  }

  return value;
}
