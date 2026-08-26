import type { PastSeasonStats } from "@/lib/types";

/** Parse "2024/25" or "2024-25" → start year for sorting. */
export function seasonSortKey(seasonName: string): number {
  const m = seasonName.replace(/-/g, "/").match(/(\d{4})\s*\/\s*(\d{2,4})/);
  if (!m) return 0;
  return Number(m[1]);
}

/** Newest FPL seasons first. */
export function sortSeasonsLatestFirst(
  seasons: PastSeasonStats[],
): PastSeasonStats[] {
  return [...seasons].sort(
    (a, b) => seasonSortKey(b.season_name) - seasonSortKey(a.season_name),
  );
}
