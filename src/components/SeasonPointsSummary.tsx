import {
  filterLabel,
  playerFilteredPoints,
  playerSeasonPoints,
  squadFilteredPoints,
  squadSeasonPoints,
  type GwPointsFilter,
  xiSeasonPoints,
} from "@/lib/season-accumulated";
import type { ScoredPlayer } from "@/lib/types";

export function SeasonPointsSummary({
  squad,
  startingXi,
  fromDatabase,
  filter,
  compact = false,
}: {
  squad: ScoredPlayer[];
  startingXi: ScoredPlayer[];
  fromDatabase?: boolean;
  filter?: GwPointsFilter;
  compact?: boolean;
}) {
  const activeFilter: GwPointsFilter = filter ?? {
    mode: "total",
    gameweek: 1,
  };
  const squadPts = squadFilteredPoints(squad, activeFilter);
  const xiPts =
    activeFilter.mode === "total"
      ? xiSeasonPoints(startingXi)
      : startingXi.reduce((sum, p) => {
          const pts = playerFilteredPoints(p, activeFilter);
          return sum + (pts ?? 0);
        }, 0);
  const seasonTotal = squadSeasonPoints(squad);

  if (compact) {
    return (
      <span className="text-xs text-zinc-500">
        {filterLabel(activeFilter)} {squadPts} pts · season {seasonTotal}
      </span>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-400">
      <span className="font-semibold text-zinc-200">{filterLabel(activeFilter)}</span>
      <span className="mx-2 text-zinc-600">·</span>
      Squad <span className="font-semibold text-emerald-400">{squadPts}</span> pts
      <span className="mx-2 text-zinc-600">·</span>
      XI <span className="font-semibold text-emerald-400">{xiPts}</span> pts
      <span className="mx-2 text-zinc-600">·</span>
      Season <span className="font-semibold text-sky-300">{seasonTotal}</span>
      {fromDatabase ? null : (
        <span className="ml-2 text-zinc-500">· sync for per-GW</span>
      )}
    </div>
  );
}

export { playerSeasonPoints, squadSeasonPoints, xiSeasonPoints, playerFilteredPoints };
