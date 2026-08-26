"use client";

import type { ElementHistory, PastSeasonStats } from "@/lib/types";
import { sortSeasonsLatestFirst } from "@/lib/season-sort";
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
  history: Array<ElementHistory & { opponentShort?: string }>,
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

function linePath(
  values: number[],
  xAt: (i: number) => number,
  yAt: (v: number) => number,
): string {
  return values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`)
    .join(" ");
}

function ProgressChart({ rows }: { rows: GwRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No gameweek data yet this season.</p>
    );
  }

  const width = 560;
  const height = 220;
  const padL = 28;
  const padR = 12;
  const padT = 28;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const maxY = Math.max(
    8,
    ...rows.map((r) => Math.max(r.points, r.goals, r.assists)),
  );

  const xAt = (i: number) =>
    padL + (rows.length <= 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW);
  const yAt = (v: number) => padT + innerH - (v / maxY) * innerH;

  const ptsPath = linePath(
    rows.map((r) => r.points),
    xAt,
    yAt,
  );
  const goalsPath = linePath(
    rows.map((r) => r.goals),
    xAt,
    yAt,
  );
  const assistsPath = linePath(
    rows.map((r) => r.assists),
    xAt,
    yAt,
  );

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-52 w-full min-w-[20rem] text-zinc-100"
        role="img"
        aria-label="Points, goals and assists by gameweek line chart"
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
          d={goalsPath}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={assistsPath}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
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
            <circle cx={xAt(i)} cy={yAt(r.goals)} r={3} fill="#38bdf8" />
            <circle cx={xAt(i)} cy={yAt(r.assists)} r={3} fill="#fbbf24" />
            <circle cx={xAt(i)} cy={yAt(r.points)} r={3.5} fill="#34d399" />
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

        <g fontSize={10}>
          <circle cx={padL} cy={12} r={3.5} fill="#34d399" />
          <text x={padL + 8} y={15} className="fill-zinc-400">
            Pts
          </text>
          <circle cx={padL + 48} cy={12} r={3} fill="#38bdf8" />
          <text x={padL + 56} y={15} className="fill-zinc-400">
            Goals
          </text>
          <circle cx={padL + 108} cy={12} r={3} fill="#fbbf24" />
          <text x={padL + 116} y={15} className="fill-zinc-400">
            Assists
          </text>
        </g>
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

/** Newest FPL seasons first. */
export function PastSeasonsTable({
  seasons,
  currentSeason,
}: {
  seasons: PastSeasonStats[];
  /** Live 25/26 (or current) season totals — FPL does not put these in history_past. */
  currentSeason?: PastSeasonStats | null;
}) {
  const prior = sortSeasonsLatestFirst(
    seasons.filter(
      (s) =>
        !currentSeason ||
        s.season_name.replace(/-/g, "/") !==
          currentSeason.season_name.replace(/-/g, "/"),
    ),
  );
  const rows = currentSeason
    ? [currentSeason, ...prior].slice(0, 6)
    : prior.slice(0, 5);

  if (rows.length === 0) {
    return (
      <Card title="Season stats" subtitle="Current + prior FPL seasons">
        <p className="text-sm text-zinc-500">
          No season totals on record for this player yet.
        </p>
      </Card>
    );
  }

  const currentName = currentSeason?.season_name;

  return (
    <Card
      title="Season stats"
      subtitle={
        currentName
          ? `${currentName} (current) plus prior FPL seasons`
          : "Prior FPL seasons"
      }
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
              <th className="px-2 py-1.5">xGI</th>
              <th className="px-2 py-1.5">Price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const isCurrent = currentName != null && s.season_name === currentName;
              const xgi =
                s.expected_goal_involvements != null
                  ? Number(s.expected_goal_involvements)
                  : NaN;
              return (
                <tr
                  key={s.season_name}
                  className={[
                    "border-t border-zinc-800",
                    isCurrent ? "bg-emerald-500/5" : "",
                  ].join(" ")}
                >
                  <td className="px-2 py-2 font-semibold text-zinc-100">
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      {s.season_name}
                      {isCurrent && (
                        <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                          Current
                        </span>
                      )}
                    </span>
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
                    {Number.isFinite(xgi) ? xgi.toFixed(1) : "—"}
                  </td>
                  <td className="px-2 py-2 text-zinc-400">
                    {isCurrent && s.end_cost != null
                      ? `£${(s.end_cost / 10).toFixed(1)}m`
                      : s.start_cost != null && s.end_cost != null
                        ? `£${(s.start_cost / 10).toFixed(1)}→${(s.end_cost / 10).toFixed(1)}m`
                        : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
