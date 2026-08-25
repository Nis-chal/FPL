"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  AnalysisFilters,
  SquadBudgetChips,
} from "@/components/AnalysisFilters";
import { BestFormationCard } from "@/components/BestFormationCard";
import { LiveGwStrip } from "@/components/LiveGwStrip";
import { PlayerTable, Reasons } from "@/components/PlayerTable";
import { TeamIdForm } from "@/components/TeamIdForm";
import { Card, Stat } from "@/components/ui";
import { useAccumulatedPoints } from "@/hooks/useAccumulatedPoints";
import { useAnalysisPrefs } from "@/hooks/useAnalysisPrefs";
import {
  filterByPrice,
  pickCaptain,
  rankByLabel,
  sortByRank,
} from "@/lib/ranking";
import { applyHorizon, topProjected } from "@/lib/scoring";
import { buildRecommendedSquad, rankFormations } from "@/lib/squad";
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
  const { seasonBasis, setSeasonBasis, includeAccumulated } =
    useAccumulatedPoints(false);
  const {
    rankBy,
    toggleRank,
    resetFilters,
    horizon,
    setHorizon,
    budget,
    setBudget,
    chip,
    setChip,
    priceBounds,
    setPriceBounds,
  } = useAnalysisPrefs();

  const scored = useMemo(() => {
    const horizonApplied = applyHorizon(allPlayers, horizon, includeAccumulated);
    const priced = filterByPrice(horizonApplied, priceBounds);
    return sortByRank(priced, rankBy, seasonBasis, chip);
  }, [allPlayers, horizon, includeAccumulated, priceBounds, rankBy, seasonBasis, chip]);

  const bestSquad = useMemo(
    () => buildRecommendedSquad(scored, budget, horizon, rankBy, chip),
    [scored, budget, horizon, rankBy, chip],
  );
  const formations = useMemo(() => rankFormations(scored), [scored]);
  const topScorers = topProjected(scored, 12, {
    minMinutes: 0,
    availableOnly: false,
    minStartChance: 0,
  }).slice(0, 12);

  const captainPick =
    pickCaptain(scored, rankBy, seasonBasis, chip) ??
    topScorers[0] ??
    bestSquad.captain;

  const filters = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AnalysisFilters
          horizon={horizon}
          onHorizonChange={setHorizon}
          seasonBasis={seasonBasis}
          onSeasonBasisChange={setSeasonBasis}
          rankBy={rankBy}
          onToggleRank={toggleRank}
          onReset={resetFilters}
          priceBounds={priceBounds}
          onPriceBoundsChange={setPriceBounds}
          budget={budget}
          onBudgetChange={setBudget}
          chip={chip}
          onChipChange={setChip}
        />
        <div className="w-full max-w-md">
          <TeamIdForm compact />
        </div>
      </div>
      <SquadBudgetChips budget={budget} onChange={setBudget} />
    </div>
  );

  if (!captainPick) {
    return (
      <>
        <LiveGwStrip />
        {filters}
        <p className="text-sm text-zinc-500">
          No players match the current price / analyze filters.
        </p>
      </>
    );
  }

  const bestFormation = formations[0];

  return (
    <>
      <LiveGwStrip />
      {filters}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Current GW" value={currentEvent?.name ?? "—"} />
        <Stat
          label="Captain pick"
          value={captainPick.webName}
          accent
          tip={
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                Recommended captain
              </div>
              <p className="text-xs text-zinc-300">
                {captainPick.teamShort} · {captainPick.position} ·{" "}
                {formatPrice(captainPick.price)} ·{" "}
                {Math.round(captainPick.startChance * 100)}% start ·{" "}
                <span className="font-semibold text-emerald-400">
                  {captainPick.expectedPointsPerGw.toFixed(1)} xPts/GW
                </span>
              </p>
              <Reasons reasons={captainPick.reasons} />
            </div>
          }
        />
        <Stat
          label="Best formation"
          value={bestFormation?.name ?? bestSquad.formation}
          accent
        />
        <Stat
          label={`Budget ${formatPrice(budget)}`}
          value={`${formatPrice(bestSquad.totalCost)} · ${formatPrice(bestSquad.bank)} left`}
        />
      </div>

      <BestFormationCard formations={formations} horizon={horizon} />

      <Card
        title="Highest expected points"
        subtitle={`${rankByLabel(rankBy)} · ${
          seasonBasis === "prior" ? "prior seasons" : "this season"
        } · next ${horizon}`}
        action={
          <Link
            href="/players"
            className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
          >
            All players →
          </Link>
        }
      >
        <PlayerTable players={topScorers} showThreat />
      </Card>
    </>
  );
}
