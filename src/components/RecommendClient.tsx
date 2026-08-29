"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BestFormationCard } from "@/components/BestFormationCard";
import { ChipTimingCard } from "@/components/ChipTimingCard";
import { PitchView } from "@/components/PitchView";
import { Reasons, TransferPlayerChip } from "@/components/PlayerTable";
import { Card, TipTrigger } from "@/components/ui";
import { pickCaptain, pickViceCaptain } from "@/lib/ranking";
import { buildRecommendedSquad, rankFormations } from "@/lib/squad";
import { bestInboundTargets, suggestTransfers } from "@/lib/transfers";
import type { ScoredPlayer } from "@/lib/types";
import { BUDGET, formatPrice } from "@/lib/utils";

export function RecommendClient({
  allPlayers,
  upcomingGameweeks,
  currentGameweek,
  horizon = 5,
}: {
  allPlayers: ScoredPlayer[];
  upcomingGameweeks: number[];
  currentGameweek: number;
  horizon?: number;
}) {
  const bestSquad = useMemo(() => {
    const squad = buildRecommendedSquad(allPlayers, BUDGET, horizon, [
      "overall",
    ]);
    if (!squad.captain || squad.startingXi.length === 0) return squad;
    const captain =
      pickCaptain(squad.startingXi, ["overall"]) ?? squad.captain;
    const vice =
      pickViceCaptain(squad.startingXi, captain, ["overall"]) ??
      squad.viceCaptain;
    return { ...squad, captain, viceCaptain: vice };
  }, [allPlayers, horizon]);

  const formations = useMemo(() => rankFormations(allPlayers), [allPlayers]);

  const captain =
    pickCaptain(bestSquad.startingXi, ["overall"]) ?? bestSquad.captain;

  const inbound = useMemo(
    () => bestInboundTargets(allPlayers, 12),
    [allPlayers],
  );

  const managerTransfers = useMemo(() => {
    if (bestSquad.squad.length === 0) return [];
    return suggestTransfers(
      bestSquad.squad,
      allPlayers,
      Math.max(0, bestSquad.bank),
      8,
      horizon,
    );
  }, [bestSquad, allPlayers, horizon]);

  return (
    <div className="space-y-6">
      {bestSquad.startingXi.length > 0 && (
        <Card
          title="Best XI"
          subtitle={`${bestSquad.formation} · ${formatPrice(bestSquad.totalCost)}`}
        >
          <PitchView
            title="Starting XI"
            startingXi={bestSquad.startingXi}
            bench={bestSquad.bench}
            captainId={bestSquad.captain?.id}
            viceId={bestSquad.viceCaptain?.id}
            horizon={horizon}
            selectedId={null}
            onSelect={() => undefined}
            currentGameweek={currentGameweek}
          />
        </Card>
      )}

      <ChipTimingCard
        scored={allPlayers}
        bestSquad={bestSquad}
        upcomingGameweeks={upcomingGameweeks}
      />

      <Card title="Captain pick">
        {captain ? (
          <div className="flex flex-wrap items-center gap-3">
            <TransferPlayerChip player={captain} tone="in" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-zinc-100">
                {captain.webName}{" "}
                <span className="text-sm font-normal text-zinc-500">
                  {captain.teamShort} · {captain.position}
                </span>
              </p>
              <p className="text-sm text-emerald-400">
                {captain.projectedPoints.toFixed(1)} xPts ·{" "}
                {Math.round(captain.startChance * 100)}% start
              </p>
            </div>
            <TipTrigger tip={<Reasons reasons={captain.reasons} />}>
              <span className="text-xs text-zinc-500">Why</span>
            </TipTrigger>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No captain candidate.</p>
        )}
      </Card>

      <BestFormationCard formations={formations} horizon={horizon} defaultOpen />

      <Card title="Suggested transfers">
        {managerTransfers.length === 0 ? (
          <p className="text-sm text-zinc-500">No strong upgrades.</p>
        ) : (
          <ul className="space-y-2">
            {managerTransfers.map((t) => (
              <li
                key={`${t.out.id}-${t.in.id}`}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3"
              >
                <TransferPlayerChip player={t.out} tone="out" />
                <span className="text-zinc-600">→</span>
                <TransferPlayerChip player={t.in} tone="in" />
                <span
                  className={[
                    "ml-auto text-sm font-semibold tabular-nums",
                    t.netProjectedGain >= 0
                      ? "text-emerald-400"
                      : "text-rose-400",
                  ].join(" ")}
                >
                  {t.netProjectedGain >= 0 ? "+" : ""}
                  {t.netProjectedGain.toFixed(1)} xPts
                </span>
                <TipTrigger tip={<Reasons reasons={t.reasons} />}>
                  <span className="text-xs text-zinc-500">Why</span>
                </TipTrigger>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Hot inbound targets"
        action={
          <Link
            href="/transfers"
            className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
          >
            All transfers →
          </Link>
        }
      >
        <div className="flex flex-wrap gap-2">
          {inbound.slice(0, 10).map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-1.5 text-xs"
            >
              <span className="font-semibold text-zinc-100">{p.webName}</span>
              <span className="text-zinc-500">
                {" "}
                · {p.teamShort} · {formatPrice(p.price)}
              </span>
              <span className="ml-1 text-emerald-400">
                {p.projectedPoints.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
