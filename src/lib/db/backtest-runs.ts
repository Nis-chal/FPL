import type { ObjectId } from "mongodb";
import type { BacktestReport } from "@/lib/backtest";
import { getDb } from "@/lib/db/client";

export type BacktestRunDoc = BacktestReport & {
  _id?: ObjectId;
  savedAt: string;
};

const COLLECTION = "backtest_runs";

export async function saveBacktestRun(report: BacktestReport): Promise<string> {
  const db = await getDb();
  const doc: BacktestRunDoc = {
    ...report,
    savedAt: new Date().toISOString(),
  };
  const result = await db.collection<BacktestRunDoc>(COLLECTION).insertOne(doc);
  return String(result.insertedId);
}

export async function getLatestBacktestRun(): Promise<BacktestRunDoc | null> {
  const db = await getDb();
  return db
    .collection<BacktestRunDoc>(COLLECTION)
    .findOne({}, { sort: { generatedAt: -1 } });
}

export async function listBacktestRuns(limit = 10): Promise<BacktestRunDoc[]> {
  const db = await getDb();
  return db
    .collection<BacktestRunDoc>(COLLECTION)
    .find({})
    .sort({ generatedAt: -1 })
    .limit(limit)
    .toArray();
}
