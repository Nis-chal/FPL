import { getDb, isMongoConfigured } from "@/lib/db/client";

export type ApiCacheDoc = {
  key: string;
  payload: unknown;
  expiresAt: Date;
  updatedAt: Date;
};

const COLLECTION = "api_cache";

export async function getStoredApi<T>(key: string): Promise<T | null> {
  if (!isMongoConfigured()) return null;
  const db = await getDb();
  const doc = await db.collection<ApiCacheDoc>(COLLECTION).findOne({ key });
  if (!doc) return null;
  if (doc.expiresAt.getTime() <= Date.now()) return null;
  return doc.payload as T;
}

export async function setStoredApi<T>(
  key: string,
  payload: T,
  ttlMs: number,
): Promise<void> {
  if (!isMongoConfigured()) return;
  const db = await getDb();
  const now = new Date();
  await db.collection<ApiCacheDoc>(COLLECTION).updateOne(
    { key },
    {
      $set: {
        key,
        payload,
        expiresAt: new Date(now.getTime() + ttlMs),
        updatedAt: now,
      },
    },
    { upsert: true },
  );
}

export async function withStoredApi<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await getStoredApi<T>(key);
  if (hit !== null) return hit;
  const value = await loader();
  await setStoredApi(key, value, ttlMs).catch(() => undefined);
  return value;
}
