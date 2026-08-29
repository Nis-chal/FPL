"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PitchView } from "@/components/PitchView";
import { PlayerLink } from "@/components/PlayerDrawer";
import { SquadTransferDrawer } from "@/components/SquadTransferPanel";
import { TeamIdSearch } from "@/components/TeamIdSearch";
import { Card, ErrorBox } from "@/components/ui";
import { useAccumulatedPoints } from "@/hooks/useAccumulatedPoints";
import { useTeamId } from "@/hooks/useTeamId";
import { formationFromXi, trySwap, xiProjectedTotal } from "@/lib/pitch";
import { applyHorizon } from "@/lib/scoring";
import { filterByPrice, pickCaptain, pickViceCaptain, sortByRank } from "@/lib/ranking";
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

export function PointsClient({
  allPlayers,
  currentGameweek,
  horizon = 5,
}: {
  allPlayers: ScoredPlayer[];
  currentGameweek: number;
  horizon?: number;
}) {
  const { ready, numericId } = useTeamId();
  const { includeAccumulated } = useAccumulatedPoints(false);
  const scored = useMemo(
    () =>
      sortByRank(
        filterByPrice(applyHorizon(allPlayers, horizon, includeAccumulated), {
          minPrice: null,
          maxPrice: null,
        }),
        ["overall"],
      ),
    [allPlayers, horizon, includeAccumulated],
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entryName, setEntryName] = useState<string | null>(null);
  const [entryBank, setEntryBank] = useState(0);
  const [transferHint, setTransferHint] = useState<string | null>(null);
  const [personalRating, setPersonalRating] = useState<TeamRating | null>(null);
  const [personalLineup, setPersonalLineup] = useState<LineupState | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [removedId, setRemovedId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !numericId) {
      setPersonalLineup(null);
      setEntryName(null);
      setPersonalRating(null);
      setEntryBank(0);
      setTransferHint(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(
      `/api/entry/${numericId}?horizon=${horizon}&accumulated=${includeAccumulated ? "1" : "0"}`,
    )
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
          captainId: captain ?? 0,
          viceId: vice ?? 0,
        });
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load team");
          setPersonalLineup(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, numericId, horizon, includeAccumulated]);

  const personalSquad = personalLineup
    ? [...personalLineup.startingXi, ...personalLineup.bench]
    : [];
  const personalBank = BUDGET - personalSquad.reduce((s, p) => s + p.price, 0);
  const personalTotal = personalLineup
    ? xiProjectedTotal(personalLineup.startingXi, personalLineup.captainId)
    : null;

  const suggestions = useMemo(() => {
    if (!personalLineup || personalSquad.length === 0) return [];
    const bankTenths = entryBank > 0 ? entryBank : Math.max(0, personalBank);
    return suggestTransfers(personalSquad, scored, bankTenths, 6, horizon);
  }, [personalLineup, personalSquad, scored, entryBank, personalBank, horizon]);

  const liveRating = useMemo(() => {
    if (!personalLineup) return personalRating;
    return rateTeam(
      personalSquad,
      personalLineup.startingXi,
      horizon,
    );
  }, [personalLineup, personalSquad, personalRating, horizon]);

  const applySuggestion = useCallback(
    (t: TransferSuggestion) => {
      if (!personalLineup) return;
      const result = applySquadTransfer(
        personalLineup.startingXi,
        personalLineup.bench,
        t.out.id,
        t.in,
        BUDGET,
      );
      if (!result.ok) {
        setHint(result.error);
        return;
      }
      const arms = reassignArmbands(
        result.startingXi,
        personalLineup.captainId,
        personalLineup.viceId,
      );
      setPersonalLineup({
        startingXi: result.startingXi,
        bench: result.bench,
        ...arms,
      });
      setHint(`${t.out.webName} → ${t.in.webName}`);
    },
    [personalLineup],
  );

  const handleSelect = useCallback(
    (id: number) => {
      if (!personalLineup) return;
      if (selectedId == null) {
        setSelectedId(id);
        return;
      }
      if (selectedId === id) {
        setSelectedId(null);
        return;
      }
      const result = trySwap(
        personalLineup.startingXi,
        personalLineup.bench,
        selectedId,
        id,
      );
      if (!result) {
        setSelectedId(id);
        return;
      }
      const arms = reassignArmbands(
        result.startingXi,
        personalLineup.captainId,
        personalLineup.viceId,
      );
      setPersonalLineup({
        startingXi: result.startingXi,
        bench: result.bench,
        ...arms,
      });
      setSelectedId(null);
      setHint(`Swapped · ${formationFromXi(result.startingXi)}`);
    },
    [personalLineup, selectedId],
  );

  const removed =
    removedId != null
      ? personalSquad.find((p) => p.id === removedId) ?? null
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <TeamIdSearch />
      </div>

      {hint && (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-300">
          {hint}
        </p>
      )}

      {loading && (
        <p className="text-sm text-zinc-400">Loading your squad…</p>
      )}
      {error && <ErrorBox message={error} />}

      {!numericId && !loading && (
        <p className="rounded-xl border border-dashed border-zinc-700 px-4 py-6 text-center text-sm text-zinc-500">
          Save a team ID to load your squad.
        </p>
      )}

      {personalLineup && (
        <>
          <Card
            title={entryName ?? "Your XI"}
            subtitle={
              personalTotal != null
                ? `${formatPrice(personalSquad.reduce((s, p) => s + p.price, 0))} · ${personalTotal.toFixed(1)} xPts`
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
              selectedId={selectedId}
              removedId={removedId}
              onRemove={(id) => {
                setSelectedId(null);
                setRemovedId(id);
                setDrawerOpen(false);
              }}
              onFillSlot={() => removedId != null && setDrawerOpen(true)}
              onRestoreSlot={() => {
                setRemovedId(null);
                setDrawerOpen(false);
              }}
              onSelect={handleSelect}
              ratingGrade={liveRating?.grade}
              ratingScore={liveRating?.score}
              currentGameweek={currentGameweek}
            />
          </Card>

          <Card
            title="Recommended transfers"
            subtitle={
              transferHint ||
              `Bank ${formatPrice(entryBank > 0 ? entryBank : Math.max(0, personalBank))}`
            }
          >
            {suggestions.length === 0 ? (
              <p className="text-sm text-zinc-500">No strong upgrades.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {suggestions.map((t) => (
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
                    <div className="mt-auto flex items-center justify-between gap-2">
                      <div className="text-sm font-bold text-emerald-400">
                        {t.netProjectedGain >= 0 ? "+" : ""}
                        {t.netProjectedGain.toFixed(1)}
                      </div>
                      <button
                        type="button"
                        onClick={() => applySuggestion(t)}
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
        </>
      )}

      {removed && drawerOpen && personalLineup && (
        <SquadTransferDrawer
          out={removed}
          squad={personalSquad}
          pool={scored}
          budget={BUDGET}
          onClose={() => setDrawerOpen(false)}
          onTransferIn={(player) => {
            const result = applySquadTransfer(
              personalLineup.startingXi,
              personalLineup.bench,
              removed.id,
              player,
              BUDGET,
            );
            if (!result.ok) {
              setHint(result.error);
              return;
            }
            const arms = reassignArmbands(
              result.startingXi,
              personalLineup.captainId,
              personalLineup.viceId,
            );
            setPersonalLineup({
              startingXi: result.startingXi,
              bench: result.bench,
              ...arms,
            });
            setRemovedId(null);
            setDrawerOpen(false);
            setHint(`Signed ${player.webName}`);
          }}
        />
      )}
    </div>
  );
}
