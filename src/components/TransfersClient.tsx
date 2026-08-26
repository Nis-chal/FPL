"use client";

import { useEffect, useMemo, useState } from "react";
import { AnalysisFilters } from "@/components/AnalysisFilters";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import { PlayerLink } from "@/components/PlayerDrawer";
import { TeamIdForm } from "@/components/TeamIdForm";
import {
  PlayerTable,
  Reasons,
  TransferPlayerChip,
} from "@/components/PlayerTable";
import { TeamRatingCard } from "@/components/TeamRatingCard";
import { Card, ErrorBox, TipTrigger } from "@/components/ui";
import { useTeamId } from "@/hooks/useTeamId";
import { useAccumulatedPoints } from "@/hooks/useAccumulatedPoints";
import { useAnalysisPrefs } from "@/hooks/useAnalysisPrefs";
import { filterByPrice, rankByLabel, sortByRank } from "@/lib/ranking";
import { applyHorizon } from "@/lib/scoring";
import { bestInboundTargets } from "@/lib/transfers";
import type { ScoredPlayer, TeamRating, TransferSuggestion } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

function TransferExtraTip({ t }: { t: TransferSuggestion }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
        Why this transfer
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">
          In {t.in.expectedPointsPerGw.toFixed(1)} xPts/GW
        </span>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">
          Start {Math.round(t.in.startChance * 100)}%
        </span>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">
          xGI/90 {t.in.xgi90.toFixed(2)}
        </span>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">
          Win {t.in.nextWinChance}%
        </span>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">
          {t.threatDelta >= 0 ? "+" : ""}
          {t.threatDelta} threat
        </span>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">
          {t.winChanceDelta >= 0 ? "+" : ""}
          {t.winChanceDelta}% next-win
        </span>
      </div>
      <Reasons reasons={t.reasons} />
    </div>
  );
}

export function TransfersClient({
  allPlayers,
  initialHorizon = 5,
}: {
  allPlayers: ScoredPlayer[];
  initialHorizon?: number;
}) {
  const { teamId, ready, numericId } = useTeamId();
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
    formation,
    setFormation,
    priceBounds,
    setPriceBounds,
  } = useAnalysisPrefs({ horizon: initialHorizon });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<TransferSuggestion[] | null>(null);
  const [teamRating, setTeamRating] = useState<TeamRating | null>(null);
  const [entryName, setEntryName] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [transfersOpen, setTransfersOpen] = useState(true);

  const targets = useMemo(() => {
    const scored = applyHorizon(allPlayers, horizon, includeAccumulated);
    const priced = filterByPrice(scored, priceBounds);
    return bestInboundTargets(sortByRank(priced, rankBy, seasonBasis, chip), 20);
  }, [allPlayers, horizon, includeAccumulated, priceBounds, rankBy, seasonBasis, chip]);

  useEffect(() => {
    if (!ready || !numericId) {
      setTransfers(null);
      setTeamRating(null);
      setEntryName(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(
      `/api/entry/${numericId}?horizon=${horizon}&accumulated=${includeAccumulated ? "1" : "0"}`,
    )
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load team");
        if (cancelled) return;
        setTransfers(data.transfers);
        setTeamRating(data.teamRating ?? null);
        setEntryName(data.entry?.name ?? `Team ${numericId}`);
        setHint(data.freeTransfersHint);
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
          chip={chip}
          onChipChange={setChip}
          formation={formation}
          onFormationChange={setFormation}
        />
        <div className="w-full max-w-md">
          <TeamIdForm compact />
        </div>
      </div>

      {teamId && loading && (
        <p className="text-sm text-zinc-400">Loading your squad suggestions…</p>
      )}
      {error && <ErrorBox message={error} />}

      {teamRating && <TeamRatingCard rating={teamRating} />}

      {transfers && (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40">
          <button
            type="button"
            onClick={() => setTransfersOpen((v) => !v)}
            aria-expanded={transfersOpen}
            className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition hover:bg-zinc-900/80 md:px-5"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-100">
                  Recommended transfers
                  {entryName ? ` · ${entryName}` : ""}
                </h2>
                {transfers.length > 0 && (
                  <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400">
                    {transfers.length}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                {transfersOpen
                  ? hint ||
                    `Swaps for the next ${horizon} fixtures — ${rankByLabel(rankBy)}`
                  : transfers.length === 0
                    ? "No strong upgrades · click to expand"
                    : `Top pick ${transfers[0].out.webName} → ${transfers[0].in.webName} · ${
                        transfers[0].netProjectedGain >= 0 ? "+" : ""
                      }${transfers[0].netProjectedGain.toFixed(1)} proj · click to expand`}
              </p>
            </div>
            <span
              className={[
                "mt-1 shrink-0 text-zinc-400 transition-transform",
                transfersOpen ? "rotate-180" : "",
              ].join(" ")}
              aria-hidden
            >
              ▾
            </span>
          </button>
          {transfersOpen && (
            <div className="space-y-3 border-t border-zinc-800 px-4 py-4 md:px-5">
              {transfers.map((t) => (
                <div
                  key={`${t.out.id}-${t.in.id}-${t.horizon}`}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-200">
                      <PlayerLink playerId={t.out.id}>
                        <TransferPlayerChip player={t.out} tone="out" />
                      </PlayerLink>
                      <span className="text-zinc-500">→</span>
                      <PlayerLink playerId={t.in.id}>
                        <TransferPlayerChip player={t.in} tone="in" />
                      </PlayerLink>
                      <span className="text-xs text-zinc-500">
                        {t.out.position} · {t.out.teamShort} → {t.in.teamShort}
                      </span>
                      <AvailabilityBadge
                        status={t.in.status}
                        chanceOfPlaying={t.in.chanceOfPlaying}
                        news={t.in.news}
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-3 text-right text-sm">
                      <TipTrigger tip={<TransferExtraTip t={t} />} align="right">
                        <div>
                          <div className="font-bold text-emerald-400">
                            {t.netProjectedGain >= 0 ? "+" : ""}
                            {t.netProjectedGain.toFixed(1)} proj
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            {t.costDelta === 0
                              ? "even money"
                              : t.costDelta > 0
                                ? `costs ${formatPrice(t.costDelta)}`
                                : `frees ${formatPrice(Math.abs(t.costDelta))}`}
                          </div>
                        </div>
                      </TipTrigger>
                    </div>
                  </div>
                </div>
              ))}
              {transfers.length === 0 && (
                <p className="text-sm text-zinc-500">
                  No strong upgrades found for this horizon within bank and club
                  limits.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <Card
        title="Best inbound targets"
        subtitle={`League-wide for next ${horizon} · ${rankByLabel(rankBy)}`}
      >
        <PlayerTable players={targets} showThreat />
      </Card>
    </div>
  );
}
