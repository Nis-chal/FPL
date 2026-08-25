"use client";

import Link from "next/link";
import type { Position, ScoredPlayer } from "@/lib/types";
import {
  displayProjected,
  formationFromXi,
  groupByPosition,
  playerOverall,
  xiProjectedTotal,
} from "@/lib/pitch";

function PitchPlayerCard({
  player,
  selected,
  onSelect,
  isCaptain,
  isVice,
  horizon,
}: {
  player: ScoredPlayer;
  selected: boolean;
  onSelect: (id: number) => void;
  isCaptain?: boolean;
  isVice?: boolean;
  horizon: number;
}) {
  const overall = playerOverall(player);
  const pts = displayProjected(player, { isCaptain });

  return (
    <button
      type="button"
      onClick={() => onSelect(player.id)}
      className={[
        "group relative flex w-[4.75rem] flex-col items-center rounded-xl border px-1 py-1.5 text-center shadow-lg transition sm:w-[5.5rem]",
        selected
          ? "border-amber-400 bg-amber-500/20 ring-2 ring-amber-400/50"
          : "border-emerald-700/60 bg-zinc-950/85 hover:border-emerald-400",
      ].join(" ")}
    >
      <div className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-900 px-1 text-[10px] font-bold text-amber-300 ring-1 ring-zinc-600">
        {overall}
      </div>
      {(isCaptain || isVice) && (
        <span className="absolute -left-1 -top-1 rounded bg-emerald-500 px-1 text-[9px] font-bold text-zinc-950">
          {isCaptain ? "C" : "VC"}
        </span>
      )}
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white sm:h-9 sm:w-9 sm:text-xs">
        {player.teamShort.slice(0, 3)}
      </div>
      <div className="mt-1 w-full truncate text-[10px] font-bold text-zinc-50 sm:text-[11px]">
        {player.webName}
      </div>
      <div className="text-[10px] font-semibold text-emerald-300 sm:text-[11px]">
        {pts.toFixed(1)} xPts
      </div>
      <div className="text-[9px] text-zinc-400">
        {Math.round(player.startChance * 100)}% start ·{" "}
        {player.expectedPointsPerGw.toFixed(1)}/GW
      </div>
      <Link
        href={`/players/${player.id}`}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5 text-[9px] text-zinc-500 underline-offset-2 hover:text-emerald-400 hover:underline"
      >
        info
      </Link>
    </button>
  );
}

function PitchRow({
  players,
  selectedId,
  onSelect,
  captainId,
  viceId,
  horizon,
}: {
  players: ScoredPlayer[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  captainId?: number;
  viceId?: number;
  horizon: number;
}) {
  return (
    <div className="flex flex-wrap items-start justify-center gap-2 sm:gap-3">
      {players.map((p) => (
        <PitchPlayerCard
          key={p.id}
          player={p}
          selected={selectedId === p.id}
          onSelect={onSelect}
          isCaptain={captainId === p.id}
          isVice={viceId === p.id}
          horizon={horizon}
        />
      ))}
    </div>
  );
}

export function PitchView({
  startingXi,
  bench,
  captainId,
  viceId,
  horizon,
  selectedId,
  onSelect,
  title,
  ratingScore,
  ratingGrade,
}: {
  startingXi: ScoredPlayer[];
  bench: ScoredPlayer[];
  captainId?: number;
  viceId?: number;
  horizon: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  title: string;
  ratingScore?: number;
  ratingGrade?: string;
}) {
  const byPos = groupByPosition(startingXi);
  // FPL pitch: attackers at top, keeper at bottom
  const rows: Array<{ pos: Position; players: ScoredPlayer[] }> = [
    { pos: "FWD", players: byPos.FWD },
    { pos: "MID", players: byPos.MID },
    { pos: "DEF", players: byPos.DEF },
    { pos: "GKP", players: byPos.GKP },
  ];
  const formation = formationFromXi(startingXi);
  const total = xiProjectedTotal(startingXi, captainId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-zinc-100">{title}</h3>
          <p className="text-sm text-zinc-500">
            {formation} · tap a player, then a bench player to swap · next{" "}
            {horizon} GWs
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {ratingGrade != null && ratingScore != null && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400">
                Overall
              </div>
              <div className="text-xl font-bold text-emerald-300">
                {ratingGrade}{" "}
                <span className="text-sm text-zinc-300">{ratingScore}</span>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            XI xPts
          </div>
          <div className="text-xl font-bold text-zinc-100">
            {total.toFixed(1)}{" "}
            <span className="text-xs font-normal text-zinc-500">
              / next {horizon}
            </span>
          </div>
          </div>
        </div>
      </div>

      <div
        className="relative overflow-hidden rounded-2xl border border-emerald-800/50 p-3 sm:p-5"
        style={{
          background:
            "linear-gradient(180deg, #14532d 0%, #166534 18%, #15803d 50%, #166534 82%, #14532d 100%)",
        }}
      >
        {/* Pitch markings */}
        <div className="pointer-events-none absolute inset-3 rounded-xl border-2 border-white/20 sm:inset-5" />
        <div className="pointer-events-none absolute left-1/2 top-3 h-[18%] w-[36%] -translate-x-1/2 rounded-b-xl border-2 border-t-0 border-white/20 sm:top-5" />
        <div className="pointer-events-none absolute bottom-3 left-1/2 h-[18%] w-[36%] -translate-x-1/2 rounded-t-xl border-2 border-b-0 border-white/20 sm:bottom-5" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/20" />
        <div className="pointer-events-none absolute left-3 right-3 top-1/2 border-t-2 border-white/15 sm:left-5 sm:right-5" />

        <div className="relative z-10 flex min-h-[28rem] flex-col justify-between gap-4 py-2 sm:min-h-[32rem]">
          {rows.map(({ pos, players }) => (
            <div key={pos} className="space-y-1">
              <div className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                {pos}
              </div>
              <PitchRow
                players={players}
                selectedId={selectedId}
                onSelect={onSelect}
                captainId={captainId}
                viceId={viceId}
                horizon={horizon}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-bold text-zinc-200">Bench</h4>
          <span className="text-xs text-zinc-500">
            {selectedId
              ? "Select a pitch or bench player to complete the swap"
              : "Select someone to swap"}
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
          {bench.map((p, index) => (
            <div key={p.id} className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-zinc-500">
                {index + 1}
              </span>
              <PitchPlayerCard
                player={p}
                selected={selectedId === p.id}
                onSelect={onSelect}
                horizon={horizon}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
