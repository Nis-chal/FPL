#!/usr/bin/env bun
/**
 * Clear the persisted AI Squad so the next /ai page load rebuilds from the model.
 *
 * Usage:
 *   bun run ai:reset
 */
import { loadEnvLocal } from "../src/lib/load-env.ts";

loadEnvLocal();

import {
  clearAiSquadSnapshot,
  getAiSquadSnapshot,
  AI_SQUAD_KEY,
} from "../src/lib/db/ai-squad.ts";
import { closeDb, isMongoConfigured } from "../src/lib/db/index.ts";

async function main() {
  if (!isMongoConfigured()) {
    console.error("MONGODB_URI missing — set it in .env.local");
    process.exit(1);
  }

  const before = await getAiSquadSnapshot(AI_SQUAD_KEY);
  if (!before) {
    console.log("No saved AI Squad in MongoDB — nothing to clear.");
    console.log("Open /ai once to create one; run this script again to reset.");
    await closeDb();
    return;
  }

  const deleted = await clearAiSquadSnapshot(AI_SQUAD_KEY);
  console.log(
    deleted
      ? `Cleared AI Squad (${before.startingXiIds.length + before.benchIds.length} players, saved ${before.updatedAt}).`
      : "Delete returned 0 — check MongoDB.",
  );
  console.log("Refresh /ai in the browser to rebuild from the model.");
  await closeDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
