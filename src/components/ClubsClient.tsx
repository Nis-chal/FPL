"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FixtureStrip } from "@/components/FixturePill";
import { Card } from "@/components/ui";
import type { FixtureView } from "@/lib/types";

const CLUB_HORIZONS = [1, 2, 3, 4, 5, 6, 7] as const;

export type ClubListItem = {
  id: number;
  name: string;
  shortName: string;
  upcoming: FixtureView[];
  recent: FixtureView[];
};

function planningFixtures(upcoming: FixtureView[]): FixtureView[] {
  return upcoming.filter((f) => !f.isCurrent && !f.isLive);
}

/** Current/live GW belongs in Last 5 on list cards, not Next N. */
function lastFiveWithCurrent(
  recent: FixtureView[],
  upcoming: FixtureView[],
): FixtureView[] {
  const current = upcoming.filter((f) => f.isCurrent || f.isLive);
  const seen = new Set(recent.map((f) => f.id));
  const extra = current.filter((f) => !seen.has(f.id));
  return [...extra, ...recent].slice(0, 5);
}

function averageFdr(fixtures: FixtureView[], horizon: number): number {
  const slice = fixtures.slice(0, Math.max(1, horizon));
  if (slice.length === 0) return 3;
  return slice.reduce((sum, f) => sum + f.difficulty, 0) / slice.length;
}

function avgTone(avg: number): string {
  if (avg <= 2.4) return "text-emerald-300";
  if (avg <= 3.2) return "text-amber-300";
  return "text-rose-300";
}

export function ClubsClient({ clubs }: { clubs: ClubListItem[] }) {
  /** null = A–Z list, no FDR ranking */
  const [horizon, setHorizon] = useState<number | null>(null);

  const rows = useMemo(() => {
    const mapped = clubs.map((club) => {
      const upcoming = planningFixtures(club.upcoming);
      const recent = lastFiveWithCurrent(club.recent, club.upcoming);
      return {
        club: { ...club, upcoming, recent },
        avgFdr: averageFdr(upcoming, horizon ?? 7),
      };
    });
    if (horizon == null) {
      return mapped.sort((a, b) => a.club.name.localeCompare(b.club.name));
    }
    return mapped.sort((a, b) => {
      if (a.avgFdr !== b.avgFdr) return a.avgFdr - b.avgFdr;
      return a.club.name.localeCompare(b.club.name);
    });
  }, [clubs, horizon]);

  const stripLimit = horizon ?? 7;
  const ranking = horizon != null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Best upcoming
        </span>
        <div className="flex rounded-lg border border-zinc-700 bg-zinc-950 p-0.5">
          <button
            type="button"
            onClick={() => setHorizon(null)}
            className={[
              "rounded-md px-2.5 py-1 text-sm font-semibold transition",
              horizon == null
                ? "bg-emerald-500 text-zinc-950"
                : "text-zinc-400 hover:text-zinc-100",
            ].join(" ")}
          >
            Off
          </button>
          {CLUB_HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHorizon(h)}
              className={[
                "rounded-md px-2.5 py-1 text-sm font-semibold transition",
                horizon === h
                  ? "bg-emerald-500 text-zinc-950"
                  : "text-zinc-400 hover:text-zinc-100",
              ].join(" ")}
            >
              {h}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-500">
          {ranking ? "easiest FDR first" : "A–Z · optional rank"}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map(({ club, avgFdr }, index) => (
          <Card
            key={club.id}
            title={club.name}
            subtitle={
              ranking
                ? `${club.shortName} · #${index + 1} easiest next ${horizon}`
                : club.shortName
            }
            action={
              <div className="flex flex-col items-end gap-1">
                {ranking && (
                  <span
                    className={[
                      "font-mono text-sm font-bold tabular-nums",
                      avgTone(avgFdr),
                    ].join(" ")}
                    title={`Average FDR over next ${horizon} fixture${horizon === 1 ? "" : "s"}`}
                  >
                    FDR {avgFdr.toFixed(1)}
                  </span>
                )}
                <Link
                  href={`/clubs/${club.id}`}
                  className="text-sm text-emerald-400 hover:text-emerald-300"
                >
                  Details →
                </Link>
              </div>
            }
          >
            <div className="space-y-3">
              <div>
                <div className="mb-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
                  Next {stripLimit}
                </div>
                <FixtureStrip fixtures={club.upcoming} limit={stripLimit} />
              </div>
              <div>
                <div className="mb-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
                  Last 5
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {club.recent.map((f) => (
                    <span
                      key={f.id}
                      className={[
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        f.isLive || f.isCurrent
                          ? "ring-1 ring-rose-400/50"
                          : "",
                        f.result === "W"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : f.result === "L"
                            ? "bg-rose-500/20 text-rose-300"
                            : "bg-zinc-700 text-zinc-300",
                      ].join(" ")}
                    >
                      {f.result ?? "–"} {f.teamScore ?? "–"}-{f.opponentScore ?? "–"}{" "}
                      {f.isHome ? "vs" : "@"} {f.opponentShort}
                      {f.isLive
                        ? " · LIVE"
                        : f.isCurrent
                          ? " · NOW"
                          : ""}
                    </span>
                  ))}
                  {club.recent.length === 0 && (
                    <span className="text-xs text-zinc-500">
                      No finished matches yet
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
