import type { ElementHistory, Position } from "@/lib/types";
import { getDb } from "@/lib/db/client";

export type PlayerHistoryDoc = {
  playerId: number;
  webName: string;
  teamId: number;
  position: Position;
  minutes: number;
  history: ElementHistory[];
  syncedAt: string;
};

const COLLECTION = "player_histories";

export async function upsertPlayerHistory(doc: PlayerHistoryDoc): Promise<void> {
  const db = await getDb();
  await db.collection<PlayerHistoryDoc>(COLLECTION).updateOne(
    { playerId: doc.playerId },
    { $set: doc },
    { upsert: true },
  );
}

export async function getPlayerHistory(
  playerId: number,
): Promise<ElementHistory[] | null> {
  const db = await getDb();
  const doc = await db
    .collection<PlayerHistoryDoc>(COLLECTION)
    .findOne({ playerId });
  return doc?.history ?? null;
}

export async function getPlayerHistories(
  playerIds: number[],
): Promise<Map<number, ElementHistory[]>> {
  const db = await getDb();
  const docs = await db
    .collection<PlayerHistoryDoc>(COLLECTION)
    .find({ playerId: { $in: playerIds } })
    .toArray();
  const map = new Map<number, ElementHistory[]>();
  for (const d of docs) map.set(d.playerId, d.history);
  return map;
}

export async function countPlayerHistories(): Promise<number> {
  const db = await getDb();
  return db.collection(COLLECTION).countDocuments();
}

export async function listTopPlayerIdsByMinutes(
  limit: number,
): Promise<number[]> {
  const db = await getDb();
  const docs = await db
    .collection<PlayerHistoryDoc>(COLLECTION)
    .find({}, { projection: { playerId: 1 } })
    .sort({ minutes: -1 })
    .limit(limit)
    .toArray();
  return docs.map((d) => d.playerId);
}
