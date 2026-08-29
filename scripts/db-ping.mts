#!/usr/bin/env bun
/** Verify MongoDB Atlas connection and list collections. */
import { loadEnvLocal } from "../src/lib/load-env.ts";

loadEnvLocal();

import { closeDb, countPlayerHistories, FPL_DB_NAME, getDb, isMongoConfigured } from "../src/lib/db/index.ts";
import { getSyncMeta } from "../src/lib/db/sync-meta.ts";
import { listBacktestRuns } from "../src/lib/db/backtest-runs.ts";

async function main() {
  if (!isMongoConfigured()) {
    console.error(
      "MONGODB_URI missing or still has <db_password> — edit .env.local",
    );
    process.exit(1);
  }

  const db = await getDb();
  const collections = await db.listCollections().toArray();
  const players = await countPlayerHistories();
  const meta = await getSyncMeta();
  const runs = await listBacktestRuns(3);

  console.log(`Connected to database: ${FPL_DB_NAME}`);
  console.log(`Collections: ${collections.map((c) => c.name).join(", ") || "(none yet)"}`);
  console.log(`player_histories: ${players} documents`);
  if (meta) {
    console.log(
      `Last sync: ${meta.syncedAt} · ${meta.playersSynced} players · GWs ${meta.finishedRounds.join(", ")}`,
    );
  }
  if (runs.length > 0) {
    console.log("Recent backtests:");
    for (const r of runs) {
      console.log(
        `  ${r.generatedAt} · MAE ${r.overall.mae} · n=${r.samples}`,
      );
    }
  }
  await closeDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
