import { getDb } from "@/lib/db/client";

type SyncMetaDoc = {
  key: string;
  syncedAt: string;
  playersSynced: number;
  finishedRounds: number[];
};

const COLLECTION = "sync_meta";

export async function setSyncMeta(
  playersSynced: number,
  finishedRounds: number[],
): Promise<void> {
  const db = await getDb();
  await db.collection<SyncMetaDoc>(COLLECTION).updateOne(
    { key: "fpl_player_histories" },
    {
      $set: {
        key: "fpl_player_histories",
        syncedAt: new Date().toISOString(),
        playersSynced,
        finishedRounds,
      },
    },
    { upsert: true },
  );
}

export async function getSyncMeta(): Promise<SyncMetaDoc | null> {
  const db = await getDb();
  return db.collection<SyncMetaDoc>(COLLECTION).findOne({ key: "fpl_player_histories" });
}
