"use client";

import { SquadClient } from "@/components/SquadClient";
import type { ScoredPlayer } from "@/lib/types";

export function SquadPageClient({
  allPlayers,
  currentGameweek,
  initialHorizon = 5,
}: {
  allPlayers: ScoredPlayer[];
  currentGameweek: number;
  initialHorizon?: number;
}) {
  return (
    <SquadClient
      allPlayers={allPlayers}
      initialHorizon={initialHorizon}
      currentGameweek={currentGameweek}
    />
  );
}
