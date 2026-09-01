"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PitchView } from "@/components/PitchView";
import { buildAiSquad } from "@/lib/ai-squad-build";
import type { ScoredPlayer } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

export function AiSquadHomeCard({
  players,
  horizon = 5,
  currentGameweek,
}: {
  players: ScoredPlayer[];
  horizon?: number;
  currentGameweek?: number;
}) {
  const built = useMemo(
    () => buildAiSquad(players, { horizon }),
    [players, horizon],
  );

  if (built.startingXi.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-800/50 bg-gradient-to-b from-emerald-950/40 to-zinc-900/40">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-emerald-900/40 px-4 py-4 md:px-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Squad
          </p>
          <h2 className="mt-1 text-xl font-bold text-zinc-50">Best squad</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {built.formation} · {formatPrice(built.totalCost)}
          </p>
        </div>
        <Link
          href="/squad"
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          Manage →
        </Link>
      </div>
      <div className="p-4 md:p-5">
        <PitchView
          title="Starting XI"
          startingXi={built.startingXi}
          bench={built.bench}
          captainId={built.captain?.id}
          viceId={built.viceCaptain?.id}
          horizon={horizon}
          currentGameweek={currentGameweek}
          selectedId={null}
          onSelect={() => undefined}
        />
      </div>
    </section>
  );
}
