type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const store = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry.value as T;
}

/** Expired cache kept for graceful fallback when upstream is down. */
export function getStaleCached<T>(key: string, graceMs: number): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt + graceMs) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number): T {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export async function withCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = getCached<T>(key);
  if (hit !== null) return hit;
  const value = await loader();
  return setCached(key, value, ttlMs);
}

export async function withCacheStaleFallback<T>(
  key: string,
  ttlMs: number,
  staleGraceMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = getCached<T>(key);
  if (hit !== null) return hit;
  try {
    const value = await loader();
    return setCached(key, value, ttlMs);
  } catch (err) {
    const stale = getStaleCached<T>(key, staleGraceMs);
    if (stale !== null) return stale;
    throw err;
  }
}
