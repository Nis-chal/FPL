import type { ElementHistory, ScoredPlayer } from "@/lib/types";

export type GwPointsRow = {
  round: number;
  points: number;
  minutes: number;
};

export type GwPointsFilterMode = "total" | "through" | "week";

export type GwPointsFilter = {
  mode: GwPointsFilterMode;
  gameweek: number;
};

export function historyToGwRows(history: ElementHistory[]): GwPointsRow[] {
  return history
    .map((h) => ({
      round: h.round,
      points: h.total_points,
      minutes: h.minutes,
    }))
    .sort((a, b) => a.round - b.round);
}

/** Sum of FPL points across all finished GWs in element-summary history. */
export function accumulatedSeasonPoints(history: ElementHistory[]): number {
  return history.reduce((sum, row) => sum + row.total_points, 0);
}

export function pointsThroughGameweek(
  rows: GwPointsRow[] | undefined,
  gameweek: number,
): number | null {
  if (!rows?.length) return null;
  return rows
    .filter((r) => r.round <= gameweek)
    .reduce((sum, r) => sum + r.points, 0);
}

export function pointsForGameweek(
  rows: GwPointsRow[] | undefined,
  gameweek: number,
): number | null {
  if (!rows?.length) return null;
  const row = rows.find((r) => r.round === gameweek);
  return row != null ? row.points : null;
}

export function playerSeasonPoints(player: ScoredPlayer): number {
  return player.seasonPointsAccumulated ?? player.totalPoints;
}

/** This gameweek's points for one player (live → history → bootstrap event_points). */
export function playerCurrentGwPoints(
  player: ScoredPlayer,
  gameweek?: number,
): number | null {
  if (player.livePoints != null) return player.livePoints;
  if (gameweek != null) {
    const fromHistory = pointsForGameweek(player.gwPointsHistory, gameweek);
    if (fromHistory != null) return fromHistory;
  }
  // Bootstrap `event_points` tracks FPL is_current — use when history lacks that GW.
  if (player.eventPoints != null) return player.eventPoints;
  return null;
}

/** Sum of this gameweek's points; captain is doubled when captainId is set. */
export function squadCurrentGwPoints(
  players: ScoredPlayer[],
  gameweek?: number,
  captainId?: number,
): number {
  return players.reduce((sum, p) => {
    const pts = playerCurrentGwPoints(p, gameweek);
    if (pts == null) return sum;
    return sum + (captainId != null && p.id === captainId ? pts * 2 : pts);
  }, 0);
}

/** Points shown for the active GW filter (null = needs db:sync for per-GW). */
export function playerFilteredPoints(
  player: ScoredPlayer,
  filter: GwPointsFilter,
): number | null {
  const rows = player.gwPointsHistory;
  if (!rows?.length) return filter.mode === "total" ? playerSeasonPoints(player) : null;

  switch (filter.mode) {
    case "total":
      return playerSeasonPoints(player);
    case "through":
      return pointsThroughGameweek(rows, filter.gameweek);
    case "week":
      return pointsForGameweek(rows, filter.gameweek);
    default:
      return playerSeasonPoints(player);
  }
}

export function filterLabel(filter: GwPointsFilter): string {
  switch (filter.mode) {
    case "total":
      return "Season total";
    case "through":
      return `Through GW${filter.gameweek}`;
    case "week":
      return `GW${filter.gameweek} only`;
    default:
      return "Points";
  }
}

export function squadFilteredPoints(
  players: ScoredPlayer[],
  filter: GwPointsFilter,
): number {
  return players.reduce((sum, p) => {
    const pts = playerFilteredPoints(p, filter);
    return sum + (pts ?? playerSeasonPoints(p));
  }, 0);
}

export function squadSeasonPoints(players: ScoredPlayer[]): number {
  return players.reduce((sum, p) => sum + playerSeasonPoints(p), 0);
}

export function xiSeasonPoints(startingXi: ScoredPlayer[]): number {
  return startingXi.reduce((sum, p) => sum + playerSeasonPoints(p), 0);
}

export function maxFinishedGameweek(
  finishedGameweeks: number[],
  fallback = 1,
): number {
  if (finishedGameweeks.length === 0) return fallback;
  return Math.max(...finishedGameweeks);
}
