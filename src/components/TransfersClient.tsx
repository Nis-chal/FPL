"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnalysisFilters } from "@/components/AnalysisFilters";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import { TeamIdForm } from "@/components/TeamIdForm";
import {
  PlayerTable,
  Reasons,
  TransferPlayerChip,
} from "@/components/PlayerTable";
import { TeamRatingCard } from "@/components/TeamRatingCard";
import { Card, ErrorBox } from "@/components/ui";
import { useTeamId } from "@/hooks/useTeamId";
import { useAccumulatedPoints } from "@/hooks/useAccumulatedPoints";
import { useAnalysisPrefs } from "@/hooks/useAnalysisPrefs";
import { filterByPrice, rankByLabel, sortByRank } from "@/lib/ranking";
import { applyHorizon } from "@/lib/scoring";
import { bestInboundTargets } from "@/lib/transfers";
import type { ScoredPlayer, TeamRating, TransferSuggestion } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

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
    priceBounds,
    setPriceBounds,
  } = useAnalysisPrefs({ horizon: initialHorizon });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<TransferSuggestion[] | null>(null);
  const [teamRating, setTeamRating] = useState<TeamRating | null>(null);
  const [entryName, setEntryName] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const targets = useMemo(() => {
    const scored = applyHorizon(allPlayers, horizon, includeAccumulated);
    const priced = filterByPrice(scored, priceBounds);
    return bestInboundTargets(sortByRank(priced, rankBy, seasonBasis), 20);
  }, [allPlayers, horizon, includeAccumulated, priceBounds, rankBy, seasonBasis]);

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
        <Card
          title={`Personal transfers${entryName ? ` · ${entryName}` : ""}`}
          subtitle={
            hint ||
            `Swaps for the next ${horizon} fixtures — ${rankByLabel(rankBy)}`
          }
        >
          <div className="space-y-3">
            {transfers.map((t) => (
              <div
                key={`${t.out.id}-${t.in.id}-${t.horizon}`}
                className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-200">
                    <Link href={`/players/${t.out.id}`}>
                      <TransferPlayerChip player={t.out} tone="out" />
                    </Link>
                    <span className="text-zinc-500">→</span>
                    <Link href={`/players/${t.in.id}`}>
                      <TransferPlayerChip player={t.in} tone="in" />
                    </Link>
                    <span className="text-xs text-zinc-500">
                      {t.out.position} · {t.out.teamShort} → {t.in.teamShort}
                    </span>
                    <AvailabilityBadge
                      status={t.in.status}
                      chanceOfPlaying={t.in.chanceOfPlaying}
                      news={t.in.news}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 text-right text-sm">
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
                    <div>
                      <div className="font-semibold text-zinc-200">
                        {t.threatDelta >= 0 ? "+" : ""}
                        {t.threatDelta} threat
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {t.winChanceDelta >= 0 ? "+" : ""}
                        {t.winChanceDelta}% next-win
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
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
                </div>
                <Reasons reasons={t.reasons} />
              </div>
            ))}
            {transfers.length === 0 && (
              <p className="text-sm text-zinc-500">
                No strong upgrades found for this horizon within bank and club
                limits.
              </p>
            )}
          </div>
        </Card>
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
