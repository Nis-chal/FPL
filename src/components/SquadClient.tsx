"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnalysisFilters } from "@/components/AnalysisFilters";
import { BestFormationCard } from "@/components/BestFormationCard";
import { PitchView } from "@/components/PitchView";
import { PlayerLink } from "@/components/PlayerDrawer";
import { SquadTransferDrawer } from "@/components/SquadTransferPanel";
import { TeamIdSearch } from "@/components/TeamIdSearch";
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
import { filterByPrice, pickCaptain, pickViceCaptain, sortByRank } from "@/lib/ranking";
import { applyHorizon } from "@/lib/scoring";
import { buildRecommendedSquad, rankFormations } from "@/lib/squad";
import { rateTeam } from "@/lib/team-rating";
import { applySquadTransfer, suggestTransfers } from "@/lib/transfers";
import type { ScoredPlayer, TeamRating, TransferSuggestion } from "@/lib/types";
import { BUDGET, formatPrice } from "@/lib/utils";

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

function reassignArmbands(
  startingXi: ScoredPlayer[],
  captainId: number,
  viceId: number,
): { captainId: number; viceId: number } {
  void viceId;
  const current = startingXi.find((p) => p.id === captainId);
  const captain =
    current && (current.position === "MID" || current.position === "FWD")
      ? current
      : pickCaptain(startingXi, ["overall"]) ??
        [...startingXi]
          .filter((p) => p.position === "MID" || p.position === "FWD")
          .sort((a, b) => b.projectedPoints - a.projectedPoints)[0];
  const nextCaptain = captain?.id ?? captainId;
  const vice =
    pickViceCaptain(
      startingXi.filter((p) => p.id !== nextCaptain),
      captain ?? startingXi[0]!,
      ["overall"],
    ) ??
    [...startingXi]
      .filter(
        (p) =>
          p.id !== nextCaptain &&
          (p.position === "MID" || p.position === "FWD"),
      )
      .sort((a, b) => b.projectedPoints - a.projectedPoints)[0];
  return { captainId: nextCaptain, viceId: vice?.id ?? nextCaptain };
}

export function SquadClient({
  allPlayers,
  initialHorizon = 5,
  currentGameweek,
}: {
  allPlayers: ScoredPlayer[];
  initialHorizon?: number;
  currentGameweek?: number;
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
    chip,
    setChip,
    formation,
    setFormation,
    priceBounds,
    setPriceBounds,
  } = useAnalysisPrefs({ horizon: initialHorizon });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entryName, setEntryName] = useState<string | null>(null);
  const [personalRating, setPersonalRating] = useState<TeamRating | null>(null);
  const [entryBank, setEntryBank] = useState(0);
  const [transferHint, setTransferHint] = useState<string | null>(null);
  const [swapHint, setSwapHint] = useState<string | null>(null);

  const [modelSelected, setModelSelected] = useState<number | null>(null);
  const [personalSelected, setPersonalSelected] = useState<number | null>(null);
  const [modelRemovedId, setModelRemovedId] = useState<number | null>(null);
  const [modelDrawerOpen, setModelDrawerOpen] = useState(false);
  const [personalRemovedId, setPersonalRemovedId] = useState<number | null>(null);
  const [personalDrawerOpen, setPersonalDrawerOpen] = useState(false);
  const [modelLineup, setModelLineup] = useState<LineupState | null>(null);
  const [personalLineup, setPersonalLineup] = useState<LineupState | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const scored = useMemo(() => {
    const horizonApplied = applyHorizon(
      allPlayers,
      horizon,
      includeAccumulated,
    );
    const priced = filterByPrice(horizonApplied, priceBounds);
    return sortByRank(priced, rankBy, seasonBasis, chip);
  }, [allPlayers, horizon, includeAccumulated, priceBounds, rankBy, seasonBasis, chip]);

  const built = useMemo(() => {
    const squad = buildRecommendedSquad(
      scored,
      BUDGET,
      horizon,
      rankBy,
      chip,
      formation,
    );
    if (!squad.captain || squad.startingXi.length === 0) {
      return squad;
    }
    const captain =
      pickCaptain(squad.startingXi, rankBy, seasonBasis, chip) ?? squad.captain;
    const vice =
      pickViceCaptain(
        squad.startingXi,
        captain,
        rankBy,
        seasonBasis,
        chip === "triple_captain" ? "none" : chip,
      ) ?? squad.viceCaptain;
    return {
      ...squad,
      captain,
      viceCaptain: vice,
    };
  }, [scored, rankBy, horizon, seasonBasis, chip, formation]);

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
    setModelRemovedId(null);
    setModelDrawerOpen(false);
    setSwapHint(
      `Rebuilt · ${formatPrice(built.bank)} bank`,
    );
  }, [built]);

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

  const modelSquad = useMemo(
    () => [...activeModel.startingXi, ...activeModel.bench],
    [activeModel],
  );
  const modelTotalCost = useMemo(
    () => modelSquad.reduce((sum, p) => sum + p.price, 0),
    [modelSquad],
  );
  const modelBank = BUDGET - modelTotalCost;

  const modelRating = useMemo(
    () => rateTeam(modelSquad, activeModel.startingXi, horizon),
    [modelSquad, activeModel.startingXi, horizon],
  );

  useEffect(() => {
    if (!ready || !numericId) {
      setPersonalLineup(null);
      setEntryName(null);
      setPersonalRating(null);
      setEntryBank(0);
      setTransferHint(null);
      setError(null);
      setPersonalSelected(null);
      setPersonalRemovedId(null);
      setPersonalDrawerOpen(false);
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
        setEntryBank(
          typeof data.bank === "number"
            ? data.bank
            : data.picks?.entry_history?.bank ?? 0,
        );
        setTransferHint(data.freeTransfersHint ?? null);
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
        setPersonalRemovedId(null);
        setPersonalDrawerOpen(false);
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

  const applyTransferToLineup = useCallback(
    (
      lineup: LineupState,
      setLineup: (next: LineupState) => void,
      outId: number,
      inPlayer: ScoredPlayer,
      clearTransfer: () => void,
    ) => {
      const result = applySquadTransfer(
        lineup.startingXi,
        lineup.bench,
        outId,
        inPlayer,
        BUDGET,
      );
      if (!result.ok) {
        setSwapHint(result.error);
        return;
      }
      const arms = reassignArmbands(
        result.startingXi,
        lineup.captainId,
        lineup.viceId,
      );
      setLineup({
        startingXi: result.startingXi,
        bench: result.bench,
        ...arms,
      });
      clearTransfer();
      setSwapHint(
        `In: ${inPlayer.webName} · ${formatPrice(result.bank)} bank`,
      );
    },
    [],
  );

  const clearModelSlot = useCallback(() => {
    setModelRemovedId(null);
    setModelDrawerOpen(false);
  }, []);

  const clearPersonalSlot = useCallback(() => {
    setPersonalRemovedId(null);
    setPersonalDrawerOpen(false);
  }, []);

  /** × removes player (empty slot). Tap empty slot to open transfer drawer. */
  const handleRemovePlayer = useCallback(
    (
      id: number,
      removedId: number | null,
      setRemovedId: (id: number | null) => void,
      setDrawerOpen: (open: boolean) => void,
      setSwapSelected: (id: number | null) => void,
    ) => {
      setSwapSelected(null);
      setDrawerOpen(false);
      if (removedId === id) {
        // × on already-removed path shouldn't happen; restore
        setRemovedId(null);
        setSwapHint(null);
        return;
      }
      setRemovedId(id);
      setSwapHint("Removed — tap empty slot to transfer.");
    },
    [],
  );

  const handleSelect = useCallback(
    (
      which: "model" | "personal",
      id: number,
      lineup: LineupState,
      setLineup: (next: LineupState) => void,
      selected: number | null,
      setSelected: (id: number | null) => void,
      clearTransfer: () => void,
    ) => {
      clearTransfer();
      if (selected === null) {
        setSelected(id);
        setSwapHint("Tap pitch ↔ bench to swap.");
        return;
      }
      if (selected === id) {
        setSelected(null);
        setSwapHint(null);
        return;
      }

      const result = trySwap(lineup.startingXi, lineup.bench, selected, id);
      if (!result) {
        setSelected(id);
        setSwapHint("Tap the other line to swap.");
        return;
      }

      const arms = reassignArmbands(
        result.startingXi,
        lineup.captainId,
        lineup.viceId,
      );
      setLineup({
        startingXi: result.startingXi,
        bench: result.bench,
        ...arms,
      });
      setSelected(null);
      setSwapHint(`Swapped · ${formationFromXi(result.startingXi)}`);
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

  const modelOut = modelRemovedId
    ? modelSquad.find((p) => p.id === modelRemovedId) ?? null
    : null;
  const personalSquad = personalLineup
    ? [...personalLineup.startingXi, ...personalLineup.bench]
    : [];
  const personalOut = personalRemovedId
    ? personalSquad.find((p) => p.id === personalRemovedId) ?? null
    : null;
  const personalTotalCost = personalSquad.reduce((sum, p) => sum + p.price, 0);
  const personalBank = BUDGET - personalTotalCost;

  const personalSuggestions = useMemo(() => {
    if (!personalLineup || personalSquad.length === 0) return [];
    // Prefer real ITB from FPL when available; fall back to residual vs analysis budget.
    const bankTenths = entryBank > 0 ? entryBank : Math.max(0, personalBank);
    return suggestTransfers(personalSquad, scored, bankTenths, 5, horizon);
  }, [personalLineup, personalSquad, scored, entryBank, personalBank, horizon]);

  const applySuggestedTransfer = useCallback(
    (suggestion: TransferSuggestion) => {
      if (!personalLineup) return;
      applyTransferToLineup(
        personalLineup,
        setPersonalLineup,
        suggestion.out.id,
        suggestion.in,
        clearPersonalSlot,
      );
    },
    [personalLineup, applyTransferToLineup, clearPersonalSlot],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
          chip={chip}
          onChipChange={setChip}
          formation={formation}
          onFormationChange={setFormation}
          trailing={<TeamIdSearch />}
        />
      </div>

      {swapHint && (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-300">
          {swapHint}
        </p>
      )}

      <Card
        title="Best squad"
        subtitle={`${formatPrice(BUDGET)} · next ${horizon}`}
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
          <span className="ml-auto text-xs text-zinc-500">
            {formatPrice(modelTotalCost)} / {formatPrice(BUDGET)} ·{" "}
            {modelTotal.toFixed(1)} xPts
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
          removedId={modelRemovedId}
          onRemove={(id) =>
            handleRemovePlayer(
              id,
              modelRemovedId,
              setModelRemovedId,
              setModelDrawerOpen,
              setModelSelected,
            )
          }
          onFillSlot={() => {
            if (modelRemovedId != null) {
              setModelDrawerOpen(true);
              setSwapHint("Pick a replacement in the drawer.");
            }
          }}
          onRestoreSlot={clearModelSlot}
          onSelect={(id) =>
            handleSelect(
              "model",
              id,
              activeModel,
              setModelLineup,
              modelSelected,
              setModelSelected,
              clearModelSlot,
            )
          }
          ratingGrade={modelRating.grade}
          ratingScore={modelRating.score}
          currentGameweek={currentGameweek}
        />
      </Card>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40">
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          aria-expanded={detailsOpen}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-zinc-900/80 md:px-5"
        >
          <div>
            <h2 className="text-base font-bold text-zinc-100">Details</h2>
            <p className="text-xs text-zinc-500">
              {`${modelRating.grade} ${modelRating.score} · ${
                    formation !== "auto"
                      ? formation
                      : (formations[0]?.name ??
                        formationFromXi(activeModel.startingXi))
                  }`}
            </p>
          </div>
          <span
            className={[
              "text-zinc-400 transition-transform",
              detailsOpen ? "rotate-180" : "",
            ].join(" ")}
            aria-hidden
          >
            ▾
          </span>
        </button>
        {detailsOpen && (
          <div className="space-y-4 border-t border-zinc-800 px-4 py-4 md:px-5">
            {livePersonalRating ? (
              <TeamRatingCard rating={livePersonalRating} />
            ) : (
              <TeamRatingCard rating={modelRating} />
            )}
            <BestFormationCard
              formations={formations}
              horizon={horizon}
              defaultOpen
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label={
                  formation === "auto" ? "Best formation" : "Locked formation"
                }
                value={
                  formation !== "auto"
                    ? formation
                    : (formations[0]?.name ??
                      formationFromXi(activeModel.startingXi))
                }
                accent
              />
              <Stat
                label={`Squad / ${formatPrice(BUDGET)}`}
                value={`${formatPrice(modelTotalCost)} · ${formatPrice(modelBank)} bank`}
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
          </div>
        )}
      </section>

      {modelOut && modelDrawerOpen && (
        <SquadTransferDrawer
          out={modelOut}
          squad={modelSquad}
          pool={scored}
          budget={BUDGET}
          onClose={() => {
            setModelDrawerOpen(false);
            setSwapHint("Tap + to transfer, or ↩ to restore.");
          }}
          onTransferIn={(player) =>
            applyTransferToLineup(
              activeModel,
              setModelLineup,
              modelOut.id,
              player,
              clearModelSlot,
            )
          }
        />
      )}

      {loading && (
        <p className="text-sm text-zinc-400">Loading squad…</p>
      )}
      {error && <ErrorBox message={error} />}

      {personalLineup && (
        <Card
          title={entryName ?? "Your squad"}
          subtitle={
            personalTotal != null
              ? `${personalTotal.toFixed(1)} xPts · ${formatPrice(personalTotalCost)}`
              : undefined
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
            removedId={personalRemovedId}
            onRemove={(id) =>
              handleRemovePlayer(
                id,
                personalRemovedId,
                setPersonalRemovedId,
                setPersonalDrawerOpen,
                setPersonalSelected,
              )
            }
            onFillSlot={() => {
              if (personalRemovedId != null) {
                setPersonalDrawerOpen(true);
                setSwapHint("Pick a replacement in the drawer.");
              }
            }}
            onRestoreSlot={clearPersonalSlot}
            onSelect={(id) =>
              handleSelect(
                "personal",
                id,
                personalLineup,
                setPersonalLineup,
                personalSelected,
                setPersonalSelected,
                clearPersonalSlot,
              )
            }
            ratingGrade={livePersonalRating?.grade}
            ratingScore={livePersonalRating?.score}
            currentGameweek={currentGameweek}
          />
        </Card>
      )}

      {personalLineup && (
        <Card
          title="Suggested transfers"
          subtitle={
            transferHint ||
            `Bank ${formatPrice(entryBank > 0 ? entryBank : Math.max(0, personalBank))}`
          }
        >
          {personalSuggestions.length === 0 ? (
            <p className="text-sm text-zinc-500">No strong upgrades.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {personalSuggestions.map((t) => (
                <div
                  key={`${t.out.id}-${t.in.id}`}
                  className="flex min-w-[11.5rem] max-w-[13rem] shrink-0 flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5"
                >
                  <div className="flex items-center gap-1 text-xs">
                    <PlayerLink
                      playerId={t.out.id}
                      className="truncate font-semibold text-rose-300"
                    >
                      {t.out.webName}
                    </PlayerLink>
                    <span className="text-zinc-500">→</span>
                    <PlayerLink
                      playerId={t.in.id}
                      className="truncate font-semibold text-emerald-400"
                    >
                      {t.in.webName}
                    </PlayerLink>
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {t.out.position} · {t.out.teamShort}→{t.in.teamShort}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-emerald-400">
                        {t.netProjectedGain >= 0 ? "+" : ""}
                        {t.netProjectedGain.toFixed(1)}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {t.costDelta === 0
                          ? "even"
                          : t.costDelta > 0
                            ? formatPrice(t.costDelta)
                            : `+${formatPrice(Math.abs(t.costDelta))}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => applySuggestedTransfer(t)}
                      className="rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {personalOut && personalDrawerOpen && personalLineup && (
        <SquadTransferDrawer
          out={personalOut}
          squad={personalSquad}
          pool={scored}
          budget={BUDGET}
          onClose={() => {
            setPersonalDrawerOpen(false);
            setSwapHint("Tap + to transfer, or ↩ to restore.");
          }}
          onTransferIn={(player) =>
            applyTransferToLineup(
              personalLineup,
              setPersonalLineup,
              personalOut.id,
              player,
              clearPersonalSlot,
            )
          }
        />
      )}
    </div>
  );
}
