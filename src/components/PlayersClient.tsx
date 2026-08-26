"use client";

import { useMemo } from "react";
import { AnalysisFilters } from "@/components/AnalysisFilters";
import { PlayerTable } from "@/components/PlayerTable";
import { useAccumulatedPoints } from "@/hooks/useAccumulatedPoints";
import { useAnalysisPrefs } from "@/hooks/useAnalysisPrefs";
import { chipLabel } from "@/lib/chips";
import { filterByPrice, rankByLabel, sortByRank } from "@/lib/ranking";
import { applyHorizon } from "@/lib/scoring";
import type { Position, ScoredPlayer } from "@/lib/types";
import { useState } from "react";

export function PlayersClient({
  players,
  teams,
}: {
  players: ScoredPlayer[];
  teams: Array<{ id: number; name: string; short_name: string }>;
}) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<Position | "ALL">("ALL");
  const [teamId, setTeamId] = useState<number | "ALL">("ALL");
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
  } = useAnalysisPrefs();

  const ranked = useMemo(() => {
    const horizonApplied = applyHorizon(players, horizon, includeAccumulated);
    const priced = filterByPrice(horizonApplied, priceBounds);
    return sortByRank(priced, rankBy, seasonBasis, chip);
  }, [players, horizon, includeAccumulated, priceBounds, rankBy, seasonBasis, chip]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ranked.filter((p) => {
      if (position !== "ALL" && p.position !== position) return false;
      if (teamId !== "ALL" && p.teamId !== teamId) return false;
      if (!q) return true;
      return (
        p.webName.toLowerCase().includes(q) ||
        p.fullName.toLowerCase().includes(q) ||
        p.teamShort.toLowerCase().includes(q)
      );
    });
  }, [ranked, query, position, teamId]);

  return (
    <div className="space-y-4">
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
      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search player..."
          className="min-w-[12rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value as Position | "ALL")}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        >
          <option value="ALL">All positions</option>
          <option value="GKP">GKP</option>
          <option value="DEF">DEF</option>
          <option value="MID">MID</option>
          <option value="FWD">FWD</option>
        </select>
        <select
          value={teamId === "ALL" ? "ALL" : String(teamId)}
          onChange={(e) =>
            setTeamId(e.target.value === "ALL" ? "ALL" : Number(e.target.value))
          }
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        >
          <option value="ALL">All clubs</option>
          {teams
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
      </div>
      <p className="text-xs text-zinc-500">
        Showing {filtered.length} players · {rankByLabel(rankBy)}
        {chip !== "none" ? ` · ${chipLabel(chip)}` : ""} ·{" "}
        {seasonBasis === "prior" ? "prior seasons" : "this season"}
      </p>
      <PlayerTable players={filtered} showThreat />
    </div>
  );
}
