import { expectedPointsForFixture } from "@/lib/probabilities";
import { pickCaptain } from "@/lib/ranking";
import { buildRecommendedSquad } from "@/lib/squad";
import type { ChipMode } from "@/lib/chips";
import type { BestSquad, ScoredPlayer } from "@/lib/types";

export type ChipTimingPick = {
  chip: Exclude<ChipMode, "none">;
  label: string;
  gameweek: number;
  score: number;
  detail: string;
};

/** Single-GW projected points from fixture row on the player. */
export function projectedPointsForGameweek(
  player: ScoredPlayer,
  gameweek: number,
): number {
  const fx = player.upcomingFixtures.find((f) => f.event === gameweek);
  if (!fx) return 0;

  return expectedPointsForFixture({
    position: player.position,
    startChance: player.startChance,
    xg90: player.xg90,
    xa90: player.xa90,
    xgi90: player.xgi90,
    xgc90: player.xgc90,
    difficulty: fx.difficulty,
    isHome: fx.isHome,
    winChancePct: player.nextWinChance,
    cleanSheetChancePct: player.cleanSheetChance,
    penaltiesOrder: player.isPenTaker ? 1 : null,
  });
}

function withGameweekProjection(
  players: ScoredPlayer[],
  gameweek: number,
): ScoredPlayer[] {
  return players.map((p) => {
    const gwPts = projectedPointsForGameweek(p, gameweek);
    return {
      ...p,
      projectedPoints: gwPts,
      expectedPointsPerGw: gwPts,
    };
  });
}

function bestTripleCaptainGw(
  startingXi: ScoredPlayer[],
  gameweeks: number[],
): ChipTimingPick | null {
  let best: ChipTimingPick | null = null;

  for (const gw of gameweeks) {
    const pool = withGameweekProjection(startingXi, gw);
    const captain = pickCaptain(pool, ["overall"]);
    if (!captain) continue;
    const capPts = projectedPointsForGameweek(captain, gw);
    if (capPts <= 0) continue;
    const tcExtra = capPts;
    if (!best || tcExtra > best.score) {
      best = {
        chip: "triple_captain",
        label: "Triple Captain",
        gameweek: gw,
        score: Number(tcExtra.toFixed(1)),
        detail: `${captain.webName} · ~${capPts.toFixed(1)} pts × extra captain boost`,
      };
    }
  }
  return best;
}

function bestBenchBoostGw(
  bench: ScoredPlayer[],
  gameweeks: number[],
): ChipTimingPick | null {
  let best: ChipTimingPick | null = null;

  for (const gw of gameweeks) {
    const benchPts = bench.reduce(
      (sum, p) => sum + projectedPointsForGameweek(p, gw),
      0,
    );
    if (benchPts <= 0) continue;
    if (!best || benchPts > best.score) {
      best = {
        chip: "bench_boost",
        label: "Bench Boost",
        gameweek: gw,
        score: Number(benchPts.toFixed(1)),
        detail: `Bench ~${benchPts.toFixed(1)} xPts from ${bench.length} players`,
      };
    }
  }
  return best;
}

function bestFreeHitGw(
  scored: ScoredPlayer[],
  gameweeks: number[],
): ChipTimingPick | null {
  let best: ChipTimingPick | null = null;

  for (const gw of gameweeks) {
    const pool = withGameweekProjection(scored, gw);
    const squad = buildRecommendedSquad(pool, 1000, 1, ["overall"], "free_hit");
    const xiTotal = squad.startingXi.reduce(
      (sum, p) => sum + projectedPointsForGameweek(p, gw),
      0,
    );
    if (xiTotal <= 0) continue;
    if (!best || xiTotal > best.score) {
      best = {
        chip: "free_hit",
        label: "Free Hit",
        gameweek: gw,
        score: Number(xiTotal.toFixed(1)),
        detail: `Optimal FH XI ~${xiTotal.toFixed(1)} xPts · ${squad.formation}`,
      };
    }
  }
  return best;
}

export function recommendChipTiming(params: {
  scored: ScoredPlayer[];
  bestSquad: BestSquad;
  upcomingGameweeks: number[];
}): ChipTimingPick[] {
  const { scored, bestSquad, upcomingGameweeks } = params;
  const gws = upcomingGameweeks.filter((gw) => gw > 0).slice(0, 8);
  if (gws.length === 0) return [];

  const picks: ChipTimingPick[] = [];
  const tc = bestTripleCaptainGw(bestSquad.startingXi, gws);
  const bb = bestBenchBoostGw(bestSquad.bench, gws);
  const fh = bestFreeHitGw(scored, gws);
  if (tc) picks.push(tc);
  if (bb) picks.push(bb);
  if (fh) picks.push(fh);
  return picks;
}
