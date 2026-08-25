import type { PastSeasonStats, ScoredPlayer } from "@/lib/types";

export type SeasonBasis = "current" | "prior";

/** Rating with this season only (no form / prior-season blend). */
export function currentSeasonScore(p: ScoredPlayer): number {
  return (
    p.expectedPointsPerGw * 2.5 * p.startChance +
    p.xgi90 * 18 +
    p.attackingThreat * 0.05 +
    Math.max(0, 5 - p.upcomingAvgDifficulty) * 4 +
    (p.availabilityFactor < 0.5 ? -10 : 0)
  );
}

/**
 * Rating that blends longer-term / prior-season signal.
 * Uses form + optional past pts/90 when available on the player object.
 */
export function priorSeasonScore(
  p: ScoredPlayer,
  pastPts90?: number | null,
): number {
  const past = pastPts90 != null && pastPts90 > 0 ? pastPts90 : p.form;
  return (
    p.projectedPoints * 0.35 +
    p.expectedPointsPerGw * 1.6 * p.startChance +
    past * 4.5 +
    p.form * 2.5 +
    p.attackingThreat * 0.05 +
    (p.availabilityFactor < 0.5 ? -10 : 0)
  );
}

export function averagePastSeasonPoints(seasons: PastSeasonStats[]): number {
  const slice = seasons.slice(0, 3);
  if (slice.length === 0) return 0;
  return (
    slice.reduce((s, x) => s + x.total_points, 0) / Math.max(1, slice.length)
  );
}
