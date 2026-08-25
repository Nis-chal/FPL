import type { ScoredPlayer } from "@/lib/types";

/** Active FPL chip lens for analysis / squad building. */
export type ChipMode = "none" | "triple_captain" | "bench_boost" | "free_hit";

export const CHIP_OPTIONS: Array<{
  value: ChipMode;
  label: string;
  short: string;
  hint: string;
}> = [
  {
    value: "none",
    label: "No chip",
    short: "None",
    hint: "Standard rankings and squad build",
  },
  {
    value: "triple_captain",
    label: "Triple Captain",
    short: "TC",
    hint: "Prioritise a high-ceiling captain (start + xPts)",
  },
  {
    value: "bench_boost",
    label: "Bench Boost",
    short: "BB",
    hint: "Maximise all 15 — favour reliable minutes on the bench",
  },
  {
    value: "free_hit",
    label: "Free Hit",
    short: "FH",
    hint: "Best one-week XV (forces next-game horizon)",
  },
];

export function parseChipMode(
  value: string | null | undefined,
  fallback: ChipMode = "none",
): ChipMode {
  if (!value) return fallback;
  const hit = CHIP_OPTIONS.find((o) => o.value === value);
  return hit?.value ?? fallback;
}

export function chipLabel(chip: ChipMode): string {
  return CHIP_OPTIONS.find((o) => o.value === chip)?.label ?? "No chip";
}

/** Free Hit is a one-GW play — lock horizon to 1. */
export function horizonForChip(chip: ChipMode): number | null {
  return chip === "free_hit" ? 1 : null;
}

/**
 * Score used when a chip lens is active (higher = better).
 * Combines projection with chip-specific priorities.
 */
export function chipPlayerScore(p: ScoredPlayer, chip: ChipMode): number {
  const base =
    p.projectedPoints * 2 +
    p.expectedPointsPerGw * 1.2 +
    p.startChance * 4;

  switch (chip) {
    case "triple_captain":
      // Ceiling captain: minutes + attack + next fixture upside
      return (
        p.projectedPoints * 3.5 +
        p.expectedPointsPerGw * 2.5 +
        p.startChance * 12 +
        p.xgi90 * 10 +
        p.attackingThreat * 0.25 +
        (p.isPenTaker ? 4 : 0) +
        (p.availabilityFactor < 0.6 ? -20 : 0)
      );
    case "bench_boost":
      // Need minutes from the whole 15, not just stars
      return (
        p.projectedPoints * 1.8 +
        p.startChance * 22 +
        p.availabilityFactor * 14 +
        Math.max(0, 5 - p.upcomingAvgDifficulty) * 3 +
        (p.availabilityFactor < 0.55 ? -18 : 0)
      );
    case "free_hit":
      // Single GW maximiser (horizon should already be 1)
      return (
        p.projectedPoints * 4 +
        p.expectedPointsPerGw * 1.5 +
        p.startChance * 8 +
        p.nextWinChance * 0.08 +
        (p.position === "GKP" || p.position === "DEF"
          ? p.cleanSheetChance * 0.1
          : 0) +
        (p.availabilityFactor < 0.5 ? -25 : 0)
      );
    default:
      return base;
  }
}

export function sortByChip(
  players: ScoredPlayer[],
  chip: ChipMode,
): ScoredPlayer[] {
  if (chip === "none") return players;
  return [...players].sort(
    (a, b) => chipPlayerScore(b, chip) - chipPlayerScore(a, chip),
  );
}

/** Captain pool for Triple Captain — likely starters only. */
export function pickChipCaptain(
  players: ScoredPlayer[],
  chip: ChipMode,
): ScoredPlayer | undefined {
  if (chip !== "triple_captain") return undefined;
  const pool = players.filter(
    (p) => p.startChance >= 0.55 && p.availabilityFactor >= 0.55,
  );
  const ranked = sortByChip(pool.length > 0 ? pool : players, chip);
  return ranked[0];
}
