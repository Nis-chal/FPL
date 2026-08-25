"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnalysisFilters } from "@/components/AnalysisFilters";
import { BestFormationCard } from "@/components/BestFormationCard";
import { PitchView } from "@/components/PitchView";
import { TeamIdForm } from "@/components/TeamIdForm";
import { Reasons } from "@/components/PlayerTable";
import { TeamRatingCard } from "@/components/TeamRatingCard";
import { Card, ErrorBox, Stat } from "@/components/ui";
import { useTeamId } from "@/hooks/useTeamId";
import { useAccumulatedPoints } from "@/hooks/useAccumulatedPoints";
import { useAnalysisPrefs } from "@/hooks/useAnalysisPrefs";
import {
  formationFromXi,
  trySwap,
  xiProjectedTotal,
} from "@/lib/pitch";
import { filterByPrice, pickCaptain, sortByRank } from "@/lib/ranking";
import { applyHorizon } from "@/lib/scoring";
import { buildRecommendedSquad, rankFormations } from "@/lib/squad";
import { rateTeam } from "@/lib/team-rating";
import type { ScoredPlayer, TeamRating } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

type LineupState = {
  startingXi: ScoredPlayer[];
  bench: ScoredPlayer[];
  captainId: number;
  viceId: number;
};

function SyncHorizonPlayers(
  lineup: LineupState,
  scored: ScoredPlayer[],
): LineupState {
  const byId = new Map(scored.map((p) => [p.id, p]));
  const mapList = (list: ScoredPlayer[]) =>
    list.map((p) => byId.get(p.id) ?? p);
  return {
    ...lineup,
    startingXi: mapList(lineup.startingXi),
    bench: mapList(lineup.bench),
  };
}

export function SquadClient({
  allPlayers,
  initialHorizon = 5,
}: {
  allPlayers: ScoredPlayer[];
  initialHorizon?: number;
}) {
  const { ready, numericId } = useTeamId();
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
    priceBounds,
    setPriceBounds,
  } = useAnalysisPrefs({ horizon: initialHorizon });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entryName, setEntryName] = useState<string | null>(null);
  const [personalRating, setPersonalRating] = useState<TeamRating | null>(null);
  const [swapHint, setSwapHint] = useState<string | null>(null);

  const [modelSelected, setModelSelected] = useState<number | null>(null);
  const [personalSelected, setPersonalSelected] = useState<number | null>(null);
  const [modelLineup, setModelLineup] = useState<LineupState | null>(null);
  const [personalLineup, setPersonalLineup] = useState<LineupState | null>(null);

  const scored = useMemo(() => {
    const horizonApplied = applyHorizon(
      allPlayers,
      horizon,
      includeAccumulated,
    );
    const priced = filterByPrice(horizonApplied, priceBounds);
    return sortByRank(priced, rankBy, seasonBasis);
  }, [allPlayers, horizon, includeAccumulated, priceBounds, rankBy, seasonBasis]);

  const built = useMemo(() => {
    const squad = buildRecommendedSquad(scored, budget, horizon, rankBy);
    if (!squad.captain || squad.startingXi.length === 0) {
      return squad;
    }
    const captain =
      pickCaptain(squad.startingXi, rankBy, seasonBasis) ?? squad.captain;
    const vice =
      pickCaptain(
        squad.startingXi.filter((p) => p.id !== captain.id),
        rankBy,
        seasonBasis,
      ) ?? squad.viceCaptain;
    return {
      ...squad,
      captain,
      viceCaptain: vice,
    };
  }, [scored, rankBy, budget, horizon, seasonBasis]);

  const formations = useMemo(() => rankFormations(scored), [scored]);

  // Reset model lineup when horizon / recommendations / budget change
  useEffect(() => {
    if (!built.captain || built.startingXi.length === 0) {
      setModelLineup(null);
      return;
    }
    setModelLineup({
      startingXi: built.startingXi,
      bench: built.bench,
      captainId: built.captain.id,
      viceId: built.viceCaptain.id,
    });
    setModelSelected(null);
    setSwapHint(
      `Rebuilt for ${formatPrice(budget)} budget · ${formatPrice(built.bank)} bank`,
    );
  }, [built, budget]);

  // Keep player stats in sync with horizon when IDs unchanged
  useEffect(() => {
    setModelLineup((prev) => (prev ? SyncHorizonPlayers(prev, scored) : prev));
    setPersonalLineup((prev) => (prev ? SyncHorizonPlayers(prev, scored) : prev));
  }, [scored]);

  const activeModel = modelLineup ?? {
    startingXi: built.startingXi,
    bench: built.bench,
    captainId: built.captain.id,
    viceId: built.viceCaptain.id,
  };

  const modelRating = useMemo(
    () => rateTeam([...activeModel.startingXi, ...activeModel.bench], activeModel.startingXi, horizon),
    [activeModel, horizon],
  );

  useEffect(() => {
    if (!ready || !numericId) {
      setPersonalLineup(null);
      setEntryName(null);
      setPersonalRating(null);
      setError(null);
      setPersonalSelected(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/entry/${numericId}?horizon=${horizon}&accumulated=${includeAccumulated ? "1" : "0"}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load team");
        if (cancelled) return;
        setEntryName(data.entry?.name ?? `Team ${numericId}`);
        setPersonalRating(data.teamRating ?? null);
        const xi: ScoredPlayer[] = data.currentXi ?? [];
        const bench: ScoredPlayer[] = data.currentBench ?? [];
        const captain =
          data.picks?.picks?.find(
            (p: { is_captain?: boolean; element: number }) => p.is_captain,
          )?.element ?? xi[0]?.id;
        const vice =
          data.picks?.picks?.find(
            (p: { is_vice_captain?: boolean; element: number }) =>
              p.is_vice_captain,
          )?.element ?? xi[1]?.id;
        setPersonalLineup({
          startingXi: xi,
          bench,
          captainId: captain,
          viceId: vice,
        });
        setPersonalSelected(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, numericId, horizon, includeAccumulated]);

  const handleSelect = useCallback(
    (
      which: "model" | "personal",
      id: number,
      lineup: LineupState,
      setLineup: (next: LineupState) => void,
      selected: number | null,
      setSelected: (id: number | null) => void,
    ) => {
      if (selected === null) {
        setSelected(id);
        setSwapHint("Now tap a player on the other line (pitch ↔ bench) to swap.");
        return;
      }
      if (selected === id) {
        setSelected(null);
        setSwapHint(null);
        return;
      }

      const result = trySwap(lineup.startingXi, lineup.bench, selected, id);
      if (!result) {
        setSwapHint(
          "Invalid swap — resulting XI must stay a legal FPL formation (1 GK, 3–5 DEF, 2–5 MID, 1–3 FWD).",
        );
        setSelected(null);
        return;
      }

      let captainId = lineup.captainId;
      let viceId = lineup.viceId;
      // If captain moved to bench, reassign to highest projected on pitch
      if (!result.startingXi.some((p) => p.id === captainId)) {
        captainId = [...result.startingXi].sort(
          (a, b) => b.projectedPoints - a.projectedPoints,
        )[0].id;
      }
      if (
        !result.startingXi.some((p) => p.id === viceId) ||
        viceId === captainId
      ) {
        viceId =
          [...result.startingXi]
            .filter((p) => p.id !== captainId)
            .sort((a, b) => b.projectedPoints - a.projectedPoints)[0]?.id ??
          captainId;
      }

      setLineup({
        startingXi: result.startingXi,
        bench: result.bench,
        captainId,
        viceId,
      });
      setSelected(null);
      setSwapHint(`Swapped — formation ${formationFromXi(result.startingXi)}.`);
      void which;
    },
    [],
  );

  const modelTotal = xiProjectedTotal(
    activeModel.startingXi,
    activeModel.captainId,
  );
  const personalTotal = personalLineup
    ? xiProjectedTotal(personalLineup.startingXi, personalLineup.captainId)
    : null;

  const livePersonalRating = useMemo(() => {
    if (!personalLineup) return personalRating;
    return rateTeam(
      [...personalLineup.startingXi, ...personalLineup.bench],
      personalLineup.startingXi,
      horizon,
    );
  }, [personalLineup, personalRating, horizon]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
        />
        <div className="w-full max-w-md">
          <TeamIdForm compact />
        </div>
      </div>

      {livePersonalRating ? (
        <TeamRatingCard rating={livePersonalRating} />
      ) : (
        <TeamRatingCard rating={modelRating} />
      )}

      <BestFormationCard formations={formations} horizon={horizon} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Best formation"
          value={formations[0]?.name ?? formationFromXi(activeModel.startingXi)}
          accent
        />
        <Stat
          label={`Squad / ${formatPrice(budget)}`}
          value={`${formatPrice(built.totalCost)} · ${formatPrice(built.bank)} bank`}
        />
        <Stat
          label={`XI pts (next ${horizon})`}
          value={modelTotal.toFixed(1)}
          accent
        />
        <Stat
          label="Overall rating"
          value={`${modelRating.grade} ${modelRating.score}`}
        />
      </div>

      {swapHint && (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-300">
          {swapHint}
        </p>
      )}

      <Card
        title="Recommended squad (pitch view)"
        subtitle={`Each card shows overall rating + projected points for the next ${horizon} fixtures (${
          seasonBasis === "prior" ? "prior seasons" : "this season"
        })`}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs uppercase tracking-wider text-zinc-500">
            Captain
          </span>
          <span
            className="group relative cursor-help font-semibold text-emerald-400 underline decoration-emerald-500/40 decoration-dotted underline-offset-2"
            tabIndex={0}
          >
            {activeModel.startingXi.find((p) => p.id === activeModel.captainId)
              ?.webName ?? built.captain.webName}
            <span
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full z-30 mt-2 hidden w-72 rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-left font-normal shadow-xl group-hover:block group-focus-within:block"
            >
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                Recommended captain
              </div>
              <Reasons
                reasons={
                  activeModel.startingXi.find(
                    (p) => p.id === activeModel.captainId,
                  )?.reasons ?? built.captain.reasons
                }
              />
            </span>
          </span>
        </div>
        <PitchView
          title="Starting XI"
          startingXi={activeModel.startingXi}
          bench={activeModel.bench}
          captainId={activeModel.captainId}
          viceId={activeModel.viceId}
          horizon={horizon}
          selectedId={modelSelected}
          onSelect={(id) =>
            handleSelect(
              "model",
              id,
              activeModel,
              setModelLineup,
              modelSelected,
              setModelSelected,
            )
          }
          ratingGrade={modelRating.grade}
          ratingScore={modelRating.score}
        />
      </Card>

      {loading && (
        <p className="text-sm text-zinc-400">Loading your current squad…</p>
      )}
      {error && <ErrorBox message={error} />}

      {personalLineup && (
        <Card
          title={`Your team on the pitch${entryName ? ` · ${entryName}` : ""}`}
          subtitle={
            personalTotal != null
              ? `Projected ${personalTotal.toFixed(1)} pts over next ${horizon} GWs — tap to swap with bench`
              : "Tap pitch ↔ bench to rearrange"
          }
        >
          <PitchView
            title={entryName ?? "Your XI"}
            startingXi={personalLineup.startingXi}
            bench={personalLineup.bench}
            captainId={personalLineup.captainId}
            viceId={personalLineup.viceId}
            horizon={horizon}
            selectedId={personalSelected}
            onSelect={(id) =>
              handleSelect(
                "personal",
                id,
                personalLineup,
                setPersonalLineup,
                personalSelected,
                setPersonalSelected,
              )
            }
            ratingGrade={livePersonalRating?.grade}
            ratingScore={livePersonalRating?.score}
          />
        </Card>
      )}
    </div>
  );
}
