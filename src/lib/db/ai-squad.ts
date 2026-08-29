import { getDb, isMongoConfigured } from "@/lib/db/client";

export const AI_SQUAD_KEY = "default";

export type AiSquadSnapshot = {
  key: string;
  startingXiIds: number[];
  benchIds: number[];
  captainId: number;
  viceId: number;
  updatedAt: string;
};

const COLLECTION = "ai_squad";

export async function getAiSquadSnapshot(
  key = AI_SQUAD_KEY,
): Promise<AiSquadSnapshot | null> {
  if (!isMongoConfigured()) return null;
  const db = await getDb();
  return db.collection<AiSquadSnapshot>(COLLECTION).findOne({ key });
}

export async function saveAiSquadSnapshot(
  snapshot: Omit<AiSquadSnapshot, "updatedAt"> & { updatedAt?: string },
): Promise<void> {
  if (!isMongoConfigured()) {
    throw new Error("MONGODB_URI not configured — cannot persist AI Squad");
  }
  const db = await getDb();
  const doc: AiSquadSnapshot = {
    key: snapshot.key,
    startingXiIds: snapshot.startingXiIds,
    benchIds: snapshot.benchIds,
    captainId: snapshot.captainId,
    viceId: snapshot.viceId,
    updatedAt: snapshot.updatedAt ?? new Date().toISOString(),
  };
  await db.collection<AiSquadSnapshot>(COLLECTION).updateOne(
    { key: doc.key },
    { $set: doc },
    { upsert: true },
  );
}

/** Wipe saved AI Squad so the next page load rebuilds from the model. */
export async function clearAiSquadSnapshot(
  key = AI_SQUAD_KEY,
): Promise<boolean> {
  if (!isMongoConfigured()) {
    throw new Error("MONGODB_URI not configured");
  }
  const db = await getDb();
  const result = await db
    .collection<AiSquadSnapshot>(COLLECTION)
    .deleteOne({ key });
  return result.deletedCount > 0;
}
