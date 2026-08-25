import type { FplElement, FplTeam, FixtureView, Position } from "@/lib/types";
import { parseFloatSafe } from "@/lib/utils";

/** Clamp to 0–100. */
export function clampPct(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

const GOAL_POINTS: Record<Position, number> = {
  GKP: 6,
  DEF: 6,
  MID: 5,
  FWD: 4,
};

/**
 * Estimate P(win) for a club's next match from FPL strength ratings + FDR.
 */
export function estimateWinChance(
  team: FplTeam,
  opponent: FplTeam,
  isHome: boolean,
  difficulty: number,
): number {
  const attack = isHome
    ? team.strength_attack_home
    : team.strength_attack_away;
  const defence = isHome
    ? team.strength_defence_home
    : team.strength_defence_away;
  const oppAttack = isHome
    ? opponent.strength_attack_away
    : opponent.strength_attack_home;
  const oppDefence = isHome
    ? opponent.strength_defence_away
    : opponent.strength_defence_home;

  const overall = isHome
    ? team.strength_overall_home
    : team.strength_overall_away;
  const oppOverall = isHome
    ? opponent.strength_overall_away
    : opponent.strength_overall_home;

  const overallDiff = (overall - oppOverall) / 80;
  const attackEdge = (attack - oppDefence) / 90;
  const defenceEdge = (defence - oppAttack) / 90;
  const score = overallDiff * 0.5 + attackEdge * 0.3 + defenceEdge * 0.2;

  let p = 1 / (1 + Math.exp(-score));
  p *= 1.18 - (difficulty - 1) * 0.09;
  if (isHome) p += 0.03;
  return clampPct(p * 100);
}

/**
 * Clean-sheet chance for GK/DEF — driven by defence strength + win chance + FDR.
 */
export function estimateCleanSheetChance(
  team: FplTeam,
  opponent: FplTeam,
  isHome: boolean,
  difficulty: number,
  winChancePct: number,
): number {
  const defence = isHome
    ? team.strength_defence_home
    : team.strength_defence_away;
  const oppAttack = isHome
    ? opponent.strength_attack_away
    : opponent.strength_attack_home;
  const edge = (defence - oppAttack) / 100;
  let p = winChancePct / 100 * 0.52 + 0.12 + edge * 0.15;
  p *= 1.15 - (difficulty - 1) * 0.08;
  if (isHome) p += 0.04;
  return clampPct(p * 100);
}

/**
 * P(player starts / gets meaningful minutes). Minutes dominate FPL.
 * Injured / suspended / unavailable are hard-capped unless FPL lists a chance.
 */
export function estimateStartChance(element: FplElement): number {
  const status = element.status;
  if (status === "u" || status === "i" || status === "s") {
    const chance =
      element.chance_of_playing_next_round ??
      element.chance_of_playing_this_round;
    if (chance === null || chance === undefined) return 0;
    // Hard-cap unavailable players even when FPL lists a residual chance
    return Math.max(0, Math.min(0.35, chance / 100));
  }

  let base = 0.85;
  if (status === "d") {
    const chance =
      element.chance_of_playing_next_round ??
      element.chance_of_playing_this_round ??
      50;
    base = Math.max(0.15, chance / 100);
  } else if (
    element.chance_of_playing_next_round !== null &&
    element.chance_of_playing_next_round !== undefined
  ) {
    base = Math.max(0.15, element.chance_of_playing_next_round / 100);
  }

  // Season minutes share (proxy for role)
  const nineties = Math.max(1, element.minutes / 90);
  // Soft prior: players with 0 minutes early season keep base from status
  if (element.minutes > 0) {
    const avgMin = Math.min(90, element.minutes / Math.max(1, nineties));
    // If typically plays 90 → 1.0, 60 → ~0.85, 20 → ~0.4
    const minutesRole = Math.min(1, 0.25 + avgMin / 100);
    base *= 0.35 + minutesRole * 0.65;
  }

  return Math.max(0.05, Math.min(1, base));
}

/**
 * Per-90 rates with an early-season soft prior: when sample size is tiny,
 * blend toward modest position-agnostic baselines so season totals don't explode.
 */
export function per90Rates(element: FplElement): {
  xg90: number;
  xa90: number;
  xgi90: number;
  xgc90: number;
  nineties: number;
} {
  const rawNineties = element.minutes / 90;
  const nineties = Math.max(0.5, rawNineties);
  const xg = parseFloatSafe(element.expected_goals);
  const xa = parseFloatSafe(element.expected_assists);
  const xgi =
    parseFloatSafe(element.expected_goal_involvements) || xg + xa;
  const xgc = parseFloatSafe(element.expected_goals_conceded);

  let xg90 = xg / nineties;
  let xa90 = xa / nineties;
  let xgi90 = xgi / nineties;
  let xgc90 = xgc / nineties;

  // Early season: < 3 full games → shrink rates toward mild priors
  if (rawNineties < 3) {
    const confidence = Math.max(0.25, rawNineties / 3);
    const priorXg = 0.12;
    const priorXa = 0.1;
    const priorXgi = 0.22;
    const priorXgc = 1.1;
    xg90 = xg90 * confidence + priorXg * (1 - confidence);
    xa90 = xa90 * confidence + priorXa * (1 - confidence);
    xgi90 = xgi90 * confidence + priorXgi * (1 - confidence);
    xgc90 = xgc90 * confidence + priorXgc * (1 - confidence);
  }

  return { xg90, xa90, xgi90, xgc90, nineties };
}

/**
 * Attacking threat 0–100 — prioritises per-90 underlying stats over raw past points.
 */
export function attackingThreatScore(
  element: FplElement,
  position: Position,
): number {
  if (position === "GKP") {
    const { xgc90 } = per90Rates(element);
    const cs = element.clean_sheets;
    const saves = element.saves;
    const base = 50 + cs * 3 + Math.min(18, saves / 10) - xgc90 * 25;
    return clampPct(base);
  }

  const { xg90, xa90, xgi90 } = per90Rates(element);
  const threat = parseFloatSafe(element.threat);
  const creativity = parseFloatSafe(element.creativity);
  const nineties = Math.max(0.5, element.minutes / 90);
  const threat90 = threat / nineties;
  const creat90 = creativity / nineties;

  let score =
    Math.min(38, xgi90 * 55) +
    Math.min(22, xg90 * 50) +
    Math.min(18, xa90 * 45) +
    Math.min(12, threat90 / 8) +
    Math.min(10, creat90 / 12);

  // Set-piece takers get a reliable boost
  if (element.penalties_order === 1) score += 12;
  else if (element.penalties_order === 2) score += 5;
  if (element.corners_and_indirect_freekicks_order === 1) score += 6;
  if (element.direct_freekicks_order === 1) score += 4;

  return clampPct(score);
}

export function difficultyMultiplier(avgDifficulty: number): number {
  if (avgDifficulty <= 2) return 1.22;
  if (avgDifficulty <= 2.5) return 1.12;
  if (avgDifficulty <= 3) return 1.0;
  if (avgDifficulty <= 3.5) return 0.88;
  return 0.76;
}

export function horizonAverageDifficulty(
  fixtures: FixtureView[],
  horizon: number,
): number {
  const slice = fixtures.slice(0, Math.max(1, horizon));
  if (slice.length === 0) return 3;
  return slice.reduce((sum, f) => sum + f.difficulty, 0) / slice.length;
}

export type ExpectedPointsInput = {
  position: Position;
  recentAvgPoints: number;
  startChance: number;
  availabilityFactor: number;
  xg90: number;
  xa90: number;
  xgi90: number;
  xgc90: number;
  attackingThreat: number;
  upcomingFixtures: FixtureView[];
  horizon: number;
  /** Win chance for next match (0–100); used as baseline for CS/attack. */
  nextWinChance: number;
  /** CS chance for next match (0–100). */
  nextCleanSheetChance: number;
  /** Optional FPL official EP next as prior. */
  epNext: number | null;
  penaltiesOrder: number | null;
  /**
   * When true, blend recent accumulated form / FPL EP into the score.
   * When false, rank on underlying expected points only.
   */
  includeAccumulated: boolean;
};

/**
 * Expected points for one fixture given FDR-scaled rates.
 * xPts ≈ P(start) × (appearance + goals + assists + CS − conceded + bonus)
 */
export function expectedPointsForFixture(params: {
  position: Position;
  startChance: number;
  xg90: number;
  xa90: number;
  xgi90: number;
  xgc90: number;
  difficulty: number;
  isHome: boolean;
  winChancePct: number;
  cleanSheetChancePct: number;
  penaltiesOrder: number | null;
}): number {
  const {
    position,
    startChance,
    xg90,
    xa90,
    xgi90,
    xgc90,
    difficulty,
    isHome,
    winChancePct,
    cleanSheetChancePct,
    penaltiesOrder,
  } = params;

  const fdrMult = difficultyMultiplier(difficulty);
  const homeBoost = isHome ? 1.05 : 0.97;
  const attackMult = fdrMult * homeBoost * (0.85 + (winChancePct / 100) * 0.3);

  // Set-piece: pen taker ≈ +0.25 xG equivalent in a typical game
  let adjXg90 = xg90;
  if (penaltiesOrder === 1) adjXg90 += 0.22;
  else if (penaltiesOrder === 2) adjXg90 += 0.08;

  const pStart = startChance;
  const appearance = pStart * 2; // assumes ~60+ mins when starting

  const goalPts = pStart * adjXg90 * attackMult * GOAL_POINTS[position];
  const assistPts = pStart * xa90 * attackMult * 3;

  let csPts = 0;
  let concedePts = 0;
  if (position === "GKP" || position === "DEF") {
    const csChance = (cleanSheetChancePct / 100) * fdrMult;
    csPts = pStart * Math.min(0.65, csChance) * 4;
    // Rough expected goals conceded → -1 per 2 goals
    const egc = Math.max(0.4, xgc90) * (2.2 - fdrMult);
    concedePts = pStart * -(egc / 2);
  }

  // Bonus: weakly tied to underlying involvement
  const bonusPts = pStart * Math.min(1.2, xgi90 * attackMult * 0.55);

  // GK saves (tiny)
  const savePts = position === "GKP" ? pStart * 0.35 : 0;

  return (
    appearance + goalPts + assistPts + csPts + concedePts + bonusPts + savePts
  );
}

/**
 * Full horizon projection: sum of per-fixture xPts, blended lightly with form
 * and FPL's own ep_next (not past points alone).
 */
export function projectPointsForHorizon(input: ExpectedPointsInput): {
  projectedPoints: number;
  expectedPointsPerGw: number;
} {
  const {
    position,
    recentAvgPoints,
    startChance,
    availabilityFactor,
    xg90,
    xa90,
    xgi90,
    xgc90,
    upcomingFixtures,
    horizon,
    nextWinChance,
    nextCleanSheetChance,
    epNext,
    penaltiesOrder,
    includeAccumulated,
  } = input;

  const slice = upcomingFixtures.slice(0, Math.max(1, horizon));
  const effectiveStart = startChance * availabilityFactor;

  let sum = 0;
  if (slice.length === 0) {
    // No fixtures published — fall back to rates × average FDR
    sum =
      expectedPointsForFixture({
        position,
        startChance: effectiveStart,
        xg90,
        xa90,
        xgi90,
        xgc90,
        difficulty: 3,
        isHome: true,
        winChancePct: nextWinChance,
        cleanSheetChancePct: nextCleanSheetChance,
        penaltiesOrder,
      }) * horizon;
  } else {
    for (let i = 0; i < slice.length; i++) {
      const f = slice[i];
      // Decay win/CS slightly for further fixtures (less certainty)
      const decay = 1 - i * 0.04;
      const winPct = Math.max(25, Math.min(75, nextWinChance * decay + 50 * (1 - decay)));
      const csPct = Math.max(
        15,
        Math.min(60, nextCleanSheetChance * decay + 30 * (1 - decay)),
      );
      sum += expectedPointsForFixture({
        position,
        startChance: effectiveStart,
        xg90,
        xa90,
        xgi90,
        xgc90,
        difficulty: f.difficulty,
        isHome: f.isHome,
        winChancePct: winPct,
        cleanSheetChancePct: csPct,
        penaltiesOrder,
      });
    }
  }

  const modelHorizon = sum;
  const modelPerGw = sum / Math.max(1, slice.length || horizon);

  let blended = modelHorizon;
  let perGw = modelPerGw;

  // Hard-cap: no meaningful minutes expected → no projected points
  if (effectiveStart < 0.05) {
    return {
      projectedPoints: 0,
      expectedPointsPerGw: 0,
    };
  }

  if (includeAccumulated) {
    const formHorizon = recentAvgPoints * (slice.length || horizon) * 0.85;
    blended = modelHorizon * 0.72 + formHorizon * 0.18;
    if (epNext !== null && epNext > 0) {
      const epHorizon = epNext * (0.55 * (slice.length || horizon) + 0.45);
      blended = blended * 0.82 + epHorizon * 0.18;
    }
    perGw = blended / Math.max(1, slice.length || horizon);
  }

  if (effectiveStart > 0.5 && blended < 1.5 * (slice.length || 1)) {
    blended = Math.max(blended, effectiveStart * 2 * (slice.length || horizon) * 0.7);
    perGw = blended / Math.max(1, slice.length || horizon);
  }

  return {
    projectedPoints: Number(blended.toFixed(2)),
    expectedPointsPerGw: Number(perGw.toFixed(2)),
  };
}

/** Horizon 1–7 (1 = next game analyze-by). */
export function parseHorizon(value: string | null | undefined, fallback = 5): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(7, Math.max(1, Math.round(n)));
}

export function parseIncludeAccumulated(
  value: string | null | undefined,
  fallback = true,
): boolean {
  if (value === null || value === undefined || value === "") return fallback;
  return value === "1" || value === "true" || value === "on";
}
