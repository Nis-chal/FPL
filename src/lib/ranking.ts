import type { FormationRank, PriceBounds, RankBy, ScoredPlayer } from "@/lib/types";
import {
  chipPlayerScore,
  pickChipCaptain,
  type ChipMode,
} from "@/lib/chips";
import {
  isOutfieldCaptainCandidate,
  pickOutfieldCaptain,
  pickOutfieldViceCaptain,
} from "@/lib/squad-eligibility";
import {
  currentSeasonScore,
  priorSeasonScore,
  type SeasonBasis,
} from "@/lib/season-basis";

export type { SeasonBasis };

export const RANK_BY_OPTIONS: Array<{ value: RankBy; label: string; hint: string }> = [
  {
    value: "overall",
    label: "Overall",
    hint: "Balanced model score (default)",
  },
  {
    value: "team_rating",
    label: "Team rating",
    hint: "Build / rank for best squad grade ≤£100m",
  },
  {
    value: "xpts",
    label: "xPts/GW",
    hint: "Expected points per gameweek",
  },
  {
    value: "best_start",
    label: "Best start",
    hint: "Most likely to play minutes",
  },
  {
    value: "xgi90",
    label: "xGI/90",
    hint: "Underlying attack rate",
  },
  {
    value: "win_cs",
    label: "Win / CS",
    hint: "Club win & clean-sheet odds",
  },
  {
    value: "price",
    label: "Value",
    hint: "Projection per £m",
  },
  {
    value: "next_game",
    label: "Next game",
    hint: "Horizon = 1 fixture",
  },
  {
    value: "next_5",
    label: "Next 5",
    hint: "Horizon = 5 fixtures",
  },
];

export const SEASON_BASIS_OPTIONS: Array<{
  value: SeasonBasis;
  label: string;
  hint: string;
}> = [
  {
    value: "current",
    label: "This season",
    hint: "Rating from this season only — no prior seasons",
  },
  {
    value: "prior",
    label: "Prior seasons",
    hint: "Blend previous FPL seasons / form into rating",
  },
];

export const PRICE_PRESETS: Array<{
  id: string;
  label: string;
  minPrice: number | null;
  maxPrice: number | null;
}> = [
  { id: "all", label: "All", minPrice: null, maxPrice: null },
  { id: "budget", label: "≤£5.5m", minPrice: null, maxPrice: 55 },
  { id: "mid", label: "£5.5–8.0m", minPrice: 55, maxPrice: 80 },
  { id: "premium", label: "≥£8.0m", minPrice: 80, maxPrice: null },
];

const ALL_RANK_BY: RankBy[] = [
  "overall",
  "team_rating",
  "xpts",
  "price",
  "best_start",
  "xgi90",
  "win_cs",
  "next_game",
  "next_5",
];

export function rankByLabel(rankBy: RankBy | RankBy[]): string {
  const list = normalizeRankBy(rankBy);
  if (list.length === 1) {
    return RANK_BY_OPTIONS.find((o) => o.value === list[0])?.label ?? list[0];
  }
  return list
    .map((r) => RANK_BY_OPTIONS.find((o) => o.value === r)?.label ?? r)
    .join(" + ");
}

export function normalizeRankBy(value: RankBy | RankBy[] | null | undefined): RankBy[] {
  if (!value) return ["overall"];
  const list = Array.isArray(value) ? value : [value];
  const unique = [...new Set(list.filter((r) => ALL_RANK_BY.includes(r)))];
  return unique.length > 0 ? unique : ["overall"];
}

/** Horizon implied by selected modes; null if none of the horizon shortcuts are on. */
export function horizonForRankBy(rankBy: RankBy | RankBy[]): number | null {
  const list = normalizeRankBy(rankBy);
  if (list.includes("next_game")) return 1;
  if (list.includes("next_5")) return 5;
  return null;
}

/** Parse single or comma-separated rankBy from URL/storage. */
export function parseRankByList(
  value: string | null | undefined,
  fallback: RankBy[] = ["overall"],
): RankBy[] {
  if (!value) return fallback;
  const parts = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as RankBy[];
  return normalizeRankBy(parts.length > 0 ? parts : fallback);
}

/** @deprecated Prefer parseRankByList — kept for single-value callers. */
export function parseRankBy(
  value: string | null | undefined,
  fallback: RankBy = "overall",
): RankBy {
  return parseRankByList(value, [fallback])[0] ?? fallback;
}

/**
 * Toggle a mode in a multi-select set.
 * - Overall is exclusive when chosen alone; picking another lens drops Overall.
 * - next_game / next_5 are mutually exclusive with each other.
 * - Deselecting the last mode restores Overall.
 */
export function toggleRankBy(current: RankBy[], mode: RankBy): RankBy[] {
  const set = new Set(normalizeRankBy(current));

  if (mode === "overall") {
    return ["overall"];
  }

  if (set.has(mode)) {
    set.delete(mode);
  } else {
    set.delete("overall");
    if (mode === "next_game") set.delete("next_5");
    if (mode === "next_5") set.delete("next_game");
    set.add(mode);
  }

  if (set.size === 0) return ["overall"];
  return ALL_RANK_BY.filter((r) => set.has(r));
}

export function serializeRankBy(rankBy: RankBy[]): string {
  return normalizeRankBy(rankBy).join(",");
}

export function parsePriceBounds(
  minRaw: string | null | undefined,
  maxRaw: string | null | undefined,
): PriceBounds {
  const minParsed =
    minRaw !== null && minRaw !== undefined && minRaw !== ""
      ? Number(minRaw)
      : null;
  const maxParsed =
    maxRaw !== null && maxRaw !== undefined && maxRaw !== ""
      ? Number(maxRaw)
      : null;
  return {
    minPrice:
      minParsed !== null && Number.isFinite(minParsed) ? minParsed : null,
    maxPrice:
      maxParsed !== null && Number.isFinite(maxParsed) ? maxParsed : null,
  };
}

/** `price` on ScoredPlayer is tenths of a million (e.g. 55 = £5.5m). */
export function filterByPrice(
  players: ScoredPlayer[],
  bounds: PriceBounds,
): ScoredPlayer[] {
  return players.filter((p) => {
    if (bounds.minPrice !== null && p.price < bounds.minPrice) return false;
    if (bounds.maxPrice !== null && p.price > bounds.maxPrice) return false;
    return true;
  });
}

function winCsScore(p: ScoredPlayer): number {
  if (p.position === "GKP" || p.position === "DEF") {
    return p.cleanSheetChance * 0.65 + p.nextWinChance * 0.35;
  }
  return p.nextWinChance;
}

/** Balanced overall score used as the default analysis mode. */
export function overallScore(
  p: ScoredPlayer,
  seasonBasis: SeasonBasis = "current",
): number {
  if (seasonBasis === "prior") return priorSeasonScore(p);
  return currentSeasonScore(p);
}

/** Individual contribution toward team rating (used for ranking + squad build). */
export function playerRatingContribution(
  p: ScoredPlayer,
  seasonBasis: SeasonBasis = "current",
): number {
  if (seasonBasis === "prior") {
    return (
      priorSeasonScore(p) +
      p.startChance * 10 +
      Math.max(0, 5 - p.upcomingAvgDifficulty) * 4
    );
  }
  return (
    p.expectedPointsPerGw * 12 +
    p.startChance * 22 +
    p.attackingThreat * 0.16 +
    p.nextWinChance * 0.12 +
    Math.max(0, 5 - p.upcomingAvgDifficulty) * 8 +
    (p.availabilityFactor < 0.5 ? -15 : 0)
  );
}

/** Raw metric for one lens (higher = better). */
function metricScore(
  p: ScoredPlayer,
  mode: RankBy,
  seasonBasis: SeasonBasis,
): number {
  switch (mode) {
    case "overall":
      return overallScore(p, seasonBasis);
    case "team_rating":
      return playerRatingContribution(p, seasonBasis);
    case "best_start":
      return p.startChance * 100;
    case "xgi90":
      return p.xgi90 * 100;
    case "win_cs":
      return winCsScore(p);
    case "price":
      return p.valueScore * 20;
    case "xpts":
    case "next_game":
    case "next_5":
      return p.expectedPointsPerGw * 10 + p.projectedPoints;
    default:
      return overallScore(p, seasonBasis);
  }
}

/** Combine selected lenses into one comparable score (equal weight, z-scored per metric). */
export function combinedRankScore(
  p: ScoredPlayer,
  rankBy: RankBy | RankBy[],
  norms: Map<RankBy, { min: number; max: number }>,
  seasonBasis: SeasonBasis = "current",
): number {
  const modes = normalizeRankBy(rankBy).filter(
    (m) => m !== "next_game" && m !== "next_5",
  );
  const active = modes.length > 0 ? modes : (["overall"] as RankBy[]);

  let sum = 0;
  for (const mode of active) {
    const raw = metricScore(p, mode, seasonBasis);
    const n = norms.get(mode);
    if (!n || n.max <= n.min) {
      sum += raw;
    } else {
      sum += (raw - n.min) / (n.max - n.min);
    }
  }
  return sum / active.length;
}

function buildNorms(
  players: ScoredPlayer[],
  modes: RankBy[],
  seasonBasis: SeasonBasis,
): Map<RankBy, { min: number; max: number }> {
  const norms = new Map<RankBy, { min: number; max: number }>();
  for (const mode of modes) {
    let min = Infinity;
    let max = -Infinity;
    for (const p of players) {
      const v = metricScore(p, mode, seasonBasis);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = 1;
    norms.set(mode, { min, max });
  }
  return norms;
}

export function sortByRank(
  players: ScoredPlayer[],
  rankBy: RankBy | RankBy[],
  seasonBasis: SeasonBasis = "current",
  chip: ChipMode = "none",
): ScoredPlayer[] {
  if (chip !== "none") {
    return [...players].sort((a, b) => {
      const diff = chipPlayerScore(b, chip) - chipPlayerScore(a, chip);
      if (Math.abs(diff) > 1e-9) return diff;
      return b.projectedPoints - a.projectedPoints;
    });
  }

  const modes = normalizeRankBy(rankBy);
  const scoreModes = modes.filter((m) => m !== "next_game" && m !== "next_5");
  const active = scoreModes.length > 0 ? scoreModes : (["overall"] as RankBy[]);
  const norms = buildNorms(players, active, seasonBasis);

  return [...players].sort((a, b) => {
    const diff =
      combinedRankScore(b, active, norms, seasonBasis) -
      combinedRankScore(a, active, norms, seasonBasis);
    if (Math.abs(diff) > 1e-9) return diff;
    return b.projectedPoints - a.projectedPoints;
  });
}

/** Captain pick respects active rank modes among likely starters (MID/FWD only). */
export function pickCaptain(
  players: ScoredPlayer[],
  rankBy: RankBy | RankBy[],
  seasonBasis: SeasonBasis = "current",
  chip: ChipMode = "none",
): ScoredPlayer | undefined {
  const chipCap = pickChipCaptain(players, chip);
  if (chipCap && isOutfieldCaptainCandidate(chipCap)) return chipCap;

  const pool = players.filter(
    (p) =>
      isOutfieldCaptainCandidate(p) &&
      p.startChance >= 0.5 &&
      p.availabilityFactor >= 0.5,
  );
  const ranked = sortByRank(
    pool.length > 0 ? pool : players.filter(isOutfieldCaptainCandidate),
    rankBy,
    seasonBasis,
    chip,
  );
  return ranked[0];
}

/** Vice captain — next-best outfield starter after captain. */
export function pickViceCaptain(
  players: ScoredPlayer[],
  captain: ScoredPlayer,
  rankBy: RankBy | RankBy[],
  seasonBasis: SeasonBasis = "current",
  chip: ChipMode = "none",
): ScoredPlayer | undefined {
  const rest = players.filter((p) => p.id !== captain.id);
  return (
    pickCaptain(rest, rankBy, seasonBasis, chip) ??
    pickOutfieldViceCaptain(rest, captain, (p) => p.projectedPoints)
  );
}

/** Re-export type for consumers that only import ranking helpers. */
export type { FormationRank };
