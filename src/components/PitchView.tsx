"use client";

import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import { ClubKit } from "@/components/PlayerMedia";
import { PlayerLink } from "@/components/PlayerDrawer";
import type { Position, ScoredPlayer } from "@/lib/types";
import {
  displayProjected,
  formationFromXi,
  groupByPosition,
  playerOverall,
  xiProjectedTotal,
} from "@/lib/pitch";

function EmptySlot({
  position,
  onFill,
  onRestore,
}: {
  position: Position;
  onFill: () => void;
  onRestore: () => void;
}) {
  return (
    <div className="relative flex h-[7.75rem] w-[4.75rem] shrink-0 flex-col items-center sm:h-[8.25rem] sm:w-[5.5rem]">
      <button
        type="button"
        onClick={onRestore}
        aria-label="Restore player"
        title="Undo remove"
        className="absolute -left-1.5 -top-1.5 z-20 flex size-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-300 ring-1 ring-zinc-600 hover:bg-zinc-700"
      >
        ↩
      </button>
      <button
        type="button"
        onClick={onFill}
        className="flex h-full w-full flex-col items-center justify-center rounded-xl border border-dashed border-rose-400/70 bg-rose-500/10 px-1 text-center transition hover:border-rose-300 hover:bg-rose-500/20"
      >
        <span className="text-lg font-bold leading-none text-rose-300">+</span>
        <span className="mt-1 text-[10px] font-semibold leading-tight text-rose-200">
          Add {position}
        </span>
        <span className="mt-0.5 text-[9px] text-zinc-400">Tap for list</span>
      </button>
    </div>
  );
}

function PitchPlayerCard({
  player,
  selected,
  onSelect,
  onRemove,
  isCaptain,
  isVice,
  horizon,
}: {
  player: ScoredPlayer;
  selected: boolean;
  onSelect: (id: number) => void;
  onRemove?: (id: number) => void;
  isCaptain?: boolean;
  isVice?: boolean;
  horizon: number;
}) {
  const overall = playerOverall(player);
  const pts = displayProjected(player, { isCaptain });
  void horizon;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(player.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(player.id);
        }
      }}
      className={[
        "group relative flex h-[7.75rem] w-[4.75rem] shrink-0 cursor-pointer flex-col items-center overflow-visible rounded-xl border px-1 pb-1 pt-2 text-center shadow-lg transition sm:h-[8.25rem] sm:w-[5.5rem]",
        selected
          ? "border-amber-400 bg-amber-500/20 ring-2 ring-amber-400/50"
          : "border-emerald-700/60 bg-zinc-950/85 hover:border-emerald-400",
      ].join(" ")}
    >
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${player.webName}`}
          title="Remove to transfer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove(player.id);
          }}
          className="absolute -left-1.5 -top-1.5 z-20 flex size-5 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-bold text-zinc-300 shadow ring-1 ring-zinc-600 transition hover:bg-rose-600 hover:text-white"
        >
          ×
        </button>
      )}
      <div className="absolute -right-1 -top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-900 px-1 text-[10px] font-bold text-amber-300 ring-1 ring-zinc-600">
        {overall}
      </div>
      {(isCaptain || isVice) && (
        <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded bg-emerald-500 px-1 text-[9px] font-bold leading-none text-zinc-950">
          {isCaptain ? "C" : "VC"}
        </span>
      )}
      <div className="pointer-events-none absolute right-0.5 top-6 z-10">
        <AvailabilityBadge
          status={player.status}
          chanceOfPlaying={player.chanceOfPlaying}
          news={player.news}
          compact
        />
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center sm:h-10 sm:w-10">
        <ClubKit
          teamCode={player.teamCode}
          teamShort={player.teamShort}
          position={player.position}
          preferJersey
          className="h-full w-full object-contain"
        />
      </div>
      <div className="mt-1 line-clamp-1 w-full px-0.5 text-[10px] font-bold leading-tight text-zinc-50 sm:text-[11px]">
        {player.webName}
      </div>
      <div className="mt-0.5 flex h-4 w-full items-center justify-center gap-0.5 text-[10px] font-semibold leading-none text-emerald-300 sm:text-[11px]">
        <span>{pts.toFixed(1)}</span>
        {player.livePoints != null && player.livePoints > 0 ? (
          <span className="text-[9px] text-amber-300">({player.livePoints})</span>
        ) : null}
      </div>
      <div className="mt-auto w-full truncate px-0.5 text-[9px] leading-tight text-zinc-400">
        {Math.round(player.startChance * 100)}% ·{" "}
        {player.expectedPointsPerGw.toFixed(1)}/GW
      </div>
      <PlayerLink
        playerId={player.id}
        className="mt-0.5 h-3 text-[9px] leading-none text-zinc-500 underline-offset-2 hover:text-emerald-400 hover:underline"
      >
        info
      </PlayerLink>
    </div>
  );
}

function PitchRow({
  players,
  selectedId,
  onSelect,
  onRemove,
  removedId,
  onFillSlot,
  onRestoreSlot,
  captainId,
  viceId,
  horizon,
}: {
  players: ScoredPlayer[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onRemove?: (id: number) => void;
  removedId?: number | null;
  onFillSlot?: () => void;
  onRestoreSlot?: () => void;
  captainId?: number;
  viceId?: number;
  horizon: number;
}) {
  return (
    <div className="flex flex-wrap items-stretch justify-center gap-2 sm:gap-3">
      {players.map((p) =>
        removedId === p.id && onFillSlot && onRestoreSlot ? (
          <EmptySlot
            key={p.id}
            position={p.position}
            onFill={onFillSlot}
            onRestore={onRestoreSlot}
          />
        ) : (
          <PitchPlayerCard
            key={p.id}
            player={p}
            selected={selectedId === p.id}
            onSelect={onSelect}
            onRemove={onRemove}
            isCaptain={captainId === p.id}
            isVice={viceId === p.id}
            horizon={horizon}
          />
        ),
      )}
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
  onRemove,
  removedId,
  onFillSlot,
  onRestoreSlot,
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
  onRemove?: (id: number) => void;
  removedId?: number | null;
  onFillSlot?: () => void;
  onRestoreSlot?: () => void;
  title: string;
  ratingScore?: number;
  ratingGrade?: string;
}) {
  const byPos = groupByPosition(startingXi);
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
            {formation} · × removes a player · tap empty slot to transfer · next{" "}
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
                onRemove={onRemove}
                removedId={removedId}
                onFillSlot={onFillSlot}
                onRestoreSlot={onRestoreSlot}
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
              : "× remove · empty slot → transfer list"}
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
          {bench.map((p, index) => (
            <div key={p.id} className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-zinc-500">
                {index + 1}
              </span>
              {removedId === p.id && onFillSlot && onRestoreSlot ? (
                <EmptySlot
                  position={p.position}
                  onFill={onFillSlot}
                  onRestore={onRestoreSlot}
                />
              ) : (
                <PitchPlayerCard
                  player={p}
                  selected={selectedId === p.id}
                  onSelect={onSelect}
                  onRemove={onRemove}
                  horizon={horizon}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
