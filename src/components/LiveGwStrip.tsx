"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ClubKit } from "@/components/PlayerMedia";

type LiveFixture = {
  id: number;
  kickoff_time: string | null;
  started: boolean | null;
  finished: boolean;
  minutes: number;
  team_h_name: string;
  team_a_name: string;
  team_h_score: number | null;
  team_a_score: number | null;
};

type LiveScorer = {
  id: number;
  webName: string;
  teamShort: string;
  teamCode: number;
  photo: string;
  points: number;
  minutes: number;
};

type LivePayload = {
  event: { id: number; name: string; finished: boolean } | null;
  isLive: boolean;
  fixtures: LiveFixture[];
  topScorers: LiveScorer[];
  error?: string;
};

export function LiveGwStrip() {
  const [data, setData] = useState<LivePayload | null>(null);

  const load = useCallback(() => {
    fetch("/api/live")
      .then(async (res) => {
        const json = (await res.json()) as LivePayload;
        if (!res.ok) throw new Error(json.error || "Live fetch failed");
        setData(json);
      })
      .catch(() => {
        /* keep last good snapshot */
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data?.isLive) return;
    const id = window.setInterval(load, 30_000);
    return () => window.clearInterval(id);
  }, [data?.isLive, load]);

  if (!data?.event) return null;

  const scoreboard = data.fixtures.filter(
    (f) => f.started || f.finished || f.team_h_score != null,
  );

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Live GW
          </p>
          <h2 className="text-lg font-bold text-zinc-50">
            {data.event.name}
            {data.isLive && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-rose-400">
                <span className="inline-block size-1.5 animate-pulse rounded-full bg-rose-400" />
                LIVE
              </span>
            )}
            {data.event.finished && (
              <span className="ml-2 text-xs font-semibold text-zinc-500">
                Finished
              </span>
            )}
          </h2>
        </div>
        <p className="text-[11px] text-zinc-500">
          Official FPL live · refreshes ~30s while live
        </p>
      </div>

      {scoreboard.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {scoreboard.map((f) => (
            <div
              key={f.id}
              className="min-w-[7.5rem] shrink-0 rounded-lg border border-zinc-800 bg-zinc-950/80 px-2.5 py-2 text-center"
            >
              <div className="text-[10px] text-zinc-500">
                {f.finished
                  ? "FT"
                  : f.started
                    ? `${f.minutes}'`
                    : "Scheduled"}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-zinc-100">
                {f.team_h_name} {f.team_h_score ?? "-"}–{f.team_a_score ?? "-"}{" "}
                {f.team_a_name}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.topScorers.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Top live scorers
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {data.topScorers.slice(0, 8).map((p) => (
              <Link
                key={p.id}
                href={`/players/${p.id}`}
                className="flex min-w-[5.5rem] shrink-0 flex-col items-center rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-2 hover:border-emerald-500/40"
              >
                <ClubKit
                  teamCode={p.teamCode}
                  teamShort={p.teamShort}
                  className="h-7 w-7 object-contain"
                />
                <span className="mt-1 truncate text-[11px] font-semibold text-zinc-100">
                  {p.webName}
                </span>
                <span className="text-sm font-bold text-emerald-400">
                  {p.points} pts
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
