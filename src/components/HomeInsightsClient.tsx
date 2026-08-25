"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AnalysisFilters } from "@/components/AnalysisFilters";
import { LiveGwStrip } from "@/components/LiveGwStrip";
import { PlayerTable, Reasons } from "@/components/PlayerTable";
import { TeamIdForm } from "@/components/TeamIdForm";
import { Card, Stat } from "@/components/ui";
import { useAccumulatedPoints } from "@/hooks/useAccumulatedPoints";
import { useAnalysisPrefs } from "@/hooks/useAnalysisPrefs";
import { filterByPrice, pickCaptain, sortByRank } from "@/lib/ranking";
import { applyHorizon, topProjected } from "@/lib/scoring";
import { buildBestSquad } from "@/lib/squad";
import type { FplEvent, ScoredPlayer } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

export function HomeInsightsClient({
  allPlayers,
  currentEvent,
  nextEvent,
}: {
  allPlayers: ScoredPlayer[];
  currentEvent: FplEvent | null;
  nextEvent: FplEvent | null;
}) {
  const { includeAccumulated, setIncludeAccumulated } = useAccumulatedPoints(true);
  const {
    rankBy,
    setRankBy,
    horizon,
    setHorizon,
    priceBounds,
    setPriceBounds,
  } = useAnalysisPrefs();

  const scored = useMemo(() => {
    const horizonApplied = applyHorizon(allPlayers, horizon, includeAccumulated);
    const priced = filterByPrice(horizonApplied, priceBounds);
    return sortByRank(priced, rankBy);
  }, [allPlayers, horizon, includeAccumulated, priceBounds, rankBy]);

  const bestSquad = useMemo(() => buildBestSquad(scored), [scored]);
  const topScorers = topProjected(scored, 12, {
    minMinutes: 0,
    availableOnly: false,
    minStartChance: 0,
  }).slice(0, 12);

  const captainPick =
    pickCaptain(scored, rankBy) ?? topScorers[0] ?? bestSquad.captain;

  if (!captainPick) {
    return (
      <>
        <LiveGwStrip />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <AnalysisFilters
            horizon={horizon}
            onHorizonChange={setHorizon}
            includeAccumulated={includeAccumulated}
            onAccumulatedChange={setIncludeAccumulated}
            rankBy={rankBy}
            onRankByChange={setRankBy}
            priceBounds={priceBounds}
            onPriceBoundsChange={setPriceBounds}
          />
          <div className="w-full max-w-md">
            <TeamIdForm compact />
          </div>
        </div>
        <p className="text-sm text-zinc-500">
          No players match the current price / analyze filters.
        </p>
      </>
    );
  }

  return (
    <>
      <LiveGwStrip />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <AnalysisFilters
          horizon={horizon}
          onHorizonChange={setHorizon}
          includeAccumulated={includeAccumulated}
          onAccumulatedChange={setIncludeAccumulated}
          rankBy={rankBy}
          onRankByChange={setRankBy}
          priceBounds={priceBounds}
          onPriceBoundsChange={setPriceBounds}
        />
        <div className="w-full max-w-md">
          <TeamIdForm compact />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Current GW" value={currentEvent?.name ?? "—"} />
        <Stat label="Next GW" value={nextEvent?.name ?? "—"} />
        <Stat label="Captain pick" value={captainPick?.webName ?? "—"} accent />
        <Stat
          label="Best XV proj"
          value={bestSquad.projectedPoints.toFixed(1)}
          accent
        />
      </div>

      <Card
        title="Highest expected points"
        subtitle={
          includeAccumulated
            ? `Analyze by ${rankBy} · next ${horizon} · including accumulated form`
            : `Analyze by ${rankBy} · next ${horizon} · accumulated points off`
        }
        action={
          <Link
            href="/players"
            className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
          >
            All players →
          </Link>
        }
      >
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="text-xs uppercase tracking-wider text-emerald-400">
            Recommended captain
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <span className="text-2xl font-bold text-zinc-50">
              {captainPick.webName}
            </span>
            <span className="text-sm text-zinc-400">
              {captainPick.teamShort} · {captainPick.position} ·{" "}
              {formatPrice(captainPick.price)} ·{" "}
              {Math.round(captainPick.startChance * 100)}% start
            </span>
            <span className="text-lg font-bold text-emerald-400">
              {captainPick.expectedPointsPerGw.toFixed(1)} xPts/GW
            </span>
          </div>
          <Reasons reasons={captainPick.reasons} />
        </div>
        <PlayerTable players={topScorers} showThreat />
      </Card>
    </>
  );
}
