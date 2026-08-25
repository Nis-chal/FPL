import Link from "next/link";
import type { ScoredPlayer } from "@/lib/types";
import { formatPrice } from "@/lib/utils";
import { FixtureStrip } from "@/components/FixturePill";

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
        <Link
          href={`/players/${player.id}`}
          className="font-semibold text-zinc-100 hover:text-emerald-400"
        >
          {player.webName}
        </Link>
        <div className="text-[11px] text-zinc-500">
          {player.teamShort} · {player.position}
          {player.isPenTaker ? " · pens" : ""}
        </div>
      </td>
      <td className="px-3 py-2 text-sm text-zinc-300">{formatPrice(player.price)}</td>
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
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="min-w-full text-left">
        <thead className="bg-zinc-900 text-[11px] uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Player</th>
            <th className="px-3 py-2">Price</th>
            <th className="px-3 py-2">Start%</th>
            <th className="px-3 py-2">xPts/GW</th>
            {showThreat && (
              <>
                <th className="px-3 py-2">xGI/90</th>
                <th className="px-3 py-2">Win/CS</th>
              </>
            )}
            <th className="px-3 py-2">Next</th>
            {showFixtures && <th className="px-3 py-2">Next 5</th>}
          </tr>
        </thead>
        <tbody>
          {players.map((player, index) => (
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
