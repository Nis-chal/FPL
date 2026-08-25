"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import { ClubKit, PlayerPhoto } from "@/components/PlayerMedia";
import type { ScoredPlayer } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import { FixtureStrip } from "@/components/FixturePill";

type SortKey =
  | "default"
  | "totalPoints"
  | "expectedPointsPerGw"
  | "price"
  | "startChance"
  | "xgi90";

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th className="px-3 py-2">
      <button
        type="button"
        onClick={onClick}
        className={[
          "inline-flex items-center gap-1 uppercase tracking-wider transition hover:text-zinc-200",
          active ? "text-emerald-400" : "text-zinc-500",
        ].join(" ")}
      >
        {label}
        <span className="text-[9px] opacity-80" aria-hidden>
          {active ? (dir === "desc" ? "↓" : "↑") : "↕"}
        </span>
      </button>
    </th>
  );
}

export function PlayerRow({
  player,
  showFixtures = true,
  showThreat = false,
  rank,
}: {
  player: ScoredPlayer;
  showFixtures?: boolean;
  showThreat?: boolean;
  rank?: number;
}) {
  return (
    <tr className="border-b border-zinc-800/80 hover:bg-zinc-900/60">
      {rank !== undefined && (
        <td className="px-3 py-2 text-xs text-zinc-500">{rank}</td>
      )}
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <PlayerPhoto
            photo={player.photo}
            alt={player.webName}
            className="h-9 w-7 shrink-0 rounded object-cover"
          />
          <div>
            <Link
              href={`/players/${player.id}`}
              className="font-semibold text-zinc-100 hover:text-emerald-400"
            >
              {player.webName}
            </Link>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
              <span>
                {player.teamShort} · {player.position}
                {player.isPenTaker ? " · pens" : ""}
              </span>
              <AvailabilityBadge
                status={player.status}
                chanceOfPlaying={player.chanceOfPlaying}
                news={player.news}
                compact
              />
              {player.livePoints != null && player.livePoints > 0 && (
                <span className="text-emerald-400">
                  live {player.livePoints}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2 text-sm font-semibold tabular-nums text-zinc-100">
        {player.totalPoints}
      </td>
      <td className="px-3 py-2 text-sm text-zinc-300">
        {formatPrice(player.price)}
      </td>
      <td className="px-3 py-2 text-sm text-zinc-300">
        {Math.round(player.startChance * 100)}%
      </td>
      <td className="px-3 py-2 text-sm font-semibold text-emerald-400">
        {player.expectedPointsPerGw.toFixed(1)}
        <div className="text-[10px] font-normal text-zinc-500">
          {player.projectedPoints.toFixed(1)} horizon
        </div>
      </td>
      {showThreat && (
        <>
          <td className="px-3 py-2 text-sm text-zinc-300">
            {player.xgi90.toFixed(2)}
            <div className="text-[10px] text-zinc-500">
              thr {player.attackingThreat}
            </div>
          </td>
          <td className="px-3 py-2 text-sm text-zinc-300">
            {player.nextWinChance}%
            {(player.position === "GKP" || player.position === "DEF") && (
              <div className="text-[10px] text-zinc-500">
                CS {player.cleanSheetChance}%
              </div>
            )}
          </td>
        </>
      )}
      <td className="px-3 py-2 text-xs text-zinc-400">
        {player.nextOpponent ?? "—"}
        {player.nextDifficulty != null && (
          <span className="ml-1 text-zinc-500">FDR {player.nextDifficulty}</span>
        )}
      </td>
      {showFixtures && (
        <td className="px-3 py-2">
          <FixtureStrip fixtures={player.upcomingFixtures} limit={5} />
        </td>
      )}
    </tr>
  );
}

export function PlayerTable({
  players,
  showFixtures = true,
  showThreat = false,
}: {
  players: ScoredPlayer[];
  showFixtures?: boolean;
  showThreat?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortDir("desc");
  };

  const sorted = useMemo(() => {
    if (sortKey === "default") return players;
    const mult = sortDir === "desc" ? -1 : 1;
    return [...players].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return b.totalPoints - a.totalPoints;
      return (av < bv ? -1 : 1) * mult;
    });
  }, [players, sortKey, sortDir]);

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="min-w-full text-left">
        <thead className="bg-zinc-900 text-[11px] uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Player</th>
            <SortHeader
              label="Pts"
              active={sortKey === "totalPoints"}
              dir={sortDir}
              onClick={() => toggleSort("totalPoints")}
            />
            <SortHeader
              label="Price"
              active={sortKey === "price"}
              dir={sortDir}
              onClick={() => toggleSort("price")}
            />
            <SortHeader
              label="Start%"
              active={sortKey === "startChance"}
              dir={sortDir}
              onClick={() => toggleSort("startChance")}
            />
            <SortHeader
              label="xPts/GW"
              active={sortKey === "expectedPointsPerGw"}
              dir={sortDir}
              onClick={() => toggleSort("expectedPointsPerGw")}
            />
            {showThreat && (
              <>
                <SortHeader
                  label="xGI/90"
                  active={sortKey === "xgi90"}
                  dir={sortDir}
                  onClick={() => toggleSort("xgi90")}
                />
                <th className="px-3 py-2">Win/CS</th>
              </>
            )}
            <th className="px-3 py-2">Next</th>
            {showFixtures && <th className="px-3 py-2">Next 5</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((player, index) => (
            <PlayerRow
              key={player.id}
              player={player}
              rank={index + 1}
              showFixtures={showFixtures}
              showThreat={showThreat}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Reasons({ reasons }: { reasons: string[] }) {
  return (
    <ul className="mt-2 space-y-1">
      {reasons.map((reason) => (
        <li key={reason} className="text-xs text-zinc-400">
          · {reason}
        </li>
      ))}
    </ul>
  );
}

/** Compact transfer row media + badge helper. */
export function TransferPlayerChip({
  player,
  tone,
}: {
  player: ScoredPlayer;
  tone: "out" | "in";
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <ClubKit
        teamCode={player.teamCode}
        teamShort={player.teamShort}
        position={player.position}
        className="h-5 w-5 object-contain"
      />
      <span
        className={
          tone === "out"
            ? "font-semibold text-rose-300"
            : "font-semibold text-emerald-400"
        }
      >
        {player.webName}
      </span>
      <AvailabilityBadge
        status={player.status}
        chanceOfPlaying={player.chanceOfPlaying}
        news={player.news}
        compact
      />
    </span>
  );
}
