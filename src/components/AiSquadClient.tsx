"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnalysisFilters } from "@/components/AnalysisFilters";
import { PitchView } from "@/components/PitchView";
import { Reasons, TransferPlayerChip } from "@/components/PlayerTable";
import { SeasonPointsSummary } from "@/components/SeasonPointsSummary";
import { SquadTransferDrawer } from "@/components/SquadTransferPanel";
import { TeamRatingCard } from "@/components/TeamRatingCard";
import { Card, TipTrigger } from "@/components/ui";
import { useAccumulatedPoints } from "@/hooks/useAccumulatedPoints";
import { useAnalysisPrefs } from "@/hooks/useAnalysisPrefs";
import type { AiSquadSnapshot } from "@/lib/db/ai-squad";
import { buildAiSquad } from "@/lib/ai-squad-build";
import { formationFromXi, trySwap, xiProjectedTotal } from "@/lib/pitch";
import { filterByPrice, pickCaptain, pickViceCaptain, sortByRank } from "@/lib/ranking";
import { applyHorizon } from "@/lib/scoring";
import { rateTeam } from "@/lib/team-rating";
import { applySquadTransfer, suggestTransfers } from "@/lib/transfers";
import type { GwPointsFilter } from "@/lib/season-accumulated";
import type { BestSquad, ScoredPlayer, TransferSuggestion } from "@/lib/types";
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

function lineupFromBuilt(built: BestSquad): LineupState | null {
  if (!built.captain || built.startingXi.length === 0) return null;
  return {
    startingXi: built.startingXi,
    bench: built.bench,
    captainId: built.captain.id,
    viceId: built.viceCaptain.id,
  };
}

function hydrateFromSnapshot(
  snap: AiSquadSnapshot,
  pool: ScoredPlayer[],
): LineupState | null {
  const byId = new Map(pool.map((p) => [p.id, p]));
  const startingXi = snap.startingXiIds
    .map((id) => byId.get(id))
    .filter((p): p is ScoredPlayer => Boolean(p));
  const bench = snap.benchIds
    .map((id) => byId.get(id))
    .filter((p): p is ScoredPlayer => Boolean(p));
  if (startingXi.length !== 11 || bench.length !== 4) return null;
  const captainId = byId.has(snap.captainId)
    ? snap.captainId
    : startingXi[0]!.id;
  const viceId = byId.has(snap.viceId) ? snap.viceId : startingXi[1]?.id ?? captainId;
  return { startingXi, bench, captainId, viceId };
}

function snapshotFromLineup(lineup: LineupState): Omit<AiSquadSnapshot, "updatedAt" | "key"> {
  return {
    startingXiIds: lineup.startingXi.map((p) => p.id),
    benchIds: lineup.bench.map((p) => p.id),
    captainId: lineup.captainId,
    viceId: lineup.viceId,
  };
}

async function persistLineup(lineup: LineupState): Promise<void> {
  const body = snapshotFromLineup(lineup);
  await fetch("/api/ai-squad", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

function TransferRow({
  t,
  onApply,
}: {
  t: TransferSuggestion;
  onApply: () => void;
}) {
  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <TransferPlayerChip player={t.out} tone="out" />
        <span className="text-zinc-600">→</span>
        <TransferPlayerChip player={t.in} tone="in" />
        <span
          className={[
            "ml-auto text-sm font-semibold tabular-nums",
            t.netProjectedGain >= 0 ? "text-emerald-400" : "text-rose-400",
          ].join(" ")}
        >
          {t.netProjectedGain >= 0 ? "+" : ""}
          {t.netProjectedGain.toFixed(1)} xPts
        </span>
        <button
          type="button"
          onClick={onApply}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
        >
          Make transfer
        </button>
        <TipTrigger tip={<Reasons reasons={t.reasons} />}>
          <span className="text-xs text-zinc-500">Why</span>
        </TipTrigger>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Cost {formatPrice(t.out.price)} → {formatPrice(t.in.price)} (
        {t.costDelta >= 0 ? "+" : ""}
        {formatPrice(Math.abs(t.costDelta))})
      </p>
    </li>
  );
}

export function AiSquadClient({
  allPlayers,
  initialHorizon = 5,
  embedded = false,
  seasonPointsFromDatabase = false,
  gwPointsFilter,
  currentGameweek,
}: {
  allPlayers: ScoredPlayer[];
  initialHorizon?: number;
  embedded?: boolean;
  seasonPointsFromDatabase?: boolean;
  gwPointsFilter?: GwPointsFilter;
  currentGameweek?: number;
}) {
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

  const [lineup, setLineup] = useState<LineupState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [fillId, setFillId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [transfersOpen, setTransfersOpen] = useState(true);
  const initRef = useRef(false);

  const scored = useMemo(() => {
    const horizonApplied = applyHorizon(
      allPlayers,
      horizon,
      includeAccumulated,
    );
    return sortByRank(
      filterByPrice(horizonApplied, priceBounds),
      rankBy,
      seasonBasis,
      chip,
    );
  }, [allPlayers, horizon, includeAccumulated, priceBounds, rankBy, seasonBasis, chip]);

  const aiBuilt = useMemo(
    () => buildAiSquad(allPlayers, { horizon, includeAccumulated }),
    [allPlayers, horizon, includeAccumulated],
  );

  /** Load once from MongoDB; only rebuild if no saved squad (after `bun run ai:reset`). */
  useEffect(() => {
    if (initRef.current || allPlayers.length === 0) return;
    initRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai-squad");
        const data = (await res.json()) as {
          squad: AiSquadSnapshot | null;
        };
        if (cancelled) return;

        const fromDb = data.squad
          ? hydrateFromSnapshot(data.squad, allPlayers)
          : null;

        if (fromDb) {
          setLineup(fromDb);
          setHint(null);
        } else {
          const fresh = lineupFromBuilt(aiBuilt);
          if (fresh) {
            setLineup(fresh);
            await persistLineup(fresh);
            setHint(
              "AI Squad saved (team-rating optimiser) · reset via bun run ai:reset",
            );
          }
        }
      } catch {
        if (cancelled) return;
        const fresh = lineupFromBuilt(aiBuilt);
        if (fresh) setLineup(fresh);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally once on mount with initial pool — not when filters change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPlayers.length]);

  /** Keep player stats in sync without changing who is in the squad. */
  useEffect(() => {
    if (allPlayers.length === 0) return;
    const byId = new Map(allPlayers.map((p) => [p.id, p]));
    setLineup((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        startingXi: prev.startingXi.map((p) => byId.get(p.id) ?? p),
        bench: prev.bench.map((p) => byId.get(p.id) ?? p),
      };
    });
  }, [allPlayers]);

  const commitLineup = useCallback((next: LineupState) => {
    setLineup(next);
    void persistLineup(next);
  }, []);

  const active = lineup ?? {
    startingXi: aiBuilt.startingXi,
    bench: aiBuilt.bench,
    captainId: aiBuilt.captain?.id ?? 0,
    viceId: aiBuilt.viceCaptain?.id ?? 0,
  };

  const squad = useMemo(
    () => [...active.startingXi, ...active.bench],
    [active.startingXi, active.bench],
  );
  const totalCost = squad.reduce((s, p) => s + p.price, 0);
  const bank = BUDGET - totalCost;

  const rating = useMemo(
    () => rateTeam(squad, active.startingXi, horizon),
    [squad, active.startingXi, horizon],
  );

  const managerTransfers = useMemo(() => {
    if (squad.length === 0) return [];
    return suggestTransfers(squad, scored, Math.max(0, bank), 8, horizon);
  }, [squad, scored, bank, horizon]);

  const applyTransfer = useCallback(
    (suggestion: TransferSuggestion) => {
      if (!lineup) return;
      const result = applySquadTransfer(
        lineup.startingXi,
        lineup.bench,
        suggestion.out.id,
        suggestion.in,
        BUDGET,
      );
      if (!result.ok) {
        setHint(result.error);
        return;
      }
      const arms = reassignArmbands(
        result.startingXi,
        lineup.captainId,
        lineup.viceId,
      );
      const next = {
        startingXi: result.startingXi,
        bench: result.bench,
        ...arms,
      };
      commitLineup(next);
      setHint(
        `${suggestion.out.webName} → ${suggestion.in.webName}`,
      );
    },
    [lineup, commitLineup],
  );

  const handleSelect = useCallback(
    (id: number) => {
      if (selectedId == null) {
        setSelectedId(id);
        return;
      }
      if (selectedId === id) {
        setSelectedId(null);
        return;
      }
      const result = trySwap(active.startingXi, active.bench, selectedId, id);
      if (!result || !lineup) {
        setSelectedId(id);
        return;
      }
      const arms = reassignArmbands(
        result.startingXi,
        lineup.captainId,
        lineup.viceId,
      );
      commitLineup({
        startingXi: result.startingXi,
        bench: result.bench,
        ...arms,
      });
      setSelectedId(null);
      setHint(`Swapped · ${formationFromXi(result.startingXi)}`);
    },
    [selectedId, active, lineup, commitLineup],
  );

  const removedPlayer =
    fillId != null ? squad.find((p) => p.id === fillId) ?? null : null;

  if (!loaded && !lineup) {
    return (
      <p className="text-sm text-zinc-500">Loading AI Squad…</p>
    );
  }

  return (
    <div className={embedded ? "space-y-6 border-t border-zinc-800 pt-8" : "space-y-6"}>
      {embedded && (
        <div>
          <h2 className="text-xl font-bold text-zinc-50">AI Squad</h2>
        </div>
      )}

      {!embedded && (
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
        />
      )}

      {hint && (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-300">
          {hint}
        </p>
      )}

      <Card title="AI Squad" subtitle={`${formatPrice(BUDGET)} · next ${horizon}`}>
        <div className="mb-3 space-y-2">
          <SeasonPointsSummary
            squad={squad}
            startingXi={active.startingXi}
            fromDatabase={seasonPointsFromDatabase}
            filter={gwPointsFilter}
          />
          <div className="flex flex-wrap items-center gap-2">
            {managerTransfers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const top = managerTransfers[0];
                  if (top) applyTransfer(top);
                }}
                className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
              >
                Apply AI transfer
              </button>
            )}
            <TipTrigger
              tip={
                <p className="text-xs text-zinc-300">
                  Squad is locked until you run{" "}
                  <code className="rounded bg-zinc-800 px-1">bun run ai:reset</code>
                </p>
              }
            >
              <span className="text-xs text-zinc-500">Locked</span>
            </TipTrigger>
            <span className="ml-auto text-xs text-zinc-500">
              {formatPrice(totalCost)} / {formatPrice(BUDGET)} ·{" "}
              {formatPrice(bank)} bank ·{" "}
              {xiProjectedTotal(active.startingXi, active.captainId).toFixed(1)}{" "}
              xPts
            </span>
          </div>
        </div>

        {active.startingXi.length === 0 ? (
          <p className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
            No squad — run{" "}
            <code className="rounded bg-zinc-800 px-1">bun run ai:reset</code>{" "}
            then refresh, or check filters.
          </p>
        ) : (
          <PitchView
            title="Starting XI"
            startingXi={active.startingXi}
            bench={active.bench}
            captainId={active.captainId}
            viceId={active.viceId}
            horizon={horizon}
            selectedId={selectedId}
            removedIds={removedIds}
            onRemove={(id) => {
              setSelectedId(null);
              setRemovedIds((prev) =>
                prev.includes(id) ? prev : [...prev, id],
              );
              setDrawerOpen(false);
              setHint("Removed — tap empty slots to replace (you can × several).");
            }}
            onFillSlot={(id) => {
              setFillId(id);
              setDrawerOpen(true);
            }}
            onRestoreSlot={(id) => {
              setRemovedIds((prev) => prev.filter((x) => x !== id));
              if (fillId === id) {
                setFillId(null);
                setDrawerOpen(false);
              }
            }}
            onSelect={handleSelect}
            ratingGrade={rating.grade}
            ratingScore={rating.score}
            currentGameweek={currentGameweek}
          />
        )}
      </Card>

      <section className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20">
        <button
          type="button"
          onClick={() => setTransfersOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left md:px-5"
        >
          <div>
            <h2 className="text-base font-bold text-emerald-200">
              Manager transfers
            </h2>
            <p className="text-xs text-zinc-500">
              {transfersOpen
                ? `${managerTransfers.length} suggestions`
                : `${managerTransfers.length} · expand`}
            </p>
          </div>
          <span
            className={[
              "text-zinc-400 transition-transform",
              transfersOpen ? "rotate-180" : "",
            ].join(" ")}
          >
            ▾
          </span>
        </button>
        {transfersOpen && (
          <div className="border-t border-emerald-900/30 px-4 pb-4 pt-3 md:px-5">
            {managerTransfers.length === 0 ? (
              <p className="text-sm text-zinc-500">No upgrades found.</p>
            ) : (
              <ul className="space-y-2">
                {managerTransfers.map((t) => (
                  <TransferRow
                    key={`${t.out.id}-${t.in.id}`}
                    t={t}
                    onApply={() => applyTransfer(t)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <TeamRatingCard rating={rating} />

      {removedPlayer && drawerOpen && (
        <SquadTransferDrawer
          out={removedPlayer}
          squad={squad}
          pool={scored}
          budget={BUDGET}
          onClose={() => {
            setDrawerOpen(false);
            setHint("Tap + to transfer, or ↩ to restore");
          }}
          onTransferIn={(player) => {
            if (!lineup || fillId == null) return;
            const result = applySquadTransfer(
              lineup.startingXi,
              lineup.bench,
              fillId,
              player,
              BUDGET,
            );
            if (!result.ok) {
              setHint(result.error);
              return;
            }
            const arms = reassignArmbands(
              result.startingXi,
              lineup.captainId,
              lineup.viceId,
            );
            commitLineup({
              startingXi: result.startingXi,
              bench: result.bench,
              ...arms,
            });
            setRemovedIds((prev) => prev.filter((x) => x !== fillId));
            setFillId(null);
            setDrawerOpen(false);
            setHint(`Signed ${player.webName}`);
          }}
        />
      )}
    </div>
  );
}
