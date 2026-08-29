#!/usr/bin/env bun
/**
 * Pull FPL element-summary history into MongoDB Atlas.
 *
 * Usage:
 *   bun run db:sync
 *   bun run db:sync -- --limit 150 --delay 100
 */
import { loadEnvLocal } from "../src/lib/load-env.ts";

loadEnvLocal();

import { closeDb, countPlayerHistories, getSyncMeta } from "../src/lib/db/index.ts";
import { withPersistentCache } from "../src/lib/db/persistent-cache.ts";
import { syncFplToMongo } from "../src/lib/db/sync-fpl.ts";
import { getBootstrap, getFixtures } from "../src/lib/fpl-client.ts";

const ACTIVE_TTL = 75 * 1000;
const LIVE_TTL = 25 * 1000;

async function warmFplApiCache(): Promise<void> {
  const bootstrap = await getBootstrap();
  const ttl = bootstrap.events.some((e) => e.is_current && !e.finished)
    ? LIVE_TTL
    : ACTIVE_TTL;
  await withPersistentCache("fpl:bootstrap", ACTIVE_TTL, async () => bootstrap);
  await withPersistentCache("fpl:fixtures", ttl, () => getFixtures());
}

function parseArgs(argv: string[]) {
  let limit = 600;
  let delay = 120;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit" || a === "-n") limit = Number(argv[++i]) || limit;
    else if (a === "--delay") delay = Number(argv[++i]) || delay;
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: bun run db:sync [-- options]

Options:
  --limit, -n <n>   Max players to sync (default 600, by minutes)
  --delay <ms>      Pause between FPL API calls (default 120)
`);
      process.exit(0);
    }
  }
  return { limit, delay };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log("Warming FPL bootstrap + fixtures cache in MongoDB…");
  await warmFplApiCache();
  const result = await syncFplToMongo({
    playerLimit: opts.limit,
    fetchDelayMs: opts.delay,
    onProgress: (msg) => console.log(msg),
  });
  const total = await countPlayerHistories();
  const meta = await getSyncMeta();
  console.log("\nSync complete");
  console.log(`  Players this run: ${result.synced}`);
  console.log(`  Total in DB: ${total}`);
  console.log(`  Last sync: ${meta?.syncedAt ?? "—"}`);
  await closeDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
