#!/usr/bin/env bun
/**
 * Rebuild the persisted AI Squad from the rating optimiser and save to MongoDB.
 *
 * Usage:
 *   bun run ai:reset
 *   bun run ai:reset -- --clear-only   # wipe only; next /ai visit rebuilds
 */
import { loadEnvLocal } from "../src/lib/load-env.ts";

loadEnvLocal();

import {
  clearAiSquadSnapshot,
  getAiSquadSnapshot,
  saveAiSquadSnapshot,
  AI_SQUAD_KEY,
} from "../src/lib/db/ai-squad.ts";
import { closeDb, isMongoConfigured } from "../src/lib/db/index.ts";
import {
  aiSquadSnapshotFromBuilt,
  buildAiSquad,
} from "../src/lib/ai-squad-build.ts";
import { getLeagueInsights } from "../src/lib/insights.ts";
import { formatPrice } from "../src/lib/utils.ts";

function parseArgs(argv: string[]) {
  return { clearOnly: argv.includes("--clear-only") };
}

async function main() {
  if (!isMongoConfigured()) {
    console.error("MONGODB_URI missing — set it in .env.local");
    process.exit(1);
  }

  const opts = parseArgs(process.argv.slice(2));
  const before = await getAiSquadSnapshot(AI_SQUAD_KEY);

  if (opts.clearOnly) {
    if (!before) {
      console.log("No saved AI Squad in MongoDB — nothing to clear.");
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
    return;
  }

  console.log("Fetching FPL data and building AI Squad (team-rating optimiser)…");
  const insights = await getLeagueInsights(5);
  const built = buildAiSquad(insights.scored);
  const snapshot = aiSquadSnapshotFromBuilt(built);

  if (!snapshot) {
    console.error("Could not build a legal 15 — check FPL data / filters.");
    process.exit(1);
  }

  if (before) {
    await clearAiSquadSnapshot(AI_SQUAD_KEY);
  }

  await saveAiSquadSnapshot({ key: AI_SQUAD_KEY, ...snapshot });

  const names = [...built.startingXi, ...built.bench]
    .map((p) => p.webName)
    .join(", ");
  console.log(
    before
      ? `Replaced AI Squad (was saved ${before.updatedAt}).`
      : "Created new AI Squad.",
  );
  console.log(
    `${built.formation} · ${formatPrice(built.totalCost)} · C: ${built.captain.webName} · VC: ${built.viceCaptain.webName}`,
  );
  console.log(`Players: ${names}`);
  console.log("Refresh /ai to see the updated squad.");

  await closeDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
