"use client";

import { recommendChipTiming, type ChipTimingPick } from "@/lib/chip-timing";
import type { BestSquad, ScoredPlayer } from "@/lib/types";
import { useMemo } from "react";

function ChipRow({ pick }: { pick: ChipTimingPick }) {
  return (
    <li className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-semibold text-emerald-300">{pick.label}</span>
        <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400">
          GW{pick.gameweek}
        </span>
        <span className="ml-auto text-sm font-bold tabular-nums text-zinc-100">
          +{pick.score} value
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">{pick.detail}</p>
    </li>
  );
}

export function ChipTimingCard({
  scored,
  bestSquad,
  upcomingGameweeks,
}: {
  scored: ScoredPlayer[];
  bestSquad: BestSquad;
  upcomingGameweeks: number[];
}) {
  const picks = useMemo(
    () =>
      recommendChipTiming({
        scored,
        bestSquad,
        upcomingGameweeks,
      }),
    [scored, bestSquad, upcomingGameweeks],
  );

  if (picks.length === 0) return null;

  return (
    <section className="rounded-2xl border border-violet-900/40 bg-violet-950/20">
      <div className="border-b border-violet-900/30 px-4 py-3 md:px-5">
        <h2 className="text-base font-bold text-violet-200">Best time to chip</h2>
      </div>
      <ul className="space-y-2 px-4 py-3 md:px-5 md:py-4">
        {picks.map((pick) => (
          <ChipRow key={pick.chip} pick={pick} />
        ))}
      </ul>
    </section>
  );
}
