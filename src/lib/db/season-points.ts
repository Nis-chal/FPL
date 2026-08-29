import {
  accumulatedSeasonPoints,
  historyToGwRows,
} from "@/lib/season-accumulated";
import type { ScoredPlayer } from "@/lib/types";
import { isMongoConfigured } from "@/lib/db/client";
import { getPlayerHistories } from "@/lib/db/player-history";

export type SeasonPointsEnrichment = {
  players: ScoredPlayer[];
  /** True when at least one player was enriched from MongoDB GW history. */
  fromDatabase: boolean;
  /** Players with a history document in MongoDB. */
  matchedInDb: number;
};

/**
 * Attach seasonPointsAccumulated from MongoDB player_histories when available.
 * Falls back to bootstrap total_points on each player.
 */
export async function enrichScoredWithSeasonPoints(
  players: ScoredPlayer[],
): Promise<SeasonPointsEnrichment> {
  const withBootstrap = players.map((p) => ({
    ...p,
    seasonPointsAccumulated: p.totalPoints,
  }));

  if (!isMongoConfigured() || players.length === 0) {
    return { players: withBootstrap, fromDatabase: false, matchedInDb: 0 };
  }

  try {
    const histories = await getPlayerHistories(players.map((p) => p.id));
    let matchedInDb = 0;

    const enriched = withBootstrap.map((p) => {
      const history = histories.get(p.id);
      if (!history || history.length === 0) return p;
      matchedInDb += 1;
      return {
        ...p,
        seasonPointsAccumulated: accumulatedSeasonPoints(history),
        seasonGwPlayed: history.length,
        seasonPointsFromDb: true as const,
        gwPointsHistory: historyToGwRows(history),
      };
    });

    return {
      players: enriched,
      fromDatabase: matchedInDb > 0,
      matchedInDb,
    };
  } catch {
    return { players: withBootstrap, fromDatabase: false, matchedInDb: 0 };
  }
}
