"use client";

import type { ElementHistory, PastSeasonStats } from "@/lib/types";
import { Card } from "@/components/ui";

type GwRow = {
  round: number;
  points: number;
  goals: number;
  assists: number;
  minutes: number;
  opponentShort?: string;
  wasHome?: boolean;
};

function toRows(
  history: Array<
    ElementHistory & { opponentShort?: string }
  >,
): GwRow[] {
  return [...history]
    .sort((a, b) => a.round - b.round)
    .map((h) => ({
      round: h.round,
      points: h.total_points,
      goals: h.goals_scored,
      assists: h.assists,
      minutes: h.minutes,
      opponentShort: h.opponentShort,
      wasHome: h.was_home,
    }));
}

function ProgressChart({ rows }: { rows: GwRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No gameweek data yet this season.</p>
    );
  }

  const width = 560;
  const height = 200;
  const padL = 28;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const maxPts = Math.max(8, ...rows.map((r) => r.points));
  const maxGA = Math.max(2, ...rows.map((r) => r.goals + r.assists));

  const xAt = (i: number) =>
    padL + (rows.length <= 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW);
  const yPts = (v: number) => padT + innerH - (v / maxPts) * innerH;
  const yGA = (v: number) => padT + innerH - (v / maxGA) * innerH;

  const ptsPath = rows
    .map((r, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yPts(r.points).toFixed(1)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-48 w-full min-w-[20rem] text-zinc-100"
        role="img"
        aria-label="Points, goals and assists by gameweek"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + innerH * (1 - t);
          return (
            <line
              key={t}
              x1={padL}
              x2={width - padR}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.08}
            />
          );
        })}
        <path
          d={ptsPath}
          fill="none"
          stroke="#34d399"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {rows.map((r, i) => (
          <g key={r.round}>
            <circle
              cx={xAt(i)}
              cy={yPts(r.points)}
              r={3.5}
              fill="#34d399"
            />
            {/* Goals */}
            <rect
              x={xAt(i) - 6}
              y={yGA(r.goals)}
              width={5}
              height={Math.max(0, padT + innerH - yGA(r.goals))}
              fill="#38bdf8"
              opacity={0.85}
              rx={1}
            />
            {/* Assists */}
            <rect
              x={xAt(i) + 1}
              y={yGA(r.assists)}
              width={5}
              height={Math.max(0, padT + innerH - yGA(r.assists))}
              fill="#fbbf24"
              opacity={0.85}
              rx={1}
            />
            <text
              x={xAt(i)}
              y={height - 8}
              textAnchor="middle"
              className="fill-zinc-500"
              fontSize={9}
            >
              {r.round}
            </text>
          </g>
        ))}
        <text x={padL} y={12} className="fill-zinc-500" fontSize={10}>
          Pts (line) · Goals (blue) · Assists (amber)
        </text>
      </svg>
    </div>
  );
}

export function PlayerProgressSection({
  history,
}: {
  history: Array<ElementHistory & { opponentShort?: string }>;
}) {
  const rows = toRows(history);
  const chronological = [...rows].reverse();

  return (
    <Card
      title="Season progress"
      subtitle="Points, goals and assists by gameweek (this FPL season)"
    >
      <ProgressChart rows={rows} />
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-2 py-1">GW</th>
              <th className="px-2 py-1">Opp</th>
              <th className="px-2 py-1">Pts</th>
              <th className="px-2 py-1">G</th>
              <th className="px-2 py-1">A</th>
              <th className="px-2 py-1">Min</th>
            </tr>
          </thead>
          <tbody>
            {chronological.map((r) => (
              <tr key={r.round} className="border-t border-zinc-800">
                <td className="px-2 py-1.5">{r.round}</td>
                <td className="px-2 py-1.5 text-zinc-400">
                  {r.opponentShort
                    ? `${r.wasHome ? "vs" : "@"} ${r.opponentShort}`
                    : "—"}
                </td>
                <td className="px-2 py-1.5 font-semibold text-emerald-400">
                  {r.points}
                </td>
                <td className="px-2 py-1.5 text-sky-300">{r.goals}</td>
                <td className="px-2 py-1.5 text-amber-300">{r.assists}</td>
                <td className="px-2 py-1.5 text-zinc-400">{r.minutes}</td>
              </tr>
            ))}
            {chronological.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-4 text-zinc-500">
                  No appearances yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function PastSeasonsTable({
  seasons,
}: {
  seasons: PastSeasonStats[];
}) {
  const rows = [...seasons].slice(0, 5);
  if (rows.length === 0) {
    return (
      <Card title="Previous seasons" subtitle="Up to 5 prior FPL seasons">
        <p className="text-sm text-zinc-500">
          No prior FPL seasons on record for this player.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Previous seasons"
      subtitle="Last 5 FPL seasons (includes seasons after moving clubs / leagues into the Premier League)"
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-2 py-1.5">Season</th>
              <th className="px-2 py-1.5">Pts</th>
              <th className="px-2 py-1.5">G</th>
              <th className="px-2 py-1.5">A</th>
              <th className="px-2 py-1.5">Min</th>
              <th className="px-2 py-1.5">CS</th>
              <th className="px-2 py-1.5">Bonus</th>
              <th className="px-2 py-1.5">Price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.season_name} className="border-t border-zinc-800">
                <td className="px-2 py-2 font-semibold text-zinc-100">
                  {s.season_name}
                </td>
                <td className="px-2 py-2 text-emerald-400">{s.total_points}</td>
                <td className="px-2 py-2 text-sky-300">{s.goals_scored}</td>
                <td className="px-2 py-2 text-amber-300">{s.assists}</td>
                <td className="px-2 py-2 text-zinc-400">{s.minutes}</td>
                <td className="px-2 py-2 text-zinc-400">
                  {s.clean_sheets ?? "—"}
                </td>
                <td className="px-2 py-2 text-zinc-400">{s.bonus ?? "—"}</td>
                <td className="px-2 py-2 text-zinc-400">
                  {s.start_cost != null && s.end_cost != null
                    ? `£${(s.start_cost / 10).toFixed(1)}→${(s.end_cost / 10).toFixed(1)}m`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
