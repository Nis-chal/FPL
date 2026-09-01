import { getBootstrap, getElementSummary, getFixtures } from "@/lib/fpl-client";
import { upsertPlayerHistory } from "@/lib/db/player-history";
import { setSyncMeta } from "@/lib/db/sync-meta";
import { isMongoConfigured } from "@/lib/db/client";
import { getFinishedGameweeks, POSITION_MAP } from "@/lib/utils";
import type { Position } from "@/lib/types";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type SyncFplOptions = {
  playerLimit?: number;
  fetchDelayMs?: number;
  onProgress?: (msg: string) => void;
};

export async function syncFplToMongo(
  options: SyncFplOptions = {},
): Promise<{ synced: number; finishedRounds: number[] }> {
  if (!isMongoConfigured()) {
    throw new Error(
      "MONGODB_URI not configured — set it in .env.local with your Atlas password.",
    );
  }

  const playerLimit = options.playerLimit ?? 600;
  const fetchDelayMs = options.fetchDelayMs ?? 120;
  const log = options.onProgress ?? (() => undefined);

  const [bootstrap, fixtures] = await Promise.all([
    getBootstrap(),
    getFixtures(),
  ]);
  const finishedRounds = getFinishedGameweeks(bootstrap.events, fixtures);

  const pool = bootstrap.elements
    .filter((el) => el.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, playerLimit);

  log(
    `Syncing ${pool.length} players to MongoDB (GWs ${finishedRounds.join(", ") || "none"})…`,
  );

  let synced = 0;
  for (let i = 0; i < pool.length; i++) {
    const el = pool[i]!;
    log(`[${i + 1}/${pool.length}] ${el.web_name}`);
    try {
      const summary = await getElementSummary(el.id);
      const position = POSITION_MAP[el.element_type] as Position;
      await upsertPlayerHistory({
        playerId: el.id,
        webName: el.web_name,
        teamId: el.team,
        position,
        minutes: el.minutes,
        history: summary.history,
        syncedAt: new Date().toISOString(),
      });
      synced += 1;
    } catch (err) {
      log(
        `  skip ${el.web_name}: ${err instanceof Error ? err.message : err}`,
      );
    }
    if (i < pool.length - 1) await sleep(fetchDelayMs);
  }

  await setSyncMeta(synced, finishedRounds);
  log(`Done — ${synced} players in fpl_assistant.player_histories`);
  return { synced, finishedRounds };
}
