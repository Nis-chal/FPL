import type { PriceBounds, RankBy, ScoredPlayer } from "@/lib/types";

export const RANK_BY_OPTIONS: Array<{ value: RankBy; label: string }> = [
  { value: "xpts", label: "xPts/GW" },
  { value: "best_start", label: "Best start" },
  { value: "xgi90", label: "xGI/90" },
  { value: "win_cs", label: "Win / CS" },
  { value: "price", label: "Price / value" },
  { value: "next_game", label: "Next game" },
  { value: "next_5", label: "Next 5 games" },
];

export const PRICE_PRESETS: Array<{
  id: string;
  label: string;
  minPrice: number | null;
  maxPrice: number | null;
}> = [
  { id: "all", label: "All", minPrice: null, maxPrice: null },
  { id: "budget", label: "Budget ≤£5.5m", minPrice: null, maxPrice: 55 },
  { id: "mid", label: "Mid £5.5–£8.0m", minPrice: 55, maxPrice: 80 },
  { id: "premium", label: "Premium ≥£8.0m", minPrice: 80, maxPrice: null },
];

/** Horizon implied by analyze-by mode; null means keep current custom horizon. */
export function horizonForRankBy(rankBy: RankBy): number | null {
  if (rankBy === "next_game") return 1;
  if (rankBy === "next_5") return 5;
  return null;
}

export function parseRankBy(
  value: string | null | undefined,
  fallback: RankBy = "xpts",
): RankBy {
  const allowed: RankBy[] = [
    "xpts",
    "price",
    "best_start",
    "xgi90",
    "win_cs",
    "next_game",
    "next_5",
  ];
  if (value && (allowed as string[]).includes(value)) return value as RankBy;
  return fallback;
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

export function sortByRank(
  players: ScoredPlayer[],
  rankBy: RankBy,
): ScoredPlayer[] {
  const sorted = [...players];
  switch (rankBy) {
    case "best_start":
      return sorted.sort(
        (a, b) =>
          b.startChance - a.startChance ||
          b.expectedPointsPerGw - a.expectedPointsPerGw,
      );
    case "xgi90":
      return sorted.sort(
        (a, b) => b.xgi90 - a.xgi90 || b.expectedPointsPerGw - a.expectedPointsPerGw,
      );
    case "win_cs":
      return sorted.sort(
        (a, b) =>
          winCsScore(b) - winCsScore(a) ||
          b.expectedPointsPerGw - a.expectedPointsPerGw,
      );
    case "price":
      return sorted.sort(
        (a, b) =>
          b.valueScore - a.valueScore || a.price - b.price,
      );
    case "next_game":
    case "next_5":
    case "xpts":
    default:
      return sorted.sort(
        (a, b) =>
          b.expectedPointsPerGw - a.expectedPointsPerGw ||
          b.projectedPoints - a.projectedPoints,
      );
  }
}

/** Captain pick respects active rank mode among likely starters. */
export function pickCaptain(
  players: ScoredPlayer[],
  rankBy: RankBy,
): ScoredPlayer | undefined {
  const pool = players.filter(
    (p) => p.startChance >= 0.5 && p.availabilityFactor >= 0.5,
  );
  const ranked = sortByRank(pool.length > 0 ? pool : players, rankBy);
  return ranked[0];
}
